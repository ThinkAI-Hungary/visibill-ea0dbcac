import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CAT, fmt } from '@/lib/kintlevo-helpers';
import type { AgingCategory, UnifiedInvoice, CompanyGroup, DateFilterBasis } from '@/lib/kintlevo-helpers';

interface Props {
  totals: Record<AgingCategory, number>;
  grandTotal: number;
  netTotals: Record<AgingCategory, number>;
  netGrandTotal: number;
  companyGroups: CompanyGroup[];
  allInvoices: UnifiedInvoice[];
  showBrutto: boolean;
  onShowBruttoChange: (v: boolean) => void;
  dateFilterBasis?: DateFilterBasis;
  onDateFilterBasisChange?: (v: DateFilterBasis) => void;
  dateFromFormatted?: string;
  dateToFormatted?: string;
  rawInvoicesCount?: number;
}

export function KintlevoSummaryCards({
  totals,
  grandTotal,
  netTotals,
  netGrandTotal,
  companyGroups,
  allInvoices,
  showBrutto,
  onShowBruttoChange,
  dateFilterBasis = 'due_date',
  onDateFilterBasisChange,
  dateFromFormatted,
  dateToFormatted,
  rawInvoicesCount,
}: Props) {
  const { t } = useTranslation(['receivables', 'common']);
  const displayTotals = showBrutto ? totals : netTotals;
  const displayGrand = showBrutto ? grandTotal : netGrandTotal;

  const getAgingLabel = (cat: AgingCategory) => {
    switch (cat) {
      case 'green': return t('receivables:aging.not_due', 'Nem lejárt');
      case 'yellow': return t('receivables:aging.days_1_30', '1–30 napos');
      case 'red': return t('receivables:aging.days_31_180', '31–180 napos');
      case 'purple': return t('receivables:aging.days_180_plus', '180+ napos');
    }
  };

  return (
    <div className="space-y-3">
      {/* Top bar: Bruttó / Nettó toggle & Date filter basis selector */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Bruttó / Nettó toggle */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onShowBruttoChange(false)}
            className={cn(
              "text-base pb-1 border-b-2 transition-all duration-200 cursor-pointer",
              !showBrutto
                ? "text-slate-900 dark:text-white font-semibold border-primary"
                : "text-slate-400 dark:text-slate-500 font-medium border-transparent hover:text-slate-600 dark:hover:text-slate-400"
            )}
          >
            {t('receivables:net', 'Nettó')}
          </button>
          <Switch checked={showBrutto} onCheckedChange={onShowBruttoChange} />
          <button
            type="button"
            onClick={() => onShowBruttoChange(true)}
            className={cn(
              "text-base pb-1 border-b-2 transition-all duration-200 cursor-pointer",
              showBrutto
                ? "text-slate-900 dark:text-white font-semibold border-primary"
                : "text-slate-400 dark:text-slate-500 font-medium border-transparent hover:text-slate-600 dark:hover:text-slate-400"
            )}
          >
            {t('receivables:gross', 'Bruttó')}
          </button>
        </div>

        {/* Date Filter Basis Selector */}
        {onDateFilterBasisChange && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-xs text-muted-foreground font-medium hidden sm:inline">
              {t('receivables:date_filter_basis', 'Időszak szűrés alapja')}:
            </span>
            <div className="inline-flex items-center p-0.5 bg-muted/60 dark:bg-muted/30 rounded-lg border border-border/50 text-xs">
              <button
                type="button"
                onClick={() => onDateFilterBasisChange('due_date')}
                className={cn(
                  "px-2.5 py-1 rounded-md transition-all font-medium cursor-pointer",
                  dateFilterBasis === 'due_date'
                    ? "bg-background text-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t('receivables:filter_by_due_date', 'Esedékesség szerint')}
              </button>
              <button
                type="button"
                onClick={() => onDateFilterBasisChange('issue_date')}
                className={cn(
                  "px-2.5 py-1 rounded-md transition-all font-medium cursor-pointer",
                  dateFilterBasis === 'issue_date'
                    ? "bg-background text-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t('receivables:filter_by_issue_date', 'Kibocsátás szerint')}
              </button>
              <button
                type="button"
                onClick={() => onDateFilterBasisChange('all')}
                className={cn(
                  "px-2.5 py-1 rounded-md transition-all font-medium cursor-pointer",
                  dateFilterBasis === 'all'
                    ? "bg-background text-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t('receivables:filter_all', 'Mind')}
              </button>
            </div>

            {dateFilterBasis !== 'all' && dateFromFormatted && dateToFormatted && (
              <Badge variant="outline" className="text-xs text-muted-foreground font-normal gap-1 py-1">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                <span>{dateFromFormatted} – {dateToFormatted}</span>
                {rawInvoicesCount !== undefined && (
                  <span className="text-muted-foreground/80 font-mono ml-0.5">
                    ({allInvoices.length}/{rawInvoicesCount})
                  </span>
                )}
              </Badge>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="col-span-2 lg:col-span-1">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">
              {t('receivables:total_receivables', 'Összes kintlévőség')} ({showBrutto ? t('receivables:gross', 'bruttó').toLowerCase() : t('receivables:net', 'nettó').toLowerCase()})
            </p>
            <p className="text-xl font-bold">{fmt(displayGrand)}</p>
            <p className="text-xs text-muted-foreground">
              {t('receivables:companies_count', '{{count}} cég', { count: companyGroups.length })} · {t('receivables:invoices_count', '{{count}} számla', { count: allInvoices.length })}
            </p>
          </CardContent>
        </Card>
        {(Object.keys(CAT) as AgingCategory[]).map(cat => {
          const c = CAT[cat];
          const Icon = c.icon;
          const invCount = allInvoices.filter(i => i.category === cat).length;
          return (
            <Card key={cat} className={cn('border', c.card)}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Icon className={cn('h-3.5 w-3.5', c.text)} />
                  <p className={cn('text-xs font-medium uppercase tracking-wide', c.text)}>{getAgingLabel(cat)}</p>
                </div>
                <p className={cn('text-xl font-bold', c.text)}>{fmt(displayTotals[cat])}</p>
                <p className="text-xs text-muted-foreground">{t('receivables:invoices_count', '{{count}} számla', { count: invCount })}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
