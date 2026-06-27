import React from 'react';
import { CreditCard, Gift } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface CafeteriaSettingsTabProps {
  cafeEnabled: boolean;
  setCafeEnabled: (v: boolean) => void;
  cafeAnnualBudget: string;
  setCafeAnnualBudget: (v: string) => void;
  szepSzallas: string;
  setSzepSzallas: (v: string) => void;
  szepVendeglatas: string;
  setSzepVendeglatas: (v: string) => void;
  szepSzabadido: string;
  setSzepSzabadido: (v: string) => void;
  cafeProvider: string;
  setCafeProvider: (v: string) => void;
  cafeDeadline: string;
  setCafeDeadline: (v: string) => void;
}

export default function CafeteriaSettingsTab({
  cafeEnabled, setCafeEnabled,
  cafeAnnualBudget, setCafeAnnualBudget,
  szepSzallas, setSzepSzallas,
  szepVendeglatas, setSzepVendeglatas,
  szepSzabadido, setSzepSzabadido,
  cafeProvider, setCafeProvider,
  cafeDeadline, setCafeDeadline,
}: CafeteriaSettingsTabProps) {
  return (
    <div key="cafeteria" className="p-6 space-y-6 tab-content-enter">
      <div className="border-b border-border pb-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Cafeteria beállítások</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">SZÉP-kártya és béren kívüli juttatások konfigurálása</p>
      </div>

      <label className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl cursor-pointer">
        <input type="checkbox" checked={cafeEnabled} onChange={e => setCafeEnabled(e.target.checked)} className="w-4 h-4 rounded" />
        <div>
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Cafeteria modul aktív</p>
          <p className="text-xs text-slate-500">Béren kívüli juttatások kezelése a bérszámfejtésben</p>
        </div>
      </label>

      {cafeEnabled && (
        <>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">Éves keret</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-slate-500">Éves cafeteria keret (Ft/fő)</label>
                <Input value={cafeAnnualBudget} onChange={e => setCafeAnnualBudget(e.target.value)} className="bg-card border-border font-mono" />
                <p className="text-[10px] text-slate-400">Szja tv. 71. § — évi 450 000 Ft kedvezményes</p>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-slate-500">Feltöltés napja (hónap)</label>
                <Input value={cafeDeadline} onChange={e => setCafeDeadline(e.target.value)} className="bg-card border-border" />
                <p className="text-[10px] text-slate-400">Hónap hányadik napjáig kell feltölteni</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2"><CreditCard className="w-4 h-4" /> SZÉP-kártya alszámlák</h3>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Szálláshely', value: szepSzallas, setter: setSzepSzallas, max: '150 000', color: 'text-blue-600' },
                { label: 'Vendéglátás', value: szepVendeglatas, setter: setSzepVendeglatas, max: '150 000', color: 'text-orange-600' },
                { label: 'Szabadidő', value: szepSzabadido, setter: setSzepSzabadido, max: '75 000', color: 'text-emerald-600' },
              ].map(sub => (
                <div key={sub.label} className="space-y-2">
                  <label className={cn('text-xs font-bold', sub.color)}>{sub.label}</label>
                  <Input value={sub.value} onChange={e => sub.setter(e.target.value)} className="bg-card border-border font-mono" />
                  <p className="text-[10px] text-slate-400">Max: {sub.max} Ft/év (kedvezményes)</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">SZÉP-kártya szolgáltató</h3>
            <div className="flex gap-3">
              {[
                { value: 'otp', label: 'OTP SZÉP', desc: 'OTP Cafeteria Kft.' },
                { value: 'kh', label: 'K&H SZÉP', desc: 'K&H Csoportos SZÉP' },
                { value: 'mkb', label: 'MBH SZÉP', desc: 'MBH Bank SZÉP' },
              ].map(prov => (
                <button key={prov.value} onClick={() => setCafeProvider(prov.value)}
                  className={cn('flex-1 p-4 rounded-xl border-2 transition-all text-center', cafeProvider === prov.value ? 'border-primary/30 bg-accent-subtle/50 dark:bg-accent' : 'border-border hover:border-slate-300')}>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{prov.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{prov.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg p-3 text-sm text-blue-800 dark:text-blue-300">
            <Gift className="w-4 h-4 inline mr-1" />
            <strong>2026-os szabályok:</strong> SZÉP-kártya juttatás kedvezményes közteherrel (15% SZJA + 13% SZOCHO) adható évi 450 000 Ft-ig. E felett a teljes közteher (15% SZJA + 13% SZOCHO a bruttósított összeg után) terheli a munkáltatót.
          </div>
        </>
      )}
    </div>
  );
}
