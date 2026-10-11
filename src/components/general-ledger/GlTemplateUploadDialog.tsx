import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  UploadCloud, FileSpreadsheet, AlertTriangle, CheckCircle2, 
  Loader2, X, Info, Sparkles, HelpCircle 
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CustomTooltip } from '@/components/ui/custom-tooltip';
import { parseGlTemplateFile, type ParsedTemplateResult } from '@/lib/glTemplateParser';
import type { GlTemplateColumn, GlSampleRow } from '@/types/glTemplate';
import { cn } from '@/lib/utils';

interface GlTemplateUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (newTemplate: {
    name: string;
    description?: string;
    columns: GlTemplateColumn[];
    source_file_name?: string;
    sampleRows?: GlSampleRow[];
  }) => Promise<void>;
}

export function GlTemplateUploadDialog({
  open,
  onOpenChange,
  onSuccess,
}: GlTemplateUploadDialogProps) {
  const { t } = useTranslation(['accounting', 'common']);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [templateName, setTemplateName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedTemplateResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const resetForm = () => {
    setTemplateName('');
    setSelectedFile(null);
    setIsParsing(false);
    setIsSaving(false);
    setParsedResult(null);
    setErrorMessage(null);
    setIsDragging(false);
  };

  const handleFileProcess = async (file: File) => {
    setSelectedFile(file);
    setErrorMessage(null);
    setIsParsing(true);

    try {
      const result = await parseGlTemplateFile(file);
      setParsedResult(result);
      if (!templateName.trim()) {
        setTemplateName(result.name || 'Saját főkönyvi sablon');
      }
    } catch (err: any) {
      console.error('Error parsing GL template file:', err);
      setErrorMessage(err.message || 'Nem sikerült beolvasni a fájlt. Kérjük, ellenőrizze a formátumot.');
      setParsedResult(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handleSave = async () => {
    if (!parsedResult || !templateName.trim()) return;

    setIsSaving(true);
    try {
      await onSuccess({
        name: templateName.trim(),
        description: `Egyedi sablon: ${selectedFile?.name || 'mintafájl'} alapján (${parsedResult.columns.length} oszlop)`,
        columns: parsedResult.columns,
        source_file_name: selectedFile?.name,
        sampleRows: parsedResult.sampleRows,
      });
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Nem sikerült elmenteni az új sablont.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val) resetForm();
      onOpenChange(val);
    }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col gap-4 overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <UploadCloud className="w-5 h-5 text-primary" />
            <span>{t('accounting:general_ledger.upload_modal.title', 'Új főkönyvi mintasablon feltöltése')}</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            {t('accounting:general_ledger.upload_modal.subtitle', 'Töltse fel a cégénél vagy irodájánál megszokott Excel (.xlsx) vagy CSV mintafájlt. A rendszer automatikusan kinyeri a fejléceket és elkészíti a testreszabott nézetet.')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* 1. Sablon Elnevezése */}
          <div className="space-y-1.5">
            <Label htmlFor="templateName" className="text-xs font-semibold">
              {t('accounting:general_ledger.upload_modal.name_label', 'Új sablon elnevezése *')}
            </Label>
            <Input
              id="templateName"
              placeholder={t('accounting:general_ledger.upload_modal.name_placeholder', 'pl. Saját irodai 6 oszlopos főkönyv')}
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="h-9 text-xs sm:text-sm"
            />
          </div>

          {/* 2. Drag-and-Drop Fájlfeltöltő Doboz */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all text-center",
              isDragging ? "border-primary bg-primary/5 scale-[0.99]" : "border-border hover:border-primary/50 hover:bg-muted/30",
              selectedFile ? "bg-muted/20 border-emerald-500/50" : ""
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />

            {isParsing ? (
              <div className="flex flex-col items-center gap-2 py-3">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <span className="text-xs font-medium text-foreground">Mintafájl felépítésének és oszlopainak beolvasása...</span>
              </div>
            ) : selectedFile ? (
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-600">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div className="font-semibold text-xs text-foreground flex items-center gap-2">
                  <span>{selectedFile.name}</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {(selectedFile.size / 1024).toFixed(1)} KB — Kattintson a másik fájl kiválasztásához
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-2">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">Húzza ide a mintafájlt, vagy kattintson a tallózáshoz</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Támogatott formátumok: Microsoft Excel (.xlsx, .xls) vagy CSV (.csv)</p>
                </div>
              </div>
            )}
          </div>

          {/* Hibaüzenet ha van */}
          {errorMessage && (
            <Alert variant="destructive" className="py-2 text-xs">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Feldolgozási hiba</AlertTitle>
              <AlertDescription className="text-[11px]">{errorMessage}</AlertDescription>
            </Alert>
          )}

          {/* 3. Sikeres Feldolgozás Eredményei */}
          {parsedResult && (
            <div className="space-y-3 bg-muted/30 p-3.5 rounded-xl border border-border/70">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  <span>Felismerve: {parsedResult.columns.length} oszlop</span>
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {parsedResult.detectedRowCount} beolvasott adatsor
                </span>
              </div>

              {/* Oszlopok listája */}
              <div className="flex flex-wrap gap-1.5">
                {parsedResult.columns.map((col, idx) => (
                  <Badge key={col.id || idx} variant="outline" className="text-xs bg-background py-1 px-2 gap-1 border-border">
                    <span className="font-semibold">{col.label}</span>
                    <span className="text-[9px] text-muted-foreground font-mono">({col.field})</span>
                  </Badge>
                ))}
              </div>

              {/* Figyelmeztetések */}
              {parsedResult.warnings.length > 0 && (
                <div className="space-y-1 pt-1">
                  {parsedResult.warnings.map((warn, i) => (
                    <p key={i} className="text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{warn}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 4. Minőségbiztosítási Figyelmeztetés és Hibajegy Útmutató */}
          <Alert className="bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-200 py-3">
            <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1.5 text-xs">
              <AlertTitle className="font-semibold text-xs flex items-center gap-1.5 text-amber-900 dark:text-amber-200">
                <span>Minőségbiztosítási tájékoztató és ellenőrzés</span>
                <CustomTooltip
                  content="Az automatizált mintafelismerés az oszlopok neveit és típusait elemzi. Bonyolult, többfejléces tábláknál javasolt az első export ellenőrzése."
                  side="top"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-amber-600 cursor-pointer" />
                </CustomTooltip>
              </AlertTitle>
              <AlertDescription className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed space-y-1">
                <p>• Mivel a sablon automatizált mintafeldolgozással készül, előfordulhatnak benne kisebb pontatlanságok vagy igazítási igények.</p>
                <p>• Kérjük a könyvelőt, hogy az első használat előtt alaposan ellenőrizze a kapott elrendezést.</p>
                <p>• <strong>Hibajegy nyitása korrekció esetén:</strong> Nyisson hibajegyet a pontos elvárások leírásával, és feltétlenül csatolja a képernyőfotót szöveges magyarázattal, valamint az eredetileg használt minta fájlt!</p>
              </AlertDescription>
            </div>
          </Alert>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between pt-2 border-t border-border/60">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Mégse
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!parsedResult || !templateName.trim() || isSaving || isParsing}
            className="gap-2 min-w-[140px]"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>{isSaving ? 'Mentés folyamatban...' : 'Sablon mentése és alkalmazása'}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
