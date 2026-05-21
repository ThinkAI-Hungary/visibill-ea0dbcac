import { useState, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { RefreshCw, Download, ChevronDown, FileText, Package, Truck, Mail, ArrowDownRight, ArrowUpRight, Link2, Link2Off, Loader2 } from 'lucide-react';
import { UnifiedPagination } from '@/components/ui/unified-pagination';
import { TransactionDetailsDialog } from '@/components/TransactionDetailsDialog';
import TransactionFilters from '@/components/transactions/TransactionFilters';
import TransactionTable from '@/components/transactions/TransactionTable';
import { useTransactionData, type Transaction } from '@/hooks/useTransactionData';
import { supabase } from '@/integrations/supabase/client';
import { useDateRange } from '@/contexts/DateRangeContext';
import CourierReportTab from '@/components/CourierReportTab';
import { useUrlTab } from '@/lib/navigation';
import { computeMatchStatus } from '@/hooks/useComputedStatus';
import { format } from 'date-fns';
import { useExchangeRates } from '@/hooks/useExchangeRates';


const TAB_VALUES = ['general', 'gls', 'mpl', 'mixpack'] as const;
type TabValue = typeof TAB_VALUES[number];

const TABS: { value: TabValue; label: string; icon: typeof FileText }[] = [
  { value: 'general', label: 'Általános', icon: FileText },
  { value: 'gls', label: 'GLS', icon: Truck },
  { value: 'mpl', label: 'MPL/Posta', icon: Mail },
  { value: 'mixpack', label: 'Mixpack', icon: Package },
];

const fmtHuf = (val: number) => new Intl.NumberFormat('hu-HU').format(Math.round(val));

const TransactionsPage = () => {
  const [activeTab, setActiveTab] = useUrlTab('transactions', 'general' as TabValue, TAB_VALUES);

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
    queryClient,
  } = useTransactionData();

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
      let matched = 0, suggested = 0, unmatched = 0, inflow = 0, outflow = 0;
      for (const t of rows) {
        const status = computeMatchStatus(t);
        if (status === 'matched') matched++;
        else if (status === 'suggested') suggested++;
        else unmatched++;
        
        const currency = t.currency || 'HUF';
        const rate = exchangeRates?.[currency] ?? 1;
        const hufAmount = t.amount * rate;

        if (hufAmount > 0) inflow += hufAmount;
        else outflow += Math.abs(hufAmount);
      }
      return { matched, suggested, unmatched, inflow, outflow, total: rows.length };
    },
    enabled: !!selectedCompany?.id && !!dateFromStr && !!dateToStr && !!exchangeRates,
    staleTime: 30_000,
  });

  const safeKpis = kpis || { matched: 0, suggested: 0, unmatched: 0, inflow: 0, outflow: 0, total: 0 };

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
          <TabsList className="mb-4">
            {TABS.map(t => {
              const Icon = t.icon;
              return (
                <TabsTrigger key={t.value} value={t.value} className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {t.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* ── KPI Summary Bar (T1) ── */}
          {activeTab === 'general' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 print:hidden">
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
                  <span className="text-amber-500 text-sm">{safeKpis.suggested}</span>
                  <span className="text-xs font-normal text-muted-foreground"> / </span>
                  <span className="text-red-400 text-sm">{safeKpis.unmatched}</span>
                </div>
                <div className="text-[11px] text-muted-foreground">Párosított / Javasolt / Nincs</div>
              </div>
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

                <TransactionTable
                  transactions={filteredTransactions}
                  loading={loading}
                  pageSize={pageSize}
                  hasActiveFilters={!!hasActiveFilters}
                  onClearFilters={clearFilters}
                  onSort={handleSort}
                  onOpenDetails={handleOpenDetails}
                />

                <UnifiedPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalCount}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={handlePageSizeChange}
                  className="mt-3"
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* GLS tab */}
          <TabsContent value="gls" className="content-animate">
            <CourierReportTab reportType="gls" />
          </TabsContent>

          {/* MPL/Posta tab */}
          <TabsContent value="mpl" className="content-animate">
            <CourierReportTab reportType="mpl" />
          </TabsContent>

          {/* Mixpack tab */}
          <TabsContent value="mixpack" className="content-animate">
            <CourierReportTab reportType="mixpack" />
          </TabsContent>
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

export default TransactionsPage;
