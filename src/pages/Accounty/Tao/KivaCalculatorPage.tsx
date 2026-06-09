import React, { useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Calculator, TrendingUp, Users, Landmark, Info, BarChart2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAccountyClients } from '@/hooks/useAccountyData';

const fmt = (n: number) => new Intl.NumberFormat('hu-HU', { style: 'decimal', maximumFractionDigits: 0 }).format(n);

function NumberInput({ value, onChange, label, hint }: {
  value: number; onChange: (v: number) => void; label: string; hint?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">
        {label}
        {hint && <span className="ml-1 text-slate-400 font-normal">({hint})</span>}
      </label>
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

export default function KivaCalculatorPage() {
  const { id } = useParams<{ id: string }>();
  const { data: clients = [] } = useAccountyClients();
  const client = clients.find((c: any) => c.companyId === id);

  const [data, setData] = useState({
    // Személyi jellegű ráfordítások
    gross_wages: 0,            // Bruttó bérek
    employer_contributions: 0, // Munkáltatói járulékok (SZOCHO)
    other_personnel: 0,        // Egyéb személyi jellegű kifizetések

    // Osztalék
    dividend_paid: 0,          // Jóváhagyott osztalék

    // Tőke-elemek
    equity_increase: 0,        // Saját tőke növekedése
    equity_decrease: 0,        // Saját tőke csökkenése

    // Korrekciók
    depreciation_diff: 0,      // ÉCS különbözet korrekció
    other_correction: 0,       // Egyéb korrekció
  });

  const upd = (key: string, val: number) =>
    setData(prev => ({ ...prev, [key]: val }));

  const computed = useMemo(() => {
    const personnelTotal = data.gross_wages + data.employer_contributions + data.other_personnel;
    const capitalChange = data.equity_decrease - data.equity_increase;
    const corrections = data.depreciation_diff + data.other_correction;

    // KIVA adóalap = személyi jellegű kifizetések + osztalék + tőkeelem változás + korrekciók
    const kivaBase = Math.max(0, personnelTotal + data.dividend_paid + capitalChange + corrections);

    // KIVA kulcs 2026: 10%
    const kivaRate = 0.10;
    const kivaTax = Math.round(kivaBase * kivaRate);

    // Minimum adóalap: személyi jellegű kifizetések
    const minBase = personnelTotal;
    const effectiveBase = Math.max(kivaBase, minBase);
    const effectiveTax = Math.round(effectiveBase * kivaRate);

    return {
      personnelTotal,
      capitalChange,
      corrections,
      kivaBase,
      minBase,
      effectiveBase,
      kivaTax,
      effectiveTax,
      kivaRate,
    };
  }, [data]);

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={`/accounty/client/${id}/tao`} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft className="w-4 h-4 text-slate-400" />
        </Link>
        <div className="p-2.5 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl shadow-lg shadow-orange-500/25">
          <Calculator className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">KIVA Kalkulátor</h1>
          <p className="text-sm text-slate-500">{client?.name || 'Ügyfél'} — Kisvállalati adó szimuláció</p>
        </div>
        <Link to={`/accounty/client/${id}/tao/compare`}>
          <Button variant="outline" size="sm" className="gap-1.5">
            <BarChart2 className="w-3.5 h-3.5" /> TAO összehasonlítás
          </Button>
        </Link>
      </div>

      {/* Info */}
      <div className="flex items-start gap-2 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
        <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="text-xs text-amber-700 dark:text-amber-300">
          <strong>KIVA</strong> (Kisvállalati adó, 2012. évi CXLVII. tv.) — a kisvállalati adó mértéke <strong>10%</strong>, adóalapja a személyi jellegű kifizetések + tőkeelemek változása.
          Választható ha az árbevétel &lt; 3 milliárd Ft és a létszám &lt; 50 fő.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input */}
        <div className="lg:col-span-2 space-y-5">
          {/* Személyi jellegű kifizetések */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-soft space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              Személyi jellegű ráfordítások
            </h2>
            <NumberInput label="Bruttó munkabérek" value={data.gross_wages} onChange={v => upd('gross_wages', v)} />
            <NumberInput label="Munkáltatói járulékok (SZOCHO, stb.)" value={data.employer_contributions} onChange={v => upd('employer_contributions', v)} />
            <NumberInput label="Egyéb személyi jellegű kifizetések" value={data.other_personnel} onChange={v => upd('other_personnel', v)} />
            <div className="flex items-center justify-between py-2 px-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <span className="text-xs font-bold text-blue-700 dark:text-blue-300">Összesen:</span>
              <span className="text-sm font-black text-blue-600">{fmt(computed.personnelTotal)} Ft</span>
            </div>
          </div>

          {/* Osztalék */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-soft space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Landmark className="w-4 h-4 text-purple-600" />
              Osztalék és tőke-elemek
            </h2>
            <NumberInput label="Jóváhagyott osztalék" value={data.dividend_paid} onChange={v => upd('dividend_paid', v)} hint="növelő" />
            <NumberInput label="Saját tőke növekedése" value={data.equity_increase} onChange={v => upd('equity_increase', v)} hint="csökkentő" />
            <NumberInput label="Saját tőke csökkenése" value={data.equity_decrease} onChange={v => upd('equity_decrease', v)} hint="növelő" />
          </div>

          {/* Korrekciók */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-soft space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-600" />
              Korrekciós tételek
            </h2>
            <NumberInput label="Értékcsökkenési leírás különbözet" value={data.depreciation_diff} onChange={v => upd('depreciation_diff', v)} />
            <NumberInput label="Egyéb korrekció" value={data.other_correction} onChange={v => upd('other_correction', v)} />
          </div>
        </div>

        {/* Sidebar — Result */}
        <div className="lg:col-span-1">
          <div className="bg-card rounded-xl border border-border p-5 shadow-soft sticky top-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-orange-600" /> KIVA Eredmény
            </h3>

            <div className="space-y-2">
              {[
                { label: 'Személyi ráford.', value: computed.personnelTotal },
                { label: '+ Osztalék', value: data.dividend_paid },
                { label: '+ Tőke-elemek', value: computed.capitalChange },
                { label: '+ Korrekciók', value: computed.corrections },
              ].map((row, i) => (
                <div key={i} className="flex items-center justify-between py-1">
                  <span className="text-xs text-slate-500">{row.label}</span>
                  <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">{fmt(row.value)}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-border pt-3">
              <div className="flex items-center justify-between py-1">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">KIVA adóalap</span>
                <span className="text-sm font-black text-orange-600">{fmt(computed.effectiveBase)} Ft</span>
              </div>
              {computed.kivaBase < computed.minBase && (
                <p className="text-[10px] text-amber-600 mt-1">
                  ⚠ Minimum adóalap alkalmazva (= személyi kifizetések)
                </p>
              )}
            </div>

            <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-xl p-4 border border-orange-200 dark:border-orange-800">
              <p className="text-[10px] text-slate-500 mb-1">Fizetendő KIVA (10%)</p>
              <p className="text-2xl font-black text-orange-600">{fmt(computed.effectiveTax)} Ft</p>
            </div>

            <div className="pt-2">
              <Link to={`/accounty/client/${id}/tao/compare`}>
                <Button variant="outline" className="w-full gap-2">
                  <BarChart2 className="w-4 h-4" /> TAO vs KIVA összehasonlítás
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
