import { useState, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { RefreshCw, Download, ChevronDown, FileText, Package, Truck, Mail, ArrowDownRight, ArrowUpRight, Link2, Link2Off, Loader2, Settings, CreditCard, AlertTriangle, Upload, TrendingUp, TrendingDown, Wallet, Copy } from 'lucide-react';
import { UnifiedPagination } from '@/components/ui/unified-pagination';
import { TransactionDetailsDialog } from '@/components/TransactionDetailsDialog';
import TransactionFilters from '@/components/transactions/TransactionFilters';
import TransactionTable from '@/components/transactions/TransactionTable';
import { useTransactionData, type Transaction } from '@/hooks/useTransactionData';
import SzepCardTab from '@/components/SzepCardTab';
import { supabase } from '@/integrations/supabase/client';
import { useDateRange } from '@/contexts/DateRangeContext';
import CourierReportTab from '@/components/CourierReportTab';
import { computeMatchStatus } from '@/hooks/useComputedStatus';
import { format } from 'date-fns';
import { useExchangeRates } from '@/hooks/useExchangeRates';
import { Landmark } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { reportError } from '@/lib/errorReporter';
import { useEaisybillPermissions } from '@/hooks/useEaisybillPermissions';
import { toast } from '@/hooks/use-toast';


// ── Bank display config ──
const BANK_CONFIG: Record<string, { label: string; fullName: string; color: string; bgClass: string }> = {
  otp:        { label: 'OTP',        fullName: 'OTP Bank Nyrt.',              color: 'bg-emerald-500', bgClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' },
  cib:        { label: 'CIB',        fullName: 'CIB Bank Zrt.',              color: 'bg-red-500',     bgClass: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20' },
  raiffeisen: { label: 'Raiffeisen', fullName: 'Raiffeisen Bank Zrt.',        color: 'bg-yellow-500',  bgClass: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20' },
  kh:         { label: 'K&H',        fullName: 'K&H Bank Zrt.',              color: 'bg-blue-600',    bgClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20' },
  erste:      { label: 'Erste',      fullName: 'Erste Bank Hungary Zrt.',     color: 'bg-sky-500',     bgClass: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20' },
  unicredit:  { label: 'UniCredit',  fullName: 'UniCredit Bank Hungary Zrt.', color: 'bg-rose-600',    bgClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20' },
  magnet:     { label: 'MagNet',     fullName: 'MagNet Magyar Közösségi Bank Zrt.', color: 'bg-violet-500', bgClass: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20' },
  granit:     { label: 'Gránit',     fullName: 'Gránit Bank Zrt.',            color: 'bg-stone-500',   bgClass: 'bg-stone-500/10 text-stone-700 dark:text-stone-400 border-stone-500/20' },
  wise:       { label: 'Wise',       fullName: 'Wise Payments Ltd.',           color: 'bg-[#9FE870]',   bgClass: 'bg-lime-500/10 text-lime-700 dark:text-lime-400 border-lime-500/20' },
  revolut:    { label: 'Revolut',    fullName: 'Revolut Bank UAB',             color: 'bg-[#0075EB]',   bgClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20' },
  binx:       { label: 'Binx',       fullName: 'Binx Zrt.',                   color: 'bg-orange-500',  bgClass: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20' },
  mbh:        { label: 'MBH',        fullName: 'MBH Bank Nyrt.',              color: 'bg-indigo-500',  bgClass: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20' },
  mkb:        { label: 'MKB',        fullName: 'MKB Bank Nyrt.',              color: 'bg-teal-600',    bgClass: 'bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20' },
};

const FIXED_TABS = ['general', 'gls', 'mpl', 'mixpack'] as const;
const COURIER_TABS = new Set(['gls', 'mpl', 'mixpack']);

const fmtHuf = (val: number) => new Intl.NumberFormat('hu-HU').format(Math.round(val));

const TransactionsPage = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);

  const {
    selectedCompany,
    filteredTransactions,
    totalCount,
    totalPages,
    loading,
    filters,
    setFilters,
    clearFilters,
    hasActiveFilters,
    uniqueCurrencies,
    uniqueTypes,
    handleSort,
    currentPage,
    setCurrentPage,
    pageSize,
    handlePageSizeChange,
    syncing,
    handleSync,
    handleExport,
    handleBulkStatusChange,
    handleBulkExport,
    handleBulkDelete,
    queryClient,
  } = useTransactionData();

  const { canWrite: canWriteModule } = useEaisybillPermissions();
  const writable = canWriteModule('transactions');

  const [exporting, setExporting] = useState(false);
  const runExport = async (format: 'csv' | 'xlsx') => {
    setExporting(true);
    try {
      await handleExport(format);
    } finally {
      setExporting(false);
    }
  };

  const [searchParams, setSearchParams] = useSearchParams();
  const { dateFrom, dateTo } = useDateRange();
  const dateFromStr = dateFrom ? format(dateFrom, 'yyyy-MM-dd') : '';
  const dateToStr = dateTo ? format(dateTo, 'yyyy-MM-dd') : '';

  const { data: exchangeRates } = useExchangeRates();

  // ── P1: Unified bank uploads query (consolidates 3 queries into 1) ──
  const { data: bankUploads = [] } = useQuery({
    queryKey: ['bank-uploads-unified', selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transaction_uploads')
        .select('id, detected_bank, processing_status')
        .eq('company_id', selectedCompany!.id)
        .not('detected_bank', 'is', null);
      if (error) { reportError({ type: 'db_query', component: 'TransactionsPage', action: 'error', message: 'bank-uploads query error:', error }); return []; }
      return (data || []) as { id: string; detected_bank: string; processing_status: string }[];
    },
    enabled: !!selectedCompany?.id,
    staleTime: 60_000,
  });

  // Derive all 3 data structures from the single query
  const detectedBanks = useMemo(() => {
    const bankSet = new Set<string>();
    for (const row of bankUploads) {
      if (row.processing_status === 'completed') bankSet.add(row.detected_bank);
    }
    // Exclude 'gls' and 'szep' — handled by dedicated tabs, not bank tabs
    bankSet.delete('gls');
    bankSet.delete('szep');
    return Array.from(bankSet).sort();
  }, [bankUploads]);

  const uploadBankMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const row of bankUploads) map[row.id] = row.detected_bank;
    return map;
  }, [bankUploads]);

  const bankUploadIds = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const row of bankUploads) {
      if (row.processing_status === 'completed') {
        if (!map[row.detected_bank]) map[row.detected_bank] = [];
        map[row.detected_bank].push(row.id);
      }
    }
    return map;
  }, [bankUploads]);

  // All tab values (fixed + dynamic bank tabs)
  const allTabValues = useMemo(() => {
    return [...FIXED_TABS, ...detectedBanks.map(b => `bank_${b}`)];
  }, [detectedBanks]);

  // ── F2: Duplicate detection query ──
  const { data: duplicateTxIds = new Set<string>() } = useQuery({
    queryKey: ['tx-duplicates', selectedCompany?.id, dateFromStr, dateToStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, transaction_date, amount, description')
        .eq('company_id', selectedCompany!.id)
        .gte('transaction_date', dateFromStr)
        .lte('transaction_date', dateToStr)
        .order('transaction_date', { ascending: false });
      if (error || !data) return new Set<string>();

      // Extract a "partner fingerprint" from description:
      // Strip leading account numbers (digits, dashes), normalize, take first 20 chars
      const fingerprint = (desc: string | null): string => {
        if (!desc) return '';
        // Remove leading bank account number patterns (sequences of digits/dashes)
        const stripped = desc.replace(/^[\d\s-]+/, '').trim();
        // Normalize: lowercase, collapse whitespace
        return stripped.toLowerCase().replace(/\s+/g, ' ').slice(0, 20);
      };

      // Group by date + amount + description fingerprint
      const groups: Record<string, typeof data> = {};
      for (const row of data) {
        const fp = fingerprint(row.description);
        const key = `${row.transaction_date}::${row.amount}::${fp}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(row);
      }

      // Only flag groups with 2+ entries as duplicates
      const ids = new Set<string>();
      for (const group of Object.values(groups)) {
        if (group.length > 1) {
          for (const row of group) ids.add(row.id);
        }
      }
      return ids;
    },
    enabled: !!selectedCompany?.id && !!dateFromStr && !!dateToStr,
    staleTime: 60_000,
  });

  const duplicateCount = duplicateTxIds.size;

  // Fetch full duplicate transactions when the "Átnézem" filter is active
  // This is separate from pagination — loads all duplicates at once
  const duplicateIdArray = useMemo(() => Array.from(duplicateTxIds), [duplicateTxIds]);
  const { data: duplicateTransactions = [], isLoading: duplicatesLoading } = useQuery({
    queryKey: ['tx-duplicate-details', selectedCompany?.id, duplicateIdArray],
    queryFn: async () => {
      if (duplicateIdArray.length === 0) return [];
      // Supabase .in() has a limit, batch if needed
      const batches: Transaction[][] = [];
      for (let i = 0; i < duplicateIdArray.length; i += 50) {
        const chunk = duplicateIdArray.slice(i, i + 50);
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .in('id', chunk)
          .order('transaction_date', { ascending: false });
        if (error) throw error;
        batches.push((data || []) as unknown as Transaction[]);
      }
      return batches.flat();
    },
    enabled: showDuplicatesOnly && duplicateIdArray.length > 0 && !!selectedCompany?.id,
    staleTime: 60_000,
  });

  // ── KPI: query ALL transactions (lightweight, no pagination) ──
  const { data: kpis } = useQuery({
    queryKey: ['tx-kpis', selectedCompany?.id, dateFromStr, dateToStr, exchangeRates],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('matched_invoice_id, is_verified, confidence_score, match_type, type, amount, currency')
        .eq('company_id', selectedCompany!.id)
        .gte('transaction_date', dateFromStr)
        .lte('transaction_date', dateToStr);
      if (error) throw error;
      const rows = data || [];
      let matched = 0, suggested = 0, unmatched = 0, autoSettled = 0, inflow = 0, outflow = 0;
      for (const t of rows) {
        const status = computeMatchStatus(t);
        if (status === 'matched') matched++;
        else if (status === 'suggested') suggested++;
        else if (status === 'auto_settled') autoSettled++;
        else unmatched++;  // includes no_invoice, invoice_missing, unmatched
        
        const currency = t.currency || 'HUF';
        const rate = exchangeRates?.[currency] ?? 1;
        const hufAmount = t.amount * rate;

        if (hufAmount > 0) inflow += hufAmount;
        else outflow += Math.abs(hufAmount);
      }
      return { matched, suggested, unmatched, autoSettled, inflow, outflow, total: rows.length };
    },
    enabled: !!selectedCompany?.id && !!dateFromStr && !!dateToStr && !!exchangeRates,
    staleTime: 30_000,
  });

  const safeKpis = kpis || { matched: 0, suggested: 0, unmatched: 0, autoSettled: 0, inflow: 0, outflow: 0, total: 0 };

  // Details dialog state
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  // ── URL-based transaction deep-linking ──
  const setTransactionParam = useCallback((txId: string | null) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (txId) next.set('transaction', txId);
      else next.delete('transaction');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const handleOpenDetails = useCallback((transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setDetailsDialogOpen(true);
    setTransactionParam(transaction.id);
  }, [setTransactionParam]);

  const handleCloseDetails = useCallback((open: boolean) => {
    setDetailsDialogOpen(open);
    if (!open) {
      setSelectedTransaction(null);
      setTransactionParam(null);
    }
  }, [setTransactionParam]);

  // ── Auto-open from URL (?transaction=<id>) ──
  const txIdFromUrl = searchParams.get('transaction');
  useEffect(() => {
    if (!txIdFromUrl || !selectedCompany?.id) return;

    // Try in loaded data
    const match = filteredTransactions.find(tx => tx.id === txIdFromUrl);
    if (match) {
      setSelectedTransaction(match);
      setDetailsDialogOpen(true);
      return;
    }

    // Fallback: fetch from Supabase
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', txIdFromUrl)
        .maybeSingle();

      if (cancelled) return;
      if (data) {
        setSelectedTransaction(data as unknown as Transaction);
        setDetailsDialogOpen(true);
      }
    })();

    return () => { cancelled = true; };
  }, [txIdFromUrl, selectedCompany?.id]);



  if (!selectedCompany) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <p className="text-muted-foreground">Válassz egy céget a folytatáshoz</p>
      </div>
    );
  }

  return (
    <div className="h-full bg-background page-animate">
      <main className="w-full max-w-none px-4 py-4">
        {/* ── Page Header (T5) ── */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-5 print:hidden">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground/90">Tranzakciók</h1>
            <p className="text-sm text-muted-foreground mt-1">Banki tranzakciók, párosítások és futárszolgálati kimutatások</p>
          </div>
        </div>


        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
          <TabsList className="mb-4 flex-wrap h-auto gap-1">
            {/* Fixed tabs */}
            <TabsTrigger value="general" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Általános
            </TabsTrigger>

            {/* Dynamic bank tabs — emerald green tint */}
            {detectedBanks.map(bankKey => {
              const cfg = BANK_CONFIG[bankKey];
              const label = cfg?.label || bankKey.toUpperCase();
              return (
                <TabsTrigger
                  key={`bank_${bankKey}`}
                  value={`bank_${bankKey}`}
                  className={cn(
                    "flex items-center gap-1.5",
                    "data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-400",
                    "data-[state=active]:border-emerald-500/30"
                  )}
                >
                  <Landmark className="h-3.5 w-3.5" />
                  {label}
                </TabsTrigger>
              );
            })}

            {/* SZÉP Kártya tab — teal tint */}
            <TabsTrigger
              value="szep"
              className={cn(
                "flex items-center gap-1.5",
                "data-[state=active]:bg-teal-500/15 data-[state=active]:text-teal-700 dark:data-[state=active]:text-teal-400",
                "data-[state=active]:border-teal-500/30"
              )}
            >
              <CreditCard className="h-3.5 w-3.5" />
              SZÉP Kártya
            </TabsTrigger>

            {/* Courier tabs — amber/brown tint */}
            {(['gls', 'mpl', 'mixpack'] as const).map(key => {
              const icons = { gls: Truck, mpl: Mail, mixpack: Package };
              const labels = { gls: 'GLS', mpl: 'MPL/Posta', mixpack: 'Mixpack' };
              const Icon = icons[key];
              return (
                <TabsTrigger
                  key={key}
                  value={key}
                  className={cn(
                    "flex items-center gap-2",
                    "data-[state=active]:bg-amber-500/15 data-[state=active]:text-amber-700 dark:data-[state=active]:text-amber-400",
                    "data-[state=active]:border-amber-500/30"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {labels[key]}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* ── KPI Summary Bar (T1) ── */}
          {activeTab === 'general' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mb-4 print:hidden">
            <div className="bg-card border border-border/60 rounded-xl p-3.5 flex items-center gap-3">
              <div className="bg-primary/10 text-primary p-2 rounded-lg"><FileText className="w-4 h-4" /></div>
              <div><div className="text-lg font-bold tabular-nums">{safeKpis.total.toLocaleString('hu-HU')}</div><div className="text-[11px] text-muted-foreground">Összes tranzakció</div></div>
            </div>
            <div className="bg-card border border-border/60 rounded-xl p-3.5 flex items-center gap-3">
              <div className="bg-emerald-500/10 text-emerald-600 p-2 rounded-lg"><Link2 className="w-4 h-4" /></div>
              <div>
                <div className="text-lg font-bold tabular-nums">
                  <span className="text-emerald-600">{safeKpis.matched}</span>
                  <span className="text-xs font-normal text-muted-foreground"> / </span>
                  <span className="text-yellow-500 text-sm">{safeKpis.suggested}</span>
                  <span className="text-xs font-normal text-muted-foreground"> / </span>
                  <span className="text-red-400 text-sm">{safeKpis.unmatched}</span>
                </div>
                <div className="text-[11px] text-muted-foreground">Párosított / Javasolt / Nincs</div>
              </div>
            </div>
            <div className="bg-card border border-border/60 rounded-xl p-3.5 flex items-center gap-3">
              <div className="bg-blue-500/10 text-blue-500 p-2 rounded-lg"><Settings className="w-4 h-4" /></div>
              <div><div className="text-lg font-bold tabular-nums text-blue-500">{safeKpis.autoSettled}</div><div className="text-[11px] text-muted-foreground">Rendezett (nincs számla)</div></div>
            </div>
            <div className="bg-card border border-border/60 rounded-xl p-3.5 flex items-center gap-3">
              <div className="bg-emerald-500/10 text-emerald-600 p-2 rounded-lg"><ArrowUpRight className="w-4 h-4" /></div>
              <div><div className="text-lg font-bold tabular-nums text-emerald-600">{fmtHuf(safeKpis.inflow)}</div><div className="text-[11px] text-muted-foreground">Bevétel (Ft)</div></div>
            </div>
            <div className="bg-card border border-border/60 rounded-xl p-3.5 flex items-center gap-3">
              <div className="bg-red-500/10 text-red-500 p-2 rounded-lg"><ArrowDownRight className="w-4 h-4" /></div>
              <div><div className="text-lg font-bold tabular-nums text-red-500">{fmtHuf(safeKpis.outflow)}</div><div className="text-[11px] text-muted-foreground">Kiadás (Ft)</div></div>
            </div>
          </div>
          )}

          {/* ── F2: Duplicate warning banner ── */}
          {activeTab === 'general' && duplicateCount > 0 && (
            <div className="mb-4 bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-400 p-3.5 rounded-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300 print:hidden">
              <div className="flex items-center gap-2.5">
                <div className="bg-amber-500/20 p-1.5 rounded-lg">
                  <Copy className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Lehetséges duplikátumok</p>
                  <p className="text-xs opacity-80">
                    {duplicateCount} tranzakció gyanúsan ismétlődik (azonos dátum és összeg). Ellenőrizd, hogy nem lettek-e duplán feltöltve.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 text-xs border-amber-500/30 hover:bg-amber-500/20 text-amber-900 dark:text-amber-300 bg-transparent h-8"
                onClick={() => setShowDuplicatesOnly(true)}
              >
                Átnézem
              </Button>
            </div>
          )}

          {/* Általános tranzakciók (default tab) */}
          <TabsContent value="general" className="mt-0 content-animate">
            <Card>
              <CardHeader>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-bold">Banki tranzakciók</CardTitle>
                    <CardDescription>
                      Banki tranzakciók és számla párosítások - {totalCount} találat
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
                            disabled={syncing}
                          >
                            <RefreshCw className={cn("h-4 w-4 mr-2", syncing && "animate-spin")} />
                            {syncing ? 'Szinkronizálás...' : 'Szinkronizálás'}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Tranzakciók szinkronizálása és feldolgozása</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" disabled={exporting}>
                          {exporting ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4 mr-2" />
                          )}
                          Export
                          <ChevronDown className="h-4 w-4 ml-2" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => runExport('csv')}>
                          <FileText className="h-4 w-4 mr-2" />
                          Export CSV
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => runExport('xlsx')}>
                          <FileText className="h-4 w-4 mr-2" />
                          Export XLSX
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                <TransactionFilters
                  filters={filters}
                  onFilterChange={setFilters}
                  onClearFilters={clearFilters}
                  hasActiveFilters={!!hasActiveFilters}
                  uniqueCurrencies={uniqueCurrencies}
                  uniqueTypes={uniqueTypes}
                />

                <UnifiedPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalCount}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={handlePageSizeChange}
                  className="mb-3"
                />

                <div className="flex items-center gap-4 mb-2 text-[11px] text-muted-foreground flex-wrap">
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
                    <div className="w-3 h-3 rounded-sm bg-[var(--row-settled-bg)] border-l-2 border-l-[var(--row-settled-border)]" />
                    <span>Rendezett (nincs számla)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-[var(--row-noinvoice-bg)] border-l-2 border-l-[var(--row-noinvoice-border)]" />
                    <span>Nincs számla</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-[var(--row-unmatched-bg)] border-l-2 border-l-[var(--row-unmatched-border)]" />
                    <span>Nincs párosítás</span>
                  </div>
                </div>

                {/* Duplicate filter active banner */}
                {showDuplicatesOnly && (
                  <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mb-3 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-300">
                      <Copy className="w-4 h-4" />
                      <span className="font-medium">Duplikátum szűrő aktív</span>
                      <span className="text-xs opacity-70">— Csak a gyanús ismétlődések jelennek meg</span>
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 text-xs text-amber-800 dark:text-amber-300 hover:bg-amber-500/20" onClick={() => setShowDuplicatesOnly(false)}>
                      Szűrő kikapcsolása
                    </Button>
                  </div>
                )}

                <TransactionTable
                  transactions={showDuplicatesOnly ? duplicateTransactions : filteredTransactions}
                  loading={showDuplicatesOnly ? duplicatesLoading : loading}
                  pageSize={showDuplicatesOnly ? 100 : pageSize}
                  hasActiveFilters={!!hasActiveFilters || showDuplicatesOnly}
                  onClearFilters={() => { clearFilters(); setShowDuplicatesOnly(false); }}
                  onSort={handleSort}
                  onOpenDetails={handleOpenDetails}
                  uploadBankMap={uploadBankMap}
                  bankConfig={BANK_CONFIG}
                  duplicateTxIds={duplicateTxIds}
                  onBulkStatusChange={writable ? handleBulkStatusChange : undefined}
                  onBulkExport={handleBulkExport}
                  onBulkDelete={writable ? handleBulkDelete : undefined}
                />

                {!showDuplicatesOnly && (
                <UnifiedPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalCount}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={handlePageSizeChange}
                  className="mt-3"
                />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Courier tabs */}
          <TabsContent value="gls" className="content-animate">
            <CourierReportTab reportType="gls" />
          </TabsContent>
          <TabsContent value="mpl" className="content-animate">
            <CourierReportTab reportType="mpl" />
          </TabsContent>
          <TabsContent value="mixpack" className="content-animate">
            <CourierReportTab reportType="mixpack" />
          </TabsContent>

          {/* SZÉP Kártya tab */}
          <TabsContent value="szep" className="content-animate">
            <SzepCardTab />
          </TabsContent>

          {/* Dynamic bank tabs */}
          {detectedBanks.map(bankKey => {
            const cfg = BANK_CONFIG[bankKey];
            const label = cfg?.label || bankKey.toUpperCase();
            const uploadIds = bankUploadIds[bankKey] || [];
            return (
              <TabsContent key={`bank_${bankKey}`} value={`bank_${bankKey}`} className="content-animate">
                <BankTransactionTab
                  bankKey={bankKey}
                  bankLabel={label}
                  uploadIds={uploadIds}
                  companyId={selectedCompany?.id || ''}
                  dateFromStr={dateFromStr}
                  dateToStr={dateToStr}
                  onOpenDetails={handleOpenDetails}
                />
              </TabsContent>
            );
          })}
        </Tabs>
      </main>

      <TransactionDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={handleCloseDetails}
        transaction={selectedTransaction}
        companyId={selectedCompany?.id || ''}
        onUpdate={() => {
          queryClient.invalidateQueries({ queryKey: ['transactions', selectedCompany?.id || ''] });
        }}
      />
    </div>
  );
};

// ── Bank Transaction Tab (U1 + U2 + F3) ──
// Fetches and displays transactions for a specific detected bank with KPI cards and balance tracking

function BankTransactionTab({ bankKey, bankLabel, uploadIds, companyId, dateFromStr, dateToStr, onOpenDetails }: {
  bankKey: string;
  bankLabel: string;
  uploadIds: string[];
  companyId: string;
  dateFromStr: string;
  dateToStr: string;
  onOpenDetails: (tx: Transaction) => void;
}) {
  const { data: exchangeRates } = useExchangeRates();

  // Main transactions query for this bank tab
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['bank-transactions', companyId, bankKey, dateFromStr, dateToStr, uploadIds],
    queryFn: async () => {
      if (uploadIds.length === 0) return [];
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('company_id', companyId)
        .in('upload_id', uploadIds)
        .gte('transaction_date', dateFromStr)
        .lte('transaction_date', dateToStr)
        .order('transaction_date', { ascending: false });
      if (error) { reportError({ type: 'db_query', component: 'TransactionsPage', action: 'error', message: 'bank-tx error:', error }); return []; }
      return (data || []) as unknown as Transaction[];
    },
    enabled: uploadIds.length > 0 && !!companyId,
    staleTime: 30_000,
  });

  // F3: Opening balance query (sum of all transactions BEFORE the date range)
  const { data: openingBalance = 0 } = useQuery({
    queryKey: ['bank-opening-balance', companyId, bankKey, dateFromStr, uploadIds],
    queryFn: async () => {
      if (uploadIds.length === 0 || !dateFromStr) return 0;
      const { data, error } = await supabase
        .from('transactions')
        .select('amount, currency')
        .eq('company_id', companyId)
        .in('upload_id', uploadIds)
        .lt('transaction_date', dateFromStr);
      if (error || !data) return 0;
      let total = 0;
      for (const row of data) {
        const rate = exchangeRates?.[(row as any).currency || 'HUF'] ?? 1;
        total += (row as any).amount * rate;
      }
      return total;
    },
    enabled: uploadIds.length > 0 && !!companyId && !!dateFromStr && !!exchangeRates,
    staleTime: 60_000,
  });

  // U1: Compute KPIs from loaded transactions
  const bankKpis = useMemo(() => {
    let inflow = 0, outflow = 0;
    for (const t of transactions) {
      const currency = (t as any).currency || 'HUF';
      const rate = exchangeRates?.[currency] ?? 1;
      const hufAmount = t.amount * rate;
      if (hufAmount > 0) inflow += hufAmount;
      else outflow += Math.abs(hufAmount);
    }
    const periodNet = inflow - outflow;
    const closingBalance = openingBalance + periodNet;
    return { count: transactions.length, inflow, outflow, periodNet, closingBalance };
  }, [transactions, exchangeRates, openingBalance]);

  const cfg = BANK_CONFIG[bankKey];
  const bgClass = cfg?.bgClass || 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';

  // U2: Contextual empty state
  if (!isLoading && uploadIds.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 flex flex-col items-center justify-center gap-4">
          <div className={cn("p-4 rounded-2xl", bgClass)}>
            <Upload className="w-8 h-8" />
          </div>
          <div className="text-center">
            <h3 className="font-semibold text-base">Nincs feldolgozott bankkivonat</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              A <strong>{bankLabel}</strong> bankhoz még nincs feldolgozott kivonat feltöltve. Töltsd fel a bankkivonatot a Feltöltés oldalon.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* U1: KPI Summary Cards */}
      {!isLoading && transactions.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="bg-card border border-border/60 rounded-xl p-3.5 flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", bgClass)}>
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="text-lg font-bold tabular-nums">{bankKpis.count.toLocaleString('hu-HU')}</div>
              <div className="text-[11px] text-muted-foreground">Tranzakció</div>
            </div>
          </div>
          <div className="bg-card border border-border/60 rounded-xl p-3.5 flex items-center gap-3">
            <div className="bg-emerald-500/10 text-emerald-600 p-2 rounded-lg"><TrendingUp className="w-4 h-4" /></div>
            <div>
              <div className="text-lg font-bold tabular-nums text-emerald-600">{fmtHuf(bankKpis.inflow)}</div>
              <div className="text-[11px] text-muted-foreground">Bevétel (Ft)</div>
            </div>
          </div>
          <div className="bg-card border border-border/60 rounded-xl p-3.5 flex items-center gap-3">
            <div className="bg-red-500/10 text-red-500 p-2 rounded-lg"><TrendingDown className="w-4 h-4" /></div>
            <div>
              <div className="text-lg font-bold tabular-nums text-red-500">{fmtHuf(bankKpis.outflow)}</div>
              <div className="text-[11px] text-muted-foreground">Kiadás (Ft)</div>
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="bg-card border border-border/60 rounded-xl p-3.5 flex items-center gap-3 cursor-help">
                <div className="bg-blue-500/10 text-blue-500 p-2 rounded-lg"><Wallet className="w-4 h-4" /></div>
                <div>
                  <div className={cn("text-lg font-bold tabular-nums", openingBalance >= 0 ? 'text-foreground' : 'text-red-500')}>{fmtHuf(openingBalance)}</div>
                  <div className="text-[11px] text-muted-foreground">Nyitó egyenleg</div>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent><p>Az időszak előtti összes tranzakció összege<br/>Megbízhatóság a feltöltött adatok teljességétől függ</p></TooltipContent>
          </Tooltip>
          <div className={cn("bg-card border-2 rounded-xl p-3.5 flex items-center gap-3", bankKpis.closingBalance >= 0 ? 'border-emerald-500/30' : 'border-red-500/30')}>
            <div className={cn("p-2 rounded-lg", bankKpis.closingBalance >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-500')}>
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <div className={cn("text-lg font-bold tabular-nums", bankKpis.closingBalance >= 0 ? 'text-emerald-600' : 'text-red-500')}>{fmtHuf(bankKpis.closingBalance)}</div>
              <div className="text-[11px] text-muted-foreground">Záró egyenleg</div>
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-lg", bgClass)}>
                <Landmark className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold">{bankLabel} tranzakciók</CardTitle>
                <CardDescription>
                  {isLoading ? 'Betöltés...' : transactions.length === 0
                    ? 'Nincs tranzakció a kiválasztott időszakban — próbáld meg módosítani a dátumszűrőt'
                    : `${transactions.length} tranzakció a kiválasztott időszakban`
                  }
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className={cn("text-xs px-2 py-1", bgClass)}>
              {bankLabel}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <TransactionTable
            transactions={transactions}
            loading={isLoading}
            pageSize={50}
            hasActiveFilters={false}
            onClearFilters={() => {}}
            onSort={() => {}}
            onOpenDetails={onOpenDetails}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default TransactionsPage;
