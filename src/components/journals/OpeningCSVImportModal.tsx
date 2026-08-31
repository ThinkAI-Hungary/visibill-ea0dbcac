import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { UploadCloud, FileSpreadsheet, Download, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface OpeningCSVImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportGlBalances: (items: Array<{ gl_number: string; dc_type: 'T' | 'K'; amount: number; description?: string }>) => void;
}

export default function OpeningCSVImportModal({
  open,
  onOpenChange,
  onImportGlBalances
}: OpeningCSVImportModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'gl' | 'invoices'>('gl');
  const [file, setFile] = useState<File | null>(null);
  const [parsedItems, setParsedItems] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) return;

        if (selected.name.endsWith('.json')) {
          const json = JSON.parse(text);
          if (Array.isArray(json)) {
            setParsedItems(json);
          } else {
            throw new Error('A JSON fájlnak tömböt kell tartalmaznia.');
          }
        } else {
          // CSV parser (handles comma or semicolon delimiter)
          const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
          if (lines.length < 2) {
            throw new Error('A CSV fájlnak legalább egy fejlécet és egy adatsort tartalmaznia kell.');
          }

          const delimiter = lines[0].includes(';') ? ';' : ',';
          const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/"/g, ''));
          
          const items: any[] = [];
          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(delimiter).map(c => c.trim().replace(/"/g, ''));
            if (cols.length < 3) continue;

            if (activeTab === 'gl') {
              // Expected headers: gl_number, dc_type (T/K), amount
              const glIndex = headers.findIndex(h => h.includes('szamla') || h.includes('gl') || h.includes('szam'));
              const dcIndex = headers.findIndex(h => h.includes('jel') || h.includes('dc') || h.includes('t_k') || h.includes('irany'));
              const amtIndex = headers.findIndex(h => h.includes('osszeg') || h.includes('amount') || h.includes('egyenleg'));
              const descIndex = headers.findIndex(h => h.includes('leiras') || h.includes('desc') || h.includes('nev'));

              const gl_number = glIndex >= 0 ? cols[glIndex] : cols[0];
              const dcRaw = dcIndex >= 0 ? cols[dcIndex].toUpperCase() : cols[1]?.toUpperCase();
              const dc_type: 'T' | 'K' = (dcRaw.startsWith('T') || dcRaw.startsWith('D')) ? 'T' : 'K';
              const amtStr = amtIndex >= 0 ? cols[amtIndex] : cols[2];
              const amount = Math.abs(parseFloat(amtStr.replace(/\s/g, '').replace(',', '.')) || 0);
              const description = descIndex >= 0 ? cols[descIndex] : (cols[3] || 'Nyitó egyenleg');

              if (gl_number && amount > 0) {
                items.push({ gl_number, dc_type, amount, description });
              }
            }
          }

          setParsedItems(items);
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Hiba történt a fájl beolvasásakor.');
        setParsedItems([]);
      }
    };
    reader.readAsText(selected, 'UTF-8');
  };

  const handleDownloadSampleGl = () => {
    const csvContent = 'szamlaszam;irany;osszeg;megnevezes\n' +
      '111;T;1500000;Immateriális javak\n' +
      '121;T;12000000;Ingatlanok bruttó értéke\n' +
      '129;K;3200000;Ingatlanok halmozott értékcsökkenése\n' +
      '311;T;4500000;Vevőkövetelések nyitó\n' +
      '3841;T;8500000;Bankszámla nyitó\n' +
      '411;K;5000000;Jegyzett tőke\n' +
      '413;K;10800000;Eredménytartalék\n' +
      '454;K;7500000;Szállítói kötelezettségek nyitó\n';
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'nyito_fokonyvi_minta.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleConfirmImport = () => {
    if (parsedItems.length === 0) {
      toast({ title: 'Nincs érvényes adat', description: 'A fájl nem tartalmazott feldolgozható sorokat.', variant: 'destructive' });
      return;
    }

    if (activeTab === 'gl') {
      onImportGlBalances(parsedItems);
      toast({ title: 'Sikeres importálás', description: `${parsedItems.length} db főkönyvi nyitó tétele beimportálva!` });
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-primary" />
            Nyitó adatok tömeges importálása (CSV / JSON)
          </DialogTitle>
          <DialogDescription>
            Tölts fel CSV vagy JSON fájlt a nyitó egyenlegek és analitikák gyors felviteléhez.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-4">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="gl" className="gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              Főkönyvi Nyitó egyenlegek
            </TabsTrigger>
            <TabsTrigger value="invoices" className="gap-2" disabled>
              <FileText className="w-4 h-4" />
              Nyitó Számlák (Hamarosan)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="gl" className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg border text-xs">
              <div>
                <span className="font-semibold block text-foreground">Elvárt oszlopok:</span>
                <span className="text-muted-foreground">szamlaszam, irany (T/K), osszeg, megnevezes</span>
              </div>
              <Button size="sm" variant="outline" onClick={handleDownloadSampleGl} className="gap-1.5 h-8 text-xs">
                <Download className="w-3.5 h-3.5" /> Mintafájl
              </Button>
            </div>

            <div className="border-2 border-dashed rounded-xl p-6 text-center hover:bg-muted/30 transition-colors">
              <input
                type="file"
                accept=".csv, .json, .txt"
                onChange={handleFileChange}
                className="hidden"
                id="opening-csv-input"
              />
              <label htmlFor="opening-csv-input" className="cursor-pointer flex flex-col items-center gap-2">
                <UploadCloud className="w-8 h-8 text-primary opacity-80" />
                <span className="text-sm font-semibold">Kattints ide a CSV vagy JSON fájl kiválasztásához</span>
                <span className="text-xs text-muted-foreground">Formátum: UTF-8 kódolású CSV vagy JSON</span>
              </label>
            </div>

            {file && (
              <div className="flex items-center gap-2 p-2.5 bg-card border rounded-lg text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="font-medium truncate">{file.name}</span>
                <span className="ml-auto text-muted-foreground shrink-0">{parsedItems.length} beolvasott tétel</span>
              </div>
            )}

            {errorMsg && (
              <div className="flex items-center gap-2 p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-lg text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Mégse</Button>
          <Button onClick={handleConfirmImport} disabled={parsedItems.length === 0}>
            Importálás alkalmazása ({parsedItems.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
