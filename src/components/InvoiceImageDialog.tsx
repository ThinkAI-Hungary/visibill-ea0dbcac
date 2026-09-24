import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { FilePreviewModal } from '@/components/ui/FilePreviewModal';
import { Loader2 } from 'lucide-react';
import { fetchInvoiceChain, InvoiceChainItem } from '@/features/invoices/utils/invoiceChainFetch';
import { INVOICE_TYPE_LABELS } from '@/types/invoices';

export interface InvoiceAttachmentItem {
  id?: string;
  url: string;
  name?: string;
  type?: string;
}

interface InvoiceForDialog {
  id: string;
  elado_nev: string;
  vevo_nev: string;
  bizonylatsorszam?: string;
  dokumentum_azonosito?: string;
  invoice_type?: string;
  image_url?: string;
  melleklet_url?: string;
  attachments?: InvoiceAttachmentItem[] | null;
  company_id?: string;
  reference_number?: string;
  elolegszamla_hivatkozas?: string;
}

interface InvoiceImageDialogProps {
  invoice: InvoiceForDialog | null;
  open: boolean;
  onClose: () => void;
  isLoading?: boolean;
}

const InvoiceImageDialog = ({ invoice, open, onClose, isLoading: externalLoading }: InvoiceImageDialogProps) => {
  const { t, i18n } = useTranslation(['invoices', 'common']);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [dbAttachments, setDbAttachments] = useState<InvoiceAttachmentItem[]>([]);
  const [companionInvoices, setCompanionInvoices] = useState<InvoiceChainItem[]>([]);
  const [currentRole, setCurrentRole] = useState<string>('Számla');

  useEffect(() => {
    if (open) {
      setActiveFileIndex(0);
    }
  }, [open, invoice?.id]);

  useEffect(() => {
    if (!open || !invoice) {
      setDbAttachments([]);
      setCompanionInvoices([]);
      return;
    }

    let isCurrent = true;

    fetchInvoiceChain({
      invoiceId: invoice.id,
      bizonylatsorszam: invoice.bizonylatsorszam,
      companyId: invoice.company_id,
      referenceNumber: invoice.reference_number,
      elolegszamlaHivatkozas: invoice.elolegszamla_hivatkozas,
      invoiceType: invoice.invoice_type,
    })
      .then(({ currentDbInvoice, companionInvoices: companions, currentRole: role }) => {
        if (!isCurrent) return;
        if (currentDbInvoice?.attachments && Array.isArray(currentDbInvoice.attachments)) {
          setDbAttachments(currentDbInvoice.attachments as unknown as InvoiceAttachmentItem[]);
        } else if (Array.isArray(invoice.attachments)) {
          setDbAttachments(invoice.attachments);
        }
        setCompanionInvoices(companions);
        setCurrentRole(role);
      })
      .catch(err => {
        console.warn('Failed to fetch invoice chain:', err);
      });

    return () => {
      isCurrent = false;
    };
  }, [open, invoice?.id, invoice?.bizonylatsorszam]);

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

  const getInvoiceIdentifier = (inv: InvoiceForDialog | InvoiceChainItem) => {
    if (inv.bizonylatsorszam) return inv.bizonylatsorszam;
    if ('dokumentum_azonosito' in inv && inv.dokumentum_azonosito) return inv.dokumentum_azonosito;
    if (inv.invoice_type) return t(`invoices:types.${inv.invoice_type}`, INVOICE_TYPE_LABELS[inv.invoice_type] || inv.invoice_type);
    return 'N/A';
  };

  const getDisplayName = (
    inv: InvoiceForDialog | InvoiceChainItem,
    url: string,
    roleTag?: string,
    fallbackName?: string
  ) => {
    const identifier = fallbackName || getInvoiceIdentifier(inv);
    const cleanUrl = url.split('?')[0];
    const urlExt = cleanUrl.split('.').pop()?.toLowerCase() || '';
    const knownExts = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'csv', 'tsv', 'xls', 'xlsx', 'xlsm'];
    const extSuffix = knownExts.includes(urlExt) ? `.${urlExt}` : '.pdf';

    if (roleTag) {
      return `${identifier} (${roleTag})${extSuffix}`;
    }
    return `${identifier}${extSuffix}`;
  };

  // Collect all available files:
  // 1. Primary invoice image & melleklet
  // 2. Companion invoices in chain (storno, advance, final, correction, etc.)
  // 3. Attachments
  const files: { url: string; name: string }[] = [];
  const hasChain = companionInvoices.length > 0;
  const primaryUrl = invoice.image_url || invoice.melleklet_url;

  if (primaryUrl) {
    files.push({
      url: primaryUrl,
      name: getDisplayName(invoice, primaryUrl, hasChain ? currentRole : undefined),
    });
  }

  if (invoice.melleklet_url && invoice.image_url && invoice.melleklet_url !== invoice.image_url) {
    files.push({
      url: invoice.melleklet_url,
      name: getDisplayName(invoice, invoice.melleklet_url, 'Melléklet'),
    });
  }

  // Add companion invoices in chain
  companionInvoices.forEach(comp => {
    const compPrimaryUrl = comp.image_url || comp.melleklet_url;
    if (compPrimaryUrl && !files.some(f => f.url === compPrimaryUrl)) {
      files.push({
        url: compPrimaryUrl,
        name: getDisplayName(comp, compPrimaryUrl, comp.relationRole || 'Számla'),
      });
    }

    if (comp.melleklet_url && comp.image_url && comp.melleklet_url !== comp.image_url && !files.some(f => f.url === comp.melleklet_url)) {
      files.push({
        url: comp.melleklet_url,
        name: getDisplayName(comp, comp.melleklet_url, 'Melléklet'),
      });
    }

    if (Array.isArray(comp.attachments)) {
      comp.attachments.forEach(att => {
        if (att && att.url && !files.some(f => f.url === att.url)) {
          files.push({
            url: att.url,
            name: att.name || `${comp.bizonylatsorszam} Melléklet`,
          });
        }
      });
    }
  });

  // Add primary invoice attachments
  const allAttachments = (Array.isArray(invoice.attachments) && invoice.attachments.length > 0)
    ? invoice.attachments
    : dbAttachments;

  if (Array.isArray(allAttachments)) {
    allAttachments.forEach((att, idx) => {
      if (att && att.url && !files.some(f => f.url === att.url)) {
        files.push({
          url: att.url,
          name: att.name || `Melléklet ${idx + 1}`,
        });
      }
    });
  }

  // Fallback: If no physical image or attachment exists, show electronic voucher card
  if (files.length === 0) {
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

  const safeActiveIndex = activeFileIndex < files.length ? activeFileIndex : 0;
  const currentFile = files[safeActiveIndex] || files[0];

  return (
    <FilePreviewModal
      previewFile={currentFile}
      files={files}
      activeFileIndex={safeActiveIndex}
      onSelectFile={setActiveFileIndex}
      onClose={onClose}
    />
  );
};

export default InvoiceImageDialog;

