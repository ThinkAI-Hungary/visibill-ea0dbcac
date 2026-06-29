import React, { useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  TrendingUp, ArrowLeft, ChevronRight, Info,
  ArrowUpRight, ArrowDownRight, Calendar, Download, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccountyClient } from '@/hooks/accounty';
import { formatHuf, formatPercent, DEFAULT_2026_PARAMS } from '@/lib/evCalculations';
import { useCashbookEntries, type PenztarkonyvTetel } from '@/hooks/useEvData';

// ─── Constants ──────────────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Már', 'Ápr', 'Máj', 'Jún', 'Júl', 'Aug', 'Szep', 'Okt', 'Nov', 'Dec'];

interface MonthlyData {
  month: string;
  revenue: number;
  costs: number;
  income: number;
  szja: number;
  tb: number;
  totalTax: number;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function EvIncomeReportPage() {
  const { id } = useParams<{ id: string }>();
  const { data: client } = useAccountyClient(id);
  const [year, setYear] = useState(2026);

  // ─── Real data from Supabase ───────────────────────────────────────────────
  const { data: rawEntries, isLoading } = useCashbookEntries(id, year);

  // Compute monthly breakdown from cashbook entries
  const monthlyData = useMemo((): MonthlyData[] => {
    const entries = rawEntries || [];
    const params = DEFAULT_2026_PARAMS;
    const monthMap = new Map<number, { revenue: number; costs: number }>();

    entries.forEach((e: PenztarkonyvTetel) => {
      const monthIdx = new Date(e.entry_date).getMonth(); // 0-based
      const current = monthMap.get(monthIdx) || { revenue: 0, costs: 0 };
      const amount = e.is_storno ? -e.amount : e.amount;

      if (e.entry_direction === 'bevetel') {
        current.revenue += amount;
      } else {
        current.costs += amount;
      }
      monthMap.set(monthIdx, current);
    });

    const result: MonthlyData[] = [];
    monthMap.forEach((val, monthIdx) => {
      const income = val.revenue - val.costs;
      const szja = Math.max(0, Math.round(income * (params.szjaKulcs || 0.15)));
      const tb = Math.max(0, Math.round(income * (params.tbJarulekKulcs + params.szochoKulcs)));
      result.push({
        month: MONTHS[monthIdx],
        revenue: val.revenue,
        costs: val.costs,
        income,
        szja,
        tb,
        totalTax: szja + tb,
      });
    });

    // Sort by month order
    result.sort((a, b) => MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month));
    return result;
  }, [rawEntries]);

  const totals = useMemo(() => ({
    revenue: monthlyData.reduce((s, d) => s + d.revenue, 0),
    costs: monthlyData.reduce((s, d) => s + d.costs, 0),
    income: monthlyData.reduce((s, d) => s + d.income, 0),
    szja: monthlyData.reduce((s, d) => s + d.szja, 0),
    tb: monthlyData.reduce((s, d) => s + d.tb, 0),
    totalTax: monthlyData.reduce((s, d) => s + d.totalTax, 0),
  }), [monthlyData]);

  const maxRevenue = monthlyData.length > 0 ? Math.max(...monthlyData.map(d => d.revenue)) : 0;
  const profitMargin = totals.revenue > 0 ? totals.income / totals.revenue : 0;

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/accounty/ev" className="hover:text-indigo-600 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> EV Portfólió
        </Link>
        <ChevronRight className="w-3 h-3" />
        <Link to={`/accounty/client/${id}/ev`} className="hover:text-indigo-600 transition-colors">
          {client?.name || 'Ügyfél'}
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-900 dark:text-slate-100 font-medium">Jövedelem riport</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl shadow-lg shadow-emerald-500/25">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Jövedelem riport</h1>
            <p className="text-sm text-slate-500">Havi bevétel, költség, jövedelem és adóteher áttekintés</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={e => setYear(+e.target.value)}
            className="px-3 py-1.5 text-sm border border-border rounded-lg bg-card text-slate-900 dark:text-slate-100"
          >
            <option value={2026}>2026</option>
            <option value={2025}>2025</option>
            <option value={2024}>2024</option>
          </select>
          <button className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
            <Download className="w-3.5 h-3.5" /> Exportálás
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">YTD Bevétel</p>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums">{formatHuf(totals.revenue)}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">YTD Költség</p>
              <p className="text-lg font-bold text-red-500 tabular-nums">{formatHuf(totals.costs)}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">YTD Jövedelem</p>
              <p className="text-lg font-bold text-emerald-600 tabular-nums">{formatHuf(totals.income)}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">YTD SZJA</p>
              <p className="text-lg font-bold text-indigo-600 tabular-nums">{formatHuf(totals.szja)}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">YTD TB/Szocho</p>
              <p className="text-lg font-bold text-violet-600 tabular-nums">{formatHuf(totals.tb)}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Profit margó</p>
              <p className="text-lg font-bold text-emerald-600">{formatPercent(profitMargin)}</p>
            </div>
          </div>

