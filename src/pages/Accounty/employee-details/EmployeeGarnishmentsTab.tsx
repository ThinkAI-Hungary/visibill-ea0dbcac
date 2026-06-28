import React from 'react';
import { formatAmount } from '@/lib/payroll/validators';

interface Garnishment {
  id: string;
  garnishment_type: string;
  creditor_name?: string | null;
  remaining_amount?: number | null;
  monthly_deduction?: number | null;
  max_deduction_pct: number;
}

interface EmployeeGarnishmentsTabProps {
  garnishments: Garnishment[];
}

export function EmployeeGarnishmentsTab({ garnishments }: EmployeeGarnishmentsTabProps) {
  return (
    <div className="p-6">
      {garnishments.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-500">Nincs aktív letiltás</div>
      ) : (
        <div className="space-y-2">
          {garnishments.map((g) => (
            <div key={g.id} className="p-4 rounded-lg border border-border">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 capitalize">
                  {g.garnishment_type.replace(/_/g, ' ')}
                </p>
                <span className="text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/40 px-2 py-0.5 rounded-full uppercase">
                  Max {g.max_deduction_pct}%
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-slate-500">
                <span>Hitelező: {g.creditor_name || '–'}</span>
                <span>Fennmaradó: {g.remaining_amount ? formatAmount(g.remaining_amount) : '–'}</span>
                <span>Havi: {g.monthly_deduction ? formatAmount(g.monthly_deduction) : '–'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
