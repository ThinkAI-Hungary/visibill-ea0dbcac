import { useMemo } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/integrations/supabase/client';

// ── Types ──

export interface TransactionRecord {
  id: string;
  matched_invoice_id: string;
  transaction_date: string;
  amount: number;
  description: string | null;
  currency: string | null;
  type: string | null;
  confidence_score: number | null;
}

export interface NavInvoice {
  id: string;
  invoice_number: string;
  invoice_direction: string | null;
  invoice_issue_date: string | null;
  invoice_delivery_date: string | null;
  supplier_tax_number: string | null;
  supplier_name: string | null;
  supplier_address: string | null;
  customer_tax_number: string | null;
  customer_name: string | null;
  customer_address: string | null;
  invoice_net_amount: number | null;
  invoice_gross_amount: number | null;
  invoice_vat_amount: number | null;
  currency: string | null;
  payment_method: string | null;
  invoice_operation: string | null;
  payment_date: string | null;
  paid: boolean | null;
  submitted: boolean | null;
  details_fetched: boolean | null;
  company_id: string | null;
  user_id: string | null;
  created_at: string | null;
  fetched_at: string | null;
  project_id: string | null;
  category_id: string | null;
  transaction_id: string | null;
}

export interface SubmittedInvoice {
  id: string;
  bizonylatsorszam: string | null;
  kibocsatas_datuma: string;
  teljesites_datuma: string | null;
  elado_nev: string;
  vevo_nev: string;
  adoalap_osszesen: number;
  brutto_vegosszeg: number;
  afa_osszeg_osszesen: number;
  penznem: string | null;
  category_id: string | null;
  project_id: string | null;
  image_url: string | null;
  melleklet_url: string | null;
  invoice_direction: string | null;
  reference_number: string | null;
  fizetesi_mod: string | null;
}

export interface Partner {
  tax_number: string;
  name: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface Project {
  id: string;
  name: string;
}

export interface CourierReportRecord {
  id: string;
  report_type: string;
  package_number: string | null;
  reference_number: string | null;
  delivery_date: string | null;
  cod_amount: number | null;
  recipient_name: string | null;
  matched_nav_invoice_id: string | null;
  matched_transaction_id: string | null;
}

export function useInvoiceData(
  companyId: string,
  enabled: boolean,
  dateFromFormatted: string,
  dateToFormatted: string,
  selectedCompanyId?: string
) {
  const queryClient = useQueryClient();

  // NAV invoices are now fetched server-side via useInvoiceFilters RPC.
  // We still need a lightweight query for submitted invoices (for lookup maps + linked invoices).
  const { data: submittedInvoices = [], isLoading: submittedLoading } = useQuery({
    queryKey: queryKeys.submittedInvoices(companyId, dateFromFormatted, dateToFormatted),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, bizonylatsorszam, kibocsatas_datuma, teljesites_datuma, elado_nev, vevo_nev, adoalap_osszesen, brutto_vegosszeg, afa_osszeg_osszesen, penznem, category_id, project_id, image_url, melleklet_url, invoice_direction, reference_number, fizetesi_mod')
        .eq('company_id', companyId)
        .or(`and(teljesites_datuma.gte.${dateFromFormatted},teljesites_datuma.lte.${dateToFormatted}),and(teljesites_datuma.is.null,kibocsatas_datuma.gte.${dateFromFormatted},kibocsatas_datuma.lte.${dateToFormatted})`)
        .order('kibocsatas_datuma', { ascending: false })
        .order('id', { ascending: true });
      if (error) throw error;
      return (data || []) as SubmittedInvoice[];
    },
    enabled,
    placeholderData: keepPreviousData,
  });

  // Derive a stable fingerprint from submittedInvoices so linkedInvoicesPool
  // automatically refetches when the submitted set changes (fixes race condition).
  const submittedFingerprint = useMemo(
    () => submittedInvoices.map(i => i.id).sort().join(','),
    [submittedInvoices]
  );

  const { data: linkedInvoicesPool = [], isLoading: linkedInvoicesLoading } = useQuery({
    queryKey: [...queryKeys.linkedInvoices(companyId, dateFromFormatted, dateToFormatted), submittedFingerprint],
    queryFn: async () => {
      const seedBizonylat = submittedInvoices.map(i => i.bizonylatsorszam).filter(Boolean) as string[];
      const seedReference = submittedInvoices.map(i => i.reference_number).filter(Boolean) as string[];
      if (seedBizonylat.length === 0 && seedReference.length === 0) return [];
      const excludeIds = submittedInvoices.map(i => i.id);
      const { data, error } = await supabase.rpc('get_linked_invoices', {
        p_company_id: companyId,
        p_seed_bizonylat: seedBizonylat,
        p_seed_reference: seedReference,
        p_exclude_ids: excludeIds,
      });
      if (error) throw error;
      return (data || []) as SubmittedInvoice[];
    },
    enabled: enabled && !submittedLoading,
  });

  const { data: partners = [] } = useQuery({
    queryKey: queryKeys.partners(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partners')
        .select('tax_number, name')
        .eq('company_id', companyId);
      if (error) throw error;
      return (data || []) as Partner[];
    },
    enabled,
  });

