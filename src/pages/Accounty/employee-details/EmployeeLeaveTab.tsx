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
  const categories = [
    { label: 'Alap-szabadság', days: leaveBalance?.baseLeave || 0, hours: leaveBalance?.baseLeaveHours || 0 },
    { label: 'Életkori pótszabadság', days: leaveBalance?.ageSupplement || 0, hours: leaveBalance?.ageSupplementHours || 0 },
    { label: 'Gyermek utáni pótszabadság', days: leaveBalance?.childSupplement || 0, hours: leaveBalance?.childSupplementHours || 0 },
    { label: 'Fogyatékos gyermek pótszabadság', days: leaveBalance?.disabledChildSupplement || 0, hours: leaveBalance?.disabledChildSupplementHours || 0 },
    { label: 'Apai szabadság', days: leaveBalance?.paternityLeave || 0, hours: (leaveBalance?.paternityLeave || 0) * 8 },
    { label: 'Szülői szabadság', days: leaveBalance?.parentalLeave || 0, hours: (leaveBalance?.parentalLeave || 0) * 8 },
    { label: 'Tanulmányi szabadság', days: leaveBalance?.studyLeave || 0, hours: (leaveBalance?.studyLeave || 0) * 8 },
    { label: 'Rendkívüli / egyéb pótszabadság', days: leaveBalance?.extraordinaryLeave || 0, hours: (leaveBalance?.extraordinaryLeave || 0) * 8 },
    { label: 'Előző évről áthozott', days: leaveBalance?.carriedOver || 0, hours: leaveBalance?.carriedOverHours || 0 },
  ];

  return (
    <div className="p-6 space-y-6">
      {leaveBalance && (
        <>
          {/* Quick Stats Banner */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MiniStat label="Éves keret összesen" value={`${leaveBalance.totalAvailable} nap`} />
            <MiniStat label="Felhasznált eddig" value={`${leaveBalance.used} nap`} />
            <MiniStat label="Fennmaradó kiadható" value={`${leaveBalance.remaining} nap`} color={leaveBalance.remaining < 5 ? 'red' : 'green'} />
            <MiniStat label="Órakeret összesen" value={`${leaveBalance.totalAvailableHours} óra`} />
          </div>

          {/* Tabular breakdown */}
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="bg-background/40 px-4 py-3 border-b border-border">
              <h3 className="text-sm font-bold text-foreground/90">Részletes Szabadság Nyilvántartás (Mt.)</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground font-medium text-xs uppercase">
                  <th className="px-4 py-2.5 text-left">Jogcím</th>
                  <th className="px-4 py-2.5 text-right">Napok</th>
                  <th className="px-4 py-2.5 text-right">Órák</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {categories.map((cat, idx) => (
                  <tr key={idx} className="hover:bg-muted/40/30">
                    <td className="px-4 py-2.5 font-medium text-foreground/90">{cat.label}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold">{cat.days} nap</td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{cat.hours} óra</td>
                  </tr>
                ))}
                <tr className="font-bold border-t-2 border-border bg-muted/40/10 dark:bg-card/30">
                  <td className="px-4 py-3 text-foreground">ÖSSZESÍTÉS</td>
                  <td className="px-4 py-3 text-right font-mono text-primary">{leaveBalance.totalAvailable} nap</td>
                  <td className="px-4 py-3 text-right font-mono text-foreground/90">{leaveBalance.totalAvailableHours} óra</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Leave history */}
      <div>
        <h3 className="text-sm font-bold text-foreground/90 mb-3">Távollét Történet</h3>
        {leaves.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
            Nincs rögzített távollét ebben az évben.
          </div>
        ) : (
          <div className="space-y-2">
            {leaves.map((l) => (
              <div key={l.id} className="p-3 rounded-lg border border-border flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground capitalize">
                    {l.leave_type.replace(/_/g, ' ')}
                  </p>
                  <p className="text-xs text-muted-foreground">{l.start_date} – {l.end_date} · {l.days} nap ({l.days * 8} óra)</p>
                </div>
                <span className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
                  l.status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                )}>
                  {l.status === 'approved' ? 'Jóváhagyva' : l.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
