import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { UnifiedPagination } from '@/components/ui/unified-pagination';
import {
  CreditCard,
  Download,
  ChevronDown,
  FileText,
  Hotel,
  UtensilsCrossed,
  Palmtree,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Landmark,
  Search,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSzepCardData } from '@/hooks/useSzepCardData';

const fmtHuf = (val: number) => new Intl.NumberFormat('hu-HU').format(Math.round(val));

const SUB_ACCOUNT_CONFIG: Record<string, { label: string; icon: typeof Hotel; color: string; bgClass: string }> = {
  'Szálláshely': {
    label: 'Szálláshely',
    icon: Hotel,
    color: 'bg-blue-500',
    bgClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
  },
  'Vendéglátás': {
    label: 'Vendéglátás',
    icon: UtensilsCrossed,
    color: 'bg-orange-500',
    bgClass: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20',
  },
  'Szabadidő': {
    label: 'Szabadidő',
    icon: Palmtree,
    color: 'bg-green-500',
    bgClass: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
  },
};

export default function SzepCardTab() {
  const {
    allTransactions,
    isLoading,
    kpis,
    handleExport,
  } = useSzepCardData();

  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState('');
  const [subAccountFilter, setSubAccountFilter] = useState('all');
  const [bankFilter, setBankFilter] = useState('all');
  
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const runExport = async (format: 'csv' | 'xlsx') => {
    setExporting(true);
    try {
      await handleExport(format);
    } finally {
      setExporting(false);
    }
  };

  // Extract unique issuer banks
  const uniqueBanks = useMemo(() => {
    const set = new Set<string>();
    for (const tx of allTransactions) {
      if (tx.issuer_bank) set.add(tx.issuer_bank);
    }
    return Array.from(set).sort();
  }, [allTransactions]);

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return allTransactions.filter(tx => {
      // Sub-account filter
      if (subAccountFilter !== 'all' && tx.sub_account !== subAccountFilter) {
        return false;
      }
      // Bank filter
      if (bankFilter !== 'all' && tx.issuer_bank !== bankFilter) {
        return false;
      }
      // Search filter
      if (search.trim()) {
        const query = search.toLowerCase();
        const cardHolder = (tx.card_holder || '').toLowerCase();
        const ref = (tx.transfer_reference || '').toLowerCase();
        const cardMasked = (tx.card_number_masked || '').toLowerCase();
        const amountStr = tx.gross_amount.toString();
        const approval = (tx.approval_code || '').toLowerCase();
        
        return (
          cardHolder.includes(query) ||
          ref.includes(query) ||
          cardMasked.includes(query) ||
          amountStr.includes(query) ||
          approval.includes(query)
        );
      }
      return true;
    });
  }, [allTransactions, subAccountFilter, bankFilter, search]);

  const totalCount = filteredTransactions.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, subAccountFilter, bankFilter]);

  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, currentPage, pageSize]);

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const hasActiveFilters = search || subAccountFilter !== 'all' || bankFilter !== 'all';

  return (
    <div className="space-y-4">
      {/* ── KPI Summary Bar ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4 print:hidden">
        <div className="bg-card border border-border/60 rounded-xl p-3.5 flex items-center gap-3">
          <div className="bg-teal-500/10 text-teal-600 p-2 rounded-lg">
            <CreditCard className="w-4 h-4" />
          </div>
          <div>
            <div className="text-lg font-bold tabular-nums">
              {kpis.totalCount.toLocaleString('hu-HU')}
            </div>
            <div className="text-[11px] text-muted-foreground">Összes tranzakció</div>
          </div>
        </div>

        <div className="bg-card border border-border/60 rounded-xl p-3.5 flex items-center gap-3">
          <div className="bg-emerald-500/10 text-emerald-600 p-2 rounded-lg">
            <ArrowUpRight className="w-4 h-4" />
          </div>
          <div>
            <div className="text-lg font-bold tabular-nums text-emerald-600">
              {fmtHuf(kpis.totalGross)} Ft
            </div>
            <div className="text-[11px] text-muted-foreground">Bruttó bevétel</div>
          </div>
        </div>

        <div className="bg-card border border-border/60 rounded-xl p-3.5 flex items-center gap-3">
          <div className="bg-red-500/10 text-red-500 p-2 rounded-lg">
            <ArrowDownRight className="w-4 h-4" />
          </div>
          <div>
            <div className="text-lg font-bold tabular-nums text-red-500">
              -{fmtHuf(kpis.totalCommission)} Ft
            </div>
            <div className="text-[11px] text-muted-foreground">Jutalék</div>
          </div>
        </div>

        <div className="bg-card border border-border/60 rounded-xl p-3.5 flex items-center gap-3">
          <div className="bg-blue-500/10 text-blue-600 p-2 rounded-lg">
            <Landmark className="w-4 h-4" />
          </div>
          <div>
            <div className="text-lg font-bold tabular-nums text-blue-600">
              {fmtHuf(kpis.totalNet)} Ft
            </div>
            <div className="text-[11px] text-muted-foreground">Nettó (utalandó)</div>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-bold">SZÉP Kártya tranzakciók</CardTitle>
              <CardDescription>
                {isLoading ? 'Betöltés...' : `SZÉP Kártya tranzakciók és elszámolások - ${totalCount} találat`}
              </CardDescription>
            </div>
            <div className="flex gap-2">
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
                    <FileText className="h-4 w-4 mr-2" /> Export CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => runExport('xlsx')}>
                    <FileText className="h-4 w-4 mr-2" /> Export XLSX
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Keresés (kártyatulajdonos, bizonylatszám, összeg...)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Sub-account filter */}
            <Select
              value={subAccountFilter}
              onValueChange={setSubAccountFilter}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Alszámla" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Minden alszámla</SelectItem>
                <SelectItem value="Szálláshely">Szálláshely</SelectItem>
                <SelectItem value="Vendéglátás">Vendéglátás</SelectItem>
                <SelectItem value="Szabadidő">Szabadidő</SelectItem>
              </SelectContent>
            </Select>

            {/* Bank filter */}
            <Select
              value={bankFilter}
              onValueChange={setBankFilter}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Kibocsátó bank" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Minden bank</SelectItem>
                {uniqueBanks.map(bank => (
                  <SelectItem key={bank} value={bank}>{bank}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Clear filters button */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setSubAccountFilter('all');
                  setBankFilter('all');
                }}
              >
                <X className="h-4 w-4 mr-1" /> Szűrők törlése
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
            onPageSizeChange={handlePageSizeChange}
            className="mb-3"
          />



          {/* Table */}
          <div className="rounded-xl border border-border/50 overflow-x-auto">
            <table className="w-full caption-bottom text-sm compact-table min-w-[1000px]" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '10%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '16%' }} />
              </colgroup>
              <TableHeader>
                <TableRow className="bg-muted hover:bg-muted">
                  <TableHead className="font-semibold">Dátum</TableHead>
                  <TableHead className="font-semibold">Kártyatulajdonos</TableHead>
                  <TableHead className="font-semibold">Alszámla</TableHead>
                  <TableHead className="text-right font-semibold">Bruttó</TableHead>
                  <TableHead className="text-right font-semibold">Jutalék</TableHead>
                  <TableHead className="text-right font-semibold">Nettó</TableHead>
                  <TableHead className="font-semibold text-center">Bank</TableHead>
                  <TableHead className="font-semibold">Utalás</TableHead>
                  <TableHead className="font-semibold">Bizonylatszám</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 9 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : paginatedTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                      <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p className="font-medium">Nincs SZÉP kártya tranzakció</p>
                      <p className="text-sm mt-1">A megadott feltételekkel nem találhatók tranzakciók.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedTransactions.map((tx) => {
                    const saCfg = SUB_ACCOUNT_CONFIG[tx.sub_account];
                    return (
                      <TableRow
                        key={tx.id}
                        className={cn(
                          "hover:bg-muted/30 transition-colors h-10",
                          tx.is_reversal && "opacity-50 line-through"
                        )}
                      >
                        <TableCell className="font-mono text-xs tabular-nums">
                          {tx.transaction_date}
                        </TableCell>
                        <TableCell className="overflow-hidden">
                          <div className="font-medium text-xs truncate">
                            {tx.card_holder || '—'}
                          </div>
                          {tx.card_number_masked && (
                            <div className="text-[10px] text-muted-foreground font-mono leading-none mt-0.5">
                              {tx.card_number_masked}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn("text-[10px] font-medium px-1.5 py-0.5", saCfg?.bgClass || 'bg-muted')}
                          >
                            {saCfg?.label || tx.sub_account}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums font-semibold">
                          {fmtHuf(tx.gross_amount)} Ft
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums text-red-500">
                          -{fmtHuf(tx.commission_amount)} Ft
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums text-emerald-600 font-semibold">
                          {fmtHuf(tx.net_amount)} Ft
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                            {tx.issuer_bank || '?'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                          {tx.transfer_date || '—'}
                        </TableCell>
                        <TableCell className="font-mono text-[10px] text-muted-foreground truncate overflow-hidden">
                          {tx.transfer_reference || '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
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
            onPageSizeChange={handlePageSizeChange}
            className="mt-3"
          />
        </CardContent>
      </Card>
    </div>
  );
}
