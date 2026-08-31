import { useMemo } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { invalidateInvoiceQueries, invalidatePartnerQueries } from '@/lib/cache';
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
  match_type: string | null;
  is_verified: boolean | null;
  reason: string | null;
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
  exclude_from_accounting?: boolean;
  gl_numbers?: string | null;
  is_continuous?: boolean;
  service_period_start?: string | null;
  service_period_end?: string | null;
  calculated_ti?: string | null;
  ti_override?: string | null;
  ti_calculation_method?: string | null;
  is_manual_payment?: boolean | null;
  manual_payment_type?: string | null;
  match_status?: string;
}

export interface SubmittedInvoice {
  id: string;
  bizonylatsorszam: string | null;
  kibocsatas_datuma: string;
  teljesites_datuma: string | null;
  elado_nev: string;
  elado_vat_id?: string | null;
  vevo_nev: string;
  vevo_vat_id?: string | null;
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
  invoice_type: string | null;
  exclude_from_accounting?: boolean;
  elolegszamla_hivatkozas?: string | null;
  nav_invoice_id?: string | null;
  match_status?: string;
}

export interface Partner {
  tax_number: string;
  name: string;
}

export interface Category {
  id: string;
  name: string;
  color?: string | null;
}

export interface Project {
  id: string;
  name: string;
  color?: string | null;
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

  // NAV and Submitted invoices list are fetched server-side via useInvoiceFilters RPCs.
  // We keep a lightweight query for submitted invoices within the active date range
  // for linked invoice chains and attachment metadata lookup.
  const { data: submittedInvoices = [], isLoading: submittedLoading } = useQuery({
    queryKey: queryKeys.submittedInvoices(companyId, dateFromFormatted, dateToFormatted),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, bizonylatsorszam, kibocsatas_datuma, teljesites_datuma, elado_nev, elado_vat_id, vevo_nev, vevo_vat_id, adoalap_osszesen, brutto_vegosszeg, afa_osszeg_osszesen, penznem, category_id, project_id, image_url, melleklet_url, invoice_direction, reference_number, fizetesi_mod, invoice_type, exclude_from_accounting, elolegszamla_hivatkozas')
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
  // automatically refetches when the submitted set changes.
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
        .select('id, name, color')
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
        .select('id, name, color')
        .eq('company_id', companyId);
      if (error) throw error;
      return (data || []) as Project[];
    },
    enabled,
  });

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

  const loading = submittedLoading;

  const { data: credentialsExist = false } = useQuery({
    queryKey: queryKeys.navCredentials(selectedCompanyId || ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_nav_credentials')
        .select('id, validation_status')
        .eq('company_id', selectedCompanyId!)
        .maybeSingle();
      return !error && !!data && data.validation_status === 'valid';
    },
    enabled: !!selectedCompanyId,
  });

  const invalidateInvoiceData = () => {
    invalidateInvoiceQueries(queryClient, companyId);
    invalidatePartnerQueries(queryClient, companyId);
    queryClient.invalidateQueries({ queryKey: ['invoiceKpis', companyId] });
    queryClient.invalidateQueries({ queryKey: ['categories', companyId] });
    queryClient.invalidateQueries({ queryKey: ['projectsList', companyId] });
    queryClient.invalidateQueries({ queryKey: ['courierReports', companyId] });
  };

  return {
    submittedInvoices,
    linkedInvoicesPool,
    linkedInvoicesLoading,
    partners,
    categories,
    projects,
    courierReports,
    navIdToCourierReportsMap,
    loading,
    credentialsExist,
    invalidateInvoiceData,
  };
}
