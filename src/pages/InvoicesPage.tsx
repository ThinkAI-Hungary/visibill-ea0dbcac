import React, { useState, useEffect, useMemo } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
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
import { Search, Download, ArrowUpDown, FileText, X, ChevronDown, Info, Pencil, Package, RotateCcw } from 'lucide-react';
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

const InvoicesPage = () => {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const { dateFromFormatted, dateToFormatted } = useDateRange();
  useRealtimeInvalidation(selectedCompany?.id);

  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<InvoiceTab>('OUTBOUND');

  // Dialog states
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [itemsDialogOpen, setItemsDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<SubmittedInvoice | null>(null);
  const [selectedNavInvoice, setSelectedNavInvoice] = useState<NavInvoice | null>(null);

  // Row selection state
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
  const [selectedSubmittedIds, setSelectedSubmittedIds] = useState<Set<string>>(new Set());

  const companyId = selectedCompany?.id || '';
  const enabled = !!user && !!selectedCompany && !!dateFromFormatted && !!dateToFormatted;
  const isSubmittedTab = activeTab === 'SUBMITTED_INBOUND' || activeTab === 'SUBMITTED_OUTBOUND';

  // ── Data hook ──
  const {
    submittedInvoices, linkedInvoicesPool,
    partners, categories, projects, allTransactions,
    matchedInvoiceIds, loading: dataLoading, credentialsExist, invalidateInvoiceData,
  } = useInvoiceData(companyId, enabled, dateFromFormatted, dateToFormatted, selectedCompany?.id);

  // ── Filters hook (server-side) ──
  const {
    navFilters, setNavFilters, submittedFilters, setSubmittedFilters,
    clearNavFilters, clearSubmittedFilters,
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
  const navToSubmittedMap = useMemo(() => {
    const map = new Map<string, typeof submittedInvoices>();
    submittedInvoices.forEach(inv => {
      if (inv.bizonylatsorszam) {
        const existing = map.get(inv.bizonylatsorszam) || [];
        existing.push(inv);
        map.set(inv.bizonylatsorszam, existing);
      }
    });
    return map;
  }, [submittedInvoices]);

  const submittedToNavMap = useMemo(() => {
    const map = new Map<string, NavInvoice[]>();
    paginatedNavInvoices.forEach(inv => {
      const existing = map.get(inv.invoice_number) || [];
      existing.push(inv);
      map.set(inv.invoice_number, existing);
    });
    return map;
  }, [paginatedNavInvoices]);

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
        const key = inv.bizonylatsorszam.toUpperCase();
        const arr = byBizonylat.get(key) || [];
        arr.push(inv);
        byBizonylat.set(key, arr);
      }
      if (inv.reference_number) {
        const key = inv.reference_number.toUpperCase();
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
      const parents = linkedInvoicesMap.byBizonylat.get(currentRef.toUpperCase()) || [];
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
      const children = linkedInvoicesMap.byReference.get(bizSorszam.toUpperCase()) || [];
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
    const matchedSubmitted = navToSubmittedMap.get(navInvoice.invoice_number) || [];
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
    return { matchedSubmitted, matchedTransactions: matchedTx, matchedNav: [] as NavInvoice[], linkedInvoices: linkedInvs };
  };

  const getSubmittedInvoiceMatches = (submitted: SubmittedInvoice) => {
    const matchedNav = submitted.bizonylatsorszam ? (submittedToNavMap.get(submitted.bizonylatsorszam) || []) : [];
    const matchedTx = submittedIdToTransactionsMap.get(submitted.id) || [];
    const linkedInvs = getLinkedInvoices(submitted);
    return { matchedSubmitted: [] as SubmittedInvoice[], matchedTransactions: matchedTx, matchedNav, linkedInvoices: linkedInvs };
  };

  const handleRowClick = (invoiceId: string, e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, [role="checkbox"], [role="combobox"], [data-radix-collection-item]')) return;
    setExpandedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(invoiceId)) next.delete(invoiceId);
      else next.add(invoiceId);
      return next;
    });
  };

  const openImageDialog = (invoice: SubmittedInvoice) => {
    setSelectedInvoice(invoice);
    setImageDialogOpen(true);
  };

  const openEditDialog = (invoice: SubmittedInvoice) => {
    setSelectedInvoice(invoice);
    setEditDialogOpen(true);
  };

  const handleEditSave = () => {
    invalidateInvoiceData();
  };

  const getResultCount = () => {
    if (isSubmittedTab) return submittedTotalCount;
    return navTotalCount;
  };

  return (
    <div className="h-full bg-background">
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
                <InvoiceFilesDialog />
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
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3 p-4 bg-white dark:bg-muted/20 rounded-lg border border-slate-200 dark:border-border/30 shadow-sm">
                    <div className="relative col-span-2 md:col-span-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 dark:text-muted-foreground h-4 w-4" />
                      <Input
                        placeholder="Keresés..."
                        value={navFilters.search}
                        onChange={(e) => setNavFilters(prev => ({ ...prev, search: e.target.value }))}
                        className="pl-9 h-9 bg-white dark:bg-secondary/50 border border-slate-200 dark:border-white/10 focus:border-primary"
                      />
                    </div>

                    <Select value={navFilters.currency} onValueChange={(value) => setNavFilters(prev => ({ ...prev, currency: value }))}>
                      <SelectTrigger className="h-9 bg-white dark:bg-secondary/50 border border-slate-200 dark:border-white/10"><SelectValue placeholder="Pénznem" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Minden pénznem</SelectItem>
                        {['HUF', 'EUR', 'USD', 'GBP', 'CHF', 'CZK', 'PLN', 'RON'].map((currency) => (
                          <SelectItem key={currency} value={currency}>{currency}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={navFilters.paid} onValueChange={(value) => setNavFilters(prev => ({ ...prev, paid: value }))}>
                      <SelectTrigger className="h-9 bg-white dark:bg-secondary/50 border border-slate-200 dark:border-white/10"><SelectValue placeholder="Fizetve" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Mind</SelectItem>
                        <SelectItem value="yes">Kifizetve</SelectItem>
                        <SelectItem value="no">Nyitott</SelectItem>
                      </SelectContent>
                    </Select>

                    {activeTab === 'INBOUND' && (
                      <Select value={navFilters.submitted} onValueChange={(value) => setNavFilters(prev => ({ ...prev, submitted: value }))}>
                        <SelectTrigger className="h-9 bg-white dark:bg-secondary/50 border border-slate-200 dark:border-white/10"><SelectValue placeholder="Beküldve" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Mind</SelectItem>
                          <SelectItem value="yes">Igen</SelectItem>
                          <SelectItem value="no">Nem</SelectItem>
                        </SelectContent>
                      </Select>
                    )}

                    {activeTab === 'INBOUND' && (
                      <Select value={navFilters.category} onValueChange={(value) => setNavFilters(prev => ({ ...prev, category: value }))}>
                        <SelectTrigger className="h-9 bg-white dark:bg-secondary/50 border border-slate-200 dark:border-white/10"><SelectValue placeholder="Kategória" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Minden kategória</SelectItem>
                          <SelectItem value="none">Nincs kategória</SelectItem>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    <Select value={navFilters.project} onValueChange={(value) => setNavFilters(prev => ({ ...prev, project: value }))}>
                      <SelectTrigger className="h-9 bg-white dark:bg-secondary/50 border border-slate-200 dark:border-white/10"><SelectValue placeholder="Projekt" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Minden projekt</SelectItem>
                        <SelectItem value="none">Nincs projekt</SelectItem>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={navFilters.paymentMethod} onValueChange={(value) => setNavFilters(prev => ({ ...prev, paymentMethod: value }))}>
                      <SelectTrigger className="h-9 bg-white dark:bg-secondary/50 border border-slate-200 dark:border-white/10"><SelectValue placeholder="Fiz. mód" /></SelectTrigger>
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

                    <Button variant="outline" size="sm" onClick={clearNavFilters} className="h-9 text-red-500 dark:text-red-400 border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600">
                      <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
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
                    <Table className="table-fixed compact-table">
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
                          <TableHead className="cursor-pointer hover:bg-muted/50 font-semibold w-[150px]" onClick={() => handleSort('invoice_number')}>
                            <div className="flex items-center gap-2">Bizonylatsorszám<ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" /></div>
                          </TableHead>
                          <TableHead className="cursor-pointer hover:bg-muted/50 font-semibold w-28 text-center" onClick={() => handleSort('invoice_issue_date')}>
                            <div className="flex items-center justify-center gap-2">Kibocsátás<ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" /></div>
                          </TableHead>
                          <TableHead className="cursor-pointer hover:bg-muted/50 font-semibold w-28 text-center" onClick={() => handleSort('invoice_delivery_date')}>
                            <div className="flex items-center justify-center gap-2">Teljesítés<ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" /></div>
                          </TableHead>
                          <TableHead className="cursor-pointer hover:bg-muted/50 font-semibold" onClick={() => handleSort('partner_name')}>
                            <div className="flex items-center gap-2">Partner<ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" /></div>
                          </TableHead>
                          <TableHead className="text-right cursor-pointer hover:bg-muted/50 font-semibold w-32" onClick={() => handleSort('invoice_net_amount')}>
                            <div className="flex items-center justify-end gap-2"><ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />Nettó</div>
                          </TableHead>
                          <TableHead className="text-right cursor-pointer hover:bg-muted/50 font-semibold w-32" onClick={() => handleSort('invoice_gross_amount')}>
                            <div className="flex items-center justify-end gap-2"><ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />Bruttó</div>
                          </TableHead>
                          <TableHead className="text-right cursor-pointer hover:bg-muted/50 font-semibold w-32" onClick={() => handleSort('invoice_vat_amount')}>
                            <div className="flex items-center justify-end gap-2"><ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />ÁFA</div>
                          </TableHead>
                          <TableHead className="font-semibold w-24 text-center">
                            <div className="flex items-center justify-center gap-1">
                              Státusz
                              <TooltipProvider><Tooltip><TooltipTrigger asChild><Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent className="max-w-xs"><p>A számla fizetési állapota automatikusan változik: „Kifizetve" lesz, ha a számlához tartozó tranzakció párosítva van.</p></TooltipContent></Tooltip></TooltipProvider>
                            </div>
                          </TableHead>
                          {activeTab === 'INBOUND' && (<TableHead className="font-semibold w-20 text-center">Beküldve</TableHead>)}
                          {activeTab === 'INBOUND' && (<TableHead className="font-semibold w-[140px] text-center">Kategória</TableHead>)}
                          <TableHead className="font-semibold w-[140px] text-center">Projekt</TableHead>
                          <TableHead className="font-semibold w-[110px] text-center">Fiz. mód</TableHead>
                          <TableHead className="font-semibold w-20 text-center">Tételek</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading ? (
                          <TableSkeleton rows={10} columns={activeTab === 'INBOUND' ? 14 : 12} />
                        ) : paginatedNavInvoices.length === 0 ? (
                          <TableEmptyState colSpan={activeTab === 'INBOUND' ? 14 : 12} title="Nincs megjeleníthető számla" description="Próbáld módosítani a szűrőket vagy keresési feltételeket." onClearFilters={clearNavFilters} />
                        ) : (
                          paginatedNavInvoices.map((invoice) => {
                            const partnerTaxNumber = getPartnerTaxNumber(invoice);
                            const partnerName = getInvoicePartnerName(invoice);
                            return (
                              <React.Fragment key={invoice.id}>
                                <TableRow className={cn(
                                  "group cursor-pointer",
                                  selectedInvoiceIds.has(invoice.id) && "bg-primary/5",
                                  !selectedInvoiceIds.has(invoice.id) && invoice.transaction_id && "bg-[hsl(var(--success-row-bg))] text-[hsl(var(--success-row-text))] border-l-4 border-l-success border-b border-border/40 hover:shadow-[inset_0_0_0_100vw_rgba(0,0,0,0.04)] dark:hover:shadow-[inset_0_0_0_100vw_rgba(255,255,255,0.06)]",
                                  !selectedInvoiceIds.has(invoice.id) && !invoice.transaction_id && "bg-[hsl(var(--error-row-bg))] text-[hsl(var(--error-row-text))] border-l-4 border-l-destructive border-b border-border/40 hover:shadow-[inset_0_0_0_100vw_rgba(0,0,0,0.04)] dark:hover:shadow-[inset_0_0_0_100vw_rgba(255,255,255,0.06)]",
                                  expandedRowIds.has(invoice.id) && "border-b-0"
                                )} onClick={(e) => handleRowClick(invoice.id, e)}>
                                  <TableCell className="pl-6">
                                    <div className="flex items-center gap-3">
                                      <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200", expandedRowIds.has(invoice.id) && "rotate-180")} />
                                      <Checkbox checked={selectedInvoiceIds.has(invoice.id)} onCheckedChange={(checked) => handleRowSelect(invoice.id, !!checked)} aria-label={`${invoice.invoice_number} kijelölése`} />
                                    </div>
                                  </TableCell>
                                  <TableCell className="font-medium font-mono">
                                    <CopyableCell value={invoice.invoice_number || '-'} truncate maxWidth="105px" ariaLabel={`${invoice.invoice_number} bizonylatsorszám másolása`} />
                                  </TableCell>
                                  <TableCell className="text-center text-muted-foreground tabular-nums">
                                    {invoice.invoice_issue_date ? format(new Date(invoice.invoice_issue_date), 'yyyy. MM. dd.', { locale: hu }) : '-'}
                                  </TableCell>
                                  <TableCell className="text-center text-muted-foreground tabular-nums">
                                    {invoice.invoice_delivery_date ? format(new Date(invoice.invoice_delivery_date), 'yyyy. MM. dd.', { locale: hu }) : '-'}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0", getAvatarColor(partnerName))}>{getInitials(partnerName)}</div>
                                      <CopyableCell value={partnerName} truncate maxWidth="100%" className="font-medium text-xs" ariaLabel={`${partnerName} másolása`} />
                                    </div>
                                  </TableCell>
                                  <TableCell className={cn("text-right font-mono tabular-nums", activeTab === 'INBOUND' ? "text-destructive" : "text-success")}>
                                    <CopyableCell value={(invoice.invoice_net_amount || 0).toString()} displayValue={formatCurrency(invoice.invoice_net_amount || 0, invoice.currency || 'HUF')} className="justify-end" ariaLabel="Nettó összeg másolása" />
                                  </TableCell>
                                  <TableCell className={cn("text-right font-mono tabular-nums font-medium", activeTab === 'INBOUND' ? "text-destructive" : "text-success")}>
                                    <CopyableCell value={(invoice.invoice_gross_amount || 0).toString()} displayValue={formatCurrency(invoice.invoice_gross_amount || 0, invoice.currency || 'HUF')} className="justify-end" ariaLabel="Bruttó összeg másolása" />
                                  </TableCell>
                                  <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                                    <CopyableCell value={(invoice.invoice_vat_amount || 0).toString()} displayValue={formatCurrency(invoice.invoice_vat_amount || 0, invoice.currency || 'HUF')} className="justify-end" align="right" ariaLabel="ÁFA összeg másolása" />
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${invoice.transaction_id ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                                      {invoice.transaction_id ? 'Kifizetve' : 'Nyitott'}
                                    </span>
                                  </TableCell>
                                  {activeTab === 'INBOUND' && (
                                    <TableCell className="text-center">
                                      <Checkbox checked={invoice.submitted === true} disabled className="cursor-default opacity-70" />
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
                                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-70 group-hover:opacity-100" onClick={() => { setSelectedNavInvoice(invoice); setItemsDialogOpen(true); }}>
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
                                      linkedInvoices={matches.linkedInvoices}
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
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 p-4 bg-white dark:bg-muted/20 rounded-lg border border-slate-200 dark:border-border/30 shadow-sm">
                    <div className="relative col-span-2 md:col-span-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 dark:text-muted-foreground h-4 w-4" />
                      <Input placeholder="Keresés..." value={submittedFilters.search} onChange={(e) => setSubmittedFilters(prev => ({ ...prev, search: e.target.value }))} className="pl-9 h-9 bg-white dark:bg-secondary/50 border border-slate-200 dark:border-white/10 focus:border-primary" />
                    </div>
                    <Select value={submittedFilters.currency} onValueChange={(value) => setSubmittedFilters(prev => ({ ...prev, currency: value }))}>
                      <SelectTrigger className="h-9 bg-white dark:bg-secondary/50 border border-slate-200 dark:border-white/10"><SelectValue placeholder="Pénznem" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Minden pénznem</SelectItem>
                        {Array.from(new Set(submittedInvoices.map(inv => inv.penznem).filter(Boolean))).sort().map((currency) => (
                          <SelectItem key={currency} value={currency!}>{currency}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={clearSubmittedFilters} className="h-9 text-red-500 dark:text-red-400 border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600">
                      <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
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
                    <Table className="table-fixed compact-table">
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableHead className="w-[60px] pl-6">
                            <div className="flex items-center gap-3">
                              <div className="w-3.5" />
                              <Checkbox checked={allVisibleSubmittedSelected} onCheckedChange={(checked) => handleSubmittedSelectAll(!!checked)} aria-label="Összes kijelölése" />
                            </div>
                          </TableHead>
                          <TableHead className="cursor-pointer hover:bg-muted/50 font-semibold w-[150px]" onClick={() => handleSort('bizonylatsorszam')}>
                            <div className="flex items-center gap-2">Bizonylatsorszám<ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" /></div>
                          </TableHead>
                          <TableHead className="cursor-pointer hover:bg-muted/50 font-semibold w-28 text-center" onClick={() => handleSort('kibocsatas_datuma')}>
                            <div className="flex items-center justify-center gap-2">Kibocsátás<ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" /></div>
                          </TableHead>
                          <TableHead className="cursor-pointer hover:bg-muted/50 font-semibold w-28 text-center" onClick={() => handleSort('teljesites_datuma')}>
                            <div className="flex items-center justify-center gap-2">Teljesítés<ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" /></div>
                          </TableHead>
                          <TableHead className="cursor-pointer hover:bg-muted/50 font-semibold" onClick={() => handleSort('elado_nev')}>
                            <div className="flex items-center gap-2">Eladó<ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" /></div>
                          </TableHead>
                          <TableHead className="cursor-pointer hover:bg-muted/50 font-semibold" onClick={() => handleSort('vevo_nev')}>
                            <div className="flex items-center gap-2">Vevő<ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" /></div>
                          </TableHead>
                          <TableHead className="text-right cursor-pointer hover:bg-muted/50 font-semibold w-32" onClick={() => handleSort('adoalap_osszesen')}>
                            <div className="flex items-center justify-end gap-2"><ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />Nettó</div>
                          </TableHead>
                          <TableHead className="text-right cursor-pointer hover:bg-muted/50 font-semibold w-32" onClick={() => handleSort('brutto_vegosszeg')}>
                            <div className="flex items-center justify-end gap-2"><ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />Bruttó</div>
                          </TableHead>
                          <TableHead className="text-right cursor-pointer hover:bg-muted/50 font-semibold w-32" onClick={() => handleSort('afa_osszeg_osszesen')}>
                            <div className="flex items-center justify-end gap-2"><ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />ÁFA</div>
                          </TableHead>
                          <TableHead className="text-center font-semibold w-20">Műveletek</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading ? (
                          <TableSkeleton rows={10} columns={10} />
                        ) : paginatedSubmittedInvoices.length === 0 ? (
                          <TableEmptyState colSpan={10} title="Nincs megjeleníthető számla" description="Próbáld módosítani a szűrőket vagy keresési feltételeket." />
                        ) : (
                          paginatedSubmittedInvoices.map((invoice) => (
                            <React.Fragment key={invoice.id}>
                              <TableRow className={cn(
                                "group cursor-pointer",
                                selectedSubmittedIds.has(invoice.id) && "bg-primary/5",
                                !selectedSubmittedIds.has(invoice.id) && matchedInvoiceIds.has(invoice.id) && "bg-[hsl(var(--success-row-bg))] text-[hsl(var(--success-row-text))] border-l-4 border-l-success border-b border-border/40 hover:shadow-[inset_0_0_0_100vw_rgba(0,0,0,0.04)] dark:hover:shadow-[inset_0_0_0_100vw_rgba(255,255,255,0.06)]",
                                !selectedSubmittedIds.has(invoice.id) && !matchedInvoiceIds.has(invoice.id) && "bg-[hsl(var(--error-row-bg))] text-[hsl(var(--error-row-text))] border-l-4 border-l-destructive border-b border-border/40 hover:shadow-[inset_0_0_0_100vw_rgba(0,0,0,0.04)] dark:hover:shadow-[inset_0_0_0_100vw_rgba(255,255,255,0.06)]",
                                expandedRowIds.has(invoice.id) && "border-b-0"
                              )} onClick={(e) => handleRowClick(invoice.id, e)}>
                                <TableCell className="pl-6">
                                  <div className="flex items-center gap-3">
                                    <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200", expandedRowIds.has(invoice.id) && "rotate-180")} />
                                    <Checkbox checked={selectedSubmittedIds.has(invoice.id)} onCheckedChange={(checked) => handleSubmittedRowSelect(invoice.id, !!checked)} aria-label={`${invoice.bizonylatsorszam || invoice.id} kijelölése`} />
                                  </div>
                                </TableCell>
                                <TableCell className="font-medium font-mono">
                                  <CopyableCell value={invoice.bizonylatsorszam || '-'} truncate maxWidth="105px" ariaLabel={`${invoice.bizonylatsorszam} bizonylatsorszám másolása`} />
                                </TableCell>
                                <TableCell className="text-center text-muted-foreground tabular-nums">
                                  {invoice.kibocsatas_datuma ? format(new Date(invoice.kibocsatas_datuma), 'yyyy. MM. dd.', { locale: hu }) : '-'}
                                </TableCell>
                                <TableCell className="text-center text-muted-foreground tabular-nums">
                                  {invoice.teljesites_datuma ? format(new Date(invoice.teljesites_datuma), 'yyyy. MM. dd.', { locale: hu }) : '-'}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0", getAvatarColor(invoice.elado_nev))}>{getInitials(invoice.elado_nev)}</div>
                                    <CopyableCell value={invoice.elado_nev || '-'} truncate maxWidth="100%" className="font-medium text-xs" ariaLabel={`${invoice.elado_nev} másolása`} />
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0", getAvatarColor(invoice.vevo_nev))}>{getInitials(invoice.vevo_nev)}</div>
                                    <CopyableCell value={invoice.vevo_nev || '-'} truncate maxWidth="100%" className="font-medium text-xs" ariaLabel={`${invoice.vevo_nev} másolása`} />
                                  </div>
                                </TableCell>
                                <TableCell className={cn("text-right font-mono tabular-nums", invoice.reference_number ? "text-muted-foreground italic" : activeTab === 'SUBMITTED_INBOUND' ? "text-destructive" : "text-success")}>
                                  <CopyableCell value={(invoice.adoalap_osszesen || 0).toString()} displayValue={formatCurrency(invoice.adoalap_osszesen || 0, invoice.penznem || 'HUF')} className="justify-end" ariaLabel="Nettó összeg másolása" />
                                </TableCell>
                                <TableCell className={cn("text-right font-mono tabular-nums font-medium", invoice.reference_number ? "text-muted-foreground italic" : activeTab === 'SUBMITTED_INBOUND' ? "text-destructive" : "text-success")}>
                                  <CopyableCell value={(invoice.brutto_vegosszeg || 0).toString()} displayValue={formatCurrency(invoice.brutto_vegosszeg || 0, invoice.penznem || 'HUF')} className="justify-end" ariaLabel="Bruttó összeg másolása" />
                                </TableCell>
                                <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                                  <CopyableCell value={(invoice.afa_osszeg_osszesen || 0).toString()} displayValue={formatCurrency(invoice.afa_osszeg_osszesen || 0, invoice.penznem || 'HUF')} className="justify-end" align="right" ariaLabel="ÁFA összeg másolása" />
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
                                    colSpan={10}
                                    matchedSubmittedInvoices={[]}
                                    matchedNavInvoices={matches.matchedNav}
                                    matchedTransactions={matches.matchedTransactions}
                                    linkedInvoices={matches.linkedInvoices}
                                    onViewInvoice={(inv) => { setSelectedInvoice(inv as any); setImageDialogOpen(true); }}
                                  />
                                );
                              })()}
                            </React.Fragment>
                          ))
                        )}
                        <TablePlaceholderRows currentCount={paginatedSubmittedInvoices.length} pageSize={submittedPageSize} columns={10} />
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
        onClose={() => { setImageDialogOpen(false); setSelectedInvoice(null); }}
      />

      <InvoiceFullEditDialog
        invoice={selectedInvoice}
        categories={categories}
        projects={projects}
        open={editDialogOpen}
        onClose={() => { setEditDialogOpen(false); setSelectedInvoice(null); }}
        onSave={handleEditSave}
      />

      <InvoiceItemsDialog
        open={itemsDialogOpen}
        onOpenChange={(open) => { setItemsDialogOpen(open); if (!open) setSelectedNavInvoice(null); }}
        invoiceId={selectedNavInvoice?.id || ''}
        invoiceNumber={selectedNavInvoice?.invoice_number || ''}
        currency={selectedNavInvoice?.currency || 'HUF'}
      />
    </div>
  );
};

export default InvoicesPage;
