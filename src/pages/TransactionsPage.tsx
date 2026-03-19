import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useDateRange } from '@/contexts/DateRangeContext';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn, formatCurrency } from '@/lib/utils';
import { CalendarIcon, Search, X, CheckCircle2, AlertCircle, HelpCircle, ArrowUpDown, RefreshCw, Download, ChevronDown, FileText, Eye, Sparkles } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { UnifiedPagination } from '@/components/ui/unified-pagination';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { TransactionReasonCell } from '@/components/TransactionReasonCell';
import { TransactionDetailsDialog } from '@/components/TransactionDetailsDialog';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { TableEmptyState } from '@/components/ui/table-empty-state';
import { TablePlaceholderRows } from '@/components/ui/table-placeholder-rows';

interface Transaction {
  id: string;
  transaction_date: string;
  description: string | null;
  amount: number;
  currency: string | null;
  type: string | null;
  matched_invoice_id: string | null;
  confidence_score: number | null;
  is_verified: boolean | null;
  match_type: string | null;
  reason: string | null;
  created_at: string | null;
  company_id: string | null;
}

interface TransactionFilters {
  search: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  amountMin: string;
  amountMax: string;
  currency: string;
  type: string;
  matchStatus: string;
}

type MatchStatus = 'matched' | 'suggested' | 'unmatched';

const isAutoApproved = (transaction: Transaction): boolean => {
  return !!(transaction.confidence_score && transaction.confidence_score >= 0.9 && transaction.matched_invoice_id);
};

const isNoCategoryMatch = (transaction: Transaction): boolean => {
  return transaction.match_type === 'no_match_category';
};

const isBankCostType = (transaction: Transaction): boolean => {
  return !!transaction.type && transaction.type.toLowerCase().trim() === 'bankköltség';
};

const isCashTransactionType = (transaction: Transaction): boolean => {
  const cashTypes = [
    'atm készpénzfelvét',
    'pénztári kp felvét',
    'pénztári kp befizetés',
    'kp befizetés atm-en keresztül',
  ];
  return !!transaction.type && cashTypes.includes(transaction.type.toLowerCase());
};

const getMatchStatus = (transaction: Transaction): MatchStatus => {
  // Cash transactions, no_match_category, and bankköltség treated as matched/validated
  if (isNoCategoryMatch(transaction) || isCashTransactionType(transaction) || isBankCostType(transaction)) {
    return 'matched';
  }
  if (transaction.is_verified && transaction.matched_invoice_id) {
    return 'matched';
  }
  if (transaction.matched_invoice_id && !transaction.is_verified) {
    return 'suggested';
  }
  return 'unmatched';
};

const getMatchStatusIcon = (status: MatchStatus) => {
  switch (status) {
    case 'matched':
      return <CheckCircle2 className="h-4 w-4 text-success" />;
    case 'suggested':
      return <AlertCircle className="h-4 w-4 text-warning" />;
    case 'unmatched':
      return <HelpCircle className="h-4 w-4 text-destructive" />;
  }
};

const getRowBackgroundClass = (transaction: Transaction): string => {
  const hoverClass = 'hover:shadow-[inset_0_0_0_100vw_rgba(0,0,0,0.04)] dark:hover:shadow-[inset_0_0_0_100vw_rgba(255,255,255,0.06)]';
  if (isNoCategoryMatch(transaction) || isCashTransactionType(transaction) || isBankCostType(transaction) || (transaction.is_verified && transaction.matched_invoice_id)) {
    return `bg-[hsl(var(--success-row-bg))] text-[hsl(var(--success-row-text))] border-l-4 border-l-success border-b border-border/40 ${hoverClass}`;
  }
  if (transaction.matched_invoice_id && !transaction.is_verified) {
    return `bg-[hsl(var(--warning-row-bg))] text-[hsl(var(--warning-row-text))] border-l-4 border-l-warning border-b border-border/40 ${hoverClass}`;
  }
  return `bg-[hsl(var(--error-row-bg))] text-[hsl(var(--error-row-text))] border-l-4 border-l-destructive border-b border-border/40 ${hoverClass}`;
};

