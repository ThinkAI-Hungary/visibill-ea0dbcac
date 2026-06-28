import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NumberInput, fmt } from './taoWizardData';
import type { TaoStepProps } from './taoWizardTypes';

// ── Step 1: Eredménykimutatás alapadatok ──
export function RenderStep1({ data, upd }: TaoStepProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-700 dark:text-blue-300">
          Az eredménykimutatás fősorait töltse ki — az AEE automatikusan számolódik a következő lépésben.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <NumberInput label="Értékesítés nettó árbevétele" value={data.revenue} onChange={v => upd('revenue', v)} />
        <NumberInput label="Egyéb bevételek" value={data.other_revenue} onChange={v => upd('other_revenue', v)} />
        <NumberInput label="Anyagjellegű ráfordítások" value={data.material_costs} onChange={v => upd('material_costs', v)} />
        <NumberInput label="Személyi jellegű ráfordítások" value={data.personnel_costs} onChange={v => upd('personnel_costs', v)} />
        <NumberInput label="Értékcsökkenési leírás" value={data.depreciation} onChange={v => upd('depreciation', v)} />
        <NumberInput label="Egyéb ráfordítások" value={data.other_costs} onChange={v => upd('other_costs', v)} />
        <NumberInput label="Pénzügyi eredmény (+/-)" value={data.financial_result} onChange={v => upd('financial_result', v)} />
      </div>
    </div>
  );
}

// ── Step 2: Adózás Előtti Eredmény ──
export function RenderStep2({ data, computed }: TaoStepProps) {
  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl p-6 border border-emerald-200 dark:border-emerald-800">
        <p className="text-xs text-slate-500 mb-1">Adózás Előtti Eredmény (AEE)</p>
        <p className={cn('text-4xl font-black', computed.aee >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
          {fmt(computed.aee)} Ft
        </p>
        <p className="text-xs text-slate-400 mt-2">= Bevételek ({fmt(computed.totalRevenue)}) − Költségek ({fmt(computed.totalCosts)}) + Pénzügyi ({fmt(data.financial_result)})</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card rounded-lg border border-border p-3">
          <p className="text-[10px] text-slate-500">Összbevétel</p>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{fmt(computed.totalRevenue)} Ft</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-3">
          <p className="text-[10px] text-slate-500">Összköltség</p>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{fmt(computed.totalCosts)} Ft</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-3">
          <p className="text-[10px] text-slate-500">Pénzügyi eredmény</p>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{fmt(data.financial_result)} Ft</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-3">
          <p className="text-[10px] text-slate-500">AEE</p>
          <p className={cn('text-sm font-bold', computed.aee >= 0 ? 'text-emerald-600' : 'text-rose-600')}>{fmt(computed.aee)} Ft</p>
        </div>
      </div>
    </div>
  );
}
