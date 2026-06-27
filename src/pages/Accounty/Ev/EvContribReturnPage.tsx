import React, { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  FileBarChart, ArrowLeft, ChevronRight, Info, Calculator,
  CheckCircle2, Clock, Send, Download, Calendar, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccountyClient } from '@/hooks/accounty';
import { formatHuf, DEFAULT_2026_PARAMS } from '@/lib/evCalculations';
import { useEvTaxReturns, useEvGlobalTaxParams } from '@/hooks/useEvData';

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_CFG = {
  submitted: { label: 'Benyújtva', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
  accepted: { label: 'Elfogadva', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
  draft: { label: 'Vázlat', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: FileBarChart },
  upcoming: { label: 'Közelgő', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', icon: Clock },
};

export default function EvContribReturnPage() {
  const { id } = useParams<{ id: string }>();
  const { data: client } = useAccountyClient(id);

  // ─── Real data ────────────────────────────────────────────────────────────
  const { data: allReturns, isLoading } = useEvTaxReturns(id, 2026);
  const { data: globalParams } = useEvGlobalTaxParams(2026);

  const contribReturns = useMemo(() => {
    return (allReturns || [])
      .filter((r: any) => r.return_type === '2658' || r.return_type === 'contrib')
      .map((r: any) => {
        const status = r.status === 'submitted' || r.status === 'accepted' ? 'submitted'
          : r.status === 'draft' ? 'draft' : 'upcoming';
        return {
          id: r.id,
          quarter: r.period_key || '',
          deadline: r.deadline || '',
          status: status as keyof typeof STATUS_CFG,
          tbAmount: r.data?.tb_amount || 0,
          szochoAmount: r.data?.szocho_amount || 0,
          totalAmount: r.calculated_tax || 0,
          submittedDate: r.submitted_at,
        };
      });
  }, [allReturns]);

  const totalPaid = contribReturns.filter(r => r.status === 'submitted').reduce((s, r) => s + r.totalAmount, 0);
  const tbRate = globalParams?.tb_rate || 18.5;
  const szochoRate = globalParams?.szocho_rate || 13;

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/accounty/ev" className="hover:text-indigo-600 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> EV Portfólió
        </Link>
        <ChevronRight className="w-3 h-3" />
        <Link to={`/accounty/client/${id}/ev`} className="hover:text-indigo-600 transition-colors">{client?.name || 'Ügyfél'}</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-900 dark:text-slate-100 font-medium">TB/Szocho bevallás (58-as)</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl shadow-lg shadow-teal-500/25">
          <FileBarChart className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">TB/Szocho bevallás (58-as nyomtatvány)</h1>
          <p className="text-sm text-slate-500">Tbj. 51. § – negyedéves járulékbevallás</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">YTD befizetett</p>
          <p className="text-lg font-bold text-teal-600 tabular-nums">{isLoading ? '...' : formatHuf(totalPaid)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">TB kulcs</p>
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{tbRate}%</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Szocho kulcs</p>
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{szochoRate}%</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Gyakoriság</p>
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100">Negyedéves</p>
        </div>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-8 h-8 mb-3 animate-spin text-teal-400" />
            <p className="text-sm">Betöltés...</p>
          </div>
        ) : contribReturns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <FileBarChart className="w-10 h-10 mb-3 opacity-50" />
            <p className="text-sm font-medium">Még nincs járulékbevallás rögzítve</p>
          </div>
        ) : (
          contribReturns.map(ret => {
            const cfg = STATUS_CFG[ret.status] || STATUS_CFG.upcoming;
            const Icon = cfg.icon;
            return (
              <div key={ret.id} className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-xs font-bold text-teal-600">58</div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{ret.quarter} – TB/Szocho bevallás</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full', cfg.color)}>
                          <Icon className="w-3 h-3" />{cfg.label}
                        </span>
                        {ret.deadline && (
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />Határidő: {new Date(ret.deadline).toLocaleDateString('hu-HU')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {ret.totalAmount > 0 && (
                      <div className="text-right">
                        {(ret.tbAmount > 0 || ret.szochoAmount > 0) && (
                          <p className="text-xs text-slate-400">TB: {formatHuf(ret.tbAmount)} | Szocho: {formatHuf(ret.szochoAmount)}</p>
                        )}
                        <p className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">{formatHuf(ret.totalAmount)}</p>
                      </div>
                    )}
                    {ret.status === 'draft' && (
                      <button className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 hover:bg-indigo-100 transition-colors"><Send className="w-4 h-4" /></button>
                    )}
                    {ret.status === 'submitted' && (
                      <button className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100 transition-colors"><Download className="w-4 h-4" /></button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-xs text-blue-600 dark:text-blue-400">
            <p className="font-semibold">58-as nyomtatvány</p>
            <p>A negyedéves járulékbevallást a negyedévet követő hónap 12-ig kell benyújtani. Főfoglalkozású EV-nál a járulékalap legalább a minimálbér/garantált bérminimum.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
