import { createPortal } from 'react-dom';
import { FilePreviewModal } from '@/components/ui/FilePreviewModal';
import { Loader2 } from 'lucide-react';

interface InvoiceForDialog {
  id: string;
  elado_nev: string;
  vevo_nev: string;
  bizonylatsorszam?: string;
  dokumentum_azonosito?: string;
  invoice_type?: string;
  image_url?: string;
  melleklet_url?: string;
}

interface InvoiceImageDialogProps {
  invoice: InvoiceForDialog | null;
  open: boolean;
  onClose: () => void;
  isLoading?: boolean;
}

const INVOICE_TYPE_LABELS: Record<string, string> = {
  invoice: 'Számla',
  credit_note: 'Jóváíró számla',
  proforma: 'Díjbekérő',
  advance: 'Előlegszámla',
};

const InvoiceImageDialog = ({ invoice, open, onClose, isLoading: externalLoading }: InvoiceImageDialogProps) => {
  if (!open) return null;

  // While parent is fetching invoice data — show a minimal loading overlay
  if (externalLoading || !invoice) {
    return createPortal(
      <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
        <div className="flex flex-col items-center gap-4 text-white">
          <Loader2 className="h-10 w-10 animate-spin" />
          <p className="text-sm text-white/80">Számla adatok betöltése...</p>
        </div>
      </div>,
      document.body
    );
  }

  const displayUrl = invoice.image_url || invoice.melleklet_url;

  if (!displayUrl) {
    return createPortal(
      <div
        className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={onClose}
      >
        <div className="bg-card rounded-xl border border-border p-8 text-center space-y-2" onClick={e => e.stopPropagation()}>
          <p className="text-muted-foreground text-sm">Nincs elérhető kép ehhez a számlához</p>
          <button className="text-xs text-primary underline" onClick={onClose}>Bezárás</button>
        </div>
      </div>,
      document.body
    );
  }

  const getInvoiceIdentifier = (inv: InvoiceForDialog) => {
    if (inv.bizonylatsorszam) return inv.bizonylatsorszam;
    if (inv.dokumentum_azonosito) return inv.dokumentum_azonosito;
    if (inv.invoice_type) return INVOICE_TYPE_LABELS[inv.invoice_type] || inv.invoice_type;
    return 'N/A';
  };

  // Extract extension from URL (ignore query params/tokens) so FilePreviewModal
  // can correctly detect PDF vs image vs fallback
  const getDisplayName = (inv: InvoiceForDialog, url: string) => {
    const identifier = getInvoiceIdentifier(inv);
    const cleanUrl = url.split('?')[0];
    const urlExt = cleanUrl.split('.').pop()?.toLowerCase() || '';
    const knownExts = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'csv', 'tsv', 'xls', 'xlsx', 'xlsm'];
    return knownExts.includes(urlExt) ? `${identifier}.${urlExt}` : identifier;
  };

  return (
    <FilePreviewModal
      previewFile={{ url: displayUrl, name: getDisplayName(invoice, displayUrl) }}
      onClose={onClose}
    />
  );
};

export default InvoiceImageDialog;

