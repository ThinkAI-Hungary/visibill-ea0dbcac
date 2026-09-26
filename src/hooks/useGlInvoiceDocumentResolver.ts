import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

export interface TargetGlItem {
  id: string;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  sourceTable?: string;
  partner?: string | null;
  originalCurrency?: string;
}

export interface ActiveNavInvoiceDialogData {
  id: string;
  invoiceNumber: string;
  currency: string;
  source: 'nav' | 'submitted';
  invoiceDate?: string;
  supplierName?: string;
  invoiceDirection?: string;
}

export interface UseGlInvoiceDocumentResolverResult {
  resolvingItemId: string | null;
  handleOpenDocument: (item: TargetGlItem) => Promise<void>;
  imageDialogProps: {
    invoice: any | null;
    open: boolean;
    onClose: () => void;
  };
  itemsDialogProps: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    invoiceId: string;
    invoiceNumber: string;
    currency: string;
    source: 'nav' | 'submitted';
    invoiceDate?: string;
    supplierName?: string;
    invoiceDirection?: string;
  };
}

/**
 * useGlInvoiceDocumentResolver
 * ============================================================================
 * Resolves whether to open InvoiceImageDialog (if an uploaded PDF / image scan
 * exists) or InvoiceItemsDialog (if the invoice only exists in NAV Online Számla
 * OSA without uploaded scanned imagery) for a given General Ledger item.
 * ============================================================================
 */
