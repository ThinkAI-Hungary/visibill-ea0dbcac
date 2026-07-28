import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { useDateRange } from '@/contexts/DateRangeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { cn, formatCurrency } from '@/lib/utils';
import { Search, Download, ArrowUpDown, FileText, FileSpreadsheet, FileDown, X, ChevronDown, Info, Pencil, Package, RotateCcw, CalendarIcon, ChevronsUpDown, ChevronsDownUp, Link2, Link2Off, Lightbulb, Scale } from 'lucide-react';
import { usePdfExport } from '@/hooks/usePdfExport';
import { PdfExportDialog } from '@/components/invoices/PdfExportDialog';
import { PdfExportBanner } from '@/components/invoices/PdfExportBanner';
import { InvoiceDataExportDialog, type ExportableInvoice } from '@/components/invoices/InvoiceDataExportDialog';
import { exportToFile } from '@/lib/exportUtils';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, ContextMenuSeparator } from '@/components/ui/context-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { RefreshCw } from 'lucide-react';
import { InvoiceFilesDialog } from '@/components/invoices/InvoiceFilesDialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { InvoiceImagePreview } from '@/components/InvoiceImagePreview';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import InvoiceImageDialog from '@/components/InvoiceImageDialog';
import InvoiceFullEditDialog from '@/components/InvoiceFullEditDialog';
import { InvoiceItemsDialog } from '@/components/InvoiceItemsDialog';
import { UnifiedPagination } from '@/components/ui/unified-pagination';
import { CopyableCell } from '@/components/ui/copyable-cell';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { TableEmptyState } from '@/components/ui/table-empty-state';
import { TablePlaceholderRows } from '@/components/ui/table-placeholder-rows';
import ExpandedInvoiceRow from '@/components/ExpandedInvoiceRow';
import { getInitials, getAvatarColor } from '@/lib/helpers';

import { useInvoiceData } from '@/hooks/useInvoiceData';
import type { NavInvoice, SubmittedInvoice, TransactionRecord } from '@/hooks/useInvoiceData';
import { useInvoiceFilters, FILTER_URL_KEYS, defaultFilters } from '@/hooks/useInvoiceFilters';
import type { InvoiceTab } from '@/hooks/useInvoiceFilters';
import { useInvoiceMutations } from '@/hooks/useInvoiceMutations';
import { useUrlTab } from '@/lib/navigation';
import { useEaisybillPermissions } from '@/hooks/useEaisybillPermissions';
import { useNettingDetection } from '@/hooks/useNettingDetection';
import type { NettingGroup } from '@/hooks/useNettingDetection';

// ── Tab slug ↔ InvoiceTab mapping ──
const TAB_SLUGS = ['outbound_nav', 'inbound_nav', 'submitted_inbound', 'submitted_outbound'] as const;
type TabSlug = typeof TAB_SLUGS[number];
const SLUG_TO_TAB: Record<TabSlug, InvoiceTab> = {
  outbound_nav: 'OUTBOUND',
  inbound_nav: 'INBOUND',
  submitted_inbound: 'SUBMITTED_INBOUND',
  submitted_outbound: 'SUBMITTED_OUTBOUND',
};
const TAB_TO_SLUG: Record<InvoiceTab, TabSlug> = {
  OUTBOUND: 'outbound_nav',
  INBOUND: 'inbound_nav',
  SUBMITTED_INBOUND: 'submitted_inbound',
  SUBMITTED_OUTBOUND: 'submitted_outbound',
};

