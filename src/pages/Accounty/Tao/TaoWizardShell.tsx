import React from 'react';
import { CheckCircle, Calculator } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STEPS, fmt } from './taoWizardData';
import type { TaoComputed } from './taoWizardTypes';

interface TaoWizardStepperProps {
  currentStep: number;
  onStepChange: (step: number) => void;
}

export function TaoWizardStepper({ currentStep, onStepChange }: TaoWizardStepperProps) {
  return (
    <div className="flex items-center gap-0 overflow-x-auto pt-2 pb-2">
      {STEPS.map((s, i) => {
        const isDone = s.num < currentStep;
        const isCurrent = s.num === currentStep;
        return (
          <React.Fragment key={s.num}>
            <button
              onClick={() => onStepChange(s.num)}
              className="flex flex-col items-center min-w-[68px] group"
            >
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                isDone ? 'bg-emerald-500 text-white' :
                isCurrent ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-400' :
                'bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-slate-700'
              )}>
                {isDone ? <CheckCircle className="w-4 h-4" /> : s.num}
              </div>
              <span className={cn(
                'text-[10px] mt-1.5 text-center whitespace-nowrap',
                isDone ? 'text-emerald-600 font-medium' :
                isCurrent ? 'text-emerald-700 dark:text-emerald-300 font-bold' :
                'text-slate-400'
              )}>
                {s.label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={cn(
                'flex-1 h-0.5 min-w-3 mt-[-12px]',
                s.num < currentStep ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-slate-700'
              )} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

interface SummaryRow {
  label: string;
  value: number;
  step: number;
  color?: string;
  bold?: boolean;
}

interface TaoWizardSidebarProps {
  computed: TaoComputed;
  advancePayments: number;
  currentStep: number;
  onStepChange: (step: number) => void;
}

export function TaoWizardSidebar({ computed, advancePayments, currentStep, onStepChange }: TaoWizardSidebarProps) {
  const rows: SummaryRow[] = [
    { label: 'AEE', value: computed.aee, step: 2 },
    { label: '7.§ csökkentők', value: -computed.decreasingTotal, step: 3, color: 'text-emerald-500' },
    { label: '8.§ növelők', value: computed.increasingTotal, step: 4, color: 'text-rose-500' },
    { label: 'Kamatkorlát korr.', value: computed.interestAdjustment, step: 5, color: 'text-amber-500' },
    { label: 'Adóalap', value: computed.taxBase, step: 7, bold: true },
    { label: 'Számított adó (9%)', value: computed.calculatedTax, step: 10 },
    { label: 'Kedvezmények', value: -computed.creditsTotal, step: 8, color: 'text-blue-500' },
    { label: 'Felajánlás', value: -computed.effectiveDonations, step: 9, color: 'text-purple-500' },
    { label: 'Előlegek', value: -advancePayments, step: 10, color: 'text-slate-500' },
  ];

  return (
    <div className="lg:col-span-1">
      <div className="bg-card rounded-xl border border-border p-5 shadow-soft sticky top-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Calculator className="w-4 h-4 text-emerald-600" /> Összesítő
        </h3>
        {rows.map((row, i) => (
          <button
            key={i}
            onClick={() => onStepChange(row.step)}
            className={cn(
              'flex items-center justify-between w-full py-1.5 px-2 rounded-md text-left transition-colors',
              row.step === currentStep ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50',
              row.bold && 'border-t border-border pt-3 mt-1'
            )}
          >
            <span className={cn('text-xs', row.bold ? 'font-bold text-slate-900 dark:text-slate-100' : 'text-slate-500')}>
              {row.label}
            </span>
            <span className={cn('text-xs font-mono font-bold', row.color || 'text-slate-700 dark:text-slate-300')}>
              {fmt(row.value)}
            </span>
          </button>
        ))}
        <div className="border-t-2 border-emerald-400 pt-3 mt-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">Fizetendő TAO</span>
            <span className="text-lg font-black text-emerald-600">{fmt(computed.payableTax)} Ft</span>
          </div>
        </div>
      </div>
    </div>
  );
}
