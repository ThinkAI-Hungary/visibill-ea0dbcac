import React from 'react';
import { Play, Printer, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

export interface PayrollStep8Props {
  calculations: any[];
  activeEmployees: any[];
  allEmployments?: any[];
  items?: any[];
  cycle: any;
  companyId: string;
  runBatch: any;
  getCalcName: (calc: any) => string;
  handlePrintPayslip: (calc: any) => void;
  handlePrintAllPayslips?: () => void;
  cafeteriaItems?: any[];
}

export default function PayrollStep8({
  calculations,
  activeEmployees,
  allEmployments = [],
  items = [],
  cycle,
  companyId,
  runBatch,
  getCalcName,
  handlePrintPayslip,
  handlePrintAllPayslips,
  cafeteriaItems: propCafeteriaItems,
}: PayrollStep8Props) {
  const [isKiva, setIsKiva] = React.useState(false);
  const [localCafeteriaItems, setLocalCafeteriaItems] = React.useState<any[]>([]);
  const cafeteriaItems = propCafeteriaItems ?? localCafeteriaItems;

  React.useEffect(() => {
    if (!companyId) return;
    supabase
      .from('accounty_tax_profiles')
      .select('is_kiva')
      .eq('company_id', companyId)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data?.is_kiva) setIsKiva(true);
      });
  }, [companyId]);

  const activeEmploymentIdsKey = React.useMemo(() => {
    return allEmployments
      .filter(e => activeEmployees.some(emp => emp.id === e.employee_id))
      .map(e => e.id)
      .sort()
      .join(',');
  }, [allEmployments, activeEmployees]);

  React.useEffect(() => {
    if (propCafeteriaItems !== undefined) return;
    if (!activeEmploymentIdsKey) {
      setLocalCafeteriaItems([]);
      return;
    }

    const ids = activeEmploymentIdsKey.split(',');
    supabase
      .from('accounty_cafeteria')
      .select('*')
      .in('employment_id', ids)
      .then(({ data }) => {
        if (data) setLocalCafeteriaItems(data);
      });
  }, [activeEmploymentIdsKey, propCafeteriaItems]);

  const getSzocho = (calc: any) => {
    if (isKiva) return 0;
    if (calc.szocho_amount !== undefined && calc.szocho_amount !== null && calc.szocho_amount > 0) {
      return calc.szocho_amount;
    }
    return Math.round((calc.gross_salary || 0) * 0.13);
  };

  const getHomeOffice = (employmentId: string) => {
    const ho = cafeteriaItems.find(
      i => i.employment_id === employmentId && (i.sub_type === 'home_office' || i.benefit_type === 'home_office')
    );
    return ho ? Number(ho.amount) : 0;
  };

  const getBonus = (employmentId: string) => {
    const b = items.find(i => i.employment_id === employmentId && i.item_type === 'bonus');
    return b ? Number(b.amount) : 0;
  };

  const totalHomeOffice = calculations.reduce((sum, c) => sum + getHomeOffice(c.employment_id), 0);
  const totalNetSalary = calculations.reduce((sum, c) => sum + (c.net_salary || 0), 0);
  const totalFinalPayout = totalNetSalary + totalHomeOffice;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Véglegesítés: bruttó→nettó összesítő, jóváhagyás, adómentes juttatások és bérjegyzék generálása.
      </p>
      {calculations.length > 0 ? (
        <>
          {/* Summary totals */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Össz. bruttó', value: calculations.reduce((s, c) => s + (c.gross_salary || 0), 0), color: 'text-slate-900 dark:text-slate-100' },
              { label: 'Össz. SZJA+TB', value: calculations.reduce((s, c) => s + (c.szja_amount || 0) + (c.tb_amount || 0), 0), color: 'text-red-600' },
              { label: isKiva ? 'Össz. SZOCHO (KIVA)' : 'Össz. SZOCHO', value: calculations.reduce((s, c) => s + getSzocho(c), 0), color: 'text-violet-600' },
              { label: 'Össz. Home Office', value: totalHomeOffice, color: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'Össz. Kifizetendő', value: totalFinalPayout, color: 'text-green-600 font-extrabold' },
            ].map((item) => (
              <div key={item.label} className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-center">
                <p className="text-[10px] font-medium text-slate-500 uppercase">{item.label}</p>
                <p className={cn('text-base md:text-lg font-bold mt-0.5 font-mono', item.color)}>
                  {item.value.toLocaleString('hu-HU')} Ft
                </p>
              </div>
            ))}
          </div>

          {/* Detail table */}
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border dark:bg-slate-900/30">
                  <th className="px-3 py-2 text-left font-medium text-slate-500 uppercase">Név</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-500 uppercase">Bruttó</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-500 uppercase">Prémium</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-500 uppercase">SZJA</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-500 uppercase">TB</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-500 uppercase">SZOCHO</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-500 uppercase">Home Office (Adómentes)</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-500 uppercase">Kifizetendő Nettó</th>
                  <th className="px-3 py-2 text-center font-medium text-slate-500 uppercase">Bérjegyzék</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {calculations.map((calc) => {
                  const hoAmount = getHomeOffice(calc.employment_id);
                  const bonusAmount = getBonus(calc.employment_id);
                  const finalPayout = (calc.net_salary || 0) + hoAmount;

                  return (
                    <tr key={calc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-3 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                        {getCalcName(calc)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono">{(calc.gross_salary || 0).toLocaleString('hu-HU')}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-emerald-600 font-semibold">
                        {bonusAmount > 0 ? bonusAmount.toLocaleString('hu-HU') : '-'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-red-600">{(calc.szja_amount || 0).toLocaleString('hu-HU')}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-blue-600">{(calc.tb_amount || 0).toLocaleString('hu-HU')}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-violet-600">{getSzocho(calc).toLocaleString('hu-HU')}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-emerald-600 font-semibold">
                        {hoAmount > 0 ? `${hoAmount.toLocaleString('hu-HU')} Ft` : '-'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold font-mono text-green-600 text-sm">
                        {finalPayout.toLocaleString('hu-HU')} Ft
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePrintPayslip(calc)}
                          className="h-7 px-2"
                          title="Bérjegyzék nyomtatása"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-slate-50/80 dark:bg-slate-900/50 font-bold">
                  <td className="px-3 py-2.5 text-slate-900 dark:text-slate-100">ÖSSZESEN</td>
                  <td className="px-3 py-2.5 text-right font-mono">{calculations.reduce((s, c) => s + (c.gross_salary || 0), 0).toLocaleString('hu-HU')}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-emerald-600">{calculations.reduce((s, c) => s + getBonus(c.employment_id), 0).toLocaleString('hu-HU')}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-red-600">{calculations.reduce((s, c) => s + (c.szja_amount || 0), 0).toLocaleString('hu-HU')}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-blue-600">{calculations.reduce((s, c) => s + (c.tb_amount || 0), 0).toLocaleString('hu-HU')}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-violet-600">{calculations.reduce((s, c) => s + getSzocho(c), 0).toLocaleString('hu-HU')}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-emerald-600">{totalHomeOffice.toLocaleString('hu-HU')} Ft</td>
                  <td className="px-3 py-2.5 text-right font-mono text-green-600 font-extrabold text-sm">{totalFinalPayout.toLocaleString('hu-HU')} Ft</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex-1">
              <p className="text-sm text-green-700 dark:text-green-300">
                <CheckCircle2 className="w-4 h-4 inline mr-1" />
                <strong>{calculations.length}</strong> foglalkoztatott számfejtése kész. Lezáráshoz kattints a "Ciklus lezárása" gombra.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePrintAllPayslips ? handlePrintAllPayslips() : calculations.forEach(c => handlePrintPayslip(c))}
              className="flex items-center gap-1.5 shrink-0"
            >
              <Printer className="w-3.5 h-3.5" /> Összes bérjegyzék
            </Button>
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Még nincs futtatott számfejtés ebben a ciklusban.
            </p>
          </div>
          <Button
            onClick={() => cycle && companyId && runBatch.mutate({
              cycleId: cycle.id,
              companyId,
              year: cycle.year,
              month: cycle.month,
            })}
            disabled={runBatch.isPending}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center gap-2 py-3"
          >
            {runBatch.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Számfejtés folyamatban...</>
            ) : (
              <><Play className="w-4 h-4" /> Számfejtés futtatása ({activeEmployees.length} fő)</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
