import React from 'react';
import { cn } from '@/lib/utils';
import { MiniStat } from './EmployeeHelpers';
import type { calculateLeaveBalance } from '@/lib/payroll/leaveCalculator';

interface Leave {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
  status: string;
}

interface EmployeeLeaveTabProps {
  leaves: Leave[];
  leaveBalance: ReturnType<typeof calculateLeaveBalance> | null;
}

export function EmployeeLeaveTab({ leaves, leaveBalance }: EmployeeLeaveTabProps) {
  return (
    <div className="p-6">
      {leaveBalance && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <MiniStat label="Alap-szabadság" value={`${leaveBalance.baseLeave} nap`} />
          <MiniStat label="Életkori pótlék" value={`+${leaveBalance.ageSupplement} nap`} />
          <MiniStat label="Gyermek pótlék" value={`+${leaveBalance.childSupplement} nap`} />
          <MiniStat label="Felhasznált" value={`${leaveBalance.used} nap`} />
          <MiniStat label="Fennmaradó" value={`${leaveBalance.remaining} nap`} color={leaveBalance.remaining < 5 ? 'red' : 'green'} />
        </div>
      )}

      {leaves.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-500">Nincs rögzített távollét</div>
      ) : (
        <div className="space-y-2">
          {leaves.map((l) => (
            <div key={l.id} className="p-3 rounded-lg border border-border flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 capitalize">
                  {l.leave_type.replace(/_/g, ' ')}
                </p>
                <p className="text-xs text-slate-500">{l.start_date} – {l.end_date} · {l.days} nap</p>
              </div>
              <span className={cn(
                'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
                l.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
              )}>
                {l.status === 'approved' ? 'Jóváhagyva' : l.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
