import React from 'react';

interface PayrollStep5Props {
  activeEmployees: any[];
  items: any[];
}

export default function PayrollStep5({
  activeEmployees,
  items,
}: PayrollStep5Props) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Alapbér, pótlékok, prémiumok meghatározása. A rendszer az aktív jogviszony alapján kalkulál.
      </p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border dark:bg-slate-900/30">
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Név</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Alapbér</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Pótlék</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Prémium</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Bruttó összesen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {activeEmployees.map((emp) => {
              const empItems = items.filter(i => i.employee_id === emp.id && !i.is_deduction);
              const base = empItems.find(i => i.item_type === 'base_salary')?.amount || 0;
              const premium = empItems.filter(i => i.item_type !== 'base_salary').reduce((s, i) => s + (i.amount || 0), 0);
              return (
                <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100">
                    {emp.last_name} {emp.first_name}
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm font-mono text-slate-700 dark:text-slate-300">
                    {base.toLocaleString('hu-HU')} Ft
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm font-mono text-slate-500">0 Ft</td>
                  <td className="px-4 py-2.5 text-right text-sm font-mono text-slate-500">
                    {premium.toLocaleString('hu-HU')} Ft
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm font-bold font-mono text-primary">
                    {(base + premium).toLocaleString('hu-HU')} Ft
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