  const { data: categories = [] } = useQuery({
    queryKey: queryKeys.categories(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name')
        .eq('company_id', companyId);
      if (error) throw error;
      return (data || []) as Category[];
    },
    enabled,
  });

  const { data: projects = [] } = useQuery({
    queryKey: queryKeys.projectsList(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .eq('company_id', companyId);
      if (error) throw error;
      return (data || []) as Project[];
    },
    enabled,
  });

  const { data: allTransactions = [], isLoading: txLoading } = useQuery({
    queryKey: queryKeys.invoiceTransactions(companyId, dateFromFormatted, dateToFormatted),
    queryFn: async () => {
      const { data } = await supabase
        .from('transactions')
        .select('id, matched_invoice_id, transaction_date, amount, description, currency, type, confidence_score')
        .eq('company_id', companyId)
        .not('matched_invoice_id', 'is', null)
        .gte('transaction_date', dateFromFormatted)
        .lte('transaction_date', dateToFormatted);
      return (data || []) as TransactionRecord[];
    },
    enabled,
  });

  // Lightweight NAV lookup for cross-tab matching (submitted ↔ NAV by bizonylatsorszam)
  // Paginated fetch to bypass Supabase max_rows limit (default 1000)
  const { data: navInvoicesLookup = [] } = useQuery({
    queryKey: ['navInvoicesLookup', companyId],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      let allData: NavInvoice[] = [];
      let page = 0;
      let hasMore = true;
      while (hasMore) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        const { data, error } = await supabase
          .from('nav_invoices')
          .select('id, invoice_number, invoice_issue_date, supplier_name, customer_name, invoice_gross_amount, currency, transaction_id, submitted')
          .eq('company_id', companyId)
          .range(from, to)
          .order('invoice_issue_date', { ascending: false })
          .order('id', { ascending: true });
        if (error) throw error;
        if (data && data.length > 0) {
          allData = allData.concat(data as NavInvoice[]);
          hasMore = data.length === PAGE_SIZE;
        } else {
          hasMore = false;
        }
        page++;
      }
      return allData;
    },
    enabled,
    placeholderData: keepPreviousData,
  });

  const matchedInvoiceIds = useMemo(
    () => new Set(allTransactions.map(t => t.matched_invoice_id).filter(Boolean)),
    [allTransactions]
  );

  // Fetch courier reports matched to NAV invoices or transactions for this company
  const { data: courierReports = [] } = useQuery({
    queryKey: queryKeys.courierReportsForInvoices(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courier_reports')
        .select('id, report_type, package_number, reference_number, delivery_date, cod_amount, recipient_name, matched_nav_invoice_id, matched_transaction_id')
        .eq('company_id', companyId)
        .or('matched_nav_invoice_id.not.is.null,matched_transaction_id.not.is.null');
      if (error) throw error;
      return (data || []) as CourierReportRecord[];
    },
    enabled,
    placeholderData: keepPreviousData,
  });

  // Map: nav_invoice_id -> courier reports
  const navIdToCourierReportsMap = useMemo(() => {
    const map = new Map<string, CourierReportRecord[]>();
    for (const cr of courierReports) {
      if (cr.matched_nav_invoice_id) {
        const existing = map.get(cr.matched_nav_invoice_id) || [];
        existing.push(cr);
        map.set(cr.matched_nav_invoice_id, existing);
      }
    }
    return map;
  }, [courierReports]);

  const loading = submittedLoading || txLoading;

  const { data: credentialsExist = false } = useQuery({
    queryKey: queryKeys.navCredentials(selectedCompanyId || ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_nav_credentials')
        .select('id, validation_status')
        .eq('company_id', selectedCompanyId!)
        .maybeSingle();
      // Only allow sync when credentials exist AND validation_status is 'valid'
      return !error && !!data && data.validation_status === 'valid';
    },
    enabled: !!selectedCompanyId,
  });

  const invalidateInvoiceData = () => {
    queryClient.invalidateQueries({ queryKey: ['navInvoices', companyId] });
    queryClient.invalidateQueries({ queryKey: ['navInvoicesLookup', companyId] });
    queryClient.invalidateQueries({ queryKey: ['submittedInvoices', companyId] });
    queryClient.invalidateQueries({ queryKey: ['linkedInvoices', companyId] });
    queryClient.invalidateQueries({ queryKey: ['partners', companyId] });
    queryClient.invalidateQueries({ queryKey: ['categories', companyId] });
    queryClient.invalidateQueries({ queryKey: ['projectsList', companyId] });
    queryClient.invalidateQueries({ queryKey: ['invoiceTransactions', companyId] });
    queryClient.invalidateQueries({ queryKey: ['filteredNavInvoices', companyId] });
    queryClient.invalidateQueries({ queryKey: ['filteredSubmittedInvoices', companyId] });
  };

  return {
    submittedInvoices,
    linkedInvoicesPool,
    linkedInvoicesLoading,
    partners,
    categories,
    projects,
    allTransactions,
    navInvoicesLookup,
    matchedInvoiceIds,
    courierReports,
    navIdToCourierReportsMap,
    loading,
    credentialsExist,
    invalidateInvoiceData,
  };
}
