import React, { useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Receipt, ArrowLeft, ChevronRight, Info, Calculator,
  AlertTriangle, CheckCircle2, Clock, FileText, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccountyClient } from '@/hooks/accounty';
import { formatHuf, formatPercent, DEFAULT_2026_PARAMS } from '@/lib/evCalculations';
import { useEvClientSettings, useEvYtdRevenue, useEvVatReturns, useUpdateEvSettings } from '@/hooks/useEvData';
import { toast } from '@/hooks/use-toast';

// ─── Component ──────────────────────────────────────────────────────────────

export default function EvVatPage() {
  const { id } = useParams<{ id: string }>();
  const { data: client } = useAccountyClient(id);
  const [taxYear] = useState(2026);

  // ─── Real data from Supabase ───────────────────────────────────────────────
  const { data: evSettings } = useEvClientSettings(id, taxYear);
  const { data: ytdRevenueMap } = useEvYtdRevenue(taxYear);
  const { data: dbVatReturns = [] } = useEvVatReturns(id, taxYear);
  const updateSettings = useUpdateEvSettings();

  const vatStatus = evSettings?.vat_status ?? 'alanyi_mentes';
  const ytdRevenue = ytdRevenueMap?.get(id || '') ?? 0;

  const afaLimit = DEFAULT_2026_PARAMS.afaAlanyiHatar;
  const remaining = Math.max(0, afaLimit - ytdRevenue);
  const percentage = afaLimit > 0 ? (ytdRevenue / afaLimit) * 100 : 0;
  const isWarning = percentage >= 80;
  const isOver = percentage >= 100;

  const vatStatusOptions = [
    { value: 'alanyi_mentes', label: 'Alanyi mentes', desc: `Határ: ${formatHuf(afaLimit)}`, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    { value: 'afas', label: 'ÁFA körös', desc: 'Havonta/negyedévente bevallás', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    { value: 'penzforgalmi', label: 'Pénzforgalmi ÁFA', desc: 'Pénzforgalmi elszámolás', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
  ];

  // Map DB records to the format the UI expects
  const vatReturns = dbVatReturns.map(r => ({
    period: r.period_key,
    status: r.status as 'submitted' | 'draft' | 'upcoming',
    inputVat: Number(r.input_vat) || 0,
    outputVat: Number(r.output_vat) || 0,
    payable: Number(r.payable) || 0,
    deadline: r.deadline,
  }));

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
        <span className="text-slate-900 dark:text-slate-100 font-medium">ÁFA kezelés</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl shadow-lg shadow-cyan-500/25">
          <Receipt className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">ÁFA kezelés</h1>
          <p className="text-sm text-slate-500">Áfa tv. – alanyi mentesség, bevallási időszakok, áfa-státusz</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Status & Threshold */}
        <div className="lg:col-span-1 space-y-4">
          {/* VAT status selector */}
          <div className="bg-card rounded-xl border border-border shadow-soft p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">ÁFA státusz</h2>
            <div className="space-y-2">
              {vatStatusOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => {
                    if (!id || !evSettings || opt.value === vatStatus) return;
                    updateSettings.mutate(
                      { company_id: id, tax_year: taxYear, vat_status: opt.value as any },
                      {
                        onSuccess: () => toast({ title: 'ÁFA státusz frissítve', description: `ÁFA státusz: ${opt.label}` }),
                        onError: (err: any) => toast({ variant: 'destructive', title: 'Hiba', description: err.message || 'Nem sikerült menteni.' }),
                      }
                    );
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-all text-left',
                    vatStatus === opt.value
                      ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/10'
                      : 'border-border hover:border-slate-300 dark:hover:border-slate-600'
                  )}
                >
                  <div className={cn('w-3 h-3 rounded-full', vatStatus === opt.value ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700')} />
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{opt.label}</p>
                    <p className="text-xs text-slate-500">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Threshold */}
          {vatStatus === 'alanyi_mentes' && (
            <div className={cn(
              'rounded-xl border p-5 shadow-soft',
              isOver ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                : isWarning ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                : 'bg-card border-border'
            )}>
              <div className="flex items-center gap-2 mb-3">
                {isOver ? <AlertTriangle className="w-4 h-4 text-red-600" />
                  : isWarning ? <AlertTriangle className="w-4 h-4 text-amber-600" />
                  : <CheckCircle2 className="w-4 h-4 text-green-600" />}
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Alanyi mentesség határ</h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Aktuális bevétel</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-300">{formatHuf(ytdRevenue)}</span>
                </div>
                <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      isOver ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-green-500'
                    )}
                    style={{ width: `${Math.min(100, percentage)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Határ: {formatHuf(afaLimit)}</span>
                  <span className={cn('font-semibold', isOver ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-green-600')}>
                    {isOver ? 'TÚLLÉPVE!' : `Hátralévő: ${formatHuf(remaining)}`}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                <p className="font-semibold">ÁFA szabályok (2026)</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Alanyi mentesség határa: {formatHuf(afaLimit)}</li>
                  <li>ÁFA kulcsok: 27%, 18%, 5%, mentes</li>
                  <li>Túllépés: automatikus ÁFA-körbe kerülés</li>
                  <li>Pénzforgalmi ÁFA: KKV-k számára, pénzmozgáskor elszámolás</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Right: VAT returns */}
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
              <p className="text-xs text-slate-500 mb-1">YTD Bevétel</p>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums">{formatHuf(ytdRevenue)}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
              <p className="text-xs text-slate-500 mb-1">ÁFA státusz</p>
              <p className="text-lg font-bold text-green-600">
                {vatStatus === 'alanyi_mentes' ? 'Alanyi mentes' : vatStatus === 'afas' ? 'ÁFA körös' : 'Pénzforgalmi'}
              </p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
              <p className="text-xs text-slate-500 mb-1">Felszámított ÁFA (YTD)</p>
              <p className="text-lg font-bold text-blue-600 tabular-nums">{formatHuf(vatReturns.reduce((s, r) => s + r.outputVat, 0))}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
              <p className="text-xs text-slate-500 mb-1">Fizetendő ÁFA (YTD)</p>
              <p className="text-lg font-bold text-red-500 tabular-nums">{formatHuf(vatReturns.reduce((s, r) => s + r.payable, 0))}</p>
            </div>
          </div>

          {vatStatus !== 'alanyi_mentes' && (
            <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
              <div className="px-5 py-3 border-b border-border/50">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">ÁFA bevallások</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-slate-50/50 dark:bg-slate-800/30">
                      <th className="text-left py-3 px-4 font-medium text-slate-500 text-xs uppercase tracking-wider">Időszak</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-500 text-xs uppercase tracking-wider">Státusz</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-500 text-xs uppercase tracking-wider">Előzetesen felszámított</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-500 text-xs uppercase tracking-wider">Fizetendő</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-500 text-xs uppercase tracking-wider">Egyenleg</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-500 text-xs uppercase tracking-wider">Határidő</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {vatReturns.map(ret => (
                      <tr key={ret.period} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">{ret.period}</td>
                        <td className="py-3 px-4">
                          <span className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold',
                            ret.status === 'submitted' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : ret.status === 'draft' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                          )}>
                            {ret.status === 'submitted' ? <CheckCircle2 className="w-3 h-3" />
                              : ret.status === 'draft' ? <FileText className="w-3 h-3" />
                              : <Clock className="w-3 h-3" />}
                            {ret.status === 'submitted' ? 'Benyújtva' : ret.status === 'draft' ? 'Vázlat' : 'Közelgő'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">{formatHuf(ret.inputVat)}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">{formatHuf(ret.outputVat)}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-red-600 font-medium">{formatHuf(ret.payable)}</td>
                        <td className="py-3 px-4 font-mono text-xs tabular-nums text-slate-600 dark:text-slate-400">
                          {new Date(ret.deadline).toLocaleDateString('hu-HU')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {vatStatus === 'alanyi_mentes' && (
            <div className="bg-card rounded-xl border border-border shadow-soft p-8 text-center">
              <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">Alanyi adómentes</p>
              <p className="text-sm text-slate-500 mt-1">ÁFA bevallás nem szükséges alanyi mentesség esetén.</p>
              <p className="text-xs text-slate-400 mt-3">
                Bevételi határ: {formatHuf(afaLimit)} – túllépés esetén automatikus ÁFA-körbe sorolás.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
