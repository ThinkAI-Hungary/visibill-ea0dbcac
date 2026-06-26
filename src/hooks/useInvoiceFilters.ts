import { useState, useMemo, useEffect, useDeferredValue } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { NavInvoice, SubmittedInvoice, Partner, Category, Project } from './useInvoiceData';
import { useActivePreset } from './useActivePreset';

export type InvoiceTab = 'OUTBOUND' | 'INBOUND' | 'SUBMITTED_INBOUND' | 'SUBMITTED_OUTBOUND';

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
  const [searchParams] = useSearchParams();
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
    return initial;
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

  // Debounce search with useDeferredValue (single search)
  const deferredSearch = useDeferredValue(filters.search);

  // Reset page when filters or tab change
  useEffect(() => { setNavCurrentPage(1); }, [filters, activeTab]);
  useEffect(() => { setSubmittedCurrentPage(1); }, [filters]);

  // ── Server-side NAV invoices query ──
  const isNavTab = activeTab === 'OUTBOUND' || activeTab === 'INBOUND';
  const navDirection = activeTab === 'OUTBOUND' ? 'OUTBOUND' : 'INBOUND';

  const issueDateFrom = filters.issueDateFrom || null;
  const issueDateTo = filters.issueDateTo || null;

  const { data: navResult = [], isLoading: navLoading, isFetching: navFetching } = useQuery({
    queryKey: [
      'filteredNavInvoices', companyId, dateFromFormatted, dateToFormatted,
      navDirection, deferredSearch, filters.currency, filters.paid,
      filters.submitted, filters.project, filters.category,
      filters.paymentMethod, filters.amountMin, filters.amountMax,
      sortField, sortDirection, navCurrentPage, navPageSize,
      issueDateFrom, issueDateTo, activePresetId
    ],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_filtered_nav_invoices', {
        p_company_id: companyId,
        p_date_from: dateFromFormatted,
        p_date_to: dateToFormatted,
        p_direction: navDirection,
        p_search: deferredSearch || null,
        p_currency: filters.currency === 'all' ? null : filters.currency,
        p_paid: filters.paid === 'all' ? null : filters.paid,
        p_submitted: filters.submitted === 'all' ? null : filters.submitted,
        p_project_id: filters.project === 'all' ? null : filters.project,
        p_category_id: filters.category === 'all' ? null : filters.category,
        p_payment_method: filters.paymentMethod === 'all' ? null : filters.paymentMethod,
        p_amount_min: filters.amountMin ? parseFloat(filters.amountMin) : null,
        p_amount_max: filters.amountMax ? parseFloat(filters.amountMax) : null,
        p_sort_field: sortField,
        p_sort_dir: sortDirection,
        p_page: navCurrentPage,
        p_page_size: navPageSize,
        p_issue_date_from: issueDateFrom,
        p_issue_date_to: issueDateTo,
        p_preset_id: activePresetId || null,
      });
      if (error) throw error;
      return (data || []) as (NavInvoice & { total_count: number })[];
    },
    enabled: enabled && isNavTab,
    placeholderData: keepPreviousData,
  });

  // ── Server-side submitted invoices query ──
  const isSubmittedTab = activeTab === 'SUBMITTED_INBOUND' || activeTab === 'SUBMITTED_OUTBOUND';
  const submittedDirection = activeTab === 'SUBMITTED_OUTBOUND' ? 'OUTBOUND' : 'INBOUND';

  const { data: submittedResult = [], isLoading: submittedFilterLoading, isFetching: submittedFetching } = useQuery({
    queryKey: [
      'filteredSubmittedInvoices', companyId, dateFromFormatted, dateToFormatted,
      submittedDirection, deferredSearch, filters.currency,
      filters.category, filters.project, filters.paymentMethod,
      filters.amountMin, filters.amountMax,
      sortField, sortDirection, submittedCurrentPage, submittedPageSize,
      issueDateFrom, issueDateTo,
    ],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_filtered_submitted_invoices', {
        p_company_id: companyId,
        p_date_from: dateFromFormatted,
        p_date_to: dateToFormatted,
        p_direction: submittedDirection,
        p_search: deferredSearch || null,
        p_currency: filters.currency === 'all' ? null : filters.currency,
        p_category_id: filters.category === 'all' ? null : filters.category,
        p_project_id: filters.project === 'all' ? null : filters.project,
        p_payment_method: filters.paymentMethod === 'all' ? null : filters.paymentMethod,
        p_amount_min: filters.amountMin ? parseFloat(filters.amountMin) : null,
        p_amount_max: filters.amountMax ? parseFloat(filters.amountMax) : null,
        p_sort_field: sortField,
        p_sort_dir: sortDirection,
        p_page: submittedCurrentPage,
        p_page_size: submittedPageSize,
        p_issue_date_from: issueDateFrom,
        p_issue_date_to: issueDateTo,
      });
      if (error) throw error;
      return (data || []) as (SubmittedInvoice & { total_count: number })[];
    },
    enabled: enabled && isSubmittedTab,
    placeholderData: keepPreviousData,
  });

  // Extract paginated data and total counts
  const paginatedNavInvoices = navResult as NavInvoice[];
  const navTotalCount = (navResult[0] as any)?.total_count ?? 0;
  const navTotalPages = Math.max(1, Math.ceil(navTotalCount / navPageSize));

  const paginatedSubmittedInvoices = submittedResult as SubmittedInvoice[];
  const submittedTotalCount = (submittedResult[0] as any)?.total_count ?? 0;
  const submittedTotalPages = Math.max(1, Math.ceil(submittedTotalCount / submittedPageSize));

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

  const clearFilters = () => setFilters(defaultFilters);

  return {
    // Unified filters
    filters,
    setFilters,
    clearFilters,
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
