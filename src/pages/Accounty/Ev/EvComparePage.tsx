import { useDateRange } from '@/contexts/DateRangeContext';
import React, { useState, useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ChevronRight, Scale, TrendingUp, PiggyBank,
  Shield, Calculator, Check, Crown, Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { useAccountyClient, useEvTaxParams } from '@/hooks/accounty';
import {
  compareTaxForms, formatHuf, formatPercent, formatMillionHuf,
  DEFAULT_2026_PARAMS, DEFAULT_2025_PARAMS, type TaxFormComparison,
  type EmploymentStatus
} from '@/lib/evCalculations';

const FORM_ICONS: Record<string, React.ReactNode> = {
  atalany: <PiggyBank className="w-5 h-5" />,
  vszja: <TrendingUp className="w-5 h-5" />,
  kata: <Shield className="w-5 h-5" />,
};

const FORM_COLORS: Record<string, { gradient: string; text: string; bg: string }> = {
  atalany: { gradient: 'from-indigo-500 to-purple-600', text: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
  vszja: { gradient: 'from-violet-500 to-fuchsia-600', text: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-900/20' },
  kata: { gradient: 'from-amber-500 to-orange-600', text: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
};

export default function EvComparePage() {
  const { companyId, dateRange } = useParams<{ companyId: string; dateRange: string }>();
  const id = companyId;
  const { data: client } = useAccountyClient(id);
  const [searchParams] = useSearchParams();
  const { dateFrom, setDateFrom, setDateTo, dateFromFormatted, dateToFormatted } = useDateRange();
  const taxYear = dateFrom.getFullYear();

  const { data: dbParams } = useEvTaxParams(taxYear);
  const params = dbParams || (taxYear === 2026 ? DEFAULT_2026_PARAMS : DEFAULT_2025_PARAMS);

  const [revenue, setRevenue] = useState(24_200_000);
  const [costs, setCosts] = useState(8_470_000);
  const [kivet, setKivet] = useState(6_000_000);
  const [costCategory, setCostCategory] = useState<'general' | 'high_80' | 'retail_90'>('general');
  const [employmentStatus, setEmploymentStatus] = useState<EmploymentStatus>('foallasu');
  const [isSkilledActivity, setIsSkilledActivity] = useState(false);

  const comparison = useMemo(
    () => compareTaxForms(revenue, costs, kivet, costCategory, 12, params, employmentStatus, isSkilledActivity),
    [revenue, costs, kivet, costCategory, params, employmentStatus, isSkilledActivity]
  );

  const bestForm = comparison.find(c => c.isBest);
  const maxTax = Math.max(...comparison.map(c => c.totalTax));

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to={`/eaisybooks/${id}/${dateRange}/ev?year=${taxYear}`} className="hover:text-indigo-600 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> EV Főoldal
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-900 dark:text-slate-100 font-medium">Adóforma-összehasonlítás</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/25">
            <Scale className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Adóforma-összehasonlítás</h1>
            <p className="text-sm text-slate-500">{client?.name || 'Ügyfél'} — {taxYear}. adóév</p>
          </div>
        </div>
        <select
          value={taxYear}
          onChange={e => ((y) => { setDateFrom(new Date(y, 0, 1)); setDateTo(new Date(y, 11, 31)); })(Number(e.target.value))}
          className="text-sm border border-border rounded-lg px-3 py-1.5 bg-card text-foreground"
        >
          <option value={2026}>2026</option>
          <option value={2025}>2025</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Inputs */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-card rounded-xl border border-border shadow-soft p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-indigo-600" /> Bemeneti adatok
            </h2>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Éves bevétel (Ft)</label>
              <Input type="number" min={0} value={revenue} onChange={e => setRevenue(Math.max(0, Number(e.target.value)))} className="bg-card font-mono" />
              <input type="range" min={0} max={60_000_000} step={100_000} value={revenue} onChange={e => setRevenue(Number(e.target.value))} className="w-full accent-indigo-600" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Ténylegesen felmerülő költségek (VSZJA-hoz)</label>
              <Input type="number" min={0} value={costs} onChange={e => setCosts(Math.max(0, Number(e.target.value)))} className="bg-card font-mono" />
              <input type="range" min={0} max={Math.max(revenue, 30_000_000)} step={100_000} value={costs} onChange={e => setCosts(Number(e.target.value))} className="w-full accent-indigo-600" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Vállalkozói kivét (VSZJA-hoz)</label>
              <Input type="number" min={0} value={kivet} onChange={e => setKivet(Math.max(0, Number(e.target.value)))} className="bg-card font-mono" />
              <input type="range" min={0} max={Math.max(revenue, 20_000_000)} step={100_000} value={kivet} onChange={e => setKivet(Number(e.target.value))} className="w-full accent-indigo-600" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Átalány költséghányad</label>
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  { value: 'general' as const, label: `${params.atalanyKoltseghanyadGeneral * 100}%` },
                  { value: 'high_80' as const, label: '80%' },
                  { value: 'retail_90' as const, label: '90%' },
                ]).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setCostCategory(opt.value)}
                    className={cn(
                      'py-2 rounded-lg border text-xs font-medium transition-all',
                      costCategory === opt.value
                        ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700'
                        : 'border-border text-slate-500'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Foglalkoztatási státusz</label>
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  { value: 'foallasu' as EmploymentStatus, label: 'Főfoglalk.' },
                  { value: 'mellekallasu' as EmploymentStatus, label: 'Mellékáll.' },
                  { value: 'kiegeszito' as EmploymentStatus, label: 'Kiegészítő' },
                ]).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setEmploymentStatus(opt.value)}
                    className={cn(
                      'py-2 rounded-lg border text-xs font-medium transition-all',
                      employmentStatus === opt.value
                        ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700'
                        : 'border-border text-slate-500'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {employmentStatus === 'foallasu' && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSkilledActivity}
                  onChange={e => setIsSkilledActivity(e.target.checked)}
                  className="rounded border-border accent-indigo-600"
                />
                <span className="text-xs text-slate-600 dark:text-slate-400">Szakképzettséget igénylő főtevékenység</span>
              </label>
            )}
          </div>
        </div>

        {/* Comparison cards */}
        <div className="lg:col-span-8 space-y-4">
          {/* Winner banner */}
          {bestForm && (
            <div className={cn(
              'rounded-xl p-4 flex items-center gap-3',
              FORM_COLORS[bestForm.form].bg,
              'border border-current/10'
            )}>
              <Crown className={cn('w-5 h-5', FORM_COLORS[bestForm.form].text)} />
              <div>
                <p className={cn('text-sm font-bold', FORM_COLORS[bestForm.form].text)}>
                  Ajánlott forma: {bestForm.label}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Legalacsonyabb összesített adóteher: {formatHuf(bestForm.totalTax)} ({formatPercent(bestForm.effectiveRate)} effektív ráta)
                </p>
              </div>
            </div>
          )}

          {/* Three comparison cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {comparison.map(form => {
              const colors = FORM_COLORS[form.form];
              const barWidth = maxTax > 0 ? (form.totalTax / maxTax) * 100 : 0;
              return (
                <div
                  key={form.form}
                  className={cn(
                    'bg-card rounded-xl border-2 shadow-soft p-5 space-y-4 transition-all',
                    form.isBest ? 'border-green-400 ring-2 ring-green-200/50' : 'border-border'
                  )}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn('p-1.5 rounded-lg bg-gradient-to-br text-white', colors.gradient)}>
                        {FORM_ICONS[form.form]}
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{form.label}</h3>
                    </div>
                    {form.isBest && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 text-[10px] font-bold">
                        <Check className="w-3 h-3" /> Legjobb
                      </span>
                    )}
                  </div>

                  {/* Total */}
                  <div className="text-center pt-2">
                    <p className="text-xs text-slate-500 mb-1">Összesített adóteher</p>
                    <p className={cn('text-2xl font-bold', colors.text)}>{formatHuf(form.totalTax)}</p>
                    <p className="text-xs text-slate-400 mt-1">Eff. ráta: {formatPercent(form.effectiveRate)}</p>
                  </div>

                  {/* Bar */}
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-500', colors.gradient)}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>

                  {/* Detail breakdown */}
                  <div className="space-y-1.5 pt-2 border-t border-border/50">
                    {form.form === 'atalany' && (
                      <>
                        <DetailRow label="Jövedelem" value={formatHuf(form.details.income)} />
                        <DetailRow label={`Költséghányad (${formatPercent(form.details.costRatio)})`} value={formatHuf(form.details.revenue * form.details.costRatio)} />
                        <DetailRow label="SZJA" value={formatHuf(form.details.szja)} bold />
                        {employmentStatus !== 'kiegeszito' && (
                          <>
                            <div className="border-t border-border/30 my-1.5" />
                            <DetailRow label="TB-járulék (18,5%)" value={formatHuf(form.details.tbJarulek)} />
                            <DetailRow label="Szocho (13%)" value={formatHuf(form.details.szocho)} />
                            {form.details.minimumBaseApplied === 1 && (
                              <DetailRow label="⚠ Minimum-járulékalap" value={formatHuf(form.details.tbJarulekBase)} warn />
                            )}
                          </>
                        )}
                      </>
                    )}
                    {form.form === 'vszja' && (
                      <>
                        <DetailRow label="Adóalap" value={formatHuf(form.details.taxBase)} />
                        <DetailRow label="Váll. SZJA (9%)" value={formatHuf(form.details.entrepreneurialTax)} />
                        <DetailRow label="Osztalék SZJA" value={formatHuf(form.details.dividendSzja)} />
                        <DetailRow label="Osztalék szocho" value={formatHuf(form.details.dividendSzocho)} />
                        {employmentStatus !== 'kiegeszito' && (
                          <>
                            <div className="border-t border-border/30 my-1.5" />
                            <DetailRow label="TB-járulék (18,5%)" value={formatHuf(form.details.tbJarulek)} />
                            <DetailRow label="Szocho (13%)" value={formatHuf(form.details.szocho)} />
                            {form.details.minimumBaseApplied === 1 && (
                              <DetailRow label="⚠ Minimum-járulékalap" value={formatHuf(form.details.tbJarulekBase)} warn />
                            )}
                          </>
                        )}
                      </>
                    )}
                    {form.form === 'kata' && (
                      <>
                        <DetailRow label="Éves tételes adó" value={formatHuf(form.details.annualFee)} />
                        <DetailRow label="Túllépési pótlék" value={formatHuf(form.details.surcharge)} />
                        {form.details.excessRevenue > 0 && (
                          <DetailRow label="Keret fölötti" value={formatHuf(form.details.excessRevenue)} warn />
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Info */}
          <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-xl p-4 flex gap-3">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
              <p className="font-semibold">Megjegyzés</p>
              <p>Az összehasonlítás tartalmazza az adókat és a járulékokat (TB 18,5% + szocho 13%). Főfoglalkozásúaknál minimum-járulékalap érvényesül. HIPA és kamarai hozzájárulás a közteher-modulban számítandó.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, bold, warn }: { label: string; value: string; bold?: boolean; warn?: boolean }) {
  return (
    <div className="flex justify-between items-center text-xs">
      <span className={cn('text-slate-500', warn && 'text-amber-600')}>{label}</span>
      <span className={cn(
        'font-mono tabular-nums',
        bold ? 'font-bold text-slate-900 dark:text-slate-100' :
        warn ? 'text-amber-600 font-semibold' :
        'text-slate-700 dark:text-slate-300'
      )}>
        {value}
      </span>
    </div>
  );
}
