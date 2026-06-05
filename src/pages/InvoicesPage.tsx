import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { cn, formatCurrency } from '@/lib/utils';
import { Search, Download, ArrowUpDown, FileText, X, ChevronDown, Info, Pencil, Package, RotateCcw, CalendarIcon } from 'lucide-react';
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
import { useInvoiceFilters } from '@/hooks/useInvoiceFilters';
import type { InvoiceTab } from '@/hooks/useInvoiceFilters';
import { useInvoiceMutations } from '@/hooks/useInvoiceMutations';
import { useUrlTab } from '@/lib/navigation';

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
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const { dateFromFormatted, dateToFormatted } = useDateRange();
  const [searchParams, setSearchParams] = useSearchParams();

  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());

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
    partners, categories, projects, allTransactions, navInvoicesLookup,
    matchedInvoiceIds, navIdToCourierReportsMap,
    loading: dataLoading, credentialsExist, invalidateInvoiceData,
  } = useInvoiceData(companyId, enabled, dateFromFormatted, dateToFormatted, selectedCompany?.id);

  // ── Filters hook (server-side, unified across all tabs) ──
  const {
    filters, setFilters, clearFilters,
    sortField, sortDirection, handleSort,
    navPageSize, setNavPageSize, submittedPageSize, setSubmittedPageSize,
    navCurrentPage, setNavCurrentPage, submittedCurrentPage, setSubmittedCurrentPage,
    navTotalPages, submittedTotalPages,
    navLoading, submittedFilterLoading,
    filteredAndSortedNavInvoices, filteredAndSortedSubmittedInvoices,
    paginatedNavInvoices, paginatedSubmittedInvoices,
    navTotalCount, submittedTotalCount,
    getInvoicePartnerName, getPartnerTaxNumber, getCategoryName, getProjectName, getPaymentMethodLabel,
  } = useInvoiceFilters(companyId, enabled, dateFromFormatted, dateToFormatted, partners, categories, projects, activeTab);

  const loading = dataLoading || navLoading || submittedFilterLoading;

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

  // Reset pagination, selection, and expanded row when company changes
  useEffect(() => {
    setNavCurrentPage(1);
    setSubmittedCurrentPage(1);
    setSelectedInvoiceIds(new Set());
    setSelectedSubmittedIds(new Set());
    setExpandedRowIds(new Set());
  }, [selectedCompany?.id]);

  // Clear selection and expanded row when tab changes
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
    if (actionFromUrl === 'files' && !filesDialogOpen) setFilesDialogOpen(true);
  }, [actionFromUrl]); // eslint-disable-line react-hooks/exhaustive-deps

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
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.delete('action');
        return next;
      }, { replace: true });
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
    allTransactions.forEach(tx => {
      if (tx.matched_invoice_id) {
        const existing = map.get(tx.matched_invoice_id) || [];
        existing.push(tx);
        map.set(tx.matched_invoice_id, existing);
      }
    });
    return map;
  }, [allTransactions]);

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
        const key = normalizeInvNum(inv.reference_number);
        const arr = byReference.get(key) || [];
        arr.push(inv);
        byReference.set(key, arr);
      }
    });
    return { byBizonylat, byReference };
  }, [submittedInvoices, linkedInvoicesPool]);

  const getLinkedInvoices = (invoice: SubmittedInvoice): (SubmittedInvoice & { relationDirection: 'parent' | 'child' })[] => {
    const linked: (SubmittedInvoice & { relationDirection: 'parent' | 'child' })[] = [];
    const visited = new Set([invoice.id]);

    let currentRef = invoice.reference_number;
    while (currentRef) {
      const parents = linkedInvoicesMap.byBizonylat.get(normalizeInvNum(currentRef)) || [];
      const parent = parents.find(p => !visited.has(p.id));
      if (!parent) break;
      visited.add(parent.id);
      linked.push({ ...parent, relationDirection: 'parent' });
      currentRef = parent.reference_number;
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
  const suggestedOnlyIds = useMemo(() => {
    const ids = new Set<string>();
    allTransactions.forEach(tx => {
      if (!tx.matched_invoice_id) return;
      const score = tx.confidence_score ?? 1;
      if (score < 0.9) ids.add(tx.matched_invoice_id);
    });
    // Remove any that also have a confirmed match (>= 0.9)
    allTransactions.forEach(tx => {
      if (!tx.matched_invoice_id) return;
      const score = tx.confidence_score ?? 1;
      if (score >= 0.9) ids.delete(tx.matched_invoice_id);
    });
    return ids;
  }, [allTransactions]);

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
                <CardDescription>
                  Számlák áttekintése és kezelése - {getResultCount()} találat
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSync}
                        disabled={syncing || !credentialsExist || !canSync}
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
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Download className="h-4 w-4 mr-2" />
                              Export
                              <ChevronDown className="h-4 w-4 ml-2" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => handleExport('csv')}>
                              <FileText className="h-4 w-4 mr-2" />
                              Export CSV
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExport('xlsx')}>
                              <FileText className="h-4 w-4 mr-2" />
                              Export XLSX
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Exportálhatod a számlákat CSV vagy Excel formátumban</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as InvoiceTab)}>
              <TabsList className="grid w-full max-w-2xl grid-cols-4">
                <TabsTrigger value="OUTBOUND">Kimenő (NAV)</TabsTrigger>
                <TabsTrigger value="INBOUND">Bejövő (NAV)</TabsTrigger>
                <TabsTrigger value="SUBMITTED_OUTBOUND">Beküldött (Kimenő)</TabsTrigger>
                <TabsTrigger value="SUBMITTED_INBOUND">Beküldött (Bejövő)</TabsTrigger>
              </TabsList>

              {/* NAV Invoice Tabs */}
              {(activeTab === 'OUTBOUND' || activeTab === 'INBOUND') && (
                <TabsContent value={activeTab} className="space-y-4 mt-4">
                  {/* NAV Filters */}
                  <div className="flex flex-wrap items-center gap-3">
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

                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      <X className="h-4 w-4 mr-1" />
                      Szűrők törlése
                    </Button>
                  </div>

                  <UnifiedPagination
                    currentPage={navCurrentPage}
                    totalPages={navTotalPages}
                    totalItems={navTotalCount}
                    pageSize={navPageSize}
                    onPageChange={setNavCurrentPage}
                    onPageSizeChange={(size) => { setNavPageSize(size); setNavCurrentPage(1); }}
                    className="mb-3"
                  />

                  {/* NAV Invoice Table */}
                  <div className="rounded-lg border border-border/50 overflow-x-auto">
                    <Table className="compact-table w-full" style={{ tableLayout: 'fixed' }}>
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableHead className="w-[60px] pl-6">
                            <div className="flex items-center gap-3">
                              <div className="w-3.5" />
                              <Checkbox
                                checked={allVisibleSelected}
                                onCheckedChange={(checked) => handleSelectAll(!!checked)}
                                aria-label="Összes kijelölése"
                              />
                            </div>
                          </TableHead>
                          <TableHead className="cursor-pointer hover:bg-muted/50 font-semibold" onClick={() => handleSort('partner_name')}>
                            <div className="flex items-center gap-2">Partner<ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" /></div>
                          </TableHead>
                          <TableHead className="cursor-pointer hover:bg-muted/50 font-semibold w-[110px] text-center" onClick={() => handleSort('invoice_issue_date')}>
                            <div className="flex items-center justify-center gap-2">Kibocsátás<ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" /></div>
                          </TableHead>
                          <TableHead className="cursor-pointer hover:bg-muted/50 font-semibold w-[110px] text-center" onClick={() => handleSort('invoice_delivery_date')}>
                            <div className="flex items-center justify-center gap-2">Teljesítés<ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" /></div>
                          </TableHead>
                          <TableHead className="cursor-pointer hover:bg-muted/50 font-semibold" onClick={() => handleSort('invoice_number')}>
                            <div className="flex items-center gap-2">Bizonylatsorszám<ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" /></div>
                          </TableHead>
                          <TableHead className="text-right cursor-pointer hover:bg-muted/50 font-semibold w-[100px]" onClick={() => handleSort('invoice_net_amount')}>
                            <div className="flex items-center justify-end gap-2"><ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />Nettó</div>
                          </TableHead>
                          <TableHead className="text-right cursor-pointer hover:bg-muted/50 font-semibold w-[100px]" onClick={() => handleSort('invoice_gross_amount')}>
                            <div className="flex items-center justify-end gap-2"><ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />Bruttó</div>
                          </TableHead>
                          <TableHead className="text-right cursor-pointer hover:bg-muted/50 font-semibold w-[100px]" onClick={() => handleSort('invoice_vat_amount')}>
                            <div className="flex items-center justify-end gap-2"><ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />ÁFA</div>
                          </TableHead>
                          <TableHead className="font-semibold w-[80px] text-center">
                            <div className="flex items-center justify-center gap-1">
                              Státusz
                              <TooltipProvider><Tooltip><TooltipTrigger asChild><Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent className="max-w-xs"><p>A számla fizetési állapota automatikusan változik: „Kifizetve" lesz, ha a számlához tartozó tranzakció párosítva van.</p></TooltipContent></Tooltip></TooltipProvider>
                            </div>
                          </TableHead>
                          {activeTab === 'INBOUND' && (<TableHead className="font-semibold w-[70px] text-center">Beküldve</TableHead>)}
                          {activeTab === 'INBOUND' && (<TableHead className="font-semibold w-[140px] text-center">Kategória</TableHead>)}
                          <TableHead className="font-semibold w-[140px] text-center">Projekt</TableHead>
                          <TableHead className="font-semibold w-[110px] text-center">Fiz. mód</TableHead>
                          <TableHead className="font-semibold w-[60px] text-center">Tételek</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading ? (
                          <TableSkeleton rows={10} columns={activeTab === 'INBOUND' ? 14 : 12} />
                        ) : paginatedNavInvoices.length === 0 ? (
                          <TableEmptyState colSpan={activeTab === 'INBOUND' ? 14 : 12} title="Nincs megjeleníthető számla" description="Próbáld módosítani a szűrőket vagy keresési feltételeket." onClearFilters={clearFilters} />
                        ) : (
                          paginatedNavInvoices.map((invoice) => {
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
                            const isPaid = invoice.paid === true || !!invoice.transaction_id || directlyMatched || indirectlyMatched || linkedChainMatched;
                            return (
                              <React.Fragment key={invoice.id}>
                                <TableRow className={cn(
                                  "group cursor-pointer",
                                  selectedInvoiceIds.has(invoice.id) && "bg-primary/5",
                                  !selectedInvoiceIds.has(invoice.id) && isPaid && !suggestedOnlyIds.has(invoice.id) && "bg-emerald-100/70 dark:bg-emerald-950/40 border-l-2 border-l-emerald-500/60 border-b border-border/40",
                                  !selectedInvoiceIds.has(invoice.id) && suggestedOnlyIds.has(invoice.id) && "bg-amber-100/70 dark:bg-amber-950/40 border-l-2 border-l-amber-500/60 border-b border-border/40",
                                  !selectedInvoiceIds.has(invoice.id) && !isPaid && !suggestedOnlyIds.has(invoice.id) && "bg-rose-100/60 dark:bg-rose-950/30 border-l-2 border-l-rose-400/50 border-b border-border/40",
                                  expandedRowIds.has(invoice.id) && "border-b-0"
                                )} onClick={(e) => handleRowClick(invoice.id, e)}>
                                  <TableCell className="pl-6">
                                    <div className="flex items-center gap-3">
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
                                        <CopyableCell value={partnerName} truncate maxWidth="100%" className="font-medium text-xs" ariaLabel={`${partnerName} másolása`} />
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center text-muted-foreground tabular-nums whitespace-nowrap">
                                    {invoice.invoice_issue_date ? format(new Date(invoice.invoice_issue_date), 'yyyy. MM. dd.', { locale: hu }) : '-'}
                                  </TableCell>
                                  <TableCell className="text-center text-muted-foreground tabular-nums whitespace-nowrap">
                                    {invoice.invoice_delivery_date ? format(new Date(invoice.invoice_delivery_date), 'yyyy. MM. dd.', { locale: hu }) : '-'}
                                  </TableCell>
                                  <TableCell className="font-medium font-mono">
                                    <CopyableCell value={invoice.invoice_number || '-'} ariaLabel={`${invoice.invoice_number} bizonylatsorszám másolása`} />
                                  </TableCell>
                                  <TableCell className={cn("text-right font-mono tabular-nums", !invoice.invoice_net_amount ? "text-muted-foreground" : activeTab === 'INBOUND' ? "text-destructive" : "text-success")}>
                                    <CopyableCell value={(invoice.invoice_net_amount || 0).toString()} displayValue={formatCurrency(invoice.invoice_net_amount || 0, invoice.currency || 'HUF')} className="justify-end" ariaLabel="Nettó összeg másolása" />
                                  </TableCell>
                                  <TableCell className={cn("text-right font-mono tabular-nums font-medium", !invoice.invoice_gross_amount ? "text-muted-foreground" : activeTab === 'INBOUND' ? "text-destructive" : "text-success")}>
                                    <CopyableCell value={(invoice.invoice_gross_amount || 0).toString()} displayValue={formatCurrency(invoice.invoice_gross_amount || 0, invoice.currency || 'HUF')} className="justify-end" ariaLabel="Bruttó összeg másolása" />
                                  </TableCell>
                                  <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                                    <CopyableCell value={(invoice.invoice_vat_amount || 0).toString()} displayValue={formatCurrency(invoice.invoice_vat_amount || 0, invoice.currency || 'HUF')} className="justify-end" align="right" ariaLabel="ÁFA összeg másolása" />
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${isPaid ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                                      {isPaid ? 'Kifizetve' : 'Nyitott'}
                                    </span>
                                  </TableCell>
                                  {activeTab === 'INBOUND' && (
                                    <TableCell className="text-center">
                                      <Checkbox checked={invoice.submitted === true || (navToSubmittedMap.get(normalizeInvNum(invoice.invoice_number))?.length ?? 0) > 0} disabled className="cursor-default opacity-70" />
                                    </TableCell>
                                  )}
                                  {activeTab === 'INBOUND' && (
                                    <TableCell className="text-center">
                                      <Select value={invoice.category_id || 'none'} onValueChange={(value) => handleCategoryChange(invoice.id, value)}>
                                        <SelectTrigger className="w-[120px] h-8 mx-auto bg-transparent border-transparent hover:border-border/50 focus:border-primary/50 transition-colors [&>span]:truncate [&>span]:flex-1 [&>svg]:shrink-0"><SelectValue placeholder="Válassz..." /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="none">-</SelectItem>
                                          {categories.map((category) => (<SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>))}
                                        </SelectContent>
                                      </Select>
                                    </TableCell>
                                  )}
                                  <TableCell className="text-center">
                                    <Select value={invoice.project_id || 'none'} onValueChange={(value) => handleProjectChange(invoice.id, value)}>
                                      <SelectTrigger className="w-[120px] h-8 mx-auto bg-transparent border-transparent hover:border-border/50 focus:border-primary/50 transition-colors [&>span]:truncate [&>span]:flex-1 [&>svg]:shrink-0"><SelectValue placeholder="Válassz..." /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="none">-</SelectItem>
                                        {projects.map((project) => (<SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>))}
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-muted/50 text-muted-foreground">{getPaymentMethodLabel(invoice.payment_method)}</span>
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
                                      colSpan={activeTab === 'INBOUND' ? 14 : 12}
                                      matchedSubmittedInvoices={matches.matchedSubmitted}
                                      matchedNavInvoices={[]}
                                      matchedTransactions={matches.matchedTransactions}
                                      matchedCourierReports={matches.matchedCourierReports}
                                      linkedInvoices={matches.linkedInvoices}
                                      linkedInvoicesLoading={linkedInvoicesLoading}
                                      onViewInvoice={(inv) => { setSelectedInvoice(inv as any); setImageDialogOpen(true); }}
                                    />
                                  );
                                })()}
                              </React.Fragment>
                            );
                          })
                        )}
                        <TablePlaceholderRows currentCount={paginatedNavInvoices.length} pageSize={navPageSize} columns={activeTab === 'INBOUND' ? 14 : 12} />
                      </TableBody>
                    </Table>
                  </div>

                  <UnifiedPagination
                    currentPage={navCurrentPage}
                    totalPages={navTotalPages}
                    totalItems={navTotalCount}
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
                  <div className="flex flex-wrap items-center gap-3">
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

                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      <X className="h-4 w-4 mr-1" />
                      Szűrők törlése
                    </Button>
                  </div>

                  <UnifiedPagination
                    currentPage={submittedCurrentPage}
                    totalPages={submittedTotalPages}
                    totalItems={submittedTotalCount}
                    pageSize={submittedPageSize}
                    onPageChange={setSubmittedCurrentPage}
                    onPageSizeChange={(size) => { setSubmittedPageSize(size); setSubmittedCurrentPage(1); }}
                    className="mb-3"
                  />

                  {/* Submitted Invoice Table */}
                  <div className="rounded-lg border border-border/50 overflow-x-auto">
                    <Table className="compact-table w-full" style={{ tableLayout: 'fixed' }}>
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableHead className="w-[60px] pl-6">
                            <div className="flex items-center gap-3">
                              <div className="w-3.5" />
                              <Checkbox checked={allVisibleSubmittedSelected} onCheckedChange={(checked) => handleSubmittedSelectAll(!!checked)} aria-label="Összes kijelölése" />
                            </div>
                          </TableHead>
                          <TableHead className="cursor-pointer hover:bg-muted/50 font-semibold" onClick={() => handleSort(activeTab === 'SUBMITTED_INBOUND' ? 'elado_nev' : 'vevo_nev')}>
                            <div className="flex items-center gap-2">Partner<ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" /></div>
                          </TableHead>
                          <TableHead className="cursor-pointer hover:bg-muted/50 font-semibold w-[110px] text-center" onClick={() => handleSort('kibocsatas_datuma')}>
                            <div className="flex items-center justify-center gap-2">Kibocsátás<ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" /></div>
                          </TableHead>
                          <TableHead className="cursor-pointer hover:bg-muted/50 font-semibold w-[110px] text-center" onClick={() => handleSort('teljesites_datuma')}>
                            <div className="flex items-center justify-center gap-2">Teljesítés<ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" /></div>
                          </TableHead>
                          <TableHead className="cursor-pointer hover:bg-muted/50 font-semibold" onClick={() => handleSort('bizonylatsorszam')}>
                            <div className="flex items-center gap-2">Bizonylatsorszám<ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" /></div>
                          </TableHead>
                          <TableHead className="text-right cursor-pointer hover:bg-muted/50 font-semibold w-[100px]" onClick={() => handleSort('adoalap_osszesen')}>
                            <div className="flex items-center justify-end gap-2"><ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />Nettó</div>
                          </TableHead>
                          <TableHead className="text-right cursor-pointer hover:bg-muted/50 font-semibold w-[100px]" onClick={() => handleSort('brutto_vegosszeg')}>
                            <div className="flex items-center justify-end gap-2"><ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />Bruttó</div>
                          </TableHead>
                          <TableHead className="text-right cursor-pointer hover:bg-muted/50 font-semibold w-[100px]" onClick={() => handleSort('afa_osszeg_osszesen')}>
                            <div className="flex items-center justify-end gap-2"><ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />ÁFA</div>
                          </TableHead>
                          <TableHead className="font-semibold w-[110px] text-center">Fiz. mód</TableHead>
                          <TableHead className="font-semibold w-[60px] text-center">Tételek</TableHead>
                          <TableHead className="text-center font-semibold w-[80px]">Műveletek</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading ? (
                          <TableSkeleton rows={10} columns={11} />
                        ) : paginatedSubmittedInvoices.length === 0 ? (
                          <TableEmptyState colSpan={11} title="Nincs megjeleníthető számla" description="Próbáld módosítani a szűrőket vagy keresési feltételeket." />
                        ) : (
                          paginatedSubmittedInvoices.map((invoice) => (
                            <React.Fragment key={invoice.id}>
                              <TableRow className={cn(
                                "group cursor-pointer",
                                selectedSubmittedIds.has(invoice.id) && "bg-primary/5",
                                !selectedSubmittedIds.has(invoice.id) && extendedMatchedIds.has(invoice.id) && !suggestedOnlyIds.has(invoice.id) && "bg-emerald-100/70 dark:bg-emerald-950/40 border-l-2 border-l-emerald-500/60 border-b border-border/40",
                                !selectedSubmittedIds.has(invoice.id) && suggestedOnlyIds.has(invoice.id) && "bg-amber-100/70 dark:bg-amber-950/40 border-l-2 border-l-amber-500/60 border-b border-border/40",
                                !selectedSubmittedIds.has(invoice.id) && !extendedMatchedIds.has(invoice.id) && !suggestedOnlyIds.has(invoice.id) && "bg-rose-100/60 dark:bg-rose-950/30 border-l-2 border-l-rose-400/50 border-b border-border/40",
                                expandedRowIds.has(invoice.id) && "border-b-0"
                              )} onClick={(e) => handleRowClick(invoice.id, e)}>
                                <TableCell className="pl-6">
                                  <div className="flex items-center gap-3">
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
                                          <CopyableCell value={partnerName} truncate maxWidth="100%" className="font-medium text-xs" ariaLabel={`${partnerName} másolása`} />
                                        )}
                                      </div>
                                    );
                                  })()}
                                </TableCell>
                                <TableCell className="text-center text-muted-foreground tabular-nums whitespace-nowrap">
                                  {invoice.kibocsatas_datuma ? format(new Date(invoice.kibocsatas_datuma), 'yyyy. MM. dd.', { locale: hu }) : '-'}
                                </TableCell>
                                <TableCell className="text-center text-muted-foreground tabular-nums whitespace-nowrap">
                                  {invoice.teljesites_datuma ? format(new Date(invoice.teljesites_datuma), 'yyyy. MM. dd.', { locale: hu }) : '-'}
                                </TableCell>
                                <TableCell className="font-medium font-mono">
                                  <CopyableCell value={invoice.bizonylatsorszam || '-'} ariaLabel={`${invoice.bizonylatsorszam} bizonylatsorszám másolása`} />
                                </TableCell>
                                <TableCell className={cn("text-right font-mono tabular-nums", invoice.reference_number ? "text-muted-foreground italic" : !invoice.adoalap_osszesen ? "text-muted-foreground" : activeTab === 'SUBMITTED_INBOUND' ? "text-destructive" : "text-success")}>
                                  <CopyableCell value={(invoice.adoalap_osszesen || 0).toString()} displayValue={formatCurrency(invoice.adoalap_osszesen || 0, invoice.penznem || 'HUF')} className="justify-end" ariaLabel="Nettó összeg másolása" />
                                </TableCell>
                                <TableCell className={cn("text-right font-mono tabular-nums font-medium", invoice.reference_number ? "text-muted-foreground italic" : !invoice.brutto_vegosszeg ? "text-muted-foreground" : activeTab === 'SUBMITTED_INBOUND' ? "text-destructive" : "text-success")}>
                                  <CopyableCell value={(invoice.brutto_vegosszeg || 0).toString()} displayValue={formatCurrency(invoice.brutto_vegosszeg || 0, invoice.penznem || 'HUF')} className="justify-end" ariaLabel="Bruttó összeg másolása" />
                                </TableCell>
                                <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                                  <CopyableCell value={(invoice.afa_osszeg_osszesen || 0).toString()} displayValue={formatCurrency(invoice.afa_osszeg_osszesen || 0, invoice.penznem || 'HUF')} className="justify-end" align="right" ariaLabel="ÁFA összeg másolása" />
                                </TableCell>
                                <TableCell className="text-center">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-muted/50 text-muted-foreground">{invoice.fizetesi_mod || 'Nem megadott'}</span>
                                </TableCell>
                                <TableCell className="text-center">
                                  <TooltipProvider><Tooltip><TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-70 group-hover:opacity-100" onClick={() => { setSelectedSubmittedForItems(invoice); setSubmittedItemsDialogOpen(true); setInvoiceParam(invoice.id); }}>
                                      <Package className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger><TooltipContent><p>Számlatételek megtekintése</p></TooltipContent></Tooltip></TooltipProvider>
                                </TableCell>
                                <TableCell className="text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    {(invoice.image_url || invoice.melleklet_url) && (
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
                                    )}
                                    <TooltipProvider><Tooltip><TooltipTrigger asChild>
                                      <Button size="sm" variant="ghost" className="h-8 w-8 opacity-70 group-hover:opacity-100" onClick={() => openEditDialog(invoice)}>
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger><TooltipContent><p>Számla szerkesztése</p></TooltipContent></Tooltip></TooltipProvider>
                                  </div>
                                </TableCell>
                              </TableRow>
                              {expandedRowIds.has(invoice.id) && (() => {
                                const matches = getSubmittedInvoiceMatches(invoice);
                                return (
                                  <ExpandedInvoiceRow
                                    colSpan={11}
                                    matchedSubmittedInvoices={[]}
                                    matchedNavInvoices={matches.matchedNav}
                                    matchedTransactions={matches.matchedTransactions}
                                    linkedInvoices={matches.linkedInvoices}
                                    invoiceReferenceNumber={invoice.reference_number}
                                    linkedInvoicesLoading={linkedInvoicesLoading}
                                    onViewInvoice={(inv) => { setSelectedInvoice(inv as any); setImageDialogOpen(true); }}
                                  />
                                );
                              })()}
                            </React.Fragment>
                          ))
                        )}
                        <TablePlaceholderRows currentCount={paginatedSubmittedInvoices.length} pageSize={submittedPageSize} columns={11} />
                      </TableBody>
                    </Table>
                  </div>

                  <UnifiedPagination
                    currentPage={submittedCurrentPage}
                    totalPages={submittedTotalPages}
                    totalItems={submittedTotalCount}
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

      <InvoiceItemsDialog
        open={itemsDialogOpen}
        onOpenChange={(open) => { setItemsDialogOpen(open); if (!open) { setSelectedNavInvoice(null); setInvoiceParam(null); } }}
        invoiceId={selectedNavInvoice?.id || ''}
        invoiceNumber={selectedNavInvoice?.invoice_number || ''}
        currency={selectedNavInvoice?.currency || 'HUF'}
        source="nav"
        invoiceDate={selectedNavInvoice?.invoice_issue_date || undefined}
        supplierName={selectedNavInvoice?.supplier_name || undefined}
      />

      <InvoiceItemsDialog
        open={submittedItemsDialogOpen}
        onOpenChange={(open) => { setSubmittedItemsDialogOpen(open); if (!open) { setSelectedSubmittedForItems(null); setInvoiceParam(null); } }}
        invoiceId={selectedSubmittedForItems?.id || ''}
        invoiceNumber={selectedSubmittedForItems?.bizonylatsorszam || ''}
        currency={selectedSubmittedForItems?.penznem || 'HUF'}
        source="submitted"
        invoiceDate={selectedSubmittedForItems?.kibocsatas_datuma || undefined}
        supplierName={selectedSubmittedForItems?.elado_nev || undefined}
      />
    </div>
  );
};

export default InvoicesPage;
