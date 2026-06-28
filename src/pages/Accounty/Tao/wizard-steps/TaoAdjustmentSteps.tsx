import { AlertTriangle, CheckCircle, Globe, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { DECREASING_ITEMS, NumberInput, fmt } from '../taoWizardData';
import type { TaoStepProps } from '../taoWizardTypes';

// ── Reusable items step (for steps 3, 4, 8, 9) ──
export function RenderItemsStep({
  items,
  group,
  total,
  color,
  data,
  updItem,
}: TaoStepProps & {
  items: typeof DECREASING_ITEMS;
  group: 'decreasing' | 'increasing' | 'credits' | 'donations';
  total: number;
  color: string;
}) {
  return (
    <div className="space-y-4">
      {items.map(item => (
        <NumberInput
          key={item.key}
          label={item.label}
          hint={item.hint}
          value={data[group][item.key] || 0}
          onChange={v => updItem(group, item.key, v)}
        />
      ))}
      <div className={cn('rounded-lg p-4 border', color)}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold">Összesen:</span>
          <span className="text-lg font-black">{fmt(total)} Ft</span>
        </div>
      </div>
    </div>
  );
}

// ── Step 5: Kamatkorlát (EBITDA 30%) ──
export function RenderStep5({ data, computed, upd }: TaoStepProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-700 dark:text-amber-300">
          A nettó finanszírozási költség maximum az EBITDA 30%-áig vonható le (Tao tv. 8.§ (1) j) pont). Az e feletti rész növelő tételként jelentkezik.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <NumberInput label="Nettó kamatráfordítás" value={data.interest_expense} onChange={v => upd('interest_expense', v)} />
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">EBITDA (számított)</label>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg border border-border px-3 py-2 text-sm font-mono text-right">
            {fmt(computed.ebitda)} Ft
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-lg border border-border p-4">
          <p className="text-[10px] text-slate-500">EBITDA × 30%</p>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{fmt(computed.interestLimit)} Ft</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <p className="text-[10px] text-slate-500">Kamatráfordítás</p>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{fmt(data.interest_expense)} Ft</p>
        </div>
        <div className={cn('rounded-lg border p-4', computed.interestAdjustment > 0 ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-200' : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200')}>
          <p className="text-[10px] text-slate-500">Korrekció</p>
          <p className={cn('text-sm font-bold', computed.interestAdjustment > 0 ? 'text-rose-600' : 'text-emerald-600')}>
            {computed.interestAdjustment > 0 ? '+' : ''}{fmt(computed.interestAdjustment)} Ft
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Step 6: CFC (Ellenőrzött külföldi társaság) ──
export function RenderStep6({ data, upd, computed }: TaoStepProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 p-4 bg-card rounded-lg border border-border">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={data.has_cfc}
            onChange={e => upd('has_cfc', e.target.checked)}
            className="rounded border-border"
          />
          <span className="text-sm text-slate-700 dark:text-slate-300">Van ellenőrzött külföldi társaság (CFC)?</span>
        </label>
      </div>
      {!data.has_cfc && (
        <div className="py-12 text-center text-sm text-slate-400">
          <Globe className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          Nincs CFC érintettség — továbbléphet.
        </div>
      )}
      {data.has_cfc && (
        <div className="space-y-4">
          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              CFC (Controlled Foreign Company) szabályok — Tao tv. 4.§ 11. pont. Az alacsony adókulcsú (ETR &lt; 9%) külföldi leányvállalat jövedelme hozzáadódik az adóalaphoz.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Székhely országa</label>
              <Input value={data.cfc_country} onChange={e => upd('cfc_country', e.target.value)} className="bg-background" placeholder="pl. Ciprus" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Társaság neve</label>
              <Input value={data.cfc_company} onChange={e => upd('cfc_company', e.target.value)} className="bg-background" placeholder="pl. XYZ Holdings Ltd" />
            </div>
            <NumberInput label="CFC jövedelem" value={data.cfc_income} onChange={v => upd('cfc_income', v)} />
            <NumberInput label="Helyi effektív adókulcs (%)" value={data.cfc_tax_rate} onChange={v => upd('cfc_tax_rate', v)} suffix="%" />
          </div>
          {data.cfc_tax_rate > 0 && data.cfc_tax_rate < 9 && (
            <div className="flex items-start gap-2 p-3 bg-rose-50 dark:bg-rose-900/20 rounded-lg border border-rose-200 dark:border-rose-800">
              <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
              <p className="text-xs text-rose-700 dark:text-rose-300">
                <strong>CFC érintettség!</strong> A helyi ETR ({data.cfc_tax_rate}%) alacsonyabb, mint a magyar TAO kulcs (9%). A CFC jövedelem ({fmt(data.cfc_income)} Ft) hozzáadódik a magyar adóalaphoz.
              </p>
            </div>
          )}
          {data.cfc_tax_rate >= 9 && (
            <div className="flex items-start gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                A helyi ETR ({data.cfc_tax_rate}%) eléri a 9%-ot — nincs CFC korrekciós kötelezettség.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
