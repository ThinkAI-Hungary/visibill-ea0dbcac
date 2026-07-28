import React from 'react';

interface PayrollStep5Props {
  activeEmployees: any[];
  allEmployments: any[];
  items: any[];
  attendanceData?: Record<string, { workDays: number; overtime: number; sickDays: number; leaveDays: number }>;
}

export default function PayrollStep5({
  activeEmployees,
  allEmployments,
  items,
  attendanceData = {},
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
              const empEmployment = allEmployments.find(e => e.employee_id === emp.id);
              const empItems = items.filter(i => i.employment_id === empEmployment?.id && !i.is_deduction);
              
              const rawBaseSalary = empEmployment ? Number(empEmployment.base_salary) : 0;
              const isHourly = empEmployment?.salary_type === 'hourly';
              const att = attendanceData[emp.id] || { workDays: 22, overtime: 0, sickDays: 0, leaveDays: 0 };
              
              // Calculate auto premium amounts based on active employment hourly/daily rates
              const weeklyHours = empEmployment?.weekly_hours || 40;
              const dailyHours = weeklyHours / 5;
              
              let hourlyRate = 0;
              let dailyRate = 0;
              let overtimeAmount = 0;
              let sickLeaveAmount = 0;
              let leaveAmount = 0;
              let adjustedBase = 0;

              if (isHourly) {
                hourlyRate = rawBaseSalary;
                dailyRate = hourlyRate * dailyHours;

                const actualWorkedHours = (att.workDays || 0) * dailyHours;
                const sickHours = (att.sickDays || 0) * dailyHours;
                const leaveHours = (att.leaveDays || 0) * dailyHours;

                adjustedBase = Math.round(actualWorkedHours * hourlyRate);
                overtimeAmount = Math.round(hourlyRate * (att.overtime || 0) * 1.5);
                sickLeaveAmount = Math.round(hourlyRate * sickHours * 0.70);
                leaveAmount = Math.round(hourlyRate * leaveHours * 1.0);
              } else {
                dailyRate = rawBaseSalary / 22;
                hourlyRate = rawBaseSalary / (dailyHours * 22);

                const baseReduction = Math.round(dailyRate * (att.sickDays || 0));
                adjustedBase = Math.max(0, rawBaseSalary - baseReduction);

                overtimeAmount = Math.round(hourlyRate * (att.overtime || 0) * 1.5);
                sickLeaveAmount = Math.round(dailyRate * (att.sickDays || 0) * 0.70);
                leaveAmount = 0; // Already covered in base monthly wage
              }
              
              const base = empItems.find(i => i.item_type === 'base_salary')?.amount 
                || adjustedBase;
                
              const overtimeOverride = empItems.find(i => i.item_type === 'overtime')?.amount;
              const sickLeaveOverride = empItems.find(i => i.item_type === 'sick_leave')?.amount;
              
              const finalOvertime = overtimeOverride !== undefined ? Number(overtimeOverride) : overtimeAmount;
              const finalSickLeave = sickLeaveOverride !== undefined ? Number(sickLeaveOverride) : sickLeaveAmount;
              
              const potlek = finalOvertime + finalSickLeave;
              
              // Sum other premiums or custom bonuses from items
              const otherPremiums = empItems
                .filter(i => !['base_salary', 'overtime', 'sick_leave'].includes(i.item_type))
                .reduce((s, i) => s + (i.amount || 0), 0);
                
              const premium = otherPremiums + leaveAmount;

              return (
                <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100">
                    {emp.last_name} {emp.first_name}
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm font-mono text-slate-700 dark:text-slate-300">
                    {base.toLocaleString('hu-HU')} Ft
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm font-mono text-slate-700 dark:text-slate-300">
                    {potlek.toLocaleString('hu-HU')} Ft
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm font-mono text-slate-700 dark:text-slate-300">
                    {premium.toLocaleString('hu-HU')} Ft
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm font-bold font-mono text-primary">
                    {(base + potlek + premium).toLocaleString('hu-HU')} Ft
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
