import React, { useState, useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ChevronRight, Calculator, TrendingUp, AlertTriangle,
  Info, CheckCircle, Clock, Wallet, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { useAccountyClient, useEvTaxParams } from '@/hooks/accounty';
import {
  calculateQuarterlyContributions, formatHuf, formatPercent,
  DEFAULT_2026_PARAMS, DEFAULT_2025_PARAMS, type EmploymentStatus
} from '@/lib/evCalculations';
import { useEvContributions, type EvContributionCalc } from '@/hooks/useEvData';

// ─── Constants ──────────────────────────────────────────────────────────────

const QUARTER_LABELS = ['I.', 'II.', 'III.', 'IV.'];
const QUARTER_DEADLINES = ['ápr. 12.', 'júl. 12.', 'okt. 12.', 'jan. 12.'];

export default function EvContributionsPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const taxYear = Number(searchParams.get('year') || '2026');
  const { data: client } = useAccountyClient(id);
  const [employmentStatus, setEmploymentStatus] = useState<EmploymentStatus>('foallasu');
  const [isSkilled, setIsSkilled] = useState(false);

  const { data: dbParams } = useEvTaxParams(taxYear);
  const params = dbParams || (taxYear === 2026 ? DEFAULT_2026_PARAMS : DEFAULT_2025_PARAMS);

  // ─── Real data from Supabase ───────────────────────────────────────────────
  const { data: rawContributions, isLoading } = useEvContributions(id, taxYear);

  // Build quarterly data from DB records or fallback to local calculation
  const calculations = useMemo(() => {
    const dbData = rawContributions || [];

    // If we have DB records, use them; otherwise compute from empty
    return [1, 2, 3, 4].map(quarter => {
      const dbRecord = dbData.find((r: any) => r.quarter === quarter) as EvContributionCalc | undefined;

      // Determine deadline date for this quarter
      const deadlineMonth = quarter === 4 ? 0 : quarter * 3 + 1; // Apr=3, Jul=6, Oct=9, Jan=0
      const deadlineYear = quarter === 4 ? taxYear + 1 : taxYear;
      const deadlineDate = new Date(deadlineYear, deadlineMonth, 12);
      const now = new Date();
      const isPast = now > deadlineDate;
      const daysUntilDeadline = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const isDueSoon = !isPast && daysUntilDeadline <= 30;

      const status: 'paid' | 'due' | 'upcoming' = isPast ? 'paid' : isDueSoon ? 'due' : 'upcoming';

      if (dbRecord) {
        return {
          quarter,
          ytdIncome: dbRecord.ytd_income,
          status,
          calc: {
            currentQuarterBase: dbRecord.current_quarter_base,
            tbAmount: dbRecord.tb_amount,
            szochoAmount: dbRecord.szocho_amount,
            totalAmount: dbRecord.total_amount,
            minimumBaseApplied: dbRecord.minimum_base_applied,
            minimumBaseAmount: dbRecord.minimum_base_amount,
          },
        };
      } else {
        const calc = calculateQuarterlyContributions(
          quarter, 0, 0, 3, employmentStatus, isSkilled, params
        );
        return {
          quarter,
          ytdIncome: 0,
          status,
          calc,
        };
      }
    });
  }, [rawContributions, employmentStatus, isSkilled, params, taxYear]);

  const totalTb = calculations.reduce((s, c) => s + c.calc.tbAmount, 0);
  const totalSzocho = calculations.reduce((s, c) => s + c.calc.szochoAmount, 0);
  const totalAll = totalTb + totalSzocho;
  const minimumApplied = calculations.some(c => c.calc.minimumBaseApplied);

  const STATUS_CONFIG = {
    paid: { label: 'Fizetve', icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
    due: { label: 'Esedékes', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    upcoming: { label: 'Jövőbeli', icon: Clock, color: 'text-slate-400', bg: 'bg-slate-50 dark:bg-slate-800' },
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to={`/accounty/client/${id}/ev?year=${taxYear}`} className="hover:text-indigo-600 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> EV Főoldal
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-900 dark:text-slate-100 font-medium">TB-járulék & szocho</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl shadow-lg shadow-rose-500/25">
            <Calculator className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">TB-járulék & szocho</h1>
            <p className="text-sm text-slate-500">
              Tbj. 40–44. §, Szocho tv. — {client?.name || 'Ügyfél'} — {taxYear}
            </p>
          </div>
        </div>
      </div>

      {/* Settings row */}
      <div className="bg-card rounded-xl border border-border shadow-soft p-4 flex items-center gap-6 flex-wrap">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Foglalkoztatási jogviszony</label>
          <div className="flex gap-1.5">
            {([
              { value: 'foallasu' as EmploymentStatus, label: 'Főfoglalkozás' },
              { value: 'mellekallasu' as EmploymentStatus, label: 'Mellékállás' },
              { value: 'kiegeszito' as EmploymentStatus, label: 'Kiegészítő' },
            ]).map(opt => (
              <button
                key={opt.value}
                onClick={() => setEmploymentStatus(opt.value)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                  employmentStatus === opt.value
                    ? 'border-rose-400 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400'
                    : 'border-border text-slate-500'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="skilled-cb"
            checked={isSkilled}
            onChange={e => setIsSkilled(e.target.checked)}
            className="rounded border-border"
          />
          <label htmlFor="skilled-cb" className="text-xs text-slate-600 dark:text-slate-400">
            Szakképzettséget igénylő (garantált bérminimum)
          </label>
        </div>

        <div className="ml-auto flex items-center gap-4 text-xs text-slate-500">
          <span>TB: {formatPercent(params.tbJarulekKulcs)}</span>
          <span>Szocho: {formatPercent(params.szochoKulcs)}</span>
          <span>Min.bér: {formatHuf(params.minimalber)}/hó</span>
        </div>
      </div>

      {/* Minimum base warning */}
      {minimumApplied && employmentStatus === 'foallasu' && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-700 dark:text-amber-400">
            <p className="font-semibold">Minimum járulékalap alkalmazva</p>
            <p className="mt-0.5">
              Főfoglalkozásúnál a negyedéves jövedelem alacsonyabb, mint a minimum-alap ({formatHuf(isSkilled ? params.garantaltBerminimum : params.minimalber)}/hó × hónapok).
              A járulékot a minimum-alap után kell fizetni.
            </p>
          </div>
        </div>
      )}

      {employmentStatus === 'kiegeszito' && (
        <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-xl p-4 flex gap-3">
          <CheckCircle className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
          <div className="text-xs text-green-700 dark:text-green-400">
            <p className="font-semibold">Kiegészítő tevékenység — mentes a járulékfizetés alól</p>
            <p className="mt-0.5">Nyugdíjas EV kiegészítő tevékenysége nem jár járulékfizetési kötelezettséggel.</p>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Éves TB-járulék</p>
          <p className="text-xl font-bold text-rose-600">{formatHuf(totalTb)}</p>
          <p className="text-[10px] text-slate-400">{formatPercent(params.tbJarulekKulcs)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Éves szocho</p>
          <p className="text-xl font-bold text-pink-600">{formatHuf(totalSzocho)}</p>
          <p className="text-[10px] text-slate-400">{formatPercent(params.szochoKulcs)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Összesen</p>
          <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{formatHuf(totalAll)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Kamarai hj.</p>
          <p className="text-xl font-bold text-slate-700 dark:text-slate-300">{formatHuf(params.kamaraiHozzajarulas)}</p>
          <p className="text-[10px] text-slate-400">éves fix</p>
        </div>
      </div>

      {/* Quarterly breakdown */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-rose-400 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {calculations.map((q, i) => {
            const st = STATUS_CONFIG[q.status];
            return (
              <div key={q.quarter} className={cn('bg-card rounded-xl border border-border shadow-soft overflow-hidden', q.status === 'due' && 'ring-1 ring-amber-300')}>
                <div className={cn('px-4 py-2.5 flex items-center justify-between', st.bg)}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{QUARTER_LABELS[i]} negyedév</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <st.icon className={cn('w-3.5 h-3.5', st.color)} />
                    <span className={cn('text-[10px] font-semibold', st.color)}>{st.label}</span>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Határidő</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{taxYear}. {QUARTER_DEADLINES[i]}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Járulékalap</span>
                    <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                      {formatHuf(q.calc.currentQuarterBase)}
                    </span>
                  </div>
                  {q.calc.minimumBaseApplied && (
                    <div className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-900/10 rounded px-2 py-1">
                      Min. alap: {formatHuf(q.calc.minimumBaseAmount)}
                    </div>
                  )}
                  <div className="border-t border-border/50 pt-2 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">TB ({formatPercent(params.tbJarulekKulcs)})</span>
                      <span className="font-mono tabular-nums text-rose-600 font-semibold">{formatHuf(q.calc.tbAmount)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Szocho ({formatPercent(params.szochoKulcs)})</span>
                      <span className="font-mono tabular-nums text-pink-600 font-semibold">{formatHuf(q.calc.szochoAmount)}</span>
                    </div>
                    <div className="flex justify-between text-xs pt-1 border-t border-border/50">
                      <span className="text-slate-700 dark:text-slate-300 font-semibold">Összesen</span>
                      <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">{formatHuf(q.calc.totalAmount)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info */}
      <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-xl p-4 flex gap-3">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
          <p className="font-semibold">Járulékszámítás szabályai ({taxYear})</p>
          <ul className="list-disc list-inside space-y-0.5 text-blue-600">
            <li>TB-járulék: {formatPercent(params.tbJarulekKulcs)} (egészségbiztosítási + nyugdíj + munkaerőpiaci)</li>
            <li>Szocho: {formatPercent(params.szochoKulcs)}</li>
            <li>Főfoglalkozásúnál havi minimum-alap: {formatHuf(params.minimalber)} (szakképzett: {formatHuf(params.garantaltBerminimum)})</li>
            <li>Mellékállásnál: tényleges jövedelem alapján, minimum-alap nélkül</li>
            <li>Kiegészítő (nyugdíjas): mentes</li>
            <li>Bevallás: negyedéves 2658 (ápr/júl/okt/jan 12.)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
