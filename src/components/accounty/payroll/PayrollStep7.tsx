import React from 'react';

interface PayrollStep7Props {
  activeEmployees: any[];
  items: any[];
}

export default function PayrollStep7({
  activeEmployees,
  items,
}: PayrollStep7Props) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Letiltások, előleg-visszavonások, szakszervezeti tagdíj, önkéntes pénztárak.
      </p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border dark:bg-slate-900/30">
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Név</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Letiltás</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Előleg</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Egyéb</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Össz. levonás</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {activeEmployees.map((emp) => {
              const empDeductions = items.filter(i => i.employee_id === emp.id && i.is_deduction);
              const total = empDeductions.reduce((s, i) => s + (i.amount || 0), 0);
              return (
                <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100">
                    {emp.last_name} {emp.first_name}
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm font-mono text-slate-500">0 Ft</td>
                  <td className="px-4 py-2.5 text-right text-sm font-mono text-slate-500">0 Ft</td>
                  <td className="px-4 py-2.5 text-right text-sm font-mono text-slate-500">
                    {total.toLocaleString('hu-HU')} Ft
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm font-bold font-mono text-red-600">
                    {total.toLocaleString('hu-HU')} Ft
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
