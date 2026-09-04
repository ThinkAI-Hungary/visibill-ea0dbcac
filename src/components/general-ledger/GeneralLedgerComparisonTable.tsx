import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn, fixCharacterEncoding } from '@/lib/utils';
import { Loader2, TrendingUp, TrendingDown, Search, Download, BookOpen } from 'lucide-react';
import { useExchangeRates } from '@/hooks/useExchangeRates';
import { Skeleton } from '@/components/ui/skeleton';
import { CustomTooltip } from '@/components/ui/custom-tooltip';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UnifiedPagination } from '@/components/ui/unified-pagination';
import { exportToFile } from '@/lib/exportUtils';
import { toast } from '@/hooks/use-toast';
import { fetchAllGlBalances, GlDateBasis, GlPostingStatus } from '@/lib/glData';

interface GeneralLedgerComparisonTableProps {
  presetId?: string;
  companyId?: string;
  dateFrom?: string;
  dateTo?: string;
  dateBasis?: GlDateBasis;
  postingStatus?: GlPostingStatus;
}

export function GeneralLedgerComparisonTable({
  presetId,
  companyId,
  dateFrom,
  dateTo,
  dateBasis = 'kibocsatas',
  postingStatus = 'all',
}: GeneralLedgerComparisonTableProps) {
  const { data: exchangeRates } = useExchangeRates();
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'changed' | 'increased' | 'decreased'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Compute previous year dates
  const prevDateFrom = useMemo(() => {
    if (!dateFrom) return '';
    const parts = dateFrom.split('-');
    if (parts.length < 1) return '';
    const prevYear = parseInt(parts[0], 10) - 1;
    return `${prevYear}-${parts[1] || '01'}-${parts[2] || '01'}`;
  }, [dateFrom]);

  const prevDateTo = useMemo(() => {
    if (!dateTo) return '';
    const parts = dateTo.split('-');
    if (parts.length < 1) return '';
    const prevYear = parseInt(parts[0], 10) - 1;
    return `${prevYear}-${parts[1] || '12'}-${parts[2] || '31'}`;
  }, [dateTo]);

  // Current year balances
  const { data: currData = [], isLoading: currLoading } = useQuery({
    queryKey: ['glBalancesCurr', presetId, companyId, dateFrom, dateTo, dateBasis, postingStatus],
    queryFn: async () => {
      if (!presetId || !companyId) return [];
      return await fetchAllGlBalances({
        companyId,
        presetId,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        dateBasis,
        postingStatus,
        exchangeRates: exchangeRates || {},
      });
    },
    enabled: !!presetId && !!companyId && !!exchangeRates,
  });

  // Previous year balances
  const { data: prevData = [], isLoading: prevLoading } = useQuery({
    queryKey: ['glBalancesPrev', presetId, companyId, prevDateFrom, prevDateTo, dateBasis, postingStatus],
    queryFn: async () => {
      if (!presetId || !companyId || !prevDateFrom || !prevDateTo) return [];
      return await fetchAllGlBalances({
        companyId,
        presetId,
        dateFrom: prevDateFrom,
        dateTo: prevDateTo,
        dateBasis,
        postingStatus,
        exchangeRates: exchangeRates || {},
      });
    },
    enabled: !!presetId && !!companyId && !!prevDateFrom && !!prevDateTo && !!exchangeRates,
  });

  const isLoading = currLoading || prevLoading;

  const comparisonData = useMemo(() => {
    if (isLoading) return [];

    const currMap = new Map<string, { short_name: string; total_balance: number }>();
    currData.forEach(d => {
      currMap.set(d.gl_number, {
        short_name: fixCharacterEncoding(d.short_name),
        total_balance: Number(d.total_balance) || 0,
      });
    });

    const prevMap = new Map<string, { short_name: string; total_balance: number }>();
    prevData.forEach(d => {
      prevMap.set(d.gl_number, {
        short_name: fixCharacterEncoding(d.short_name),
        total_balance: Number(d.total_balance) || 0,
      });
    });

    const allKeys = Array.from(new Set([...currMap.keys(), ...prevMap.keys()]));

    return allKeys.map(key => {
      const c = currMap.get(key);
      const p = prevMap.get(key);
      const displayGlNumber = key === 'UNCLASSIFIED' ? 'Besorolatlan' : key;
      const name = c?.short_name || p?.short_name || 'Besorolatlan';
      const valCurr = c?.total_balance ?? 0;
      const valPrev = p?.total_balance ?? 0;
      const diff = valCurr - valPrev;

      let pct = 0;
      if (valPrev !== 0) {
        pct = (diff / Math.abs(valPrev)) * 100;
      } else if (diff !== 0) {
        pct = 100;
      }

      return {
        glNumber: displayGlNumber,
        originalKey: key,
        name,
        valCurr,
        valPrev,
        diff,
        pct,
      };
    }).sort((a, b) => {
      if (a.glNumber === 'Besorolatlan') return 1;
      if (b.glNumber === 'Besorolatlan') return -1;
      return a.glNumber.localeCompare(b.glNumber);
    });
  }, [currData, prevData, isLoading]);

  const filteredData = useMemo(() => {
    let result = comparisonData;
    if (filterMode === 'changed') {
      result = result.filter(d => d.diff !== 0);
    } else if (filterMode === 'increased') {
      result = result.filter(d => d.diff > 0);
    } else if (filterMode === 'decreased') {
      result = result.filter(d => d.diff < 0);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(d =>
        d.glNumber.toLowerCase().includes(q) ||
        d.name.toLowerCase().includes(q) ||
        (d.originalKey === 'UNCLASSIFIED' && 'besorolatlan'.includes(q))
      );
    }
    return result;
  }, [comparisonData, filterMode, search]);

  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const totals = useMemo(() => {
    let prev = 0, curr = 0;
    filteredData.forEach(d => {
      prev += d.valPrev;
      curr += d.valCurr;
    });
    return { prev, curr, diff: curr - prev };
  }, [filteredData]);

  const formatHuf = (v: number) => {
    return new Intl.NumberFormat('hu-HU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.round(v));
  };

  const currYearLabel = dateFrom ? dateFrom.substring(0, 4) : 'Tárgyév';
  const prevYearLabel = prevDateFrom ? prevDateFrom.substring(0, 4) : 'Előző év';

  const handleExport = async () => {
    const basisLabel = dateBasis === 'teljesites' ? 'Teljesítés' : 'Kibocsátás';
    const headers = [
      'Főkönyvi szám',
      'Megnevezés',
      `${prevYearLabel} Egyenleg (Ft)`,
      `${currYearLabel} Egyenleg (Ft)`,
      'Eltérés (Ft)',
      'Változás %',
    ];
    const rows = filteredData.map(row => [
      row.glNumber,
      row.name,
      row.valPrev.toString(),
      row.valCurr.toString(),
      row.diff.toString(),
      `${Math.round(row.pct)}%`,
    ]);
    const fileSuffix = `fokonyv_osszehasonlitas_${prevYearLabel}_vs_${currYearLabel}_${basisLabel.toLowerCase()}_alapjan`;
    await exportToFile(headers, rows, 'xlsx', fileSuffix);
    toast({ title: 'Összehasonlítás exportálva' });
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Keresés (főkönyvi szám, megnevezés...)"
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
            className="pl-9 h-9"
          />
        </div>
        <Select value={filterMode} onValueChange={(v: any) => { setFilterMode(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-44 h-9 text-sm">
            <SelectValue placeholder="Szűrés" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Összes számla</SelectItem>
            <SelectItem value="changed">Csak eltérések</SelectItem>
            <SelectItem value="increased">Csak növekedés</SelectItem>
            <SelectItem value="decreased">Csak csökkenés</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5"
          onClick={handleExport}
          disabled={isLoading || filteredData.length === 0}
        >
          <Download className="w-4 h-4" /> Export
        </Button>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground bg-muted/40 px-4 py-2 rounded-lg">
        {isLoading ? (
          <Skeleton className="h-4 w-64 bg-muted/50 rounded" />
        ) : (
          <>
            <span>{filteredData.length} számla</span>
            <span>|</span>
            <span>{prevYearLabel}: <strong className="text-foreground">{formatHuf(totals.prev)} Ft</strong></span>
            <span>{currYearLabel}: <strong className="text-foreground">{formatHuf(totals.curr)} Ft</strong></span>
            <span>
              Nettó eltérés:{' '}
              <strong className={totals.diff > 0 ? 'text-emerald-600 dark:text-emerald-400' : totals.diff < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'}>
                {totals.diff > 0 ? '+' : ''}{formatHuf(totals.diff)} Ft
              </strong>
            </span>
          </>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border/50 overflow-hidden bg-card">
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur border-b text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">
              <tr>
                <th className="p-3 text-center w-[12%]">Fők. szám</th>
                <th className="p-3 w-[36%]">Megnevezés</th>
                <th className="p-3 text-right w-[15%]">{prevYearLabel} Egyenleg</th>
                <th className="p-3 text-right w-[15%]">{currYearLabel} Egyenleg</th>
                <th className="p-3 text-right w-[12%]">Eltérés (Ft)</th>
                <th className="p-3 text-center w-[10%]">Változás %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="hover:bg-muted/30 animate-pulse">
                    <td className="p-3 text-center"><Skeleton className="h-4 w-12 mx-auto bg-muted/50 rounded" /></td>
                    <td className="p-3"><Skeleton className="h-4 w-40 bg-muted/50 rounded" /></td>
                    <td className="p-3 text-right"><Skeleton className="h-4 w-24 ml-auto bg-muted/50 rounded" /></td>
                    <td className="p-3 text-right"><Skeleton className="h-4 w-24 ml-auto bg-muted/50 rounded" /></td>
                    <td className="p-3 text-right"><Skeleton className="h-4 w-24 ml-auto bg-muted/50 rounded" /></td>
                    <td className="p-3 text-center"><Skeleton className="h-5 w-10 mx-auto bg-muted/50 rounded" /></td>
                  </tr>
                ))
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <BookOpen className="w-8 h-8 text-muted-foreground/40" />
                      <p className="text-sm">Nincsenek összehasonlító adatok a kiválasztott feltételekkel.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedData.map((row) => {
                  const classChar = row.glNumber ? row.glNumber[0] : '';
                  const classBorderColor = 
                    ['1', '2', '3'].includes(classChar) ? 'border-l-4 border-l-blue-500/70'
                    : classChar === '4' ? 'border-l-4 border-l-purple-500/70'
                    : ['5', '8'].includes(classChar) ? 'border-l-4 border-l-red-500/70'
                    : classChar === '9' ? 'border-l-4 border-l-emerald-500/70'
                    : '';

                  const isHeading = row.glNumber.length <= 2 && row.glNumber !== 'Besorolatlan';

                  return (
                    <tr
                      key={row.glNumber}
                      className={cn(
                        "hover:bg-muted/30 transition-colors",
                        isHeading ? "font-semibold bg-muted/10" : ""
                      )}
                    >
                      <td className={cn("p-2.5 text-center", classBorderColor)}>
                        <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded cursor-help">
                          {row.glNumber}
                        </span>
                      </td>
                      <td className="p-2.5 text-xs font-medium text-foreground truncate max-w-[300px]">
                        <CustomTooltip content={row.name} side="top">
                          <span className="truncate block">{row.name}</span>
                        </CustomTooltip>
                      </td>
                      <td className="p-2.5 font-mono text-xs text-right tabular-nums">
                        {formatHuf(row.valPrev)} Ft
                      </td>
                      <td className="p-2.5 font-mono text-xs text-right tabular-nums">
                        {formatHuf(row.valCurr)} Ft
                      </td>
                      <td className={cn(
                        "p-2.5 font-mono text-xs text-right tabular-nums font-semibold",
                        row.diff > 0 ? "text-emerald-600 dark:text-emerald-400" : row.diff < 0 ? "text-rose-600 dark:text-rose-400" : ""
                      )}>
                        {row.diff > 0 ? '+' : ''}{formatHuf(row.diff)} Ft
                      </td>
                      <td className="p-2.5 text-center shrink-0">
                        {row.diff === 0 ? (
                          <span className="text-[10px] bg-slate-100 dark:bg-secondary text-slate-600 px-1.5 py-0.5 rounded font-mono font-bold">
                            0%
                          </span>
                        ) : row.diff > 0 ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded font-mono font-bold">
                            <TrendingUp className="w-2.5 h-2.5 shrink-0" />
                            {Math.round(row.pct)}%
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-[10px] bg-rose-500/10 text-rose-700 dark:text-rose-400 px-1.5 py-0.5 rounded font-mono font-bold">
                            <TrendingDown className="w-2.5 h-2.5 shrink-0" />
                            {Math.round(Math.abs(row.pct))}%
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <UnifiedPagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredData.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          pageSizeOptions={[25, 50, 100]}
          disableScrollToTop={true}
        />
      )}
    </div>
  );
}
