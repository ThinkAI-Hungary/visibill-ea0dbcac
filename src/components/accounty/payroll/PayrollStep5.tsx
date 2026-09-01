import React from 'react';

interface PayrollStep5Props {
  activeEmployees: any[];
  allEmployments: any[];
  items: any[];
  attendanceData?: Record<string, { workDays: number; overtime: number; sickDays: number; leaveDays: number }>;
  cycleId?: string;
}

export default function PayrollStep5({
  activeEmployees,
  allEmployments,
  items,
  attendanceData = {},
  cycleId,
}: PayrollStep5Props) {
  const [customBonusMap, setCustomBonusMap] = React.useState<Record<string, number>>({});
  const [localBonusTextMap, setLocalBonusTextMap] = React.useState<Record<string, string>>({});
  const [savingMap, setSavingMap] = React.useState<Record<string, boolean>>({});

  const handleBonusChange = async (empId: string, employmentId: string, bonusAmount: number) => {
    setCustomBonusMap(prev => ({ ...prev, [empId]: bonusAmount }));

    if (!cycleId || !employmentId) return;

    setSavingMap(prev => ({ ...prev, [empId]: true }));
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      // Fetch existing bonus item for this cycle and employment
      const { data: existing } = await supabase
        .from('accounty_payroll_items')
        .select('id')
        .eq('cycle_id', cycleId)
        .eq('employment_id', employmentId)
        .eq('item_type', 'bonus')
        .maybeSingle();

      if (bonusAmount > 0) {
        if (existing) {
          await supabase
            .from('accounty_payroll_items')
            .update({ amount: bonusAmount })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('accounty_payroll_items')
            .insert({
              cycle_id: cycleId,
              employment_id: employmentId,
              item_type: 'bonus',
              description: 'Egyedi prémium / jutalom',
              amount: bonusAmount,
              is_deduction: false,
            });
        }
      } else if (existing) {
        await supabase
          .from('accounty_payroll_items')
          .delete()
          .eq('id', existing.id);
      }
    } catch (err) {
      console.error('Error saving custom bonus item:', err);
    } finally {
      setSavingMap(prev => ({ ...prev, [empId]: false }));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Alapbér, pótlékok, prémiumok felvitele. A prémium oszlopban közvetlenül megadhatod az adott havi egyedi jutalmat.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border dark:bg-slate-900/30">
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Név</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Alapbér</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Pótlék</th>
              <th className="px-4 py-2 text-center text-xs font-medium text-slate-500 uppercase">Prémium / Jutalom (Ft)</th>
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
                leaveAmount = 0;
              }
              
              const base = empItems.find(i => i.item_type === 'base_salary')?.amount 
                || adjustedBase;
                
              const overtimeOverride = empItems.find(i => i.item_type === 'overtime')?.amount;
              const sickLeaveOverride = empItems.find(i => i.item_type === 'sick_leave')?.amount;
              
              const finalOvertime = overtimeOverride !== undefined ? Number(overtimeOverride) : overtimeAmount;
              const finalSickLeave = sickLeaveOverride !== undefined ? Number(sickLeaveOverride) : sickLeaveAmount;
              
              const potlek = finalOvertime + finalSickLeave;
              
              const storedBonus = empItems.find(i => i.item_type === 'bonus')?.amount || 0;
              const currentBonus = customBonusMap[emp.id] !== undefined ? customBonusMap[emp.id] : storedBonus;
              
              const otherPremiums = empItems
                .filter(i => !['base_salary', 'overtime', 'sick_leave', 'bonus'].includes(i.item_type))
                .reduce((s, i) => s + (i.amount || 0), 0);
                
              const premium = currentBonus + otherPremiums + leaveAmount;

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
                  <td className="px-4 py-2 text-center">
                    <input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={localBonusTextMap[emp.id] !== undefined ? localBonusTextMap[emp.id] : (currentBonus ? String(currentBonus) : '')}
                      onChange={(e) => {
                        const strVal = e.target.value;
                        const numVal = parseInt(strVal) || 0;
                        setLocalBonusTextMap(prev => ({ ...prev, [emp.id]: strVal }));
                        setCustomBonusMap(prev => ({ ...prev, [emp.id]: numVal }));
                      }}
                      onBlur={(e) => {
                        const numVal = parseInt(e.target.value) || 0;
                        handleBonusChange(emp.id, empEmployment?.id || '', numVal);
                      }}
                      className="w-28 text-right rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400 focus:border-primary focus:outline-none"
                    />
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
