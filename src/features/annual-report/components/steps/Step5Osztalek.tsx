import React from 'react';
import { DollarSign, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/ui/date-picker';
import { formatHungarianNumber } from '@/lib/documents/encoding/hungarianEncoding';
import type { AnnualReport } from '../../types';

interface Step5OsztalekProps {
  report: AnnualReport;
  selectedCompany: any;
  getField: (field: keyof AnnualReport) => any;
  setField: (field: string, value: any, extras?: Record<string, any>) => void;
  taxLoss: {
    priorLossReports: Array<{ id: string; fiscal_year: number; net_income: number }>;
    accumulatedPriorLosses: number;
    maxLossOffset: number;
    appliedLossOffset: number;
  };
  setAppliedLossOffset: (val: number) => void;
}

export function Step5Osztalek({
  report,
  selectedCompany,
  getField,
  setField,
  taxLoss,
  setAppliedLossOffset,
}: Step5OsztalekProps) {
  const pnl = (report.frozen_pnl_data as any[]) || [];
  const computedIncome = pnl
    .filter((r: any) => r.type === 'roman')
    .reduce((a: number, r: any) => a + Number(r.balance || 0) * Number(r.multiplier || 1), 0);
  const currentNetIncome = getField('net_income') || 0;
  const needsSync = report.frozen_at && Math.abs(computedIncome - currentNetIncome) > 1;

  const { priorLossReports, accumulatedPriorLosses, maxLossOffset, appliedLossOffset } = taxLoss;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <DollarSign className="w-5 h-5 text-primary" />
        5. Osztalék és Eredményfelosztás
      </h2>

      {/* Auto-computed net income sync alert */}
      {needsSync && (
        <div className="flex items-center gap-2 text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 px-4 py-2.5 rounded-lg border border-amber-500/30">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>
            A befagyasztott P&L alapján az adózott eredmény:{' '}
            <strong>{formatHungarianNumber(Math.round(computedIncome))} Ft</strong>
          </span>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto h-6 px-2 text-[10px] gap-1"
            onClick={() => {
              const ni = Math.round(computedIncome);
              setField('net_income', ni, {
                retained_earnings: ni - (getField('dividend_amount') || 0),
              });
            }}
          >
            <RefreshCw className="w-3 h-3" />
            Szinkronizálás
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div>
            <Label>Adózott eredmény (Ft)</Label>
            <Input
              type="number"
              value={getField('net_income') || 0}
              onChange={(e) => {
                const ni = Number(e.target.value);
                setField('net_income', ni, {
                  retained_earnings: ni - (getField('dividend_amount') || 0),
                });
              }}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Osztalék (Ft)</Label>
            <Input
              type="number"
              value={getField('dividend_amount') || 0}
              onChange={(e) => {
                const div = Number(e.target.value);
                const ni = getField('net_income') || 0;
                setField('dividend_amount', div, { retained_earnings: ni - div });
              }}
              className="mt-1.5"
            />
            {(getField('dividend_amount') || 0) > (getField('net_income') || 0) &&
              (getField('net_income') || 0) > 0 && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Az osztalék nem haladhatja meg az adózott eredményt!
                </p>
              )}
          </div>
          <div>
            <Label>Eredménytartalékba (Ft)</Label>
            <Input value={getField('retained_earnings') || 0} disabled className="mt-1.5" />
          </div>
          <div>
            <Label>Határozat dátuma</Label>
            <DatePicker
              value={getField('dividend_resolution_date') || ''}
              onChange={(val) => setField('dividend_resolution_date', val)}
              className="mt-1.5"
              placeholder="Válassz dátumot"
              clearable
            />
          </div>
          <div>
            <Label>Határozat száma</Label>
            <Input
              value={getField('dividend_resolution_number') || ''}
              onChange={(e) => setField('dividend_resolution_number', e.target.value)}
              placeholder="pl. 1/2026. (V.15.)"
              className="mt-1.5"
            />
          </div>
        </div>

        {/* Right side: Tax Loss Carryforward Panel */}
        <div className="space-y-4">
          <div className="bg-muted/30 border border-border/40 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                Veszteségelhatárolás (Tax Loss Carryforward)
              </h3>
              <Badge
                variant="outline"
                className="text-[10px] bg-indigo-500/10 text-indigo-600 border-indigo-500/20"
              >
                Sztv. & TAO Megfelelőség
              </Badge>
            </div>

            {accumulatedPriorLosses > 0 ? (
              <div className="space-y-4">
                <div className="text-xs space-y-2">
                  <p className="leading-relaxed">
                    A cégnek az előző években felhalmozott vesztesége van:{' '}
                    <strong>{formatHungarianNumber(accumulatedPriorLosses)} Ft</strong>.
                    A hatályos szabályok szerint a tárgyévi pozitív adóalap maximum{' '}
                    <strong>50%-a</strong> csökkenthető a korábbi évek elhatárolt veszteségével.
                  </p>

                  <div className="border border-border/40 rounded-lg overflow-hidden bg-background">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/50 font-bold border-b text-[10px] uppercase text-muted-foreground">
                          <th className="p-2 text-left">Üzleti év</th>
                          <th className="p-2 text-right">Veszteség összege</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/20">
                        {priorLossReports.map((r) => (
                          <tr key={r.id}>
                            <td className="p-2 font-medium">{r.fiscal_year}</td>
                            <td className="p-2 text-right font-mono text-red-500">
                              -{formatHungarianNumber(Math.abs(r.net_income))} Ft
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Maximálisan elszámolható elhatárolás (50%):</span>
                    <span className="font-mono font-bold">
                      {formatHungarianNumber(maxLossOffset)} Ft
                    </span>
                  </div>

                  <div className="flex gap-2 items-center">
                    <Input
                      type="number"
                      value={appliedLossOffset || ''}
                      onChange={(e) => {
                        const val = Math.min(
                          accumulatedPriorLosses,
                          Math.min(maxLossOffset, Number(e.target.value) || 0)
                        );
                        setAppliedLossOffset(val);
                      }}
                      placeholder="Felhasznált veszteségelhatárolás (Ft)"
                      className="text-xs font-mono h-8"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() =>
                        setAppliedLossOffset(Math.min(accumulatedPriorLosses, maxLossOffset))
                      }
                      className="text-[10px] h-8 shrink-0"
                      disabled={appliedLossOffset === Math.min(accumulatedPriorLosses, maxLossOffset)}
                    >
                      Max
                    </Button>
                    {appliedLossOffset > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => setAppliedLossOffset(0)}
                        className="text-[10px] h-8 text-muted-foreground"
                      >
                        Töröl
                      </Button>
                    )}
                  </div>
                </div>

                {appliedLossOffset > 0 && (
                  <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-3 text-xs space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">
                      Kalkulált adóalap és megtakarítás:
                    </p>
                    <div className="flex justify-between font-mono">
                      <span>Eredeti eredmény:</span>
                      <span>{formatHungarianNumber(getField('net_income') || 0)} Ft</span>
                    </div>
                    <div className="flex justify-between font-mono text-emerald-600 dark:text-emerald-400">
                      <span>Veszteségcsökkentés:</span>
                      <span>-{formatHungarianNumber(appliedLossOffset)} Ft</span>
                    </div>
                    <div className="flex justify-between font-mono font-bold border-t border-emerald-500/20 pt-1 mt-1">
                      <span>Csökkentett adóalap:</span>
                      <span>
                        {formatHungarianNumber(
                          (getField('net_income') || 0) - appliedLossOffset
                        )}{' '}
                        Ft
                      </span>
                    </div>
                    <div className="flex justify-between font-mono text-blue-600 dark:text-blue-400 pt-1">
                      <span>Társasági adó megtakarítás (9%):</span>
                      <span>{formatHungarianNumber(Math.round(appliedLossOffset * 0.09))} Ft</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Nem található korábbi veszteséges év ennél a cégnél, így nincs felhasználható
                veszteségelhatárolás.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Auto-generated resolution text */}
      {(getField('net_income') || 0) > 0 && (
        <div className="bg-muted/30 border border-border/50 rounded-xl p-4">
          <p className="text-xs font-bold text-muted-foreground mb-2">Automatikus határozat szövege:</p>
          <p className="text-sm italic">
            „A(z) {selectedCompany?.name || '...'} taggyűlése {getField('dividend_resolution_date') || '...'}-án megtartott
            ülésén a {report.fiscal_year}. üzleti év {formatHungarianNumber(getField('net_income') || 0)} Ft
            adózott eredményéből {formatHungarianNumber(getField('dividend_amount') || 0)} Ft osztalék
            kifizetéséről döntött. A fennmaradó {formatHungarianNumber(getField('retained_earnings') || 0)} Ft
            az eredménytartalékba kerül."
          </p>
        </div>
      )}
    </div>
  );
}