// Type-based background color mapping
const getTypeBgClass = (type: string | null): string => {
  if (!type) return '';
  const t = type.toLowerCase().trim();

  if (t === 'szállítói tranzakció') return 'bg-[hsl(var(--tr-supplier-bg))] text-[hsl(var(--tr-supplier-text))]';
  if (t === 'vevői tranzakció') return 'bg-[hsl(var(--tr-customer-bg))] text-[hsl(var(--tr-customer-text))]';
  if (t === 'számlák közötti átvezetés') return 'bg-[hsl(var(--tr-transfer-bg))] text-[hsl(var(--tr-transfer-text))]';
  if (t === 'banki számlavezetési díj') return 'bg-[hsl(var(--tr-bankfee-bg))] text-[hsl(var(--tr-bankfee-text))]';
  if (t === 'kártyadíj') return 'bg-[hsl(var(--tr-cardfee-bg))] text-[hsl(var(--tr-cardfee-text))]';
  if (t === 'hiteltörlesztés' || t === 'tranzakciós illeték' || t === 'kamat') return 'bg-[hsl(var(--tr-loan-bg))] text-[hsl(var(--tr-loan-text))]';
  if (t === 'atm pénzfelvét') return 'bg-[hsl(var(--tr-atm-bg))] text-[hsl(var(--tr-atm-text))]';
  if (t === 'pénztári kp felvét') return 'bg-[hsl(var(--tr-cashout-bg))] text-[hsl(var(--tr-cashout-text))]';
  if (t === 'pénztári kp befizetés' || t === 'kp befizetés atm-en keresztül') return 'bg-[hsl(var(--tr-cashin-bg))] text-[hsl(var(--tr-cashin-text))]';
  if (t === 'bérek') return 'bg-[hsl(var(--tr-salary-bg))] text-[hsl(var(--tr-salary-text))]';
  if (t === 'járulékok/adók') return 'bg-[hsl(var(--tr-tax-bg))] text-[hsl(var(--tr-tax-text))]';
  if (t === 'bankköltség') return 'bg-[hsl(var(--tr-bankcost-bg))] text-[hsl(var(--tr-bankcost-text))]';
  if (t === 'kamatjóváírás') return 'bg-[hsl(var(--tr-interest-bg))] text-[hsl(var(--tr-interest-text))]';
  if (t === 'atm készpénzfelvét') return 'bg-[hsl(var(--tr-atmcash-bg))] text-[hsl(var(--tr-atmcash-text))]';

  return '';
};

