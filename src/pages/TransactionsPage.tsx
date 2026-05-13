import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { RefreshCw, Download, ChevronDown, FileText, Package, Truck, Mail } from 'lucide-react';
import { UnifiedPagination } from '@/components/ui/unified-pagination';
import { TransactionDetailsDialog } from '@/components/TransactionDetailsDialog';
import TransactionFilters from '@/components/transactions/TransactionFilters';
import TransactionTable from '@/components/transactions/TransactionTable';
import { useTransactionData, type Transaction } from '@/hooks/useTransactionData';
import { supabase } from '@/integrations/supabase/client';
import CourierReportTab from '@/components/CourierReportTab';
import { useUrlTab } from '@/lib/navigation';

const TAB_VALUES = ['general', 'gls', 'mpl', 'mixpack'] as const;
type TabValue = typeof TAB_VALUES[number];

const TABS: { value: TabValue; label: string; icon: typeof FileText }[] = [
  { value: 'general', label: 'Általános', icon: FileText },
  { value: 'gls', label: 'GLS', icon: Truck },
  { value: 'mpl', label: 'MPL/Posta', icon: Mail },
  { value: 'mixpack', label: 'Mixpack', icon: Package },
];

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

  const [searchParams, setSearchParams] = useSearchParams();

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
    <div className="h-full bg-background">
      <main className="w-full max-w-none px-4 py-4">
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

          {/* Általános tranzakciók (default tab) */}
          <TabsContent value="general">
            <Card>
              <CardHeader>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-2xl font-bold">Tranzakciók</CardTitle>
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
          <TabsContent value="gls">
            <CourierReportTab reportType="gls" />
          </TabsContent>

          {/* MPL/Posta tab */}
          <TabsContent value="mpl">
            <CourierReportTab reportType="mpl" />
          </TabsContent>

          {/* Mixpack tab */}
          <TabsContent value="mixpack">
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
