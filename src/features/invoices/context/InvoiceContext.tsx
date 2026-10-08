import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useDateRange } from '@/contexts/DateRangeContext';
import { useEaisybillPermissions } from '@/hooks/useEaisybillPermissions';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useInvoiceData } from '@/hooks/useInvoiceData';
import { useInvoiceFilters, FILTER_URL_KEYS, defaultFilters } from '@/hooks/useInvoiceFilters';
import { useInvoiceMutations } from '@/hooks/useInvoiceMutations';
import { useUrlTab } from '@/lib/navigation';
import { useNettingDetection } from '@/hooks/useNettingDetection';
import { usePdfExport } from '@/hooks/usePdfExport';
import { isNavAndSubmittedInvoiceMatch } from '@/lib/invoiceMatchingUtils';
import { exportToFile, exportMultiTableDocument } from '@/lib/exportUtils';
import { supabase } from '@/integrations/supabase/client';
import type {
  NavInvoice,
  SubmittedInvoice,
  Partner,
  Category,
  Project,
  InvoiceTab,
  InvoiceFilters,
  InvoiceKpiSummary,
  KpiFilterType,
  ExportableInvoice,
  ExportLevel,
  ExportSheetLayout,
  TabSlug,
  InvoiceAction,
} from '../types';
import { TAB_SLUGS, SLUG_TO_TAB, TAB_TO_SLUG } from '../types';
import { buildLinkedInvoicesMap, type SuggestedSubmittedInvoiceWithScore } from '../utils/invoiceRelations';

import {
  InvoiceFilterContext,
  InvoiceFilterProvider,
  type InvoiceFilterContextValue,
} from './InvoiceFilterContext';
import {
  InvoicePaginationContext,
  InvoicePaginationProvider,
  type InvoicePaginationContextValue,
} from './InvoicePaginationContext';
import {
  InvoiceSelectionContext,
  InvoiceSelectionProvider,
  type InvoiceSelectionContextValue,
} from './InvoiceSelectionContext';

export interface InvoiceContextValue
  extends InvoiceFilterContextValue,
    InvoicePaginationContextValue,
    InvoiceSelectionContextValue {
  // Company & auth
  companyId: string;
  selectedCompany: any;
  writable: boolean;

  // Tab
  tabSlug: TabSlug;
  setTabSlug: (slug: TabSlug) => void;
  activeTab: InvoiceTab;
  setActiveTab: (tab: InvoiceTab, options?: { preserveInvoiceParam?: boolean }) => void;
  isSubmittedTab: boolean;

  // Data & loading
  submittedInvoices: SubmittedInvoice[];
  linkedInvoicesPool: SubmittedInvoice[];
  linkedInvoicesLoading: boolean;
  linkedInvoicesMap: {
    byBizonylat: Map<string, SubmittedInvoice[]>;
    byReference: Map<string, SubmittedInvoice[]>;
  };
  partners: Partner[];
  categories: Category[];
  projects: Project[];
  navIdToCourierReportsMap: Map<string, any[]>;
  trxIdToCourierReportsMap?: Map<string, any[]>;
  dataLoading: boolean;
  credentialsExist: boolean;
  invalidateInvoiceData: () => void;
  loading: boolean;
  tabFetching: boolean;

  // Formatters & helpers
  getInvoicePartnerName: (invoice: NavInvoice) => string;
  getPartnerTaxNumber: (invoice: NavInvoice) => string | null;
  getCategoryName: (categoryId: string | null) => string;
  getProjectName: (projectId: string | null) => string;
  getPaymentMethodLabel: (method: string | null) => string;

  // Netting
  nettingInvoiceIds: Set<string>;
  getNettingGroup: (invoiceId: string) => any | null;

  // Dialog states & deep linking
  imageDialogOpen: boolean;
  setImageDialogOpen: (open: boolean) => void;
  editDialogOpen: boolean;
  setEditDialogOpen: (open: boolean) => void;
  createDialogOpen: boolean;
  setCreateDialogOpen: (open: boolean) => void;
  itemsDialogOpen: boolean;
  setItemsDialogOpen: (open: boolean) => void;
  submittedItemsDialogOpen: boolean;
  setSubmittedItemsDialogOpen: (open: boolean) => void;
  filesDialogOpen: boolean;
  setFilesDialogOpen: (open: boolean) => void;
  syncDialogOpen: boolean;
  setSyncDialogOpen: (open: boolean) => void;
  bulkDeleteDialogOpen: boolean;
  setBulkDeleteDialogOpen: (open: boolean) => void;
  approvalDialogOpen: boolean;
  setApprovalDialogOpen: (open: boolean) => void;
  suggestedLinkDialogOpen: boolean;
  setSuggestedLinkDialogOpen: (open: boolean) => void;

  selectedInvoice: SubmittedInvoice | null;
  setSelectedInvoice: (inv: SubmittedInvoice | null) => void;
  selectedNavInvoice: NavInvoice | null;
  setSelectedNavInvoice: (inv: NavInvoice | null) => void;
  selectedSubmittedForItems: SubmittedInvoice | null;
  setSelectedSubmittedForItems: (inv: SubmittedInvoice | null) => void;
  selectedInvoiceForApproval: SubmittedInvoice | null;
  setSelectedInvoiceForApproval: (inv: SubmittedInvoice | null) => void;
  selectedSuggestedLinkPair: {
    navInvoice: NavInvoice;
    suggestedInvoice: SuggestedSubmittedInvoiceWithScore;
  } | null;
  setSelectedSuggestedLinkPair: (pair: {
    navInvoice: NavInvoice;
    suggestedInvoice: SuggestedSubmittedInvoiceWithScore;
  } | null) => void;
  setInvoiceParam: (
    invoiceId: string | null,
    action?: InvoiceAction,
    options?: { removeInvoice?: boolean }
  ) => void;
  lastViewedInvoiceId: string | null;
  setLastViewedInvoiceId: (id: string | null) => void;

  // Export
  pdfExport: any;
  dataExportDialogOpen: boolean;
  setDataExportDialogOpen: (open: boolean) => void;
  dataExportFormat: 'csv' | 'xlsx' | 'pdf';
  setDataExportFormat: (f: 'csv' | 'xlsx' | 'pdf') => void;
  dataExportLevel: ExportLevel;
  setDataExportLevel: (l: ExportLevel) => void;
  openDataExportDialog: (format?: 'csv' | 'xlsx' | 'pdf', level?: ExportLevel) => void;
  handleDataExportConfirm: (
    selectedInvoices: ExportableInvoice[],
    format: 'csv' | 'xlsx' | 'pdf',
    exportLevel?: ExportLevel,
    sheetLayout?: ExportSheetLayout
  ) => Promise<void>;
  exportableInvoices: ExportableInvoice[];

  // Mutations
  syncing: boolean;
  canSync: boolean;
  cooldownSeconds: number;
  formatCooldown: (seconds: number) => string;
  handleSync: (syncDateFrom?: string, syncDateTo?: string, onProgress?: (progress: any) => void) => Promise<void>;
  handleProjectChange: (invoiceId: string, projectId: string | null) => Promise<void>;
  handleCategoryChange: (invoiceId: string, categoryId: string | null, invoiceNumber?: string | null) => Promise<void>;
  handleToggleSubmitted: (invoice: NavInvoice) => Promise<void>;
  handleExport: (exportFormat: 'csv' | 'xlsx') => void;
  handleBulkCategoryChange: (categoryId: string | null) => Promise<void>;
  handleBulkProjectChange: (projectId: string | null) => Promise<void>;
  handleBulkDeleteSubmitted: (mode?: 'row_only' | 'row_and_file') => Promise<void>;
}

