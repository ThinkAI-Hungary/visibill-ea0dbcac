import React, { useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BarChart2, Calculator, CheckCircle, Info, Landmark, Scale, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAccountyClients } from '@/hooks/accounty';

const fmt = (n: number) => new Intl.NumberFormat('hu-HU', { style: 'decimal', maximumFractionDigits: 0 }).format(n);

function NumberInput({ value, onChange, label }: {
  value: number; onChange: (v: number) => void; label: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">{label}</label>
      <div className="relative">
        <Input
          type="text"
          value={value === 0 ? '' : fmt(value)}
          onChange={e => {
            const raw = e.target.value.replace(/[^\d-]/g, '');
            onChange(raw ? parseInt(raw, 10) : 0);
          }}
          className="bg-background pr-10 text-right font-mono"
          placeholder="0"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">Ft</span>
      </div>
    </div>
  );
}

export default function TaoKivaComparePage() {
  const { id } = useParams<{ id: string }>();
  const { data: clients = [] } = useAccountyClients();
  const client = clients.find((c: any) => c.companyId === id);

  const [data, setData] = useState({
    // Közös input
    revenue: 0,
    costs: 0,
    personnel_costs: 0,
    depreciation: 0,
    financial_result: 0,
    // TAO specifikus
    tao_decreasing: 0,
    tao_increasing: 0,
    tao_credits: 0,
    // KIVA specifikus
    kiva_dividend: 0,
    kiva_equity_change: 0,
  });

  const upd = (key: string, val: number) =>
    setData(prev => ({ ...prev, [key]: val }));

  const computed = useMemo(() => {
    // TAO számítás
    const aee = data.revenue - data.costs + data.financial_result;
    const taoBase = Math.max(0, aee + data.tao_increasing - data.tao_decreasing);
    const taoCalculated = Math.round(taoBase * 0.09);
    const taoPayable = Math.max(0, taoCalculated - data.tao_credits);

    // KIVA számítás
    const kivaBase = Math.max(data.personnel_costs, data.personnel_costs + data.kiva_dividend + data.kiva_equity_change);
    const kivaPayable = Math.round(kivaBase * 0.10);

    // Összterhelés (TAO: + SZOCHO 13%; KIVA: helyettesíti a SZOCHO-t)
    const szocho = Math.round(data.personnel_costs * 0.13);
    const taoTotal = taoPayable + szocho;
    const kivaTotal = kivaPayable; // KIVA kiváltja a SZOCHO-t

    const difference = taoTotal - kivaTotal;
    const winner = difference > 0 ? 'kiva' : difference < 0 ? 'tao' : 'tie';

    return {
      aee, taoBase, taoCalculated, taoPayable,
      kivaBase, kivaPayable,
      szocho, taoTotal, kivaTotal,
      difference, winner,
    };
  }, [data]);

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={`/accounty/client/${id}/tao`} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft className="w-4 h-4 text-slate-400" />
        </Link>
        <div className="p-2.5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-violet-500/25">
          <BarChart2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">TAO vs KIVA Összehasonlítás</h1>
          <p className="text-sm text-slate-500">{client?.name || 'Ügyfél'} — Melyik adónem az előnyösebb?</p>
        </div>
      </div>

      {/* Info */}
      <div className="flex items-start gap-2 p-4 bg-violet-50 dark:bg-violet-900/20 rounded-xl border border-violet-200 dark:border-violet-800">
        <Info className="w-4 h-4 text-violet-600 mt-0.5 shrink-0" />
        <p className="text-xs text-violet-700 dark:text-violet-300">
          <strong>Fontos:</strong> A KIVA kiváltja a SZOCHO-t (13%), ezért az összehasonlításnál a TAO oldalon a SZOCHO-t is hozzá kell adni a teljes terhekhez.
          A KIVA csak akkor választható, ha az árbevétel &lt; 3 milliárd Ft és a létszám &lt; 50 fő.
        </p>
      </div>

      {/* Közös input */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-soft">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <Scale className="w-4 h-4 text-violet-600" /> Közös alapadatok
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <NumberInput label="Árbevétel" value={data.revenue} onChange={v => upd('revenue', v)} />
          <NumberInput label="Költségek (összes)" value={data.costs} onChange={v => upd('costs', v)} />
          <NumberInput label="Személyi ráfordítások" value={data.personnel_costs} onChange={v => upd('personnel_costs', v)} />
          <NumberInput label="Értékcsökkenés" value={data.depreciation} onChange={v => upd('depreciation', v)} />
          <NumberInput label="Pénzügyi eredmény" value={data.financial_result} onChange={v => upd('financial_result', v)} />
        </div>
      </div>

      {/* Side-by-side comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* TAO */}
        <div className={cn(
          'rounded-xl border-2 p-6 shadow-soft transition-all',
          computed.winner === 'tao' ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10' : 'border-border bg-card'
        )}>
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <Landmark className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">TAO</h3>
              <p className="text-xs text-slate-500">Társasági adó — 9%</p>
            </div>
            {computed.winner === 'tao' && (
              <span className="ml-auto px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Előnyösebb
              </span>
            )}
          </div>

          <div className="space-y-3 mb-5">
            <NumberInput label="7.§ csökkentő tételek" value={data.tao_decreasing} onChange={v => upd('tao_decreasing', v)} />
            <NumberInput label="8.§ növelő tételek" value={data.tao_increasing} onChange={v => upd('tao_increasing', v)} />
            <NumberInput label="Adókedvezmények" value={data.tao_credits} onChange={v => upd('tao_credits', v)} />
          </div>

          <div className="space-y-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
            {[
              { label: 'AEE', value: computed.aee },
              { label: 'Adóalap', value: computed.taoBase },
              { label: 'TAO (9%)', value: computed.taoPayable },
              { label: 'SZOCHO (13%)', value: computed.szocho },
            ].map((r, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-slate-500">{r.label}</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{fmt(r.value)} Ft</span>
              </div>
            ))}
            <div className="border-t border-border pt-2 mt-2">
              <div className="flex justify-between">
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">Összterhelés</span>
                <span className="text-lg font-black text-emerald-600">{fmt(computed.taoTotal)} Ft</span>
              </div>
            </div>
          </div>
        </div>

        {/* KIVA */}
        <div className={cn(
          'rounded-xl border-2 p-6 shadow-soft transition-all',
          computed.winner === 'kiva' ? 'border-orange-400 bg-orange-50/50 dark:bg-orange-900/10' : 'border-border bg-card'
        )}>
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <Calculator className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">KIVA</h3>
              <p className="text-xs text-slate-500">Kisvállalati adó — 10%</p>
            </div>
            {computed.winner === 'kiva' && (
              <span className="ml-auto px-2.5 py-1 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Előnyösebb
              </span>
            )}
          </div>

          <div className="space-y-3 mb-5">
            <NumberInput label="Osztalék" value={data.kiva_dividend} onChange={v => upd('kiva_dividend', v)} />
            <NumberInput label="Tőke-elem változás (+/-)" value={data.kiva_equity_change} onChange={v => upd('kiva_equity_change', v)} />
            <div className="py-[22px]" /> {/* Spacer to align with TAO */}
          </div>

          <div className="space-y-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
            {[
              { label: 'Személyi ráfordítások', value: data.personnel_costs },
              { label: 'KIVA adóalap', value: computed.kivaBase },
              { label: 'KIVA (10%)', value: computed.kivaPayable },
              { label: 'SZOCHO', value: 0, note: '(kiváltja a KIVA)' },
            ].map((r, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-slate-500">
                  {r.label} {(r as any).note && <span className="text-emerald-500">{(r as any).note}</span>}
                </span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{fmt(r.value)} Ft</span>
              </div>
            ))}
            <div className="border-t border-border pt-2 mt-2">
              <div className="flex justify-between">
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">Összterhelés</span>
                <span className="text-lg font-black text-orange-600">{fmt(computed.kivaTotal)} Ft</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Verdict */}
      <div className={cn(
        'rounded-xl border-2 p-6 text-center',
        computed.winner === 'kiva' ? 'border-orange-300 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20' :
        computed.winner === 'tao' ? 'border-emerald-300 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20' :
        'border-border bg-card'
      )}>
        {computed.winner === 'tie' || (computed.taoTotal === 0 && computed.kivaTotal === 0) ? (
          <p className="text-sm text-slate-500">Töltse ki az adatokat az összehasonlításhoz</p>
        ) : (
          <>
            <div className="flex items-center justify-center gap-2 mb-2">
              {computed.winner === 'kiva' ? (
                <Calculator className="w-6 h-6 text-orange-600" />
              ) : (
                <Landmark className="w-6 h-6 text-emerald-600" />
              )}
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                A {computed.winner === 'kiva' ? 'KIVA' : 'TAO'} az előnyösebb
              </h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Megtakarítás: <strong className={computed.winner === 'kiva' ? 'text-orange-600' : 'text-emerald-600'}>
                {fmt(Math.abs(computed.difference))} Ft/év
              </strong>
            </p>
            <p className="text-xs text-slate-400 mt-1">
              TAO + SZOCHO: {fmt(computed.taoTotal)} Ft vs KIVA: {fmt(computed.kivaTotal)} Ft
            </p>
          </>
        )}
      </div>
    </div>
  );
}
