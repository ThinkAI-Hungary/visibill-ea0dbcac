import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useExchangeRates } from '@/hooks/useExchangeRates';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, fixCharacterEncoding } from '@/lib/utils';
import { Search, Download, Loader2, BookOpen, ArrowUpDown } from 'lucide-react';
import { UnifiedPagination } from '@/components/ui/unified-pagination';
import { exportToFile } from '@/lib/exportUtils';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchAllGlBalances, fetchAllGlCategorizedItems, GlDateBasis } from '@/lib/glData';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  F7: JOURNAL VIEW (Naplófőkönyv)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface JournalViewProps {
  presetId?: string;
  dateFrom?: string;
  dateTo?: string;
  dateBasis?: GlDateBasis;
}

interface JournalEntry {
  item_id: string;
  item_date: string | null;
  partner: string | null;
  description: string | null;
  gl_number: string | null;
  gl_name: string | null;
  item_type: string | null;
  amount: number;
  source_table: string | null;
  original_amount?: number;
  original_currency?: string;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('hu-HU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

const TYPE_LABELS: Record<string, string> = {
  invoice: 'Számla',
  transaction: 'Tranzakció',
  nav_invoice: 'NAV Számla',
  journal_entry: 'Naplótétel',
};

export default function JournalView({ presetId, dateFrom, dateTo, dateBasis = 'kibocsatas' }: JournalViewProps) {
  const { selectedCompany } = useCompany();
  const { data: exchangeRates } = useExchangeRates();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const pageSize = 50;

  const { data: rawItems = [], isLoading } = useQuery({
    queryKey: ['glJournalItems', selectedCompany?.id, presetId, dateFrom, dateTo, dateBasis],
    queryFn: async () => {
      if (!selectedCompany?.id || !presetId) return [];
      try {
        const data = await fetchAllGlCategorizedItems({
          companyId: selectedCompany.id,
          presetId,
          dateFrom,
          dateTo,
          dateBasis,
          exchangeRates: exchangeRates || {},
        });
        return (data || []) as unknown as JournalEntry[];
      } catch (error) {
        return [];
      }
    },
    enabled: !!selectedCompany?.id && !!presetId && !!exchangeRates,
    staleTime: 30_000,
  });

  // Also fetch GL account mapping for display
  const { data: glAccounts = [] } = useQuery({
    queryKey: ['glBalances', presetId, selectedCompany?.id, dateFrom, dateTo, dateBasis],
    queryFn: async () => {
      if (!selectedCompany?.id || !presetId) return [];
      try {
        const data = await fetchAllGlBalances({
          companyId: selectedCompany.id,
          presetId,
          dateFrom,
          dateTo,
          dateBasis,
          exchangeRates: exchangeRates || {},
        });
        return data || [];
      } catch (error) {
        return [];
      }
    },
    enabled: !!selectedCompany?.id && !!presetId && !!exchangeRates,
    staleTime: 30_000,
  });

  const glMap = useMemo(() => {
    const m: Record<string, { gl_number: string; short_name: string }> = {};
    glAccounts.forEach((a: any) => { m[a.gl_account_id] = { gl_number: a.gl_number, short_name: fixCharacterEncoding(a.short_name) }; });
    return m;
  }, [glAccounts]);

  // All items with GL info enriched, excluding excluded
  const enrichedItems = useMemo(() => {
    return rawItems
      .filter((i: any) => !i.is_excluded)
      .map((item: any) => {
        const gl = glMap[item.gl_account_id];
        return {
          ...item,
          gl_number: gl?.gl_number || '—',
          gl_name: gl?.short_name || 'Besorolatlan',
        };
      });
  }, [rawItems, glMap]);

  // Filter + search
  const filtered = useMemo(() => {
    let result = enrichedItems;
    if (typeFilter !== 'all') result = result.filter((i: any) => i.source_table === typeFilter || i.item_type === typeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((i: any) =>
        (i.partner && i.partner.toLowerCase().includes(q)) ||
        (i.description && i.description.toLowerCase().includes(q)) ||
        (i.gl_number && i.gl_number.includes(q)) ||
        (i.gl_name && i.gl_name.toLowerCase().includes(q))
      );
    }
    // Sort by date
    result = [...result].sort((a: any, b: any) => {
      const da = a.item_date || '';
      const db = b.item_date || '';
      return sortDir === 'asc' ? da.localeCompare(db) : db.localeCompare(da);
    });
    return result;
  }, [enrichedItems, typeFilter, search, sortDir]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage]);

  // Unique types for filter
  const uniqueTypes = useMemo(() => {
    const s = new Set<string>();
    enrichedItems.forEach((i: any) => s.add(i.source_table || i.item_type || 'unknown'));
    return Array.from(s).sort();
  }, [enrichedItems]);

  // Totals
  const totals = useMemo(() => {
    let debit = 0, credit = 0;
    filtered.forEach((i: any) => {
      if (i.amount > 0) debit += i.amount;
      else credit += Math.abs(i.amount);
    });
    return { debit, credit, net: debit - credit };
  }, [filtered]);

  const handleExport = async () => {
    const basisLabel = dateBasis === 'teljesites' ? 'Teljesítés' : 'Kibocsátás';
    const headers = [`Dátum (${basisLabel})`, 'Partner', 'Leírás', 'Főkönyvi szám', 'Főkönyvi megnevezés', 'Típus', 'Tartozik', 'Követel'];
    const rows = filtered.map((item: any) => [
      item.item_date ? item.item_date.substring(0, 10) : '',
      item.partner || '',
      item.description || '',
      item.gl_number || '',
      item.gl_name || '',
      TYPE_LABELS[item.source_table] || item.source_table || '',
      item.amount > 0 ? item.amount.toString() : '',
      item.amount < 0 ? Math.abs(item.amount).toString() : '',
    ]);
    const rangePart = (dateFrom && dateTo) ? `_${dateFrom}_${dateTo}` : '';
    const fileSuffix = dateBasis === 'teljesites' ? `naplofokonyv${rangePart}_teljesites_alapjan` : `naplofokonyv${rangePart}_kibocsatas_alapjan`;
    await exportToFile(headers, rows, 'xlsx', fileSuffix);
    toast({ title: 'Naplófőkönyv exportálva' });
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Keresés (partner, leírás, főkönyvi szám...)"
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
            className="pl-9 h-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-44 h-9 text-sm"><SelectValue placeholder="Típus" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Összes típus</SelectItem>
            {uniqueTypes.map(t => <SelectItem key={t} value={t}>{TYPE_LABELS[t] || t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={handleExport} disabled={isLoading || filtered.length === 0}>
          <Download className="w-4 h-4" /> Export
        </Button>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground bg-muted/40 px-4 py-2 rounded-lg">
        {isLoading ? (
          <Skeleton className="h-4 w-64 bg-muted/50 rounded" />
        ) : (
          <>
            <span>{filtered.length} tétel</span>
            <span>|</span>
            <span className="text-emerald-600 font-medium">Tartozik: {formatCurrency(totals.debit)}</span>
            <span className="text-destructive font-medium">Követel: {formatCurrency(totals.credit)}</span>
            <span className={cn('font-bold', totals.net >= 0 ? 'text-foreground' : 'text-destructive')}>
              Nettó: {formatCurrency(totals.net)}
            </span>
          </>
        )}
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden bg-card">
        {/* Header */}
        <div className="grid grid-cols-12 bg-muted/80 border-b text-xs font-semibold uppercase tracking-wider text-muted-foreground select-none">
          <button
            className="col-span-1 p-3 text-center flex items-center justify-center gap-1 hover:text-foreground transition-colors"
            onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
          >
            Dátum <ArrowUpDown className="w-3 h-3" />
          </button>
          <div className="col-span-2 p-3">Partner</div>
          <div className="col-span-3 p-3">Leírás</div>
          <div className="col-span-2 p-3 text-center">Fők. szám</div>
          <div className="col-span-1 p-3 text-center">Típus</div>
          <div className="col-span-1 p-3 text-right">Tartozik</div>
          <div className="col-span-1 p-3 text-right">Követel</div>
          <div className="col-span-1 p-3 text-right">Egyenleg</div>
        </div>

        {/* Body */}
        <div className="divide-y divide-border/30 max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="grid grid-cols-12 text-sm p-3 items-center animate-pulse">
                <div className="col-span-1 text-center">
                  <Skeleton className="h-4 w-16 mx-auto bg-muted/50 rounded" />
                </div>
                <div className="col-span-2">
                  <Skeleton className="h-4 w-28 bg-muted/50 rounded" />
                </div>
                <div className="col-span-3">
                  <Skeleton className="h-4 w-36 bg-muted/50 rounded" />
                </div>
                <div className="col-span-2 text-center">
                  <Skeleton className="h-5 w-16 mx-auto bg-muted/50 rounded" />
                </div>
                <div className="col-span-1 text-center">
                  <Skeleton className="h-5 w-12 mx-auto bg-muted/50 rounded" />
                </div>
                <div className="col-span-1 text-right">
                  <Skeleton className="h-4 w-20 ml-auto bg-muted/50 rounded" />
                </div>
                <div className="col-span-1 text-right">
                  <Skeleton className="h-4 w-20 ml-auto bg-muted/50 rounded" />
                </div>
                <div className="col-span-1 text-right">
                  <Skeleton className="h-4 w-20 ml-auto bg-muted/50 rounded" />
                </div>
              </div>
            ))
          ) : paginated.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
              <BookOpen className="w-8 h-8 text-muted-foreground/40" />
              <p className="text-sm">Nincs naplófőkönyvi tétel a kiválasztott időszakban</p>
            </div>
          ) : (
            paginated.map((item: any) => {
              const debit = item.amount > 0 ? item.amount : 0;
              const credit = item.amount < 0 ? Math.abs(item.amount) : 0;
              return (
                <div key={item.item_id} className="grid grid-cols-12 text-sm hover:bg-muted/30 transition-colors">
                  <div className="col-span-1 p-2.5 text-center font-mono text-xs tabular-nums text-muted-foreground">
                    {item.item_date ? item.item_date.substring(0, 10).replace(/-/g, '.') : '—'}
                  </div>
                  <div className="col-span-2 p-2.5 truncate text-sm font-medium" title={item.partner || ''}>
                    {item.partner || '—'}
                  </div>
                  <div className="col-span-3 p-2.5 truncate text-sm text-muted-foreground" title={item.description || ''}>
                    {item.description || '—'}
                  </div>
                  <div className="col-span-2 p-2.5 text-center">
                    <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded" title={item.gl_name}>
                      {item.gl_number}
                    </span>
                  </div>
                  <div className="col-span-1 p-2.5 text-center">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/5 text-primary/70 font-medium">
                      {TYPE_LABELS[item.source_table] || item.source_table || '?'}
                    </span>
                  </div>
                  <div className={cn('col-span-1 p-2.5 text-right tabular-nums', debit > 0 && 'text-emerald-600 font-medium')}>
                    {debit > 0 ? formatCurrency(debit) : ''}
                  </div>
                  <div className={cn('col-span-1 p-2.5 text-right tabular-nums', credit > 0 && 'text-destructive font-medium')}>
                    {credit > 0 ? formatCurrency(credit) : ''}
                  </div>
                  <div className={cn('col-span-1 p-2.5 text-right tabular-nums font-medium', item.amount < 0 ? 'text-destructive' : '')}>
                    {formatCurrency(item.amount)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {totalPages > 1 && (
        <UnifiedPagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filtered.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={() => {}}
        />
      )}
    </div>
  );
}
