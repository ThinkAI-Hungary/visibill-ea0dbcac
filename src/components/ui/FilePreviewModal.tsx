import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Download, ExternalLink, X, FileText, Loader, Loader2, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PreviewFile {
  url: string;
  name: string;
}

// ── useFilePreview hook ────────────────────────────────────────────────────────
// Usage:
//   const { previewFile, openPreview, closePreview } = useFilePreview();
//   <button onClick={() => openPreview({ url: f.url, name: f.name })}>Előnézet</button>
//   <FilePreviewModal previewFile={previewFile} onClose={closePreview} />

export function useFilePreview() {
  const [previewFile, setPreviewFile] = useState<PreviewFile | null>(null);

  const openPreview = (file: PreviewFile) => setPreviewFile(file);
  const closePreview = () => setPreviewFile(null);

  return { previewFile, openPreview, closePreview };
}

// ── CsvPreviewComponent ────────────────────────────────────────────────────────

function CsvPreviewComponent({ url }: { url: string }) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    fetch(url)
      .then(res => res.text())
      .then(text => {
        setContent(text);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [url]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-xs">Nem sikerült betölteni a CSV tartalmát.</p>
      </div>
    );
  }

  const lines = content.split('\n').filter(line => line.trim().length > 0).slice(0, 100);
  const rows = lines.map(line => {
    const delimiter = line.includes(';') ? ';' : ',';
    return line.split(delimiter);
  });

  return (
    <div className="w-full h-full overflow-auto p-4 bg-background">
      <div className="border border-border/40 rounded-lg overflow-x-auto">
        <table className="w-full text-[11px] font-mono border-collapse">
          <tbody>
            {rows.map((row, rIdx) => (
              <tr key={rIdx} className={`border-b border-border/20 ${rIdx === 0 ? 'bg-muted/50 font-bold text-foreground' : 'hover:bg-muted/20 text-muted-foreground'}`}>
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="px-3 py-1.5 border-r border-border/25 whitespace-nowrap">
                    {cell.replace(/^"|"$/g, '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {lines.length === 100 && (
        <p className="text-[10px] text-muted-foreground mt-2 text-center">Csak az első 100 sor jelenik meg előnézetben.</p>
      )}
    </div>
  );
}

// ── FilePreviewContent ─────────────────────────────────────────────────────────
// Renders the content area based on file extension.
// Supported: PDF (native iframe), image, Excel (Office Online), CSV (table), fallback (download link).

export function FilePreviewContent({ previewFile }: { previewFile: PreviewFile }) {
  const { t } = useTranslation(['common']);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const ext = (previewFile.name.split('.').pop() || '').toLowerCase();
  const isPdf = ext === 'pdf';
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext);
  const isCsv = ['csv', 'tsv'].includes(ext);
  const isExcel = ['xls', 'xlsx', 'xlsm'].includes(ext);

  useEffect(() => {
    // Unsupported files or CSV handle their own display/fetch
    if (!isPdf && !isImage && !isExcel) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    let isCancelled = false;
    const startTime = Date.now();
    const minDisplayMs = 400; // Guarantee the user clearly sees the spinner during switch

    fetch(previewFile.url)
      .then(() => {
        if (isCancelled) return;
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, minDisplayMs - elapsed);
        setTimeout(() => {
          if (!isCancelled) {
            setIsLoading(false);
          }
        }, remaining);
      })
      .catch(() => {
        if (!isCancelled) {
          const elapsed = Date.now() - startTime;
          const remaining = Math.max(0, minDisplayMs - elapsed);
          setTimeout(() => {
            if (!isCancelled) {
              setIsLoading(false);
            }
          }, remaining);
        }
      });

    // Safety timeout: Ensure spinner dismisses even if fetch hangs
    const safetyTimer = setTimeout(() => {
      if (!isCancelled) {
        setIsLoading(false);
      }
    }, 3500);

    return () => {
      isCancelled = true;
      clearTimeout(safetyTimer);
    };
  }, [previewFile.url, isPdf, isImage, isExcel]);

  return (
    <div className="w-full h-full relative overflow-hidden bg-background">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-card/90 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="flex flex-col items-center gap-3 p-6 rounded-xl bg-background/95 border border-border/60 shadow-2xl max-w-xs text-center">
            <Loader2 className="h-9 w-9 animate-spin text-primary" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                {t('common:file_preview.loading', 'Dokumentum betöltése...')}
              </p>
              <p className="text-xs text-muted-foreground truncate max-w-[220px]">
                {previewFile.name}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* PDF View */}
      {!isLoading && isPdf && (
        <iframe
          key={previewFile.url}
          src={`${previewFile.url}#toolbar=1`}
          className="w-full h-full border-0 animate-in fade-in duration-200"
          title={t('common:file_preview.pdf_title', { name: previewFile.name, defaultValue: `PDF előnézet: ${previewFile.name}` })}
        />
      )}

      {/* Image View */}
      {!isLoading && isImage && (
        <div className="w-full h-full flex items-center justify-center p-6 overflow-auto bg-black/20 animate-in fade-in duration-200">
          <img
            key={previewFile.url}
            src={previewFile.url}
            alt={previewFile.name}
            className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
          />
        </div>
      )}

      {/* Excel View */}
      {!isLoading && isExcel && (
        <iframe
          key={previewFile.url}
          src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewFile.url)}`}
          className="w-full h-full border-0 bg-background animate-in fade-in duration-200"
          title={t('common:file_preview.excel_title', { name: previewFile.name, defaultValue: `Excel előnézet: ${previewFile.name}` })}
        />
      )}

      {/* CSV View */}
      {isCsv && (
        <CsvPreviewComponent url={previewFile.url} />
      )}

      {/* Unsupported Fallback */}
      {!isPdf && !isImage && !isExcel && !isCsv && (
        <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-muted-foreground">
          <FileText className="h-16 w-16 opacity-30" />
          <p className="text-sm">
            {t('common:file_preview.unsupported', { ext: ext || 'ismeretlen', defaultValue: `A fájl típusa (${ext || 'ismeretlen'}) nem jeleníthető meg előnézetben.` })}
          </p>
          <div className="flex gap-2">
            <a
              href={previewFile.url}
              download={previewFile.name}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Download className="h-4 w-4" /> {t('common:file_preview.download', 'Letöltés')}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// ── FilePreviewModal ───────────────────────────────────────────────────────────
// Full-screen portal overlay with header: filename, type badge, download, open-in-tab, close.
// Renders via createPortal into document.body — no z-index conflicts with any parent.
//
// Usage:
//   const { previewFile, openPreview, closePreview } = useFilePreview();
//   ...
//   <button onClick={() => openPreview({ url: file.url, name: file.name })}>Előnézet</button>
//   <FilePreviewModal previewFile={previewFile} onClose={closePreview} />
//
// Note: URL must be a publicly accessible or signed Supabase URL.
// Do NOT pass blob:// URLs — they expire with the session and cannot be opened in new tabs.

export interface FilePreviewModalProps {
  previewFile: PreviewFile | null;
  files?: PreviewFile[];
  activeFileIndex?: number;
  onSelectFile?: (index: number) => void;
  onClose: () => void;
}

export function FilePreviewModal({
  previewFile,
  files,
  activeFileIndex,
  onSelectFile,
  onClose,
}: FilePreviewModalProps) {
  const { t } = useTranslation(['common']);
  if (!previewFile) return null;

  const ext = (previewFile.name.split('.').pop() || '').toLowerCase();

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-150 pointer-events-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl mx-4 h-[85vh] flex flex-col bg-card rounded-xl border border-border shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header - fixed height to prevent vertical jitter */}
        <div className="h-13 min-h-[52px] max-h-[52px] flex items-center justify-between px-4 border-b border-border bg-muted/30 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-medium truncate">{previewFile.name}</span>
            <Badge variant="outline" className="text-[10px] shrink-0">{ext.toUpperCase() || 'FILE'}</Badge>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <a
              href={previewFile.url}
              download={previewFile.name}
              className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              title={t('common:file_preview.download', 'Letöltés')}
              onClick={e => e.stopPropagation()}
            >
              <Download className="h-4 w-4" />
            </a>
            <a
              href={previewFile.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              title={t('common:file_preview.open_new_tab', 'Megnyitás új lapon')}
              onClick={e => e.stopPropagation()}
            >
              <ExternalLink className="h-4 w-4" />
            </a>
            <button
              className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              onClick={onClose}
              title={t('common:file_preview.close', 'Bezárás')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Multi-file tabs - fixed height, identical borders & font-weight so layout never shifts */}
        {files && files.length > 1 && (
          <div className="h-11 min-h-[44px] max-h-[44px] flex items-center gap-1.5 px-4 border-b border-border bg-muted/20 overflow-x-auto overflow-y-hidden shrink-0 select-none">
            {files.map((file, idx) => {
              const isActive = (activeFileIndex !== undefined ? activeFileIndex : files.indexOf(previewFile)) === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    if (!isActive) {
                      onSelectFile?.(idx);
                    }
                  }}
                  className={cn(
                    "h-7.5 px-3 flex items-center gap-1.5 rounded-md text-xs font-medium border shrink-0 whitespace-nowrap cursor-pointer transition-colors duration-150 select-none",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground shadow-xs"
                      : "border-border/50 bg-muted/60 hover:bg-muted hover:border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  <FileText className="h-3 w-3 shrink-0" />
                  <span className="max-w-[180px] truncate">{file.name}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden relative">
          <FilePreviewContent previewFile={previewFile} />
        </div>
      </div>
    </div>,
    document.body
  );
}
