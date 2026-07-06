import React from 'react';

interface PayrollStep6Props {
  calculations: any[];
  getCalcName: (calc: any) => string;
}

export default function PayrollStep6({
  calculations,
  getCalcName,
}: PayrollStep6Props) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        SZJA (15%), TB járulék (18.5%), SZOCHO (13%) kalkuláció az adómotor segítségével.
      </p>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center border border-red-200 dark:border-red-800">
          <p className="text-[10px] font-bold text-red-600 uppercase">SZJA</p>
          <p className="text-lg font-bold text-red-700 dark:text-red-400">15%</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center border border-blue-200 dark:border-blue-800">
          <p className="text-[10px] font-bold text-blue-600 uppercase">TB járulék</p>
          <p className="text-lg font-bold text-blue-700 dark:text-blue-400">18.5%</p>
        </div>
        <div className="bg-violet-50 dark:bg-violet-900/20 rounded-lg p-3 text-center border border-violet-200 dark:border-violet-800">
          <p className="text-[10px] font-bold text-violet-600 uppercase">SZOCHO</p>
          <p className="text-lg font-bold text-violet-700 dark:text-violet-400">13%</p>
        </div>
      </div>
      {calculations.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border dark:bg-slate-900/30">
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Név</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">SZJA</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">TB</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">SZOCHO</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Nettó</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {calculations.map((calc) => {
                return (
                  <tr key={calc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100">
                      {getCalcName(calc)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm font-mono text-red-600">
                      {(calc.szja_amount || 0).toLocaleString('hu-HU')} Ft
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm font-mono text-blue-600">
                      {(calc.tb_amount || 0).toLocaleString('hu-HU')} Ft
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm font-mono text-violet-600">
                      {(calc.szocho_amount || 0).toLocaleString('hu-HU')} Ft
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm font-bold font-mono text-green-600">
                      {(calc.net_salary || 0).toLocaleString('hu-HU')} Ft
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <p className="text-sm text-amber-700 dark:text-amber-300">
            A számfejtés futtatásához lépj tovább a Számfejtés lépésre (8. lépés).
          </p>
        </div>
      )}
    </div>
  );
}
