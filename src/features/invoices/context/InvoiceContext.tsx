import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useDateRange } from '@/contexts/DateRangeContext';
import { useEaisybillPermissions } from '@/hooks/useEaisybillPermissions';
import { useInvoiceData } from '@/hooks/useInvoiceData';
import { useInvoiceFilters, FILTER_URL_KEYS, defaultFilters } from '@/hooks/useInvoiceFilters';
import { useInvoiceMutations } from '@/hooks/useInvoiceMutations';
import { useUrlTab } from '@/lib/navigation';
import { useNettingDetection } from '@/hooks/useNettingDetection';
import { usePdfExport } from '@/hooks/usePdfExport';
import { isNavAndSubmittedInvoiceMatch } from '@/lib/invoiceMatchingUtils';
import { exportToFile } from '@/lib/exportUtils';
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
  TabSlug,
  InvoiceAction,
} from '../types';
import { TAB_SLUGS, SLUG_TO_TAB, TAB_TO_SLUG } from '../types';
import type { SuggestedSubmittedInvoiceWithScore } from '../utils/invoiceRelations';

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
  setActiveTab: (tab: InvoiceTab) => void;
  isSubmittedTab: boolean;

  // Data & loading
  submittedInvoices: SubmittedInvoice[];
  linkedInvoicesPool: SubmittedInvoice[];
  linkedInvoicesLoading: boolean;
  partners: Partner[];
  categories: Category[];
  projects: Project[];
  navIdToCourierReportsMap: Map<string, any[]>;
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
  setInvoiceParam: (invoiceId: string | null, action?: InvoiceAction) => void;

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
    exportLevel?: ExportLevel
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
  handleBulkDeleteSubmitted: () => Promise<void>;
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
  const [tabSlug, setTabSlug] = useUrlTab('invoices', 'outbound_nav' as TabSlug, TAB_SLUGS);
  const activeTab: InvoiceTab = SLUG_TO_TAB[tabSlug as TabSlug] || 'OUTBOUND';
  const setActiveTab = useCallback((tab: InvoiceTab) => setTabSlug(TAB_TO_SLUG[tab]), [setTabSlug]);

  // Dialog states
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
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
  const setInvoiceParam = useCallback((invoiceId: string | null, action: InvoiceAction = 'items') => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (invoiceId) {
        if (next.get('invoice') === invoiceId && next.get('action') === action) {
          return prev;
        }
        next.set('invoice', invoiceId);
        next.set('action', action);
      } else {
        const currentInvoiceId = next.get('invoice');
        const rowIsExpanded = currentInvoiceId ? expandedRowIds.has(currentInvoiceId) : false;
        const hadAction = next.has('action');
        next.delete('action');
        if (!rowIsExpanded) next.delete('invoice');
        if (!hadAction && (!currentInvoiceId || rowIsExpanded)) {
          return prev;
        }
      }
      return next.toString() === prev.toString() ? prev : next;
    }, { replace: true });
  }, [setSearchParams, expandedRowIds]);

  // ── Data hook ──
  const {
    submittedInvoices,
    linkedInvoicesPool,
    linkedInvoicesLoading,
    partners,
    categories,
    projects,
    navIdToCourierReportsMap,
    loading: dataLoading,
    credentialsExist,
    invalidateInvoiceData,
  } = useInvoiceData(companyId, enabled, dateFromFormatted, dateToFormatted, selectedCompany?.id);

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
  } = useInvoiceFilters(companyId, enabled, dateFromFormatted, dateToFormatted, partners, categories, projects, activeTab);

  // ── Netting detection ──
  const { nettingInvoiceIds, getNettingGroup } = useNettingDetection(paginatedNavInvoices);

  const loading = dataLoading || navLoading || submittedFilterLoading;
  const tabFetching = isSubmittedTab ? submittedFetching : navFetching;

  const hasStandardFilters = useMemo(() => {
    return (
      filters.search !== '' ||
      filters.issueDateFrom !== '' ||
      filters.issueDateTo !== '' ||
      filters.amountMin !== '' ||
      filters.amountMax !== '' ||
      filters.currency !== 'all' ||
      filters.paid !== 'all' ||
      filters.submitted !== 'all' ||
      filters.project !== 'all' ||
      filters.category !== 'all' ||
      filters.paymentMethod !== 'all' ||
      filters.continuous !== 'all'
    );
  }, [filters]);
  const hasAnyActiveFilter = hasStandardFilters || kpiFilter !== 'all';

  const clearAllFilters = useCallback(() => {
    clearFilters();
    setKpiFilter('all');
  }, [clearFilters, setKpiFilter]);

  // ── Sync ALL view state → URL query params ──
  useEffect(() => {
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);

        for (const urlKey of Object.values(FILTER_URL_KEYS)) {
          next.delete(urlKey);
        }
        next.delete('kpi');
        next.delete('sf');
        next.delete('sd');
        next.delete('p');
        next.delete('ps');

        for (const [key, urlKey] of Object.entries(FILTER_URL_KEYS)) {
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

  const toggleSelectRow = useCallback(
    (id: string) => {
      activeSetSelected(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [activeSetSelected]
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

  // ── Row expansion helpers ──
  const toggleRowExpanded = useCallback((id: string) => {
    setExpandedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAllRows = useCallback((ids: string[]) => {
    setExpandedRowIds(new Set(ids));
  }, []);

  const collapseAllRows = useCallback(() => {
    setExpandedRowIds(new Set());
  }, []);

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
        issue_date: inv.kibocsatas_datuma || '',
        delivery_date: inv.teljesites_datuma || '',
        net_amount: inv.adoalap_osszesen || 0,
        gross_amount: inv.brutto_vegosszeg || 0,
        vat_amount: inv.afa_osszeg_osszesen || 0,
        currency: inv.penznem || 'HUF',
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
        net_amount: inv.invoice_net_amount || 0,
        gross_amount: inv.invoice_gross_amount || 0,
        vat_amount: inv.invoice_vat_amount || 0,
        currency: inv.currency || 'HUF',
        paid: inv.paid,
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
      exportLevel: ExportLevel = 'summary'
    ) => {
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

        const headers = [
          'Számlaszám',
          'Irány',
          'Partner neve',
          'Adószám',
          'Kibocsátás',
          'Teljesítés',
          'Tétel sorszám',
          'Tétel megnevezése',
          'Mennyiség',
          'Mennyiségi egység',
          'Nettó egységár',
          'Nettó összeg',
          'ÁFA kulcs',
          'ÁFA összeg',
          'Bruttó összeg',
          'Pénznem',
          'Kategória',
          'Projekt',
          'Fizetve',
          'Beküldve',
        ];

        const rows: (string | number | boolean | null | undefined)[][] = [];

        selectedInvoices.forEach(inv => {
          const items = inv.source === 'nav' ? navItemsMap.get(inv.id) || [] : subItemsMap.get(inv.id) || [];

          if (items.length === 0) {
            rows.push([
              inv.invoice_number,
              inv.direction === 'OUTBOUND' ? 'Kimenő' : 'Bejövő',
              inv.partner_name,
              inv.partner_tax_number || '',
              inv.issue_date,
              inv.delivery_date,
              1,
              'Főszámla összesítő (nincs tételes adat)',
              1,
              'db',
              inv.net_amount,
              inv.net_amount,
              '-',
              inv.vat_amount,
              inv.gross_amount,
              inv.currency,
              inv.category_name || '',
              inv.project_name || '',
              inv.match_status === 'partially_paid' ? 'Részben fizetve' : (inv.paid ? 'Igen' : 'Nem'),
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

              rows.push([
                inv.invoice_number,
                inv.direction === 'OUTBOUND' ? 'Kimenő' : 'Bejövő',
                inv.partner_name,
                inv.partner_tax_number || '',
                inv.issue_date,
                inv.delivery_date,
                idx + 1,
                itemName,
                qty,
                unit,
                netUnit,
                netTotal,
                vatRate,
                vatAmount,
                grossTotal,
                inv.currency,
                inv.category_name || '',
                inv.project_name || '',
                inv.match_status === 'partially_paid' ? 'Részben fizetve' : (inv.paid ? 'Igen' : 'Nem'),
                inv.submitted ? 'Igen' : 'Nem',
              ]);
            });
          }
        });

        const filename = `teteles_kontirozo_export_${selectedCompany?.name || 'ceg'}_${new Date().toISOString().split('T')[0]}`;
        await exportToFile(headers, rows, format, filename, 'Tételes Kontírozó Export');
        return;
      }

      // Summary Export
      const headers = [
        'Számlaszám',
        'Irány',
        'Partner neve',
        'Partner adószáma',
        'Kibocsátás kelte',
        'Teljesítés kelte',
        'Nettó összeg',
        'ÁFA összeg',
        'Bruttó összeg',
        'Pénznem',
        'Kategória',
        'Projekt',
        'Fizetve',
        'Beküldve',
        'Forrás',
      ];

      const rows = selectedInvoices.map(inv => [
        inv.invoice_number,
        inv.direction === 'OUTBOUND' ? 'Kimenő' : 'Bejövő',
        inv.partner_name,
        inv.partner_tax_number || '',
        inv.issue_date,
        inv.delivery_date,
        inv.net_amount,
        inv.vat_amount,
        inv.gross_amount,
        inv.currency,
        inv.category_name || '',
        inv.project_name || '',
        inv.match_status === 'partially_paid' ? 'Részben fizetve' : (inv.paid ? 'Igen' : 'Nem'),
        inv.submitted ? 'Igen' : 'Nem',
        inv.source === 'nav' ? 'NAV Online' : 'Feltöltött bizonylat',
      ]);

      const filename = `szamlak_export_${selectedCompany?.name || 'ceg'}_${new Date().toISOString().split('T')[0]}`;
      await exportToFile(headers, rows, format, filename, 'Számlák Exportálása');
    },
    [selectedCompany, pdfExport]
  );

  // Subcontext 1: Filter Context Value
  const filterValue = useMemo<InvoiceFilterContextValue>(
    () => ({
      filters,
      setFilters,
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
      partners,
      categories,
      projects,
      navIdToCourierReportsMap,
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
      partners,
      categories,
      projects,
      navIdToCourierReportsMap,
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
