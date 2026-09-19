import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { payrollQueryKeys } from '@/hooks/usePayrollData';
import { Input } from '@/components/ui/input';
import { Info, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface PayrollStep7Props {
  activeEmployees: any[];
  items: any[];
  garnishments?: any[];
  allEmployments?: any[];
  cycleId?: string;
  onSavingChange?: (isSaving: boolean) => void;
}

export default function PayrollStep7({
  activeEmployees,
  items,
  garnishments = [],
  allEmployments = [],
  cycleId,
  onSavingChange,
}: PayrollStep7Props) {
  const queryClient = useQueryClient();
  const [localAdvances, setLocalAdvances] = React.useState<Record<string, string>>({});
  const [localPensionFunds, setLocalPensionFunds] = React.useState<Record<string, string>>({});
  const [localOtherDeductions, setLocalOtherDeductions] = React.useState<Record<string, string>>({});
  const [savingMap, setSavingMap] = React.useState<Record<string, boolean>>({});

  const isSaving = React.useMemo(() => Object.values(savingMap).some(Boolean), [savingMap]);

  React.useEffect(() => {
    onSavingChange?.(isSaving);
  }, [isSaving, onSavingChange]);

  const handleDeductionChange = async (
    empId: string,
    employmentId: string,
    itemType: 'advance' | 'pension_fund' | 'other_deduction',
    description: string,
    amount: number
  ) => {
    if (!cycleId || !employmentId) return;

    const key = `${itemType}_${empId}`;
    setSavingMap(prev => ({ ...prev, [key]: true }));

    try {
      const { data: existing } = await supabase
        .from('accounty_payroll_items')
        .select('id')
        .eq('cycle_id', cycleId)
        .eq('employment_id', employmentId)
        .eq('item_type', itemType)
        .eq('is_deduction', true)
        .maybeSingle();

      if (amount > 0) {
        if (existing) {
          await supabase
            .from('accounty_payroll_items')
            .update({ amount })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('accounty_payroll_items')
            .insert({
              cycle_id: cycleId,
              employment_id: employmentId,
              item_type: itemType,
              description,
              amount,
              is_deduction: true,
            });
        }
      } else if (existing) {
        await supabase
          .from('accounty_payroll_items')
          .delete()
          .eq('id', existing.id);
      }

      if (cycleId) {
        queryClient.invalidateQueries({ queryKey: payrollQueryKeys.items(cycleId) });
      }
    } catch (err: any) {
      console.error('Error saving deduction:', err);
      toast({ variant: 'destructive', title: 'Hiba a levonás mentésekor', description: err.message });
    } finally {
      setSavingMap(prev => ({ ...prev, [key]: false }));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground dark:text-foreground/90">
          Munkabérből történő levonások kezelése: letiltások, felvett munkabérelőlegek, önkéntes pénztári tagdíjak.
        </p>
        {isSaving && (
          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1.5 animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Mentés...
          </span>
        )}
      </div>

      <div className="p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-start gap-2.5 text-xs text-blue-700 dark:text-blue-300">
        <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold">Mire szolgálnak az egyes levonási oszlopok?</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>Munkabérelőleg:</strong> A tárgyhónap folyamán a dolgozónak már kifizetett előleg, amely a havi nettó kifizetendő bért csökkenti.</li>
            <li><strong>Önkéntes pénztár (ÖNYP / EP):</strong> Ha a dolgozó írásban kéri az önkéntes nyugdíj- vagy egészségpénztári egyéni tagdíjának bérből történő levonását és a munkáltató általi közvetlen átutalását.</li>
            <li><strong>Egyéb levonás:</strong> Egyéb megállapodáson vagy határozaton alapuló levonás (pl. dolgozói kártérítés, céges eszközhasználat).</li>
          </ul>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border dark:bg-card/30">
              <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Név</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Letiltás (Vht.)</th>
              <th className="px-4 py-2 text-center text-xs font-medium text-muted-foreground uppercase">Munkabérelőleg (Ft)</th>
              <th className="px-4 py-2 text-center text-xs font-medium text-muted-foreground uppercase">Önkéntes Pénztár (Ft)</th>
              <th className="px-4 py-2 text-center text-xs font-medium text-muted-foreground uppercase">Egyéb levonás (Ft)</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Össz. levonás</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {activeEmployees.map((emp) => {
              const empEmployment = allEmployments.find(e => e.employee_id === emp.id);
              const empDeductions = items.filter(i => i.employment_id === empEmployment?.id && i.is_deduction);
              const empGarnishments = garnishments.filter(g => g.employee_id === emp.id);
              
              const letiltas = empGarnishments.reduce((s, g) => s + Number(g.monthly_deduction || 0), 0);
              
              const storedAdvance = empDeductions.find(i => i.item_type === 'advance')?.amount || 0;
              const currentAdvance = localAdvances[emp.id] !== undefined
                ? (parseInt(localAdvances[emp.id]) || 0)
                : storedAdvance;

              const storedPension = empDeductions.find(i => i.item_type === 'pension_fund')?.amount || 0;
              const currentPension = localPensionFunds[emp.id] !== undefined
                ? (parseInt(localPensionFunds[emp.id]) || 0)
                : storedPension;

              const storedOther = empDeductions.find(i => i.item_type === 'other_deduction')?.amount || 0;
              const currentOther = localOtherDeductions[emp.id] !== undefined
                ? (parseInt(localOtherDeductions[emp.id]) || 0)
                : storedOther;
              
              const total = letiltas + currentAdvance + currentPension + currentOther;

              return (
                <tr key={emp.id} className="hover:bg-muted/50">
                  <td className="px-4 py-2.5 text-sm font-medium text-foreground">
                    {emp.last_name} {emp.first_name}
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm font-mono text-foreground/90">
                    {letiltas > 0 ? (
                      <div className="flex flex-col items-end">
                        <span className="text-amber-600 dark:text-amber-400 font-semibold">
                          {letiltas.toLocaleString('hu-HU')} Ft
                        </span>
                        {empGarnishments.length > 1 && (
                          <span
                            className="text-[10px] font-medium text-amber-700 dark:text-amber-300 bg-amber-500/15 px-1.5 py-0.5 rounded mt-0.5"
                            title="Több párhuzamos letiltás: a törvényes levonási plafon a nettó bér 50%-a (Vht. 65. §)"
                          >
                            Több letiltás (max. 50%)
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">0 Ft</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <Input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={localAdvances[emp.id] !== undefined ? localAdvances[emp.id] : (storedAdvance ? String(storedAdvance) : '')}
                      onChange={(e) => {
                        const val = e.target.value.replace(/^-+/, '');
                        setLocalAdvances(prev => ({ ...prev, [emp.id]: val }));
                      }}
                      onBlur={(e) => {
                        const num = Math.max(0, parseInt(e.target.value) || 0);
                        if (empEmployment?.id) {
                          handleDeductionChange(emp.id, empEmployment.id, 'advance', 'Munkabérelőleg levonás', num);
                        }
                      }}
                      className="w-28 text-right mx-auto h-8 text-xs font-mono"
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <Input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={localPensionFunds[emp.id] !== undefined ? localPensionFunds[emp.id] : (storedPension ? String(storedPension) : '')}
                      onChange={(e) => {
                        const val = e.target.value.replace(/^-+/, '');
                        setLocalPensionFunds(prev => ({ ...prev, [emp.id]: val }));
                      }}
                      onBlur={(e) => {
                        const num = Math.max(0, parseInt(e.target.value) || 0);
                        if (empEmployment?.id) {
                          handleDeductionChange(emp.id, empEmployment.id, 'pension_fund', 'Önkéntes pénztári tagdíj levonás', num);
                        }
                      }}
                      className="w-28 text-right mx-auto h-8 text-xs font-mono"
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <Input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={localOtherDeductions[emp.id] !== undefined ? localOtherDeductions[emp.id] : (storedOther ? String(storedOther) : '')}
                      onChange={(e) => {
                        const val = e.target.value.replace(/^-+/, '');
                        setLocalOtherDeductions(prev => ({ ...prev, [emp.id]: val }));
                      }}
                      onBlur={(e) => {
                        const num = Math.max(0, parseInt(e.target.value) || 0);
                        if (empEmployment?.id) {
                          handleDeductionChange(emp.id, empEmployment.id, 'other_deduction', 'Egyéb levonás', num);
                        }
                      }}
                      className="w-28 text-right mx-auto h-8 text-xs font-mono"
                    />
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm font-bold font-mono text-red-600 dark:text-red-400">
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