export function useGlInvoiceDocumentResolver(
  companyId?: string | null
): UseGlInvoiceDocumentResolverResult {
  const { t } = useTranslation(['accounting', 'invoices', 'common']);
  const { toast } = useToast();

  const [resolvingItemId, setResolvingItemId] = useState<string | null>(null);

  // Invoice Image Dialog state
  const [activeImageInvoice, setActiveImageInvoice] = useState<any | null>(null);
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);

  // NAV / Submitted Items Dialog state
  const [activeNavInvoice, setActiveNavInvoice] = useState<ActiveNavInvoiceDialogData | null>(null);
  const [isNavItemsDialogOpen, setIsNavItemsDialogOpen] = useState(false);

  const handleCloseImageDialog = useCallback(() => {
    setIsImageDialogOpen(false);
    setActiveImageInvoice(null);
  }, []);

  const handleNavItemsOpenChange = useCallback((open: boolean) => {
    setIsNavItemsDialogOpen(open);
    if (!open) {
      setActiveNavInvoice(null);
    }
  }, []);

  const handleOpenDocument = useCallback(
    async (item: TargetGlItem) => {
      if (!item) return;
      const invId = item.invoiceId?.trim();
      const invNum = item.invoiceNumber?.trim();

      if (!invId && !invNum) {
        toast({
          title: t('accounting:general_ledger.doc_resolver.not_found_title', 'Bizonylat nem található'),
          description: t(
            'accounting:general_ledger.doc_resolver.no_invoice_reference',
            'A kiválasztott tételhez nem tartozik azonosítható számlaszám.'
          ),
          variant: 'default',
        });
        return;
      }

      setResolvingItemId(item.id);

      try {
        // 1. If sourceTable is invoice_items or invoices (uploaded/submitted invoice)
        if (item.sourceTable === 'invoice_items' || item.sourceTable === 'invoices') {
          let subInv: any = null;
          if (invId) {
            const { data } = await supabase
              .from('invoices')
              .select(
                'id, elado_nev, vevo_nev, bizonylatsorszam, dokumentum_azonosito, invoice_type, image_url, melleklet_url, attachments, company_id, reference_number, elolegszamla_hivatkozas'
              )
              .eq('id', invId)
              .maybeSingle();
            subInv = data;
          }
          if (!subInv && invNum && companyId) {
            const { data } = await supabase
              .from('invoices')
              .select(
                'id, elado_nev, vevo_nev, bizonylatsorszam, dokumentum_azonosito, invoice_type, image_url, melleklet_url, attachments, company_id, reference_number, elolegszamla_hivatkozas'
              )
              .eq('company_id', companyId)
              .ilike('bizonylatsorszam', invNum)
              .maybeSingle();
            subInv = data;
          }

          const hasImage =
            subInv &&
            (Boolean(subInv.image_url) ||
              Boolean(subInv.melleklet_url) ||
              (Array.isArray(subInv.attachments) && subInv.attachments.length > 0));

          if (hasImage) {
            setActiveImageInvoice(subInv);
            setIsImageDialogOpen(true);
            return;
          }

          // If no uploaded image file exists on the submitted invoice, check if NAV counterpart exists
          const targetNum = subInv?.bizonylatsorszam || invNum;
          if (targetNum && companyId) {
            const { data: navInv } = await supabase
              .from('nav_invoices')
              .select(
                'id, invoice_number, currency, invoice_issue_date, supplier_name, customer_name, invoice_direction, project_id'
              )
              .eq('company_id', companyId)
              .ilike('invoice_number', targetNum)
              .maybeSingle();

            if (navInv) {
              setActiveNavInvoice({
                id: navInv.id,
                invoiceNumber: navInv.invoice_number,
                currency: navInv.currency || item.originalCurrency || 'HUF',
                source: 'nav',
                invoiceDate: navInv.invoice_issue_date || undefined,
                supplierName: navInv.supplier_name || item.partner || undefined,
                invoiceDirection: navInv.invoice_direction || undefined,
              });
              setIsNavItemsDialogOpen(true);
              return;
            }
          }

          if (subInv) {
            setActiveNavInvoice({
              id: subInv.id,
              invoiceNumber: subInv.bizonylatsorszam || invNum || '',
              currency: item.originalCurrency || 'HUF',
              source: 'submitted',
              supplierName: subInv.elado_nev || item.partner || undefined,
            });
            setIsNavItemsDialogOpen(true);
            return;
          }
        }

        // 2. If sourceTable is nav_invoice_items or nav_invoices (NAV Online Számla)
        if (item.sourceTable === 'nav_invoice_items' || item.sourceTable === 'nav_invoices') {
          let navInv: any = null;
          if (invId) {
            const { data } = await supabase
              .from('nav_invoices')
              .select(
                'id, invoice_number, currency, invoice_issue_date, supplier_name, customer_name, invoice_direction, project_id'
              )
              .eq('id', invId)
              .maybeSingle();
            navInv = data;
          }
          if (!navInv && invNum && companyId) {
            const { data } = await supabase
              .from('nav_invoices')
              .select(
                'id, invoice_number, currency, invoice_issue_date, supplier_name, customer_name, invoice_direction, project_id'
              )
              .eq('company_id', companyId)
              .ilike('invoice_number', invNum)
              .maybeSingle();
            navInv = data;
          }

          const targetNum = navInv?.invoice_number || invNum;

          // Check if there is a matching submitted invoice with an uploaded image
          if (targetNum && companyId) {
            const { data: subInv } = await supabase
              .from('invoices')
              .select(
                'id, elado_nev, vevo_nev, bizonylatsorszam, dokumentum_azonosito, invoice_type, image_url, melleklet_url, attachments, company_id, reference_number, elolegszamla_hivatkozas'
              )
              .eq('company_id', companyId)
              .ilike('bizonylatsorszam', targetNum)
              .maybeSingle();

            const hasImage =
              subInv &&
              (Boolean(subInv.image_url) ||
                Boolean(subInv.melleklet_url) ||
                (Array.isArray(subInv.attachments) && subInv.attachments.length > 0));

            if (hasImage) {
              setActiveImageInvoice(subInv);
              setIsImageDialogOpen(true);
              return;
            }
          }

          // If no scanned image -> open OSA itemized view ("Ha még csak OSA-ból látszik, akkor az OSA-ból érkező tételes nézetet")
          if (navInv) {
            setActiveNavInvoice({
              id: navInv.id,
              invoiceNumber: navInv.invoice_number,
              currency: navInv.currency || item.originalCurrency || 'HUF',
              source: 'nav',
              invoiceDate: navInv.invoice_issue_date || undefined,
              supplierName: navInv.supplier_name || item.partner || undefined,
              invoiceDirection: navInv.invoice_direction || undefined,
            });
            setIsNavItemsDialogOpen(true);
            return;
          }
        }

        // 3. Fallback for acc_journal_lines, journal_entry, or unclassified items
        if (invNum && companyId) {
          const { data: subInv } = await supabase
            .from('invoices')
            .select(
              'id, elado_nev, vevo_nev, bizonylatsorszam, dokumentum_azonosito, invoice_type, image_url, melleklet_url, attachments, company_id, reference_number, elolegszamla_hivatkozas'
            )
            .eq('company_id', companyId)
            .ilike('bizonylatsorszam', invNum)
            .maybeSingle();

          const hasImage =
            subInv &&
            (Boolean(subInv.image_url) ||
              Boolean(subInv.melleklet_url) ||
              (Array.isArray(subInv.attachments) && subInv.attachments.length > 0));

          if (hasImage) {
            setActiveImageInvoice(subInv);
            setIsImageDialogOpen(true);
            return;
          }

          const { data: navInv } = await supabase
            .from('nav_invoices')
            .select(
              'id, invoice_number, currency, invoice_issue_date, supplier_name, customer_name, invoice_direction, project_id'
            )
            .eq('company_id', companyId)
            .ilike('invoice_number', invNum)
            .maybeSingle();

          if (navInv) {
            setActiveNavInvoice({
              id: navInv.id,
              invoiceNumber: navInv.invoice_number,
              currency: navInv.currency || item.originalCurrency || 'HUF',
              source: 'nav',
              invoiceDate: navInv.invoice_issue_date || undefined,
              supplierName: navInv.supplier_name || item.partner || undefined,
              invoiceDirection: navInv.invoice_direction || undefined,
            });
            setIsNavItemsDialogOpen(true);
            return;
          }
        }

        toast({
          title: t('accounting:general_ledger.doc_resolver.not_found_title', 'Bizonylat nem található'),
          description: t(
            'accounting:general_ledger.doc_resolver.no_matching_invoice',
            'A megadott bizonylatszámhoz nem található elérhető számlakép vagy NAV OSA rekord.'
          ),
          variant: 'default',
        });
      } catch (err: any) {
        console.error('Error resolving GL invoice document:', err);
        toast({
          title: t('common:error', 'Hiba történt'),
          description: t(
            'accounting:general_ledger.doc_resolver.error_resolving',
            'Nem sikerült betölteni a bizonylatot.'
          ),
          variant: 'destructive',
        });
      } finally {
        setResolvingItemId(null);
      }
    },
    [companyId, t, toast]
  );

  return {
    resolvingItemId,
    handleOpenDocument,
    imageDialogProps: {
      invoice: activeImageInvoice,
      open: isImageDialogOpen,
      onClose: handleCloseImageDialog,
    },
    itemsDialogProps: {
      open: isNavItemsDialogOpen,
      onOpenChange: handleNavItemsOpenChange,
      invoiceId: activeNavInvoice?.id || '',
      invoiceNumber: activeNavInvoice?.invoiceNumber || '',
      currency: activeNavInvoice?.currency || 'HUF',
      source: activeNavInvoice?.source || 'nav',
      invoiceDate: activeNavInvoice?.invoiceDate,
      supplierName: activeNavInvoice?.supplierName,
      invoiceDirection: activeNavInvoice?.invoiceDirection,
    },
  };
}
