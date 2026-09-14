import React from 'react';

interface PayrollStep7Props {
  activeEmployees: any[];
  items: any[];
  garnishments?: any[];
  allEmployments?: any[];
}

export default function PayrollStep7({
  activeEmployees,
  items,
  garnishments = [],
  allEmployments = [],
}: PayrollStep7Props) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground dark:text-foreground/90">
        Letiltások, előleg-visszavonások, szakszervezeti tagdíj, önkéntes pénztárak.
      </p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border dark:bg-card/30">
              <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Név</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Letiltás</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Előleg</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Egyéb</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Össz. levonás</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {activeEmployees.map((emp) => {
              const empEmployment = allEmployments.find(e => e.employee_id === emp.id);
              const empDeductions = items.filter(i => i.employment_id === empEmployment?.id && i.is_deduction);
              const empGarnishments = garnishments.filter(g => g.employee_id === emp.id);
              
              const letiltas = empGarnishments.reduce((s, g) => s + Number(g.monthly_deduction || 0), 0);
              const eloleg = empDeductions.filter(i => i.item_type === 'advance').reduce((s, i) => s + (i.amount || 0), 0);
              const egyeb = empDeductions.filter(i => i.item_type !== 'advance').reduce((s, i) => s + (i.amount || 0), 0);
              
              const total = letiltas + eloleg + egyeb;
              return (
                <tr key={emp.id} className="hover:bg-muted/50">
                  <td className="px-4 py-2.5 text-sm font-medium text-foreground">
                    {emp.last_name} {emp.first_name}
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm font-mono text-foreground/90">
                    {letiltas.toLocaleString('hu-HU')} Ft
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm font-mono text-foreground/90">
                    {eloleg.toLocaleString('hu-HU')} Ft
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm font-mono text-foreground/90">
                    {egyeb.toLocaleString('hu-HU')} Ft
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
