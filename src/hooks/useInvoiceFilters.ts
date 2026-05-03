import { useState, useMemo, useEffect, useDeferredValue } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { NavInvoice, SubmittedInvoice, Partner, Category, Project } from './useInvoiceData';

export type InvoiceTab = 'OUTBOUND' | 'INBOUND' | 'SUBMITTED_INBOUND' | 'SUBMITTED_OUTBOUND';

export interface NavFilters {
  search: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  issueDateFrom: string;
  issueDateTo: string;
  amountMin: string;
  amountMax: string;
  currency: string;
  paid: string;
  submitted: string;
  project: string;
  category: string;
  paymentMethod: string;
}

export interface SubmittedFilters {
  search: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  issueDateFrom: string;
  issueDateTo: string;
  amountMin: string;
  amountMax: string;
  currency: string;
  category: string;
  project: string;
  paymentMethod: string;
}

const defaultNavFilters: NavFilters = {
  search: '',
  dateFrom: undefined,
  dateTo: undefined,
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

const defaultSubmittedFilters: SubmittedFilters = {
  search: '',
  dateFrom: undefined,
  dateTo: undefined,
  issueDateFrom: '',
  issueDateTo: '',
  amountMin: '',
  amountMax: '',
  currency: 'all',
  category: 'all',
  project: 'all',
  paymentMethod: 'all',
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
  const [navFilters, setNavFilters] = useState<NavFilters>(defaultNavFilters);
  const [submittedFilters, setSubmittedFilters] = useState<SubmittedFilters>(defaultSubmittedFilters);
  const [sortField, setSortField] = useState<string>('invoice_issue_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [navPageSize, setNavPageSize] = useState(50);
  const [submittedPageSize, setSubmittedPageSize] = useState(50);
  const [navCurrentPage, setNavCurrentPage] = useState(1);
  const [submittedCurrentPage, setSubmittedCurrentPage] = useState(1);

  // Debounce search with useDeferredValue
  const deferredNavSearch = useDeferredValue(navFilters.search);
  const deferredSubmittedSearch = useDeferredValue(submittedFilters.search);

  // Reset page when filters change
  useEffect(() => { setNavCurrentPage(1); }, [navFilters, activeTab]);
  useEffect(() => { setSubmittedCurrentPage(1); }, [submittedFilters]);

  // ── Server-side NAV invoices query ──
  const isNavTab = activeTab === 'OUTBOUND' || activeTab === 'INBOUND';
  const navDirection = activeTab === 'OUTBOUND' ? 'OUTBOUND' : 'INBOUND';

  // Main date range (from global header) now filters by delivery date.
  // Issue date filter is sent as a separate parameter.
  const navIssueDateFrom = navFilters.issueDateFrom || null;
  const navIssueDateTo = navFilters.issueDateTo || null;

  const { data: navResult = [], isLoading: navLoading } = useQuery({
    queryKey: [
      'filteredNavInvoices', companyId, dateFromFormatted, dateToFormatted,
      navDirection, deferredNavSearch, navFilters.currency, navFilters.paid,
      navFilters.submitted, navFilters.project, navFilters.category,
      navFilters.paymentMethod, navFilters.amountMin, navFilters.amountMax,
      sortField, sortDirection, navCurrentPage, navPageSize,
      navIssueDateFrom, navIssueDateTo,
    ],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_filtered_nav_invoices', {
        p_company_id: companyId,
        p_date_from: dateFromFormatted,
        p_date_to: dateToFormatted,
        p_direction: navDirection,
        p_search: deferredNavSearch || null,
        p_currency: navFilters.currency === 'all' ? null : navFilters.currency,
        p_paid: navFilters.paid === 'all' ? null : navFilters.paid,
        p_submitted: navFilters.submitted === 'all' ? null : navFilters.submitted,
        p_project_id: navFilters.project === 'all' ? null : navFilters.project,
        p_category_id: navFilters.category === 'all' ? null : navFilters.category,
        p_payment_method: navFilters.paymentMethod === 'all' ? null : navFilters.paymentMethod,
        p_amount_min: navFilters.amountMin ? parseFloat(navFilters.amountMin) : null,
        p_amount_max: navFilters.amountMax ? parseFloat(navFilters.amountMax) : null,
        p_sort_field: sortField,
        p_sort_dir: sortDirection,
        p_page: navCurrentPage,
        p_page_size: navPageSize,
        p_issue_date_from: navIssueDateFrom,
        p_issue_date_to: navIssueDateTo,
      });
      if (error) throw error;
      return (data || []) as (NavInvoice & { total_count: number })[];
    },
    enabled: enabled && isNavTab,
  });

  // ── Server-side submitted invoices query ──
  const isSubmittedTab = activeTab === 'SUBMITTED_INBOUND' || activeTab === 'SUBMITTED_OUTBOUND';
  const submittedDirection = activeTab === 'SUBMITTED_OUTBOUND' ? 'OUTBOUND' : 'INBOUND';

  // Issue date filter for submitted invoices
  const subIssueDateFrom = submittedFilters.issueDateFrom || null;
  const subIssueDateTo = submittedFilters.issueDateTo || null;

  const { data: submittedResult = [], isLoading: submittedFilterLoading } = useQuery({
    queryKey: [
      'filteredSubmittedInvoices', companyId, dateFromFormatted, dateToFormatted,
      submittedDirection, deferredSubmittedSearch, submittedFilters.currency,
      submittedFilters.category, submittedFilters.project, submittedFilters.paymentMethod,
      submittedFilters.amountMin, submittedFilters.amountMax,
      sortField, sortDirection, submittedCurrentPage, submittedPageSize,
      subIssueDateFrom, subIssueDateTo,
    ],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_filtered_submitted_invoices', {
        p_company_id: companyId,
        p_date_from: dateFromFormatted,
        p_date_to: dateToFormatted,
        p_direction: submittedDirection,
        p_search: deferredSubmittedSearch || null,
        p_currency: submittedFilters.currency === 'all' ? null : submittedFilters.currency,
        p_category_id: submittedFilters.category === 'all' ? null : submittedFilters.category,
        p_project_id: submittedFilters.project === 'all' ? null : submittedFilters.project,
        p_payment_method: submittedFilters.paymentMethod === 'all' ? null : submittedFilters.paymentMethod,
        p_amount_min: submittedFilters.amountMin ? parseFloat(submittedFilters.amountMin) : null,
        p_amount_max: submittedFilters.amountMax ? parseFloat(submittedFilters.amountMax) : null,
        p_sort_field: sortField,
        p_sort_dir: sortDirection,
        p_page: submittedCurrentPage,
        p_page_size: submittedPageSize,
        p_issue_date_from: subIssueDateFrom,
        p_issue_date_to: subIssueDateTo,
      });
      if (error) throw error;
      return (data || []) as (SubmittedInvoice & { total_count: number })[];
    },
    enabled: enabled && isSubmittedTab,
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
    if (!taxNumber) return '-';
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
    if (!categoryId) return '-';
    return categories.find(c => c.id === categoryId)?.name || '-';
  };

  const getProjectName = (projectId: string | null): string => {
    if (!projectId) return '-';
    return projects.find(p => p.id === projectId)?.name || '-';
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

  const clearNavFilters = () => setNavFilters(defaultNavFilters);
  const clearSubmittedFilters = () => setSubmittedFilters(defaultSubmittedFilters);

  return {
    // Filters
    navFilters,
    setNavFilters,
    submittedFilters,
    setSubmittedFilters,
    clearNavFilters,
    clearSubmittedFilters,
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
    submittedFilterLoading,
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
