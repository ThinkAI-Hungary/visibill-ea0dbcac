import React from 'react';
import { Card } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

export interface CurrencyRowItem {
  currency: string;
  amount: number | string;
  formatted?: string;
  isNegative?: boolean;
}

export interface MetricCardProps {
  title: string;
  value?: string | number;
  currencyRows?: CurrencyRowItem[];
  description?: string;
  footerBadge?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'info' | 'primary' | 'slate' | 'purple';
  onClick?: () => void;
}

const MetricCard = ({ 
  title, 
  value, 
  currencyRows, 
  description, 
  footerBadge, 
  icon: Icon, 
  trend, 
  variant = 'default', 
  onClick, 
}: MetricCardProps) => {
  const { t } = useTranslation('dashboard');
  
  const variantStyles = {
    default: 'bg-card',
    success: 'bg-gradient-to-b from-card to-success-subtle/80',
    warning: 'bg-gradient-to-b from-card to-amber-500/10 dark:to-amber-500/15',
    destructive: 'bg-gradient-to-b from-card to-destructive-subtle/80',
    info: 'bg-gradient-to-b from-card to-info-subtle/80',
    primary: 'bg-gradient-to-b from-card to-primary-subtle/80',
    slate: 'bg-gradient-to-b from-card to-slate-100/70 dark:to-slate-900/40',
    purple: 'bg-gradient-to-b from-card to-purple-50/70 dark:to-purple-950/25',
  };

  const iconBoxStyles = {
    default: 'bg-muted text-muted-foreground border border-border/40',
    success: 'bg-success-subtle text-success border border-success/20',
    warning: 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300/50 dark:border-amber-700/50',
    destructive: 'bg-destructive-subtle text-destructive border border-destructive/20',
    info: 'bg-info-subtle text-info border border-info/20',
    primary: 'bg-primary-subtle text-primary border border-primary/25',
    slate: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300/50 dark:border-slate-700/50',
    purple: 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50',
  };

  const hasMultipleCurrencies = currencyRows && currencyRows.length > 1;
  const singleCurrencyRow = currencyRows && currencyRows.length === 1 ? currencyRows[0] : null;

  return (
    <Card 
      className={cn(
        'relative overflow-hidden h-[180px] flex flex-col justify-between border border-border/80 shadow-card hover:shadow-md hover:-translate-y-0.5 transition-all duration-200',
        variantStyles[variant], 
        onClick && 'cursor-pointer hover:border-primary/50'
      )} 
      onClick={onClick}
    >
      {/* 1. Dedicated Fixed Header Bar (44px, pinned top) */}
      <div className="h-11 px-4 py-2.5 border-b border-border/40 flex items-center justify-between shrink-0">
        <span 
          className="text-[11.5px] font-bold uppercase tracking-wider text-muted-foreground truncate pr-2" 
          title={title}
        >
          {title}
        </span>
        <div className={cn('w-7 h-7 rounded-md flex items-center justify-center shrink-0', iconBoxStyles[variant])}>
          <Icon className="h-4 w-4 shrink-0" />
        </div>
      </div>

      {/* 2. Middle Content Area (Structured Rows OR Single Value) */}
      <div className="px-4 py-2 flex-1 flex flex-col justify-center">
        {hasMultipleCurrencies ? (
          <div className="flex flex-col justify-center gap-1.5 w-full">
            {currencyRows.map((row) => (
              <div 
                key={row.currency} 
                className="flex items-center justify-between text-xs sm:text-[13px] leading-tight pb-1.5 border-b border-primary/25 last:border-b-0 last:pb-0"
              >
                <span className="font-bold px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary border border-primary/20 tracking-wider uppercase">
                  {row.currency}
                </span>
                <span className={cn(
                  'font-semibold tabular-nums text-foreground tracking-tight',
                  row.isNegative && 'text-destructive'
                )}>
                  {row.formatted ?? row.amount}
                </span>
              </div>
            ))}
          </div>
        ) : singleCurrencyRow ? (
          <div className={cn(
            'text-2xl font-bold tabular-nums tracking-tight text-foreground truncate',
            singleCurrencyRow.isNegative && 'text-destructive'
          )}>
            {singleCurrencyRow.formatted ?? singleCurrencyRow.amount}
          </div>
        ) : (
          <div className="text-2xl font-bold tabular-nums tracking-tight text-foreground truncate">
            {value ?? '—'}
          </div>
        )}
      </div>

      {/* 3. Pinned Footer Bar (32px, pinned bottom) */}
      <div className="h-8 px-4 py-1.5 border-t border-border/40 bg-transparent text-[11px] text-muted-foreground flex items-center justify-between shrink-0">
        <span className="truncate max-w-[150px] font-medium" title={description}>
          {description || '—'}
        </span>
        {footerBadge ? (
          <span className="font-semibold text-foreground shrink-0 text-[10.5px]">
            {footerBadge}
          </span>
        ) : hasMultipleCurrencies ? (
          <span className="font-semibold text-muted-foreground shrink-0 text-[10.5px]">
            {t('kpis.currencies_count', { count: currencyRows.length, defaultValue: `${currencyRows.length} deviza` })}
          </span>
        ) : trend ? (
          <div className="flex items-center shrink-0">
            <span className={cn(
              'font-semibold tabular-nums',
              trend.isPositive ? 'text-success' : 'text-destructive'
            )}>
              {trend.isPositive ? '+' : ''}{trend.value}%
            </span>
            <span className="text-[10px] text-muted-foreground ml-1">
              {t('kpis.vs_previous_month', { defaultValue: 'előző hó' })}
            </span>
          </div>
        ) : null}
      </div>
    </Card>
  );
};

export default MetricCard;

