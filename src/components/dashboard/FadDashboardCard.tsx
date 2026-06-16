import React from 'react';
import { ShieldAlert, TrendingUp, ArrowUpRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getFadCategory, getAllFadCategories } from '@/lib/fad/fadTypes';
import { cn } from '@/lib/utils';

interface FadDashboardCardProps {
  /** Total number of FAD invoices in the period */
  totalCount: number;
  /** Total net amount of FAD invoices */
  totalNetAmount: number;
  /** Estimated total VAT liability from FAD */
  totalEstimatedVat: number;
  /** Breakdown by category */
  byCategory: Record<string, { count: number; netAmount: number }>;
  /** Currency code */
  currency?: string;
  /** Optional click handler */
  onViewAll?: () => void;
  className?: string;
}

export default function FadDashboardCard({
  totalCount,
  totalNetAmount,
  totalEstimatedVat,
  byCategory,
  currency = 'HUF',
  onViewAll,
  className,
}: FadDashboardCardProps) {
  if (totalCount === 0) return null;

  const fmtAmount = (v: number) =>
    new Intl.NumberFormat('hu-HU', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

  const categoryEntries = Object.entries(byCategory)
    .filter(([_, v]) => v.count > 0)
    .sort((a, b) => b[1].netAmount - a[1].netAmount);

  return (
    <Card className={cn(
      'border-amber-200/60 dark:border-amber-800/40 bg-gradient-to-br from-amber-50/50 to-orange-50/30 dark:from-amber-950/20 dark:to-orange-950/10 overflow-hidden',
      className
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/15 dark:bg-amber-500/10">
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <CardTitle className="text-sm font-bold text-amber-800 dark:text-amber-300">
              Fordított adózás
            </CardTitle>
          </div>
          <Badge variant="outline" className="text-xs font-bold border-amber-300 text-amber-700 bg-amber-100/50 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-700">
            {totalCount} számla
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {/* Main stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-white/60 dark:bg-slate-900/40 p-2.5 border border-amber-200/30 dark:border-amber-800/30">
            <div className="text-[10px] text-muted-foreground mb-0.5">Nettó összeg</div>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {fmtAmount(totalNetAmount)} <span className="text-xs font-normal text-muted-foreground">{currency}</span>
            </div>
          </div>
          <div className="rounded-lg bg-amber-100/50 dark:bg-amber-950/30 p-2.5 border border-amber-300/30 dark:border-amber-700/30">
            <div className="text-[10px] text-amber-600 dark:text-amber-400 mb-0.5 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Becsült ÁFA kötelezettség
            </div>
            <div className="text-lg font-bold text-amber-800 dark:text-amber-300 tabular-nums">
              {fmtAmount(totalEstimatedVat)} <span className="text-xs font-normal text-amber-600/70 dark:text-amber-400/60">{currency}</span>
            </div>
          </div>
        </div>

        {/* Category breakdown */}
        {categoryEntries.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Kategória bontás
            </div>
            {categoryEntries.map(([catKey, data]) => {
              const meta = getFadCategory(catKey);
              if (!meta) return null;
              const pct = totalNetAmount > 0 ? Math.round((data.netAmount / totalNetAmount) * 100) : 0;
              return (
                <div key={catKey} className="flex items-center gap-2 text-xs">
                  <div className={cn('w-2 h-2 rounded-full', meta.color.replace('/10', ''))} />
                  <span className="flex-1 text-slate-700 dark:text-slate-300 truncate">{meta.shortLabel}</span>
                  <span className="tabular-nums text-muted-foreground">{data.count}×</span>
                  <span className="tabular-nums font-medium text-slate-900 dark:text-slate-100 w-20 text-right">
                    {fmtAmount(data.netAmount)}
                  </span>
                  <div className="w-12 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', meta.color.replace('/10', '/60'))}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* View All button */}
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 transition-colors mt-1"
          >
            Összes FAD számla <ArrowUpRight className="w-3 h-3" />
          </button>
        )}
      </CardContent>
    </Card>
  );
}
