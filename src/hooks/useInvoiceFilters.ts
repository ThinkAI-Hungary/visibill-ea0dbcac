import { useState, useMemo, useEffect } from 'react';
import type { NavInvoice, SubmittedInvoice, Partner, Category, Project } from './useInvoiceData';

export type InvoiceTab = 'OUTBOUND' | 'INBOUND' | 'SUBMITTED_INBOUND' | 'SUBMITTED_OUTBOUND';

export interface NavFilters {
  search: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
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
  amountMin: string;
  amountMax: string;
  currency: string;
  category: string;
  project: string;
}

const defaultNavFilters: NavFilters = {
  search: '',
  dateFrom: undefined,
  dateTo: undefined,
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
  amountMin: '',
  amountMax: '',
  currency: 'all',
  category: 'all',
  project: 'all',
};

export function useInvoiceFilters(
  invoices: NavInvoice[],
  submittedInvoices: SubmittedInvoice[],
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

  // Reset page when filters change
  useEffect(() => { setNavCurrentPage(1); }, [navFilters, activeTab]);
  useEffect(() => { setSubmittedCurrentPage(1); }, [submittedFilters]);

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

  // ── Filtered & sorted NAV invoices ──

  const filteredAndSortedNavInvoices = useMemo(() => {
    const direction = activeTab === 'OUTBOUND' ? 'OUTBOUND' : 'INBOUND';

    let filtered = invoices.filter(invoice => {
      if (invoice.invoice_direction !== direction) return false;

      if (navFilters.search) {
        const searchLower = navFilters.search.toLowerCase();
        const partnerTaxNumber = getPartnerTaxNumber(invoice);
        const partnerName = getInvoicePartnerName(invoice);
        const matchesSearch =
          invoice.invoice_number?.toLowerCase().includes(searchLower) ||
          partnerTaxNumber?.toLowerCase().includes(searchLower) ||
          partnerName.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      if (navFilters.dateFrom && invoice.invoice_issue_date) {
        if (new Date(invoice.invoice_issue_date) < navFilters.dateFrom) return false;
      }
      if (navFilters.dateTo && invoice.invoice_issue_date) {
        if (new Date(invoice.invoice_issue_date) > navFilters.dateTo) return false;
      }

      const invoiceAmount = invoice.invoice_gross_amount || 0;
      if (navFilters.amountMin && invoiceAmount < parseFloat(navFilters.amountMin)) return false;
      if (navFilters.amountMax && invoiceAmount > parseFloat(navFilters.amountMax)) return false;

      if (navFilters.currency && navFilters.currency !== 'all' && invoice.currency !== navFilters.currency) return false;

      if (navFilters.paid !== 'all') {
        const isPaid = !!invoice.transaction_id;
        if (navFilters.paid === 'yes' && !isPaid) return false;
        if (navFilters.paid === 'no' && isPaid) return false;
      }

      if (navFilters.submitted !== 'all') {
        const isSubmitted = invoice.submitted === true;
        if (navFilters.submitted === 'yes' && !isSubmitted) return false;
        if (navFilters.submitted === 'no' && isSubmitted) return false;
      }

      if (navFilters.project !== 'all') {
        if (navFilters.project === 'none' && invoice.project_id !== null) return false;
        if (navFilters.project !== 'none' && invoice.project_id !== navFilters.project) return false;
      }

      if (navFilters.category !== 'all') {
        if (navFilters.category === 'none' && invoice.category_id !== null) return false;
        if (navFilters.category !== 'none' && invoice.category_id !== navFilters.category) return false;
      }

      if (navFilters.paymentMethod !== 'all') {
        if (navFilters.paymentMethod === 'none' && invoice.payment_method) return false;
        if (navFilters.paymentMethod !== 'none' && invoice.payment_method !== navFilters.paymentMethod) return false;
      }

      return true;
    });

    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      if (sortField === 'partner_name') {
        aValue = getInvoicePartnerName(a)?.toLowerCase() || '';
        bValue = getInvoicePartnerName(b)?.toLowerCase() || '';
      } else if (sortField === 'invoice_issue_date' || sortField === 'invoice_delivery_date') {
        aValue = a[sortField as keyof NavInvoice] ? new Date(a[sortField as keyof NavInvoice] as string).getTime() : 0;
        bValue = b[sortField as keyof NavInvoice] ? new Date(b[sortField as keyof NavInvoice] as string).getTime() : 0;
      } else {
        aValue = a[sortField as keyof NavInvoice];
        bValue = b[sortField as keyof NavInvoice];
      }

      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [invoices, navFilters, sortField, sortDirection, partners, activeTab]);

  // ── Filtered & sorted submitted invoices ──

  const filteredAndSortedSubmittedInvoices = useMemo(() => {
    const submittedDirection = activeTab === 'SUBMITTED_OUTBOUND' ? 'OUTBOUND' : 'INBOUND';

    let filtered = submittedInvoices.filter(invoice => {
      if (invoice.invoice_direction !== submittedDirection) return false;

      if (submittedFilters.search) {
        const searchLower = submittedFilters.search.toLowerCase();
        const matchesSearch =
          invoice.elado_nev?.toLowerCase().includes(searchLower) ||
          invoice.vevo_nev?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      if (submittedFilters.dateFrom && invoice.kibocsatas_datuma) {
        if (new Date(invoice.kibocsatas_datuma) < submittedFilters.dateFrom) return false;
      }
      if (submittedFilters.dateTo && invoice.kibocsatas_datuma) {
        if (new Date(invoice.kibocsatas_datuma) > submittedFilters.dateTo) return false;
      }

      const invoiceAmount = invoice.brutto_vegosszeg || 0;
      if (submittedFilters.amountMin && invoiceAmount < parseFloat(submittedFilters.amountMin)) return false;
      if (submittedFilters.amountMax && invoiceAmount > parseFloat(submittedFilters.amountMax)) return false;

      if (submittedFilters.currency && submittedFilters.currency !== 'all' && invoice.penznem !== submittedFilters.currency) return false;

      if (submittedFilters.category !== 'all') {
        if (submittedFilters.category === 'none' && invoice.category_id !== null) return false;
        if (submittedFilters.category !== 'none' && invoice.category_id !== submittedFilters.category) return false;
      }

      if (submittedFilters.project !== 'all') {
        if (submittedFilters.project === 'none' && invoice.project_id !== null) return false;
        if (submittedFilters.project !== 'none' && invoice.project_id !== submittedFilters.project) return false;
      }

      return true;
    });

    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      if (sortField === 'kibocsatas_datuma' || sortField === 'invoice_issue_date') {
        aValue = a.kibocsatas_datuma ? new Date(a.kibocsatas_datuma).getTime() : 0;
        bValue = b.kibocsatas_datuma ? new Date(b.kibocsatas_datuma).getTime() : 0;
      } else if (sortField === 'teljesites_datuma' || sortField === 'invoice_delivery_date') {
        aValue = a.teljesites_datuma ? new Date(a.teljesites_datuma).getTime() : 0;
        bValue = b.teljesites_datuma ? new Date(b.teljesites_datuma).getTime() : 0;
      } else if (sortField === 'brutto_vegosszeg' || sortField === 'invoice_gross_amount') {
        aValue = a.brutto_vegosszeg || 0;
        bValue = b.brutto_vegosszeg || 0;
      } else if (sortField === 'adoalap_osszesen' || sortField === 'invoice_net_amount') {
        aValue = a.adoalap_osszesen || 0;
        bValue = b.adoalap_osszesen || 0;
      } else if (sortField === 'afa_osszeg_osszesen' || sortField === 'invoice_vat_amount') {
        aValue = a.afa_osszeg_osszesen || 0;
        bValue = b.afa_osszeg_osszesen || 0;
      } else if (sortField === 'elado_nev' || sortField === 'partner_name') {
        aValue = a.elado_nev?.toLowerCase() || '';
        bValue = b.elado_nev?.toLowerCase() || '';
      } else if (sortField === 'vevo_nev') {
        aValue = a.vevo_nev?.toLowerCase() || '';
        bValue = b.vevo_nev?.toLowerCase() || '';
      } else if (sortField === 'bizonylatsorszam' || sortField === 'invoice_number') {
        aValue = a.bizonylatsorszam?.toLowerCase() || '';
        bValue = b.bizonylatsorszam?.toLowerCase() || '';
      } else {
        aValue = a.kibocsatas_datuma ? new Date(a.kibocsatas_datuma).getTime() : 0;
        bValue = b.kibocsatas_datuma ? new Date(b.kibocsatas_datuma).getTime() : 0;
      }

      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [submittedInvoices, submittedFilters, sortField, sortDirection, activeTab]);

  // ── Pagination ──

  const paginatedNavInvoices = useMemo(() => {
    const startIndex = (navCurrentPage - 1) * navPageSize;
    return filteredAndSortedNavInvoices.slice(startIndex, startIndex + navPageSize);
  }, [filteredAndSortedNavInvoices, navCurrentPage, navPageSize]);

  const navTotalPages = Math.ceil(filteredAndSortedNavInvoices.length / navPageSize);

  const paginatedSubmittedInvoices = useMemo(() => {
    const startIndex = (submittedCurrentPage - 1) * submittedPageSize;
    return filteredAndSortedSubmittedInvoices.slice(startIndex, startIndex + submittedPageSize);
  }, [filteredAndSortedSubmittedInvoices, submittedCurrentPage, submittedPageSize]);

  const submittedTotalPages = Math.ceil(filteredAndSortedSubmittedInvoices.length / submittedPageSize);

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
    // Filtered data
    filteredAndSortedNavInvoices,
    filteredAndSortedSubmittedInvoices,
    paginatedNavInvoices,
    paginatedSubmittedInvoices,
    // Helpers
    getInvoicePartnerName,
    getPartnerName,
    getPartnerTaxNumber,
    getCategoryName,
    getProjectName,
    getPaymentMethodLabel,
  };
}
