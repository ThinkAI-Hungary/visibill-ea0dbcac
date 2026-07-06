import React, { useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  TrendingUp, ArrowLeft, ChevronRight, Calculator,
  FileText, AlertTriangle, Info, ChevronDown, ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccountyClient } from '@/hooks/accounty';
import {
  calculateEntrepreneurialTax, formatHuf, formatPercent,
  DEFAULT_2026_PARAMS
} from '@/lib/evCalculations';

// ─── Component ──────────────────────────────────────────────────────────────

export default function EvEntrepreneurialBasePage() {
  const { id } = useParams<{ id: string }>();
  const { data: client } = useAccountyClient(id);

  const [revenue, setRevenue] = useState(32_000_000);
  const [costs, setCosts] = useState(14_400_000);
  const [otherIncome, setOtherIncome] = useState(0);
  const [employerCosts, setEmployerCosts] = useState(2_880_000);
  const [depreciationTotal, setDepreciationTotal] = useState(800_000);
  const [kivet, setKivet] = useState(4_000_000);

  // Total deductible = costs + depreciation + employer costs
  const totalDeductible = costs + depreciationTotal + employerCosts;

  const result = useMemo(() => calculateEntrepreneurialTax(
    revenue + otherIncome,
    totalDeductible,
    kivet,
    0,
    DEFAULT_2026_PARAMS,
  ), [revenue, otherIncome, totalDeductible, kivet]);

  const netIncome = revenue - costs;
  const taxableBase = result.taxBase;
  const totalTax = result.totalTax;
  const effectiveTaxRate = revenue > 0 ? (totalTax / revenue) * 100 : 0;

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
        <span className="text-slate-900 dark:text-slate-100 font-medium">Vállalkozói SZJA – Adóalap</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-violet-500/25">
          <TrendingUp className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Vállalkozói SZJA – Adóalap számítás</h1>
          <p className="text-sm text-slate-500">Szja tv. 49/B.§ szerinti adóalap-megállapítás – {client?.name || 'Ügyfél'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Inputs */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-card rounded-xl border border-border shadow-soft p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-violet-600" />
              Bemeneti adatok
            </h2>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Vállalkozói bevétel (Ft)</label>
                <input
                  type="number"
                  value={revenue}
                  onChange={e => setRevenue(Number(e.target.value) || 0)}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-card text-foreground font-mono tabular-nums text-right"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Elismert költségek (Ft)</label>
                <input
                  type="number"
                  value={costs}
                  onChange={e => setCosts(Number(e.target.value) || 0)}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-card text-foreground font-mono tabular-nums text-right"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Egyéb bevételek (Ft)</label>
                <input
                  type="number"
                  value={otherIncome}
                  onChange={e => setOtherIncome(Number(e.target.value) || 0)}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-card text-foreground font-mono tabular-nums text-right"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Foglalkoztatói költségek (Ft)</label>
                <input
                  type="number"
                  value={employerCosts}
                  onChange={e => setEmployerCosts(Number(e.target.value) || 0)}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-card text-foreground font-mono tabular-nums text-right"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Értékcsökkenési leírás (Ft)</label>
                <input
                  type="number"
                  value={depreciationTotal}
                  onChange={e => setDepreciationTotal(Number(e.target.value) || 0)}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-card text-foreground font-mono tabular-nums text-right"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Vállalkozói kivét (Ft)</label>
                <input
                  type="number"
                  value={kivet}
                  onChange={e => setKivet(Number(e.target.value) || 0)}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-card text-foreground font-mono tabular-nums text-right"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">A vállalkozó személyes felhasználásra kivett összeg (SZJA-köteles jövedelem)</p>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                <p className="font-semibold">Vállalkozói SZJA szabályok (2026)</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Vállalkozói SZJA mértéke: {formatPercent(DEFAULT_2026_PARAMS.vszjaRate)}</li>
                  <li>Osztalékalap SZJA: {formatPercent(DEFAULT_2026_PARAMS.szjaRate)}</li>
                  <li>Szocho mértéke: {formatPercent(DEFAULT_2026_PARAMS.szochoKulcs)}</li>
                  <li>Költségarány tételesen igazolva</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
              <p className="text-xs text-slate-500 mb-1">Vállalkozói bevétel</p>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums">{formatHuf(revenue)}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
              <p className="text-xs text-slate-500 mb-1">Nettó jövedelem</p>
              <p className="text-lg font-bold text-green-600 tabular-nums">{formatHuf(netIncome)}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
              <p className="text-xs text-slate-500 mb-1">Adóalap</p>
              <p className="text-lg font-bold text-violet-600 tabular-nums">{formatHuf(taxableBase)}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
              <p className="text-xs text-slate-500 mb-1">Összes adóteher</p>
              <p className="text-lg font-bold text-red-500 tabular-nums">{formatHuf(totalTax)}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
              <p className="text-xs text-slate-500 mb-1">Effektív adóráta</p>
              <p className="text-lg font-bold text-indigo-600 tabular-nums">{effectiveTaxRate.toFixed(1)}%</p>
            </div>
          </div>

          {/* Calculation breakdown */}
          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <div className="px-5 py-3 border-b border-border/50">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Adóalap részletezése</h2>
            </div>
            <div className="divide-y divide-border">
              <Row label="1. Vállalkozói bevétel" value={formatHuf(revenue)} />
              <Row label="2. (-) Elismert költségek" value={formatHuf(costs)} negative />
              <Row label="3. (=) Nyers jövedelem" value={formatHuf(netIncome)} bold />
              <Row label="4. (-) Értékcsökkenési leírás (ÉCS)" value={formatHuf(depreciationTotal)} negative />
              <Row label="5. (-) Foglalkoztatói költségek" value={formatHuf(employerCosts)} negative />
              <Row label="6. (+) Egyéb bevételek" value={formatHuf(otherIncome)} />
              <Row label="7. (=) Vállalkozói adóalap" value={formatHuf(taxableBase)} bold highlight />
            </div>
          </div>

          {/* Tax calculation */}
          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <div className="px-5 py-3 border-b border-border/50">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Adószámítás</h2>
            </div>
            <div className="divide-y divide-border">
              <Row label={`Vállalkozói SZJA (${formatPercent(DEFAULT_2026_PARAMS.vszjaRate)})`} value={formatHuf(result.entrepreneurialTax)} />
              <Row label="(-) Vállalkozói kivét" value={formatHuf(kivet)} negative />
              <Row label="(=) Osztalékalap" value={formatHuf(result.dividendBase)} bold />
              <Row label={`Osztalék-SZJA (${formatPercent(DEFAULT_2026_PARAMS.szjaRate)})`} value={formatHuf(result.dividendSzja)} />
              <Row label={`Szocho (${formatPercent(DEFAULT_2026_PARAMS.szochoKulcs)})`} value={formatHuf(result.dividendSzocho)} />
              <Row label="Összes adóteher" value={formatHuf(totalTax)} bold highlight />
            </div>
          </div>

          {/* Dividend base hint */}
          <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <ArrowRight className="w-4 h-4 text-violet-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-violet-700 dark:text-violet-400">Folytatás: Osztalékalap számítás</p>
                <p className="text-xs text-violet-600 dark:text-violet-400 mt-0.5">
                  Az adóalap-megállapítás után a vállalkozói jövedelemből osztalékalap kerül megállapításra (15% SZJA + 13% szocho).
                </p>
                <Link
                  to={`/accounty/client/${id}/ev/entrepreneurial/dividend`}
                  className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-violet-600 hover:text-violet-800 transition-colors"
                >
                  Osztalékalap számítás <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold, negative, highlight }: {
  label: string;
  value: string;
  bold?: boolean;
  negative?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className={cn(
      'flex items-center justify-between px-5 py-3',
      highlight && 'bg-violet-50/50 dark:bg-violet-900/10'
    )}>
      <span className={cn(
        'text-sm',
        bold ? 'font-bold text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'
      )}>
        {label}
      </span>
      <span className={cn(
        'text-sm font-mono tabular-nums',
        bold ? 'font-bold text-slate-900 dark:text-slate-100' : '',
        negative ? 'text-red-600' : 'text-slate-700 dark:text-slate-300',
        highlight && 'text-violet-600 font-bold'
      )}>
        {negative ? `- ${value}` : value}
      </span>
    </div>
  );
}
