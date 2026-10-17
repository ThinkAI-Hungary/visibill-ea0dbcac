import React, { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { UploadCloud, FileText, Loader2, X, RefreshCw, Layers } from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import { reportError } from '@/lib/errorReporter';
import { useTranslation } from "react-i18next";
import { parseRlbRftChartOfAccounts } from '@/lib/rlb/rlbRftParser';
import { useQuery, useQueryClient } from "@tanstack/react-query";

// Helper to load PDF.js dynamically from CDN
const loadPdfJs = async (): Promise<any> => {
  if ((window as any).pdfjsLib) {
    return (window as any).pdfjsLib;
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js";
    script.onload = () => {
      const pdfjsLib = (window as any).pdfjsLib;
      pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";
      resolve(pdfjsLib);
    };
    script.onerror = () => reject(new Error("Nem sikerült betölteni a PDF-feldolgozó könyvtárat."));
    document.head.appendChild(script);
  });
};

// Parser function to extract and match GL accounts from PDF
const parsePdfChartOfAccounts = async (file: File): Promise<any[]> => {
  const pdfjsLib = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const rows: any[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items = textContent.items as any[];
    
    const tolerance = 3;
    const yGroups: { y: number; items: any[] }[] = [];
    
    for (const item of items) {
      if (!item.str || !item.str.trim()) continue;
      const y = item.transform[5];
      let group = yGroups.find(g => Math.abs(g.y - y) <= tolerance);
      if (!group) {
        group = { y, items: [] };
        yGroups.push(group);
      }
      group.items.push(item);
    }
    
    yGroups.sort((a, b) => b.y - a.y);
    
    for (const group of yGroups) {
      group.items.sort((a, b) => a.transform[4] - b.transform[4]);
      
      const lineText = group.items.map(item => item.str).join(" ").trim();
      if (!lineText) continue;

      const match = lineText.match(/^\s*(\d[\d.-]*)\s+(.+)$/);
      if (match) {
        const glNumber = match[1].trim();
        const name = match[2].trim();
        const nameLower = name.toLowerCase();
        
        const hasStandaloneWord = (text: string, word: string) => {
          const regex = new RegExp(`(?:^|[^a-záéíóöőúüű])${word}(?:[^a-záéíóöőúüű]|$)`, 'i');
          return regex.test(text);
        };

        if (
          nameLower.includes("budapest") || 
          hasStandaloneWord(nameLower, "utca") || 
          hasStandaloneWord(nameLower, "út") || 
          hasStandaloneWord(nameLower, "tér") || 
          hasStandaloneWord(nameLower, "tere") || 
          nameLower.includes("kft.") || 
          nameLower.includes("bt.") || 
          nameLower.includes("adószám") ||
          nameLower.includes("lapszám") ||
          nameLower.includes("üzleti év") ||
          nameLower.includes("készült:") ||
          nameLower.includes("ügyviteli")
        ) {
          continue;
        }

        rows.push({
          gl_number: glNumber,
          short_name: name
        });
      }
    }
  }

  return rows;
};

interface UploadChartOfAccountsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (presetId: string) => void;
}

