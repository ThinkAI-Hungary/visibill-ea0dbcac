import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { useDateRange } from '@/contexts/DateRangeContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  FileX2,
  ArrowDownLeft,
  ArrowUpRight,
  Unlink,
  Link2,
  ChevronRight,
  Landmark,
  CreditCard,
  FileText,
} from 'lucide-react';
import { format } from 'date-fns';
import { getDateFnsLocale, getActiveLocale } from '@/lib/locale/formatters';
import { cn, formatCurrency } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { useScopedNavigate } from '@/lib/navigation';

interface UnmatchedNavInvoice {
  id: string;
  invoice_number: string;
  invoice_direction: string | null;
  invoice_issue_date: string | null;
  supplier_name: string | null;
  customer_name: string | null;
  invoice_gross_amount: number | null;
  currency: string | null;
  payment_method: string | null;
}

interface UnmatchedTransaction {
  id: string;
  transaction_date: string;
  amount: number;
  description: string | null;
  currency: string | null;
  type: string | null;
}

const fetchAllUnmatchedNav = async (companyId: string, dateFrom: string, dateTo: string) => {
  const fetchForDirection = async (direction: 'INBOUND' | 'OUTBOUND') => {
    const PAGE_SIZE = 1000;
    const items: UnmatchedNavInvoice[] = [];
    let page = 1;
    while (true) {
      const { data, error } = await supabase.rpc('get_filtered_nav_invoices', {
        p_company_id: companyId,
        p_date_from: dateFrom,
        p_date_to: dateTo,
        p_direction: direction,
        p_kpi_filter: 'unmatched',
        p_page: page,
        p_page_size: PAGE_SIZE,
      });
      if (error) throw error;
      const rows = (data || []) as unknown as UnmatchedNavInvoice[];
      items.push(...rows);
      if (rows.length < PAGE_SIZE) break;
      page++;
    }
    return items;
  };

  const [inbound, outbound] = await Promise.all([
    fetchForDirection('INBOUND'),
    fetchForDirection('OUTBOUND'),
  ]);

  const combined = [...inbound, ...outbound];

  // Exclude 0 Ft / zero gross items as no bank transaction exists for 0 Ft
  const nonZero = combined.filter((inv) => Math.abs(Number(inv.invoice_gross_amount) || 0) > 0);

  // Sort descending by invoice_issue_date
  nonZero.sort((a, b) => (b.invoice_issue_date || '').localeCompare(a.invoice_issue_date || ''));

  return nonZero;
};

