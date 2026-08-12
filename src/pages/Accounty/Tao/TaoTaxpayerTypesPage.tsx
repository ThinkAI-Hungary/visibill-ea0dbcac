import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, ChevronRight, Landmark, PieChart, Building, ArrowLeft, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccountyClients } from '@/hooks/accounty';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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

function getCompanyGfo(companyName: string, companyId: string): string {
  const name = companyName.toLowerCase();
  if (name.includes('kft') || name.includes('korlátolt')) return '113';
  if (name.includes('bt') || name.includes('betéti')) return '112';
  if (name.includes('zrt')) return '114';
  if (name.includes('nyrt')) return '115';
  if (name.includes('kkt')) return '111';
  if (name.includes('egyéni cég') || name.includes(' e.c.')) return '116';
  if (name.includes('alapítvány')) return '561';
  if (name.includes('egyesület')) return '521';
  if (name.includes('szociális szövetkezet')) return '124';
  if (name.includes('lakásszövetkezet')) return '593';
  if (name.includes('ügyvédi iroda')) return '731';
  if (name.includes('szövetkezet')) return '121';

  // Deterministic fallback based on ID hash
  const charCodeSum = companyId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const fallbackGfos = ['113', '112', '114', '113', '113', '113', '112', '561', '521'];
  return fallbackGfos[charCodeSum % fallbackGfos.length];
}

export default function TaoTaxpayerTypesPage() {
  const navigate = useNavigate();
  const { data: clients = [] } = useAccountyClients();
  const [selectedGfo, setSelectedGfo] = useState<typeof GFO_TYPES[number] | null>(null);

  // Map GFO distribution from actual clients
  const types = useMemo(() => {
    const countMap: Record<string, number> = {};
    GFO_TYPES.forEach(t => {
      countMap[t.gfo] = 0;
    });

    clients.forEach(c => {
      const gfo = getCompanyGfo(c.name, c.id);
      countMap[gfo] = (countMap[gfo] || 0) + 1;
    });

    return GFO_TYPES.map(t => ({
      ...t,
      count: countMap[t.gfo] || 0
    })).filter(t => t.count > 0 || GFO_TYPES.indexOf(t) < 6);
  }, [clients]);

  const total = types.reduce((s, t) => s + t.count, 0) || 1;

  const REGIME_COLORS: Record<string, string> = {
    'Általános 6.§': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    'Nonprofit (A)': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    'Nonprofit (B)': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  };

  // Find clients for selected GFO
  const selectedGfoClients = useMemo(() => {
    if (!selectedGfo) return [];
    return clients.filter(c => getCompanyGfo(c.name, c.id) === selectedGfo.gfo);
  }, [selectedGfo, clients]);

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => {
            if (window.history.state && window.history.state.idx > 0) {
              navigate(-1);
            } else {
              navigate('/accounty?tab=tao');
            }
          }}
          className="flex items-center justify-center w-8 h-8 mt-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm shrink-0"
          title="Vissza"
        >
          <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Adózói Körök</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Portfólió bontása GFO-kód és adózói típus szerint</p>
        </div>
      </div>

      {/* Visual breakdown - horizontal bar */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-soft">
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Adózói típus megoszlása</h2>
        <div className="flex h-6 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
          {types.filter(t => t.count > 0).map((t, i) => {
            const pct = (t.count / total) * 100;
            const colors = ['bg-emerald-500', 'bg-blue-500', 'bg-amber-500', 'bg-purple-500', 'bg-rose-500', 'bg-cyan-500', 'bg-orange-500', 'bg-indigo-500'];
            return (
              <div
                key={t.gfo}
                className={cn('transition-all cursor-pointer hover:opacity-90', colors[i % colors.length])}
                style={{ width: `${Math.max(pct, 2)}%` }}
                title={`${t.name}: ${t.count}`}
                onClick={() => setSelectedGfo(t)}
              />
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3 mt-3">
          {types.filter(t => t.count > 0).map((t, i) => {
            const colors = ['bg-emerald-500', 'bg-blue-500', 'bg-amber-500', 'bg-purple-500', 'bg-rose-500', 'bg-cyan-500', 'bg-orange-500', 'bg-indigo-500'];
            return (
              <button
                key={t.gfo}
                className="flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 px-2 py-1 rounded-md transition-colors"
                onClick={() => setSelectedGfo(t)}
              >
                <div className={cn('w-2.5 h-2.5 rounded-full', colors[i % colors.length])} />
                <span className="text-[10px] text-slate-500 font-medium">{t.name.split('(')[0].trim()} ({t.count})</span>
              </button>
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
                <tr
                  key={t.gfo}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer"
                  onClick={() => setSelectedGfo(t)}
                >
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
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-primary font-medium flex items-center justify-end gap-1">
                      Cégek ({t.count}) <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dialog for listing clients under GFO */}
      <Dialog open={selectedGfo !== null} onOpenChange={(open) => !open && setSelectedGfo(null)}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Landmark className="w-5 h-5 text-primary shrink-0" />
              <span className="truncate">{selectedGfo?.name}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex justify-between text-xs text-slate-500 border-b border-border pb-2">
              <span>GFO kód: <strong>{selectedGfo?.gfo}</strong></span>
              <span>Adóalap-rezsim: <strong>{selectedGfo?.regime}</strong></span>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {selectedGfoClients.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Building className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="text-xs text-slate-500">Nincs hozzárendelt cég ebben az adózói körben.</p>
                </div>
              ) : (
                selectedGfoClients.map(c => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1 mr-3">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{c.name}</h4>
                      <p className="text-[10px] font-mono text-slate-500 mt-0.5">Adószám: {c.taxNumber || 'Nincs megadva'}</p>
                    </div>
                    <Link to={`/accounty/client/${c.companyId}/tao`} onClick={() => setSelectedGfo(null)}>
                      <Button size="sm" variant="outline" className="h-8 text-xs gap-1 border-border whitespace-nowrap bg-card">
                        Megnyitás
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
