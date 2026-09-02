import { useState, useMemo, useEffect, useDeferredValue, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { NavInvoice, SubmittedInvoice, Partner, Category, Project } from './useInvoiceData';
import { useActivePreset } from './useActivePreset';

export type InvoiceTab = 'OUTBOUND' | 'INBOUND' | 'SUBMITTED_INBOUND' | 'SUBMITTED_OUTBOUND';
export type KpiFilterType = 'all' | 'matched' | 'suggested' | 'unmatched';

export interface InvoiceKpiSummary {
  total: number;
  matched: number;
  suggested: number;
  unmatched: number;
}

// ── Unified filter interface shared across ALL tabs ──
export interface InvoiceFilters {
  search: string;
  issueDateFrom: string;
  issueDateTo: string;
  amountMin: string;
  amountMax: string;
  currency: string;
  paid: string;       // NAV-only but persisted across tab switches
  submitted: string;  // NAV-only but persisted across tab switches
  project: string;
  category: string;
  paymentMethod: string;
  continuous: string; // 'all' | 'yes' | 'no'
  navStatus: string;  // 'all' | 'verified' | 'missing_nav' | 'not_applicable'
}

export const defaultFilters: InvoiceFilters = {
  search: '',
  issueDateFrom: '',
  issueDateTo: '',
  amountMin: '',
  amountMax: '',
  currency: 'all',
  paid: 'all',
  submitted: 'all',
  project: 'all',
  category: 'all',
  paymentMethod: 'all',
  continuous: 'all',
  navStatus: 'all',
};

// URL query param keys for each filter (short keys for clean URLs)
export const FILTER_URL_KEYS: Record<keyof InvoiceFilters, string> = {
  search: 'q',
  issueDateFrom: 'idf',
  issueDateTo: 'idt',
  amountMin: 'amin',
  amountMax: 'amax',
  currency: 'cur',
  paid: 'paid',
  submitted: 'sub',
  project: 'proj',
  category: 'cat',
  paymentMethod: 'pm',
  continuous: 'cont',
  navStatus: 'navs',
};

export function useInvoiceFilters(
  companyId: string,
  enabled: boolean,
  dateFromFormatted: string,
  dateToFormatted: string,
  partners: Partner[],
  categories: Category[],
  projects: Project[],
  activeTab: InvoiceTab
) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { activePresetId } = useActivePreset(companyId);

  // Initialize all state from URL searchParams (enables link sharing)
  const [filters, setFilters] = useState<InvoiceFilters>(() => {
    const initial = { ...defaultFilters };
    for (const [key, urlKey] of Object.entries(FILTER_URL_KEYS)) {
      const value = searchParams.get(urlKey);
      if (value !== null) {
        initial[key as keyof InvoiceFilters] = value;
      }
    }
    
    // Check both 'q' (standard URL key) and 'search' (fallback/alternate key)
    const altSearch = searchParams.get('search');
    if (altSearch !== null) {
      initial.search = altSearch;
    }
    
    return initial;
  });

  const [kpiFilter, setKpiFilter] = useState<KpiFilterType>(() => {
    const kpi = searchParams.get('kpi');
    if (kpi === 'matched' || kpi === 'suggested' || kpi === 'unmatched') {
      return kpi;
    }
    return 'all';
  });

  const [sortField, setSortField] = useState<string>(() =>
    searchParams.get('sf') || 'invoice_issue_date'
  );
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(() =>
    (searchParams.get('sd') as 'asc' | 'desc') || 'desc'
  );
  const [navPageSize, setNavPageSize] = useState(() => {
    const ps = searchParams.get('ps');
    return ps ? (parseInt(ps, 10) || 50) : 50;
  });
  const [submittedPageSize, setSubmittedPageSize] = useState(() => {
    const ps = searchParams.get('ps');
    return ps ? (parseInt(ps, 10) || 50) : 50;
  });
  const [navCurrentPage, setNavCurrentPage] = useState(() => {
    const p = searchParams.get('p');
    return p ? (parseInt(p, 10) || 1) : 1;
  });
  const [submittedCurrentPage, setSubmittedCurrentPage] = useState(() => {
    const p = searchParams.get('p');
    return p ? (parseInt(p, 10) || 1) : 1;
  });

  // Sync URL search params back to React state when URL changes externally.
  useEffect(() => {
    setFilters(prev => {
      let updated = false;
      const next = { ...prev };
      
      const urlSearch = searchParams.get('q') || searchParams.get('search') || '';
      if (next.search !== urlSearch) {
        next.search = urlSearch;
        updated = true;
      }
      
      for (const [key, urlKey] of Object.entries(FILTER_URL_KEYS)) {
        if (key === 'search') continue;
        const val = searchParams.get(urlKey) || defaultFilters[key as keyof InvoiceFilters];
        if (next[key as keyof InvoiceFilters] !== val) {
          next[key as keyof InvoiceFilters] = val;
          updated = true;
        }
      }
      
      return updated ? next : prev;
    });

    const kpi = searchParams.get('kpi');
    const validKpi: KpiFilterType = (kpi === 'matched' || kpi === 'suggested' || kpi === 'unmatched') ? kpi : 'all';
    setKpiFilter(prev => prev !== validKpi ? validKpi : prev);

    const sf = searchParams.get('sf') || 'invoice_issue_date';
    setSortField(prev => prev !== sf ? sf : prev);
    
    const sd = (searchParams.get('sd') as 'asc' | 'desc') || 'desc';
    setSortDirection(prev => prev !== sd ? sd : prev);
    
    const ps = searchParams.get('ps');
    const pageSize = ps ? (parseInt(ps, 10) || 50) : 50;
    setNavPageSize(prev => prev !== pageSize ? pageSize : prev);
    setSubmittedPageSize(prev => prev !== pageSize ? pageSize : prev);
    
    const p = searchParams.get('p');
    const pageNum = p ? (parseInt(p, 10) || 1) : 1;
    setNavCurrentPage(prev => prev !== pageNum ? pageNum : prev);
    setSubmittedCurrentPage(prev => prev !== pageNum ? pageNum : prev);
  }, [searchParams]);

  // Debounce search with useDeferredValue
  const deferredSearch = useDeferredValue(filters.search);

  // Reset page when filters, KPI filter, or tab change
  useEffect(() => { setNavCurrentPage(1); }, [filters, kpiFilter, activeTab]);
  useEffect(() => { setSubmittedCurrentPage(1); }, [filters, kpiFilter, activeTab]);

  const isNavTab = activeTab === 'OUTBOUND' || activeTab === 'INBOUND';
  const navDirection = activeTab === 'OUTBOUND' ? 'OUTBOUND' : 'INBOUND';
  const isSubmittedTab = activeTab === 'SUBMITTED_INBOUND' || activeTab === 'SUBMITTED_OUTBOUND';
  const submittedDirection = activeTab === 'SUBMITTED_OUTBOUND' ? 'OUTBOUND' : 'INBOUND';

  const issueDateFrom = filters.issueDateFrom || null;
  const issueDateTo = filters.issueDateTo || null;

  // ── Server-side KPI Summary RPC query (ultra-fast aggregation) ──
  const { data: invoiceKpis = { total: 0, matched: 0, suggested: 0, unmatched: 0 }, isLoading: isKpisLoading } = useQuery({
    queryKey: [
      'invoiceKpis', companyId, dateFromFormatted, dateToFormatted,
      isNavTab ? navDirection : submittedDirection,
      isNavTab ? 'nav' : 'submitted',
      deferredSearch, filters.currency, filters.project, filters.category,
      filters.paymentMethod, filters.amountMin, filters.amountMax,
      issueDateFrom, issueDateTo, filters.continuous, filters.submitted
    ],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_invoice_kpis', {
        p_company_id: companyId,
        p_date_from: dateFromFormatted,
        p_date_to: dateToFormatted,
        p_direction: isNavTab ? navDirection : submittedDirection,
        p_source: isNavTab ? 'nav' : 'submitted',
        p_search: deferredSearch || undefined,
        p_currency: filters.currency === 'all' ? undefined : filters.currency,
        p_project_id: filters.project === 'all' ? undefined : filters.project,
        p_category_id: filters.category === 'all' ? undefined : filters.category,
        p_payment_method: filters.paymentMethod === 'all' ? undefined : filters.paymentMethod,
        p_amount_min: filters.amountMin ? parseFloat(filters.amountMin) : undefined,
        p_amount_max: filters.amountMax ? parseFloat(filters.amountMax) : undefined,
        p_issue_date_from: issueDateFrom || undefined,
        p_issue_date_to: issueDateTo || undefined,
        p_continuous: filters.continuous === 'all' ? undefined : filters.continuous,
        p_submitted: filters.submitted === 'all' ? undefined : filters.submitted,
      });
      if (error) throw error;
      const res = data?.[0] || { total: 0, matched: 0, suggested: 0, unmatched: 0 };
      return {
        total: Number(res.total || 0),
        matched: Number(res.matched || 0),
        suggested: Number(res.suggested || 0),
        unmatched: Number(res.unmatched || 0),
      };
    },
    enabled: enabled && !!companyId,
    placeholderData: keepPreviousData,
    staleTime: 30000,
  });

  // ── Server-side NAV invoices query (with server-side p_kpi_filter) ──
  const { data: navResult = [], isLoading: navLoading, isFetching: navFetching } = useQuery({
    queryKey: [
      'filteredNavInvoices', companyId, dateFromFormatted, dateToFormatted,
      navDirection, deferredSearch, filters.currency, filters.paid,
      filters.submitted, filters.project, filters.category,
      filters.paymentMethod, filters.amountMin, filters.amountMax,
      sortField, sortDirection, navCurrentPage, navPageSize,
      issueDateFrom, issueDateTo, activePresetId, filters.continuous, kpiFilter
    ],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_filtered_nav_invoices', {
        p_company_id: companyId,
        p_date_from: dateFromFormatted,
        p_date_to: dateToFormatted,
        p_direction: navDirection,
        p_search: deferredSearch || undefined,
        p_currency: filters.currency === 'all' ? undefined : filters.currency,
        p_paid: filters.paid === 'all' ? undefined : filters.paid,
        p_submitted: filters.submitted === 'all' ? undefined : filters.submitted,
        p_project_id: filters.project === 'all' ? undefined : filters.project,
        p_category_id: filters.category === 'all' ? undefined : filters.category,
        p_payment_method: filters.paymentMethod === 'all' ? undefined : filters.paymentMethod,
        p_amount_min: filters.amountMin ? parseFloat(filters.amountMin) : undefined,
        p_amount_max: filters.amountMax ? parseFloat(filters.amountMax) : undefined,
        p_sort_field: sortField,
        p_sort_dir: sortDirection,
        p_page: navCurrentPage,
        p_page_size: navPageSize,
        p_issue_date_from: issueDateFrom || undefined,
        p_issue_date_to: issueDateTo || undefined,
        p_preset_id: activePresetId || undefined,
        p_continuous: filters.continuous === 'all' ? undefined : filters.continuous,
        p_kpi_filter: kpiFilter,
      });
      if (error) throw error;
      return (data || []) as (NavInvoice & { match_status: string; total_count: number })[];
    },
    enabled: enabled && isNavTab,
    placeholderData: keepPreviousData,
  });

  // ── Server-side submitted invoices query (with server-side p_kpi_filter) ──
  const { data: submittedResult = [], isLoading: submittedFilterLoading, isFetching: submittedFetching } = useQuery({
    queryKey: [
      'filteredSubmittedInvoices', companyId, dateFromFormatted, dateToFormatted,
      submittedDirection, deferredSearch, filters.currency,
      filters.category, filters.project, filters.paymentMethod,
      filters.amountMin, filters.amountMax, filters.navStatus,
      sortField, sortDirection, submittedCurrentPage, submittedPageSize,
      issueDateFrom, issueDateTo, kpiFilter
    ],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_filtered_submitted_invoices', {
        p_company_id: companyId,
        p_date_from: dateFromFormatted,
        p_date_to: dateToFormatted,
        p_direction: submittedDirection,
        p_search: deferredSearch || undefined,
        p_currency: filters.currency === 'all' ? undefined : filters.currency,
        p_category_id: filters.category === 'all' ? undefined : filters.category,
        p_project_id: filters.project === 'all' ? undefined : filters.project,
        p_payment_method: filters.paymentMethod === 'all' ? undefined : filters.paymentMethod,
        p_amount_min: filters.amountMin ? parseFloat(filters.amountMin) : undefined,
        p_amount_max: filters.amountMax ? parseFloat(filters.amountMax) : undefined,
        p_sort_field: sortField,
        p_sort_dir: sortDirection,
        p_page: submittedCurrentPage,
        p_page_size: submittedPageSize,
        p_issue_date_from: issueDateFrom || undefined,
        p_issue_date_to: issueDateTo || undefined,
        p_kpi_filter: kpiFilter,
        p_nav_status: filters.navStatus === 'all' ? undefined : filters.navStatus,
      });
      if (error) throw error;
      return (data || []) as (SubmittedInvoice & { match_status: string; total_count: number })[];
    },
    enabled: enabled && isSubmittedTab,
    placeholderData: keepPreviousData,
  });

  // Extract paginated data and total counts directly from server
  const paginatedNavInvoices = navResult as (NavInvoice & { match_status: string })[];
  const navTotalCount = Number((navResult[0] as any)?.total_count ?? 0);
  const navTotalPages = Math.max(1, Math.ceil(navTotalCount / navPageSize));

  const paginatedSubmittedInvoices = submittedResult as (SubmittedInvoice & { match_status: string })[];
  const submittedTotalCount = Number((submittedResult[0] as any)?.total_count ?? 0);
  const submittedTotalPages = Math.max(1, Math.ceil(submittedTotalCount / submittedPageSize));

  // Toggle KPI filter
  const toggleKpiFilter = useCallback((filter: KpiFilterType) => {
    setKpiFilter(prev => prev === filter ? 'all' : filter);
  }, []);

  // ── Helper functions ──

  const getPartnerName = (taxNumber: string | null): string => {
    if (!taxNumber) return 'Ismeretlen partner';
    const partner = partners.find(p => p.tax_number === taxNumber);
    return partner?.name || taxNumber;
  };

  const getInvoicePartnerName = (invoice: NavInvoice): string => {
    if (invoice.invoice_direction === 'INBOUND') {
      if (invoice.supplier_name) return invoice.supplier_name;
      return getPartnerName(invoice.supplier_tax_number);
    } else {
      if (invoice.customer_name) return invoice.customer_name;
      return getPartnerName(invoice.customer_tax_number);
    }
  };

  const getPartnerTaxNumber = (invoice: NavInvoice): string | null => {
    return invoice.invoice_direction === 'INBOUND' ? invoice.supplier_tax_number : invoice.customer_tax_number;
  };

  const getCategoryName = (categoryId: string | null): string => {
    if (!categoryId) return 'Nincs kategória';
    return categories.find(c => c.id === categoryId)?.name || 'Nincs kategória';
  };

  const getProjectName = (projectId: string | null): string => {
    if (!projectId) return 'Nincs projekt';
    return projects.find(p => p.id === projectId)?.name || 'Nincs projekt';
  };

  const getPaymentMethodLabel = (method: string | null) => {
    switch (method) {
      case 'TRANSFER': return 'Átutalás';
      case 'CASH': return 'Készpénz';
      case 'CARD': return 'Bankkártya';
      case 'VOUCHER': return 'Utalvány';
      case 'OTHER': return 'Egyéb';
      default: return 'Nem megadott';
    }
  };

  // ── Sort handler ──

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // ── Clear filters ──

  const clearFilters = () => {
    setFilters(defaultFilters);
    setKpiFilter('all');
  };

  return {
    // Unified filters
    filters,
    setFilters,
    clearFilters,
    // KPI filter & summary
    kpiFilter,
    setKpiFilter,
    toggleKpiFilter,
    invoiceKpis,
    isKpisLoading,
    // Sorting
    sortField,
    sortDirection,
    handleSort,
    // Pagination
    navPageSize,
    setNavPageSize,
    submittedPageSize,
    setSubmittedPageSize,
    navCurrentPage,
    setNavCurrentPage,
    submittedCurrentPage,
    setSubmittedCurrentPage,
    navTotalPages,
    submittedTotalPages,
    // Loading
    navLoading,
    navFetching,
    submittedFilterLoading,
    submittedFetching,
    // Filtered data (server-side, already paginated)
    filteredAndSortedNavInvoices: paginatedNavInvoices,
    filteredAndSortedSubmittedInvoices: paginatedSubmittedInvoices,
    paginatedNavInvoices,
    paginatedSubmittedInvoices,
    navTotalCount,
    submittedTotalCount,
    // Helpers
    getInvoicePartnerName,
    getPartnerName,
    getPartnerTaxNumber,
    getCategoryName,
    getProjectName,
    getPaymentMethodLabel,
  };
}