          {/* Simple bar chart */}
          <div className="bg-card rounded-xl border border-border shadow-soft p-5">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4">Havi bevétel alakulás</h2>
            <div className="flex gap-2 h-48">
              {MONTHS.map((monthLabel, idx) => {
                const d = monthlyData.find(m => m.month === monthLabel);
                const revenue = d?.revenue || 0;
                const costs = d?.costs || 0;
                const heightPct = maxRevenue > 0 ? (revenue / maxRevenue) * 100 : 0;
                const costPct = revenue > 0 ? (costs / revenue) * 100 : 0;

                return (
                  <div key={monthLabel} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                    <span className="text-[10px] font-mono text-slate-500 tabular-nums truncate w-full text-center">
                      {revenue > 0 ? formatHuf(revenue).replace(/\s*Ft$/, '') : '–'}
                    </span>
                    <div className="flex-1 w-full flex items-end">
                      {revenue > 0 ? (
                        <div
                          className="w-full bg-emerald-500/20 border border-emerald-500/30 rounded-t-md relative overflow-hidden transition-all duration-500"
                          style={{ height: `${heightPct}%` }}
                        >
                          <div
                            className="absolute bottom-0 left-0 right-0 bg-red-400/40"
                            style={{ height: `${costPct}%` }}
                          />
                        </div>
                      ) : (
                        <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-md" />
                      )}
                    </div>
                    <span className={cn(
                      'text-[10px] font-bold',
                      revenue > 0 ? 'text-slate-600 dark:text-slate-400' : 'text-slate-300'
                    )}>{monthLabel}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-3 text-[10px] text-slate-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-500/20 border border-emerald-500/30 rounded" /> Bevétel</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-400/40 rounded" /> Költség</span>
            </div>
          </div>

          {/* Monthly table */}
          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <div className="px-5 py-3 border-b border-border/50">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Havi részletezés</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-slate-50/50 dark:bg-slate-800/30">
                    <th className="text-left py-3 px-4 font-medium text-slate-500 text-xs uppercase tracking-wider">Hónap</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-500 text-xs uppercase tracking-wider">Bevétel</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-500 text-xs uppercase tracking-wider">Költség</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-500 text-xs uppercase tracking-wider">Jövedelem</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-500 text-xs uppercase tracking-wider">SZJA</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-500 text-xs uppercase tracking-wider">TB/Szocho</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-500 text-xs uppercase tracking-wider">Össz. adó</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {monthlyData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-sm text-slate-400">
                        <TrendingUp className="w-8 h-8 mx-auto mb-3 text-slate-300" />
                        Nincs adat a kiválasztott évre
                      </td>
                    </tr>
                  ) : (
                    monthlyData.map(d => (
                      <tr key={d.month} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">{d.month}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">{formatHuf(d.revenue)}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-red-500">{formatHuf(d.costs)}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-600 font-medium">{formatHuf(d.income)}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">{formatHuf(d.szja)}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">{formatHuf(d.tb)}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-indigo-600 font-medium">{formatHuf(d.totalTax)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                {monthlyData.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-border bg-slate-50/30 dark:bg-slate-800/20 font-bold">
                      <td className="py-3 px-4 text-slate-900 dark:text-slate-100">Összesen</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">{formatHuf(totals.revenue)}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-red-500">{formatHuf(totals.costs)}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-600">{formatHuf(totals.income)}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">{formatHuf(totals.szja)}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">{formatHuf(totals.tb)}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-indigo-600">{formatHuf(totals.totalTax)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
