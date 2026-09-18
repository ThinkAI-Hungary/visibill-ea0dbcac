import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle, Download, ExternalLink, FileArchive, FileSpreadsheet, FileText } from 'lucide-react';
import type { AuditLogRow } from './ActivityLogSheet';

export interface ActivityLogPdfDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previewTitle: string | null;
  previewIsImage: boolean;
  previewActualExt: string | null;
  isLoadingPdf: boolean;
  setIsLoadingPdf: (val: boolean) => void;
  pdfError: boolean;
  pdfErrorType: 'not_found' | 'invalid_format' | 'unreachable' | null;
  previewIsDownloadOnly: boolean;
  previewDirectUrl: string | null;
  previewUrl: string;
  currentPreviewLog: AuditLogRow | null;
  onRetry: (log: AuditLogRow) => void;
}

export function ActivityLogPdfDialog({
  open,
  onOpenChange,
  previewTitle,
  previewIsImage,
  previewActualExt,
  isLoadingPdf,
  setIsLoadingPdf,
  pdfError,
  pdfErrorType,
  previewIsDownloadOnly,
  previewDirectUrl,
  previewUrl,
  currentPreviewLog,
  onRetry,
}: ActivityLogPdfDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-6">
        <DialogHeader className="mb-2">
          <DialogTitle className="truncate pr-8" title={previewTitle || ''}>{previewTitle}</DialogTitle>
          {previewIsImage && previewActualExt && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-md px-2.5 py-1.5 mt-1 w-fit">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              Ez a fájl nem PDF, hanem <span className="font-semibold">.{previewActualExt}</span> formátumú.
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-auto min-h-[50vh] flex flex-col relative w-full items-center justify-center p-0 rounded-md border bg-muted/20">
          {isLoadingPdf && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                <p className="text-sm font-medium">Dokumentum keresése és betöltése...</p>
              </div>
            </div>
          )}

          {pdfError ? (
            <div className="text-center p-8 text-muted-foreground flex flex-col items-center max-w-sm gap-3">
              <AlertCircle className="h-10 w-10 text-destructive mb-1" />
              {pdfErrorType === 'not_found' ? (
                <>
                  <p className="font-medium text-foreground">A fájl nem található.</p>
                  <p className="text-sm opacity-80">Ez a fájl már nem létezik a rendszerben — valószínűleg törölve lett, vagy soha nem került feltöltésre.</p>
                </>
              ) : pdfErrorType === 'invalid_format' ? (
                <>
                  <p className="font-medium text-foreground">A fájl nem PDF formátumú.</p>
                  <p className="text-sm opacity-80">A fájl neve .pdf-re végződik, de a tartalma nem PDF dokumentum, ezért nem jeleníthető meg.</p>
                </>
              ) : pdfErrorType === 'unreachable' ? (
                <>
                  <p className="font-medium text-foreground">A fájl jelenleg nem elérhető.</p>
                  <p className="text-sm opacity-80">A rendszer megtalálta a fájlt, de nem sikerült letölteni. Ellenőrizd az internetkapcsolatot, vagy próbáld újra később.</p>
                </>
              ) : (
                <>
                  <p className="font-medium text-foreground">A dokumentum nem tölthető be.</p>
                  <p className="text-sm opacity-80">Ismeretlen hiba történt a fájl betöltése közben.</p>
                </>
              )}
              {currentPreviewLog && pdfErrorType !== 'not_found' && pdfErrorType !== 'invalid_format' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRetry(currentPreviewLog)}
                  className="mt-1"
                >
                  Újratöltés
                </Button>
              )}
            </div>
          ) : previewIsDownloadOnly ? (
            <div className="flex flex-col items-center justify-center p-8 text-center max-w-md gap-4">
              <div className="p-4 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                {['xlsx', 'xls', 'csv'].includes(previewActualExt || '') ? (
                  <FileSpreadsheet className="h-12 w-12" />
                ) : ['zip', 'tar', 'gz', 'rar', '7z'].includes(previewActualExt || '') ? (
                  <FileArchive className="h-12 w-12" />
                ) : (
                  <FileText className="h-12 w-12" />
                )}
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-foreground text-base truncate max-w-xs">{previewTitle}</h4>
                <p className="text-xs text-muted-foreground">
                  Ez a fájl ({previewActualExt ? `.${previewActualExt.toUpperCase()}` : 'táblázat'}) közvetlenül a számítógépre tölthető le megtekintésre vagy feldolgozásra.
                </p>
              </div>
              <Button
                onClick={() => {
                  const downloadLink = document.createElement('a');
                  downloadLink.href = previewDirectUrl || previewUrl || '';
                  downloadLink.download = previewTitle || 'letoltes';
                  downloadLink.target = '_blank';
                  downloadLink.rel = 'noopener noreferrer';
                  document.body.appendChild(downloadLink);
                  downloadLink.click();
                  document.body.removeChild(downloadLink);
                }}
                className="mt-2 gap-2 shadow-sm cursor-pointer"
              >
                <Download className="h-4 w-4" />
                Fájl letöltése
              </Button>
            </div>
          ) : previewUrl ? (
            previewIsImage ? (
              <img
                src={previewUrl}
                alt={previewTitle || ''}
                className={`max-w-full max-h-[65vh] object-contain transition-opacity duration-300 ${isLoadingPdf ? 'opacity-0' : 'opacity-100'}`}
                onLoad={() => setIsLoadingPdf(false)}
              />
            ) : (
              <embed
                src={previewUrl}
                type="application/pdf"
                className={`w-full h-[65vh] transition-opacity duration-300 ${isLoadingPdf ? 'opacity-0' : 'opacity-100'}`}
                onLoad={() => setIsLoadingPdf(false)}
              />
            )
          ) : null}
        </div>

        {previewUrl && !pdfError && !isLoadingPdf && (
          <div className="flex justify-center mt-4">
            <Button onClick={() => window.open(previewUrl, '_blank')} variant="outline" size="sm" className="cursor-pointer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Megnyitás új ablakban
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
