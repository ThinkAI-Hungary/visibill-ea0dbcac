import { Loader2, X, Check, AlertCircle } from 'lucide-react';
import type { PdfExportJob } from '@/hooks/usePdfExport';

interface PdfExportBannerProps {
  job: PdfExportJob;
  progress: number;
  onCancel: () => void;
  onDismiss: () => void;
  onRetryDownload: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function PdfExportBanner({ job, progress, onCancel, onDismiss, onRetryDownload }: PdfExportBannerProps) {
  const isProcessing = job.status === 'queued' || job.status === 'processing';
  const isCompleted = job.status === 'completed';
  const isError = job.status === 'error';

  if (isProcessing) {
    return (
      <div className="w-full rounded-lg border bg-card text-card-foreground dark:bg-zinc-900 dark:border-zinc-700/60 shadow-md overflow-hidden">
        <div className="px-3 py-2.5">
          {/* Header row */}
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
              <span className="text-xs font-semibold">PDF export készül...</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground tabular-nums font-medium">
                {job.processed_invoices} / {job.total_invoices}
              </span>
              <button
                onClick={onCancel}
                className="text-muted-foreground hover:text-destructive transition-colors p-0.5 rounded hover:bg-destructive/10"
                aria-label="Mégse"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 rounded-full bg-muted dark:bg-zinc-700/60 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Footer row */}
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">
              {job.current_invoice_name || 'Feldolgozás...'}
            </span>
            <span className="text-[11px] text-primary font-bold tabular-nums">
              {progress}%
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (isCompleted) {
    const totalSize = job.result_sizes?.reduce((sum, s) => sum + s, 0) || 0;
    const fileCount = job.result_urls?.length || 0;

    return (
      <div className="w-full rounded-lg border bg-card text-card-foreground dark:bg-zinc-900 dark:border-zinc-700/60 shadow-md overflow-hidden">
        <div className="px-3 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Check className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
              <div className="min-w-0">
                <span className="text-xs font-semibold">PDF export kész!</span>
                <div className="text-[11px] text-muted-foreground truncate">
                  {job.total_invoices} számla →{' '}
                  {fileCount === 1 ? (
                    <span className="font-medium">{job.result_urls?.[0]?.split('/').pop()}</span>
                  ) : (
                    <span className="font-medium">{fileCount} PDF fájl</span>
                  )}
                  {' '}({formatBytes(totalSize)})
                </div>
              </div>
            </div>
            <button
              onClick={onDismiss}
              className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded flex-shrink-0"
              aria-label="Bezárás"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-1.5 text-center">
            <button
              onClick={onRetryDownload}
              className="text-[11px] text-primary hover:underline"
            >
              Ha a letöltés nem indult el, kattints ide
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="w-full rounded-lg border border-destructive/30 bg-card text-card-foreground dark:bg-zinc-900 dark:border-destructive/40 shadow-md overflow-hidden">
        <div className="px-3 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
              <div className="min-w-0">
                <span className="text-xs font-semibold">PDF export hiba</span>
                <div className="text-[11px] text-muted-foreground truncate max-w-[260px]">
                  {job.error_message || 'Ismeretlen hiba.'}
                </div>
              </div>
            </div>
            <button
              onClick={onDismiss}
              className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded flex-shrink-0"
              aria-label="Bezárás"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
