import { useDateRange } from '@/contexts/DateRangeContext';
import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Landmark, Search, ChevronRight, CheckCircle, AlertTriangle, Clock,
  FileText, TrendingUp, Building2, Globe, Calendar, BarChart2, Users
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAccountyClients, type AccountyClient } from '@/hooks/accounty';
import { UnifiedPagination } from '@/components/ui/unified-pagination';

// TAO filing statuses
type TaoFilingStatus = 'not_started' | 'data_entry' | 'deductions' | 'credits' | 'review' | 'signed' | 'submitted' | 'accepted';

interface EnrichedTaoClient extends AccountyClient {
  taxpayerType: string;
  taxRegime: string;
  businessYear: string;
  aee: number;
  taxBase: number;
  payableTax: number;
  filingStatus: TaoFilingStatus;
  tpStatus: string;
  pillarTwo: boolean;
  kivaAlany: boolean;
}

const FILING_STATUS: Record<TaoFilingStatus, { label: string; color: string; bg: string }> = {
  not_started:  { label: 'Nincs elindítva', color: 'text-muted-foreground',  bg: 'bg-muted/10' },
  data_entry:   { label: 'Adatrögzítés',   color: 'text-amber-600',  bg: 'bg-amber-50 dark:bg-amber-900/30' },
  deductions:   { label: 'Korrekciók',      color: 'text-primary',   bg: 'bg-primary/10' },
  credits:      { label: 'Kedvezmények',    color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/30' },
  review:       { label: 'Felülvizsgálat',  color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/30' },
  signed:       { label: 'Aláírva',         color: 'text-teal-600',   bg: 'bg-teal-50 dark:bg-teal-900/30' },
  submitted:    { label: 'Beküldve',        color: 'text-cyan-600',   bg: 'bg-cyan-50 dark:bg-cyan-900/30' },
  accepted:     { label: 'Elfogadva',       color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-900/30' },
};

const TP_STATUS: Record<string, { label: string; color: string }> = {
  exempt:     { label: 'Mentes',          color: 'text-muted-foreground' },
  local_done: { label: 'Local File kész', color: 'text-green-600' },
  master_done:{ label: 'Master File kész',color: 'text-primary' },
  missing:    { label: 'Hiányzó',         color: 'text-red-600' },
};

// Mock enrichment — TAO-specific data per client
function enrichWithTaoData(client: AccountyClient, idx: number): EnrichedTaoClient {
  const statuses: TaoFilingStatus[] = ['not_started', 'data_entry', 'deductions', 'credits', 'review', 'signed', 'submitted', 'accepted'];
  const tpStatuses = ['exempt', 'local_done', 'master_done', 'missing'];
  const taxpayerTypes = ['Kft.', 'Bt.', 'Zrt.', 'Alapítvány', 'Egyesület', 'Szövetkezet'];
  const regimes = ['Általános 6.§', 'Nonprofit (A)', 'Nonprofit (B)', 'Általános 6.§'];
  const aeeValues = [12_500_000, -3_200_000, 48_900_000, 0, 7_800_000, 125_000_000, 2_300_000, 890_000];

  return {
    ...client,
    taxpayerType: taxpayerTypes[idx % taxpayerTypes.length],
    taxRegime: regimes[idx % regimes.length],
    businessYear: 'Naptári',
    aee: aeeValues[idx % aeeValues.length],
    taxBase: Math.max(0, aeeValues[idx % aeeValues.length] * 0.85),
    payableTax: Math.max(0, Math.round(aeeValues[idx % aeeValues.length] * 0.85 * 0.09)),
    filingStatus: statuses[idx % statuses.length],
    tpStatus: tpStatuses[idx % tpStatuses.length],
    pillarTwo: idx % 7 === 0,
    kivaAlany: idx % 9 === 0,
  };
}

type FilterMode = 'all' | 'not_started' | 'pillar2' | 'kiva';

export default function TaoPortfolioPage() {
  const { data: clients = [] } = useAccountyClients();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const { dateFrom, setDateFrom, setDateTo } = useDateRange();
  const taxYear = dateFrom.getFullYear();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterMode, taxYear]);

  const enriched = useMemo(
    () => clients.map((c: AccountyClient, i: number) => enrichWithTaoData(c, i)),
    [clients]
  );

  const filtered = useMemo(() => {
    let list = enriched;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((c: EnrichedTaoClient) =>
        c.name.toLowerCase().includes(q) || c.taxNumber?.toLowerCase().includes(q)
      );
    }
    if (filterMode === 'not_started') list = list.filter((c: EnrichedTaoClient) => c.filingStatus === 'not_started');
    if (filterMode === 'pillar2') list = list.filter((c: EnrichedTaoClient) => c.pillarTwo);
    if (filterMode === 'kiva') list = list.filter((c: EnrichedTaoClient) => c.kivaAlany);
    return list;
  }, [enriched, searchQuery, filterMode]);

  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const totalClients = enriched.length;
  const kivaCount = enriched.filter((c: EnrichedTaoClient) => c.kivaAlany).length;
  const submittedCount = enriched.filter((c: EnrichedTaoClient) => ['submitted', 'accepted'].includes(c.filingStatus)).length;
  const pillar2Count = enriched.filter((c: EnrichedTaoClient) => c.pillarTwo).length;

  // Filing deadline
  const deadlineStr = taxYear === 2025 ? '2026. június 1.' : `${taxYear + 1}. május 31.`;

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg shadow-emerald-500/25">
            <Landmark className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">TAO Portfólió</h1>
            <p className="text-sm text-muted-foreground">
              {taxYear}. adóév — összes ügyfél társasági adó státusza
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Link to="/eaisybooks/tao/calendar">
            <Button variant="outline" size="sm" className="gap-2 h-9 text-xs border-border font-semibold bg-card hover:bg-muted/30">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              TAO Naptár
            </Button>
          </Link>
          <Link to="/eaisybooks/tao/taxpayer-types">
            <Button variant="outline" size="sm" className="gap-2 h-9 text-xs border-border font-semibold bg-card hover:bg-muted/30">
              <Users className="w-3.5 h-3.5 text-primary" />
              TAO Adózói Körök
            </Button>
          </Link>

          <select
            value={taxYear}
            onChange={(e) => ((y) => { setDateFrom(new Date(y, 0, 1)); setDateTo(new Date(y, 11, 31)); })(Number(e.target.value))}
            className="text-sm border border-border rounded-lg px-3 py-1.5 bg-card text-foreground h-9"
          >
            <option value={2025}>2025. adóév</option>
            <option value={2024}>2024. adóév</option>
            <option value={2023}>2023. adóév</option>
          </select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-muted-foreground mb-1">Aktív TAO-alany</p>
          <p className="text-2xl font-bold text-emerald-600">{totalClients - kivaCount}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">KIVA: {kivaCount}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-muted-foreground mb-1">2529 beadva</p>
          <div className="flex items-end gap-2">
            <p className="text-2xl font-bold text-green-600">{submittedCount}</p>
            <p className="text-xs text-muted-foreground pb-1">/ {totalClients}</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-muted-foreground mb-1">Pillar Two érintett</p>
          <p className={cn('text-2xl font-bold', pillar2Count > 0 ? 'text-amber-600' : 'text-muted-foreground')}>{pillar2Count}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-muted-foreground mb-1">Bevallási határidő</p>
          <p className="text-base font-bold text-foreground">{deadlineStr}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-muted-foreground mb-1">Adókulcs</p>
          <p className="text-2xl font-bold text-emerald-600">9%</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">KIVA: {kivaCount}</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Keresés ügyfél neve, adószám..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>
        <div className="flex gap-1 bg-muted/10 rounded-lg p-0.5">
          {([
            ['all', 'Mind'],
            ['not_started', 'Nem indított'],
            ['pillar2', 'Pillar Two'],
            ['kiva', 'KIVA'],
          ] as [FilterMode, string][]).map(([v, l]) => (
            <button
              key={v}
              onClick={() => setFilterMode(v)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                filterMode === v
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border dark:bg-muted/5">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ügyfél</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Típus</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Üzleti év</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">AEE</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fizetendő adó</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">2529 státusz</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">TP</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">P2</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-sm text-muted-foreground">
                    <Landmark className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                    Nincs találat
                  </td>
                </tr>
              ) : (
                paginated.map((client: EnrichedTaoClient) => {
                  const fs = FILING_STATUS[client.filingStatus as TaoFilingStatus] || FILING_STATUS.not_started;
                  const tp = TP_STATUS[client.tpStatus] || TP_STATUS.exempt;
                  return (
                    <tr key={client.id} className="hover:bg-accent/50 transition-colors group">
                      <td className="px-4 py-3">
                        <Link
                          to={`/eaisybooks/client/${client.companyId}/tao`}
                          className="text-sm font-bold text-foreground hover:text-primary transition-colors"
                        >
                          {client.name}
                        </Link>
                        {client.taxNumber && (
                          <p className="text-[10px] text-muted-foreground font-mono">{client.taxNumber}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium text-foreground">{client.taxpayerType}</span>
                        {client.kivaAlany && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-orange-100 text-orange-600 dark:bg-orange-900/30">KIVA</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{client.businessYear}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={cn(
                          'text-sm font-semibold tabular-nums',
                          client.aee < 0 ? 'text-red-600' : client.aee === 0 ? 'text-muted-foreground' : 'text-foreground'
                        )}>
                          {client.aee === 0 ? '—' : `${(client.aee / 1_000_000).toFixed(1)} M`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-semibold tabular-nums text-foreground">
                          {client.payableTax === 0 ? '—' : `${(client.payableTax / 1_000_000).toFixed(2)} M`}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('px-2 py-1 rounded-full text-xs font-semibold', fs.bg, fs.color)}>
                          {fs.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs font-semibold', tp.color)}>{tp.label}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {client.pillarTwo ? (
                          <Globe className="w-4 h-4 text-amber-500 mx-auto" />
                        ) : (
                          <span className="text-muted-foreground/30">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/eaisybooks/client/${client.companyId}/tao`}
                          className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80"
                        >
                          Megnyit <ChevronRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="border-t border-border px-4 py-3 bg-card">
            <UnifiedPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[25, 50, 100]}
            />
          </div>
        )}
      </div>
    </div>
  );
}