export function UploadChartOfAccountsModal({ open, onOpenChange, onSuccess }: UploadChartOfAccountsModalProps) {
  const { t } = useTranslation(['accounting', 'common']);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();

  // Query existing active preset for company
  const { data: activePreset } = useQuery({
    queryKey: ['activeCoaPresetForUpload', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return null;
      const { data } = await supabase
        .from('chart_of_accounts_presets')
        .select('id, name, type, is_active')
        .eq('company_id', selectedCompany.id)
        .eq('is_active', true)
        .maybeSingle();
      return data;
    },
    enabled: !!selectedCompany?.id && open,
  });

  const resetState = () => {
    setName("");
    setFile(null);
    setLoading(false);
    setImportMode('merge');
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
    const validExtensions = ['.csv', '.xlsx', '.xls', '.pdf', '.txt', '.rft', '.dbf'];
    const nameLower = selectedFile.name.toLowerCase();
    if (validExtensions.some(ext => nameLower.endsWith(ext))) {
      setFile(selectedFile);
      if (!name.trim()) {
        const cleanName = selectedFile.name.replace(/\.[^/.]+$/, "").trim();
        setName(activePreset?.name || cleanName);
      }
    } else {
      toast({
        title: t('accounting:dialogs.upload_coa.toasts.invalid_format_title'),
        description: t('accounting:dialogs.upload_coa.toasts.invalid_format_desc'),
        variant: "destructive"
      });
    }
  };

  const handleSubmit = async () => {
    if (!selectedCompany) return;
    if (!name.trim()) {
      toast({
        title: t('accounting:dialogs.upload_coa.toasts.missing_name_title'),
        description: t('accounting:dialogs.upload_coa.toasts.missing_name_desc'),
        variant: "destructive"
      });
      return;
    }
    if (!file) {
      toast({
        title: t('accounting:dialogs.upload_coa.toasts.missing_file_title'),
        description: t('accounting:dialogs.upload_coa.toasts.missing_file_desc'),
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    const processRows = async (rows: any[]) => {
      try {
        if (!rows || rows.length === 0) throw new Error(t('accounting:dialogs.upload_coa.toasts.empty_file'));

        let targetPresetId = activePreset?.id;
        const isMerging = importMode === 'merge' && !!activePreset;

        // 1. If not merging into active preset, create or get preset
        if (!isMerging) {
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

          targetPresetId = presetData.id;

          // Deactivate other custom presets for this company
          await supabase
            .from('chart_of_accounts_presets')
            .update({ is_active: false })
            .eq('company_id', selectedCompany.id)
            .eq('type', 'custom')
            .neq('id', targetPresetId);
        }

        // 2. Prepare parsed insert data
        const rawInsertData = rows.map((row) => {
          const rowValues = Object.values(row);
          
          const findKey = (searchTerms: string[]) => {
            const key = Object.keys(row).find(k => 
              searchTerms.some(term => k.toLowerCase().includes(term.toLowerCase()))
            );
            return key ? row[key] : null;
          };

          const rawGlNumber = findKey(['fokszam', 'főkszám', 'fők.szám', 'főkönyvi szám', 'főkönyvi', 'fksz', 'account', 'számlaszám', 'gl_number']) 
            || rowValues[0] || '';
            
          const glNumber = String(rawGlNumber).trim().replace(/\s*-\s*$/, '').replace(/\s*-\s*/g, '-');
          const shortName = findKey(['foknev', 'megnevezés', 'megnev', 'név', 'name', 'számlanév', 'short_name']) 
            || rowValues[1] || '';
          const description = findKey(['leírás', 'description', 'desc']) 
            || rowValues[2] || null;

          return {
            preset_id: targetPresetId!,
            gl_number: glNumber,
            short_name: String(shortName).trim(),
            description: description ? String(description).trim() : null
          };
        }).filter(r => r.gl_number !== '' && r.short_name !== '');

        // Deduplicate by gl_number
        const seenGlNumbers = new Set<string>();
        const parsedAccounts = rawInsertData.filter(item => {
          const cleanKey = item.gl_number.toUpperCase().replace(/\s+/g, '').replace(/\.$/, '');
          if (seenGlNumbers.has(cleanKey)) return false;
          seenGlNumbers.add(cleanKey);
          return true;
        });

        if (parsedAccounts.length === 0) throw new Error(t('accounting:dialogs.upload_coa.toasts.no_valid_rows'));

        // Standardize 491 and 492
        if (!parsedAccounts.some(d => d.gl_number.replace(/\./g, '').trim() === '491')) {
          parsedAccounts.push({
            preset_id: targetPresetId!,
            gl_number: '491',
            short_name: 'Nyitó mérleg számla',
            description: null
          });
        }
        if (!parsedAccounts.some(d => d.gl_number.replace(/\./g, '').trim() === '492')) {
          parsedAccounts.push({
            preset_id: targetPresetId!,
            gl_number: '492',
            short_name: 'Záró mérleg számla',
            description: null
          });
        }

        // 3. MERGE or REPLACE execution
        if (isMerging) {
          // Fetch existing accounts in this active preset
          const { data: existingRows, error: fetchErr } = await supabase
            .from('gl_accounts')
            .select('id, gl_number')
            .eq('preset_id', targetPresetId);

          if (fetchErr) throw fetchErr;

          const existingMap = new Map((existingRows || []).map(r => [r.gl_number.replace(/\.$/, ''), r.id]));
          let updatedCount = 0;
          const toInsert: any[] = [];

          for (const item of parsedAccounts) {
            const cleanNum = item.gl_number.replace(/\.$/, '');
            const existingId = existingMap.get(cleanNum);

            if (existingId) {
              // Update short_name and description, preserve all other attributes
              await supabase
                .from('gl_accounts')
                .update({ short_name: item.short_name, description: item.description, updated_at: new Date().toISOString() })
                .eq('id', existingId);
              updatedCount++;
            } else {
              toInsert.push(item);
            }
          }

          if (toInsert.length > 0) {
            const chunkSize = 500;
            for (let i = 0; i < toInsert.length; i += chunkSize) {
              const chunk = toInsert.slice(i, i + chunkSize);
              const { error: insErr } = await supabase.from('gl_accounts').insert(chunk);
              if (insErr) throw insErr;
            }
          }

          toast({
            title: "Számlatükör sikeresen összevonva & frissítve",
            description: `${updatedCount} meglévő számla megnevezése frissült, ${toInsert.length} új számlaszám hozzáadva. A meglévő könyvelések érintetlenek maradtak.`,
            className: "bg-green-50 text-green-900 border-green-200"
          });
        } else {
          // Clean insert into targetPresetId
          const chunkSize = 1000;
          for (let i = 0; i < parsedAccounts.length; i += chunkSize) {
            const chunk = parsedAccounts.slice(i, i + chunkSize);
            const { error: insertError } = await supabase.from('gl_accounts').insert(chunk);
            if (insertError) {
              reportError({ type: 'upload', component: 'UploadChartOfAccountsModal', action: 'error', message: String(insertError), error: insertError });
              throw new Error(t('accounting:dialogs.upload_coa.toasts.save_gl_error'));
            }
          }

          toast({
            title: t('accounting:dialogs.upload_coa.toasts.success_title'),
            description: t('accounting:dialogs.upload_coa.toasts.success_desc', { count: parsedAccounts.length })
          });
        }

        queryClient.invalidateQueries({ queryKey: ['coaPresets'] });
        queryClient.invalidateQueries({ queryKey: ['glBalances'] });
        queryClient.invalidateQueries({ queryKey: ['general-ledger-tree'] });

        onSuccess(targetPresetId!);
        handleOpenChange(false);
      } catch (error: any) {
        toast({
          title: t('accounting:dialogs.upload_coa.toasts.process_error_title'),
          description: error.message || t('accounting:dialogs.upload_coa.toasts.process_error_desc'),
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    const fileNameLower = file.name.toLowerCase();

    if (fileNameLower.endsWith('.rft') || fileNameLower.endsWith('.dbf')) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const parsedResult = parseRlbRftChartOfAccounts(arrayBuffer);
        if (!parsedResult || parsedResult.accounts.length === 0) {
          throw new Error('A fájl nem tartalmaz érvényes RLB számlatükör sorokat.');
        }
        await processRows(parsedResult.accounts);
      } catch (err: any) {
        toast({
          title: 'RLB RFT feldolgozási hiba',
          description: err.message || 'Nem sikerült feldolgozni az RLB formátumot.',
          variant: 'destructive',
        });
        setLoading(false);
      }
      return;
    }

    if (fileNameLower.endsWith('.pdf')) {
      try {
        const parsedRows = await parsePdfChartOfAccounts(file);
        if (!parsedRows || parsedRows.length === 0) {
          throw new Error(t('accounting:dialogs.upload_coa.toasts.no_gl_in_pdf'));
        }
        await processRows(parsedRows);
      } catch (error: any) {
        toast({
          title: t('accounting:dialogs.upload_coa.toasts.pdf_error_title'),
          description: error.message || t('accounting:dialogs.upload_coa.toasts.pdf_error_desc'),
          variant: "destructive"
        });
        setLoading(false);
      }
      return;
    }

    if (fileNameLower.endsWith('.csv') || fileNameLower.endsWith('.txt')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          await processRows(results.data);
        },
        error: (error) => {
          toast({
            title: t('accounting:dialogs.upload_coa.toasts.csv_error_title'),
            description: error.message,
            variant: "destructive"
          });
          setLoading(false);
        }
      });
    } else {
      try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        await processRows(rows);
      } catch (error: any) {
        toast({
          title: t('accounting:dialogs.upload_coa.toasts.excel_error_title'),
          description: error.message || "Hibás Excel fájl formátum.",
          variant: "destructive"
        });
        setLoading(false);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('accounting:dialogs.upload_coa.title')}</DialogTitle>
          <DialogDescription>
            {t('accounting:dialogs.upload_coa.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-3">
          {/* Active Preset Merge vs Replace Selection */}
          {activePreset && (
            <div className="rounded-lg border border-border/80 p-3.5 bg-muted/20 space-y-2.5">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-primary" />
                <span>Importálási mód (Aktív számlatükör: {activePreset.name})</span>
              </Label>
              <RadioGroup
                value={importMode}
                onValueChange={(val) => setImportMode(val as 'merge' | 'replace')}
                className="space-y-2 text-xs"
              >
                <label
                  htmlFor="mode-merge"
                  className={`flex items-start gap-2.5 p-2.5 rounded-md border cursor-pointer transition-colors ${
                    importMode === 'merge' ? 'border-primary bg-primary/5 text-foreground' : 'border-border/60 hover:bg-muted/40 text-muted-foreground'
                  }`}
                >
                  <RadioGroupItem value="merge" id="mode-merge" className="mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-semibold block text-foreground">Bővítés & Frissítés (Merge - Ajánlott)</span>
                    <span className="text-[11px] text-muted-foreground leading-tight block">
                      A meglévő számlaszámok megnevezését frissíti, az új számlákat hozzáadja. A könyvelések 100%-ig sértetlenek maradnak.
                    </span>
                  </div>
                </label>

                <label
                  htmlFor="mode-replace"
                  className={`flex items-start gap-2.5 p-2.5 rounded-md border cursor-pointer transition-colors ${
                    importMode === 'replace' ? 'border-primary bg-primary/5 text-foreground' : 'border-border/60 hover:bg-muted/40 text-muted-foreground'
                  }`}
                >
                  <RadioGroupItem value="replace" id="mode-replace" className="mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-semibold block text-foreground">Tiszta csere (Replace)</span>
                    <span className="text-[11px] text-muted-foreground leading-tight block">
                      Új számlatükörként tölti be és aktiválja, lecserélve a jelenlegi sablont.
                    </span>
                  </div>
                </label>
              </RadioGroup>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="preset-name">{t('accounting:dialogs.upload_coa.preset_name')}</Label>
            <Input 
              id="preset-name" 
              placeholder={t('accounting:dialogs.upload_coa.preset_name_placeholder')} 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('accounting:dialogs.upload_coa.file_source')}</Label>
            {!file ? (
              <div 
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${loading ? 'opacity-50 pointer-events-none' : 'hover:bg-muted/50 border-primary/30'}`}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="flex flex-col items-center justify-center space-y-2 text-muted-foreground">
                  <UploadCloud className="h-8 w-8 text-primary/60" />
                  <p className="text-sm font-medium">{t('accounting:dialogs.upload_coa.drag_drop_text')}</p>
                  <p className="text-xs">{t('accounting:dialogs.upload_coa.supported_formats')}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 border rounded-lg bg-primary/5 border-primary/20 min-w-0">
                <div className="flex items-center space-x-3 overflow-hidden min-w-0">
                  <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                  <span className="text-sm font-medium truncate">{file.name}</span>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 !text-destructive flex-shrink-0 ml-2" onClick={() => setFile(null)} disabled={loading}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/pdf,text/plain,.xml,text/xml,application/xml,.rft,.dbf"
              onChange={handleFileSelect} 
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            {t('accounting:dialogs.upload_coa.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !file || !name}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {importMode === 'merge' && activePreset ? 'Összevonás & Mentés' : t('accounting:dialogs.upload_coa.upload_save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
