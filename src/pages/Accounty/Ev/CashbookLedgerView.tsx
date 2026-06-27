import React, { useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, ChevronRight, BookOpen, BarChart3, TrendingUp,
  TrendingDown, PieChart, Layers, Calendar, Filter, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccountyClient } from '@/hooks/accounty';
import { formatHuf } from '@/lib/evCalculations';
import { useCashbookEntries, type PenztarkonyvTetel } from '@/hooks/useEvData';

// ─── Types ──────────────────────────────────────────────────────────────────

interface LedgerEntry {
  id: string;
  entryDate: string;
  documentNumber: string;
  description: string;
  direction: 'bevetel' | 'kiadas';
  category: string;
  amount: number;
  vatAmount: number;
  runningBalance: number;
}

interface MonthlyAggregate {
  month: string;
  label: string;
  revenue: number;
  expense: number;
  balance: number;
  entryCount: number;
  categories: Record<string, number>;
}

// ─── Category map ────────────────────────────────────────────────────────────

const COLUMN_LABELS: Record<string, { label: string; shortLabel: string; color: string }> = {
  bevetel_adokoteles: { label: 'I. Adóköteles bevétel', shortLabel: 'Adóköt.bev.', color: 'bg-green-500' },
  bevetel_fizetendo_afa: { label: 'II. Fizetendő ÁFA', shortLabel: 'Fiz.ÁFA', color: 'bg-teal-500' },
  bevetel_be_nem_szamito: { label: 'III. Be nem számító', shortLabel: 'Nem szám.', color: 'bg-slate-400' },
  kiadas_anyag_arubeszerzes: { label: 'IV. Anyag/áru', shortLabel: 'Anyag', color: 'bg-red-500' },
  kiadas_kozvetitett_szolgaltatas: { label: 'V. Közvetített', shortLabel: 'Közvetít.', color: 'bg-orange-500' },
  kiadas_alkalmazott_ber_kozteher: { label: 'VI. Bér/közteher', shortLabel: 'Bér', color: 'bg-violet-500' },
  kiadas_vallalkozoi_kivet: { label: 'VII. Kivét', shortLabel: 'Kivét', color: 'bg-purple-500' },
  kiadas_egyeb_koltseg: { label: 'VIII. Egyéb költség', shortLabel: 'Egyéb', color: 'bg-amber-500' },
  kiadas_beruhazasi_koltseg: { label: 'IX. Beruházás', shortLabel: 'Beruh.', color: 'bg-rose-500' },
  kiadas_levonhato_afa: { label: 'X. Levonható ÁFA', shortLabel: 'Lev.ÁFA', color: 'bg-cyan-500' },
  kiadas_egyeb_nem_koltseg: { label: 'XI. Egyéb nem költség', shortLabel: 'Nem költ.', color: 'bg-slate-300' },
};

type ViewMode = 'monthly' | 'columns' | 'chart';

// ─── Component ──────────────────────────────────────────────────────────────

