import React from 'react';
import {
  ArrowRightLeft,
  AlertTriangle,
  CheckCircle2,
  Check,
  Unlink,
  Search,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { formatCurrency, cn } from '@/lib/utils';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import type { MatchedTransaction } from './types';
import type { useTransactionMatcher } from '@/hooks/useTransactionMatcher';

interface MatchedTransactionsSectionProps {
  transactions: MatchedTransaction[];
  matchingEnabled: boolean;
  matcher: ReturnType<typeof useTransactionMatcher>;
  invoiceAmount?: number;
  invoiceCurrency?: string;
}

export function MatchedTransactionsSection({
  transactions,
  matchingEnabled,
  matcher,
  invoiceAmount,
  invoiceCurrency,
}: MatchedTransactionsSectionProps) {
  return (
    <>
      {transactions.map((tx) => {
        const isSuggested =
          tx.match_type !== 'manual' && !tx.is_verified && (tx.confidence_score ?? 1) < 0.9;

        return (
          <Card
            key={tx.id}
            className={cn(
              "bg-muted/30 border-border/50 expand-stagger-4",
              isSuggested && "border-l-2 border-l-yellow-500/70"
            )}
          >
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-xs font-medium flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                  {isSuggested ? 'Javasolt tranzakció' : 'Párosított tranzakció'}
                </span>
                <div className="flex items-center gap-2">
                  {isSuggested ? (
                    <Badge className="gap-1 text-[10px] h-5 bg-yellow-500/15 text-yellow-600 border-yellow-500/30 hover:bg-yellow-500/20">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      Javasolt
                    </Badge>
                  ) : (
                    <Badge variant="success" className="gap-1 text-[10px] h-5">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      Párosított
                    </Badge>
                  )}
                  {tx.type && (
                    <Badge variant="outline" className="text-[10px] h-5">
                      {tx.type}
                    </Badge>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Dátum:</span>
                  <span className="ml-1 font-medium">
                    {format(new Date(tx.transaction_date), 'yyyy.MM.dd', { locale: hu })}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Összeg:</span>
                  <span
                    className={cn(
                      "ml-1 font-mono font-medium",
                      tx.amount < 0 ? "text-destructive" : "text-success"
                    )}
                  >
                    {formatCurrency(tx.amount, tx.currency || 'HUF')}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Leírás:</span>
                  <span className="ml-1">{tx.description || '-'}</span>
                </div>
                {tx.reason && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">AI indoklás:</span>
                    <p className="mt-1 text-[10px] bg-background/50 p-1.5 rounded border border-border/30 max-h-[80px] overflow-y-auto">
                      {tx.reason}
                    </p>
                  </div>
                )}
              </div>
              {/* Action buttons for invoice-side matching */}
              {matchingEnabled && (
                <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-border/30">
                  {isSuggested && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={matcher.saving}
                      onClick={(e) => {
                        e.stopPropagation();
                        matcher.handleVerify(tx.id);
                      }}
                      className="h-6 text-[10px] gap-1 bg-emerald-500/10 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/20"
                    >
                      <Check className="h-2.5 w-2.5" />
                      Jóváhagyás
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={matcher.saving}
                    onClick={(e) => {
                      e.stopPropagation();
                      matcher.handleUnmatch(tx.id);
                    }}
                    className="h-6 text-[10px] gap-1 text-muted-foreground hover:text-destructive"
                  >
                    <Unlink className="h-2.5 w-2.5" />
                    Leválasztás
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* ── Transaction search Dialog (invoice-side matching) ── */}
      {matchingEnabled && (
        <Dialog
          open={matcher.showSearch}
          onOpenChange={(open) => {
            if (!open) matcher.closeSearch();
          }}
        >
          <DialogContent
            className="sm:max-w-[520px] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm">
                <ArrowRightLeft className="h-4 w-4 text-primary" />
                Tranzakció hozzárendelése
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 w-full overflow-hidden">
              <p className="text-xs text-muted-foreground">
                Összeg alapján rendezve · keresett:{' '}
                <span className="font-mono font-medium">
                  {formatCurrency(invoiceAmount || 0, invoiceCurrency || 'HUF')}
                </span>
              </p>

              {/* Search input */}
              <div className="relative w-full">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Keresés leírás, összeg vagy típus alapján..."
                  value={matcher.search}
                  onChange={(e) => matcher.setSearch(e.target.value)}
                  className="pl-8 h-8 text-xs w-full"
                  autoFocus
                />
              </div>

              {/* Results count */}
              {!matcher.loading && matcher.filteredTransactions.length > 0 && (
                <div className="text-[10px] text-muted-foreground px-0.5">
                  {matcher.filteredTransactions.length} tranzakció az időszakban (±180 nap)
                </div>
              )}

              {/* Transaction list */}
              <div className="min-h-[320px] max-h-[320px] overflow-y-auto overflow-x-hidden border rounded-md">
                {matcher.loading ? (
                  <div className="flex items-center justify-center h-20">
                    <LoadingSpinner />
                  </div>
                ) : matcher.filteredTransactions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-20 text-muted-foreground">
                    <ArrowRightLeft className="h-5 w-5 mb-1" />
                    <p className="text-xs">
                      {matcher.search
                        ? 'Nincs találat a keresésre'
                        : 'Nincs elérhető tranzakció az időszakban'}
                    </p>
                  </div>
                ) : (
                  <div className="p-1.5 space-y-1">
                    {matcher.filteredTransactions.map((tx) => {
                      const isSelected = matcher.selectedTransactionId === tx.id;
                      const txAmt = Math.abs(tx.amount || 0);
                      const invAmt = Math.abs(invoiceAmount || 0);
                      const txHuf = Math.abs(matcher.toHuf(txAmt, tx.currency));
                      const invHuf = Math.abs(matcher.toHuf(invAmt, invoiceCurrency));
                      const diff = txHuf - invHuf;
                      const absDiff = Math.abs(diff);
                      const isExact = absDiff < 1;
                      const isNear = !isExact && invHuf > 0 && absDiff < invHuf * 0.05;
                      const pctDiff = invHuf > 0 ? (absDiff / invHuf) * 100 : 0;

                      return (
                        <div
                          key={tx.id}
                          className={cn(
                            "rounded-md border p-2.5 cursor-pointer transition-all overflow-hidden",
                            isSelected
                              ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                              : "hover:bg-muted/40 hover:border-border",
                            isExact && !isSelected && "border-emerald-500/40 bg-emerald-500/5",
                            isNear && !isSelected && "border-amber-500/30 bg-amber-500/5"
                          )}
                          onClick={() => matcher.setSelectedTransactionId(tx.id)}
                        >
                          <div className="flex justify-between items-start gap-2 min-w-0">
                            <div className="min-w-0 flex-1 overflow-hidden">
                              <div className="flex items-center gap-1.5">
                                {isSelected && (
                                  <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />
                                )}
                                <p className="font-medium text-xs whitespace-nowrap">
                                  {format(new Date(tx.transaction_date), 'yyyy.MM.dd', {
                                    locale: hu,
                                  })}
                                </p>
                                {tx.type && (
                                  <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0">
                                    {tx.type}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-muted-foreground text-[10px] mt-0.5 truncate">
                                {tx.description || '-'}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p
                                className={cn(
                                  "font-mono font-medium text-xs",
                                  tx.amount < 0 ? "text-destructive" : "text-success"
                                )}
                              >
                                {formatCurrency(tx.amount, tx.currency || 'HUF')}
                              </p>
                              {isExact ? (
                                <Badge variant="success" className="text-[9px] h-4 mt-0.5">
                                  ✓ Egyező
                                </Badge>
                              ) : isNear ? (
                                <Badge className="text-[9px] h-4 mt-0.5 bg-amber-500/20 text-amber-600 border-amber-500/30 hover:bg-amber-500/20">
                                  ~{pctDiff.toFixed(0)}% elt.
                                </Badge>
                              ) : (
                                <span className="text-[10px] text-muted-foreground/60 mt-0.5 block">
                                  {diff > 0 ? '+' : ''}
                                  {formatCurrency(diff, 'HUF')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Match action button */}
              <div className="flex justify-end pt-1">
                <Button
                  size="sm"
                  disabled={!matcher.selectedTransactionId || matcher.saving}
                  onClick={(e) => {
                    e.stopPropagation();
                    matcher.handleMatch();
                  }}
                  className="text-xs h-8"
                >
                  <Check className="h-3 w-3 mr-1" />
                  {matcher.saving ? 'Mentés...' : 'Párosítás mentése'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
