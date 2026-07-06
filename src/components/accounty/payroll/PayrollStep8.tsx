import React from 'react';
import { Play, Printer, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PayrollStep8Props {
  calculations: any[];
  activeEmployees: any[];
  cycle: any;
  companyId: string;
  runBatch: any;
  getCalcName: (calc: any) => string;
  handlePrintPayslip: (calc: any) => void;
}

export default function PayrollStep8({
  calculations,
  activeEmployees,
  cycle,
  companyId,
  runBatch,
  getCalcName,
  handlePrintPayslip,
}: PayrollStep8Props) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Véglegesítés: bruttó→nettó összesítő, jóváhagyás, bérjegyzék és dokumentumok generálása.
      </p>
      {calculations.length > 0 ? (
        <>
          {/* Summary totals */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Össz. bruttó', value: calculations.reduce((s, c) => s + (c.gross_salary || 0), 0), color: 'text-slate-900 dark:text-slate-100' },
              { label: 'Össz. SZJA+TB', value: calculations.reduce((s, c) => s + (c.szja_amount || 0) + (c.tb_amount || 0), 0), color: 'text-red-600' },
              { label: 'Össz. SZOCHO', value: calculations.reduce((s, c) => s + (c.szocho_amount || 0), 0), color: 'text-violet-600' },
              { label: 'Össz. nettó', value: calculations.reduce((s, c) => s + (c.net_salary || 0), 0), color: 'text-green-600' },
            ].map((item) => (
              <div key={item.label} className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-center">
                <p className="text-[10px] font-medium text-slate-500 uppercase">{item.label}</p>
                <p className={cn('text-lg font-bold mt-0.5 font-mono', item.color)}>
                  {item.value.toLocaleString('hu-HU')} Ft
                </p>
              </div>
            ))}
          </div>

          {/* Detail table */}
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border dark:bg-slate-900/30">
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Név</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Bruttó</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">SZJA</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">TB</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">SZOCHO</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Levonás</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Nettó</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-slate-500 uppercase">Bérjegyzék</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {calculations.map((calc) => {
                  return (
                    <tr key={calc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100">
                        {getCalcName(calc)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-sm font-mono">{(calc.gross_salary || 0).toLocaleString('hu-HU')}</td>
                      <td className="px-4 py-2.5 text-right text-sm font-mono text-red-600">{(calc.szja_amount || 0).toLocaleString('hu-HU')}</td>
                      <td className="px-4 py-2.5 text-right text-sm font-mono text-blue-600">{(calc.tb_amount || 0).toLocaleString('hu-HU')}</td>
                      <td className="px-4 py-2.5 text-right text-sm font-mono text-violet-600">{(calc.szocho_amount || 0).toLocaleString('hu-HU')}</td>
                      <td className="px-4 py-2.5 text-right text-sm font-mono text-orange-600">{(calc.total_deductions || 0).toLocaleString('hu-HU')}</td>
                      <td className="px-4 py-2.5 text-right text-sm font-bold font-mono text-green-600">{(calc.net_salary || 0).toLocaleString('hu-HU')}</td>
                      <td className="px-4 py-2.5 text-center">
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
                  <td className="px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100">ÖSSZESEN</td>
                  <td className="px-4 py-2.5 text-right text-sm font-mono">{calculations.reduce((s, c) => s + (c.gross_salary || 0), 0).toLocaleString('hu-HU')}</td>
                  <td className="px-4 py-2.5 text-right text-sm font-mono text-red-600">{calculations.reduce((s, c) => s + (c.szja_amount || 0), 0).toLocaleString('hu-HU')}</td>
                  <td className="px-4 py-2.5 text-right text-sm font-mono text-blue-600">{calculations.reduce((s, c) => s + (c.tb_amount || 0), 0).toLocaleString('hu-HU')}</td>
                  <td className="px-4 py-2.5 text-right text-sm font-mono text-violet-600">{calculations.reduce((s, c) => s + (c.szocho_amount || 0), 0).toLocaleString('hu-HU')}</td>
                  <td className="px-4 py-2.5 text-right text-sm font-mono text-orange-600">{calculations.reduce((s, c) => s + (c.total_deductions || 0), 0).toLocaleString('hu-HU')}</td>
                  <td className="px-4 py-2.5 text-right text-sm font-mono text-green-600">{calculations.reduce((s, c) => s + (c.net_salary || 0), 0).toLocaleString('hu-HU')}</td>
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
              onClick={() => calculations.forEach(c => handlePrintPayslip(c))}
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
