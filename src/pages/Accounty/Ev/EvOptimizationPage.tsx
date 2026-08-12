import React, { useState, useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  Lightbulb, ArrowLeft, ChevronRight, Info, TrendingDown,
  CheckCircle2, ArrowRight, Star, Calculator, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccountyClient, useEvTaxParams } from '@/hooks/accounty';
import {
  formatHuf, formatPercent,
  compareTaxForms, calculateFlatRateIncome,
  calculateEntrepreneurialTax, calculateKata,
  DEFAULT_2026_PARAMS, DEFAULT_2025_PARAMS, type TaxFormComparison
} from '@/lib/evCalculations';

// ─── Component ──────────────────────────────────────────────────────────────

export default function EvOptimizationPage() {
  const { companyId, dateRange } = useParams<{ companyId: string; dateRange: string }>();
  const id = companyId;
  const [searchParams] = useSearchParams();
  const taxYear = Number(searchParams.get('year') || '2026');
  const { data: client } = useAccountyClient(id);

  const { data: dbParams } = useEvTaxParams(taxYear);
  const params = dbParams || (taxYear === 2026 ? DEFAULT_2026_PARAMS : DEFAULT_2025_PARAMS);

  const [revenue, setRevenue] = useState(24_000_000);
  const [costs, setCosts] = useState(8_000_000);
  const [kivet, setKivet] = useState(4_800_000);

  const comparisons = useMemo(() =>
    compareTaxForms(revenue, costs, kivet, 'general', 12, params),
    [revenue, costs, kivet, params]
  );

  const best = comparisons.find(c => c.isBest);
  const maxSaving = best
    ? Math.max(...comparisons.filter(c => !c.isBest).map(c => c.totalTax)) - best.totalTax
    : 0;

  // Optimization suggestions
  const suggestions = useMemo(() => {
    const tips: { title: string; description: string; saving: number; priority: 'high' | 'medium' | 'low' }[] = [];

    // Check if switching forms would save
    const current = comparisons.find(c => c.form === 'atalany');
    const bestAlt = comparisons.filter(c => c.form !== 'atalany').sort((a, b) => a.totalTax - b.totalTax)[0];
    if (current && bestAlt && bestAlt.totalTax < current.totalTax) {
      tips.push({
        title: `Váltás ${bestAlt.label}-ra`,
        description: `Az aktuális átalányadóhoz képest a ${bestAlt.label} kedvezőbb lenne`,
        saving: current.totalTax - bestAlt.totalTax,
        priority: 'high',
      });
    }

    // KATA check
    if (revenue <= 18_000_000) {
      tips.push({
        title: 'KATA jogosultság',
        description: 'Éves bevétel 18M Ft alatt – KATA alkalmazható, fix havi 50.000 Ft adóteherrel',
        saving: Math.max(0, (comparisons.find(c => c.form === 'atalany')?.totalTax || 0) - (comparisons.find(c => c.form === 'kata')?.totalTax || 0)),
        priority: revenue <= 12_000_000 ? 'high' : 'medium',
      });
    }

    // Cost ratio optimization
    if (costs / revenue < 0.3) {
      tips.push({
        title: 'Költségarány növelése',
        description: 'A tényleges költségarány alacsony (< 30%). Érdemes átgondolni a költségszerkezetet – pl. eszközbeszerzés, irodabérlet.',
        saving: 0,
        priority: 'medium',
      });
    }

    // TB minimum base
    tips.push({
      title: 'Mellékfoglalkozás ellenőrzése',
      description: 'Mellékfoglalkozású EV-nak nincs havi minimum járulékalapja – ha más munkaviszony is van, jelentős megtakarítás.',
      saving: 0,
      priority: 'low',
    });

    // VAT exemption
    if (revenue >= 16_000_000 && revenue <= 20_000_000) {
      tips.push({
        title: 'ÁFA alanyi mentesség határ',
        description: `Bevétel közel az alanyi mentesség határához (${formatHuf(params.afaAlanyiHatar)}). Ügyeljen a bevétel-tervezésre.`,
        saving: 0,
        priority: 'medium',
      });
    }

    return tips;
  }, [revenue, costs, comparisons, params]);

  const FORM_COLORS: Record<string, string> = {
    atalany: 'from-blue-500 to-indigo-600',
    vszja: 'from-emerald-500 to-green-600',
    kata: 'from-purple-500 to-violet-600',
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/accounty?tab=ev" className="hover:text-indigo-600 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> EV Portfólió
        </Link>
        <ChevronRight className="w-3 h-3" />
        <Link to={`/accounty/${id}/${dateRange}/ev?year=${taxYear}`} className="hover:text-indigo-600 transition-colors">
          {client?.name || 'Ügyfél'}
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-900 dark:text-slate-100 font-medium">Adóoptimalizálás</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-xl shadow-lg shadow-yellow-500/25">
          <Lightbulb className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Adóoptimalizálás</h1>
          <p className="text-sm text-slate-500">AI-támogatott javaslatok az adóteher csökkentéséhez</p>
        </div>
      </div>

      {/* Input */}
      <div className="bg-card rounded-xl border border-border shadow-soft p-5">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <Calculator className="w-4 h-4 text-amber-600" /> Alapadatok módosítása
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Éves bevétel (Ft)</label>
            <input
              type="number"
              value={revenue}
              onChange={e => setRevenue(+e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm font-mono tabular-nums text-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Ténylegesen felmerült költségek (Ft)</label>
            <input
              type="number"
              value={costs}
              onChange={e => setCosts(+e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm font-mono tabular-nums text-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Vállalkozói kivét (Ft)</label>
            <input
              type="number"
              value={kivet}
              onChange={e => setKivet(+e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm font-mono tabular-nums text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>
      </div>

      {/* Comparison */}
      <div>
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">Adóforma összehasonlítás</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {comparisons.map(c => (
            <div key={c.form} className={cn(
              'rounded-xl border-2 shadow-soft overflow-hidden transition-all',
              c.isBest ? 'border-green-500 ring-2 ring-green-500/20' : 'border-border'
            )}>
              {c.isBest && (
                <div className="bg-green-500 text-white text-[10px] font-bold text-center py-1 flex items-center justify-center gap-1">
                  <Star className="w-3 h-3" /> LEGKEDVEZŐBB
                </div>
              )}
              <div className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className={cn('w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center', FORM_COLORS[c.form])}>
                    <Calculator className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{c.label}</h3>
                </div>
                <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mb-1">
                  {formatHuf(c.totalTax)}
                </p>
                <p className="text-xs text-slate-500">
                  Effektív kulcs: <span className="font-semibold">{formatPercent(c.effectiveRate)}</span>
                </p>
                <div className="mt-3 pt-3 border-t border-border space-y-1">
                  {Object.entries(c.details).map(([key, val]) => (
                    <div key={key} className="flex justify-between text-xs">
                      <span className="text-slate-500">{key}</span>
                      <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {typeof val === 'number' && val > 1 ? formatHuf(val) : formatPercent(val as number)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Savings highlight */}
      {maxSaving > 0 && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200 dark:border-green-800 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500 rounded-lg">
              <TrendingDown className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-green-700 dark:text-green-400">
                Lehetséges megtakarítás: {formatHuf(maxSaving)}/év
              </p>
              <p className="text-xs text-green-600/80 dark:text-green-500/80">
                A {best?.label} alkalmazásával a legmagasabb adóteherhez képest
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Suggestions */}
      <div>
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" /> Optimalizálási javaslatok
        </h2>
        <div className="space-y-3">
          {suggestions.map((tip, i) => (
            <div key={i} className={cn(
              'bg-card rounded-xl border shadow-soft px-5 py-4 flex items-start gap-4',
              tip.priority === 'high' ? 'border-green-200 dark:border-green-800'
                : tip.priority === 'medium' ? 'border-amber-200 dark:border-amber-800'
                : 'border-border'
            )}>
              <div className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
                tip.priority === 'high' ? 'bg-green-100 dark:bg-green-900/30 text-green-600'
                  : tip.priority === 'medium' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
              )}>
                <Lightbulb className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{tip.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{tip.description}</p>
              </div>
              {tip.saving > 0 && (
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-green-600 font-mono tabular-nums">{formatHuf(tip.saving)}</p>
                  <p className="text-[10px] text-slate-400">megtakarítás/év</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
            <p className="font-semibold">Fontos megjegyzés</p>
            <p>Az adóoptimalizálási javaslatok tájékoztató jellegűek. A tényleges adóteher a jogszabályi feltételek, kedvezmények és egyéni körülmények alapján eltérhet. Mindig konzultáljon könyvelőjével a döntés előtt.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