const TransactionsPage = () => {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const { dateFrom, dateTo } = useDateRange();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [sortField, setSortField] = useState<string>('transaction_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Pagination state
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);

  // Details dialog state
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  const [filters, setFilters] = useState<TransactionFilters>({
    search: '',
    dateFrom: undefined,
    dateTo: undefined,
    amountMin: '',
    amountMax: '',
    currency: 'all',
    type: 'all',
    matchStatus: 'all'
  });

  // Sync filters.dateFrom/dateTo with global date range
  useEffect(() => {
    setFilters(prev => ({ ...prev, dateFrom, dateTo }));
  }, [dateFrom, dateTo]);

  // Build server-side filter params for query key
  const dateFromStr = filters.dateFrom ? format(filters.dateFrom, 'yyyy-MM-dd') : '';
  const dateToStr = filters.dateTo ? format(filters.dateTo, 'yyyy-MM-dd') : '';
  const serverFilters = useMemo(() => ({
    currency: filters.currency,
    type: filters.type,
    search: filters.search,
  }), [filters.currency, filters.type, filters.search]);

  // Fetch distinct currency/type values for filter dropdowns (lightweight query)
  const { data: filterOptions } = useQuery({
    queryKey: queryKeys.transactionFilterOptions(selectedCompany?.id || ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('currency, type')
        .eq('company_id', selectedCompany!.id);
      if (error) throw error;
      const currencies = [...new Set((data || []).map(t => t.currency).filter(Boolean))] as string[];
      const types = [...new Set((data || []).map(t => t.type).filter(Boolean))] as string[];
      return { currencies, types };
    },
    enabled: !!user && !!selectedCompany?.id,
    staleTime: 5 * 60 * 1000, // cache for 5 minutes
  });

  const uniqueCurrencies = filterOptions?.currencies || [];
  const uniqueTypes = filterOptions?.types || [];

  // TanStack Query: fetch transactions with server-side filtering + pagination
  const { data: queryResult, isLoading: loading } = useQuery({
    queryKey: [
      ...queryKeys.transactions(
        selectedCompany?.id || '',
        dateFromStr,
        dateToStr,
        currentPage,
        pageSize,
        serverFilters
      ),
      sortField,
      sortDirection,
    ],
    queryFn: async () => {
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('transactions')
        .select('*', { count: 'exact' })
        .eq('company_id', selectedCompany!.id)
        .order(sortField, { ascending: sortDirection === 'asc' });

      // Server-side date filtering
      if (dateFromStr) query = query.gte('transaction_date', dateFromStr);
      if (dateToStr) query = query.lte('transaction_date', dateToStr);

      // Server-side currency and type filtering
      if (filters.currency !== 'all') query = query.eq('currency', filters.currency);
      if (filters.type !== 'all') query = query.eq('type', filters.type);

      // Server-side text search
      if (filters.search) {
        query = query.or(`description.ilike.%${filters.search}%,type.ilike.%${filters.search}%`);
      }

      // Server-side pagination
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      const fetchedTransactions = (data || []) as Transaction[];

      // Auto-approve transactions with confidence_score >= 0.9 (current page only)
      const toAutoApprove = fetchedTransactions.filter(
        t => t.matched_invoice_id && !t.is_verified && t.confidence_score && t.confidence_score >= 0.9
      );

      if (toAutoApprove.length > 0) {
        const ids = toAutoApprove.map(t => t.id);
        await supabase
          .from('transactions')
          .update({ is_verified: true, match_type: 'auto' })
          .in('id', ids);

        fetchedTransactions.forEach(t => {
          if (ids.includes(t.id)) {
            t.is_verified = true;
            t.match_type = 'auto';
          }
        });
      }

      return { rows: fetchedTransactions, totalCount: count ?? 0 };
    },
    enabled: !!user && !!selectedCompany?.id,
    placeholderData: (previousData) => previousData, // keep previous data while loading new page
  });

  const transactions = queryResult?.rows ?? [];
  const totalCount = queryResult?.totalCount ?? 0;

  // Open details dialog
  const handleOpenDetails = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setDetailsDialogOpen(true);
  };

  // Client-side post-filters (amount range, matchStatus – not feasible server-side)
  const filteredTransactions = useMemo(() => {
    let result = [...transactions];

    // Amount filters (uses Math.abs, not feasible as simple server-side filter)
    if (filters.amountMin) {
      const min = parseFloat(filters.amountMin);
      if (!isNaN(min)) result = result.filter(t => Math.abs(t.amount) >= min);
    }
    if (filters.amountMax) {
      const max = parseFloat(filters.amountMax);
      if (!isNaN(max)) result = result.filter(t => Math.abs(t.amount) <= max);
    }

    // Match status filter (computed field, not in DB)
    if (filters.matchStatus !== 'all') {
      result = result.filter(t => getMatchStatus(t) === filters.matchStatus);
    }

    return result;
  }, [transactions, filters.amountMin, filters.amountMax, filters.matchStatus]);

  // Server-side pagination: totalPages comes from the exact count
  const totalPages = Math.ceil(totalCount / pageSize);
  // The current page data (post-filtered for amount/matchStatus)
  const paginatedTransactions = filteredTransactions;

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      dateFrom: undefined,
      dateTo: undefined,
      amountMin: '',
      amountMax: '',
      currency: 'all',
      type: 'all',
      matchStatus: 'all'
    });
    setCurrentPage(1);
  };

  const hasActiveFilters = filters.search || filters.dateFrom || filters.dateTo ||
    filters.amountMin || filters.amountMax || filters.currency !== 'all' ||
    filters.type !== 'all' || filters.matchStatus !== 'all';

  // Reset page when server-side filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters.search, filters.dateFrom, filters.dateTo, filters.currency, filters.type, filters.matchStatus]);

  // Sync function - refreshes the transactions table (prefix match invalidates all pages)
  const handleSync = async () => {
    setSyncing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['transactions', selectedCompany?.id || ''] });
      await queryClient.invalidateQueries({ queryKey: queryKeys.transactionFilterOptions(selectedCompany?.id || '') });
      toast.success('Tranzakciók frissítve!');
    } catch (error: any) {
      console.error('Sync error:', error);
      toast.error('Frissítés sikertelen', {
        description: error.message || 'Hiba történt a frissítés során'
      });
    } finally {
      setSyncing(false);
    }
  };

  // Export function
  const handleExport = (exportFormat: 'csv' | 'xlsx') => {
    const headers = [
      'Dátum', 'Leírás', 'Összeg', 'Pénznem', 'Típus', 'Státusz', 'Pontszám', 'Indoklás'
    ];

    const exportData = filteredTransactions.map(transaction => {
      const matchStatus = getMatchStatus(transaction);
      const statusText = matchStatus === 'matched' ? 'Párosított'
        : matchStatus === 'suggested' ? 'Javasolt'
          : 'Párosítatlan';

      return [
        transaction.transaction_date || '',
        transaction.description || '',
        transaction.amount?.toString() || '0',
        transaction.currency || 'HUF',
        transaction.type || '',
        statusText,
        transaction.confidence_score ? Math.round(transaction.confidence_score * 100).toString() + '%' : '',
        transaction.reason || ''
      ];
    });

    exportToFile(headers, exportData, exportFormat, 'tranzakciok');
  };

  const exportToFile = (headers: string[], data: string[][], exportFormat: 'csv' | 'xlsx', filename: string) => {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');

    if (exportFormat === 'csv') {
      const csvContent = [
        headers.join(','),
        ...data.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${filename}_${timestamp}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Tranzakciók exportálva CSV formátumban");
    } else {
      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Tranzakciók');

      XLSX.writeFile(workbook, `${filename}_${timestamp}.xlsx`);

      toast.success("Tranzakciók exportálva XLSX formátumban");
    }
  };

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
            {/* Filters */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 p-4 bg-muted/20 rounded-lg border border-border/30">
              {/* Search */}
              <div className="relative col-span-2 md:col-span-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Keresés..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-9 h-9 bg-secondary/50 border border-white/10 focus:border-primary/50"
                />
              </div>

              {/* Currency */}
              <Select
                value={filters.currency}
                onValueChange={(value) => setFilters(prev => ({ ...prev, currency: value }))}
              >
                <SelectTrigger className="h-9 bg-secondary/50 border border-white/10">
                  <SelectValue placeholder="Pénznem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Minden pénznem</SelectItem>
                  {uniqueCurrencies.map(currency => (
                    <SelectItem key={currency} value={currency}>{currency}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Match Status */}
              <Select
                value={filters.matchStatus}
                onValueChange={(value) => setFilters(prev => ({ ...prev, matchStatus: value }))}
              >
                <SelectTrigger className="h-9 bg-secondary/50 border border-white/10">
                  <SelectValue placeholder="Státusz" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Minden státusz</SelectItem>
                  <SelectItem value="matched">Párosított</SelectItem>
                  <SelectItem value="suggested">Javasolt</SelectItem>
                  <SelectItem value="unmatched">Párosítatlan</SelectItem>
                </SelectContent>
              </Select>

              {/* Type */}
              <Select
                value={filters.type}
                onValueChange={(value) => setFilters(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger className="h-9 bg-secondary/50 border border-white/10">
                  <SelectValue placeholder="Típus" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Minden típus</SelectItem>
                  {uniqueTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>



              {/* Clear button */}
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-9 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4 mr-1" />
                  Törlés
                </Button>
              )}
            </div>

            {/* Top Pagination */}
            <UnifiedPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalCount}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
              className="mb-3"
            />

            {/* Transactions Table */}
            <div className="rounded-lg border border-border/50 overflow-auto max-h-[calc(100vh-320px)]">
              <table className="w-full caption-bottom text-sm table-fixed compact-table">
                <TableHeader className="sticky top-0 z-10">
                  <TableRow className="bg-muted hover:bg-muted">
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 font-semibold w-[10%]"
                      onClick={() => handleSort('transaction_date')}
                    >
                      <div className="flex items-center gap-2">
                        Dátum
                        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold w-[30%]">Leírás</TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 text-right font-semibold w-[12%]"
                      onClick={() => handleSort('amount')}
                    >
                      <div className="flex items-center justify-end gap-2">
                        Összeg
                        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold w-[7%]">Pénznem</TableHead>
                    <TableHead className="font-semibold w-[14%]">Típus</TableHead>
                    <TableHead className="font-semibold w-[8%] text-center">Státusz</TableHead>
                    <TableHead className="font-semibold w-[9%]">Indoklás</TableHead>
                    <TableHead className="font-semibold w-[10%] text-center">Művelet</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableSkeleton rows={10} columns={8} />
                  ) : paginatedTransactions.length === 0 ? (
                    <TableEmptyState
                      colSpan={8}
                      title="Nincs tranzakció"
                      description="Tölts fel bankkivonatot a Feltöltés oldalon, vagy módosítsd a szűrőket."
                      onClearFilters={hasActiveFilters ? clearFilters : undefined}
                    />
                  ) : (
                    paginatedTransactions.map((transaction) => {
                      const matchStatus = getMatchStatus(transaction);

                      return (
                        <TableRow
                          key={transaction.id}
                          className={cn("h-10", getRowBackgroundClass(transaction))}
                        >
                          <TableCell className="font-medium text-xs">
                            {transaction.transaction_date
                              ? format(new Date(transaction.transaction_date), 'yyyy.MM.dd')
                              : '-'
                            }
                          </TableCell>
                          <TableCell className="max-w-[200px] text-xs">
                            {transaction.description ? (
                              <TooltipProvider delayDuration={0}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="block truncate cursor-default">
                                      {transaction.description}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-[400px]">
                                    <p className="whitespace-pre-wrap text-sm">{transaction.description}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : '-'}
                          </TableCell>
                          <TableCell className={cn(
                            "text-right font-mono text-xs",
                            transaction.amount >= 0 ? "text-success" : "text-destructive"
                          )}>
                            {formatCurrency(transaction.amount, transaction.currency || 'HUF')}
                          </TableCell>
                          <TableCell className="text-xs">{transaction.currency || 'HUF'}</TableCell>
                          <TableCell>
                            {transaction.type ? (
                              <span className={cn(
                                "text-xs px-2.5 py-0.5 rounded-md inline-flex items-center justify-center text-center min-w-[170px] min-h-[24px] whitespace-nowrap",
                                getTypeBgClass(transaction.type) || "text-muted-foreground"
                              )}>
                                {transaction.type}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <TooltipProvider delayDuration={0}>
                              <Tooltip>
                                <TooltipTrigger>
                                  <div className="flex items-center justify-center gap-1">
                                    {getMatchStatusIcon(matchStatus)}
                                    {transaction.match_type === 'auto' && (
                                      <Sparkles className="h-3 w-3 text-success" />
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {matchStatus === 'matched' && transaction.match_type === 'auto' && 'Automatikusan jóváhagyva (≥97%)'}
                                  {matchStatus === 'matched' && transaction.match_type !== 'auto' && 'Párosított és jóváhagyott'}
                                  {matchStatus === 'suggested' && `Javasolt párosítás ${transaction.confidence_score ? `(${Math.round(transaction.confidence_score * 100)}%)` : ''}`}
                                  {matchStatus === 'unmatched' && 'Nincs párosítva'}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                          <TableCell>
                            <TransactionReasonCell reason={transaction.reason} />
                          </TableCell>
                          <TableCell className="text-center">
                            <TooltipProvider delayDuration={0}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => handleOpenDetails(transaction)}
                                  >
                                    <Eye className="h-3 w-3 mr-1" />
                                    Számlák
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Tranzakció és számla részletei</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                  <TablePlaceholderRows currentCount={paginatedTransactions.length} pageSize={pageSize} columns={8} />
                </TableBody>
              </table>
            </div>

            {/* Bottom Pagination */}
            <UnifiedPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalCount}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
              className="mt-3"
            />
          </CardContent>
        </Card>
      </main>

      {/* Details Dialog */}
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
