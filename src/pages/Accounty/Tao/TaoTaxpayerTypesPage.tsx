import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Users, ChevronRight, Landmark, PieChart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccountyClients } from '@/hooks/useAccountyData';

// GFO-kód → adóalany típus mapping
const GFO_TYPES = [
  { gfo: '113', name: 'Korlátolt felelősségű társaság (Kft.)', regime: 'Általános 6.§', count: 0 },
  { gfo: '112', name: 'Betéti társaság (Bt.)', regime: 'Általános 6.§', count: 0 },
  { gfo: '114', name: 'Zártkörű részvénytársaság (Zrt.)', regime: 'Általános 6.§', count: 0 },
  { gfo: '115', name: 'Nyilvánosan működő Rt. (Nyrt.)', regime: 'Általános 6.§', count: 0 },
  { gfo: '111', name: 'Közkereseti társaság (Kkt.)', regime: 'Általános 6.§', count: 0 },
  { gfo: '116', name: 'Egyéni cég', regime: 'Általános 6.§', count: 0 },
  { gfo: '561', name: 'Alapítvány', regime: 'Nonprofit (A)', count: 0 },
  { gfo: '521', name: 'Egyesület', regime: 'Nonprofit (A)', count: 0 },
  { gfo: '124', name: 'Szociális szövetkezet', regime: 'Nonprofit (B)', count: 0 },
  { gfo: '593', name: 'Lakásszövetkezet', regime: 'Nonprofit (A)', count: 0 },
  { gfo: '731', name: 'Ügyvédi iroda', regime: 'Általános 6.§', count: 0 },
  { gfo: '121', name: 'Szövetkezet (általános)', regime: 'Általános 6.§', count: 0 },
];

export default function TaoTaxpayerTypesPage() {
  const { data: clients = [] } = useAccountyClients();

  // Simulate distribution
  const types = useMemo(() => {
    return GFO_TYPES.map((t, i) => ({
      ...t,
      count: Math.max(0, Math.floor(clients.length * [0.45, 0.2, 0.1, 0.02, 0.05, 0.03, 0.05, 0.04, 0.01, 0.02, 0.02, 0.01][i % 12])),
    })).filter(t => t.count > 0 || GFO_TYPES.indexOf(t) < 6);
  }, [clients.length]);

  const total = types.reduce((s, t) => s + t.count, 0) || 1;

  const REGIME_COLORS: Record<string, string> = {
    'Általános 6.§': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    'Nonprofit (A)': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    'Nonprofit (B)': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-violet-500/25">
          <Users className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Adózói Körök</h1>
          <p className="text-sm text-slate-500">Portfólió bontása GFO-kód és adózói típus szerint (spec 1.3)</p>
        </div>
      </div>

      {/* Visual breakdown - horizontal bar */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-soft">
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Adózói típus megoszlása</h2>
        <div className="flex h-6 rounded-full overflow-hidden">
          {types.filter(t => t.count > 0).map((t, i) => {
            const pct = (t.count / total) * 100;
            const colors = ['bg-emerald-500', 'bg-blue-500', 'bg-amber-500', 'bg-purple-500', 'bg-rose-500', 'bg-cyan-500', 'bg-orange-500', 'bg-indigo-500'];
            return (
              <div
                key={t.gfo}
                className={cn('transition-all', colors[i % colors.length])}
                style={{ width: `${Math.max(pct, 2)}%` }}
                title={`${t.name}: ${t.count}`}
              />
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3 mt-3">
          {types.filter(t => t.count > 0).map((t, i) => {
            const colors = ['bg-emerald-500', 'bg-blue-500', 'bg-amber-500', 'bg-purple-500', 'bg-rose-500', 'bg-cyan-500', 'bg-orange-500', 'bg-indigo-500'];
            return (
              <div key={t.gfo} className="flex items-center gap-1.5">
                <div className={cn('w-2.5 h-2.5 rounded-full', colors[i % colors.length])} />
                <span className="text-[10px] text-slate-500">{t.name.split('(')[0].trim()} ({t.count})</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border dark:bg-slate-900/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">GFO-kód</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Adózói típus</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ügyfélszám</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Adóalap-rezsim</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {types.map(t => (
                <tr key={t.gfo} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                  <td className="px-4 py-3">
                    <span className="text-sm font-mono font-bold text-slate-700 dark:text-slate-300">{t.gfo}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{t.name}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn('text-sm font-bold', t.count > 0 ? 'text-slate-700 dark:text-slate-300' : 'text-slate-300')}>{t.count}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2.5 py-1 rounded-full text-[10px] font-bold', REGIME_COLORS[t.regime] || REGIME_COLORS['Általános 6.§'])}>
                      {t.regime}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-primary cursor-pointer">
                      Szűrt lista <ChevronRight className="w-3 h-3 inline" />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
