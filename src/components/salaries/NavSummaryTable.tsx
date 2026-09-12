import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { Edit, Building2 } from 'lucide-react';
import { getStatusBadge, formatPaymentDate, getLocalizedSalaryTaxName } from '@/lib/salary-helpers';
import type { SalaryItem } from '@/lib/salary-helpers';
import { useTranslation } from 'react-i18next';

interface Props {
  navItems: SalaryItem[];
  onEdit: (item: SalaryItem) => void;
  isSingleMonth: boolean;
  periodLabel: string;
}

export function NavSummaryTable({ navItems, onEdit, isSingleMonth, periodLabel }: Props) {
  const { t } = useTranslation(['hr', 'common']);

  return (
    <Card className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-semibold">
            {isSingleMonth
              ? t('hr:salaries.nav_payments.title_single', 'NAV utalások')
              : <>{t('hr:salaries.nav_payments.title_next_period', 'NAV utalások a következő periódusra:')} <span className="text-muted-foreground font-normal">{periodLabel}</span></>}
          </h2>
        </div>

        {navItems.length > 0 ? (
          <div className="rounded-lg border border-border/50 overflow-hidden">
            <div className="grid grid-cols-[1fr_120px_140px_140px_40px] items-center bg-muted/30 px-4 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('hr:salaries.breakdown.col_name', 'Megnevezés')}</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">{t('hr:salaries.breakdown.col_status', 'Státusz')}</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">{t('hr:salaries.nav_payments.col_payment_date', 'Kifizetés ideje')}</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">{t('hr:salaries.breakdown.col_amount', 'Összeg')}</span>
              <span />
            </div>
            {navItems.map(item => {
              const statusBadge = getStatusBadge(item, t);
              return (
                <div
                  key={item.id}
                  className="grid grid-cols-[1fr_120px_140px_140px_40px] items-center px-4 py-3 border-t border-border/30 hover:bg-muted/40 transition-colors"
                >
                  <span className="font-medium">{getLocalizedSalaryTaxName(item.név, t)}</span>
                  <div className="text-center">
                    <Badge variant="outline" className={`text-xs ${statusBadge.className}`}>
                      {statusBadge.label}
                    </Badge>
                  </div>
                  <span className="font-mono text-sm tabular-nums text-muted-foreground text-center">
                    {formatPaymentDate(item.kifizetes_ideje)}
                  </span>
                  <span className="font-mono font-semibold tabular-nums text-right">
                    {formatCurrency(item.összeg)}
                  </span>
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 hover:bg-primary/10 hover:text-primary"
                      onClick={() => onEdit(item)}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
            <div className="grid grid-cols-[1fr_120px_140px_140px_40px] items-center px-4 py-3 bg-muted/20 border-t-2 border-border/60">
              <span className="font-semibold text-muted-foreground text-sm">{t('hr:salaries.nav_payments.total', 'NAV utalások összesen')}</span>
              <span />
              <span />
              <span className="font-mono font-bold tabular-nums text-right">
                {formatCurrency(navItems.reduce((sum, item) => sum + Number(item.összeg), 0))}
              </span>
              <span />
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Building2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">{t('hr:salaries.nav_payments.empty', 'Nincs NAV utalás a kiválasztott időszakban')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
