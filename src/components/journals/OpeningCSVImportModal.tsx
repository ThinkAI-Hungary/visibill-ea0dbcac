import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  FileText,
  Loader2,
  Sparkles,
  Scale,
  Layers,
  ListFilter
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { formatCurrencyLocale } from '@/lib/locale/formatters';
import { parseOpeningFile, OpeningImportReport, ParsedOpeningLine } from '@/features/journals/services/openingImportParser';

interface OpeningCSVImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportGlBalances: (
    items: Array<{ gl_number: string; dc_type: 'T' | 'K'; amount: number; description?: string }>,
    metadata?: { currency?: string; suggestedDate?: string; suggestedYear?: number }
  ) => void;
}

export default function OpeningCSVImportModal({
  open,
  onOpenChange,
  onImportGlBalances
}: OpeningCSVImportModalProps) {
  const { t } = useTranslation(['accounting', 'common']);
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'gl' | 'invoices'>('gl');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<OpeningImportReport | null>(null);
  const [importMode, setImportMode] = useState<'aggregated' | 'detailed'>('aggregated');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const processFile = async (selected: File) => {
    setFile(selected);
    setErrorMsg(null);
    setLoading(true);

    try {
      const parsedReport = await parseOpeningFile(selected);
      setReport(parsedReport);
      // If aggregated differs from detailed, default to aggregated for clean GL balance sheet
      if (parsedReport.aggregatedItems.length !== parsedReport.detailedItems.length) {
        setImportMode('aggregated');
      } else {
        setImportMode('detailed');
      }
    } catch (err: any) {
      setErrorMsg(err.message || t('dialogs.opening_csv_import.errors.file_read_error', { defaultValue: 'Hiba történt a fájl beolvasásakor.' }));
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) processFile(selected);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFile = e.dataTransfer?.files?.[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
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

  const activeItems: ParsedOpeningLine[] = report
    ? (importMode === 'aggregated' ? report.aggregatedItems : report.detailedItems)
    : [];

  const handleConfirmImport = () => {
    if (!report || activeItems.length === 0) {
      toast({ 
        title: t('dialogs.opening_csv_import.errors.no_valid_data', { defaultValue: 'Nincs érvényes adat' }), 
        description: t('dialogs.opening_csv_import.errors.no_rows_desc', { defaultValue: 'A fájl nem tartalmazott feldolgozható sorokat.' }), 
        variant: 'destructive' 
      });
      return;
    }

    if (activeTab === 'gl') {
      onImportGlBalances(activeItems, {
        currency: report.currency,
        suggestedDate: report.suggestedDate,
        suggestedYear: report.suggestedYear
      });
      toast({ 
        title: t('dialogs.opening_csv_import.errors.import_success', { defaultValue: 'Sikeres importálás' }), 
        description: t('dialogs.opening_csv_import.errors.import_success_desc', { count: activeItems.length, defaultValue: `${activeItems.length} db főkönyvi nyitó tétel beimportálva!` }) 
      });
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/40 bg-muted/20 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <UploadCloud className="w-5 h-5 text-primary" />
            {t('dialogs.opening_csv_import.title', { defaultValue: 'Nyitó adatok importálása (.xlsx, .xls, .csv, .json)' })}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5">
            {t('dialogs.opening_csv_import.description', { defaultValue: 'Tölts fel Excel (.xlsx, .xls), CSV vagy JSON formátumú nyitóállományt a nyitó egyenlegek gyors felviteléhez.' })}
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-4 overflow-y-auto">
          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-4">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="gl" className="gap-2 text-xs">
                <FileSpreadsheet className="w-4 h-4" />
                {t('dialogs.opening_csv_import.tabs.gl', { defaultValue: 'Főkönyvi Nyitó egyenlegek' })}
              </TabsTrigger>
              <TabsTrigger value="invoices" className="gap-2 text-xs" disabled>
                <FileText className="w-4 h-4" />
                {t('dialogs.opening_csv_import.tabs.invoices', { defaultValue: 'Nyitó Számlák (Hamarosan)' })}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="gl" className="space-y-4 mt-0">
              <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl border text-xs">
                <div>
                  <span className="font-semibold block text-foreground">{t('dialogs.opening_csv_import.expected_columns', { defaultValue: 'Támogatott formátumok:' })}</span>
                  <span className="text-muted-foreground">{t('dialogs.opening_csv_import.expected_cols_list', { defaultValue: '.xlsx, .xls, .xml, .csv, .json' })}</span>
                </div>
                <Button size="sm" variant="outline" onClick={handleDownloadSampleGl} className="gap-1.5 h-8 text-xs shrink-0">
                  <Download className="w-3.5 h-3.5" /> {t('dialogs.opening_csv_import.sample_file', { defaultValue: 'CSV Minta' })}
                </Button>
              </div>

              <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !loading && document.getElementById('opening-csv-input')?.click()}
                className={cn(
                  "border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer select-none",
                  isDragging 
                    ? "border-primary bg-primary/10 scale-[1.01]" 
                    : "border-border/80 hover:border-primary/60 hover:bg-muted/30"
                )}
              >
                <input
                  type="file"
                  accept=".xlsx, .xls, .xml, .csv, .json, .txt"
                  onChange={handleFileChange}
                  className="hidden"
                  id="opening-csv-input"
                  disabled={loading}
                />
                <div className="flex flex-col items-center gap-2 pointer-events-none">
                  {loading ? (
                    <Loader2 className="w-9 h-9 text-primary animate-spin" />
                  ) : (
                    <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                      <UploadCloud className="w-8 h-8" />
                    </div>
                  )}
                  <span className="text-sm font-semibold text-foreground">
                    {loading
                      ? 'Fájl feldolgozása...'
                      : t('dialogs.opening_csv_import.upload_drop_title', { defaultValue: 'Húzd ide vagy kattints a fájl kiválasztásához' })}
                  </span>
                  <span className="text-xs text-muted-foreground max-w-md">
                    {t('dialogs.opening_csv_import.upload_drop_subtitle', { defaultValue: 'Támogatott kiterjesztések: .xlsx, .xls, .xml, .csv, .json' })}
                  </span>
                </div>
              </div>

              {file && report && (
                <div className="space-y-3">
                  {/* Format & Balance Card */}
                  <div className="p-4 rounded-xl border bg-card space-y-3 shadow-2xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="gap-1 text-xs bg-primary/10 text-primary border-primary/30 py-0.5">
                          <Sparkles className="w-3.5 h-3.5" />
                          {report.formatName}
                        </Badge>
                        <Badge variant="secondary" className="text-xs font-mono">
                          {report.currency}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground font-medium">
                        {report.rawRowCount} nyers sor feldolgozva
                      </span>
                    </div>

                    {/* Totals & Balance indicator */}
                    <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-muted/40 text-xs font-mono">
                      <div>
                        <span className="text-muted-foreground block text-[10px] uppercase font-sans">Összes Tartozik (T)</span>
                        <span className="font-bold text-blue-600">
                          {formatCurrencyLocale(report.totalDebit, report.currency)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px] uppercase font-sans">Összes Követel (K)</span>
                        <span className="font-bold text-emerald-600">
                          {formatCurrencyLocale(report.totalCredit, report.currency)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px] uppercase font-sans">Mérlegegyezőség</span>
                        {report.isBalanced ? (
                          <span className="font-bold text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> 0,00 {report.currency}
                          </span>
                        ) : (
                          <span className="font-bold text-rose-600 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" /> Eltérés: {formatCurrencyLocale(report.imbalance, report.currency)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Mode selection toggle if aggregated differs from detailed */}
                    {report.aggregatedItems.length !== report.detailedItems.length && (
                      <div className="pt-2 border-t border-border/40 space-y-2">
                        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-primary" /> Beemelési mód a Nyitó Főkönyvbe:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setImportMode('aggregated')}
                            className={cn(
                              "p-3 rounded-lg border text-left transition-all",
                              importMode === 'aggregated'
                                ? "bg-primary/10 border-primary text-foreground shadow-2xs font-medium"
                                : "bg-muted/20 border-border hover:bg-muted/40 text-muted-foreground"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-foreground">Összesített Főkönyv</span>
                              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">Ajánlott</Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1">
                              Számlánkénti nettó egyenlegek ({report.aggregatedItems.length} számla). Ideális az átlátható mérlegnyitáshoz.
                            </p>
                          </button>

                          <button
                            type="button"
                            onClick={() => setImportMode('detailed')}
                            className={cn(
                              "p-3 rounded-lg border text-left transition-all",
                              importMode === 'detailed'
                                ? "bg-primary/10 border-primary text-foreground shadow-2xs font-medium"
                                : "bg-muted/20 border-border hover:bg-muted/40 text-muted-foreground"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-foreground">Teljesen Tételes</span>
                              <Badge variant="outline" className="text-[10px]">{report.detailedItems.length} sor</Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1">
                              Minden tétel különálló könyvelési sorként jelenik meg az egyedi bizonylatszámokkal és leírásokkal.
                            </p>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Subledger notification if open invoices detected */}
                    {report.subledgerInvoices.length > 0 && (
                      <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 rounded-lg text-xs flex items-center gap-2">
                        <FileText className="w-4 h-4 shrink-0 text-blue-500" />
                        <span>
                          A fájl <strong>{report.subledgerInvoices.length} db</strong> tételes nyitó számlát is tartalmaz (vevő- és szállító analitika), amely a 3. lépésben kerül felhasználásra.
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Compact Preview Table */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      <ListFilter className="w-3.5 h-3.5" /> Betöltendő tételek előnézete ({activeItems.length} db tétel):
                    </span>
                    <div className="border rounded-xl overflow-hidden bg-card text-xs">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-muted/50 border-b border-border/40 text-[10px] uppercase font-semibold text-muted-foreground">
                          <tr>
                            <th className="py-2 px-3 w-10">#</th>
                            <th className="py-2 px-3 w-28">Számlaszám</th>
                            <th className="py-2 px-3 text-center w-16">Jel</th>
                            <th className="py-2 px-3 text-right w-32">Összeg</th>
                            <th className="py-2 px-3">Megnevezés</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20 font-mono">
                          {activeItems.slice(0, 6).map((item, idx) => (
                            <tr key={idx} className="hover:bg-muted/10 font-sans">
                              <td className="py-1.5 px-3 text-muted-foreground font-mono text-[11px]">{idx + 1}</td>
                              <td className="py-1.5 px-3 font-mono font-bold text-primary">{item.gl_number}</td>
                              <td className="py-1.5 px-3 text-center">
                                <Badge className={item.dc_type === 'T' ? "bg-blue-500/10 text-blue-600 border-blue-500/20 px-1.5 py-0 text-[10px]" : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 px-1.5 py-0 text-[10px]"} variant="outline">
                                  {item.dc_type}
                                </Badge>
                              </td>
                              <td className="py-1.5 px-3 text-right font-mono font-semibold">
                                {formatCurrencyLocale(item.amount, report.currency)}
                              </td>
                              <td className="py-1.5 px-3 text-muted-foreground text-xs truncate max-w-[200px]">
                                {item.description}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {activeItems.length > 6 && (
                        <div className="p-2 text-center text-[11px] text-muted-foreground bg-muted/20 border-t border-border/20 italic">
                          ... és további {activeItems.length - 6} db tétel
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {errorMsg && (
                <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-xl text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="px-6 py-3 border-t border-border/40 bg-muted/20 shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t('dialogs.opening_csv_import.cancel', { defaultValue: 'Mégse' })}
          </Button>
          <Button
            size="sm"
            onClick={handleConfirmImport}
            disabled={!report || activeItems.length === 0}
            className="gap-1.5 bg-primary text-primary-foreground font-semibold"
          >
            <CheckCircle2 className="w-4 h-4" />
            {t('dialogs.opening_csv_import.apply_import', { count: activeItems.length, defaultValue: `Importálás alkalmazása (${activeItems.length})` })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
