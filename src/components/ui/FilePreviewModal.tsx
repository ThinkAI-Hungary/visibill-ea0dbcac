import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Download, ExternalLink, X, AlertCircle, Loader } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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
  const ext = (previewFile.name.split('.').pop() || '').toLowerCase();
  const isPdf = ext === 'pdf';
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext);
  const isCsv = ['csv', 'tsv'].includes(ext);
  const isExcel = ['xls', 'xlsx', 'xlsm'].includes(ext);

  if (isPdf) {
    return (
      <iframe
        src={`${previewFile.url}#toolbar=1`}
        className="w-full h-full border-0"
        title={`PDF előnézet: ${previewFile.name}`}
      />
    );
  }

  if (isImage) {
    return (
      <div className="w-full h-full flex items-center justify-center p-6 overflow-auto bg-black/20">
        <img
          src={previewFile.url}
          alt={previewFile.name}
          className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
        />
      </div>
    );
  }

  if (isExcel) {
    const encodedUrl = encodeURIComponent(previewFile.url);
    const officeUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodedUrl}`;
    return (
      <iframe
        src={officeUrl}
        className="w-full h-full border-0 bg-background"
        title={`Excel előnézet: ${previewFile.name}`}
      />
    );
  }

  if (isCsv) {
    return <CsvPreviewComponent url={previewFile.url} />;
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-muted-foreground">
      <FileText className="h-16 w-16 opacity-30" />
      <p className="text-sm">A fájl típusa ({ext || 'ismeretlen'}) nem jeleníthető meg előnézetben.</p>
      <div className="flex gap-2">
        <a
          href={previewFile.url}
          download={previewFile.name}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Download className="h-4 w-4" /> Letöltés
        </a>
      </div>
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

export function FilePreviewModal({
  previewFile,
  onClose,
}: {
  previewFile: PreviewFile | null;
  onClose: () => void;
}) {
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
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30 shrink-0">
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
              title="Letöltés"
              onClick={e => e.stopPropagation()}
            >
              <Download className="h-4 w-4" />
            </a>
            <a
              href={previewFile.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              title="Megnyitás új lapon"
              onClick={e => e.stopPropagation()}
            >
              <ExternalLink className="h-4 w-4" />
            </a>
            <button
              className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              onClick={onClose}
              title="Bezárás"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden relative">
          <FilePreviewContent previewFile={previewFile} />
        </div>
      </div>
    </div>,
    document.body
  );
}
