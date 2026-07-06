import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Gauge, ArrowLeft, ChevronRight, AlertTriangle, CheckCircle2,
  TrendingUp, Zap, Info, ArrowUpRight, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  formatHuf, formatPercent, formatMillionHuf,
  getEvThresholds, DEFAULT_2026_PARAMS,
  type ThresholdCheck, type ThresholdStatus,
} from '@/lib/evCalculations';
import { useAllEvClientSettings, useEvYtdRevenue } from '@/hooks/useEvData';

// ─── Types & Constants ──────────────────────────────────────────────────────

interface ClientThresholdRow {
  clientId: string;
  clientName: string;
  taxNumber: string;
  taxpayerForm: 'atalany' | 'vszja' | 'kata';
  isRetail: boolean;
  ytdRevenue: number;
  thresholds: ThresholdCheck[];
  worstStatus: ThresholdStatus;
}

function worstOf(checks: ThresholdCheck[]): ThresholdStatus {
  if (checks.some(c => c.status === 'red')) return 'red';
  if (checks.some(c => c.status === 'yellow')) return 'yellow';
  return 'green';
}

const STATUS_CONFIG = {
  red: { label: 'Kritikus', color: 'text-red-600', bgColor: 'bg-red-50 dark:bg-red-900/20', borderColor: 'border-red-200 dark:border-red-800', icon: AlertTriangle },
  yellow: { label: 'Figyelmeztetés', color: 'text-amber-600', bgColor: 'bg-amber-50 dark:bg-amber-900/20', borderColor: 'border-amber-200 dark:border-amber-800', icon: AlertTriangle },
  green: { label: 'Rendben', color: 'text-green-600', bgColor: 'bg-green-50 dark:bg-green-900/20', borderColor: 'border-green-200 dark:border-green-800', icon: CheckCircle2 },
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function EvThresholdMonitorPage() {
  const [filter, setFilter] = useState<'all' | ThresholdStatus>('all');
  const [taxYear] = useState(2026);

  // ─── Real data from Supabase ───────────────────────────────────────────────
  const { data: rawSettings, isLoading: settingsLoading } = useAllEvClientSettings(taxYear);
  const { data: revenueMap, isLoading: revenueLoading } = useEvYtdRevenue(taxYear);
  const isLoading = settingsLoading || revenueLoading;

  const clients = useMemo((): ClientThresholdRow[] => {
    return (rawSettings || []).map((s: any) => {
      const companyName = s.companies?.name || 'Ismeretlen ügyfél';
      const taxNumber = s.companies?.tax_number || '';
      const form = s.taxpayer_form || 'atalany';
      const isRetail = s.cost_ratio_category === 'retail_90';
      const ytdRevenue = revenueMap?.get(s.company_id) || 0;
      const thresholds = getEvThresholds(ytdRevenue, form, isRetail, DEFAULT_2026_PARAMS);
      return {
        clientId: s.company_id,
        clientName: companyName,
        taxNumber,
        taxpayerForm: form,
        isRetail,
        ytdRevenue,
        thresholds,
        worstStatus: worstOf(thresholds),
      };
    });
  }, [rawSettings, revenueMap]);

  const filtered = useMemo(() => {
    if (filter === 'all') return clients;
    return clients.filter(c => c.worstStatus === filter);
  }, [clients, filter]);

  const countByStatus = useMemo(() => ({
    red: clients.filter(c => c.worstStatus === 'red').length,
    yellow: clients.filter(c => c.worstStatus === 'yellow').length,
    green: clients.filter(c => c.worstStatus === 'green').length,
  }), [clients]);

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/accounty/ev" className="hover:text-indigo-600 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> EV Portfólió
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-900 dark:text-slate-100 font-medium">Értékhatár-figyelő</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl shadow-lg shadow-orange-500/25">
          <Gauge className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Értékhatár-figyelő</h1>
          <p className="text-sm text-slate-500">KATA keret, átalány bevételi határ, ÁFA alanyi mentesség – portfólió szintű monitoring</p>
        </div>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <button
          onClick={() => setFilter('all')}
          className={cn(
            'bg-card rounded-xl border p-4 shadow-soft text-left transition-all hover:shadow-md',
            filter === 'all' ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-border'
          )}
        >
          <p className="text-xs text-slate-500 mb-1">Összes ügyfél</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{isLoading ? '...' : clients.length}</p>
        </button>
        {(['red', 'yellow', 'green'] as ThresholdStatus[]).map(status => {
          const cfg = STATUS_CONFIG[status];
          const Icon = cfg.icon;
          return (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={cn(
                'rounded-xl border p-4 shadow-soft text-left transition-all hover:shadow-md',
                cfg.bgColor, cfg.borderColor,
                filter === status ? 'ring-2 ring-indigo-500/20' : ''
              )}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className={cn('w-3.5 h-3.5', cfg.color)} />
                <p className={cn('text-xs font-medium', cfg.color)}>{cfg.label}</p>
              </div>
              <p className={cn('text-2xl font-bold', cfg.color)}>{isLoading ? '...' : countByStatus[status]}</p>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-slate-50/50 dark:bg-slate-800/30">
                <th className="text-left py-3 px-4 font-medium text-slate-500 text-xs uppercase tracking-wider">Ügyfél</th>
                <th className="text-left py-3 px-4 font-medium text-slate-500 text-xs uppercase tracking-wider">Adóforma</th>
                <th className="text-right py-3 px-4 font-medium text-slate-500 text-xs uppercase tracking-wider">YTD bevétel</th>
                <th className="text-left py-3 px-4 font-medium text-slate-500 text-xs uppercase tracking-wider">Értékhatárok</th>
                <th className="text-center py-3 px-4 font-medium text-slate-500 text-xs uppercase tracking-wider">Státusz</th>
                <th className="w-10 py-3 px-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-sm text-slate-400">
                    <Loader2 className="w-8 h-8 mx-auto mb-3 text-orange-400 animate-spin" />
                    Betöltés...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-sm text-slate-400">
                    <Gauge className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                    Nincs EV ügyfél ebben a kategóriában
                  </td>
                </tr>
              ) : (
                filtered.map(c => {
                  const worstCfg = STATUS_CONFIG[c.worstStatus];
                  return (
                    <tr key={c.clientId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{c.clientName}</p>
                        {c.taxNumber && <p className="text-[10px] text-slate-400 font-mono">{c.taxNumber}</p>}
                      </td>
                      <td className="py-3 px-4">
                        <span className={cn(
                          'text-xs font-bold px-2 py-0.5 rounded-full',
                          c.taxpayerForm === 'atalany' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : c.taxpayerForm === 'kata' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        )}>
                          {c.taxpayerForm === 'atalany' ? 'Átalány' : c.taxpayerForm === 'kata' ? 'KATA' : 'VSZJA'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300 font-medium">
                        {formatMillionHuf(c.ytdRevenue)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1.5">
                          {c.thresholds.map(t => {
                            const tCfg = STATUS_CONFIG[t.status];
                            return (
                              <div key={t.name} className="flex items-center gap-2">
                                <div className="w-24 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex-shrink-0">
                                  <div
                                    className={cn(
                                      'h-full rounded-full',
                                      t.status === 'red' ? 'bg-red-500'
                                        : t.status === 'yellow' ? 'bg-amber-500'
                                        : 'bg-green-500'
                                    )}
                                    style={{ width: `${Math.min(100, t.percentage)}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-slate-500 whitespace-nowrap">
                                  {t.name}: {t.percentage.toFixed(0)}%
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={cn(
                          'inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase',
                          worstCfg.bgColor, worstCfg.color, worstCfg.borderColor, 'border'
                        )}>
                          <worstCfg.icon className="w-3 h-3" />
                          {worstCfg.label}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <Link
                          to={`/accounty/client/${c.clientId}/ev`}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-400 hover:text-indigo-600 inline-flex"
                        >
                          <ArrowUpRight className="w-4 h-4" />
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

      {/* Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
            <p className="font-semibold">Figyelő működése</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li><span className="font-bold text-green-600">Rendben</span>: bevétel a határ 80%-a alatt</li>
              <li><span className="font-bold text-amber-600">Figyelmeztetés</span>: bevétel a határ 80–100% között</li>
              <li><span className="font-bold text-red-600">Kritikus</span>: határ túllépve – azonnali teendő</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
