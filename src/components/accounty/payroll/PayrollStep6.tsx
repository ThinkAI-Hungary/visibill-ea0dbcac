import React from 'react';
import { SzochoAdvisor } from './SzochoAdvisor';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { RotateCcw, Loader2, Play, Clock, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PayrollStep6Props {
  calculations: any[];
  getCalcName: (calc: any) => string;
  companyId: string;
  cycle?: any;
  activeEmployees?: any[];
  runBatch?: any;
}

export default function PayrollStep6({
  calculations,
  getCalcName,
  companyId,
  cycle,
  activeEmployees = [],
  runBatch,
}: PayrollStep6Props) {
  const [isKiva, setIsKiva] = React.useState(false);

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

  const getSzocho = (calc: any) => {
    if (isKiva) return 0;
    if (calc.szocho_amount !== undefined && calc.szocho_amount !== null) {
      return calc.szocho_amount;
    }
    return Math.round((calc.gross_salary || 0) * 0.13);
  };

  const lastCalcDate = React.useMemo(() => {
    const raw = calculations[0]?.metadata?.calculated_at;
    if (!raw) return null;
    try {
      const d = new Date(raw);
      return d.toLocaleDateString('hu-HU', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return null;
    }
  }, [calculations]);

  const handleRecalculate = () => {
    if (!cycle?.id || !companyId || !runBatch) return;
    runBatch.mutate({
      cycleId: cycle.id,
      companyId,
      year: cycle.year,
      month: cycle.month,
    });
  };

  const isCalculating = runBatch?.isPending;

  return (
    <div className="space-y-6">
      {companyId && <SzochoAdvisor companyId={companyId} />}
      
      {isKiva && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-400 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm">🟢 KIVA adózási profil aktív</span>
            <span className="text-xs opacity-90">— A KIVA kiváltja a munkáltatói SZOCHO-t (Munkáltatói SZOCHO: 0 Ft)</span>
          </div>
        </div>
      )}

      {/* Header bar with recalculate action */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            SZJA (15%), TB Járulék (18.5%), SZOCHO (13% / KIVA esetén 0 Ft) kalkuláció az adómotor segítségével.
          </p>
          {lastCalcDate && (
            <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3 inline" /> Utolsó számfejtés: <span className="font-medium text-slate-600 dark:text-slate-400">{lastCalcDate}</span>
            </p>
          )}
        </div>

        {runBatch && cycle && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRecalculate}
            disabled={isCalculating}
            className="flex items-center gap-1.5 shrink-0 hover:bg-primary/10 hover:text-primary transition-colors"
          >
            {isCalculating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Számfejtés folyamatban...</span>
              </>
            ) : (
              <>
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Számfejtés újrafuttatása</span>
              </>
            )}
          </Button>
        )}
      </div>

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
          <p className="text-lg font-bold text-violet-700 dark:text-violet-400">{isKiva ? '0% (KIVA)' : '13%'}</p>
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
                      {getSzocho(calc).toLocaleString('hu-HU')} Ft
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
        <div className="p-6 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 text-center space-y-3">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            Még nem futott le a számfejtés ebben a ciklusban.
          </p>
          {runBatch && cycle ? (
            <Button
              onClick={handleRecalculate}
              disabled={isCalculating}
              className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center gap-2 mx-auto"
            >
              {isCalculating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Számfejtés folyamatban...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Számfejtés indítása ({activeEmployees.length} fő)</span>
                </>
              )}
            </Button>
          ) : (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              A számfejtés futtatásához lépj tovább a Számfejtés lépésre (8. lépés).
            </p>
          )}
        </div>
      )}
    </div>
  );
}
