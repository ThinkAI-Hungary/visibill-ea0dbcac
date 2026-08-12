import React from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Beaker, ArrowLeft, ChevronRight, Info, Calculator
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccountyClient } from '@/hooks/accounty';
import { formatHuf } from '@/lib/evCalculations';

// ─── Component ──────────────────────────────────────────────────────────────

export default function EvInnovationLevyPage() {
  const { companyId, dateRange } = useParams<{ companyId: string; dateRange: string }>();
  const id = companyId;
  const { data: client } = useAccountyClient(id);

  // Innovation contribution typically applies to companies, not EV
  // but can apply in special cases
  const isExempt = true;
  const nettoBevétel = 24_000_000;
  const innovacioKulcs = 0.003; // 0.3%
  const calcAmount = Math.round(nettoBevétel * innovacioKulcs);

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/accounty?tab=ev" className="hover:text-indigo-600 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> EV Portfólió
        </Link>
        <ChevronRight className="w-3 h-3" />
        <Link to={`/accounty/${id}/${dateRange}/ev`} className="hover:text-indigo-600 transition-colors">
          {client?.name || 'Ügyfél'}
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-900 dark:text-slate-100 font-medium">Innovációs járulék</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-gradient-to-br from-sky-500 to-cyan-600 rounded-xl shadow-lg shadow-sky-500/25">
          <Beaker className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Innovációs járulék</h1>
          <p className="text-sm text-slate-500">2014. évi LXXVI. tv. – innovációs hozzájárulás</p>
        </div>
      </div>

      {/* Status card */}
      <div className={cn(
        'rounded-xl border p-6 shadow-soft',
        isExempt
          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
          : 'bg-card border-border'
      )}>
        <div className="flex items-center gap-4">
          <div className={cn(
            'w-14 h-14 rounded-2xl flex items-center justify-center',
            isExempt ? 'bg-green-100 dark:bg-green-900/30' : 'bg-sky-100 dark:bg-sky-900/30'
          )}>
            <Beaker className={cn('w-7 h-7', isExempt ? 'text-green-600' : 'text-sky-600')} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {isExempt ? 'Egyéni vállalkozó – MENTES' : 'Fizetési kötelezettség'}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {isExempt
                ? 'Egyéni vállalkozók az innovációs hozzájárulás alól mentesek.'
                : `Éves kötelezettség: ${formatHuf(calcAmount)}`
              }
            </p>
          </div>
        </div>
      </div>

      {/* Calculation (informational) */}
      <div className="bg-card rounded-xl border border-border shadow-soft p-5 space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Calculator className="w-4 h-4 text-sky-600" /> Kalkuláció (tájékoztató)
        </h2>
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-border/50">
            <span className="text-sm text-slate-500">Nettó árbevétel</span>
            <span className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">{formatHuf(nettoBevétel)}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-border/50">
            <span className="text-sm text-slate-500">Innovációs járulék kulcsa</span>
            <span className="text-sm font-bold text-sky-600">{(innovacioKulcs * 100).toFixed(1)}%</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-border/50">
            <span className="text-sm text-slate-500">Számított összeg</span>
            <span className={cn('text-sm font-bold font-mono tabular-nums', isExempt ? 'text-slate-400 line-through' : 'text-sky-600')}>
              {formatHuf(calcAmount)}
            </span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">Ténylegesen fizetendő</span>
            <span className="text-lg font-bold font-mono tabular-nums text-green-600">
              {isExempt ? formatHuf(0) : formatHuf(calcAmount)}
            </span>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
            <p className="font-semibold">Innovációs járulék szabályok</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Kulcs: 0,3% a nettó árbevétel alapján</li>
              <li><strong>Egyéni vállalkozók mentesek</strong> az innovációs hozzájárulás alól</li>
              <li>Csak gazdasági társaságok (Kft., Bt., Rt.) kötelesek fizetni</li>
              <li>KKV státusz: a mikro- és kisvállalkozások is mentesek</li>
              <li>Bevallási határidő: tárgyévet követő május 31.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
