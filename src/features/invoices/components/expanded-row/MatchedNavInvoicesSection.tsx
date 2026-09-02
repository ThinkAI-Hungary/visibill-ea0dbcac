import React from 'react';
import { FileText, CheckCircle2, Unlink } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InlineTransactionList } from './InlineTransactionList';
import { formatCurrency, cn } from '@/lib/utils';
import { getPaymentStatusBadge } from '@/hooks/useComputedStatus';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
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
  if (!invoices || invoices.length === 0) return null;

  return (
    <>
      {invoices.map((inv) => (
        <Card key={inv.id} className="bg-muted/30 border-border/50 expand-stagger-3">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-medium flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FileText className="h-3 w-3 text-muted-foreground" />
                Párosított NAV számla
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
                    Párosítás megszüntetése
                  </Button>
                )}
                <Badge variant="success" className="gap-1 text-[10px] h-5">
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  Párosított
                </Badge>
                <div className="flex gap-1">
                  {(() => {
                    if (!inv.transaction_id && !(inv as any).match_status) return null;
                    const badge = getPaymentStatusBadge(inv.transaction_id, (inv as any).match_status);
                    return (
                      <Badge variant="outline" className={cn('text-[10px] h-5', badge.className)}>
                        {badge.label}
                      </Badge>
                    );
                  })()}
                  {inv.submitted && (
                    <Badge variant="outline" className="text-[10px] h-5">
                      Beküldve
                    </Badge>
                  )}
                </div>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="col-span-2">
                <span className="text-muted-foreground">Bizonylatsorszám:</span>
                <span className="ml-1 font-mono font-medium">{inv.invoice_number}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Eladó:</span>
                <span className="ml-1 font-medium">{inv.supplier_name || '-'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Vevő:</span>
                <span className="ml-1 font-medium">{inv.customer_name || '-'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Kiállítás:</span>
                <span className="ml-1">
                  {inv.invoice_issue_date
                    ? format(new Date(inv.invoice_issue_date), 'yyyy.MM.dd', { locale: hu })
                    : '-'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Bruttó:</span>
                <span className="ml-1 font-mono font-medium">
                  {formatCurrency(inv.invoice_gross_amount || 0, inv.currency || 'HUF')}
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