export default function CashbookLedgerView() {
  const { id } = useParams<{ id: string }>();
  const { data: client } = useAccountyClient(id);
  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [selectedYear] = useState(2026);

  // ─── Real data from Supabase ───────────────────────────────────────────────
  const { data: rawEntries, isLoading } = useCashbookEntries(id, selectedYear);

  const entries = useMemo<LedgerEntry[]>(() => {
    let balance = 0;
    return (rawEntries || []).map((e: PenztarkonyvTetel) => {
      const multiplier = e.is_storno ? -1 : 1;
      const amount = e.amount * multiplier;
      balance += e.entry_direction === 'bevetel' ? amount : -amount;
      return {
        id: e.id,
        entryDate: e.entry_date,
        documentNumber: e.document_number || '',
        description: e.description,
        direction: e.entry_direction,
        category: e.main_category,
        amount: Math.abs(amount),
        vatAmount: e.vat_amount * multiplier,
        runningBalance: balance,
      };
    });
  }, [rawEntries]);

  // Monthly aggregation
  const monthlyData = useMemo<MonthlyAggregate[]>(() => {
    const months: Record<string, MonthlyAggregate> = {};
    const monthNames = ['Január', 'Február', 'Március', 'Április', 'Május', 'Június',
      'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December'];

    for (let m = 1; m <= 12; m++) {
      const key = String(m).padStart(2, '0');
      months[key] = {
        month: key,
        label: monthNames[m - 1],
        revenue: 0,
        expense: 0,
        balance: 0,
        entryCount: 0,
        categories: {},
      };
    }

    for (const e of entries) {
      const m = e.entryDate.slice(5, 7);
      if (!months[m]) continue;
      months[m].entryCount++;
      if (e.direction === 'bevetel') {
        months[m].revenue += e.amount;
      } else {
        months[m].expense += e.amount;
      }
      months[m].categories[e.category] = (months[m].categories[e.category] || 0) + e.amount;
    }

    Object.values(months).forEach(m => { m.balance = m.revenue - m.expense; });
    return Object.values(months);
  }, [entries]);

  // Column aggregation
  const columnTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const e of entries) {
      totals[e.category] = (totals[e.category] || 0) + e.amount;
    }
    return totals;
  }, [entries]);

  const totalRevenue = entries.filter(e => e.direction === 'bevetel').reduce((s, e) => s + e.amount, 0);
  const totalExpense = entries.filter(e => e.direction === 'kiadas').reduce((s, e) => s + e.amount, 0);
  const totalBalance = totalRevenue - totalExpense;

  // Max for chart scaling
  const maxMonthly = Math.max(...monthlyData.map(m => Math.max(m.revenue, m.expense)), 1);

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to={`/accounty/client/${id}/ev/cashbook`} className="hover:text-indigo-600 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Pénztárkönyv
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-900 dark:text-slate-100 font-medium">Főkönyvi áttekintés</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg shadow-emerald-500/25">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Főkönyvi áttekintés</h1>
            <p className="text-sm text-slate-500">{client?.name || 'Ügyfél'} · {selectedYear}. adóév</p>
          </div>
        </div>

        {/* View mode toggle */}
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/50 rounded-lg p-0.5">
          {([
            ['monthly', 'Havi', Calendar],
            ['columns', 'Oszlopok', Layers],
            ['chart', 'Grafikon', PieChart],
          ] as [ViewMode, string, typeof Calendar][]).map(([v, l, Icon]) => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                viewMode === v
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              <Icon className="w-3 h-3" /> {l}
            </button>
          ))}
        </div>
      </div>

      {/* Year totals */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-green-500" />
            <p className="text-xs text-slate-500">Éves bevétel</p>
          </div>
          <p className="text-xl font-bold text-green-600 font-mono tabular-nums">{formatHuf(totalRevenue)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-3.5 h-3.5 text-red-500" />
            <p className="text-xs text-slate-500">Éves kiadás</p>
          </div>
          <p className="text-xl font-bold text-red-500 font-mono tabular-nums">{formatHuf(totalExpense)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Egyenleg</p>
          <p className={cn('text-xl font-bold font-mono tabular-nums',
            totalBalance >= 0 ? 'text-slate-900 dark:text-slate-100' : 'text-red-600'
          )}>
            {formatHuf(totalBalance)}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-card rounded-xl border border-border shadow-soft p-16 text-center">
          <Loader2 className="w-8 h-8 mx-auto mb-3 text-indigo-400 animate-spin" />
          <p className="text-sm text-slate-400">Betöltés...</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-card rounded-xl border-2 border-dashed border-border p-16 text-center">
          <BookOpen className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Nincs pénztárkönyv tétel</p>
          <p className="text-xs text-slate-500 mt-1">A főkönyvi áttekintés automatikusan frissül a pénztárkönyv tételek rögzítése után.</p>
        </div>
      ) : (
        <>
          {/* Monthly view */}
          {viewMode === 'monthly' && (
            <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-slate-50 dark:bg-slate-900/30">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Hónap</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tételek</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-green-600 uppercase tracking-wider">Bevétel</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-red-500 uppercase tracking-wider">Kiadás</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Egyenleg</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-48">Arány</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {monthlyData.map(m => {
                      const total = m.revenue + m.expense;
                      const revPct = total > 0 ? (m.revenue / total) * 100 : 50;
                      return (
                        <tr key={m.month} className={cn(
                          'hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors',
                          m.entryCount === 0 && 'opacity-40'
                        )}>
                          <td className="px-4 py-3">
                            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{m.label}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-sm text-slate-500 tabular-nums">{m.entryCount}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-sm font-semibold text-green-600 font-mono tabular-nums">
                              {m.revenue > 0 ? formatHuf(m.revenue) : '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-sm font-semibold text-red-500 font-mono tabular-nums">
                              {m.expense > 0 ? formatHuf(m.expense) : '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={cn(
                              'text-sm font-bold font-mono tabular-nums',
                              m.balance > 0 ? 'text-slate-900 dark:text-slate-100' : m.balance < 0 ? 'text-red-600' : 'text-slate-400'
                            )}>
                              {m.entryCount > 0 ? formatHuf(m.balance) : '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {m.entryCount > 0 && (
                              <div className="flex items-center gap-1.5">
                                <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                                  <div className="h-full bg-green-500 rounded-l-full transition-all" style={{ width: `${revPct}%` }} />
                                  <div className="h-full bg-red-400 rounded-r-full transition-all" style={{ width: `${100 - revPct}%` }} />
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-slate-50 dark:bg-slate-900/30 font-bold">
                      <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">Összesen</td>
                      <td className="px-4 py-3 text-right text-sm text-slate-500 tabular-nums">{entries.length}</td>
                      <td className="px-4 py-3 text-right text-sm text-green-600 font-mono tabular-nums">{formatHuf(totalRevenue)}</td>
                      <td className="px-4 py-3 text-right text-sm text-red-500 font-mono tabular-nums">{formatHuf(totalExpense)}</td>
                      <td className="px-4 py-3 text-right text-sm font-mono tabular-nums">{formatHuf(totalBalance)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Column aggregation view */}
          {viewMode === 'columns' && (
            <div className="bg-card rounded-xl border border-border shadow-soft p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-500" />
                Pénztárkönyv oszlopok szerinti bontás (I–XI.)
              </h3>

              {/* Revenue columns */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-green-600 uppercase tracking-wider">Bevételi oszlopok</p>
                {Object.entries(COLUMN_LABELS)
                  .filter(([k]) => k.startsWith('bevetel'))
                  .map(([key, col]) => {
                    const val = columnTotals[key] || 0;
                    const pct = totalRevenue > 0 ? (val / totalRevenue) * 100 : 0;
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <div className={cn('w-2 h-2 rounded-full shrink-0', col.color)} />
                        <span className="text-xs text-slate-600 dark:text-slate-400 w-40 shrink-0">{col.label}</span>
                        <div className="flex-1 h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all', col.color)}
                            style={{ width: `${Math.max(pct, 0.5)}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums w-28 text-right">
                          {formatHuf(val)}
                        </span>
                        <span className="text-[10px] text-slate-400 w-10 text-right">{pct.toFixed(0)}%</span>
                      </div>
                    );
                  })}
              </div>

              {/* Expense columns */}
              <div className="space-y-2 pt-3 border-t border-border">
                <p className="text-xs font-semibold text-red-500 uppercase tracking-wider">Kiadási oszlopok</p>
                {Object.entries(COLUMN_LABELS)
                  .filter(([k]) => k.startsWith('kiadas'))
                  .map(([key, col]) => {
                    const val = columnTotals[key] || 0;
                    const pct = totalExpense > 0 ? (val / totalExpense) * 100 : 0;
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <div className={cn('w-2 h-2 rounded-full shrink-0', col.color)} />
                        <span className="text-xs text-slate-600 dark:text-slate-400 w-40 shrink-0">{col.label}</span>
                        <div className="flex-1 h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all', col.color)}
                            style={{ width: `${Math.max(pct, 0.5)}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums w-28 text-right">
                          {formatHuf(val)}
                        </span>
                        <span className="text-[10px] text-slate-400 w-10 text-right">{pct.toFixed(0)}%</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Chart view */}
          {viewMode === 'chart' && (
            <div className="bg-card rounded-xl border border-border shadow-soft p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <PieChart className="w-4 h-4 text-indigo-500" />
                Havi bevétel vs. kiadás
              </h3>

              <div className="space-y-3">
                {monthlyData.map(m => {
                  const revBarW = maxMonthly > 0 ? (m.revenue / maxMonthly) * 100 : 0;
                  const expBarW = maxMonthly > 0 ? (m.expense / maxMonthly) * 100 : 0;
                  return (
                    <div key={m.month} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 w-24">{m.label}</span>
                        <div className="flex items-center gap-4 text-[10px] text-slate-400">
                          <span className="text-green-600 font-mono">{m.revenue > 0 ? formatHuf(m.revenue) : '—'}</span>
                          <span className="text-red-500 font-mono">{m.expense > 0 ? formatHuf(m.expense) : '—'}</span>
                        </div>
                      </div>
                      <div className="space-y-0.5">
                        <div className="h-3 bg-slate-50 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all duration-500"
                            style={{ width: `${revBarW}%` }}
                          />
                        </div>
                        <div className="h-3 bg-slate-50 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-red-400 to-red-500 rounded-full transition-all duration-500"
                            style={{ width: `${expBarW}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-6 pt-2 border-t border-border">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-gradient-to-r from-green-400 to-green-500" />
                  <span className="text-xs text-slate-500">Bevétel</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-gradient-to-r from-red-400 to-red-500" />
                  <span className="text-xs text-slate-500">Kiadás</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Info footer */}
      <div className="text-center py-4">
        <p className="text-[10px] text-slate-400">
          Pénztárkönyv főkönyvi áttekintés · Szja tv. 5. sz. melléklet · {selectedYear}. adóév
        </p>
      </div>
    </div>
  );
}