const UnmatchedSection = () => {
  const { t } = useTranslation(['dashboard', 'common']);
  const scopedNavigate = useScopedNavigate();
  const { selectedCompany } = useCompany();
  const { dateFromFormatted, dateToFormatted } = useDateRange();
  const companyId = selectedCompany?.id || '';

  const [activeTab, setActiveTab] = useState<'nav' | 'transactions'>('nav');
  const [visibleNavCount, setVisibleNavCount] = useState(25);
  const [visibleTxCount, setVisibleTxCount] = useState(25);

  const isHr = getActiveLocale() === 'hr';
  const dateFormatPattern = isHr ? 'dd.MM.yyyy.' : 'yyyy. MM. dd.';

  // Fetch unmatched NAV invoices
  const { data: unmatchedNav = [], isLoading: navLoading } = useQuery({
    queryKey: ['unmatchedNavInvoices', companyId, dateFromFormatted, dateToFormatted],
    queryFn: () => fetchAllUnmatchedNav(companyId, dateFromFormatted, dateToFormatted),
    enabled: !!companyId,
  });

  // Fetch unmatched transactions (filtering out bank fees, taxes, ATM and no-invoice transactions)
  const { data: unmatchedTx = [], isLoading: txLoading } = useQuery({
    queryKey: ['unmatchedTransactions', companyId, dateFromFormatted, dateToFormatted],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      const all: UnmatchedTransaction[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('transactions')
          .select('id, transaction_date, amount, description, currency, type')
          .eq('company_id', companyId)
          .is('matched_invoice_id', null)
          .not('match_type', 'eq', 'no_match_category')
          .not('match_type', 'eq', 'no_invoice')
          .not('match_type', 'eq', 'invoice_missing')
          .not('type', 'in', '("atm készpénzfelvét","pénztári kp felvét","pénztári kp befizetés","kp befizetés atm-en keresztül","bankköltség","járulékok/adók")')
          .gte('transaction_date', dateFromFormatted)
          .lte('transaction_date', dateToFormatted)
          .order('transaction_date', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        all.push(...(data || []));
        if (!data || data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      return all;
    },
    enabled: !!companyId,
  });

  const loading = navLoading || txLoading;

  const navTotal = useMemo(
    () => unmatchedNav.reduce((sum, inv) => sum + Math.abs(inv.invoice_gross_amount || 0), 0),
    [unmatchedNav]
  );

  const txTotal = useMemo(
    () => unmatchedTx.reduce((sum, tx) => sum + Math.abs(tx.amount || 0), 0),
    [unmatchedTx]
  );

  return (
    <Card className="h-[520px] flex flex-col overflow-hidden border-border/80 shadow-card">
      {/* Header matching 3-card grid visual rhythm */}
      <CardHeader className="px-5 py-3.5 border-b border-border/40 shrink-0 space-y-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Unlink className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold leading-tight text-foreground">
                {t('dashboard:unmatched_items.title', 'Nem párosított tételek')}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                {t('dashboard:unmatched_items.description', 'Banki fedezet vagy számlapár nélküli bizonylatok')}
              </CardDescription>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1 text-xs font-medium"
            onClick={() => scopedNavigate(activeTab === 'nav' ? 'invoices' : 'transactions')}
          >
            {activeTab === 'nav'
              ? t('dashboard:unmatched_items.view_invoices', 'Számlák')
              : t('dashboard:unmatched_items.view_transactions', 'Tranzakciók')}
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>

      {/* Modern pill tab switcher with badge count pills */}
      <div className="px-4 pt-2.5 pb-2 shrink-0">
        <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-lg">
          <button
            type="button"
            data-tab="nav"
            onClick={() => setActiveTab('nav')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-md text-xs font-medium transition-all",
              activeTab === 'nav'
                ? "bg-card text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>{t('dashboard:unmatched_items.nav_invoices', 'NAV számlák')}</span>
            <span
              className={cn(
                "text-[10px] px-1.5 py-0.2 rounded-full font-semibold",
                activeTab === 'nav'
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {unmatchedNav.length}
            </span>
          </button>

          <button
            type="button"
            data-tab="transactions"
            onClick={() => setActiveTab('transactions')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-md text-xs font-medium transition-all",
              activeTab === 'transactions'
                ? "bg-card text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Landmark className="h-3.5 w-3.5" />
            <span>{t('dashboard:unmatched_items.transactions', 'Tranzakciók')}</span>
            <span
              className={cn(
                "text-[10px] px-1.5 py-0.2 rounded-full font-semibold",
                activeTab === 'transactions'
                  ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {unmatchedTx.length}
            </span>
          </button>
        </div>
      </div>

      {/* Stat Strip: Quick financial summary for the active tab */}
      <div className="px-4 py-2 border-y border-border/30 bg-muted/20 shrink-0 flex items-center justify-between text-xs">
        {activeTab === 'nav' ? (
          <>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">
                {t('dashboard:unmatched_items.open_balance', 'Nyitott egyenleg:')}
              </span>
              <span className="font-semibold text-primary tabular-nums">
                {formatCurrency(navTotal)}
              </span>
            </div>
            <span className="text-muted-foreground text-[11px] tabular-nums">
              {unmatchedNav.length} {t('dashboard:unmatched_items.items', 'db számla')}
            </span>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">
                {t('dashboard:unmatched_items.unmatched_amount', 'Párosítatlan összeg:')}
              </span>
              <span className="font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums">
                {formatCurrency(txTotal)}
              </span>
            </div>
            <span className="text-muted-foreground text-[11px] tabular-nums">
              {unmatchedTx.length} {t('dashboard:unmatched_items.items', 'db tranzakció')}
            </span>
          </>
        )}
      </div>

      {/* Scrollable List Body */}
      <CardContent className="flex-1 p-0 pb-1 overflow-hidden min-h-0">
        {loading ? (
          <div className="h-full flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : activeTab === 'nav' ? (
          unmatchedNav.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
              <FileX2 className="h-10 w-10 mx-auto mb-2 opacity-30 text-primary" />
              <p className="text-sm font-semibold text-foreground">
                {t('dashboard:unmatched_items.all_nav_matched', 'Minden NAV számla párosítva van!')}
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[260px]">
                {t('dashboard:unmatched_items.empty_desc', 'Nincsenek párosítatlan tételek a kiválasztott időszakban.')}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-full px-3 py-1 [&>div>div[style]]:!block">
              <div className="divide-y divide-border/30 w-full min-w-0 pb-1">
                {unmatchedNav.slice(0, visibleNavCount).map((inv) => {
                  const isInbound = inv.invoice_direction === 'INBOUND';
                  const navTabSlug = isInbound ? 'inbound_nav' : 'outbound_nav';
                  const partnerName = isInbound ? inv.supplier_name : inv.customer_name;
                  const partnerDisplay = partnerName || '-';

                  const handleNavInvoiceClick = () => {
                    scopedNavigate(`invoices/${navTabSlug}?invoice=${inv.id}`);
                  };

                  return (
                    <div
                      key={inv.id}
                      onClick={handleNavInvoiceClick}
                      className="flex items-center justify-between py-2 px-1.5 sm:px-2 rounded-lg hover:bg-muted/40 transition-colors group cursor-pointer w-full max-w-full overflow-hidden gap-2"
                    >
                      {/* Left: Direction icon & metadata */}
                      <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                        <div
                          className={cn(
                            "w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-xs font-semibold transition-transform group-hover:scale-105",
                            isInbound
                              ? "bg-info-subtle text-info border border-info/20"
                              : "bg-success-subtle text-success border border-success/20"
                          )}
                          title={
                            isInbound
                              ? t('common:labels.inbound', 'Bejövő számla')
                              : t('common:labels.outbound', 'Kimenő számla')
                          }
                        >
                          {isInbound ? (
                            <ArrowDownLeft className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1 overflow-hidden">
                          <div className="flex items-center gap-1.5 mb-0.5 min-w-0">
                            <span className="font-semibold text-xs sm:text-sm truncate text-foreground group-hover:text-primary transition-colors block">
                              {inv.invoice_number}
                            </span>
                          </div>
                          <p
                            className="text-xs text-muted-foreground truncate w-full block"
                            title={`${partnerDisplay}${inv.payment_method ? ` • ${inv.payment_method}` : ''}`}
                          >
                            <span>{partnerDisplay}</span>
                            {inv.payment_method && (
                              <span className="opacity-70"> • {inv.payment_method}</span>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Right: Gross amount, Date & Quick Match CTA */}
                      <div className="shrink-0 text-right ml-auto flex items-center gap-2">
                        <div className="flex flex-col items-end">
                          <span
                            className={cn(
                              "text-xs sm:text-sm font-semibold tabular-nums",
                              isInbound ? "text-destructive" : "text-success"
                            )}
                          >
                            {isInbound ? '-' : '+'}
                            {formatCurrency(Math.abs(inv.invoice_gross_amount || 0), inv.currency || undefined)}
                          </span>
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            {inv.invoice_issue_date
                              ? format(new Date(inv.invoice_issue_date), dateFormatPattern, { locale: getDateFnsLocale() })
                              : '-'}
                          </span>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs font-medium gap-1 hover:bg-primary hover:text-primary-foreground hover:border-primary shrink-0 transition-all opacity-85 group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNavInvoiceClick();
                          }}
                        >
                          <Link2 className="h-3 w-3" />
                          <span className="hidden sm:inline">
                            {t('dashboard:unmatched_items.match', 'Párosít')}
                          </span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )
        ) : (
          unmatchedTx.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
              <Unlink className="h-10 w-10 mx-auto mb-2 opacity-30 text-indigo-500" />
              <p className="text-sm font-semibold text-foreground">
                {t('dashboard:unmatched_items.all_tx_matched', 'Minden tranzakció párosítva van!')}
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[260px]">
                {t('dashboard:unmatched_items.empty_desc', 'Nincsenek párosítatlan tételek a kiválasztott időszakban.')}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-full px-3 py-1 [&>div>div[style]]:!block">
              <div className="divide-y divide-border/30 w-full min-w-0 pb-1">
                {unmatchedTx.slice(0, visibleTxCount).map((tx) => {
                  const isPositive = tx.amount >= 0;
                  const descDisplay = tx.description || '-';

                  const handleTransactionClick = () => {
                    scopedNavigate(`transactions?transaction=${tx.id}`);
                  };

                  return (
                    <div
                      key={tx.id}
                      onClick={handleTransactionClick}
                      className="flex items-center justify-between py-2 px-1.5 sm:px-2 rounded-lg hover:bg-muted/40 transition-colors group cursor-pointer w-full max-w-full overflow-hidden gap-2"
                    >
                      {/* Left: Transaction icon & description */}
                      <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                        <div
                          className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-xs font-semibold bg-info-subtle text-info border border-info/20 transition-transform group-hover:scale-105"
                          title={tx.type || t('dashboard:unmatched_items.transactions', 'Tranzakció')}
                        >
                          <CreditCard className="h-3.5 w-3.5" />
                        </div>

                        <div className="min-w-0 flex-1 overflow-hidden">
                          <div className="flex items-center gap-1.5 mb-0.5 min-w-0">
                            <span className="font-semibold text-xs sm:text-sm truncate text-foreground group-hover:text-primary transition-colors block">
                              {descDisplay}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate w-full block" title={descDisplay}>
                            <span>{descDisplay}</span>
                          </p>
                        </div>
                      </div>

                      {/* Right: Amount, Date & Quick Match CTA */}
                      <div className="shrink-0 text-right ml-auto flex items-center gap-2">
                        <div className="flex flex-col items-end">
                          <span
                            className={cn(
                              "text-xs sm:text-sm font-semibold tabular-nums",
                              isPositive ? "text-success" : "text-destructive"
                            )}
                          >
                            {isPositive ? '+' : ''}
                            {formatCurrency(tx.amount, tx.currency || undefined)}
                          </span>
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            {format(new Date(tx.transaction_date), dateFormatPattern, { locale: getDateFnsLocale() })}
                          </span>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs font-medium gap-1 hover:bg-primary hover:text-primary-foreground hover:border-primary shrink-0 transition-all opacity-85 group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTransactionClick();
                          }}
                        >
                          <Link2 className="h-3 w-3" />
                          <span className="hidden sm:inline">
                            {t('dashboard:unmatched_items.match', 'Párosít')}
                          </span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )
        )}
      </CardContent>

      {/* Card Footer */}
      <div className="px-4 py-2.5 border-t border-border/40 bg-muted/15 shrink-0 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {activeTab === 'nav' ? (
            unmatchedNav.length > visibleNavCount ? (
              <button
                type="button"
                className="hover:text-foreground font-medium underline underline-offset-2 transition-colors"
                onClick={() => setVisibleNavCount((prev) => prev + 25)}
              >
                {t('dashboard:unmatched_items.more_invoices', {
                  count: unmatchedNav.length - visibleNavCount,
                  defaultValue: `+ ${unmatchedNav.length - visibleNavCount} további számla`,
                })}
              </button>
            ) : (
              `${unmatchedNav.length} ${t('dashboard:unmatched_items.items', 'db számla')}`
            )
          ) : unmatchedTx.length > visibleTxCount ? (
            <button
              type="button"
              className="hover:text-foreground font-medium underline underline-offset-2 transition-colors"
              onClick={() => setVisibleTxCount((prev) => prev + 25)}
            >
              {t('dashboard:unmatched_items.more_tx', {
                count: unmatchedTx.length - visibleTxCount,
                defaultValue: `+ ${unmatchedTx.length - visibleTxCount} további tranzakció`,
              })}
            </button>
          ) : (
            `${unmatchedTx.length} ${t('dashboard:unmatched_items.items', 'db tranzakció')}`
          )}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-primary hover:text-primary hover:bg-primary-subtle gap-1 font-medium"
          onClick={() => scopedNavigate('transactions')}
        >
          {t('dashboard:unmatched_items.open_all', 'Összes megnyitása')}
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </Card>
  );
};

export default UnmatchedSection;
