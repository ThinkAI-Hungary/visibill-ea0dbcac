import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  UploadCloud, FileSpreadsheet, AlertTriangle, CheckCircle2, 
  Loader2, Info, Sparkles, HelpCircle, ChevronLeft, ChevronRight, X 
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
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CustomTooltip } from '@/components/ui/custom-tooltip';
import { parseVatTemplateFile, type ParsedVatTemplateResult } from '@/lib/vatTemplateParser';
import type { VatTemplateColumn, VatSampleRow } from '@/types/vatTemplate';
import { cn } from '@/lib/utils';

interface VatTemplateUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canShareWithFirm?: boolean;
  onSuccess: (newTemplate: {
    name: string;
    description?: string;
    columns: VatTemplateColumn[];
    source_file_name?: string;
    sampleRows?: VatSampleRow[];
    shareWithFirm?: boolean;
  }) => Promise<void>;
}

export function VatTemplateUploadDialog({
  open,
  onOpenChange,
  canShareWithFirm,
  onSuccess,
}: VatTemplateUploadDialogProps) {
  const { t } = useTranslation(['accounting', 'common']);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [templateName, setTemplateName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedVatTemplateResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [shareWithFirm, setShareWithFirm] = useState(false);

  const resetForm = () => {
    setTemplateName('');
    setSelectedFile(null);
    setIsParsing(false);
    setIsSaving(false);
    setParsedResult(null);
    setErrorMessage(null);
    setIsDragging(false);
    setShareWithFirm(false);
  };

  const handleMoveColumn = (index: number, direction: 'left' | 'right') => {
    if (!parsedResult) return;
    const newIndex = direction === 'left' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= parsedResult.columns.length) return;
    const newCols = [...parsedResult.columns];
    const [moved] = newCols.splice(index, 1);
    newCols.splice(newIndex, 0, moved);
    setParsedResult({ ...parsedResult, columns: newCols });
  };

  const handleRemoveColumn = (index: number) => {
    if (!parsedResult || parsedResult.columns.length <= 1) return;
    const newCols = parsedResult.columns.filter((_, i) => i !== index);
    setParsedResult({ ...parsedResult, columns: newCols });
  };

  const handleFileProcess = async (file: File) => {
    setSelectedFile(file);
    setErrorMessage(null);
    setIsParsing(true);

    try {
      const result = await parseVatTemplateFile(file);
      setParsedResult(result);
      if (!templateName.trim()) {
        setTemplateName(result.name || 'Saját ÁFA analitika sablon');
      }
    } catch (err: any) {
      console.error('Error parsing VAT template file:', err);
      setErrorMessage(err.message || 'Nem sikerült beolvasni az ÁFA mintafájlt. Kérjük, ellenőrizze a formátumot.');
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
        description: `Egyedi ÁFA sablon: ${selectedFile?.name || 'mintafájl'} alapján (${parsedResult.columns.length} oszlop)`,
        columns: parsedResult.columns,
        source_file_name: selectedFile?.name,
        sampleRows: parsedResult.sampleRows,
        shareWithFirm,
      });
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Nem sikerült elmenteni az új ÁFA sablont.');
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
            <span>Új ÁFA analitika mintasablon feltöltése</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Töltse fel a cégénél vagy könyvelőirodájánál használt ÁFA analitika Excel (.xlsx, .xls) vagy CSV mintafájlját. A rendszer automatikusan felismeri az oszlopokat és létrehozza a cégspecifikus sablont.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* 1. Sablon Elnevezése */}
          <div className="space-y-1.5">
            <Label htmlFor="vatTemplateName" className="text-xs font-semibold">
              Új ÁFA sablon elnevezése *
            </Label>
            <Input
              id="vatTemplateName"
              placeholder="pl. Irodai ÁFA ellenőrző analitika"
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
                <span className="text-xs font-medium text-foreground">ÁFA mintafájl felépítésének és oszlopainak beolvasása...</span>
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
                  <p className="text-xs font-semibold text-foreground">Húzza ide az ÁFA mintafájlt, vagy kattintson a tallózáshoz</p>
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

              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Oszlopok sorrendje és kiválasztása:</span>
                <span className="text-[10px] italic">A nyilakkal módosíthatja a sorrendet</span>
              </div>

              {/* Oszlopok listája interaktív átrendezéssel */}
              <div className="flex flex-wrap gap-1.5">
                {parsedResult.columns.map((col, idx) => (
                  <Badge 
                    key={col.id || idx} 
                    variant="outline" 
                    className="text-xs bg-background py-1 pl-2 pr-1 gap-1.5 border-border flex items-center group shadow-2xs"
                  >
                    <span className="font-semibold">{col.label}</span>
                    <span className="text-[9px] text-muted-foreground font-mono">({col.field})</span>
                    
                    <div className="flex items-center gap-0.5 ml-1 border-l border-border/60 pl-1">
                      <button
                        type="button"
                        title="Mozgatás balra"
                        disabled={idx === 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveColumn(idx, 'left');
                        }}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-0.5"
                      >
                        <ChevronLeft className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        title="Mozgatás jobbra"
                        disabled={idx === parsedResult.columns.length - 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveColumn(idx, 'right');
                        }}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-0.5"
                      >
                        <ChevronRight className="w-3 h-3" />
                      </button>
                      {parsedResult.columns.length > 2 && (
                        <button
                          type="button"
                          title="Oszlop törlése"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveColumn(idx);
                          }}
                          className="text-muted-foreground hover:text-destructive p-0.5 ml-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </Badge>
                ))}
              </div>

              {/* Könyvelőirodai szintű sablonmegosztás (Multi-tenancy) */}
              {canShareWithFirm && (
                <div className="pt-2 border-t border-border/60 flex items-center gap-2">
                  <Checkbox
                    id="vatTemplateShareWithFirm"
                    checked={shareWithFirm}
                    onCheckedChange={(checked) => setShareWithFirm(!!checked)}
                  />
                  <Label
                    htmlFor="vatTemplateShareWithFirm"
                    className="text-xs font-medium cursor-pointer text-foreground select-none"
                  >
                    Sablon elérhetővé tétele a könyvelőiroda összes ügyfelénél
                  </Label>
                </div>
              )}

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

          {/* 4. Minőségbiztosítási Figyelmeztetés és Hibajegy Útmutató (Brief szerint) */}
          <Alert className="bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-200 py-3">
            <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1.5 text-xs">
              <AlertTitle className="font-semibold text-xs flex items-center gap-1.5 text-amber-900 dark:text-amber-200">
                <span>Minőségbiztosítási tájékoztató és ellenőrzés</span>
                <CustomTooltip
                  content="Az automatizált mintafelismerés az ÁFA oszlopok neveit és típusait elemzi. Bonyolult vagy egyedi tábláknál javasolt az első export ellenőrzése."
                  side="top"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-amber-600 cursor-pointer" />
                </CustomTooltip>
              </AlertTitle>
              <AlertDescription className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed space-y-1">
                <p>• Mivel a sablon automatizált mintafeldolgozással készült, előfordulhatnak benne elrendezési vagy oszlopillesztési pontatlanságok.</p>
                <p>• Kérjük a könyvelőt, hogy az első használat előtt alaposan vizsgálja át az elrendezést.</p>
                <p>• <strong>Hibajegy nyitása korrekció esetén:</strong> Amennyiben korrekcióra vagy finomhangolásra van szükség, nyisson hibajegyet a konkrét elvárások megfogalmazásával, és feltétlenül csatolja a képernyőfotót magyarázattal, valamint az eredetileg használt minta fájlt!</p>
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
