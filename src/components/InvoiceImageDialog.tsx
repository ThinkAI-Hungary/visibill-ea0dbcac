import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { FilePreviewModal } from '@/components/ui/FilePreviewModal';
import { Loader2 } from 'lucide-react';
import { fetchInvoiceChain, InvoiceChainItem } from '@/features/invoices/utils/invoiceChainFetch';
import { INVOICE_TYPE_LABELS } from '@/types/invoices';
import { supabase } from '@/integrations/supabase/client';
import { cn, formatCurrency } from '@/lib/utils';

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
  image_url?: string | null;
  melleklet_url?: string | null;
  attachments?: InvoiceAttachmentItem[] | any[] | null;
  company_id?: string;
  reference_number?: string;
  elolegszamla_hivatkozas?: string;
  invoice_uploads_id?: string;
  adoalap_osszesen?: number;
  brutto_vegosszeg?: number;
  teljesites_datuma?: string;
  kibocsatas_datuma?: string;
  penznem?: string;
  nav_status?: string;
  statusz?: string;
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
  const [dbInvoice, setDbInvoice] = useState<any>(null);
  const [uploadFile, setUploadFile] = useState<{ url: string; name: string } | null>(null);

  useEffect(() => {
    if (open) {
      setActiveFileIndex(0);
    }
  }, [open, invoice?.id]);

  useEffect(() => {
    if (!open || !invoice) {
      setDbAttachments([]);
      setCompanionInvoices([]);
      setDbInvoice(null);
      setUploadFile(null);
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
      .then(async ({ currentDbInvoice, companionInvoices: companions, currentRole: role }) => {
        if (!isCurrent) return;
        setDbInvoice(currentDbInvoice);

        if (currentDbInvoice?.attachments && Array.isArray(currentDbInvoice.attachments)) {
          setDbAttachments(currentDbInvoice.attachments as unknown as InvoiceAttachmentItem[]);
        } else if (Array.isArray(invoice.attachments)) {
          setDbAttachments(invoice.attachments as unknown as InvoiceAttachmentItem[]);
        }
        setCompanionInvoices(companions);
        setCurrentRole(role);

        // Fallback: If no direct image/melleklet URL is found on invoice or currentDbInvoice,
        // check whether an invoice_uploads record exists with file_url
        const hasDirectFile = Boolean(
          invoice.image_url ||
          invoice.melleklet_url ||
          currentDbInvoice?.image_url ||
          currentDbInvoice?.melleklet_url
        );

        const uploadId = invoice.invoice_uploads_id || currentDbInvoice?.invoice_uploads_id;
        if (!hasDirectFile && uploadId) {
          try {
            const { data: uploadRow } = await supabase
              .from('invoice_uploads')
              .select('file_url, file_name')
              .eq('id', uploadId)
              .maybeSingle();

            if (isCurrent && uploadRow?.file_url) {
              setUploadFile({
                url: uploadRow.file_url,
                name: uploadRow.file_name || 'Bizonylat.pdf',
              });
            }
          } catch (e) {
            console.warn('Failed to fetch invoice_uploads fallback:', e);
          }
        }
      })
      .catch(err => {
        console.warn('Failed to fetch invoice chain:', err);
      });

    return () => {
      isCurrent = false;
    };
  }, [open, invoice?.id, invoice?.bizonylatsorszam, invoice?.image_url, invoice?.melleklet_url]);

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

  const mergedInvoice = {
    ...dbInvoice,
    ...invoice,
  };

  // Collect all available files:
  // 1. Primary invoice image & melleklet (from prop or DB)
  // 2. Companion invoices in chain (storno, advance, final, correction, etc.)
  // 3. Attachments
  const files: { url: string; name: string }[] = [];
  const hasChain = companionInvoices.length > 0;
  
  const primaryUrl =
    invoice.melleklet_url ||
    invoice.image_url ||
    dbInvoice?.melleklet_url ||
    dbInvoice?.image_url ||
    uploadFile?.url;

  if (primaryUrl) {
    files.push({
      url: primaryUrl,
      name: uploadFile?.url === primaryUrl && uploadFile.name
        ? uploadFile.name
        : getDisplayName(mergedInvoice, primaryUrl, hasChain ? currentRole : undefined),
    });
  }

  // Secondary file if melleklet and image both exist and differ
  const secondaryUrl =
    (invoice.image_url && invoice.melleklet_url && invoice.image_url !== invoice.melleklet_url ? invoice.image_url : null) ||
    (dbInvoice?.image_url && dbInvoice?.melleklet_url && dbInvoice?.image_url !== dbInvoice?.melleklet_url ? dbInvoice.image_url : null);

  if (secondaryUrl && !files.some(f => f.url === secondaryUrl)) {
    files.push({
      url: secondaryUrl,
      name: getDisplayName(mergedInvoice, secondaryUrl, 'Számlakép'),
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
    : (Array.isArray(dbAttachments) && dbAttachments.length > 0 ? dbAttachments : dbInvoice?.attachments);

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
    const currency = mergedInvoice.penznem || (invoice as any).currency || 'HUF';

    const netAmountVal = mergedInvoice.adoalap_osszesen ?? (invoice as any).amount;
    const grossAmountVal = mergedInvoice.brutto_vegosszeg ?? (invoice as any).brutto_vegosszeg;

    const formattedNet = netAmountVal != null && !isNaN(Number(netAmountVal))
      ? formatCurrency(Math.abs(Number(netAmountVal)), currency)
      : null;

    const formattedGross = grossAmountVal != null && !isNaN(Number(grossAmountVal))
      ? formatCurrency(Math.abs(Number(grossAmountVal)), currency)
      : null;

    const issueDate = mergedInvoice.kibocsatas_datuma || (invoice as any).date;
    const fulfillmentDate = mergedInvoice.teljesites_datuma;

    let dateDisplay = '—';
    if (fulfillmentDate && issueDate && fulfillmentDate !== issueDate) {
      dateDisplay = `${fulfillmentDate} (Kelt: ${issueDate})`;
    } else if (fulfillmentDate || issueDate) {
      dateDisplay = (fulfillmentDate || issueDate)!;
    }

    // Determine whether this was an uploaded / manual invoice or a pure NAV electronic invoice
    const isBekuldott = Boolean(
      mergedInvoice.invoice_uploads_id ||
      mergedInvoice.melleklet_url ||
      mergedInvoice.image_url ||
      mergedInvoice.statusz === 'feldolgozas_alatt' ||
      (mergedInvoice.statusz === 'feldolgozva' && !mergedInvoice.nav_status)
    );

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
              <h3 className="text-lg font-bold text-primary">
                {isBekuldott
                  ? t('invoices:dialogs.image.submitted_voucher', 'Beküldött Bizonylat')
                  : t('invoices:dialogs.image.electronic_voucher', 'Elektronikus Bizonylat')}
              </h3>
              <p className="text-xs text-muted-foreground">
                {isBekuldott
                  ? t('invoices:dialogs.image.submitted_source_desc', 'Feldolgozott számla adatai')
                  : t('invoices:dialogs.image.nav_source_desc', 'NAV Online Számlarendszerből importált adatok')}
              </p>
            </div>
            <span className={cn(
              "text-[10px] font-semibold px-2 py-1 rounded-full border",
              isBekuldott
                ? "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400"
                : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400"
            )}>
              {isBekuldott
                ? t('invoices:dialogs.image.submitted_data', 'Beküldött bizonylat')
                : t('invoices:dialogs.image.verified_data', 'NAV hitelesített adat')}
            </span>
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{t('invoices:dialogs.image.seller', 'Eladó (Szállító)')}</p>
              <p className="font-semibold">{mergedInvoice.elado_nev || '—'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{t('invoices:dialogs.image.buyer', 'Vevő (Megrendelő)')}</p>
              <p className="font-semibold">{mergedInvoice.vevo_nev || '—'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm border-t pt-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{t('invoices:dialogs.image.invoice_number', 'Bizonylatszám')}</p>
              <p className="font-mono font-semibold">{mergedInvoice.bizonylatsorszam || mergedInvoice.dokumentum_azonosito || 'N/A'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{t('invoices:dialogs.image.fulfillment_issue', 'Teljesítés / Kelt')}</p>
              <p className="font-semibold">{dateDisplay}</p>
            </div>
          </div>

          {/* Amount Box */}
          <div className="bg-muted/40 border rounded-xl p-4 flex justify-between items-center text-sm">
            <div>
              <span className="font-semibold text-muted-foreground block text-xs">
                {formattedGross ? t('invoices:dialogs.image.gross_total', 'Bruttó végösszeg') : t('invoices:dialogs.image.net_total', 'Nettó végösszeg')}
              </span>
              {formattedNet && formattedGross && formattedNet !== formattedGross && (
                <span className="text-[11px] text-muted-foreground/80 block mt-0.5">
                  Nettó: {formattedNet}
                </span>
              )}
            </div>
            <span className="text-lg font-bold tabular-nums text-primary">
              {formattedGross || formattedNet || '—'}
            </span>
          </div>

          {/* Info footer */}
          <div className="text-[10px] text-muted-foreground bg-muted/20 p-3 rounded-lg border border-border/40 text-center leading-relaxed">
            {isBekuldott
              ? t('invoices:dialogs.image.no_physical_image_submitted_desc', 'A bizonylat adatai strukturáltan rögzítésre kerültek a rendszerben. Fizikai képfájl jelenleg nem elérhető.')
              : t('invoices:dialogs.image.no_physical_image_desc', 'Ez a számla nem rendelkezik fizikai képfájllal, mivel közvetlenül a NAV Online Számlarendszerből, XML adatformátumban került strukturált feldolgozásra.')}
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