const InvoicesPage = () => {
  // Always scroll to the top of the page when navigating to InvoicesPage
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const { dateFromFormatted, dateToFormatted } = useDateRange();
  const { canWrite: canWriteModule } = useEaisybillPermissions();
  const writable = canWriteModule('invoices');
  const [searchParams, setSearchParams] = useSearchParams();

  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());

  // KPI filter: click a KPI card to filter the table by match status
  type KpiFilterType = 'all' | 'matched' | 'suggested' | 'unmatched';
  const [kpiFilter, setKpiFilter] = useState<KpiFilterType>(() => {
    const urlKpi = searchParams.get('kpi');
    return (urlKpi && ['matched', 'suggested', 'unmatched'].includes(urlKpi))
      ? urlKpi as KpiFilterType
      : 'all';
  });
  const toggleKpiFilter = useCallback((filter: KpiFilterType) => {
    setKpiFilter(prev => prev === filter ? 'all' : filter);
  }, []);

  // Tab state synced to URL (e.g., /invoices/outbound_nav)
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
  const dialogClosingRef = useRef(false); // prevents URL effect re-trigger during close

  // Issue date popover states (shared across tabs)
  const [issueDateFromOpen, setIssueDateFromOpen] = useState(false);
  const [issueDateToOpen, setIssueDateToOpen] = useState(false);

  // Row selection state
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
  const [selectedSubmittedIds, setSelectedSubmittedIds] = useState<Set<string>>(new Set());

  const companyId = selectedCompany?.id || '';
  const enabled = !!user && !!selectedCompany && !!dateFromFormatted && !!dateToFormatted;
  const isSubmittedTab = activeTab === 'SUBMITTED_INBOUND' || activeTab === 'SUBMITTED_OUTBOUND';

  // ── URL-based invoice deep-linking ──
  // ?invoice=<id>&action=items|view|edit  OR  ?action=files
  type InvoiceAction = 'items' | 'view' | 'edit' | 'files';
  const setInvoiceParam = useCallback((invoiceId: string | null, action: InvoiceAction = 'items') => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (invoiceId) {
        next.set('invoice', invoiceId);
        next.set('action', action);
      } else {
        // Dialog closed → keep invoice param only if the row is currently expanded
        const currentInvoiceId = next.get('invoice');
        const rowIsExpanded = currentInvoiceId ? expandedRowIds.has(currentInvoiceId) : false;
        next.delete('action');
        if (!rowIsExpanded) next.delete('invoice');
      }
      return next;
    }, { replace: true });
  }, [setSearchParams, expandedRowIds]);

  // ── Data hook ──
  const {
    submittedInvoices, linkedInvoicesPool, linkedInvoicesLoading,
    partners, categories, projects, allTransactions, joinTableMatches, navInvoicesLookup,
    matchedInvoiceIds, navIdToCourierReportsMap,
    loading: dataLoading, credentialsExist, invalidateInvoiceData,
  } = useInvoiceData(companyId, enabled, dateFromFormatted, dateToFormatted, selectedCompany?.id);

  // ── Netting detection (kompenzálás heurisztika) ──
  const { nettingInvoiceIds, getNettingGroup } = useNettingDetection(navInvoicesLookup);

  // ── Filters hook (server-side, unified across all tabs) ──
  const {
    filters, setFilters, clearFilters,
    sortField, sortDirection, handleSort,
    navPageSize, setNavPageSize, submittedPageSize, setSubmittedPageSize,
    navCurrentPage, setNavCurrentPage, submittedCurrentPage, setSubmittedCurrentPage,
    navTotalPages, submittedTotalPages,
    navLoading, navFetching, submittedFilterLoading, submittedFetching,
    filteredAndSortedNavInvoices, filteredAndSortedSubmittedInvoices,
    paginatedNavInvoices, paginatedSubmittedInvoices,
    navTotalCount, submittedTotalCount,
    getInvoicePartnerName, getPartnerTaxNumber, getCategoryName, getProjectName, getPaymentMethodLabel,
  } = useInvoiceFilters(companyId, enabled, dateFromFormatted, dateToFormatted, partners, categories, projects, activeTab);

  const loading = dataLoading || navLoading || submittedFilterLoading;
  const tabFetching = isSubmittedTab ? submittedFetching : navFetching;

  // Computed: are any filters active (standard filters OR KPI filter)?
  const hasStandardFilters = useMemo(() => {
    return filters.search !== '' || filters.issueDateFrom !== '' || filters.issueDateTo !== '' ||
      filters.amountMin !== '' || filters.amountMax !== '' ||
      filters.currency !== 'all' || filters.paid !== 'all' || filters.submitted !== 'all' ||
      filters.project !== 'all' || filters.category !== 'all' || filters.paymentMethod !== 'all' ||
      filters.continuous !== 'all';
  }, [filters]);
  const hasAnyActiveFilter = hasStandardFilters || kpiFilter !== 'all';

  const clearAllFilters = useCallback(() => {
    clearFilters();
    setKpiFilter('all');
  }, [clearFilters]);

  // ── Sync ALL view state → URL query params (single effect, no conflicts) ──
  useEffect(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);

      // Clear all filter-related params (preserve 'invoice', 'action', etc.)
      for (const urlKey of Object.values(FILTER_URL_KEYS)) {
        next.delete(urlKey);
      }
      next.delete('kpi');
      next.delete('sf');
      next.delete('sd');
      next.delete('p');
      next.delete('ps');

      // Set non-default filter values
      for (const [key, urlKey] of Object.entries(FILTER_URL_KEYS)) {
        const value = filters[key as keyof typeof filters];
        const defValue = defaultFilters[key as keyof typeof defaultFilters];
        if (value !== defValue) {
          next.set(urlKey, value);
        }
      }

      // KPI filter
      if (kpiFilter !== 'all') next.set('kpi', kpiFilter);

      // Sort (only if non-default)
      if (sortField !== 'invoice_issue_date') next.set('sf', sortField);
      if (sortDirection !== 'desc') next.set('sd', sortDirection);

      // Page (only if > 1)
      const currentPage = isSubmittedTab ? submittedCurrentPage : navCurrentPage;
      if (currentPage > 1) next.set('p', String(currentPage));

      // Page size (only if non-default)
      const currentPageSize = isSubmittedTab ? submittedPageSize : navPageSize;
      if (currentPageSize !== 50) next.set('ps', String(currentPageSize));

      return next;
    }, { replace: true });
  }, [filters, kpiFilter, sortField, sortDirection, navCurrentPage, submittedCurrentPage, navPageSize, submittedPageSize, isSubmittedTab, setSearchParams]);

  // ── Mutations hook ──
  const {
    syncing, canSync, cooldownSeconds, formatCooldown,
    handleSync, handleProjectChange, handleCategoryChange, handleToggleSubmitted, handleExport,
  } = useInvoiceMutations({
    companyId,
    selectedCompany,
    invalidateInvoiceData,
    selectedInvoiceIds,
    setSelectedInvoiceIds,
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

  // ── CSV / XLSX / PDF Interactive Data Export Dialog ──
  const [dataExportDialogOpen, setDataExportDialogOpen] = useState(false);
  const [dataExportFormat, setDataExportFormat] = useState<'csv' | 'xlsx' | 'pdf'>('xlsx');
  const [dataExportLevel, setDataExportLevel] = useState<ExportLevel>('summary');

  const openDataExportDialog = (format: 'csv' | 'xlsx' | 'pdf' = 'xlsx', level: ExportLevel = 'summary') => {
    setDataExportFormat(format);
    setDataExportLevel(level);
    setDataExportDialogOpen(true);
  };

  const exportableInvoices = useMemo<ExportableInvoice[]>(() => {
    if (isSubmittedTab) {
      return filteredAndSortedSubmittedInvoices.map(inv => ({
        id: inv.id,
        invoice_number: inv.bizonylatsorszam || 'Nincs sorszám',
        direction: inv.invoice_direction === 'OUTBOUND' ? 'OUTBOUND' : 'INBOUND',
        partner_name: inv.invoice_direction === 'OUTBOUND' ? (inv.vevo_nev || '–') : (inv.elado_nev || '–'),
        issue_date: inv.kibocsatas_datuma || '',
        delivery_date: inv.teljesites_datuma || '',
        net_amount: inv.adoalap_osszesen || 0,
        gross_amount: inv.brutto_vegosszeg || 0,
        vat_amount: inv.afa_osszeg_osszesen || 0,
        currency: inv.penznem || 'HUF',
        category_name: getCategoryName(inv.category_id),
        project_name: getProjectName(inv.project_id),
        source: 'submitted',
      }));
    }

    return filteredAndSortedNavInvoices.map(inv => ({
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
      submitted: inv.submitted,
      project_name: getProjectName(inv.project_id),
      source: 'nav',
    }));
  }, [isSubmittedTab, filteredAndSortedSubmittedInvoices, filteredAndSortedNavInvoices, getCategoryName, getProjectName, getInvoicePartnerName, getPartnerTaxNumber]);

  const handleDataExportConfirm = async (
    selectedInvoices: ExportableInvoice[],
    format: 'csv' | 'xlsx' | 'pdf',
    exportLevel: ExportLevel = 'summary'
  ) => {
    if (format === 'pdf') {
      if (!selectedCompany?.id) return;
      const dates = selectedInvoices.map(i => i.issue_date).filter(Boolean).sort();
      const dateFrom = dates[0] || new Date().toISOString().split('T')[0];
      const dateTo = dates[dates.length - 1] || new Date().toISOString().split('T')[0];
      await pdfExport.startExport({
        dateFrom,
        dateTo,
        exportMode: exportLevel === 'itemized_posting' ? 'posting_slips' : 'standard',
        includePostingSlips: exportLevel === 'itemized_posting',
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
        (navItems || []).forEach((item: any) => {
          const arr = navItemsMap.get(item.nav_invoice_id) || [];
          arr.push(item);
          navItemsMap.set(item.nav_invoice_id, arr);
        });
      }

      if (subIds.length > 0) {
        const { data: subItems } = await supabase
          .from('invoice_items')
          .select('*')
          .in('invoice_id', subIds);
        (subItems || []).forEach((item: any) => {
          const arr = subItemsMap.get(item.invoice_id) || [];
          arr.push(item);
          subItemsMap.set(item.invoice_id, arr);
        });
      }

      const headers = [
        'Számlaszám', 'Tétel #', 'Irány', 'Partner név', 'Partner adószám',
        'Kibocsátás dátuma', 'Teljesítés dátuma', 'Tétel megnevezése',
        'Mennyiség', 'Egység', 'Egységár', 'Tétel nettó', 'ÁFA %', 'Tétel ÁFA',
        'Tétel bruttó', 'Pénznem', 'Tartozik (T)', 'Követel (K)', 'Könyvelési Kategória'
      ];

      const rows: (string | number)[][] = [];

      selectedInvoices.forEach(inv => {
        const items = (inv.source === 'nav' ? navItemsMap.get(inv.id) : subItemsMap.get(inv.id)) || [];
        const isOutbound = inv.direction === 'OUTBOUND';
        const defaultDebit = isOutbound ? '3110' : '5110';
        const defaultCredit = isOutbound ? '9110' : '4540';

        if (items.length === 0) {
          rows.push([
            inv.invoice_number,
            1,
            isOutbound ? 'Kimenő' : 'Bejövő',
            inv.partner_name,
            inv.partner_tax_number || '',
            inv.issue_date,
            inv.delivery_date || '',
            'Számla összesítő',
            1,
            'db',
            inv.net_amount || 0,
            inv.net_amount || 0,
            inv.vat_amount && inv.net_amount ? Math.round((inv.vat_amount / inv.net_amount) * 100) : 0,
            inv.vat_amount || 0,
            inv.gross_amount || 0,
            inv.currency || 'HUF',
            defaultDebit,
            defaultCredit,
            inv.category_name || 'Általános'
          ]);
        } else {
          items.forEach((item, idx) => {
            const itemNet = Number(item.net_amount ?? item.line_net_amount ?? item.netto_erteke ?? 0);
            const itemVat = Number(item.vat_amount ?? item.line_vat_amount ?? item.afa_erteke ?? 0);
            const itemGross = Number(item.gross_amount ?? item.line_gross_amount ?? item.brutto_erteke ?? (itemNet + itemVat));
            
            let vatPct = 0;
            if (item.vat_rate != null) {
              const parsedRate = parseFloat(item.vat_rate);
              vatPct = parsedRate > 0 && parsedRate < 1 ? Math.round(parsedRate * 100) : Math.round(parsedRate);
            } else {
              vatPct = item.vat_percentage || item.afa_kulcs || (itemNet > 0 ? Math.round((itemVat / itemNet) * 100) : 0);
            }

            rows.push([
              inv.invoice_number,
              item.line_number || idx + 1,
              isOutbound ? 'Kimenő' : 'Bejövő',
              inv.partner_name,
              inv.partner_tax_number || '',
              inv.issue_date,
              inv.delivery_date || '',
              item.line_description || item.megnevezes || `Tétel ${idx + 1}`,
              item.quantity || item.mennyiseg || 1,
              item.unit_of_measure || item.egyseg || 'db',
              item.unit_price || item.egysegar || 0,
              itemNet,
              vatPct,
              itemVat,
              itemGross,
              inv.currency || 'HUF',
              item.gl_account_debit || item.tartozik_szamla || defaultDebit,
              item.gl_account_credit || item.kovetel_szamla || defaultCredit,
              item.category_name || inv.category_name || 'Általános'
            ]);
          });
        }
      });

      await exportToFile(headers, rows, format as 'csv' | 'xlsx', `szamlak_teteles_kontirozott`);
      return;
    }

    if (isSubmittedTab) {
      const headers = [
        'Kibocsátás dátuma', 'Teljesítés dátuma', 'Irány', 'Eladó / Vevő',
        'Nettó összeg', 'Bruttó összeg', 'ÁFA összeg', 'Pénznem',
        'Kategória', 'Projekt'
      ];
      const rows = selectedInvoices.map(inv => [
        inv.issue_date,
        inv.delivery_date || '',
        inv.direction === 'OUTBOUND' ? 'Kimenő' : 'Bejövő',
        inv.partner_name,
        inv.net_amount?.toString() || '0',
        inv.gross_amount?.toString() || '0',
        inv.vat_amount?.toString() || '0',
        inv.currency || 'HUF',
        inv.category_name || '',
        inv.project_name || '',
      ]);
      await exportToFile(headers, rows, format, 'bekuldott_szamlak');
    } else {
      const headers = [
        'Irány', 'Bizonylatsorszám', 'Kibocsátás dátuma', 'Teljesítés dátuma',
        'Partner név', 'Partner adószám', 'Nettó összeg', 'Bruttó összeg',
        'ÁFA összeg', 'Pénznem', 'Fizetve', 'Beküldve'
      ];
      const rows = selectedInvoices.map(inv => [
        inv.direction === 'OUTBOUND' ? 'Kimenő' : 'Bejövő',
        inv.invoice_number,
        inv.issue_date,
        inv.delivery_date || '',
        inv.partner_name,
        inv.partner_tax_number || '',
        inv.net_amount?.toString() || '0',
        inv.gross_amount?.toString() || '0',
        inv.vat_amount?.toString() || '0',
        inv.currency || 'HUF',
        inv.paid ? 'Igen' : 'Nem',
        inv.submitted ? 'Igen' : 'Nem',
      ]);
      await exportToFile(headers, rows, format, 'nav_szamlak');
    }
  };

  // ── Toggle "Nem kerül könyvelésre" flag ──
  const handleToggleExclude = useCallback(async (invoiceId: string, table: 'nav_invoices' | 'invoices', currentValue: boolean) => {
    const newValue = !currentValue;
    const { error } = await supabase
      .from(table)
      .update({ exclude_from_accounting: newValue })
      .eq('id', invoiceId);
    if (!error) {
      invalidateInvoiceData();
    }
  }, [invalidateInvoiceData]);

  // Reset pagination, selection, and expanded row when company changes
  useEffect(() => {
    setNavCurrentPage(1);
    setSubmittedCurrentPage(1);
    setSelectedInvoiceIds(new Set());
    setSelectedSubmittedIds(new Set());
    setExpandedRowIds(new Set());
  }, [selectedCompany?.id]);

  // Clear selection and expanded rows when tab changes (KPI filter persists)
  useEffect(() => {
    setSelectedInvoiceIds(new Set());
    setSelectedSubmittedIds(new Set());
    setExpandedRowIds(new Set());
  }, [activeTab]);

  // ── Auto-open invoice dialog from URL (?invoice=<id>&action=items|view|edit) ──
  // If ?invoice=<id> without action → just expand the row (no dialog).
  const invoiceIdFromUrl = searchParams.get('invoice');
  const actionFromUrl = searchParams.get('action') || null;
  useEffect(() => {
    if (!invoiceIdFromUrl || !enabled) return;
    // Skip if action is 'files' — that opens a different dialog
    if (actionFromUrl === 'files') return;
    // Skip if a dialog is already open or just closed (prevents re-trigger during close cycle)
    if (itemsDialogOpen || submittedItemsDialogOpen || imageDialogOpen || editDialogOpen) return;
    if (dialogClosingRef.current) return;

    // No action → just expand the row
    if (!actionFromUrl) {
      setExpandedRowIds(prev => {
        if (prev.has(invoiceIdFromUrl)) return prev;
        const next = new Set(prev);
        next.add(invoiceIdFromUrl);
        return next;
      });
      return;
    }

    const openDialog = (invoice: SubmittedInvoice | NavInvoice, source: 'nav' | 'submitted') => {
      if (source === 'nav') {
        // NAV invoices only support items view
        setSelectedNavInvoice(invoice as NavInvoice);
        setItemsDialogOpen(true);
        return;
      }
      const sub = invoice as SubmittedInvoice;
      switch (actionFromUrl) {
        case 'view':
          setSelectedInvoice(sub);
          setImageDialogOpen(true);
          break;
        case 'edit':
          setSelectedInvoice(sub);
          setEditDialogOpen(true);
          break;
        case 'items':
        default:
          setSelectedSubmittedForItems(sub);
          setSubmittedItemsDialogOpen(true);
          break;
      }
    };

    // Try to find in currently loaded NAV invoices
    const navMatch = filteredAndSortedNavInvoices.find(inv => inv.id === invoiceIdFromUrl);
    if (navMatch) { openDialog(navMatch, 'nav'); return; }

    // Try to find in loaded submitted invoices
    const subMatch = submittedInvoices.find(inv => inv.id === invoiceIdFromUrl);
    if (subMatch) { openDialog(subMatch, 'submitted'); return; }

    // Fallback: fetch from Supabase (for shared links)
    let cancelled = false;
    (async () => {
      // Try nav_invoices first
      const { data: navData } = await supabase
        .from('nav_invoices')
        .select('id, invoice_number, currency, invoice_issue_date, supplier_name')
        .eq('id', invoiceIdFromUrl)
        .maybeSingle();

      if (cancelled) return;
      if (navData) { openDialog(navData as NavInvoice, 'nav'); return; }

      // Try invoices table (fetch all fields needed for view/edit)
      const { data: subData } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceIdFromUrl)
        .maybeSingle();

      if (cancelled) return;
      if (subData) { openDialog(subData as unknown as SubmittedInvoice, 'submitted'); }
    })();

    return () => { cancelled = true; };
  }, [invoiceIdFromUrl, actionFromUrl, enabled]);

  // ── Files dialog URL handling ──
  useEffect(() => {
    // Skip if we are in the middle of closing (prevents jumping back to open state)
    if (dialogClosingRef.current) return;
    if (actionFromUrl === 'files' && !filesDialogOpen) setFilesDialogOpen(true);
  }, [actionFromUrl, filesDialogOpen]);

  const handleOpenFiles = useCallback(() => {
    setFilesDialogOpen(true);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('action', 'files');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const handleCloseFiles = useCallback((open: boolean) => {
    setFilesDialogOpen(open);
    if (!open) {
      dialogClosingRef.current = true;
      setTimeout(() => {
        setSearchParams(prev => {
          const next = new URLSearchParams(prev);
          next.delete('action');
          return next;
        }, { replace: true });
        // Set to false AFTER search params update is flushed
        setTimeout(() => {
          dialogClosingRef.current = false;
        }, 50);
      }, 300); // Increased from 200ms to 300ms to be safe (Radix is 200ms)
    }
  }, [setSearchParams]);

  // ── Row selection helpers ──
  const handleRowSelect = (invoiceId: string, checked: boolean) => {
    setSelectedInvoiceIds(prev => {
      const newSet = new Set(prev);
      if (checked) newSet.add(invoiceId); else newSet.delete(invoiceId);
      return newSet;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const newSet = new Set(selectedInvoiceIds);
      paginatedNavInvoices.forEach(inv => newSet.add(inv.id));
      setSelectedInvoiceIds(newSet);
    } else {
      const newSet = new Set(selectedInvoiceIds);
      paginatedNavInvoices.forEach(inv => newSet.delete(inv.id));
      setSelectedInvoiceIds(newSet);
    }
  };

  const allVisibleSelected = useMemo(() => {
    if (paginatedNavInvoices.length === 0) return false;
    return paginatedNavInvoices.every(inv => selectedInvoiceIds.has(inv.id));
  }, [paginatedNavInvoices, selectedInvoiceIds]);

  const handleSubmittedRowSelect = (invoiceId: string, checked: boolean) => {
    setSelectedSubmittedIds(prev => {
      const newSet = new Set(prev);
      if (checked) newSet.add(invoiceId); else newSet.delete(invoiceId);
      return newSet;
    });
  };

  const handleSubmittedSelectAll = (checked: boolean) => {
    if (checked) {
      const newSet = new Set(selectedSubmittedIds);
      paginatedSubmittedInvoices.forEach(inv => newSet.add(inv.id));
      setSelectedSubmittedIds(newSet);
    } else {
      const newSet = new Set(selectedSubmittedIds);
      paginatedSubmittedInvoices.forEach(inv => newSet.delete(inv.id));
      setSelectedSubmittedIds(newSet);
    }
  };

  const allVisibleSubmittedSelected = useMemo(() => {
    if (paginatedSubmittedInvoices.length === 0) return false;
    return paginatedSubmittedInvoices.every(inv => selectedSubmittedIds.has(inv.id));
  }, [paginatedSubmittedInvoices, selectedSubmittedIds]);

  // ── Lookup maps ──
  // Normalize invoice numbers by stripping spaces so that
  // NAV's "HP / 2026-002072" matches submitted's "HP/2026-002072"
  const normalizeInvNum = (s: string) => s.replace(/\s+/g, '').toUpperCase();

  const navToSubmittedMap = useMemo(() => {
    const map = new Map<string, typeof submittedInvoices>();
    submittedInvoices.forEach(inv => {
      if (inv.bizonylatsorszam) {
        const key = normalizeInvNum(inv.bizonylatsorszam);
        const existing = map.get(key) || [];
        existing.push(inv);
        map.set(key, existing);
      }
    });
    return map;
  }, [submittedInvoices]);

  const submittedToNavMap = useMemo(() => {
    const map = new Map<string, NavInvoice[]>();
    navInvoicesLookup.forEach(inv => {
      const key = normalizeInvNum(inv.invoice_number);
      const existing = map.get(key) || [];
      existing.push(inv);
      map.set(key, existing);
    });
    return map;
  }, [navInvoicesLookup]);

  const submittedIdToTransactionsMap = useMemo(() => {
    const map = new Map<string, TransactionRecord[]>();
    // 1. Primary match (matched_invoice_id)
    allTransactions.forEach(tx => {
      if (tx.matched_invoice_id) {
        const existing = map.get(tx.matched_invoice_id) || [];
        existing.push(tx);
        map.set(tx.matched_invoice_id, existing);
      }
    });
    // 2. Multi-match via join table (transaction_invoice_matches)
    const txById = new Map(allTransactions.map(t => [t.id, t]));
    joinTableMatches.forEach(m => {
      const tx = txById.get(m.transaction_id);
      if (tx) {
        const existing = map.get(m.invoice_id) || [];
        if (!existing.some(t => t.id === tx.id)) {
          existing.push(tx);
          map.set(m.invoice_id, existing);
        }
      }
    });
    return map;
  }, [allTransactions, joinTableMatches]);

  const linkedInvoicesMap = useMemo(() => {
    const allInvoices = [...submittedInvoices, ...linkedInvoicesPool];
    const byBizonylat = new Map<string, SubmittedInvoice[]>();
    const byReference = new Map<string, SubmittedInvoice[]>();
    allInvoices.forEach(inv => {
      if (inv.bizonylatsorszam) {
        const key = normalizeInvNum(inv.bizonylatsorszam);
        const arr = byBizonylat.get(key) || [];
        arr.push(inv);
        byBizonylat.set(key, arr);
      }
      if (inv.reference_number) {
        const refs = inv.reference_number.split(',').map(r => r.trim()).filter(Boolean);
        refs.forEach(ref => {
          const key = normalizeInvNum(ref);
          const arr = byReference.get(key) || [];
          if (!arr.some(x => x.id === inv.id)) {
            arr.push(inv);
          }
          byReference.set(key, arr);
        });
      }
      if (inv.elolegszamla_hivatkozas) {
        const refs = inv.elolegszamla_hivatkozas.split(',').map(r => r.trim()).filter(Boolean);
        refs.forEach(ref => {
          const key = normalizeInvNum(ref);
          const arr = byReference.get(key) || [];
          if (!arr.some(x => x.id === inv.id)) {
            arr.push(inv);
          }
          byReference.set(key, arr);
        });
      }
    });
    return { byBizonylat, byReference };
  }, [submittedInvoices, linkedInvoicesPool]);

  const getLinkedInvoices = (invoice: SubmittedInvoice): (SubmittedInvoice & { relationDirection: 'parent' | 'child' })[] => {
    const linked: (SubmittedInvoice & { relationDirection: 'parent' | 'child' })[] = [];
    const visited = new Set([invoice.id]);

    const getParentRefs = (inv: SubmittedInvoice): string[] => {
      const refs: string[] = [];
      if (inv.reference_number) {
        inv.reference_number.split(',').map(r => r.trim()).filter(Boolean).forEach(r => refs.push(r));
      }
      if (inv.elolegszamla_hivatkozas) {
        inv.elolegszamla_hivatkozas.split(',').map(r => r.trim()).filter(Boolean).forEach(r => refs.push(r));
      }
      return refs;
    };

    const parentQueue = getParentRefs(invoice);
    while (parentQueue.length > 0) {
      const ref = parentQueue.shift();
      if (!ref) continue;
      const parents = linkedInvoicesMap.byBizonylat.get(normalizeInvNum(ref)) || [];
      for (const parent of parents) {
        if (visited.has(parent.id)) continue;
        visited.add(parent.id);
        linked.push({ ...parent, relationDirection: 'parent' });
        getParentRefs(parent).forEach(r => parentQueue.push(r));
      }
    }

    const queue = [invoice.bizonylatsorszam];
    while (queue.length > 0) {
      const bizSorszam = queue.shift();
      if (!bizSorszam) continue;
      const children = linkedInvoicesMap.byReference.get(normalizeInvNum(bizSorszam)) || [];
      for (const child of children) {
        if (visited.has(child.id)) continue;
        visited.add(child.id);
        linked.push({ ...child, relationDirection: 'child' });
        if (child.bizonylatsorszam) queue.push(child.bizonylatsorszam);
      }
    }

    return linked;
  };

  const getNavInvoiceMatches = (navInvoice: NavInvoice) => {
    const matchedSubmitted = navToSubmittedMap.get(normalizeInvNum(navInvoice.invoice_number)) || [];
    const matchedTx: TransactionRecord[] = [];
    matchedSubmitted.forEach(sub => {
      const txs = submittedIdToTransactionsMap.get(sub.id) || [];
      matchedTx.push(...txs);
    });
    const directTxs = submittedIdToTransactionsMap.get(navInvoice.id) || [];
    directTxs.forEach(tx => {
      if (!matchedTx.some(t => t.id === tx.id)) matchedTx.push(tx);
    });
    const linkedInvs: SubmittedInvoice[] = [];
    matchedSubmitted.forEach(sub => {
      getLinkedInvoices(sub).forEach(l => {
        if (!linkedInvs.some(x => x.id === l.id) && !matchedSubmitted.some(x => x.id === l.id)) linkedInvs.push(l);
      });
    });
    // Propagate transactions from linked invoices (e.g. DB/416429 → RF/038227/2026)
    linkedInvs.forEach(linked => {
      const linkedTxs = submittedIdToTransactionsMap.get(linked.id) || [];
      linkedTxs.forEach(tx => {
        if (!matchedTx.some(t => t.id === tx.id)) matchedTx.push(tx);
      });
    });
    return { matchedSubmitted, matchedTransactions: matchedTx, matchedNav: [] as NavInvoice[], linkedInvoices: linkedInvs, matchedCourierReports: navIdToCourierReportsMap.get(navInvoice.id) || [] };
  };

  const getSubmittedInvoiceMatches = (submitted: SubmittedInvoice) => {
    const matchedNav = submitted.bizonylatsorszam ? (submittedToNavMap.get(normalizeInvNum(submitted.bizonylatsorszam)) || []) : [];
    // Direct transactions for this submitted invoice
    const matchedTx: TransactionRecord[] = [...(submittedIdToTransactionsMap.get(submitted.id) || [])];
    // Also include transactions from matched NAV invoices
    matchedNav.forEach(nav => {
      const navTxs = submittedIdToTransactionsMap.get(nav.id) || [];
      navTxs.forEach(tx => {
        if (!matchedTx.some(t => t.id === tx.id)) matchedTx.push(tx);
      });
    });
    const linkedInvs = getLinkedInvoices(submitted);
    // Propagate transactions from linked invoices (e.g. parent/child via reference_number)
    linkedInvs.forEach(linked => {
      const linkedTxs = submittedIdToTransactionsMap.get(linked.id) || [];
      linkedTxs.forEach(tx => {
        if (!matchedTx.some(t => t.id === tx.id)) matchedTx.push(tx);
      });
    });
    return { matchedSubmitted: [] as SubmittedInvoice[], matchedTransactions: matchedTx, matchedNav, linkedInvoices: linkedInvs };
  };

  const handleRowClick = (invoiceId: string, e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, [role="checkbox"], [role="combobox"], [data-radix-collection-item]')) return;
    setExpandedRowIds(prev => {
      const next = new Set(prev);
      const isExpanding = !next.has(invoiceId);
      if (isExpanding) next.add(invoiceId);
      else next.delete(invoiceId);
      // Sync to URL: expanded row → ?invoice=<id>, collapsed → clear
      setSearchParams(sp => {
        const p = new URLSearchParams(sp);
        if (isExpanding) {
          p.set('invoice', invoiceId);
          p.delete('action'); // no action = just expanded
        } else {
          p.delete('invoice');
          p.delete('action');
        }
        return p;
      }, { replace: true });
      return next;
    });
  };

  const openImageDialog = (invoice: SubmittedInvoice) => {
    setSelectedInvoice(invoice);
    setImageDialogOpen(true);
    setInvoiceParam(invoice.id, 'view');
  };

  const openEditDialog = (invoice: SubmittedInvoice) => {
    setSelectedInvoice(invoice);
    setEditDialogOpen(true);
    setInvoiceParam(invoice.id, 'edit');
  };

  const handleEditSave = () => {
    invalidateInvoiceData();
  };

  const getResultCount = () => {
    if (tabFetching) return '–';
    if (isSubmittedTab) return submittedTotalCount;
    return navTotalCount;
  };

  // Extend matchedInvoiceIds: also mark submitted invoices as "matched" (green)
  // when their NAV counterpart has a transaction match OR a linked invoice has one
  const extendedMatchedIds = useMemo(() => {
    const ids = new Set(matchedInvoiceIds);
    const allInvs = [...submittedInvoices, ...linkedInvoicesPool];
    submittedInvoices.forEach(inv => {
      if (ids.has(inv.id)) return; // already matched directly
      // Check NAV counterpart
      if (inv.bizonylatsorszam) {
        const navMatches = submittedToNavMap.get(normalizeInvNum(inv.bizonylatsorszam)) || [];
        const hasPaidNav = navMatches.some(nav => submittedIdToTransactionsMap.has(nav.id));
        if (hasPaidNav) { ids.add(inv.id); return; }
      }
      // Check linked invoices (reference_number chain) for transaction matches
      const linked = getLinkedInvoices(inv);
      const hasLinkedTx = linked.some(l => submittedIdToTransactionsMap.has(l.id));
      if (hasLinkedTx) ids.add(inv.id);
    });
    return ids;
  }, [matchedInvoiceIds, submittedInvoices, linkedInvoicesPool, submittedToNavMap, submittedIdToTransactionsMap]);

  // Identify invoices that ONLY have suggested (not confirmed) matches → amber row
  // A match is "suggested" when: match_type !== 'manual' AND is_verified !== true AND confidence_score < 0.9
  // This mirrors the isSuggested logic in ExpandedInvoiceRow.tsx
  const suggestedOnlyIds = useMemo(() => {
    const ids = new Set<string>();
    allTransactions.forEach(tx => {
      if (!tx.matched_invoice_id) return;
      const isSuggested = tx.match_type !== 'manual' && !tx.is_verified && (tx.confidence_score ?? 1) < 0.9;
      if (isSuggested) ids.add(tx.matched_invoice_id);
    });
    // Remove any that also have a confirmed (non-suggested) match
    allTransactions.forEach(tx => {
      if (!tx.matched_invoice_id) return;
      const isSuggested = tx.match_type !== 'manual' && !tx.is_verified && (tx.confidence_score ?? 1) < 0.9;
      if (!isSuggested) ids.delete(tx.matched_invoice_id);
    });
    return ids;
  }, [allTransactions]);

  // ── Invoice KPI summary (respects ALL active filters) ──
  const invoiceKpis = useMemo(() => {
    // Helper: apply standard filters client-side to a NAV invoice
    const passesNavFilters = (inv: NavInvoice) => {
      // Global date range (invoice_issue_date)
      if (dateFromFormatted && inv.invoice_issue_date && inv.invoice_issue_date < dateFromFormatted) return false;
      if (dateToFormatted && inv.invoice_issue_date && inv.invoice_issue_date > dateToFormatted) return false;
      // Issue date range filter
      if (filters.issueDateFrom && inv.invoice_issue_date && inv.invoice_issue_date < filters.issueDateFrom) return false;
      if (filters.issueDateTo && inv.invoice_issue_date && inv.invoice_issue_date > filters.issueDateTo) return false;
      // Currency
      if (filters.currency !== 'all' && inv.currency !== filters.currency) return false;
      // Submitted
      if (filters.submitted === 'yes' && !inv.submitted) return false;
      if (filters.submitted === 'no' && inv.submitted) return false;
      // Amount range (gross)
      if (filters.amountMin && Math.abs(inv.invoice_gross_amount || 0) < parseFloat(filters.amountMin)) return false;
      if (filters.amountMax && Math.abs(inv.invoice_gross_amount || 0) > parseFloat(filters.amountMax)) return false;
      // Search (partner names, tax numbers, invoice number, amounts)
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const grossStr = (inv.invoice_gross_amount || 0).toString();
        const netStr = (inv.invoice_net_amount || 0).toString();
        if (
          !(inv.supplier_name || '').toLowerCase().includes(q) &&
          !(inv.customer_name || '').toLowerCase().includes(q) &&
          !(inv.supplier_tax_number || '').toLowerCase().includes(q) &&
          !(inv.customer_tax_number || '').toLowerCase().includes(q) &&
          !inv.invoice_number.toLowerCase().includes(q) &&
          !grossStr.includes(q) &&
          !netStr.includes(q)
        ) return false;
      }
      return true;
    };

    // Helper: apply standard filters client-side to a Submitted invoice
    const passesSubmittedFilters = (inv: SubmittedInvoice) => {
      // Issue date (kibocsatas_datuma)
      if (filters.issueDateFrom && inv.kibocsatas_datuma && inv.kibocsatas_datuma < filters.issueDateFrom) return false;
      if (filters.issueDateTo && inv.kibocsatas_datuma && inv.kibocsatas_datuma > filters.issueDateTo) return false;
      // Currency
      if (filters.currency !== 'all' && inv.penznem !== filters.currency) return false;
      // Amount range (gross)
      if (filters.amountMin && Math.abs(inv.brutto_vegosszeg || 0) < parseFloat(filters.amountMin)) return false;
      if (filters.amountMax && Math.abs(inv.brutto_vegosszeg || 0) > parseFloat(filters.amountMax)) return false;
      // Project
      if (filters.project !== 'all' && inv.project_id !== filters.project) return false;
      // Category
      if (filters.category !== 'all' && inv.category_id !== filters.category) return false;
      // Payment method
      if (filters.paymentMethod !== 'all') {
        if (filters.paymentMethod === 'none' && inv.fizetesi_mod) return false;
        if (filters.paymentMethod !== 'none' && inv.fizetesi_mod !== filters.paymentMethod) return false;
      }
      // Search
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const partnerName = (inv.invoice_direction === 'OUTBOUND' ? inv.vevo_nev : inv.elado_nev) || '';
        const grossStr = (inv.brutto_vegosszeg || 0).toString();
        const netStr = (inv.adoalap_osszesen || 0).toString();
        if (
          !partnerName.toLowerCase().includes(q) && 
          !(inv.bizonylatsorszam || '').toLowerCase().includes(q) &&
          !grossStr.includes(q) &&
          !netStr.includes(q)
        ) return false;
      }
      return true;
    };

    const isNavKpi = activeTab === 'OUTBOUND' || activeTab === 'INBOUND';
    if (isNavKpi) {
      const direction = activeTab;
      const navInvs = navInvoicesLookup.filter(inv => inv.invoice_direction === direction && passesNavFilters(inv));
      const total = navInvs.length;
      let matched = 0, suggested = 0, unmatched = 0;
      for (const inv of navInvs) {
        if (suggestedOnlyIds.has(inv.id)) {
          suggested++;
        } else {
          const directlyMatched = matchedInvoiceIds.has(inv.id);
          const sMatches = navToSubmittedMap.get(normalizeInvNum(inv.invoice_number)) || [];
          const indirectlyMatched = sMatches.some(sub => submittedIdToTransactionsMap.has(sub.id));
          const linkedChain = !indirectlyMatched && sMatches.some(sub => {
            const linked = getLinkedInvoices(sub);
            return linked.some(l => submittedIdToTransactionsMap.has(l.id));
          });
          const isPaid = inv.paid === true || !!inv.transaction_id || directlyMatched || indirectlyMatched || linkedChain;
          if (isPaid) matched++;
          else unmatched++;
        }
      }
      return { total, matched, suggested, unmatched };
    } else {
      const direction = activeTab === 'SUBMITTED_OUTBOUND' ? 'OUTBOUND' : 'INBOUND';
      const subInvs = submittedInvoices.filter(inv => inv.invoice_direction === direction && passesSubmittedFilters(inv));
      const total = subInvs.length;
      let matched = 0, suggested = 0, unmatched = 0;
      for (const inv of subInvs) {
        if (suggestedOnlyIds.has(inv.id)) {
          suggested++;
        } else if (extendedMatchedIds.has(inv.id)) {
          matched++;
        } else {
          unmatched++;
        }
      }
      return { total, matched, suggested, unmatched };
    }
  }, [activeTab, navInvoicesLookup, submittedInvoices, matchedInvoiceIds, extendedMatchedIds, suggestedOnlyIds, navToSubmittedMap, submittedIdToTransactionsMap, getLinkedInvoices, filters, dateFromFormatted, dateToFormatted]);

  // ── KPI-filtered rows (client-side filter on paginated data) ──
  // NAV match status: replicates the exact same isPaid logic used in row rendering
  const getNavMatchStatus = useCallback((invoice: NavInvoice): KpiFilterType => {
    if (suggestedOnlyIds.has(invoice.id)) return 'suggested';
    // 5 sources of "paid/matched" for NAV invoices:
    const directlyMatched = matchedInvoiceIds.has(invoice.id);
    const submittedMatches = navToSubmittedMap.get(normalizeInvNum(invoice.invoice_number)) || [];
    const indirectlyMatched = submittedMatches.some(sub => submittedIdToTransactionsMap.has(sub.id));
    const linkedChainMatched = !indirectlyMatched && submittedMatches.some(sub => {
      const linked = getLinkedInvoices(sub);
      return linked.some(l => submittedIdToTransactionsMap.has(l.id));
    });
    const isPaid = invoice.paid === true || !!invoice.transaction_id || !!invoice.is_manual_payment || directlyMatched || indirectlyMatched || linkedChainMatched;
    if (isPaid) return 'matched';
    return 'unmatched';
  }, [matchedInvoiceIds, suggestedOnlyIds, navToSubmittedMap, submittedIdToTransactionsMap, getLinkedInvoices]);

  const getSubmittedMatchStatus = useCallback((invoiceId: string): KpiFilterType => {
    if (suggestedOnlyIds.has(invoiceId)) return 'suggested';
    if (extendedMatchedIds.has(invoiceId)) return 'matched';
    return 'unmatched';
  }, [extendedMatchedIds, suggestedOnlyIds]);
  // ── KPI-filtered display: when KPI filter is active, paginate client-side from FULL dataset ──
  // This fixes the bug where server-side pagination (50/page) was filtered client-side,
  // showing e.g. only 1 "matched" row on page 1 out of 50 server-returned rows.
  const displayedNavInvoices = useMemo(() => {
    if (kpiFilter === 'all') return paginatedNavInvoices;

    // KPI filter active → filter from ALL nav invoices (not just current page)
    const direction = activeTab as string;
    const allFiltered = navInvoicesLookup
      .filter(inv => inv.invoice_direction === direction)
      .filter(inv => {
        // Apply same standard filters as invoiceKpis
        if (dateFromFormatted && inv.invoice_issue_date && inv.invoice_issue_date < dateFromFormatted) return false;
        if (dateToFormatted && inv.invoice_issue_date && inv.invoice_issue_date > dateToFormatted) return false;
        if (filters.issueDateFrom && inv.invoice_issue_date && inv.invoice_issue_date < filters.issueDateFrom) return false;
        if (filters.issueDateTo && inv.invoice_issue_date && inv.invoice_issue_date > filters.issueDateTo) return false;
        if (filters.currency !== 'all' && inv.currency !== filters.currency) return false;
        if (filters.submitted === 'yes' && !inv.submitted) return false;
        if (filters.submitted === 'no' && inv.submitted) return false;
        if (filters.amountMin && Math.abs(inv.invoice_gross_amount || 0) < parseFloat(filters.amountMin)) return false;
        if (filters.amountMax && Math.abs(inv.invoice_gross_amount || 0) > parseFloat(filters.amountMax)) return false;
        if (filters.search) {
          const q = filters.search.toLowerCase();
          const grossStr = (inv.invoice_gross_amount || 0).toString();
          const netStr = (inv.invoice_net_amount || 0).toString();
          if (
            !(inv.supplier_name || '').toLowerCase().includes(q) &&
            !(inv.customer_name || '').toLowerCase().includes(q) &&
            !(inv.supplier_tax_number || '').toLowerCase().includes(q) &&
            !(inv.customer_tax_number || '').toLowerCase().includes(q) &&
            !inv.invoice_number.toLowerCase().includes(q) &&
            !grossStr.includes(q) &&
            !netStr.includes(q)
          ) return false;
        }
        return true;
      })
      .filter(inv => getNavMatchStatus(inv) === kpiFilter);

    // Sort client-side (same field/direction as server-side sort)
    allFiltered.sort((a, b) => {
      const aVal = (a as any)[sortField] ?? '';
      const bVal = (b as any)[sortField] ?? '';
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    // Paginate client-side
    const pageSize = navPageSize;
    const start = (navCurrentPage - 1) * pageSize;
    return allFiltered.slice(start, start + pageSize);
  }, [kpiFilter, paginatedNavInvoices, navInvoicesLookup, activeTab, getNavMatchStatus,
      filters, dateFromFormatted, dateToFormatted, sortField, sortDirection, navPageSize, navCurrentPage]);

  const displayedSubmittedInvoices = useMemo(() => {
    if (kpiFilter === 'all') return paginatedSubmittedInvoices;

    // KPI filter active → filter from ALL submitted invoices
    const direction = activeTab === 'SUBMITTED_OUTBOUND' ? 'OUTBOUND' : 'INBOUND';
    const allFiltered = submittedInvoices
      .filter(inv => inv.invoice_direction === direction)
      .filter(inv => {
        if (filters.issueDateFrom && inv.kibocsatas_datuma && inv.kibocsatas_datuma < filters.issueDateFrom) return false;
        if (filters.issueDateTo && inv.kibocsatas_datuma && inv.kibocsatas_datuma > filters.issueDateTo) return false;
        if (filters.currency !== 'all' && inv.penznem !== filters.currency) return false;
        if (filters.amountMin && Math.abs(inv.brutto_vegosszeg || 0) < parseFloat(filters.amountMin)) return false;
        if (filters.amountMax && Math.abs(inv.brutto_vegosszeg || 0) > parseFloat(filters.amountMax)) return false;
        if (filters.project !== 'all' && inv.project_id !== filters.project) return false;
        if (filters.category !== 'all' && inv.category_id !== filters.category) return false;
        if (filters.paymentMethod !== 'all') {
          if (filters.paymentMethod === 'none' && inv.fizetesi_mod) return false;
          if (filters.paymentMethod !== 'none' && inv.fizetesi_mod !== filters.paymentMethod) return false;
        }
        if (filters.search) {
          const q = filters.search.toLowerCase();
          const partnerName = (inv.invoice_direction === 'OUTBOUND' ? inv.vevo_nev : inv.elado_nev) || '';
          const grossStr = (inv.brutto_vegosszeg || 0).toString();
          const netStr = (inv.adoalap_osszesen || 0).toString();
          if (
            !partnerName.toLowerCase().includes(q) && 
            !(inv.bizonylatsorszam || '').toLowerCase().includes(q) &&
            !grossStr.includes(q) &&
            !netStr.includes(q)
          ) return false;
        }
        return true;
      })
      .filter(inv => getSubmittedMatchStatus(inv.id) === kpiFilter);

    // Sort client-side
    const fieldMap: Record<string, string> = {
      invoice_issue_date: 'kibocsatas_datuma',
      invoice_gross_amount: 'brutto_vegosszeg',
      invoice_number: 'bizonylatsorszam',
    };
    const mappedField = fieldMap[sortField] || sortField;
    allFiltered.sort((a, b) => {
      const aVal = (a as any)[mappedField] ?? '';
      const bVal = (b as any)[mappedField] ?? '';
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    // Paginate client-side
    const pageSize = submittedPageSize;
    const start = (submittedCurrentPage - 1) * pageSize;
    return allFiltered.slice(start, start + pageSize);
  }, [kpiFilter, paginatedSubmittedInvoices, submittedInvoices, activeTab, getSubmittedMatchStatus,
      filters, sortField, sortDirection, submittedPageSize, submittedCurrentPage]);

  // When KPI filter is active, show the KPI count as totalItems in pagination
  // Always use invoiceKpis values so "Találatok" is consistent with the KPI cards
  const kpiFilteredTotalItems = useMemo(() => {
    if (kpiFilter === 'all') return invoiceKpis.total;
    if (kpiFilter === 'matched') return invoiceKpis.matched;
    if (kpiFilter === 'suggested') return invoiceKpis.suggested;
    return invoiceKpis.unmatched;
  }, [kpiFilter, invoiceKpis]);

  // Compute totalPages from kpiFilteredTotalItems so pagination shows correct page count
  const kpiFilteredNavTotalPages = useMemo(() => {
    if (kpiFilter === 'all') return navTotalPages;
    return Math.max(1, Math.ceil(kpiFilteredTotalItems / navPageSize));
  }, [kpiFilter, navTotalPages, kpiFilteredTotalItems, navPageSize]);

  const kpiFilteredSubmittedTotalPages = useMemo(() => {
    if (kpiFilter === 'all') return submittedTotalPages;
    return Math.max(1, Math.ceil(kpiFilteredTotalItems / submittedPageSize));
  }, [kpiFilter, submittedTotalPages, kpiFilteredTotalItems, submittedPageSize]);

  return (
    <div className="h-full bg-background page-animate">
      <main className="w-full max-w-none px-4 py-4">
        <Card>
          <CardHeader>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-2xl font-bold">Számlák</CardTitle>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-5 w-5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Itt láthatod a NAV-ból szinkronizált és a beküldött számláidat. Szűrj irány, dátum, összeg vagy állapot szerint. Exportálhatod CSV vagy Excel formátumban.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
              </div>
              </div>
              <div className="relative">
                <div className="flex gap-2 justify-end">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSync}
                        disabled={syncing || !credentialsExist || !canSync || !writable}
                      >
                        <RefreshCw className={cn("h-4 w-4 mr-2", syncing && "animate-spin")} />
                        {syncing ? 'Szinkronizálás...' : !canSync ? `Várj ${formatCooldown(cooldownSeconds)}` : 'Szinkronizálás'}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {!credentialsExist
                        ? 'Állítsd be a NAV integrációt az Integrációk oldalon'
                        : !canSync
                          ? `Legközelebb ${formatCooldown(cooldownSeconds)} múlva szinkronizálhatsz`
                          : selectedInvoiceIds.size > 0
                            ? `NAV szinkronizálás + ${selectedInvoiceIds.size} kijelölt számla újrakategorizálása`
                            : 'NAV számlák szinkronizálása (utolsó 30 nap)'
                      }
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Button variant="outline" size="sm" onClick={handleOpenFiles}>
                  <FileText className="h-4 w-4 mr-2" />
                  Feltöltött fájlok
                </Button>
                <InvoiceFilesDialog open={filesDialogOpen} onOpenChange={handleCloseFiles} />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Export
                      <ChevronDown className="h-4 w-4 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-48">
                    <DropdownMenuItem onClick={() => openDataExportDialog('xlsx')} className="gap-2 cursor-pointer">
                      <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                      <span>Export Excel (.xlsx)</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem onClick={() => openDataExportDialog('csv')} className="gap-2 cursor-pointer">
                      <FileText className="h-4 w-4 text-blue-500" />
                      <span>Export CSV (.csv)</span>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem onClick={() => openDataExportDialog('pdf')} className="gap-2 cursor-pointer">
                      <FileDown className="h-4 w-4 text-rose-500" />
                      <span>Export PDF (.pdf)</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                </div>
              </div>
            </div>
          </CardHeader>

          {/* PDF Export Banner — between header and content */}
          {pdfExport.showBanner && pdfExport.activeJob && (
            <div className="px-6 pb-2">
              <PdfExportBanner
                job={pdfExport.activeJob}
                progress={pdfExport.progress}
                onCancel={pdfExport.cancelExport}
                onDismiss={pdfExport.dismissBanner}
                onRetryDownload={pdfExport.retryDownload}
              />
            </div>
          )}

          {/* PDF Export Dialog */}
          <PdfExportDialog
            open={pdfExport.dialogOpen}
            onClose={pdfExport.closeDialog}
            onExport={pdfExport.startExport}
            isExporting={pdfExport.isExporting}
            isStarting={pdfExport.isStarting}
            initialDirection={activeTab === 'SUBMITTED_INBOUND' ? 'INBOUND' : 'OUTBOUND'}
          />

          {/* Interactive Data Export Dialog (CSV / XLSX / PDF) */}
          <InvoiceDataExportDialog
            open={dataExportDialogOpen}
            onClose={() => setDataExportDialogOpen(false)}
            invoices={exportableInvoices}
            initialSelectedIds={isSubmittedTab ? selectedSubmittedIds : selectedInvoiceIds}
            initialFormat={dataExportFormat}
            initialLevel={dataExportLevel}
            companyName={selectedCompany?.name}
            onExport={handleDataExportConfirm}
          />

          <CardContent className="space-y-6">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as InvoiceTab)}>
              <TabsList className="grid w-full max-w-2xl grid-cols-4">
                <TabsTrigger value="OUTBOUND">Kimenő (NAV)</TabsTrigger>
                <TabsTrigger value="INBOUND">Bejövő (NAV)</TabsTrigger>
                <TabsTrigger value="SUBMITTED_OUTBOUND">Beküldött (Kimenő)</TabsTrigger>
                <TabsTrigger value="SUBMITTED_INBOUND">Beküldött (Bejövő)</TabsTrigger>
              </TabsList>

              {/* ── KPI Summary Bar (clickable filters) ── */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 mb-2 print:hidden">
                <div
                  onClick={() => toggleKpiFilter('all')}
                  className={cn(
                    "bg-card border rounded-xl p-3.5 flex items-center gap-3 cursor-pointer transition-all hover:shadow-md",
                    kpiFilter === 'all' ? "border-primary/50 ring-2 ring-primary/20 shadow-sm" : "border-border/60"
                  )}
                >
                  <div className="bg-primary/10 text-primary p-2 rounded-lg"><FileText className="w-4 h-4" /></div>
                  <div><div className="text-lg font-bold tabular-nums">{invoiceKpis.total.toLocaleString('hu-HU')}</div><div className="text-[11px] text-muted-foreground">Összes találat</div></div>
                </div>
                <div
                  onClick={() => toggleKpiFilter('matched')}
                  className={cn(
                    "bg-card border rounded-xl p-3.5 flex items-center gap-3 cursor-pointer transition-all hover:shadow-md",
                    kpiFilter === 'matched' ? "border-emerald-500/50 ring-2 ring-emerald-500/20 shadow-sm" : "border-border/60"
                  )}
                >
                  <div className="bg-emerald-500/10 text-emerald-600 p-2 rounded-lg"><Link2 className="w-4 h-4" /></div>
                  <div><div className="text-lg font-bold tabular-nums text-emerald-600">{invoiceKpis.matched}</div><div className="text-[11px] text-muted-foreground">Párosított</div></div>
                </div>
                <div
                  onClick={() => toggleKpiFilter('suggested')}
                  className={cn(
                    "bg-card border rounded-xl p-3.5 flex items-center gap-3 cursor-pointer transition-all hover:shadow-md",
                    kpiFilter === 'suggested' ? "border-amber-500/50 ring-2 ring-amber-500/20 shadow-sm" : "border-border/60"
                  )}
                >
                  <div className="bg-amber-500/10 text-amber-500 p-2 rounded-lg"><Lightbulb className="w-4 h-4" /></div>
                  <div><div className="text-lg font-bold tabular-nums text-amber-500">{invoiceKpis.suggested}</div><div className="text-[11px] text-muted-foreground">Javasolt (jóváhagyásra vár)</div></div>
                </div>
                <div
                  onClick={() => toggleKpiFilter('unmatched')}
                  className={cn(
                    "bg-card border rounded-xl p-3.5 flex items-center gap-3 cursor-pointer transition-all hover:shadow-md",
                    kpiFilter === 'unmatched' ? "border-red-500/50 ring-2 ring-red-500/20 shadow-sm" : "border-border/60"
                  )}
                >
                  <div className="bg-red-500/10 text-red-500 p-2 rounded-lg"><Link2Off className="w-4 h-4" /></div>
                  <div><div className="text-lg font-bold tabular-nums text-red-500">{invoiceKpis.unmatched}</div><div className="text-[11px] text-muted-foreground">Nincs párosítás</div></div>
                </div>
              </div>

              {/* NAV Invoice Tabs */}
              {(activeTab === 'OUTBOUND' || activeTab === 'INBOUND') && (
                <TabsContent value={activeTab} className="space-y-4 mt-4">
                  {/* NAV Filters */}
                  <div className="flex flex-wrap items-center gap-3 min-h-[88px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 dark:text-muted-foreground h-4 w-4" />
                      <Input
                        placeholder="Keresés (partner, bizonylat, összeg...)"
                        value={filters.search}
                        onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                        className="pl-9"
                      />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Kibocsátás:</span>
                      <Popover open={issueDateFromOpen} onOpenChange={setIssueDateFromOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              "h-9 text-xs px-2.5 justify-start font-normal min-w-[130px]",
                              filters.issueDateFrom && "bg-primary/10 border-primary/50 text-primary dark:bg-primary/10 dark:border-primary dark:text-primary"
                            )}
                          >
                            <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                            {filters.issueDateFrom ? format(new Date(filters.issueDateFrom), 'yyyy. MMM dd.', { locale: hu }) : 'Dátum -tól'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={filters.issueDateFrom ? new Date(filters.issueDateFrom) : undefined}
                            onSelect={(date) => {
                              const dateStr = date ? format(date, 'yyyy-MM-dd') : '';
                              setFilters(prev => ({
                                ...prev,
                                issueDateFrom: dateStr,
                                issueDateTo: dateStr && !prev.issueDateTo ? format(new Date(), 'yyyy-MM-dd') : prev.issueDateTo,
                              }));
                              setIssueDateFromOpen(false);
                            }}
                            disabled={filters.issueDateTo ? { after: new Date(filters.issueDateTo) } : undefined}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                      <span className="text-xs text-muted-foreground">–</span>
                      <Popover open={issueDateToOpen} onOpenChange={setIssueDateToOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              "h-9 text-xs px-2.5 justify-start font-normal min-w-[130px]",
                              filters.issueDateTo && "bg-primary/10 border-primary/50 text-primary dark:bg-primary/10 dark:border-primary dark:text-primary"
                            )}
                          >
                            <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                            {filters.issueDateTo ? format(new Date(filters.issueDateTo), 'yyyy. MMM dd.', { locale: hu }) : 'Dátum -ig'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={filters.issueDateTo ? new Date(filters.issueDateTo) : undefined}
                            onSelect={(date) => {
                              setFilters(prev => ({ ...prev, issueDateTo: date ? format(date, 'yyyy-MM-dd') : '' }));
                              setIssueDateToOpen(false);
                            }}
                            disabled={filters.issueDateFrom ? { before: new Date(filters.issueDateFrom) } : undefined}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                      {(filters.issueDateFrom || filters.issueDateTo) && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setFilters(prev => ({ ...prev, issueDateFrom: '', issueDateTo: '' }))}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    <Select value={filters.currency} onValueChange={(value) => setFilters(prev => ({ ...prev, currency: value }))}>
                      <SelectTrigger className="h-9 w-[180px]">
                        <span className="truncate">{filters.currency === 'all' ? 'Pénznem' : filters.currency}</span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Minden pénznem</SelectItem>
                        {['HUF', 'EUR', 'USD', 'GBP', 'CHF', 'CZK', 'PLN', 'RON'].map((currency) => (
                          <SelectItem key={currency} value={currency}>{currency}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={filters.paid} onValueChange={(value) => setFilters(prev => ({ ...prev, paid: value }))}>
                      <SelectTrigger className="h-9 w-[140px]">
                        <span className="truncate">{filters.paid === 'all' ? 'Állapot' : filters.paid === 'yes' ? 'Kifizetve' : 'Nyitott'}</span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Mindkettő</SelectItem>
                        <SelectItem value="yes">Kifizetve</SelectItem>
                        <SelectItem value="no">Nyitott</SelectItem>
                      </SelectContent>
                    </Select>

                    {activeTab === 'INBOUND' && (
                      <Select value={filters.submitted} onValueChange={(value) => setFilters(prev => ({ ...prev, submitted: value }))}>
                        <SelectTrigger className="h-9 w-[140px]">
                          <span className="truncate">{filters.submitted === 'all' ? 'Beküldve' : filters.submitted === 'yes' ? 'Igen' : 'Nem'}</span>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Beküldve (mind)</SelectItem>
                          <SelectItem value="yes">Igen</SelectItem>
                          <SelectItem value="no">Nem</SelectItem>
                        </SelectContent>
                      </Select>
                    )}

                    {activeTab === 'INBOUND' && (
                      <Select value={filters.category} onValueChange={(value) => setFilters(prev => ({ ...prev, category: value }))}>
                        <SelectTrigger className="h-9 w-[180px]">
                          <span className="truncate">{filters.category === 'all' ? 'Kategória' : filters.category === 'none' ? 'Nincs kategória' : (categories.find(c => c.id === filters.category)?.name || 'Kategória')}</span>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Minden kategória</SelectItem>
                          <SelectItem value="none">Nincs kategória</SelectItem>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    <Select value={filters.project} onValueChange={(value) => setFilters(prev => ({ ...prev, project: value }))}>
                      <SelectTrigger className="h-9 w-[180px]">
                        <span className="truncate">{filters.project === 'all' ? 'Projekt' : filters.project === 'none' ? 'Nincs projekt' : (projects.find(p => p.id === filters.project)?.name || 'Projekt')}</span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Minden projekt</SelectItem>
                        <SelectItem value="none">Nincs projekt</SelectItem>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={filters.paymentMethod} onValueChange={(value) => setFilters(prev => ({ ...prev, paymentMethod: value }))}>
                      <SelectTrigger className="h-9 w-[180px]">
                        <span className="truncate">{filters.paymentMethod === 'all' ? 'Fiz. mód' : filters.paymentMethod === 'none' ? 'Nem megadott' : getPaymentMethodLabel(filters.paymentMethod)}</span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Minden fiz. mód</SelectItem>
                        <SelectItem value="none">Nem megadott</SelectItem>
                        <SelectItem value="TRANSFER">Átutalás</SelectItem>
                        <SelectItem value="CASH">Készpénz</SelectItem>
                        <SelectItem value="CARD">Bankkártya</SelectItem>
                        <SelectItem value="VOUCHER">Utalvány</SelectItem>
                        <SelectItem value="OTHER">Egyéb</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={filters.continuous} onValueChange={(value) => setFilters(prev => ({ ...prev, continuous: value }))}>
                      <SelectTrigger className="h-9 w-[160px]">
                        <span className="truncate">{filters.continuous === 'all' ? 'Foly. szolg.' : filters.continuous === 'yes' ? '🔄 Igen' : 'Nem'}</span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Foly. szolg. (mind)</SelectItem>
                        <SelectItem value="yes">🔄 Folyamatos</SelectItem>
                        <SelectItem value="no">Nem folyamatos</SelectItem>
                      </SelectContent>
                    </Select>

                    {hasAnyActiveFilter && (
                    <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                      <X className="h-4 w-4 mr-1" />
                      Szűrők törlése
                    </Button>
                    )}
                  </div>

                  <UnifiedPagination
                    currentPage={navCurrentPage}
                    totalPages={kpiFilteredNavTotalPages}
                    totalItems={kpiFilteredTotalItems}
                    pageSize={navPageSize}
                    onPageChange={setNavCurrentPage}
                    onPageSizeChange={(size) => { setNavPageSize(size); setNavCurrentPage(1); }}
                    className="mb-3"
                  />

                  <div className="flex items-center gap-4 mb-2 text-[11px] text-muted-foreground">
                    <span className="font-medium">Jelmagyarázat:</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm bg-[var(--row-matched-bg)] border-l-2 border-l-[var(--row-matched-border)]" />
                      <span>Párosított / Kifizetve</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm bg-[var(--row-suggested-bg)] border-l-2 border-l-[var(--row-suggested-border)]" />
                      <span>AI javaslat (jóváhagyásra vár)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm bg-destructive/10 border-l-2 border-l-destructive" />
                      <span>Nem kifizetve</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm bg-orange-500/10 border-l-2 border-l-orange-400" />
                      <span>Kompenzálandó</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm bg-background border border-border/50" />
                      <span>Nincs párosítás</span>
                    </div>
                  </div>

                  {/* NAV Invoice Table */}
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                    <div className="rounded-lg border border-border/50 overflow-x-auto">
                    <Table className="compact-table w-full tight-table">
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableHead className="w-[40px] pl-2">
                            <div className="flex items-center gap-2">
                              <div className="w-3.5" />
                              <Checkbox
                                checked={allVisibleSelected}
                                onCheckedChange={(checked) => handleSelectAll(!!checked)}
                                aria-label="Összes kijelölése"
                              />
                            </div>
                          </TableHead>
                          <TableHead className="cursor-pointer hover:bg-muted/50 font-semibold" onClick={() => handleSort('partner_name')}>
                            <div className="flex items-center gap-1">Partner<ArrowUpDown className="h-3 w-3 text-muted-foreground" /></div>
                          </TableHead>
                          <TableHead className="cursor-pointer hover:bg-muted/50 font-semibold text-center whitespace-nowrap" onClick={() => handleSort('invoice_issue_date')}>
                            <div className="flex items-center justify-center gap-1">Kiáll.<ArrowUpDown className="h-3 w-3 text-muted-foreground" /></div>
                          </TableHead>
                          <TableHead className="cursor-pointer hover:bg-muted/50 font-semibold text-center whitespace-nowrap" onClick={() => handleSort('invoice_delivery_date')}>
                            <div className="flex items-center justify-center gap-1">Telj.<ArrowUpDown className="h-3 w-3 text-muted-foreground" /></div>
                          </TableHead>
                          <TableHead className="cursor-pointer hover:bg-muted/50 font-semibold whitespace-nowrap min-w-[110px]" onClick={() => handleSort('invoice_number')}>
                            <div className="flex items-center gap-1">Biz.szám<ArrowUpDown className="h-3 w-3 text-muted-foreground" /></div>
                          </TableHead>
                          <TableHead className="text-right cursor-pointer hover:bg-muted/50 font-semibold whitespace-nowrap" onClick={() => handleSort('invoice_net_amount')}>
                            <div className="flex items-center justify-end gap-1"><ArrowUpDown className="h-3 w-3 text-muted-foreground" />Nettó</div>
                          </TableHead>
                          <TableHead className="text-right cursor-pointer hover:bg-muted/50 font-semibold whitespace-nowrap" onClick={() => handleSort('invoice_gross_amount')}>
                            <div className="flex items-center justify-end gap-1"><ArrowUpDown className="h-3 w-3 text-muted-foreground" />Bruttó</div>
                          </TableHead>
                          <TableHead className="text-right cursor-pointer hover:bg-muted/50 font-semibold whitespace-nowrap" onClick={() => handleSort('invoice_vat_amount')}>
                            <div className="flex items-center justify-end gap-1"><ArrowUpDown className="h-3 w-3 text-muted-foreground" />ÁFA</div>
                          </TableHead>
                          <TableHead className="font-semibold text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              Státusz
                              <TooltipProvider delayDuration={0}><Tooltip><TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground/60 cursor-help" /></TooltipTrigger><TooltipContent side="top" align="end" sideOffset={8} className="max-w-[280px] whitespace-normal"><p className="text-xs font-normal normal-case tracking-normal leading-relaxed whitespace-normal">A számla fizetési állapota automatikusan változik: „Kifizetve" lesz, ha a számlához tartozó tranzakció párosítva van.</p></TooltipContent></Tooltip></TooltipProvider>
                            </div>
                          </TableHead>
                          {activeTab === 'INBOUND' && (<TableHead className="font-semibold text-center whitespace-nowrap">Beküldve</TableHead>)}
                          {activeTab === 'INBOUND' && (<TableHead className="font-semibold text-center whitespace-nowrap">Kategória</TableHead>)}
                          <TableHead className="font-semibold text-center whitespace-nowrap">Projekt</TableHead>
                          <TableHead className="font-semibold text-center whitespace-nowrap">Fiz. mód</TableHead>
                          <TableHead className="font-semibold text-center whitespace-nowrap">Számla kép</TableHead>
                          <TableHead className="font-semibold text-center whitespace-nowrap">Tételek</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(loading || tabFetching) ? (
                          <TableSkeleton rows={10} columns={activeTab === 'INBOUND' ? 15 : 13} />
                        ) : displayedNavInvoices.length === 0 ? (
                          <TableEmptyState colSpan={activeTab === 'INBOUND' ? 15 : 13} title={kpiFilter !== 'all' ? "Nincs ilyen státuszú számla ezen az oldalon" : "Nincs megjeleníthető számla"} description={kpiFilter !== 'all' ? "Kattints az \"Összes találat\" KPI kártyára a szűrő törléséhez." : "Próbáld módosítani a szűrőket vagy keresési feltételeket."} onClearFilters={kpiFilter !== 'all' ? () => setKpiFilter('all') : clearFilters} />
                        ) : (
                          displayedNavInvoices.map((invoice) => {
                            const partnerTaxNumber = getPartnerTaxNumber(invoice);
                            const partnerName = getInvoicePartnerName(invoice);
                            // Check paid status from multiple sources:
                            // 1. nav_invoices.paid / nav_invoices.transaction_id (legacy)
                            // 2. transactions.matched_invoice_id pointing directly to this NAV invoice
                            // 3. Indirect: submitted invoice (same bizonylatsorszam) has a matched transaction
                            // 4. Linked chain: any linked invoice (via reference_number) has a matched transaction
                            const directlyMatched = matchedInvoiceIds.has(invoice.id);
                            const submittedMatches = navToSubmittedMap.get(normalizeInvNum(invoice.invoice_number)) || [];
                            const indirectlyMatched = submittedMatches.some(sub => submittedIdToTransactionsMap.has(sub.id));
                            const linkedChainMatched = !indirectlyMatched && submittedMatches.some(sub => {
                              const linked = getLinkedInvoices(sub);
                              return linked.some(l => submittedIdToTransactionsMap.has(l.id));
                            });
                            const isPaid = invoice.paid === true || !!invoice.transaction_id || !!invoice.is_manual_payment || directlyMatched || indirectlyMatched || linkedChainMatched;
                            const isNettingCandidate = nettingInvoiceIds.has(invoice.id);
                            return (
                              <React.Fragment key={invoice.id}>
                                <TableRow data-row-hover className={cn(
                                  "group cursor-pointer transition-colors",
                                  selectedInvoiceIds.has(invoice.id) && "bg-primary/10",
                                  !selectedInvoiceIds.has(invoice.id) && isPaid && !suggestedOnlyIds.has(invoice.id) && "bg-[var(--row-matched-bg)]",
                                  !selectedInvoiceIds.has(invoice.id) && suggestedOnlyIds.has(invoice.id) && "bg-[var(--row-suggested-bg)]",
                                  !selectedInvoiceIds.has(invoice.id) && !isPaid && !suggestedOnlyIds.has(invoice.id) && !isNettingCandidate && "bg-[var(--row-unmatched-bg)]",
                                  !selectedInvoiceIds.has(invoice.id) && isNettingCandidate && !isPaid && !suggestedOnlyIds.has(invoice.id) && "bg-orange-500/[0.06]",
                                  expandedRowIds.has(invoice.id) && "border-b-0"
                                )} onClick={(e) => handleRowClick(invoice.id, e)}>
                                  <TableCell className="pl-2">
                                    <div className="flex items-center gap-2">
                                      <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200", expandedRowIds.has(invoice.id) && "rotate-180")} />
                                      <Checkbox checked={selectedInvoiceIds.has(invoice.id)} onCheckedChange={(checked) => handleRowSelect(invoice.id, !!checked)} aria-label={`${invoice.invoice_number} kijelölése`} />
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0", getAvatarColor(partnerName))}>{getInitials(partnerName)}</div>
                                      {partnerName === 'Ismeretlen partner' ? (
                                        <span className="text-xs text-muted-foreground italic">Ismeretlen partner</span>
                                      ) : (
                                        <CopyableCell value={partnerName} displayValue={partnerName.length > 16 ? partnerName.slice(0, 16) + '…' : partnerName} truncate maxWidth="100%" className="font-medium text-xs" ariaLabel={`${partnerName} másolása`} />
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center text-muted-foreground tabular-nums whitespace-nowrap">
                                    {invoice.invoice_issue_date ? format(new Date(invoice.invoice_issue_date), 'yyyy.MM.dd.', { locale: hu }) : '-'}
                                  </TableCell>
                                  <TableCell className="text-center text-muted-foreground tabular-nums whitespace-nowrap">
                                    {invoice.invoice_delivery_date ? format(new Date(invoice.invoice_delivery_date), 'yyyy.MM.dd.', { locale: hu }) : '-'}
                                  </TableCell>
                                  <TableCell className="font-medium font-mono whitespace-nowrap">
                                     <CopyableCell value={invoice.invoice_number || '-'} ariaLabel={`${invoice.invoice_number} bizonylatsorszám másolása`} />
                                   </TableCell>
                                  <TableCell className={cn("text-right font-mono tabular-nums whitespace-nowrap", !invoice.invoice_net_amount ? "text-muted-foreground" : activeTab === 'INBOUND' ? "text-destructive" : "text-success")}>
                                    {formatCurrency(invoice.invoice_net_amount || 0, invoice.currency || 'HUF')}
                                  </TableCell>
                                  <TableCell className={cn("text-right font-mono tabular-nums font-medium whitespace-nowrap", !invoice.invoice_gross_amount ? "text-muted-foreground" : activeTab === 'INBOUND' ? "text-destructive" : "text-success")}>
                                    {formatCurrency(invoice.invoice_gross_amount || 0, invoice.currency || 'HUF')}
                                  </TableCell>
                                  <TableCell className="text-right font-mono tabular-nums text-muted-foreground whitespace-nowrap">
                                    {formatCurrency(invoice.invoice_vat_amount || 0, invoice.currency || 'HUF')}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                      <span className={`inline-flex items-center justify-center min-w-[72px] px-2 py-0.5 rounded-md text-xs font-medium border border-black/10 dark:border-white/10 ${isPaid ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                                        {isPaid ? 'Kifizetve' : 'Nyitott'}
                                      </span>
                                      {isNettingCandidate && (
                                        <TooltipProvider delayDuration={200}>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-400/40 whitespace-nowrap cursor-help">
                                                <Scale className="h-3 w-3" />
                                                Kompenzálandó
                                              </span>
                                            </TooltipTrigger>
                                            <TooltipContent side="left" className="max-w-[280px]">
                                              {(() => {
                                                const ng = getNettingGroup(invoice.id);
                                                if (!ng) return null;
                                                return (
                                                  <div className="text-xs space-y-1">
                                                    <p className="font-semibold">{ng.partnerName}</p>
                                                    <p className="text-muted-foreground">Teljesítési hónap: {ng.deliveryMonth}</p>
                                                    <p>Bejövő: <span className="font-mono text-destructive">{formatCurrency(ng.inboundTotal, ng.currency)}</span></p>
                                                    <p>Kimenő: <span className="font-mono text-success">{formatCurrency(ng.outboundTotal, ng.currency)}</span></p>
                                                    <p className="font-medium pt-0.5 border-t border-border/30">Különbözet: <span className="font-mono">{formatCurrency(Math.abs(ng.netDifference), ng.currency)}</span></p>
                                                  </div>
                                                );
                                              })()}
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      )}
                                      {invoice.exclude_from_accounting && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-300/40 whitespace-nowrap">
                                          Nem könyvelt
                                        </span>
                                      )}
                                      {invoice.is_continuous && (
                                        <TooltipProvider delayDuration={200}>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-400/40 whitespace-nowrap cursor-help">
                                                🔄 Foly.
                                              </span>
                                            </TooltipTrigger>
                                            <TooltipContent side="left" className="max-w-[280px]">
                                              <div className="text-xs space-y-1">
                                                <p className="font-semibold">Folyamatos szolgáltatás</p>
                                                {invoice.service_period_start && invoice.service_period_end && (
                                                  <p className="text-muted-foreground">
                                                    Szolg. időszak: {format(new Date(invoice.service_period_start), 'yyyy.MM.dd', { locale: hu })} – {format(new Date(invoice.service_period_end), 'yyyy.MM.dd', { locale: hu })}
                                                  </p>
                                                )}
                                                {(invoice.calculated_ti || invoice.ti_override) && (
                                                  <p>TI: <span className="font-mono">{format(new Date(invoice.ti_override || invoice.calculated_ti!), 'yyyy.MM.dd', { locale: hu })}</span>
                                                    <span className="text-muted-foreground/70 ml-1">({invoice.ti_calculation_method === 'manual' ? 'kézi' : invoice.ti_calculation_method === 'nav_period_end' ? 'NAV' : invoice.ti_calculation_method === 'payment_due' ? 'fiz. hat.' : 'telj. dátum'})</span>
                                                  </p>
                                                )}
                                              </div>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      )}
                                    </div>
                                  </TableCell>
                                  {activeTab === 'INBOUND' && (
                                    <TableCell className="text-center">
                                      <Checkbox checked={invoice.submitted === true || (navToSubmittedMap.get(normalizeInvNum(invoice.invoice_number))?.length ?? 0) > 0} disabled className="cursor-default opacity-70" />
                                    </TableCell>
                                  )}
                                  {activeTab === 'INBOUND' && (() => {
                                    const submittedMatches = navToSubmittedMap.get(normalizeInvNum(invoice.invoice_number)) || [];
                                    const effectiveCategoryId = invoice.category_id || submittedMatches[0]?.category_id || null;
                                    return (
                                      <TableCell className="text-center">
                                        <Select value={effectiveCategoryId || 'none'} onValueChange={(value) => handleCategoryChange(invoice.id, value, invoice.invoice_number)}>
                                          <SelectTrigger className="w-[100px] h-8 mx-auto bg-transparent border-transparent hover:border-border/50 focus:border-primary/50 transition-colors [&>span]:truncate [&>span]:flex-1 [&>svg]:shrink-0"><SelectValue placeholder="Válassz..." /></SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="none">-</SelectItem>
                                            {categories.map((category) => (<SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>))}
                                          </SelectContent>
                                        </Select>
                                      </TableCell>
                                    );
                                  })()}
                                  <TableCell className="text-center">
                                    {(() => {
                                      const submittedMatches = navToSubmittedMap.get(normalizeInvNum(invoice.invoice_number)) || [];
                                      const effectiveProjectId = invoice.project_id || submittedMatches[0]?.project_id || null;
                                      return (
                                        <Select value={effectiveProjectId || 'none'} onValueChange={(value) => handleProjectChange(invoice.id, value, invoice.invoice_number)}>
                                          <SelectTrigger className="w-[100px] h-8 mx-auto bg-transparent border-transparent hover:border-border/50 focus:border-primary/50 transition-colors [&>span]:truncate [&>span]:flex-1 [&>svg]:shrink-0"><SelectValue placeholder="Válassz..." /></SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="none">-</SelectItem>
                                            {projects.map((project) => (<SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>))}
                                          </SelectContent>
                                        </Select>
                                      );
                                    })()}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-muted/50 text-muted-foreground border border-black/10 dark:border-white/10">{getPaymentMethodLabel(invoice.payment_method)}</span>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {(() => {
                                      const matchedSubs = navToSubmittedMap.get(normalizeInvNum(invoice.invoice_number));
                                      const sub = matchedSubs?.find(s => s.image_url || s.melleklet_url);
                                      if (sub) {
                                        return (
                                          <HoverCard openDelay={200} closeDelay={100}>
                                            <HoverCardTrigger asChild>
                                              <Button size="sm" variant="ghost" className="h-8 w-8 opacity-70 group-hover:opacity-100" onClick={() => { setSelectedInvoice(sub as any); setImageDialogOpen(true); }}>
                                                <FileText className="h-4 w-4" />
                                              </Button>
                                            </HoverCardTrigger>
                                            <HoverCardContent side="left" align="center" className="w-64 p-1.5">
                                              <InvoiceImagePreview invoiceId={sub.id} imageUrl={sub.image_url} mellekletUrl={sub.melleklet_url} isOpen={true} />
                                            </HoverCardContent>
                                          </HoverCard>
                                        );
                                      }
                                      return (
                                        <FileText className="h-4 w-4 mx-auto text-muted-foreground/30" />
                                      );
                                    })()}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <TooltipProvider><Tooltip><TooltipTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-70 group-hover:opacity-100" onClick={() => { setSelectedNavInvoice(invoice); setItemsDialogOpen(true); setInvoiceParam(invoice.id); }}>
                                        <Package className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger><TooltipContent><p>Számlatételek megtekintése</p></TooltipContent></Tooltip></TooltipProvider>
                                  </TableCell>
                                </TableRow>
                                {expandedRowIds.has(invoice.id) && (() => {
                                  const matches = getNavInvoiceMatches(invoice);
                                  return (
                                    <ExpandedInvoiceRow
                                      colSpan={activeTab === 'INBOUND' ? 15 : 13}
                                      matchedSubmittedInvoices={matches.matchedSubmitted}
                                      matchedNavInvoices={[]}
                                      matchedTransactions={matches.matchedTransactions}
                                      matchedCourierReports={matches.matchedCourierReports}
                                      linkedInvoices={matches.linkedInvoices}
                                      linkedInvoicesLoading={linkedInvoicesLoading}
                                      onViewInvoice={(inv) => { setSelectedInvoice(inv as any); setImageDialogOpen(true); }}
                                      excludeFromAccounting={!!invoice.exclude_from_accounting}
                                      onToggleExclude={() => handleToggleExclude(invoice.id, 'nav_invoices', !!invoice.exclude_from_accounting)}
                                      invoiceId={invoice.id}
                                      invoiceAmount={invoice.invoice_gross_amount || 0}
                                      invoiceCurrency={invoice.currency || 'HUF'}
                                      invoiceDate={invoice.invoice_issue_date || ''}
                                      companyId={companyId}
                                      invoiceSource="nav"
                                      onMatchUpdate={invalidateInvoiceData}
                                      glNumbers={invoice.gl_numbers}
                                      hasSubmittedMatch={submittedMatches.length > 0}
                                      categories={categories}
                                      projects={projects}
                                      nettingGroup={getNettingGroup(invoice.id)}
                                      isContinuous={!!invoice.is_continuous}
                                      servicePeriodStart={invoice.service_period_start}
                                      servicePeriodEnd={invoice.service_period_end}
                                      calculatedTi={invoice.calculated_ti}
                                      tiOverride={invoice.ti_override}
                                      tiCalculationMethod={invoice.ti_calculation_method}
                                      invoiceOperation={invoice.invoice_operation}
                                      isManualPayment={invoice.is_manual_payment}
                                      invoiceNumber={invoice.invoice_number}
                                    />
                                  );
                                })()}
                              </React.Fragment>
                            );
                          })
                        )}
                        <TablePlaceholderRows currentCount={paginatedNavInvoices.length} pageSize={navPageSize} columns={activeTab === 'INBOUND' ? 15 : 13} />
                      </TableBody>
                    </Table>
                  </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem onClick={() => {
                        setExpandedRowIds(new Set(paginatedNavInvoices.map(i => i.id)));
                      }}>
                        <ChevronsUpDown className="h-3.5 w-3.5 mr-2" />
                        Összes lenyitás
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => setExpandedRowIds(new Set())}>
                        <ChevronsDownUp className="h-3.5 w-3.5 mr-2" />
                        Összes bezárás
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>

                  <UnifiedPagination
                    currentPage={navCurrentPage}
                    totalPages={kpiFilteredNavTotalPages}
                    totalItems={kpiFilteredTotalItems}
                    pageSize={navPageSize}
                    onPageChange={setNavCurrentPage}
                    onPageSizeChange={(size) => { setNavPageSize(size); setNavCurrentPage(1); }}
                    className="mt-3"
                  />

                  {selectedInvoiceIds.size > 0 && (
                    <div className="flex items-center gap-2 text-sm text-primary px-2">
                      <span className="font-medium">{selectedInvoiceIds.size} számla kijelölve újrakategorizálásra</span>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground hover:text-foreground" onClick={() => setSelectedInvoiceIds(new Set())}>
                        <X className="h-3 w-3 mr-1" />Törlés
                      </Button>
                    </div>
                  )}
                </TabsContent>
              )}

              {/* Submitted Invoices Tabs */}
              {isSubmittedTab && (
                <TabsContent value={activeTab} className="space-y-4 mt-4">
                  <div className="flex flex-wrap items-center gap-3 min-h-[88px]">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input placeholder="Keresés (partner, bizonylat, összeg...)" value={filters.search} onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))} className="pl-9" />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Kibocsátás:</span>
                      <Popover open={issueDateFromOpen} onOpenChange={setIssueDateFromOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              "h-9 text-xs px-2.5 justify-start font-normal min-w-[130px]",
                              filters.issueDateFrom && "bg-primary/10 border-primary/50 text-primary dark:bg-primary/10 dark:border-primary dark:text-primary"
                            )}
                          >
                            <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                            {filters.issueDateFrom ? format(new Date(filters.issueDateFrom), 'yyyy. MMM dd.', { locale: hu }) : 'Dátum -tól'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={filters.issueDateFrom ? new Date(filters.issueDateFrom) : undefined}
                            onSelect={(date) => {
                              const dateStr = date ? format(date, 'yyyy-MM-dd') : '';
                              setFilters(prev => ({
                                ...prev,
                                issueDateFrom: dateStr,
                                issueDateTo: dateStr && !prev.issueDateTo ? format(new Date(), 'yyyy-MM-dd') : prev.issueDateTo,
                              }));
                              setIssueDateFromOpen(false);
                            }}
                            disabled={filters.issueDateTo ? { after: new Date(filters.issueDateTo) } : undefined}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                      <span className="text-xs text-muted-foreground">–</span>
                      <Popover open={issueDateToOpen} onOpenChange={setIssueDateToOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              "h-9 text-xs px-2.5 justify-start font-normal min-w-[130px]",
                              filters.issueDateTo && "bg-primary/10 border-primary/50 text-primary dark:bg-primary/10 dark:border-primary dark:text-primary"
                            )}
                          >
                            <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                            {filters.issueDateTo ? format(new Date(filters.issueDateTo), 'yyyy. MMM dd.', { locale: hu }) : 'Dátum -ig'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={filters.issueDateTo ? new Date(filters.issueDateTo) : undefined}
                            onSelect={(date) => {
                              setFilters(prev => ({ ...prev, issueDateTo: date ? format(date, 'yyyy-MM-dd') : '' }));
                              setIssueDateToOpen(false);
                            }}
                            disabled={filters.issueDateFrom ? { before: new Date(filters.issueDateFrom) } : undefined}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                      {(filters.issueDateFrom || filters.issueDateTo) && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setFilters(prev => ({ ...prev, issueDateFrom: '', issueDateTo: '' }))}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    <Select value={filters.currency} onValueChange={(value) => setFilters(prev => ({ ...prev, currency: value }))}>
                      <SelectTrigger className="h-9 w-[180px]">
                        <span className="truncate">{filters.currency === 'all' ? 'Pénznem' : filters.currency}</span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Minden pénznem</SelectItem>
                        {Array.from(new Set(submittedInvoices.map(inv => inv.penznem).filter(Boolean))).sort().map((currency) => (
                          <SelectItem key={currency} value={currency!}>{currency}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={filters.paymentMethod} onValueChange={(value) => setFilters(prev => ({ ...prev, paymentMethod: value }))}>
                      <SelectTrigger className="h-9 w-[180px]">
                        <span className="truncate">{filters.paymentMethod === 'all' ? 'Fiz. mód' : filters.paymentMethod === 'none' ? 'Nem megadott' : filters.paymentMethod}</span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Minden fiz. mód</SelectItem>
                        <SelectItem value="none">Nem megadott</SelectItem>
                        <SelectItem value="Átutalás">Átutalás</SelectItem>
                        <SelectItem value="Készpénz">Készpénz</SelectItem>
                        <SelectItem value="Bankkártya">Bankkártya</SelectItem>
                        <SelectItem value="Utalvány">Utalvány</SelectItem>
                        <SelectItem value="Egyéb">Egyéb</SelectItem>
                      </SelectContent>
                    </Select>

                    {hasAnyActiveFilter && (
                    <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                      <X className="h-4 w-4 mr-1" />
                      Szűrők törlése
                    </Button>
                    )}
                  </div>

                  <UnifiedPagination
                    currentPage={submittedCurrentPage}
                    totalPages={kpiFilteredSubmittedTotalPages}
                    totalItems={kpiFilteredTotalItems}
                    pageSize={submittedPageSize}
                    onPageChange={setSubmittedCurrentPage}
                    onPageSizeChange={(size) => { setSubmittedPageSize(size); setSubmittedCurrentPage(1); }}
                    className="mb-3"
                  />

                  <div className="flex items-center gap-4 mb-2 text-[11px] text-muted-foreground">
                    <span className="font-medium">Jelmagyarázat:</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm bg-[var(--row-matched-bg)] border-l-2 border-l-[var(--row-matched-border)]" />
                      <span>Párosított / Kifizetve</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm bg-[var(--row-suggested-bg)] border-l-2 border-l-[var(--row-suggested-border)]" />
                      <span>AI javaslat (jóváhagyásra vár)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm bg-destructive/10 border-l-2 border-l-destructive" />
                      <span>Nem kifizetve</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm bg-background border border-border/50" />
                      <span>Nincs párosítás</span>
                    </div>
                  </div>

                  {/* Submitted Invoice Table */}
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                    <div className="rounded-lg border border-border/50 overflow-x-auto">
                    <Table className="compact-table w-full tight-table">
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableHead className="w-[40px] pl-2">
                            <div className="flex items-center gap-2">
                              <div className="w-3.5" />
                              <Checkbox checked={allVisibleSubmittedSelected} onCheckedChange={(checked) => handleSubmittedSelectAll(!!checked)} aria-label="Összes kijelölése" />
                            </div>
                          </TableHead>
                          <TableHead className="cursor-pointer hover:bg-muted/50 font-semibold" onClick={() => handleSort(activeTab === 'SUBMITTED_INBOUND' ? 'elado_nev' : 'vevo_nev')}>
                            <div className="flex items-center gap-1">Partner<ArrowUpDown className="h-3 w-3 text-muted-foreground" /></div>
                          </TableHead>
                          <TableHead className="cursor-pointer hover:bg-muted/50 font-semibold text-center whitespace-nowrap" onClick={() => handleSort('kibocsatas_datuma')}>
                            <div className="flex items-center justify-center gap-1">Kiáll.<ArrowUpDown className="h-3 w-3 text-muted-foreground" /></div>
                          </TableHead>
                          <TableHead className="cursor-pointer hover:bg-muted/50 font-semibold text-center whitespace-nowrap" onClick={() => handleSort('teljesites_datuma')}>
                            <div className="flex items-center justify-center gap-1">Telj.<ArrowUpDown className="h-3 w-3 text-muted-foreground" /></div>
                          </TableHead>
                          <TableHead className="cursor-pointer hover:bg-muted/50 font-semibold whitespace-nowrap" onClick={() => handleSort('bizonylatsorszam')}>
                            <div className="flex items-center gap-1">Biz.szám<ArrowUpDown className="h-3 w-3 text-muted-foreground" /></div>
                          </TableHead>
                          <TableHead className="text-right cursor-pointer hover:bg-muted/50 font-semibold whitespace-nowrap" onClick={() => handleSort('adoalap_osszesen')}>
                            <div className="flex items-center justify-end gap-1"><ArrowUpDown className="h-3 w-3 text-muted-foreground" />Nettó</div>
                          </TableHead>
                          <TableHead className="text-right cursor-pointer hover:bg-muted/50 font-semibold whitespace-nowrap" onClick={() => handleSort('brutto_vegosszeg')}>
                            <div className="flex items-center justify-end gap-1"><ArrowUpDown className="h-3 w-3 text-muted-foreground" />Bruttó</div>
                          </TableHead>
                          <TableHead className="text-right cursor-pointer hover:bg-muted/50 font-semibold whitespace-nowrap" onClick={() => handleSort('afa_osszeg_osszesen')}>
                            <div className="flex items-center justify-end gap-1"><ArrowUpDown className="h-3 w-3 text-muted-foreground" />ÁFA</div>
                          </TableHead>
                          <TableHead className="font-semibold text-center whitespace-nowrap">Fiz. mód</TableHead>
                          <TableHead className="font-semibold text-center whitespace-nowrap">Tételek</TableHead>
                          <TableHead className="font-semibold text-center whitespace-nowrap">Számla kép</TableHead>
                          <TableHead className="text-center font-semibold whitespace-nowrap">Műveletek</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(loading || tabFetching) ? (
                          <TableSkeleton rows={10} columns={12} />
                        ) : displayedSubmittedInvoices.length === 0 ? (
                          <TableEmptyState colSpan={12} title={kpiFilter !== 'all' ? "Nincs ilyen státuszú számla ezen az oldalon" : "Nincs megjeleníthető számla"} description={kpiFilter !== 'all' ? "Kattints az \"Összes találat\" KPI kártyára a szűrő törléséhez." : "Próbáld módosítani a szűrőket vagy keresési feltételeket."} />
                        ) : (
                          displayedSubmittedInvoices.map((invoice) => (
                            <React.Fragment key={invoice.id}>
                              <TableRow data-row-hover className={cn(
                                "group cursor-pointer",
                                selectedSubmittedIds.has(invoice.id) && "bg-primary/5",
                                !selectedSubmittedIds.has(invoice.id) && extendedMatchedIds.has(invoice.id) && !suggestedOnlyIds.has(invoice.id) && "bg-[var(--row-matched-bg)]",
                                !selectedSubmittedIds.has(invoice.id) && suggestedOnlyIds.has(invoice.id) && "bg-[var(--row-suggested-bg)]",
                                !selectedSubmittedIds.has(invoice.id) && !extendedMatchedIds.has(invoice.id) && !suggestedOnlyIds.has(invoice.id) && "bg-[var(--row-unmatched-bg)]",
                                expandedRowIds.has(invoice.id) && "border-b-0"
                              )} onClick={(e) => handleRowClick(invoice.id, e)}>
                                <TableCell className="pl-2">
                                  <div className="flex items-center gap-2">
                                    <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200", expandedRowIds.has(invoice.id) && "rotate-180")} />
                                    <Checkbox checked={selectedSubmittedIds.has(invoice.id)} onCheckedChange={(checked) => handleSubmittedRowSelect(invoice.id, !!checked)} aria-label={`${invoice.bizonylatsorszam || invoice.id} kijelölése`} />
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {(() => {
                                    const partnerName = activeTab === 'SUBMITTED_INBOUND' ? (invoice.elado_nev || '-') : (invoice.vevo_nev || '-');
                                    return (
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0", getAvatarColor(partnerName))}>{getInitials(partnerName)}</div>
                                        {partnerName === '-' || partnerName === 'Ismeretlen partner' ? (
                                          <span className="text-xs text-muted-foreground italic">Ismeretlen partner</span>
                                        ) : (
                                          <CopyableCell value={partnerName} displayValue={partnerName.length > 16 ? partnerName.slice(0, 16) + '…' : partnerName} truncate maxWidth="100%" className="font-medium text-xs" ariaLabel={`${partnerName} másolása`} />
                                        )}
                                      </div>
                                    );
                                  })()}
                                </TableCell>
                                <TableCell className="text-center text-muted-foreground tabular-nums whitespace-nowrap">
                                  {invoice.kibocsatas_datuma ? format(new Date(invoice.kibocsatas_datuma), 'yyyy.MM.dd.', { locale: hu }) : '-'}
                                </TableCell>
                                <TableCell className="text-center text-muted-foreground tabular-nums whitespace-nowrap">
                                  {invoice.teljesites_datuma ? format(new Date(invoice.teljesites_datuma), 'yyyy.MM.dd.', { locale: hu }) : '-'}
                                </TableCell>
                                <TableCell className="font-medium font-mono">
                                  <CopyableCell value={invoice.bizonylatsorszam || '-'} ariaLabel={`${invoice.bizonylatsorszam} bizonylatsorszám másolása`} />
                                </TableCell>
                                <TableCell className={cn("text-right font-mono tabular-nums whitespace-nowrap", invoice.reference_number ? "text-muted-foreground italic" : !invoice.adoalap_osszesen ? "text-muted-foreground" : activeTab === 'SUBMITTED_INBOUND' ? "text-destructive" : "text-success")}>
                                  {formatCurrency(invoice.adoalap_osszesen || 0, invoice.penznem || 'HUF')}
                                </TableCell>
                                <TableCell className={cn("text-right font-mono tabular-nums font-medium whitespace-nowrap", invoice.reference_number ? "text-muted-foreground italic" : !invoice.brutto_vegosszeg ? "text-muted-foreground" : activeTab === 'SUBMITTED_INBOUND' ? "text-destructive" : "text-success")}>
                                  {formatCurrency(invoice.brutto_vegosszeg || 0, invoice.penznem || 'HUF')}
                                </TableCell>
                                <TableCell className="text-right font-mono tabular-nums text-muted-foreground whitespace-nowrap">
                                  {formatCurrency(invoice.afa_osszeg_osszesen || 0, invoice.penznem || 'HUF')}
                                </TableCell>
                                <TableCell className="text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-muted/50 text-muted-foreground border border-black/10 dark:border-white/10">{invoice.fizetesi_mod || 'Nem megadott'}</span>
                                    {invoice.exclude_from_accounting && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-300/40 whitespace-nowrap">
                                        Nem könyvelt
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  <TooltipProvider><Tooltip><TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-70 group-hover:opacity-100" onClick={() => { setSelectedSubmittedForItems(invoice); setSubmittedItemsDialogOpen(true); setInvoiceParam(invoice.id); }}>
                                      <Package className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger><TooltipContent><p>Számlatételek megtekintése</p></TooltipContent></Tooltip></TooltipProvider>
                                </TableCell>
                                <TableCell className="text-center">
                                  {(invoice.image_url || invoice.melleklet_url) ? (
                                    <HoverCard openDelay={200} closeDelay={100}>
                                      <HoverCardTrigger asChild>
                                        <Button size="sm" variant="ghost" className="h-8 w-8 opacity-70 group-hover:opacity-100" onClick={() => openImageDialog(invoice)}>
                                          <FileText className="h-4 w-4" />
                                        </Button>
                                      </HoverCardTrigger>
                                      <HoverCardContent side="left" align="center" className="w-64 p-1.5">
                                        <InvoiceImagePreview invoiceId={invoice.id} imageUrl={invoice.image_url} mellekletUrl={invoice.melleklet_url} isOpen={true} />
                                      </HoverCardContent>
                                    </HoverCard>
                                  ) : (
                                    <FileText className="h-4 w-4 mx-auto text-muted-foreground/30" />
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  <TooltipProvider><Tooltip><TooltipTrigger asChild>
                                    <Button size="sm" variant="ghost" className="h-8 w-8 opacity-70 group-hover:opacity-100" onClick={() => openEditDialog(invoice)} disabled={!writable}>
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger><TooltipContent><p>Számla szerkesztése</p></TooltipContent></Tooltip></TooltipProvider>
                                </TableCell>
                              </TableRow>
                              {expandedRowIds.has(invoice.id) && (() => {
                                const matches = getSubmittedInvoiceMatches(invoice);
                                return (
                                  <ExpandedInvoiceRow
                                    colSpan={12}
                                    matchedSubmittedInvoices={[]}
                                    matchedNavInvoices={matches.matchedNav}
                                    matchedTransactions={matches.matchedTransactions}
                                    linkedInvoices={matches.linkedInvoices}
                                    invoiceReferenceNumber={invoice.reference_number}
                                    linkedInvoicesLoading={linkedInvoicesLoading}
                                    onViewInvoice={(inv) => { setSelectedInvoice(inv as any); setImageDialogOpen(true); }}
                                    excludeFromAccounting={!!invoice.exclude_from_accounting}
                                    onToggleExclude={() => handleToggleExclude(invoice.id, 'invoices', !!invoice.exclude_from_accounting)}
                                    invoiceId={invoice.id}
                                    invoiceAmount={invoice.brutto_vegosszeg || 0}
                                    invoiceCurrency={invoice.penznem || 'HUF'}
                                    invoiceDate={invoice.kibocsatas_datuma || ''}
                                    companyId={companyId}
                                    invoiceSource="submitted"
                                    onMatchUpdate={invalidateInvoiceData}
                                    categories={categories}
                                    projects={projects}
                                  />
                                );
                              })()}
                            </React.Fragment>
                          ))
                        )}
                        <TablePlaceholderRows currentCount={paginatedSubmittedInvoices.length} pageSize={submittedPageSize} columns={12} />
                      </TableBody>
                    </Table>
                  </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem onClick={() => {
                        setExpandedRowIds(new Set(paginatedSubmittedInvoices.map(i => i.id)));
                      }}>
                        <ChevronsUpDown className="h-3.5 w-3.5 mr-2" />
                        Összes lenyitás
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => setExpandedRowIds(new Set())}>
                        <ChevronsDownUp className="h-3.5 w-3.5 mr-2" />
                        Összes bezárás
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>

                  <UnifiedPagination
                    currentPage={submittedCurrentPage}
                    totalPages={kpiFilteredSubmittedTotalPages}
                    totalItems={kpiFilteredTotalItems}
                    pageSize={submittedPageSize}
                    onPageChange={setSubmittedCurrentPage}
                    onPageSizeChange={(size) => { setSubmittedPageSize(size); setSubmittedCurrentPage(1); }}
                    className="mt-3"
                  />

                  {selectedSubmittedIds.size > 0 && (
                    <div className="flex items-center gap-2 text-sm text-primary px-2">
                      <span className="font-medium">{selectedSubmittedIds.size} számla kijelölve</span>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground hover:text-foreground" onClick={() => setSelectedSubmittedIds(new Set())}>
                        <X className="h-3 w-3 mr-1" />Törlés
                      </Button>
                    </div>
                  )}
                </TabsContent>
              )}
            </Tabs>
          </CardContent>
        </Card>
      </main>

      <InvoiceImageDialog
        invoice={selectedInvoice ? {
          id: selectedInvoice.id,
          bizonylatsorszam: selectedInvoice.bizonylatsorszam || '',
          image_url: selectedInvoice.image_url,
          melleklet_url: selectedInvoice.melleklet_url,
          elado_nev: selectedInvoice.elado_nev,
          vevo_nev: selectedInvoice.vevo_nev,
        } : null}
        open={imageDialogOpen}
        onClose={() => { setImageDialogOpen(false); setSelectedInvoice(null); setInvoiceParam(null); }}
      />

      <InvoiceFullEditDialog
        invoice={selectedInvoice}
        categories={categories}
        projects={projects}
        open={editDialogOpen}
        onClose={() => { setEditDialogOpen(false); setSelectedInvoice(null); setInvoiceParam(null); }}
        onSave={handleEditSave}
      />

      {(itemsDialogOpen || selectedNavInvoice) && (
        <InvoiceItemsDialog
          open={itemsDialogOpen}
          onOpenChange={(open) => { setItemsDialogOpen(open); if (!open) { dialogClosingRef.current = true; setTimeout(() => { setInvoiceParam(null); setSelectedNavInvoice(null); dialogClosingRef.current = false; }, 500); } }}
          invoiceId={selectedNavInvoice?.id || ''}
          invoiceNumber={selectedNavInvoice?.invoice_number || ''}
          currency={selectedNavInvoice?.currency || 'HUF'}
          source="nav"
          invoiceDate={selectedNavInvoice?.invoice_issue_date || undefined}
          supplierName={selectedNavInvoice?.supplier_name || undefined}
        />
      )}

      {(submittedItemsDialogOpen || selectedSubmittedForItems) && (
        <InvoiceItemsDialog
          open={submittedItemsDialogOpen}
          onOpenChange={(open) => { setSubmittedItemsDialogOpen(open); if (!open) { dialogClosingRef.current = true; setTimeout(() => { setInvoiceParam(null); setSelectedSubmittedForItems(null); dialogClosingRef.current = false; }, 500); } }}
          invoiceId={selectedSubmittedForItems?.id || ''}
          invoiceNumber={selectedSubmittedForItems?.bizonylatsorszam || ''}
          currency={selectedSubmittedForItems?.penznem || 'HUF'}
          source="submitted"
          invoiceDate={selectedSubmittedForItems?.kibocsatas_datuma || undefined}
          supplierName={selectedSubmittedForItems?.elado_nev || undefined}
        />
      )}
    </div>
  );
};

export default InvoicesPage;
