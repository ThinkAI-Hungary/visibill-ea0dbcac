import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn, formatCurrency } from '@/lib/utils';
import { CalendarIcon, Search, X, Eye, CheckCircle2, AlertCircle, HelpCircle, ArrowUpDown } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { UnifiedPagination } from '@/components/ui/unified-pagination';

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
  created_at: string | null;
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

const getMatchStatus = (transaction: Transaction): MatchStatus => {
  if (transaction.is_verified && transaction.matched_invoice_id) {
    return 'matched';
  }
  if (transaction.matched_invoice_id && !transaction.is_verified) {
    return 'suggested';
  }
  return 'unmatched';
};

const getMatchStatusBadge = (status: MatchStatus, confidenceScore?: number | null) => {
  switch (status) {
    case 'matched':
      return (
        <Badge variant="success" className="gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Párosított
        </Badge>
      );
    case 'suggested':
      return (
        <Badge variant="warning" className="gap-1">
          <AlertCircle className="h-3 w-3" />
          Javasolt {confidenceScore ? `(${Math.round(confidenceScore * 100)}%)` : ''}
        </Badge>
      );
    case 'unmatched':
      return (
        <Badge variant="destructive" className="gap-1">
          <HelpCircle className="h-3 w-3" />
          Párosítatlan
        </Badge>
      );
  }
};

const TransactionsPage = () => {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<string>('transaction_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Pagination state
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  
  
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

      const { data, error } = await query;

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
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

  if (!selectedCompany) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <p className="text-muted-foreground">Válassz egy céget a folytatáshoz</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Tranzakciók</h1>
        <p className="text-muted-foreground text-sm">
          Banki tranzakciók és számla párosítások
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Szűrők</CardTitle>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Szűrők törlése
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {/* Search */}
            <div className="relative col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Keresés leírásban..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="pl-9"
              />
            </div>

            {/* Date From */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn(
                  "justify-start text-left font-normal",
                  !filters.dateFrom && "text-muted-foreground"
                )}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dateFrom ? format(filters.dateFrom, 'yyyy.MM.dd') : 'Dátumtól'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.dateFrom}
                  onSelect={(date) => setFilters(prev => ({ ...prev, dateFrom: date }))}
                  locale={hu}
                />
              </PopoverContent>
            </Popover>

            {/* Date To */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn(
                  "justify-start text-left font-normal",
                  !filters.dateTo && "text-muted-foreground"
                )}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dateTo ? format(filters.dateTo, 'yyyy.MM.dd') : 'Dátumig'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.dateTo}
                  onSelect={(date) => setFilters(prev => ({ ...prev, dateTo: date }))}
                  locale={hu}
                />
              </PopoverContent>
            </Popover>

            {/* Currency */}
            <Select
              value={filters.currency}
              onValueChange={(value) => setFilters(prev => ({ ...prev, currency: value }))}
            >
              <SelectTrigger>
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
              <SelectTrigger>
                <SelectValue placeholder="Párosítási státusz" />
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
              <SelectTrigger>
                <SelectValue placeholder="Típus" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Minden típus</SelectItem>
                {uniqueTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Amount Min */}
            <Input
              type="number"
              placeholder="Összeg min."
              value={filters.amountMin}
              onChange={(e) => setFilters(prev => ({ ...prev, amountMin: e.target.value }))}
            />

            {/* Amount Max */}
            <Input
              type="number"
              placeholder="Összeg max."
              value={filters.amountMax}
              onChange={(e) => setFilters(prev => ({ ...prev, amountMax: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

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
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="compact-table">
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 w-[120px]"
                    onClick={() => handleSort('transaction_date')}
                  >
                    <div className="flex items-center gap-1">
                      Dátum
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                  <TableHead className="min-w-[250px]">Leírás</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 text-right w-[140px]"
                    onClick={() => handleSort('amount')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Összeg
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                  <TableHead className="w-[80px]">Pénznem</TableHead>
                  <TableHead className="w-[100px]">Típus</TableHead>
                  <TableHead className="w-[150px]">Státusz</TableHead>
                  <TableHead className="w-[80px] text-center">Művelet</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center">
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
                      <TableRow key={transaction.id} className="h-10">
                        <TableCell className="font-medium">
                          {transaction.transaction_date 
                            ? format(new Date(transaction.transaction_date), 'yyyy.MM.dd')
                            : '-'
                          }
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate">
                          {transaction.description || '-'}
                        </TableCell>
                        <TableCell className={cn(
                          "text-right font-mono",
                          transaction.amount >= 0 ? "text-success" : "text-destructive"
                        )}>
                          {formatCurrency(transaction.amount, transaction.currency || 'HUF')}
                        </TableCell>
                        <TableCell>{transaction.currency || 'HUF'}</TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {transaction.type || '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {getMatchStatusBadge(matchStatus, transaction.confidence_score)}
                        </TableCell>
                        <TableCell className="text-center">
                          {transaction.matched_invoice_id && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => {
                                    // TODO: Open invoice details dialog
                                    console.log('View invoice:', transaction.matched_invoice_id);
                                  }}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Számla megtekintése</TooltipContent>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
                {/* Empty placeholder rows for stable height */}
                {paginatedTransactions.length > 0 && paginatedTransactions.length < pageSize && (
                  Array.from({ length: Math.min(5, pageSize - paginatedTransactions.length) }).map((_, i) => (
                    <TableRow key={`empty-${i}`} className="h-10 pointer-events-none">
                      <TableCell colSpan={7}>&nbsp;</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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
    </div>
  );
};

export default TransactionsPage;
