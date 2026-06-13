import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Landmark, Search, ChevronRight, CheckCircle, AlertTriangle, Clock,
  FileText, TrendingUp, Building2, Globe, Calendar, BarChart2
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAccountyClients } from '@/hooks/useAccountyData';

// TAO filing statuses
type TaoFilingStatus = 'not_started' | 'data_entry' | 'deductions' | 'credits' | 'review' | 'signed' | 'submitted' | 'accepted';

const FILING_STATUS: Record<TaoFilingStatus, { label: string; color: string; bg: string }> = {
  not_started:  { label: 'Nincs elindítva', color: 'text-slate-500',  bg: 'bg-slate-100 dark:bg-slate-800' },
  data_entry:   { label: 'Adatrögzítés',   color: 'text-amber-600',  bg: 'bg-amber-50 dark:bg-amber-900/30' },
  deductions:   { label: 'Korrekciók',      color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-900/30' },
  credits:      { label: 'Kedvezmények',    color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/30' },
  review:       { label: 'Felülvizsgálat',  color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/30' },
  signed:       { label: 'Aláírva',         color: 'text-teal-600',   bg: 'bg-teal-50 dark:bg-teal-900/30' },
  submitted:    { label: 'Beküldve',        color: 'text-cyan-600',   bg: 'bg-cyan-50 dark:bg-cyan-900/30' },
  accepted:     { label: 'Elfogadva',       color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-900/30' },
};

const TP_STATUS: Record<string, { label: string; color: string }> = {
  exempt:     { label: 'Mentes',          color: 'text-slate-400' },
  local_done: { label: 'Local File kész', color: 'text-green-600' },
  master_done:{ label: 'Master File kész',color: 'text-blue-600' },
  missing:    { label: 'Hiányzó',         color: 'text-red-600' },
};

// Mock enrichment — TAO-specific data per client
function enrichWithTaoData(client: any, idx: number) {
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
  const [taxYear, setTaxYear] = useState(2025);

  const enriched = useMemo(
    () => clients.map((c: any, i: number) => enrichWithTaoData(c, i)),
    [clients]
  );

  const filtered = useMemo(() => {
    let list = enriched;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((c: any) =>
        c.name.toLowerCase().includes(q) || c.taxNumber?.toLowerCase().includes(q)
      );
    }
    if (filterMode === 'not_started') list = list.filter((c: any) => c.filingStatus === 'not_started');
    if (filterMode === 'pillar2') list = list.filter((c: any) => c.pillarTwo);
    if (filterMode === 'kiva') list = list.filter((c: any) => c.kivaAlany);
    return list;
  }, [enriched, searchQuery, filterMode]);

  const totalClients = enriched.length;
  const kivaCount = enriched.filter((c: any) => c.kivaAlany).length;
  const submittedCount = enriched.filter((c: any) => ['submitted', 'accepted'].includes(c.filingStatus)).length;
  const pillar2Count = enriched.filter((c: any) => c.pillarTwo).length;

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
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">TAO Portfólió</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {taxYear}. adóév — összes ügyfél társasági adó státusza
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={taxYear}
            onChange={(e) => setTaxYear(Number(e.target.value))}
            className="text-sm border border-border rounded-lg px-3 py-1.5 bg-card text-foreground"
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
          <p className="text-xs text-slate-500 mb-1">Aktív TAO-alany</p>
          <p className="text-2xl font-bold text-emerald-600">{totalClients - kivaCount}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">KIVA: {kivaCount}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">2529 beadva</p>
          <div className="flex items-end gap-2">
            <p className="text-2xl font-bold text-green-600">{submittedCount}</p>
            <p className="text-xs text-slate-400 pb-1">/ {totalClients}</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Pillar Two érintett</p>
          <p className={cn('text-2xl font-bold', pillar2Count > 0 ? 'text-amber-600' : 'text-slate-400')}>{pillar2Count}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Bevallási határidő</p>
          <p className="text-base font-bold text-slate-900 dark:text-slate-100">{deadlineStr}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Adókulcs</p>
          <p className="text-2xl font-bold text-emerald-600">9%</p>
          <p className="text-[10px] text-slate-400 mt-0.5">KIVA: 10%</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Keresés ügyfél neve, adószám..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/50 rounded-lg p-0.5">
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
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                filterMode === v
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500'
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
              <tr className="border-b border-border dark:bg-slate-900/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ügyfél</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Típus</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Üzleti év</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">AEE</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fizetendő adó</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">2529 státusz</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">TP</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">P2</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-sm text-slate-400">
                    <Landmark className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                    Nincs találat
                  </td>
                </tr>
              ) : (
                filtered.map((client: any) => {
                  const fs = FILING_STATUS[client.filingStatus as TaoFilingStatus] || FILING_STATUS.not_started;
                  const tp = TP_STATUS[client.tpStatus] || TP_STATUS.exempt;
                  return (
                    <tr key={client.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                      <td className="px-4 py-3">
                        <Link
                          to={`/accounty/client/${client.companyId}/tao`}
                          className="text-sm font-bold text-slate-900 dark:text-slate-100 hover:text-primary transition-colors"
                        >
                          {client.name}
                        </Link>
                        {client.taxNumber && (
                          <p className="text-[10px] text-slate-400 font-mono">{client.taxNumber}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{client.taxpayerType}</span>
                        {client.kivaAlany && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-orange-100 text-orange-600 dark:bg-orange-900/30">KIVA</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{client.businessYear}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={cn(
                          'text-sm font-semibold tabular-nums',
                          client.aee < 0 ? 'text-red-600' : client.aee === 0 ? 'text-slate-400' : 'text-slate-700 dark:text-slate-300'
                        )}>
                          {client.aee === 0 ? '—' : `${(client.aee / 1_000_000).toFixed(1)} M`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-300">
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
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/accounty/client/${client.companyId}/tao`}
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
      </div>
    </div>
  );
}
