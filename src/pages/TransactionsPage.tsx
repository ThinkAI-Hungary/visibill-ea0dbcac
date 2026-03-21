import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { RefreshCw, Download, ChevronDown, FileText } from 'lucide-react';
import { UnifiedPagination } from '@/components/ui/unified-pagination';
import { TransactionDetailsDialog } from '@/components/TransactionDetailsDialog';
import TransactionFilters from '@/components/transactions/TransactionFilters';
import TransactionTable from '@/components/transactions/TransactionTable';
import { useTransactionData, type Transaction } from '@/hooks/useTransactionData';

const TransactionsPage = () => {
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

  // Details dialog state
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  const handleOpenDetails = useCallback((transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setDetailsDialogOpen(true);
  }, []);

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
      </main>

      <TransactionDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
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
