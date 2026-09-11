import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Mail, ChevronDown, ChevronUp, CheckCircle2, Clock } from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { getDateFnsLocale } from '@/lib/locale/formatters';
import { cn } from '@/lib/utils';
import { CAT, fmt, getAgingCategoryLabel } from '@/lib/kintlevo-helpers';
import type { CompanyGroup } from '@/lib/kintlevo-helpers';

interface Props {
  filteredGroups: CompanyGroup[];
  expanded: Set<string>;
  setExpanded: React.Dispatch<React.SetStateAction<Set<string>>>;
  isPeriodFiltered?: boolean;
  rawInvoicesCount?: number;
  onResetPeriodFilter?: () => void;
}

export function KintlevoCompanyTable({
  filteredGroups,
  expanded,
  setExpanded,
  isPeriodFiltered = false,
  rawInvoicesCount = 0,
  onResetPeriodFilter,
}: Props) {
  const { t } = useTranslation(['receivables', 'common']);

  if (filteredGroups.length === 0) {
    if (isPeriodFiltered && rawInvoicesCount > 0) {
      return (
        <div className="text-center py-16 text-muted-foreground border rounded-xl bg-card">
          <Clock className="h-10 w-10 mx-auto mb-3 text-amber-500/60" />
          <p className="text-base font-semibold text-foreground">
            {t('receivables:no_open_in_period', 'Nincs nyitott számla a kiválasztott időszakban')}
          </p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            A választott időszakon kívül {rawInvoicesCount} db nyitott számla található.
          </p>
          {onResetPeriodFilter && (
            <Button variant="outline" size="sm" onClick={onResetPeriodFilter}>
              {t('receivables:view_all_open', 'Teljes nyitott állomány megtekintése')} ({rawInvoicesCount} db)
            </Button>
          )}
        </div>
      );
    }

    return (
      <div className="text-center py-20 text-muted-foreground">
        <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-500/30" />
        <p className="text-lg font-medium">{t('receivables:empty_title', 'Nincs kintlévőség')}</p>
        <p className="text-sm">{t('receivables:empty_desc', 'Minden számla ki van egyenlítve!')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filteredGroups.map(group => {
        const c = CAT[group.worstCategory];
        const Icon = c.icon;
        const isOpen = expanded.has(group.companyName);
        const daysSince = group.lastSent
          ? differenceInDays(new Date(), parseISO(group.lastSent))
          : null;

        return (
          <div key={group.companyName} className={cn('rounded-lg border overflow-hidden', c.border, c.rowBg)}>
            {/* Company header row */}
            <div
              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:brightness-110 transition-all select-none"
              onClick={() => setExpanded(prev => {
                const n = new Set(prev);
                n.has(group.companyName) ? n.delete(group.companyName) : n.add(group.companyName);
                return n;
              })}
            >
              <div className={cn('h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold border', c.border, c.rowBg, c.text)}>
                {group.companyName.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold truncate text-sm">{group.companyName}</span>
                  {group.taxNumber && (
                    <span className="text-xs text-muted-foreground hidden sm:inline shrink-0">{group.taxNumber}</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  {(['green', 'yellow', 'red', 'purple'] as const).map(cat => {
                    const count = group.invoices.filter(inv => inv.category === cat).length;
                    if (count === 0) return null;
                    const catStyle = CAT[cat];
                    return (
                      <span key={cat} className={cn('inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md font-medium', catStyle.badge)}>
                        {count}
                        <span className="hidden sm:inline">×</span>
                        <span className="hidden sm:inline">{getAgingCategoryLabel(cat, t)}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-3">
                {daysSince !== null && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
                        <Mail className="h-3 w-3" />
                        <span>{daysSince === 0 ? t('receivables:table.today', 'Ma') : t('receivables:table.days_ago', '{{count}} napja', { count: daysSince })}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      {t('receivables:table.last_dunning', 'Utolsó felszólítás: {{date}}', {
                        date: format(parseISO(group.lastSent!), 'yyyy. MMM d.', { locale: getDateFnsLocale() })
                      })}
                    </TooltipContent>
                  </Tooltip>
                )}
                <span className="font-bold text-sm">{fmt(group.totalAmount)}</span>
                {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
            </div>

            {/* Invoice table */}
            {isOpen && (
              <div className="border-t border-current/10 bg-background/50">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-current/10">
                      <TableHead className="pl-4 text-xs w-[25%]">{t('receivables:table.invoice_number', 'Számlaszám')}</TableHead>
                      <TableHead className="text-xs w-[15%]">{t('receivables:table.issue_date', 'Kiállítva')}</TableHead>
                      <TableHead className="text-xs w-[15%]">{t('receivables:table.due_date', 'Lejárat')}</TableHead>
                      <TableHead className="text-xs w-[12%]">{t('receivables:table.overdue', 'Késés')}</TableHead>
                      <TableHead className="text-right text-xs w-[18%]">{t('receivables:table.amount', 'Összeg')}</TableHead>
                      <TableHead className="text-xs w-[10%]">{t('receivables:table.source', 'Forrás')}</TableHead>
                      <TableHead className="text-xs w-[15%]">{t('receivables:table.category', 'Kategória')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.invoices.map(inv => {
                      const ic = CAT[inv.category];
                      const IIcon = ic.icon;
                      return (
                        <TableRow key={inv.id} className={cn('border-current/5', ic.rowBg)}>
                          <TableCell className="pl-4 font-mono text-xs">{inv.invoiceNumber}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {inv.issueDate ? format(parseISO(inv.issueDate), 'yyyy.MM.dd') : '—'}
                          </TableCell>
                          <TableCell className="text-xs">{inv.dueDate.replace(/-/g, '.')}</TableCell>
                          <TableCell className="text-xs">
                            {inv.daysOverdue <= 0
                              ? <span className="text-emerald-700 dark:text-emerald-400">{t('receivables:table.not_overdue', 'Nem lejárt')}</span>
                              : <span className={ic.text}>{t('receivables:table.days', '{{count}} nap', { count: inv.daysOverdue })}</span>
                            }
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium">
                            {fmt(inv.amount)}
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">
                              {inv.source === 'nav' ? t('receivables:table.source_nav', 'NAV') : t('receivables:table.source_uploaded', 'Feltöltött')}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn('text-xs gap-1', ic.badge)}>
                              <IIcon className="h-3 w-3" />
                              {getAgingCategoryLabel(inv.category, t)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
