import React from 'react';
import { Shield, CheckCircle2, XCircle, AlertTriangle, Loader2, ExternalLink, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useScopedNavigate } from '@/lib/navigation';
import type { AnnualReport, ValidationResult } from '../../types';

interface Step3ValidacioProps {
  report: AnnualReport;
  validationResults: ValidationResult[];
  validateReport: {
    mutate: () => void;
    reset: () => void;
    isPending: boolean;
    isError: boolean;
    error: any;
  };
  setCurrentStep: (step: number) => void;
}

export function Step3Validacio({
  report,
  validationResults,
  validateReport,
  setCurrentStep,
}: Step3ValidacioProps) {
  const scopedNavigate = useScopedNavigate();

  const ruleNavMap: Record<string, { type: 'step' | 'page'; target: number | string; label: string }[]> = {
    V1: [{ type: 'page', target: '/balance-sheet?tab=mapping', label: 'Mérleg hozzárendelések' }],
    V2: [
      { type: 'page', target: '/profit-and-loss?tab=mapping', label: 'Eredménykimutatás hozzárendelések' },
      { type: 'page', target: '/balance-sheet?tab=mapping', label: 'Mérleg hozzárendelések' },
    ],
    V3: [{ type: 'step', target: 1, label: 'Ugrás az 1. lépésre' }],
    V4: [{ type: 'step', target: 5, label: 'Ugrás az 5. lépésre' }],
    V5: [{ type: 'step', target: 2, label: 'Ugrás a 2. lépésre' }],
    V6: [{ type: 'page', target: '/balance-sheet', label: 'Mérleg megtekintése' }],
    V7: [{ type: 'step', target: 2, label: 'Adatok újrabefagyasztása' }],
    V8: [{ type: 'step', target: 4, label: 'Ugrás a 4. lépésre' }],
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <Shield className="w-5 h-5 text-primary" />
        3. Validáció — Az „Őrszem"
      </h2>

      <div className="flex items-center gap-3">
        <Button
          onClick={() => {
            validateReport.reset();
            validateReport.mutate();
          }}
          disabled={validateReport.isPending || !report.frozen_at}
          className="gap-2"
        >
          {validateReport.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Shield className="w-4 h-4" />
          )}
          {validationResults.length > 0 ? 'Újra ellenőrzés' : 'Ellenőrzések futtatása'}
        </Button>
        {validateReport.isError && (
          <p className="text-sm text-red-500">
            Hiba: {(validateReport.error as any)?.message || 'Ismeretlen hiba'}
          </p>
        )}
      </div>

      {!report.frozen_at && (
        <p className="text-amber-600 text-sm">⚠️ Először fagyaszd be az adatokat a 2. lépésben!</p>
      )}

      {validationResults.length > 0 && (
        <div className="space-y-3">
          {validationResults.map((r: ValidationResult) => {
            const navActions = ruleNavMap[r.rule_id] || [];

            return (
              <div
                key={r.rule_id}
                className={cn(
                  'flex items-start gap-3 p-4 rounded-xl border',
                  r.passed
                    ? 'bg-emerald-500/5 border-emerald-500/20'
                    : r.severity === 'error'
                    ? 'bg-red-500/5 border-red-500/20'
                    : 'bg-amber-500/5 border-amber-500/20'
                )}
              >
                {r.passed ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5" />
                ) : r.severity === 'error' ? (
                  <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">
                    {r.rule_id}: {r.rule_name}
                  </p>
                  <p className="text-sm text-muted-foreground">{r.message}</p>
                </div>
                {!r.passed && navActions.length > 0 && (
                  <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                    {navActions.map((action, actionIdx) => (
                      <Button
                        key={actionIdx}
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs h-8"
                        onClick={() => {
                          if (action.type === 'step') {
                            setCurrentStep(action.target as number);
                          } else {
                            scopedNavigate(action.target as string);
                          }
                        }}
                      >
                        {action.type === 'page' ? (
                          <ExternalLink className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                        {action.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
