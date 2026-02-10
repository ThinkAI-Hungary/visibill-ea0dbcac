import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
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
  return !!(transaction.confidence_score && transaction.confidence_score >= 0.97 && transaction.matched_invoice_id);
};

const getMatchStatus = (transaction: Transaction): MatchStatus => {
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
  if (transaction.is_verified && transaction.matched_invoice_id) {
    return 'bg-success/10 hover:bg-success/15';
  }
  if (transaction.matched_invoice_id && !transaction.is_verified) {
    return 'bg-warning/10 hover:bg-warning/15';
  }
  return 'bg-destructive/10 hover:bg-destructive/15';
};

const TransactionsPage = () => {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [sortField, setSortField] = useState<string>('transaction_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Pagination state
  const [pageSize, setPageSize] = useState(20);
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

  useEffect(() => {
    fetchTransactions();
  }, [user, selectedCompany]);

  const fetchTransactions = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      let query = supabase
        .from('transactions')
        .select('*')
        .order('transaction_date', { ascending: false });

      if (selectedCompany) {
        query = query.eq('company_id', selectedCompany.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      const fetchedTransactions = data || [];
      
      // Auto-approve transactions with confidence_score >= 0.97
      const toAutoApprove = fetchedTransactions.filter(
        t => t.matched_invoice_id && !t.is_verified && t.confidence_score && t.confidence_score >= 0.97
      );
      
      if (toAutoApprove.length > 0) {
        const ids = toAutoApprove.map(t => t.id);
        await supabase
          .from('transactions')
          .update({ is_verified: true, match_type: 'auto' })
          .in('id', ids);
        
        // Update local state to reflect auto-approval
        fetchedTransactions.forEach(t => {
          if (ids.includes(t.id)) {
            t.is_verified = true;
            t.match_type = 'auto';
          }
        });
      }
      
      setTransactions(fetchedTransactions);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  // Open details dialog
  const handleOpenDetails = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setDetailsDialogOpen(true);
  };

  // Filtered and sorted transactions
  const filteredTransactions = useMemo(() => {
    let result = [...transactions];

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(t =>
        t.description?.toLowerCase().includes(searchLower) ||
        t.type?.toLowerCase().includes(searchLower)
      );
    }

    // Date filters
    if (filters.dateFrom) {
      const fromDate = format(filters.dateFrom, 'yyyy-MM-dd');
      result = result.filter(t => t.transaction_date >= fromDate);
    }
    if (filters.dateTo) {
      const toDate = format(filters.dateTo, 'yyyy-MM-dd');
      result = result.filter(t => t.transaction_date <= toDate);
    }

    // Amount filters
    if (filters.amountMin) {
      const min = parseFloat(filters.amountMin);
      if (!isNaN(min)) result = result.filter(t => Math.abs(t.amount) >= min);
    }
    if (filters.amountMax) {
      const max = parseFloat(filters.amountMax);
      if (!isNaN(max)) result = result.filter(t => Math.abs(t.amount) <= max);
    }

    // Currency filter
    if (filters.currency !== 'all') {
      result = result.filter(t => t.currency === filters.currency);
    }

    // Type filter
    if (filters.type !== 'all') {
      result = result.filter(t => t.type === filters.type);
    }

    // Match status filter
    if (filters.matchStatus !== 'all') {
      result = result.filter(t => getMatchStatus(t) === filters.matchStatus);
    }

    // Sorting
    result.sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (sortField) {
        case 'transaction_date':
          aVal = a.transaction_date || '';
          bVal = b.transaction_date || '';
          break;
        case 'amount':
          aVal = Math.abs(a.amount);
          bVal = Math.abs(b.amount);
          break;
        case 'description':
          aVal = a.description?.toLowerCase() || '';
          bVal = b.description?.toLowerCase() || '';
          break;
        default:
          aVal = a[sortField as keyof Transaction] || '';
          bVal = b[sortField as keyof Transaction] || '';
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [transactions, filters, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredTransactions.length / pageSize);
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, currentPage, pageSize]);

  // Get unique values for filters
  const uniqueCurrencies = useMemo(() => 
    [...new Set(transactions.map(t => t.currency).filter(Boolean))] as string[],
  [transactions]);
  
  const uniqueTypes = useMemo(() => 
    [...new Set(transactions.map(t => t.type).filter(Boolean))] as string[],
  [transactions]);

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

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  // Sync function - refreshes the transactions table
  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetchTransactions();
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

  if (loading) {
    return <LoadingSpinner />;
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
                  Banki tranzakciók és számla párosítások - {filteredTransactions.length} találat
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

              {/* Date From */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className={cn(
                      "h-9 justify-start text-left font-normal bg-secondary/50 border border-white/10",
                      !filters.dateFrom && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.dateFrom ? format(filters.dateFrom, 'MM.dd.', { locale: hu }) : 'Kezdő'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.dateFrom}
                    onSelect={(date) => setFilters(prev => ({ ...prev, dateFrom: date }))}
                    locale={hu}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>

              {/* Date To */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className={cn(
                      "h-9 justify-start text-left font-normal bg-secondary/50 border border-white/10",
                      !filters.dateTo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.dateTo ? format(filters.dateTo, 'MM.dd.', { locale: hu }) : 'Befejező'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.dateTo}
                    onSelect={(date) => setFilters(prev => ({ ...prev, dateTo: date }))}
                    locale={hu}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>

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
              totalItems={filteredTransactions.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
              className="mb-3"
            />

            {/* Transactions Table */}
            <div className="rounded-lg border border-border/50 overflow-x-auto">
              <Table className="table-fixed compact-table">
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
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
                    <TableHead className="font-semibold w-[10%]">Típus</TableHead>
                    <TableHead className="font-semibold w-[8%] text-center">Státusz</TableHead>
                    <TableHead className="font-semibold w-[13%]">Indoklás</TableHead>
                    <TableHead className="font-semibold w-[10%] text-center">Művelet</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-32 text-center">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <HelpCircle className="h-8 w-8" />
                          <p>Nincs tranzakció</p>
                          <p className="text-xs">Tölts fel bankkivonatot a Feltöltés oldalon</p>
                        </div>
                      </TableCell>
                    </TableRow>
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
                          <TableCell className="max-w-[200px] truncate text-xs">
                            {transaction.description || '-'}
                          </TableCell>
                          <TableCell className={cn(
                            "text-right font-mono text-xs",
                            transaction.amount >= 0 ? "text-success" : "text-destructive"
                          )}>
                            {formatCurrency(transaction.amount, transaction.currency || 'HUF')}
                          </TableCell>
                          <TableCell className="text-xs">{transaction.currency || 'HUF'}</TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">
                              {transaction.type || '-'}
                            </span>
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
                  {/* Empty placeholder rows for stable height */}
                  {paginatedTransactions.length > 0 && paginatedTransactions.length < pageSize && (
                    Array.from({ length: Math.min(5, pageSize - paginatedTransactions.length) }).map((_, i) => (
                      <TableRow key={`empty-${i}`} className="h-10 pointer-events-none">
                        <TableCell colSpan={8}>&nbsp;</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Bottom Pagination */}
            <UnifiedPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredTransactions.length}
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
          fetchTransactions();
        }}
      />
    </div>
  );
};

export default TransactionsPage;
