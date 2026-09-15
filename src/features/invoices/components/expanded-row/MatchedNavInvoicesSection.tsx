import React from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, CheckCircle2, Unlink } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InlineTransactionList } from './InlineTransactionList';
import { cn } from '@/lib/utils';
import { computePaymentStatus } from '@/hooks/useComputedStatus';
import { formatDateLocale, formatCurrencyLocale } from '@/lib/locale/formatters';
import type { MatchedNavInvoice, MatchedTransaction } from './types';

interface MatchedNavInvoicesSectionProps {
  invoices: MatchedNavInvoice[];
  transactionId?: string;
  unmatching?: boolean;
  onUnmatch?: (invoiceId: string) => void;
  hideStandaloneTransactions?: boolean;
  effectiveMatchedTransactions?: MatchedTransaction[];
}

export function MatchedNavInvoicesSection({
  invoices,
  transactionId,
  unmatching = false,
  onUnmatch,
  hideStandaloneTransactions = false,
  effectiveMatchedTransactions = [],
}: MatchedNavInvoicesSectionProps) {
  const { t } = useTranslation(['invoices', 'common']);

  if (!invoices || invoices.length === 0) return null;

  const getStatusBadge = (txId: string | null | undefined, matchStatus?: string | null) => {
    const status = computePaymentStatus(txId, matchStatus);
    if (status === 'paid') {
      return {
        label: t('invoices:status.paid', 'Kifizetve'),
        className: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20',
      };
    }
    if (status === 'partially_paid') {
      return {
        label: t('invoices:status.partial', 'Részben fizetve'),
        className: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
      };
    }
    return {
      label: t('invoices:status.unpaid', 'Nyitott'),
      className: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/20',
    };
  };

  return (
    <>
      {invoices.map((inv) => (
        <Card key={inv.id} className="bg-muted/30 border-border/50 expand-stagger-3">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-medium flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FileText className="h-3 w-3 text-muted-foreground" />
                {t('invoices:expanded_nav.title', 'Párosított NAV számla')}
              </span>
              <div
                className="flex items-center gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                {transactionId && onUnmatch && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={unmatching}
                    onClick={(e) => {
                      e.stopPropagation();
                      onUnmatch(inv.id);
                    }}
                    className="h-6 text-[10px] text-muted-foreground hover:text-destructive px-2 border border-border/40 hover:bg-destructive/10 rounded-md transition-colors gap-1"
                  >
                    <Unlink className="h-2.5 w-2.5" />
                    {t('invoices:expanded_nav.unmatch_btn', 'Párosítás megszüntetése')}
                  </Button>
                )}
                <Badge variant="success" className="gap-1 text-[10px] h-5">
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  {t('invoices:expanded_nav.matched_badge', 'Párosított')}
                </Badge>
                <div className="flex gap-1">
                  {(() => {
                    if (!inv.transaction_id && !(inv as any).match_status) return null;
                    const badge = getStatusBadge(inv.transaction_id, (inv as any).match_status);
                    return (
                      <Badge variant="outline" className={cn('text-[10px] h-5', badge.className)}>
                        {badge.label}
                      </Badge>
                    );
                  })()}
                  {inv.submitted && (
                    <Badge variant="outline" className="text-[10px] h-5">
                      {t('invoices:expanded_nav.submitted_badge', 'Beküldve')}
                    </Badge>
                  )}
                </div>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="col-span-2">
                <span className="text-muted-foreground">{t('invoices:expanded_nav.invoice_number', 'Bizonylatsorszám:')}</span>
                <span className="ml-1 font-mono font-medium">{inv.invoice_number}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t('invoices:expanded_nav.supplier', 'Eladó:')}</span>
                <span className="ml-1 font-medium">{inv.supplier_name || '-'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t('invoices:expanded_nav.customer', 'Vevő:')}</span>
                <span className="ml-1 font-medium">{inv.customer_name || '-'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t('invoices:expanded_nav.issue_date', 'Kiállítás:')}</span>
                <span className="ml-1">
                  {inv.invoice_issue_date
                    ? formatDateLocale(inv.invoice_issue_date)
                    : '-'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">{t('invoices:expanded_nav.gross', 'Bruttó:')}</span>
                <span className="ml-1 font-mono font-medium">
                  {formatCurrencyLocale(inv.invoice_gross_amount || 0, inv.currency || 'HUF')}
                </span>
              </div>
            </div>
            {/* Inline collapsible transaction list (Transactions page only, 2+ tx) */}
            {hideStandaloneTransactions && effectiveMatchedTransactions.length >= 2 && (
              <InlineTransactionList
                transactions={effectiveMatchedTransactions}
                invoiceId={inv.id}
              />
            )}
          </CardContent>
        </Card>
      ))}
    </>
  );
}
