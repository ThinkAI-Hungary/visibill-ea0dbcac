import React from 'react';
import { Database, CheckCircle2, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatHungarianNumber } from '@/lib/documents/encoding/hungarianEncoding';
import type { AnnualReport } from '../../types';

interface Step2AdatimportProps {
  report: AnnualReport;
  freezeData: {
    mutate: () => void;
    isPending: boolean;
  };
}

export function Step2Adatimport({ report, freezeData }: Step2AdatimportProps) {
  const bs = (report.frozen_bs_data as any[]) || [];
  const pnl = (report.frozen_pnl_data as any[]) || [];
  const totalAssets = bs.find((r: any) => r.section === 'assets' && r.type === 'total');
  const totalLiab = bs.find((r: any) => r.section === 'liabilities' && r.type === 'total');
  const netIncome = pnl
    .filter((r: any) => r.type === 'roman')
    .reduce((a: number, r: any) => a + Number(r.balance || 0) * Number(r.multiplier || 1), 0);
  const assetsVal = Number(totalAssets?.current_balance || 0);
  const liabVal = Number(totalLiab?.current_balance || 0);
  const diff = assetsVal - liabVal;
  const fmtK = (v: number) => formatHungarianNumber(Math.round(v / 1000));

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <Database className="w-5 h-5 text-primary" />
        2. Mérleg & Eredménykimutatás Import
      </h2>
      <p className="text-muted-foreground">
        A rendszer befagyasztja a {report.fiscal_year}. december 31-i záró állapotot.
      </p>

      {report.frozen_at ? (
        <div className="space-y-4">
          <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold text-emerald-700 dark:text-emerald-400">Adatok befagyasztva</p>
              <p className="text-sm text-muted-foreground mt-1">
                Időpont: {new Date(report.frozen_at).toLocaleString('hu-HU')}<br />
                Mérleg sorok: {report.frozen_bs_data?.length || 0}<br />
                P&L sorok: {report.frozen_pnl_data?.length || 0}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 gap-2"
                onClick={() => freezeData.mutate()}
                disabled={freezeData.isPending}
              >
                <RefreshCw className={cn('w-4 h-4', freezeData.isPending && 'animate-spin')} />
                Újra befagyasztás
              </Button>
            </div>
          </div>

          {/* Frozen data financial summary */}
          <div className="bg-muted/20 border border-border/30 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-muted/40 border-b border-border/30">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                Befagyasztott adatok összefoglalója
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border/20">
              {[
                { label: 'Eszközök', value: `${fmtK(assetsVal)} E Ft` },
                { label: 'Források', value: `${fmtK(liabVal)} E Ft` },
                {
                  label: 'Eltérés',
                  value: `${fmtK(diff)} E Ft`,
                  color: Math.abs(diff) > 1 ? 'text-red-500' : 'text-emerald-600',
                },
                {
                  label: 'Adózott eredmény',
                  value: `${fmtK(netIncome)} E Ft`,
                  color: netIncome >= 0 ? 'text-emerald-600' : 'text-red-500',
                },
              ].map((item, i) => (
                <div key={i} className="bg-background p-3 text-center">
                  <p className="text-[10px] text-muted-foreground">{item.label}</p>
                  <p className={cn('text-sm font-bold tabular-nums mt-0.5', (item as any).color)}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <Button
          className="h-12 gap-2 text-base"
          onClick={() => freezeData.mutate()}
          disabled={freezeData.isPending}
        >
          {freezeData.isPending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Database className="w-5 h-5" />
          )}
          Adatok befagyasztása ({report.fiscal_year}.12.31)
        </Button>
      )}
    </div>
  );
}
