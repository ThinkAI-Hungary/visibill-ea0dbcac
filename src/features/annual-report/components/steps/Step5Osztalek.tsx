import React from 'react';
import { useTranslation } from 'react-i18next';
import { DollarSign, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/ui/date-picker';
import { formatNumberLocale } from '@/lib/locale/formatters';
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
  const { t } = useTranslation('accounting');
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
        {t('annual_report.step5.header')}
      </h2>

      {/* Auto-computed net income sync alert */}
      {needsSync && (
        <div className="flex items-center gap-2 text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 px-4 py-2.5 rounded-lg border border-amber-500/30">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>
            {t('annual_report.step5.sync_alert', {
              amount: formatNumberLocale(Math.round(computedIncome)),
            })}
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
            {t('annual_report.step5.sync_btn')}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div>
            <Label>{t('annual_report.step5.net_income')}</Label>
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
            <Label>{t('annual_report.step5.dividend')}</Label>
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
                  {t('annual_report.step5.dividend_error')}
                </p>
              )}
          </div>
          <div>
            <Label>{t('annual_report.step5.retained_earnings')}</Label>
            <Input value={getField('retained_earnings') || 0} disabled className="mt-1.5" />
          </div>
          <div>
            <Label>{t('annual_report.step5.resolution_date')}</Label>
            <DatePicker
              value={getField('dividend_resolution_date') || ''}
              onChange={(val) => setField('dividend_resolution_date', val)}
              className="mt-1.5"
              placeholder={t('annual_report.step5.select_date')}
              clearable
            />
          </div>
          <div>
            <Label>{t('annual_report.step5.resolution_number')}</Label>
            <Input
              value={getField('dividend_resolution_number') || ''}
              onChange={(e) => setField('dividend_resolution_number', e.target.value)}
              placeholder={t('annual_report.step5.resolution_number_placeholder')}
              className="mt-1.5"
            />
          </div>
        </div>

        {/* Right side: Tax Loss Carryforward Panel */}
        <div className="space-y-4">
          <div className="bg-muted/30 border border-border/40 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                {t('annual_report.step5.tax_loss_panel.title')}
              </h3>
              <Badge
                variant="outline"
                className="text-[10px] bg-indigo-500/10 text-indigo-600 border-indigo-500/20"
              >
                {t('annual_report.step5.tax_loss_panel.compliance_badge')}
              </Badge>
            </div>

            {accumulatedPriorLosses > 0 ? (
              <div className="space-y-4">
                <div className="text-xs space-y-2">
                  <p className="leading-relaxed">
                    {t('annual_report.step5.tax_loss_panel.explanation', {
                      amount: formatNumberLocale(accumulatedPriorLosses),
                    })}
                  </p>

                  <div className="border border-border/40 rounded-lg overflow-hidden bg-background">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/50 font-bold border-b text-[10px] uppercase text-muted-foreground">
                          <th className="p-2 text-left">{t('annual_report.step5.tax_loss_panel.col_year')}</th>
                          <th className="p-2 text-right">{t('annual_report.step5.tax_loss_panel.col_loss')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/20">
                        {priorLossReports.map((r) => (
                          <tr key={r.id}>
                            <td className="p-2 font-medium">{r.fiscal_year}</td>
                            <td className="p-2 text-right font-mono text-red-500">
                              -{formatNumberLocale(Math.abs(r.net_income))} Ft
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">{t('annual_report.step5.tax_loss_panel.max_deductible')}</span>
                    <span className="font-mono font-bold">
                      {formatNumberLocale(maxLossOffset)} Ft
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
                      placeholder={t('annual_report.step5.tax_loss_panel.applied_input_placeholder')}
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
                      {t('annual_report.step5.tax_loss_panel.max_btn')}
                    </Button>
                    {appliedLossOffset > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => setAppliedLossOffset(0)}
                        className="text-[10px] h-8 text-muted-foreground"
                      >
                        {t('annual_report.step5.tax_loss_panel.clear_btn')}
                      </Button>
                    )}
                  </div>
                </div>

                {appliedLossOffset > 0 && (
                  <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-3 text-xs space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">
                      {t('annual_report.step5.tax_loss_panel.calc_title')}
                    </p>
                    <div className="flex justify-between font-mono">
                      <span>{t('annual_report.step5.tax_loss_panel.orig_profit')}</span>
                      <span>{formatNumberLocale(getField('net_income') || 0)} Ft</span>
                    </div>
                    <div className="flex justify-between font-mono text-emerald-600 dark:text-emerald-400">
                      <span>{t('annual_report.step5.tax_loss_panel.loss_reduction')}</span>
                      <span>-{formatNumberLocale(appliedLossOffset)} Ft</span>
                    </div>
                    <div className="flex justify-between font-mono font-bold border-t border-emerald-500/20 pt-1 mt-1">
                      <span>{t('annual_report.step5.tax_loss_panel.reduced_tax_base')}</span>
                      <span>
                        {formatNumberLocale(
                          (getField('net_income') || 0) - appliedLossOffset
                        )}{' '}
                        Ft
                      </span>
                    </div>
                    <div className="flex justify-between font-mono text-blue-600 dark:text-blue-400 pt-1">
                      <span>{t('annual_report.step5.tax_loss_panel.tax_savings')}</span>
                      <span>{formatNumberLocale(Math.round(appliedLossOffset * 0.09))} Ft</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                {t('annual_report.step5.tax_loss_panel.no_losses')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Auto-generated resolution text */}
      {(getField('net_income') || 0) > 0 && (
        <div className="bg-muted/30 border border-border/50 rounded-xl p-4">
          <p className="text-xs font-bold text-muted-foreground mb-2">
            {t('annual_report.step5.resolution_text_title')}
          </p>
          <p className="text-sm italic">
            {t('annual_report.step5.resolution_text_template', {
              company: selectedCompany?.name || '...',
              date: getField('dividend_resolution_date') || '...',
              year: report.fiscal_year,
              netIncome: formatNumberLocale(getField('net_income') || 0),
              dividend: formatNumberLocale(getField('dividend_amount') || 0),
              retained: formatNumberLocale(getField('retained_earnings') || 0),
            })}
          </p>
        </div>
      )}
    </div>
  );
}
