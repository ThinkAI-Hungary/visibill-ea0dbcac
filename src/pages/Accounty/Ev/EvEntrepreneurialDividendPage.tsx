import React, { useState, useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  Wallet, ArrowLeft, ChevronRight, Calculator,
  Info, PieChart, ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccountyClient, useEvTaxParams } from '@/hooks/accounty';
import { formatHuf, formatPercent, DEFAULT_2026_PARAMS, DEFAULT_2025_PARAMS } from '@/lib/evCalculations';

// ─── Component ──────────────────────────────────────────────────────────────

export default function EvEntrepreneurialDividendPage() {
  const { id } = useParams<{ id: string }>();
  const { data: client } = useAccountyClient(id);
  const [searchParams] = useSearchParams();
  const yearParam = Number(searchParams.get('year') || '2026');
  const [taxYear, setTaxYear] = useState(yearParam);

  const { data: dbParams } = useEvTaxParams(taxYear);
  const params = dbParams || (taxYear === 2026 ? DEFAULT_2026_PARAMS : DEFAULT_2025_PARAMS);

  const [entrepreneurialIncome, setEntrepreneurialIncome] = useState(16_800_000);
  const [entrepreneurialTaxPaid, setEntrepreneurialTaxPaid] = useState(1_512_000);
  const [sochoPaid, setSochoPaid] = useState(2_184_000);
  const [personalWithdrawal, setPersonalWithdrawal] = useState(12_000_000);
  const [retainedEarnings, setRetainedEarnings] = useState(1_104_000);

  const dividendBase = entrepreneurialIncome - entrepreneurialTaxPaid;
  const dividendSzja = Math.round(dividendBase * params.szjaRate);
  const dividendSzocho = Math.round(dividendBase * params.szochoKulcs);
  const totalDividendTax = dividendSzja + dividendSzocho;
  const netDividend = dividendBase - totalDividendTax;
  const totalTaxBurden = entrepreneurialTaxPaid + sochoPaid + totalDividendTax;
  const effectiveRate = entrepreneurialIncome > 0 ? (totalTaxBurden / entrepreneurialIncome) * 100 : 0;

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/accounty/ev" className="hover:text-indigo-600 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> EV Portfólió
        </Link>
        <ChevronRight className="w-3 h-3" />
        <Link to={`/accounty/client/${id}/ev?year=${taxYear}`} className="hover:text-indigo-600 transition-colors">
          {client?.name || 'Ügyfél'}
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-900 dark:text-slate-100 font-medium">VSZJA – Osztalékalap</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-xl shadow-lg shadow-violet-500/25">
          <Wallet className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Vállalkozói osztalékalap</h1>
          <p className="text-sm text-slate-500">Szja tv. 49/C.§ – vállalkozói kivét és osztalékalap számítás</p>
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
                <label className="text-xs font-medium text-slate-500 block mb-1">Vállalkozói jövedelem (Ft)</label>
                <input
                  type="number"
                  value={entrepreneurialIncome}
                  onChange={e => setEntrepreneurialIncome(Number(e.target.value))}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-card text-foreground font-mono tabular-nums text-right"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Megfizetett vállalkozói SZJA (Ft)</label>
                <input
                  type="number"
                  value={entrepreneurialTaxPaid}
                  onChange={e => setEntrepreneurialTaxPaid(Number(e.target.value))}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-card text-foreground font-mono tabular-nums text-right"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Megfizetett szocho (Ft)</label>
                <input
                  type="number"
                  value={sochoPaid}
                  onChange={e => setSochoPaid(Number(e.target.value))}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-card text-foreground font-mono tabular-nums text-right"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Vállalkozói kivét (éves) (Ft)</label>
                <input
                  type="number"
                  value={personalWithdrawal}
                  onChange={e => setPersonalWithdrawal(Number(e.target.value))}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-card text-foreground font-mono tabular-nums text-right"
                />
              </div>
            </div>
          </div>

          <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-violet-600 mt-0.5 shrink-0" />
              <div className="text-xs text-violet-600 dark:text-violet-400 space-y-1">
                <p className="font-semibold">Osztalékalap szabályok</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Osztalékalap = Váll. jövedelem – megfizetett SZJA</li>
                  <li>SZJA: {formatPercent(params.szjaRate)}</li>
                  <li>Szocho: {formatPercent(params.szochoKulcs)}</li>
                  <li>A kivét nem csökkenti az osztalékalapot</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
              <p className="text-xs text-slate-500 mb-1">Osztalékalap</p>
              <p className="text-lg font-bold text-violet-600 tabular-nums">{formatHuf(dividendBase)}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
              <p className="text-xs text-slate-500 mb-1">Osztalék adó</p>
              <p className="text-lg font-bold text-red-500 tabular-nums">{formatHuf(totalDividendTax)}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
              <p className="text-xs text-slate-500 mb-1">Nettó osztalék</p>
              <p className="text-lg font-bold text-green-600 tabular-nums">{formatHuf(netDividend)}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
              <p className="text-xs text-slate-500 mb-1">Teljes adóráta</p>
              <p className="text-lg font-bold text-indigo-600 tabular-nums">{effectiveRate.toFixed(1)}%</p>
            </div>
          </div>

          {/* Calculation */}
          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <div className="px-5 py-3 border-b border-border/50">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Osztalékalap részletezése</h2>
            </div>
            <div className="divide-y divide-border">
              <Row label="Vállalkozói jövedelem" value={formatHuf(entrepreneurialIncome)} />
              <Row label="(-) Megfizetett vállalkozói SZJA" value={formatHuf(entrepreneurialTaxPaid)} negative />
              <Row label="(=) Vállalkozói osztalékalap" value={formatHuf(dividendBase)} bold highlight />
              <div className="h-2 bg-slate-50 dark:bg-slate-800/30" />
              <Row label={`SZJA (${formatPercent(params.szjaRate)})`} value={formatHuf(dividendSzja)} />
              <Row label={`Szocho (${formatPercent(params.szochoKulcs)})`} value={formatHuf(dividendSzocho)} />
              <Row label="Osztalék adóteher összesen" value={formatHuf(totalDividendTax)} bold />
              <div className="h-2 bg-slate-50 dark:bg-slate-800/30" />
              <Row label="Nettó osztalék" value={formatHuf(netDividend)} bold highlight />
            </div>
          </div>

          {/* Teljes adóteher összesítés */}
          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <div className="px-5 py-3 border-b border-border/50 bg-slate-50/50 dark:bg-slate-800/20">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <PieChart className="w-4 h-4 text-violet-600" />
                Összes adóteher összesítés
              </h2>
            </div>
            <div className="divide-y divide-border">
              <Row label="Vállalkozói SZJA (I. lépcső)" value={formatHuf(entrepreneurialTaxPaid)} />
              <Row label="Szocho (I. lépcső)" value={formatHuf(sochoPaid)} />
              <Row label="Osztalék SZJA (II. lépcső)" value={formatHuf(dividendSzja)} />
              <Row label="Osztalék szocho (II. lépcső)" value={formatHuf(dividendSzocho)} />
              <Row
                label="TELJES ADÓTEHER"
                value={formatHuf(totalTaxBurden)}
                bold
                highlight
              />
              <div className="px-5 py-3 bg-violet-50/50 dark:bg-violet-900/10">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-violet-700 dark:text-violet-400">Effektív adóráta a bruttó jövedelemre</span>
                  <span className="text-lg font-bold font-mono tabular-nums text-violet-600">{effectiveRate.toFixed(1)}%</span>
                </div>
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
        bold ? 'font-bold' : '',
        negative ? 'text-red-600' : 'text-slate-700 dark:text-slate-300',
        highlight && 'text-violet-600 font-bold'
      )}>
        {negative ? `- ${value}` : value}
      </span>
    </div>
  );
}