export const InvoiceContext = createContext<InvoiceContextValue | null>(null);

export function InvoiceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const { dateFromFormatted, dateToFormatted } = useDateRange();
  const { canWrite: canWriteModule } = useEaisybillPermissions();
  const writable = canWriteModule('invoices');
  const [searchParams, setSearchParams] = useSearchParams();

  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());

  // Tab state synced to URL
  const [tabSlug, setTabSlug] = useUrlTab('invoices', 'outbound_nav' as TabSlug, TAB_SLUGS, {
    stripSearchParams: ['invoice', 'action'],
  });
  const activeTab: InvoiceTab = SLUG_TO_TAB[tabSlug as TabSlug] || 'OUTBOUND';
  const activeTabRef = useRef(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const expandUrlTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHandlingDeepLinkRef = useRef(false);
  const handledDeepLinkInvoiceRef = useRef<string | null>(null);

  // Clean up expand debounce timer on unmount
  useEffect(() => {
    return () => {
      if (expandUrlTimeoutRef.current) {
        clearTimeout(expandUrlTimeoutRef.current);
      }
    };
  }, []);

  const setActiveTab = useCallback(
    (tab: InvoiceTab, options?: { preserveInvoiceParam?: boolean }) => {
      if (!options?.preserveInvoiceParam) {
        if (expandUrlTimeoutRef.current) {
          clearTimeout(expandUrlTimeoutRef.current);
          expandUrlTimeoutRef.current = null;
        }
        setExpandedRowIds(new Set());
        handledDeepLinkInvoiceRef.current = null;
        autoOpenedDialogInvoiceIdRef.current = null;
        setSearchParams(prev => {
          if (!prev.has('invoice') && !prev.has('action')) return prev;
          const next = new URLSearchParams(prev);
          next.delete('invoice');
          next.delete('action');
          return next.toString() === prev.toString() ? prev : next;
        }, { replace: true });
      }
      setTabSlug(TAB_TO_SLUG[tab], options?.preserveInvoiceParam ? { preserveParams: true } : undefined);
    },
    [setTabSlug, setSearchParams]
  );

  // Sync external tab changes (e.g. browser back/forward)
  const prevActiveTabRef = useRef(activeTab);
  useEffect(() => {
    if (prevActiveTabRef.current !== activeTab) {
      prevActiveTabRef.current = activeTab;
      if (!isHandlingDeepLinkRef.current) {
        if (expandUrlTimeoutRef.current) {
          clearTimeout(expandUrlTimeoutRef.current);
          expandUrlTimeoutRef.current = null;
        }
        setExpandedRowIds(new Set());
        handledDeepLinkInvoiceRef.current = null;
        autoOpenedDialogInvoiceIdRef.current = null;
        setSearchParams(prev => {
          if (!prev.has('invoice') && !prev.has('action')) return prev;
          const next = new URLSearchParams(prev);
          next.delete('invoice');
          next.delete('action');
          return next.toString() === prev.toString() ? prev : next;
        }, { replace: true });
      }
    }
  }, [activeTab, setSearchParams]);

  // Dialog states
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [lastViewedInvoiceId, setLastViewedInvoiceId] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [itemsDialogOpen, setItemsDialogOpen] = useState(false);
  const [submittedItemsDialogOpen, setSubmittedItemsDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<SubmittedInvoice | null>(null);
  const [selectedNavInvoice, setSelectedNavInvoice] = useState<NavInvoice | null>(null);
  const [selectedSubmittedForItems, setSelectedSubmittedForItems] = useState<SubmittedInvoice | null>(null);
  const [filesDialogOpen, setFilesDialogOpen] = useState(false);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [selectedInvoiceForApproval, setSelectedInvoiceForApproval] = useState<SubmittedInvoice | null>(null);
  const [suggestedLinkDialogOpen, setSuggestedLinkDialogOpen] = useState(false);
  const [selectedSuggestedLinkPair, setSelectedSuggestedLinkPair] = useState<{
    navInvoice: NavInvoice;
    suggestedInvoice: SuggestedSubmittedInvoiceWithScore;
  } | null>(null);

  // Row selection state
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
  const [selectedSubmittedIds, setSelectedSubmittedIds] = useState<Set<string>>(new Set());

  const companyId = selectedCompany?.id || '';
  const enabled = !!user && !!selectedCompany && !!dateFromFormatted && !!dateToFormatted;
  const isSubmittedTab = activeTab === 'SUBMITTED_INBOUND' || activeTab === 'SUBMITTED_OUTBOUND';

  // ── URL-based invoice deep-linking ──
  const setInvoiceParam = useCallback(
    (
      invoiceId: string | null,
      action: InvoiceAction = 'items',
      options?: { removeInvoice?: boolean }
    ) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (invoiceId) {
            if (next.get('invoice') === invoiceId && next.get('action') === action) {
              return prev;
            }
            next.set('invoice', invoiceId);
            next.set('action', action);
          } else {
            const hadAction = next.has('action');
            const hadInvoice = next.has('invoice');
            if (!hadAction && (!hadInvoice || !options?.removeInvoice)) {
              return prev;
            }
            next.delete('action');
            if (options?.removeInvoice) {
              next.delete('invoice');
            }
          }
          return next.toString() === prev.toString() ? prev : next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  // ── Data hook ──
  const {
    submittedInvoices,
    linkedInvoicesPool,
    linkedInvoicesLoading,
    partners,
    categories,
    projects,
    navIdToCourierReportsMap,
    trxIdToCourierReportsMap,
    loading: dataLoading,
    credentialsExist,
    invalidateInvoiceData,
  } = useInvoiceData(companyId, enabled, dateFromFormatted, dateToFormatted, selectedCompany?.id);

  const linkedInvoicesMap = useMemo(() => {
    return buildLinkedInvoicesMap(submittedInvoices, linkedInvoicesPool);
  }, [submittedInvoices, linkedInvoicesPool]);

  const { effectiveSettings } = useCompanySettings();
  const defaultDateBasis = (effectiveSettings?.gl_date_basis as string) || 'kibocsatas';

  // ── Filters hook ──
  const {
    filters,
    setFilters,
    clearFilters,
    kpiFilter,
    setKpiFilter,
    toggleKpiFilter,
    invoiceKpis,
    isKpisLoading,
    sortField,
    sortDirection,
    handleSort,
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
    navLoading,
    navFetching,
    submittedFilterLoading,
    submittedFetching,
    filteredAndSortedNavInvoices,
    filteredAndSortedSubmittedInvoices,
    paginatedNavInvoices,
    paginatedSubmittedInvoices,
    navTotalCount,
    submittedTotalCount,
    getInvoicePartnerName,
    getPartnerTaxNumber,
    getCategoryName,
    getProjectName,
    getPaymentMethodLabel,
  } = useInvoiceFilters(companyId, enabled, dateFromFormatted, dateToFormatted, partners, categories, projects, activeTab, defaultDateBasis);

  // ── Netting detection ──
  const { nettingInvoiceIds, getNettingGroup } = useNettingDetection(paginatedNavInvoices);

  const loading = dataLoading || navLoading || submittedFilterLoading;
  const tabFetching = isSubmittedTab ? submittedFetching : navFetching;

  const hasStandardFilters = useMemo(() => {
    return (
      filters.search !== '' ||
      filters.issueDateFrom !== '' ||
      filters.issueDateTo !== '' ||
      filters.deliveryDateFrom !== '' ||
      filters.deliveryDateTo !== '' ||
      filters.amountMin !== '' ||
      filters.amountMax !== '' ||
      filters.currency !== 'all' ||
      filters.paid !== 'all' ||
      filters.submitted !== 'all' ||
      filters.project !== 'all' ||
      filters.category !== 'all' ||
      filters.paymentMethod !== 'all' ||
      filters.continuous !== 'all' ||
      (filters.vatRate && filters.vatRate !== 'all') ||
      (filters.dateBasis && filters.dateBasis !== defaultDateBasis)
    );
  }, [filters, defaultDateBasis]);
  const hasAnyActiveFilter = hasStandardFilters || kpiFilter !== 'all';

  const handleDateBasisChange = useCallback((newBasis: 'kibocsatas' | 'teljesites') => {
    if (newBasis === filters.dateBasis) return;
    setFilters(prev => ({ ...prev, dateBasis: newBasis }));
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('db', newBasis);
      next.delete('date_basis');
      return next.toString() === prev.toString() ? prev : next;
    }, { replace: true });
  }, [filters.dateBasis, setFilters, setSearchParams]);

  const clearAllFilters = useCallback(() => {
    clearFilters();
    setKpiFilter('all');
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('db');
      next.delete('date_basis');
      return next.toString() === prev.toString() ? prev : next;
    }, { replace: true });
  }, [clearFilters, setKpiFilter, setSearchParams]);

  // ── Auto-open invoice from URL (?invoice=<id>&action=<action>) ──
  const invoiceIdFromUrl = searchParams.get('invoice');
  const actionFromUrl = searchParams.get('action') as InvoiceAction | null;
  const autoOpenedDialogInvoiceIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!invoiceIdFromUrl || !selectedCompany?.id) {
      handledDeepLinkInvoiceRef.current = null;
      autoOpenedDialogInvoiceIdRef.current = null;
      return;
    }

    // Already handled or currently active
    if (
      handledDeepLinkInvoiceRef.current === invoiceIdFromUrl &&
      (!actionFromUrl || autoOpenedDialogInvoiceIdRef.current === invoiceIdFromUrl)
    ) {
      return;
    }

    // Already expanded in UI with no dialog action
    if (expandedRowIds.has(invoiceIdFromUrl) && !actionFromUrl) {
      handledDeepLinkInvoiceRef.current = invoiceIdFromUrl;
      return;
    }

    let cancelled = false;

    const handleNavInvoiceMatch = (navInv: NavInvoice) => {
      if (cancelled) return;

      handledDeepLinkInvoiceRef.current = navInv.id;

      // Switch tab if direction doesn't match current tab
      const currentTab = activeTabRef.current;
      if (navInv.invoice_direction === 'INBOUND' && currentTab !== 'INBOUND') {
        isHandlingDeepLinkRef.current = true;
        setActiveTab('INBOUND', { preserveInvoiceParam: true });
        isHandlingDeepLinkRef.current = false;
      } else if (navInv.invoice_direction === 'OUTBOUND' && currentTab !== 'OUTBOUND') {
        isHandlingDeepLinkRef.current = true;
        setActiveTab('OUTBOUND', { preserveInvoiceParam: true });
        isHandlingDeepLinkRef.current = false;
      }

      setSelectedNavInvoice(navInv);
      setLastViewedInvoiceId(navInv.id);
      setExpandedRowIds(prev => new Set(prev).add(navInv.id));

      if (actionFromUrl === 'items' && autoOpenedDialogInvoiceIdRef.current !== navInv.id) {
        autoOpenedDialogInvoiceIdRef.current = navInv.id;
        setItemsDialogOpen(true);
      }
    };

    // 1. Try finding in loaded nav invoices
    const match = filteredAndSortedNavInvoices.find(inv => inv.id === invoiceIdFromUrl);
    if (match) {
      handleNavInvoiceMatch(match);
      const idx = filteredAndSortedNavInvoices.findIndex(inv => inv.id === invoiceIdFromUrl);
      if (idx !== -1) {
        const targetPage = Math.floor(idx / navPageSize) + 1;
        if (targetPage !== navCurrentPage) {
          setNavCurrentPage(targetPage);
        }
      }
      return;
    }

    // 2. Fallback: fetch from Supabase
    (async () => {
      const { data: navData } = await supabase
        .from('nav_invoices')
        .select('*')
        .eq('id', invoiceIdFromUrl)
        .maybeSingle();

      if (cancelled) return;

      if (navData) {
        handleNavInvoiceMatch(navData as unknown as NavInvoice);
        return;
      }

      // 3. Fallback: check submitted invoices
      const { data: subData } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceIdFromUrl)
        .maybeSingle();

      if (cancelled) return;

      if (subData) {
        const sub = subData as unknown as SubmittedInvoice;
        handledDeepLinkInvoiceRef.current = sub.id;

        const currentTab = activeTabRef.current;
        if (sub.invoice_type === 'outbound' && currentTab !== 'SUBMITTED_OUTBOUND') {
          isHandlingDeepLinkRef.current = true;
          setActiveTab('SUBMITTED_OUTBOUND', { preserveInvoiceParam: true });
          isHandlingDeepLinkRef.current = false;
        } else if (sub.invoice_type !== 'outbound' && currentTab !== 'SUBMITTED_INBOUND') {
          isHandlingDeepLinkRef.current = true;
          setActiveTab('SUBMITTED_INBOUND', { preserveInvoiceParam: true });
          isHandlingDeepLinkRef.current = false;
        }

        setSelectedInvoice(sub);
        setSelectedSubmittedForItems(sub);
        setLastViewedInvoiceId(sub.id);
        setExpandedRowIds(prev => new Set(prev).add(sub.id));

        if (autoOpenedDialogInvoiceIdRef.current !== sub.id) {
          autoOpenedDialogInvoiceIdRef.current = sub.id;
          if (actionFromUrl === 'view') {
            setImageDialogOpen(true);
          } else if (actionFromUrl === 'edit') {
            setEditDialogOpen(true);
          } else if (actionFromUrl === 'items') {
            setSubmittedItemsDialogOpen(true);
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    invoiceIdFromUrl,
    actionFromUrl,
    selectedCompany?.id,
    filteredAndSortedNavInvoices,
    setActiveTab,
    setSelectedNavInvoice,
    setLastViewedInvoiceId,
    setExpandedRowIds,
    setItemsDialogOpen,
    setSelectedInvoice,
    setSelectedSubmittedForItems,
    setImageDialogOpen,
    setEditDialogOpen,
    setSubmittedItemsDialogOpen,
    navPageSize,
    navCurrentPage,
    setNavCurrentPage,
    expandedRowIds,
  ]);

  // ── Sync ALL view state → URL query params ──
  useEffect(() => {
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);

        for (const [key, urlKey] of Object.entries(FILTER_URL_KEYS)) {
          if (key === 'dateBasis') continue;
          next.delete(urlKey);
        }
        next.delete('kpi');
        next.delete('sf');
        next.delete('sd');
        next.delete('p');
        next.delete('ps');

        for (const [key, urlKey] of Object.entries(FILTER_URL_KEYS)) {
          if (key === 'dateBasis') continue;
          const value = filters[key as keyof typeof filters];
          const defValue = defaultFilters[key as keyof typeof defaultFilters];
          if (value !== defValue) {
            next.set(urlKey, value);
          }
        }

        if (kpiFilter !== 'all') next.set('kpi', kpiFilter);
        if (sortField !== 'invoice_issue_date') next.set('sf', sortField);
        if (sortDirection !== 'desc') next.set('sd', sortDirection);

        const currentPage = isSubmittedTab ? submittedCurrentPage : navCurrentPage;
        if (currentPage > 1) next.set('p', String(currentPage));

        const currentPageSize = isSubmittedTab ? submittedPageSize : navPageSize;
        if (currentPageSize !== 50) next.set('ps', String(currentPageSize));

        if (next.toString() === prev.toString()) {
          return prev;
        }

        return next;
      },
      { replace: true }
    );
  }, [
    filters,
    kpiFilter,
    sortField,
    sortDirection,
    navCurrentPage,
    submittedCurrentPage,
    navPageSize,
    submittedPageSize,
    isSubmittedTab,
    setSearchParams,
  ]);

  // ── Bulk Actions state & Selection ──
  const activeSelection = isSubmittedTab ? selectedSubmittedIds : selectedInvoiceIds;
  const activeSetSelected = isSubmittedTab ? setSelectedSubmittedIds : setSelectedInvoiceIds;
  const lastSelectedIdRef = useRef<string | null>(null);

  const toggleSelectRow = useCallback(
    (id: string, shiftKey?: boolean) => {
      const activeList = isSubmittedTab ? paginatedSubmittedInvoices : paginatedNavInvoices;
      activeSetSelected(prev => {
        const next = new Set(prev);
        const currentIdx = activeList.findIndex(inv => inv.id === id);
        const lastIdx =
          lastSelectedIdRef.current !== null
            ? activeList.findIndex(inv => inv.id === lastSelectedIdRef.current)
            : -1;

        if (shiftKey && lastIdx !== -1 && currentIdx !== -1) {
          const start = Math.min(lastIdx, currentIdx);
          const end = Math.max(lastIdx, currentIdx);
          for (let i = start; i <= end; i++) {
            next.add(activeList[i].id);
          }
        } else {
          if (next.has(id)) next.delete(id);
          else next.add(id);
        }

        lastSelectedIdRef.current = id;
        return next;
      });
    },
    [isSubmittedTab, paginatedSubmittedInvoices, paginatedNavInvoices, activeSetSelected]
  );

  const toggleSelectAll = useCallback(() => {
    const activeList = isSubmittedTab ? paginatedSubmittedInvoices : paginatedNavInvoices;
    const allIds = activeList.map(i => i.id);
    const areAllCurrentSelected = allIds.length > 0 && allIds.every(id => activeSelection.has(id));

    activeSetSelected(prev => {
      const next = new Set(prev);
      if (areAllCurrentSelected) {
        allIds.forEach(id => next.delete(id));
      } else {
        allIds.forEach(id => next.add(id));
      }
      return next;
    });
  }, [isSubmittedTab, paginatedSubmittedInvoices, paginatedNavInvoices, activeSelection, activeSetSelected]);

  const isRowSelected = useCallback((id: string) => activeSelection.has(id), [activeSelection]);

  const isAllSelected = useMemo(() => {
    const activeList = isSubmittedTab ? paginatedSubmittedInvoices : paginatedNavInvoices;
    return activeList.length > 0 && activeList.every(i => activeSelection.has(i.id));
  }, [isSubmittedTab, paginatedSubmittedInvoices, paginatedNavInvoices, activeSelection]);

  const isSomeSelected = useMemo(() => {
    const activeList = isSubmittedTab ? paginatedSubmittedInvoices : paginatedNavInvoices;
    return activeList.length > 0 && activeList.some(i => activeSelection.has(i.id)) && !isAllSelected;
  }, [isSubmittedTab, paginatedSubmittedInvoices, paginatedNavInvoices, activeSelection, isAllSelected]);

  const clearSelection = useCallback(() => {
    setSelectedInvoiceIds(new Set());
    setSelectedSubmittedIds(new Set());
    lastSelectedIdRef.current = null;
  }, []);

  // ── Row expansion helpers with URL sync (ADR A-127 compliant) ──
  const toggleRowExpanded = useCallback((id: string) => {
    if (expandUrlTimeoutRef.current) {
      clearTimeout(expandUrlTimeoutRef.current);
      expandUrlTimeoutRef.current = null;
    }

    setExpandedRowIds(prev => {
      const isCurrentlyExpanded = prev.has(id);
      const next = new Set(prev);
      if (isCurrentlyExpanded) {
        next.delete(id);
      } else {
        next.add(id);
      }

      if (isCurrentlyExpanded) {
        // Collapsing: immediately clean from URL if this invoice was in URL
        handledDeepLinkInvoiceRef.current = null;
        autoOpenedDialogInvoiceIdRef.current = null;
        setSearchParams(urlPrev => {
          if (urlPrev.get('invoice') !== id) return urlPrev;
          const urlNext = new URLSearchParams(urlPrev);
          urlNext.delete('invoice');
          urlNext.delete('action');
          return urlNext.toString() === urlPrev.toString() ? urlPrev : urlNext;
        }, { replace: true });
      } else {
        // Expanding: schedule URL update after 180ms CSS grid accordion animation
        handledDeepLinkInvoiceRef.current = id;
        expandUrlTimeoutRef.current = setTimeout(() => {
          setSearchParams(urlPrev => {
            if (urlPrev.get('invoice') === id && !urlPrev.has('action')) return urlPrev;
            const urlNext = new URLSearchParams(urlPrev);
            urlNext.set('invoice', id);
            urlNext.delete('action');
            return urlNext.toString() === urlPrev.toString() ? urlPrev : urlNext;
          }, { replace: true });
        }, 180);
      }

      return next;
    });
  }, [setSearchParams]);

  const expandAllRows = useCallback((ids: string[]) => {
    setExpandedRowIds(new Set(ids));
  }, []);

  const collapseAllRows = useCallback(() => {
    if (expandUrlTimeoutRef.current) {
      clearTimeout(expandUrlTimeoutRef.current);
      expandUrlTimeoutRef.current = null;
    }
    handledDeepLinkInvoiceRef.current = null;
    autoOpenedDialogInvoiceIdRef.current = null;
    setExpandedRowIds(new Set());
    setSearchParams(urlPrev => {
      if (!urlPrev.has('invoice') && !urlPrev.has('action')) return urlPrev;
      const urlNext = new URLSearchParams(urlPrev);
      urlNext.delete('invoice');
      urlNext.delete('action');
      return urlNext.toString() === urlPrev.toString() ? urlPrev : urlNext;
    }, { replace: true });
  }, [setSearchParams]);

  const isAllExpanded = useMemo(() => {
    const activeList = isSubmittedTab ? paginatedSubmittedInvoices : paginatedNavInvoices;
    return activeList.length > 0 && activeList.every(i => expandedRowIds.has(i.id));
  }, [isSubmittedTab, paginatedSubmittedInvoices, paginatedNavInvoices, expandedRowIds]);

  // ── Mutations hook ──
  const {
    syncing,
    canSync,
    cooldownSeconds,
    formatCooldown,
    handleSync,
    handleProjectChange,
    handleCategoryChange,
    handleToggleSubmitted,
    handleExport,
    handleBulkCategoryChange,
    handleBulkProjectChange,
    handleBulkDeleteSubmitted,
  } = useInvoiceMutations({
    companyId,
    selectedCompany,
    invalidateInvoiceData,
    selectedInvoiceIds: activeSelection,
    setSelectedInvoiceIds: activeSetSelected,
    filteredAndSortedNavInvoices,
    filteredAndSortedSubmittedInvoices,
    getInvoicePartnerName,
    getPartnerTaxNumber,
    getCategoryName,
    getProjectName,
    isSubmittedTab,
  });

  // ── PDF Export hook ──
  const pdfExport = usePdfExport();

  // ── CSV / XLSX / PDF Data Export Dialog state ──
  const [dataExportDialogOpen, setDataExportDialogOpen] = useState(false);
  const [dataExportFormat, setDataExportFormat] = useState<'csv' | 'xlsx' | 'pdf'>('xlsx');
  const [dataExportLevel, setDataExportLevel] = useState<ExportLevel>('summary');

  const openDataExportDialog = useCallback((format: 'csv' | 'xlsx' | 'pdf' = 'xlsx', level: ExportLevel = 'summary') => {
    setDataExportFormat(format);
    setDataExportLevel(level);
    setDataExportDialogOpen(true);
  }, []);

  const exportableInvoices = useMemo<ExportableInvoice[]>(() => {
    if (isSubmittedTab) {
      return filteredAndSortedSubmittedInvoices.map(inv => ({
        id: inv.id,
        invoice_number: inv.bizonylatsorszam || 'Nincs sorszám',
        direction: inv.invoice_direction === 'OUTBOUND' ? 'OUTBOUND' : 'INBOUND',
        partner_name: inv.invoice_direction === 'OUTBOUND' ? inv.vevo_nev || '–' : inv.elado_nev || '–',
        partner_tax_number: inv.invoice_direction === 'OUTBOUND' ? (inv.vevo_vat_id || undefined) : (inv.elado_vat_id || undefined),
        issue_date: inv.kibocsatas_datuma || '',
        delivery_date: inv.teljesites_datuma || '',
        due_date: (inv as any).fizetesi_hatarido || '',
        payment_date: (inv as any).manual_payment_date || null,
        transaction_id: (inv as any).transaction_id || null,
        payment_method: inv.fizetesi_mod || '',
        net_amount: inv.adoalap_osszesen || 0,
        gross_amount: inv.brutto_vegosszeg || 0,
        vat_amount: inv.afa_osszeg_osszesen || 0,
        currency: inv.penznem || 'HUF',
        paid: (inv as any).fizetve ?? (inv.match_status === 'paid'),
        match_status: inv.match_status,
        paid_amount: inv.paid_amount,
        remaining_amount: inv.remaining_amount,
        category_name: getCategoryName(inv.category_id),
        project_name: getProjectName(inv.project_id),
        image_url: inv.image_url,
        melleklet_url: inv.melleklet_url,
        source: 'submitted',
      }));
    }

    return filteredAndSortedNavInvoices.map(inv => {
      const pairedSub = filteredAndSortedSubmittedInvoices.find(s => isNavAndSubmittedInvoiceMatch(inv, s));

      return {
        id: inv.id,
        invoice_number: inv.invoice_number || 'Nincs sorszám',
        direction: inv.invoice_direction === 'OUTBOUND' ? 'OUTBOUND' : 'INBOUND',
        partner_name: getInvoicePartnerName(inv),
        partner_tax_number: getPartnerTaxNumber(inv),
        issue_date: inv.invoice_issue_date || '',
        delivery_date: inv.invoice_delivery_date || '',
        due_date: inv.payment_date || '',
        payment_date: (inv as any).manual_payment_date || null,
        transaction_id: inv.transaction_id || null,
        payment_method: inv.payment_method || '',
        net_amount: inv.invoice_net_amount || 0,
        gross_amount: inv.invoice_gross_amount || 0,
        vat_amount: inv.invoice_vat_amount || 0,
        currency: inv.currency || 'HUF',
        paid: inv.paid ?? (inv.match_status === 'paid'),
        match_status: inv.match_status,
        paid_amount: inv.paid_amount,
        remaining_amount: inv.remaining_amount,
        submitted: inv.submitted,
        project_name: getProjectName(inv.project_id),
        image_url: (inv as any).image_url || pairedSub?.image_url,
        melleklet_url: (inv as any).melleklet_url || pairedSub?.melleklet_url,
        source: 'nav',
      };
    });
  }, [
    isSubmittedTab,
    filteredAndSortedSubmittedInvoices,
    filteredAndSortedNavInvoices,
    getCategoryName,
    getProjectName,
    getInvoicePartnerName,
    getPartnerTaxNumber,
  ]);

  const handleDataExportConfirm = useCallback(
    async (
      selectedInvoices: ExportableInvoice[],
      format: 'csv' | 'xlsx' | 'pdf',
      exportLevel: ExportLevel = 'summary',
      sheetLayout: ExportSheetLayout = 'single'
    ) => {
      // 1. Batch resolve bank transactions for accurate payment date and tab routing
      const directTxIds = selectedInvoices.map(i => i.transaction_id).filter(Boolean) as string[];
      const invoiceIds = selectedInvoices.map(i => i.id);
      const txDateMap = new Map<string, string>(); // invoice_id -> transaction_date

      if (directTxIds.length > 0) {
        const { data: txData } = await supabase
          .from('transactions')
          .select('id, transaction_date')
          .in('id', directTxIds);
        const idToDate = new Map((txData || []).map(t => [t.id, t.transaction_date]));
        selectedInvoices.forEach(inv => {
          if (inv.transaction_id && idToDate.has(inv.transaction_id)) {
            txDateMap.set(inv.id, idToDate.get(inv.transaction_id)!);
          }
        });
      }

      if (invoiceIds.length > 0) {
        const { data: multiMatches } = await supabase
          .from('transaction_invoice_matches')
          .select('invoice_id, transactions:transaction_id (transaction_date)')
          .in('invoice_id', invoiceIds);
        (multiMatches || []).forEach((mm: any) => {
          if (mm.transactions?.transaction_date && !txDateMap.has(mm.invoice_id)) {
            txDateMap.set(mm.invoice_id, mm.transactions.transaction_date);
          }
        });
      }

      const getPaymentDateDisplay = (inv: ExportableInvoice) => {
        const txDate = txDateMap.get(inv.id);
        if (txDate) return txDate;
        if (inv.payment_date) return inv.payment_date;
        if (inv.paid || inv.match_status === 'paid') {
          return inv.due_date || 'Fizetve';
        }
        if (inv.match_status === 'partially_paid') {
          return 'Részben fizetve';
        }
        return '—';
      };

      const isBankOrCard = (inv: ExportableInvoice) => {
        if (txDateMap.has(inv.id) || inv.transaction_id) return true;
        const p = (inv.payment_method || '').toLowerCase();
        return (
          p.includes('átutalás') ||
          p.includes('transfer') ||
          p.includes('bankkártya') ||
          p.includes('card') ||
          p.includes('kártya') ||
          p.includes('utalás') ||
          p.includes('beszedés') ||
          p.includes('sepa') ||
          p.includes('direct debit') ||
          p.includes('bank')
        );
      };

      const isCashOrPetty = (inv: ExportableInvoice) => {
        const p = (inv.payment_method || '').toLowerCase();
        return p.includes('készpénz') || p.includes('cash') || p.includes('kp') || p.includes('házipénztár') || p.includes('penztar');
      };

      if (format === 'pdf' && exportLevel === 'itemized_posting') {
        if (!selectedCompany?.id) return;
        const dates = selectedInvoices.map(i => i.issue_date).filter(Boolean).sort();
        const dateFrom = dates[0] || new Date().toISOString().split('T')[0];
        const dateTo = dates[dates.length - 1] || new Date().toISOString().split('T')[0];

        const invoiceList = selectedInvoices.map(inv => ({
          id: inv.id,
          name: inv.invoice_number,
          url: inv.image_url || inv.melleklet_url || '',
          source: inv.source || 'submitted',
        }));

        await pdfExport.startExport({
          dateFrom,
          dateTo,
          exportMode: 'posting_slips',
          includePostingSlips: true,
          invoiceList,
        });
        return;
      }

      if (exportLevel === 'itemized_posting') {
        const navIds = selectedInvoices.filter(i => i.source === 'nav').map(i => i.id);
        const subIds = selectedInvoices.filter(i => i.source === 'submitted').map(i => i.id);

        const navItemsMap = new Map<string, any[]>();
        const subItemsMap = new Map<string, any[]>();

        if (navIds.length > 0) {
          const { data: navItems } = await supabase
            .from('nav_invoice_items')
            .select('*')
            .in('nav_invoice_id', navIds);
          (navItems || []).forEach(item => {
            const list = navItemsMap.get(item.nav_invoice_id) || [];
            list.push(item);
            navItemsMap.set(item.nav_invoice_id, list);
          });
        }

        if (subIds.length > 0) {
          const { data: subItems } = await supabase
            .from('invoice_items')
            .select('*')
            .in('invoice_id', subIds);
          (subItems || []).forEach(item => {
            const list = subItemsMap.get(item.invoice_id) || [];
            list.push(item);
            subItemsMap.set(item.invoice_id, list);
          });
        }

        const tabFilePrefixMap: Record<InvoiceTab, string> = {
          INBOUND: 'bejovo_szamlak',
          OUTBOUND: 'kimeno_szamlak',
          SUBMITTED_INBOUND: 'bekuldott_bejovo_szamlak',
          SUBMITTED_OUTBOUND: 'bekuldott_kimeno_szamlak',
        };

        const tabLabelMap: Record<InvoiceTab, string> = {
          INBOUND: 'NAV OSA Bejövő',
          OUTBOUND: 'NAV OSA Kimenő',
          SUBMITTED_INBOUND: 'Számlakép (Bejövő)',
          SUBMITTED_OUTBOUND: 'Számlakép (Kimenő)',
        };

        const headers = [
          'Számlaszám',
          'Irány',
          'Partner neve',
          'Adószám',
          'Kibocsátás',
          'Teljesítés',
          'Fizetési határidő',
          'Fizetés dátuma',
          'Tétel sorszám',
          'Tétel megnevezése',
          'Mennyiség',
          'Mennyiségi egység',
          'Pénznem',
          'Nettó egységár (deviza)',
          'Nettó összeg (deviza)',
          'ÁFA kulcs',
          'ÁFA összeg (deviza)',
          'Bruttó összeg (deviza)',
          'Kategória',
          'Projekt',
          'Beküldve',
        ];

        const buildItemizedRows = (invoices: ExportableInvoice[]) => {
          const r: (string | number | boolean | null | undefined)[][] = [];
          invoices.forEach(inv => {
            const items = inv.source === 'nav' ? navItemsMap.get(inv.id) || [] : subItemsMap.get(inv.id) || [];

            if (items.length === 0) {
              r.push([
                inv.invoice_number,
                inv.direction === 'OUTBOUND' ? 'Kimenő' : 'Bejövő',
                inv.partner_name,
                inv.partner_tax_number || '',
                inv.issue_date,
                inv.delivery_date,
                inv.due_date || '—',
                getPaymentDateDisplay(inv),
                1,
                'Főszámla összesítő (nincs tételes adat)',
                1,
                'db',
                inv.currency,
                inv.net_amount,
                inv.net_amount,
                '-',
                inv.vat_amount,
                inv.gross_amount,
                inv.category_name || '',
                inv.project_name || '',
                inv.submitted ? 'Igen' : 'Nem',
              ]);
            } else {
              items.forEach((item, idx) => {
                const itemName = item.line_description || item.megnevezes || item.product_name || `Tétel #${idx + 1}`;
                const qty = item.quantity || item.mennyiseg || 1;
                const unit = item.unit_of_measure || item.mennyisegi_egyseg || 'db';
                const netUnit = item.unit_price || item.netto_egysegar || (qty > 0 ? (item.net_amount || item.netto_ar || 0) / qty : 0);
                const netTotal = item.net_amount || item.netto_ar || 0;
                const vatRate = item.vat_percentage != null ? `${item.vat_percentage}%` : (item.afa_kulcs != null ? `${item.afa_kulcs}%` : '-');
                const vatAmount = item.vat_amount || item.afa_ertek || 0;
                const grossTotal = item.gross_amount || item.brutto_ar || (netTotal + vatAmount);

                r.push([
                  inv.invoice_number,
                  inv.direction === 'OUTBOUND' ? 'Kimenő' : 'Bejövő',
                  inv.partner_name,
                  inv.partner_tax_number || '',
                  inv.issue_date,
                  inv.delivery_date,
                  inv.due_date || '—',
                  getPaymentDateDisplay(inv),
                  idx + 1,
                  itemName,
                  qty,
                  unit,
                  inv.currency,
                  netUnit,
                  netTotal,
                  vatRate,
                  vatAmount,
                  grossTotal,
                  inv.category_name || '',
                  inv.project_name || '',
                  inv.submitted ? 'Igen' : 'Nem',
                ]);
              });
            }
          });
          return r;
        };

        const tabPrefix = tabFilePrefixMap[activeTab] || 'szamlak';
        const safeCompanyName = (selectedCompany?.name || 'ceg').replace(/[^a-zA-Z0-9áéíóöőúüűÁÉÍÓÖŐÚÜŰ_-]/g, '_');
        const dateStr = new Date().toISOString().split('T')[0];
        const filename = `teteles_kontirozo_${tabPrefix}_${safeCompanyName}_${dateStr}.${format}`;

        if (sheetLayout === 'by_payment_method' && format === 'xlsx') {
          const bankInvoices = selectedInvoices.filter(i => isBankOrCard(i));
          const cashInvoices = selectedInvoices.filter(i => !isBankOrCard(i) && isCashOrPetty(i));
          const otherInvoices = selectedInvoices.filter(i => !isBankOrCard(i) && !isCashOrPetty(i));

          const tables = [
            {
              title: 'Utalás és bankkártya',
              headers,
              rows: buildItemizedRows(bankInvoices),
            },
            {
              title: 'Készpénz és házipénztár',
              headers,
              rows: buildItemizedRows(cashInvoices),
            },
          ];

          if (otherInvoices.length > 0) {
            tables.push({
              title: 'Egyéb bizonylatok',
              headers,
              rows: buildItemizedRows(otherInvoices),
            });
          }

          await exportMultiTableDocument(
            {
              title: `Tételes Kontírozó Export (${tabLabelMap[activeTab] || 'Számlák'})`,
              companyName: selectedCompany?.name,
              filename,
              tables,
            },
            'xlsx',
            `Tételes Kontírozó Export (${tabLabelMap[activeTab] || 'Számlák'})`
          );
          return;
        }

        const rows = buildItemizedRows(selectedInvoices);
        await exportToFile(headers, rows, format, filename, `Tételes Kontírozó Export (${tabLabelMap[activeTab] || 'Számlák'})`);
        return;
      }

      // Summary Export
      const tabFilePrefixMap: Record<InvoiceTab, string> = {
        INBOUND: 'bejovo_szamlak',
        OUTBOUND: 'kimeno_szamlak',
        SUBMITTED_INBOUND: 'bekuldott_bejovo_szamlak',
        SUBMITTED_OUTBOUND: 'bekuldott_kimeno_szamlak',
      };

      const tabLabelMap: Record<InvoiceTab, string> = {
        INBOUND: 'NAV OSA Bejövő',
        OUTBOUND: 'NAV OSA Kimenő',
        SUBMITTED_INBOUND: 'Számlakép (Bejövő)',
        SUBMITTED_OUTBOUND: 'Számlakép (Kimenő)',
      };

      const headers = [
        'Számlaszám',
        'Irány',
        'Partner neve',
        'Partner adószáma',
        'Kibocsátás kelte',
        'Teljesítés kelte',
        'Fizetési határidő',
        'Fizetés dátuma',
        'Pénznem',
        'Nettó összeg (deviza)',
        'ÁFA összeg (deviza)',
        'Bruttó összeg (deviza)',
        'Kategória',
        'Projekt',
        'Beküldve',
        'Forrás',
      ];

      const buildSummaryRows = (invoices: ExportableInvoice[]) => {
        return invoices.map(inv => [
          inv.invoice_number,
          inv.direction === 'OUTBOUND' ? 'Kimenő' : 'Bejövő',
          inv.partner_name,
          inv.partner_tax_number || '',
          inv.issue_date,
          inv.delivery_date,
          inv.due_date || '—',
          getPaymentDateDisplay(inv),
          inv.currency,
          inv.net_amount,
          inv.vat_amount,
          inv.gross_amount,
          inv.category_name || '',
          inv.project_name || '',
          inv.submitted ? 'Igen' : 'Nem',
          inv.source === 'nav' ? 'NAV Online' : 'Feltöltött bizonylat',
        ]);
      };

      const tabPrefix = tabFilePrefixMap[activeTab] || 'szamlak';
      const safeCompanyName = (selectedCompany?.name || 'ceg').replace(/[^a-zA-Z0-9áéíóöőúüűÁÉÍÓÖŐÚÜŰ_-]/g, '_');
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `${tabPrefix}_export_${safeCompanyName}_${dateStr}.${format}`;

      if (sheetLayout === 'by_payment_method' && format === 'xlsx') {
        const bankInvoices = selectedInvoices.filter(i => isBankOrCard(i));
        const cashInvoices = selectedInvoices.filter(i => !isBankOrCard(i) && isCashOrPetty(i));
        const otherInvoices = selectedInvoices.filter(i => !isBankOrCard(i) && !isCashOrPetty(i));

        const tables = [
          {
            title: 'Utalás és bankkártya',
            headers,
            rows: buildSummaryRows(bankInvoices),
          },
          {
            title: 'Készpénz és házipénztár',
            headers,
            rows: buildSummaryRows(cashInvoices),
          },
        ];

        if (otherInvoices.length > 0) {
          tables.push({
            title: 'Egyéb bizonylatok',
            headers,
            rows: buildSummaryRows(otherInvoices),
          });
        }

        await exportMultiTableDocument(
          {
            title: `${tabLabelMap[activeTab] || 'Számlák'} Exportálása`,
            companyName: selectedCompany?.name,
            filename,
            tables,
          },
          'xlsx',
          `${tabLabelMap[activeTab] || 'Számlák'} Exportálása`
        );
        return;
      }

      const rows = buildSummaryRows(selectedInvoices);
      await exportToFile(headers, rows, format, filename, `${tabLabelMap[activeTab] || 'Számlák'} Exportálása`);
    },
    [selectedCompany, pdfExport, activeTab]
  );

  // Subcontext 1: Filter Context Value
  const filterValue = useMemo<InvoiceFilterContextValue>(
    () => ({
      filters,
      setFilters,
      setDateBasis: handleDateBasisChange,
      clearFilters,
      hasStandardFilters,
      hasAnyActiveFilter,
      clearAllFilters,
      kpiFilter,
      setKpiFilter,
      toggleKpiFilter,
      invoiceKpis,
      isKpisLoading,
      sortField,
      sortDirection,
      handleSort,
    }),
    [
      filters,
      setFilters,
      handleDateBasisChange,
      clearFilters,
      hasStandardFilters,
      hasAnyActiveFilter,
      clearAllFilters,
      kpiFilter,
      setKpiFilter,
      toggleKpiFilter,
      invoiceKpis,
      isKpisLoading,
      sortField,
      sortDirection,
      handleSort,
    ]
  );

  // Subcontext 2: Pagination Context Value
  const paginationValue = useMemo<InvoicePaginationContextValue>(
    () => ({
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
      filteredAndSortedNavInvoices,
      filteredAndSortedSubmittedInvoices,
      paginatedNavInvoices,
      paginatedSubmittedInvoices,
      navTotalCount,
      submittedTotalCount,
    }),
    [
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
      filteredAndSortedNavInvoices,
      filteredAndSortedSubmittedInvoices,
      paginatedNavInvoices,
      paginatedSubmittedInvoices,
      navTotalCount,
      submittedTotalCount,
    ]
  );

  // Subcontext 3: Selection Context Value
  const selectionValue = useMemo<InvoiceSelectionContextValue>(
    () => ({
      selectedInvoiceIds,
      setSelectedInvoiceIds,
      selectedSubmittedIds,
      setSelectedSubmittedIds,
      activeSelection,
      activeSetSelected,
      toggleSelectAll,
      toggleSelectRow,
      isRowSelected,
      isAllSelected,
      isSomeSelected,
      clearSelection,
      expandedRowIds,
      setExpandedRowIds,
      toggleRowExpanded,
      expandAllRows,
      collapseAllRows,
      isAllExpanded,
    }),
    [
      selectedInvoiceIds,
      setSelectedInvoiceIds,
      selectedSubmittedIds,
      setSelectedSubmittedIds,
      activeSelection,
      activeSetSelected,
      toggleSelectAll,
      toggleSelectRow,
      isRowSelected,
      isAllSelected,
      isSomeSelected,
      clearSelection,
      expandedRowIds,
      setExpandedRowIds,
      toggleRowExpanded,
      expandAllRows,
      collapseAllRows,
      isAllExpanded,
    ]
  );

  // Unified Context Value
  const unifiedValue = useMemo<InvoiceContextValue>(
    () => ({
      ...filterValue,
      ...paginationValue,
      ...selectionValue,

      companyId,
      selectedCompany,
      writable,

      tabSlug,
      setTabSlug,
      activeTab,
      setActiveTab,
      isSubmittedTab,

      submittedInvoices,
      linkedInvoicesPool,
      linkedInvoicesLoading,
      linkedInvoicesMap,
      partners,
      categories,
      projects,
      navIdToCourierReportsMap,
      trxIdToCourierReportsMap,
      dataLoading,
      credentialsExist,
      invalidateInvoiceData,
      loading,
      tabFetching,

      getInvoicePartnerName,
      getPartnerTaxNumber,
      getCategoryName,
      getProjectName,
      getPaymentMethodLabel,

      nettingInvoiceIds,
      getNettingGroup,

      imageDialogOpen,
      setImageDialogOpen,
      editDialogOpen,
      setEditDialogOpen,
      createDialogOpen,
      setCreateDialogOpen,
      itemsDialogOpen,
      setItemsDialogOpen,
      submittedItemsDialogOpen,
      setSubmittedItemsDialogOpen,
      filesDialogOpen,
      setFilesDialogOpen,
      syncDialogOpen,
      setSyncDialogOpen,
      bulkDeleteDialogOpen,
      setBulkDeleteDialogOpen,
      approvalDialogOpen,
      setApprovalDialogOpen,
      suggestedLinkDialogOpen,
      setSuggestedLinkDialogOpen,

      selectedInvoice,
      setSelectedInvoice,
      selectedNavInvoice,
      setSelectedNavInvoice,
      selectedSubmittedForItems,
      setSelectedSubmittedForItems,
      selectedInvoiceForApproval,
      setSelectedInvoiceForApproval,
      selectedSuggestedLinkPair,
      setSelectedSuggestedLinkPair,
      setInvoiceParam,
      lastViewedInvoiceId,
      setLastViewedInvoiceId,

      pdfExport,
      dataExportDialogOpen,
      setDataExportDialogOpen,
      dataExportFormat,
      setDataExportFormat,
      dataExportLevel,
      setDataExportLevel,
      openDataExportDialog,
      handleDataExportConfirm,
      exportableInvoices,

      syncing,
      canSync,
      cooldownSeconds,
      formatCooldown,
      handleSync,
      handleProjectChange,
      handleCategoryChange,
      handleToggleSubmitted,
      handleExport,
      handleBulkCategoryChange,
      handleBulkProjectChange,
      handleBulkDeleteSubmitted,
    }),
    [
      filterValue,
      paginationValue,
      selectionValue,
      companyId,
      selectedCompany,
      writable,
      tabSlug,
      setTabSlug,
      activeTab,
      setActiveTab,
      isSubmittedTab,
      submittedInvoices,
      linkedInvoicesPool,
      linkedInvoicesLoading,
      linkedInvoicesMap,
      partners,
      categories,
      projects,
      navIdToCourierReportsMap,
      trxIdToCourierReportsMap,
      dataLoading,
      credentialsExist,
      invalidateInvoiceData,
      loading,
      tabFetching,
      getInvoicePartnerName,
      getPartnerTaxNumber,
      getCategoryName,
      getProjectName,
      getPaymentMethodLabel,
      nettingInvoiceIds,
      getNettingGroup,
      imageDialogOpen,
      setImageDialogOpen,
      editDialogOpen,
      setEditDialogOpen,
      createDialogOpen,
      setCreateDialogOpen,
      itemsDialogOpen,
      setItemsDialogOpen,
      submittedItemsDialogOpen,
      setSubmittedItemsDialogOpen,
      filesDialogOpen,
      setFilesDialogOpen,
      syncDialogOpen,
      setSyncDialogOpen,
      bulkDeleteDialogOpen,
      setBulkDeleteDialogOpen,
      approvalDialogOpen,
      setApprovalDialogOpen,
      suggestedLinkDialogOpen,
      setSuggestedLinkDialogOpen,
      selectedInvoice,
      setSelectedInvoice,
      lastViewedInvoiceId,
      setLastViewedInvoiceId,
      selectedNavInvoice,
      setSelectedNavInvoice,
      selectedSubmittedForItems,
      setSelectedSubmittedForItems,
      selectedInvoiceForApproval,
      setSelectedInvoiceForApproval,
      selectedSuggestedLinkPair,
      setSelectedSuggestedLinkPair,
      setInvoiceParam,
      pdfExport,
      dataExportDialogOpen,
      setDataExportDialogOpen,
      dataExportFormat,
      setDataExportFormat,
      dataExportLevel,
      setDataExportLevel,
      openDataExportDialog,
      handleDataExportConfirm,
      exportableInvoices,
      syncing,
      canSync,
      cooldownSeconds,
      formatCooldown,
      handleSync,
      handleProjectChange,
      handleCategoryChange,
      handleToggleSubmitted,
      handleExport,
      handleBulkCategoryChange,
      handleBulkProjectChange,
      handleBulkDeleteSubmitted,
    ]
  );

  return (
    <InvoiceFilterProvider value={filterValue}>
      <InvoicePaginationProvider value={paginationValue}>
        <InvoiceSelectionProvider value={selectionValue}>
          <InvoiceContext.Provider value={unifiedValue}>{children}</InvoiceContext.Provider>
        </InvoiceSelectionProvider>
      </InvoicePaginationProvider>
    </InvoiceFilterProvider>
  );
}

export { useInvoiceFilterContext } from './InvoiceFilterContext';
export { useInvoicePaginationContext } from './InvoicePaginationContext';
export { useInvoiceSelectionContext } from './InvoiceSelectionContext';
export { useInvoiceContext } from './useInvoiceContext';
export type { InvoiceFilterContextValue } from './InvoiceFilterContext';
export type { InvoicePaginationContextValue } from './InvoicePaginationContext';
export type { InvoiceSelectionContextValue } from './InvoiceSelectionContext';
