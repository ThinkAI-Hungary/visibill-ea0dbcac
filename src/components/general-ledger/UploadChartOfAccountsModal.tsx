import React, { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UploadCloud, FileText, Loader2, X } from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import { reportError } from '@/lib/errorReporter';

interface UploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (presetId: string) => void;
}

export function UploadChartOfAccountsModal({ open, onOpenChange, onSuccess }: UploadModalProps) {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setName("");
    setFile(null);
    setLoading(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !loading) {
      resetState();
    }
    onOpenChange(newOpen && !loading);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    const validExensions = ['.csv', '.xlsx', '.xls'];
    const nameLower = selectedFile.name.toLowerCase();
    if (validExensions.some(ext => nameLower.endsWith(ext))) {
      setFile(selectedFile);
    } else {
      toast({ title: "Hibás formátum", description: "Kérlek CSV vagy Excel (XLSX, XLS) fájlt tölts fel.", variant: "destructive" });
    }
  };

  const handleSubmit = async () => {
    if (!selectedCompany) return;
    if (!name.trim()) {
      toast({ title: "Hiányzó név", description: "Kérlek adj meg egy nevet a sablonnak.", variant: "destructive" });
      return;
    }
    if (!file) {
      toast({ title: "Hiányzó fájl", description: "Kérlek tölts fel egy CSV vagy Excel fájlt.", variant: "destructive" });
      return;
    }

    setLoading(true);

    const processRows = async (rows: any[]) => {
      try {
        if (!rows || rows.length === 0) throw new Error("A fájl üres vagy nem megfelelő formátumú.");

        // 1. Create preset
        const newPresetRow = {
          type: 'custom',
          name: name.trim(),
          is_active: true,
          company_id: selectedCompany.id
        };

        const { data: presetData, error: presetError } = await supabase
          .from('chart_of_accounts_presets')
          .insert(newPresetRow)
          .select()
          .single();

        if (presetError || !presetData) {
          reportError({ type: 'upload', component: 'UploadChartOfAccountsModal', action: 'error', message: String(presetError), error: presetError });
          throw new Error(`Hiba a sablon létrehozása során: ${presetError?.message || 'Ismeretlen hiba'}`);
        }

        const presetId = presetData.id;

        // 2. Deactivate other custom presets for this company
        await supabase
          .from('chart_of_accounts_presets')
          .update({ is_active: false })
          .eq('company_id', selectedCompany.id)
          .eq('type', 'custom')
          .neq('id', presetId);

        // 3. Prepare bulk insert data
        const insertData = rows.map((row) => {
          const rowValues = Object.values(row);
          
          // Case-insensitive key search for Hungarian headers
          const findKey = (searchTerms: string[]) => {
            const key = Object.keys(row).find(k => 
              searchTerms.some(term => k.toLowerCase().includes(term.toLowerCase()))
            );
            return key ? row[key] : null;
          };

          const glNumber = findKey(['fokszam', 'főkszám', 'fők.szám', 'főkönyvi', 'account', 'számlaszám', 'gl_number']) 
            || rowValues[0] || '';
            
          const shortName = findKey(['foknev', 'megnevezés', 'megnev', 'név', 'name', 'számlanév', 'short_name']) 
            || rowValues[1] || '';
            
          const description = findKey(['leírás', 'description', 'desc']) 
            || rowValues[2] || null;

           return {
              preset_id: presetId,
              gl_number: String(glNumber).trim(),
              short_name: String(shortName).trim(),
              description: description ? String(description).trim() : null
           };
        }).filter(r => r.gl_number !== '' && r.short_name !== ''); // drop completely empty/junk parsed mappings

        if (insertData.length === 0) throw new Error("Nem találtunk érvényes sorkódokat a fájlban. Ellenőrizd a fejlécet/adatokat!");

        // 4. Chunk insert (Supabase typically handles bulk well up to a few thousands, but chunking is safer)
        const chunkSize = 1000;
        for (let i = 0; i < insertData.length; i += chunkSize) {
          const chunk = insertData.slice(i, i + chunkSize);
          const { error: insertError } = await supabase.from('gl_accounts').insert(chunk);
          if (insertError) {
            reportError({ type: 'upload', component: 'UploadChartOfAccountsModal', action: 'error', message: String(insertError), error: insertError });
            throw new Error("Hiba a főkönyvi tételek mentésekor.");
          }
        }

        toast({ title: "Sikeres feltöltés", description: `${insertData.length} főkönyvi tétel sikeresen betöltve.` });
        onSuccess(presetId);
        handleOpenChange(false);
        
      } catch (error: any) {
        toast({ title: "Feltöltési hiba", description: error.message || "A mentés megszakadt.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    const isCsv = file.name.toLowerCase().endsWith('.csv');

    if (isCsv) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => processRows(results.data),
        error: (error) => {
           toast({ title: "Fájlfeldolgozási hiba", description: error.message, variant: "destructive" });
           setLoading(false);
        }
      });
    } else {
      try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        // Parse directly to JSON, array of objects, similar to what PapaParse provides
        const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        await processRows(rows);
      } catch (error: any) {
        toast({ title: "Excel feldolgozási hiba", description: error.message || "Hibás Excel fájl formátum.", variant: "destructive" });
        setLoading(false);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Új Számlatükör Feltöltése</DialogTitle>
          <DialogDescription>
            Importálj egyéni számlatükröt CSV vagy Excel fájlból. Az adatok Oszlopai sorrendje: Főkönyvi szám, Név, (Leírás opcionális).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="preset-name">Sablon neve *</Label>
            <Input 
              id="preset-name" 
              placeholder="pl. Ügyfél Egyedi Számlatükör 2024" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label>Fájl forrása *</Label>
            {!file ? (
              <div 
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${loading ? 'opacity-50 pointer-events-none' : 'hover:bg-muted/50 border-primary/30'}`}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="flex flex-col items-center justify-center space-y-2 text-muted-foreground">
                  <UploadCloud className="h-8 w-8 text-primary/60" />
                  <p className="text-sm font-medium">Kattints, vagy húzd ide a CSV/Excel fájlt</p>
                  <p className="text-xs">Támogatott: .csv, .xlsx, .xls (max. 10MB)</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 border rounded-lg bg-primary/5 border-primary/20">
                <div className="flex items-center space-x-3 overflow-hidden">
                  <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                  <span className="text-sm font-medium truncate">{file.name}</span>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 !text-destructive flex-shrink-0" onClick={() => setFile(null)} disabled={loading}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={handleFileSelect} 
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>Mégsem</Button>
          <Button onClick={handleSubmit} disabled={loading || !file || !name}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Feltöltés és Mentés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
