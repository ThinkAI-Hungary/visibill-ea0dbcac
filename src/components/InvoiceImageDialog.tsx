import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { FilePreviewModal } from '@/components/ui/FilePreviewModal';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  const { t, i18n } = useTranslation(['invoices', 'common']);

  if (!open) return null;

  // While parent is fetching invoice data — show a minimal loading overlay
  if (externalLoading || !invoice) {
    return createPortal(
      <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-150 pointer-events-auto">
        <div className="flex flex-col items-center gap-4 text-white">
          <Loader2 className="h-10 w-10 animate-spin" />
          <p className="text-sm text-white/80">{t('invoices:dialogs.image.loading')}</p>
        </div>
      </div>,
      document.body
    );
  }

  const displayUrl = invoice.image_url || invoice.melleklet_url;

  if (!displayUrl) {
    const localeCode = i18n.language === 'hr' ? 'hr-HR' : 'hu-HU';
    const formattedAmount = (invoice as any).amount ? new Intl.NumberFormat(localeCode).format(Math.abs((invoice as any).amount)) : '—';
    const currency = (invoice as any).currency || 'HUF';
    const invoiceDate = (invoice as any).date || '—';

    return createPortal(
      <div
        className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150 pointer-events-auto"
        onClick={onClose}
      >
        <div 
          className="bg-background text-foreground rounded-2xl border border-border shadow-2xl p-6 md:p-8 max-w-lg w-full space-y-6 relative" 
          onClick={e => e.stopPropagation()}
        >
          {/* Close button */}
          <button 
            onClick={onClose} 
            aria-label={t('common:actions.close')}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-muted transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>

          {/* Header */}
          <div className="flex justify-between items-start border-b pb-4">
            <div>
              <h3 className="text-lg font-bold text-primary">{t('invoices:dialogs.image.electronic_voucher')}</h3>
              <p className="text-xs text-muted-foreground">{t('invoices:dialogs.image.nav_source_desc')}</p>
            </div>
            <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 px-2 py-1 rounded-full border border-emerald-500/20">
              {t('invoices:dialogs.image.verified_data')}
            </span>
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{t('invoices:dialogs.image.seller')}</p>
              <p className="font-semibold">{invoice.elado_nev}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{t('invoices:dialogs.image.buyer')}</p>
              <p className="font-semibold">{invoice.vevo_nev}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm border-t pt-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{t('invoices:dialogs.image.invoice_number')}</p>
              <p className="font-mono">{invoice.bizonylatsorszam || invoice.dokumentum_azonosito || 'N/A'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{t('invoices:dialogs.image.fulfillment_issue')}</p>
              <p className="font-semibold">{invoiceDate}</p>
            </div>
          </div>

          {/* Amount Box */}
          <div className="bg-muted/40 border rounded-xl p-4 flex justify-between items-center text-sm">
            <span className="font-semibold text-muted-foreground">{t('invoices:dialogs.image.net_total')}</span>
            <span className="text-lg font-bold tabular-nums text-primary">{formattedAmount} {currency}</span>
          </div>

          {/* Info footer */}
          <div className="text-[10px] text-muted-foreground bg-muted/20 p-3 rounded-lg border border-border/40 text-center leading-relaxed">
            {t('invoices:dialogs.image.no_physical_image_desc')}
          </div>


        </div>
      </div>,
      document.body
    );
  }

  const getInvoiceIdentifier = (inv: InvoiceForDialog) => {
    if (inv.bizonylatsorszam) return inv.bizonylatsorszam;
    if (inv.dokumentum_azonosito) return inv.dokumentum_azonosito;
    if (inv.invoice_type) return t(`invoices:types.${inv.invoice_type}`, INVOICE_TYPE_LABELS[inv.invoice_type] || inv.invoice_type);
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

