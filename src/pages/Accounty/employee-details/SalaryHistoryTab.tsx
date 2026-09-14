import React from 'react';
import { Banknote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEmployeeSalaryHistory } from '@/hooks/usePayrollData';
import { formatAmount } from '@/lib/payroll/validators';
import { MiniStat } from './EmployeeHelpers';

const MONTHS_HU = [
  'Január', 'Február', 'Március', 'Április', 'Május', 'Június',
  'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December',
];

export default function SalaryHistoryTab({ employmentId }: { employmentId: string }) {
  const { data: history = [], isLoading } = useEmployeeSalaryHistory(employmentId);

  if (!employmentId) {
    return (
      <div className="p-6 py-12 text-center text-sm text-muted-foreground">
        Nincs aktív jogviszony a bérelőzmények megjelenítéséhez.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="p-6 py-12 text-center text-sm text-muted-foreground">
        <Banknote className="w-10 h-10 mx-auto mb-3 text-muted-foreground/60" />
        Még nincs számfejtett bérelőzmény ehhez a jogviszonyhoz.
      </div>
    );
  }

  return (
    <div className="p-6">
      <h3 className="text-sm font-bold text-foreground/90 mb-4">Bérelőzmények</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase">Időszak</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground uppercase">Bruttó</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground uppercase">SZJA</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground uppercase">TB</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground uppercase">Nettó</th>
              <th className="text-center py-2 px-3 text-xs font-semibold text-muted-foreground uppercase">Státusz</th>
            </tr>
          </thead>
          <tbody>
            {history.map((entry) => (
              <tr key={entry.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                <td className="py-3 px-3 font-medium text-foreground">
                  {entry.cycle_year}. {MONTHS_HU[(entry.cycle_month || 1) - 1]}
                </td>
                <td className="py-3 px-3 text-right font-mono text-foreground/90">
                  {formatAmount(entry.gross_salary)}
                </td>
                <td className="py-3 px-3 text-right font-mono text-red-600 dark:text-red-400">
                  -{formatAmount(entry.szja_amount)}
                </td>
                <td className="py-3 px-3 text-right font-mono text-red-600 dark:text-red-400">
                  -{formatAmount(entry.tb_amount)}
                </td>
                <td className="py-3 px-3 text-right font-mono font-bold text-foreground">
                  {formatAmount(entry.net_salary)}
                </td>
                <td className="py-3 px-3 text-center">
                  <span className={cn(
                    'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
                    entry.cycle_status === 'closed' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' :
                    entry.cycle_status === 'approved' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' :
                    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                  )}>
                    {entry.cycle_status === 'closed' ? 'Lezárt' :
                     entry.cycle_status === 'approved' ? 'Jóváhagyott' :
                     entry.cycle_status === 'draft' ? 'Tervezet' : entry.cycle_status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      {history.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 md:grid-cols-4 gap-3">
          <MiniStat
            label="Össz. bruttó"
            value={`${formatAmount(history.reduce((s, e) => s + e.gross_salary, 0))}`}
          />
          <MiniStat
            label="Össz. SZJA"
            value={`${formatAmount(history.reduce((s, e) => s + e.szja_amount, 0))}`}
            color="red"
          />
          <MiniStat
            label="Össz. TB"
            value={`${formatAmount(history.reduce((s, e) => s + e.tb_amount, 0))}`}
            color="red"
          />
          <MiniStat
            label="Össz. nettó"
            value={`${formatAmount(history.reduce((s, e) => s + e.net_salary, 0))}`}
            color="green"
          />
        </div>
      )}
    </div>
  );
}
