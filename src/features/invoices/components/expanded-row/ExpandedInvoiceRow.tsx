import React, { useState, useMemo } from 'react';
import { Link2, Plus, CreditCard, RotateCcw, XCircle } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { TableCell, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useTransactionMatcher } from '@/hooks/useTransactionMatcher';
import { unmatchTransaction } from '@/lib/matching/matchingService';
import { invalidateMatchingQueries } from '@/lib/matching/matchingKeys';
import { ManualPaymentDialog } from '@/components/invoices/ManualPaymentDialog';
import { StornoSettleDialog } from '@/components/invoices/StornoSettleDialog';

// Subcomponents
import { GeneralLedgerBadgeSection } from './GeneralLedgerBadgeSection';
import { NettingCardSection } from './NettingCardSection';
import { ContinuousServiceCardSection } from './ContinuousServiceCardSection';
import { LinkedInvoicesSection } from './LinkedInvoicesSection';
import { MatchedSubmittedInvoicesSection } from './MatchedSubmittedInvoicesSection';
import { MatchedNavInvoicesSection } from './MatchedNavInvoicesSection';
import { MatchedTransactionsSection } from './MatchedTransactionsSection';
import { MatchedCourierReportsSection } from './MatchedCourierReportsSection';
import { InvoiceNotesSection } from './InvoiceNotesSection';
import type {
  ExpandedInvoiceRowProps,
  MatchedTransaction,
} from './types';

export function ExpandedInvoiceRow({
  colSpan,
  matchedSubmittedInvoices,
  matchedNavInvoices,
  matchedTransactions,
  linkedInvoices = [],
  invoiceReferenceNumber,
  linkedInvoicesLoading = false,
  onViewInvoice,
  matchedCourierReports = [],
  hideStandaloneTransactions = false,
  excludeFromAccounting = false,
  onToggleExclude,
  invoiceId,
  invoiceAmount,
  invoiceCurrency,
  invoiceDate,
  companyId,
  onMatchUpdate,
  glNumbers,
  hasSubmittedMatch = false,
  categories,
  projects,
  nettingGroup,
  isContinuous,
  servicePeriodStart,
  servicePeriodEnd,
  calculatedTi,
  tiOverride,
  tiCalculationMethod,
  transactionId,
  invoiceSource,
  invoiceOperation,
  isManualPayment,
  invoiceNumber,
}: ExpandedInvoiceRowProps) {
  const queryClient = useQueryClient();
  const [showManualPayment, setShowManualPayment] = useState(false);
  const [showStornoSettle, setShowStornoSettle] = useState(false);
  const [unmatching, setUnmatching] = useState(false);

  // Sztornó lezárás toggle logika
  const isStornoNav = invoiceOperation === 'STORNO' && invoiceSource === 'nav';
  const isStornoSettled = !!isManualPayment;

  const handleUnmatchInvoice = async (_invoiceIdToUnmatch: string) => {
    if (!transactionId) return;
    setUnmatching(true);
    try {
      await unmatchTransaction(transactionId);
      toast({ title: 'Párosítás megszüntetve!' });

      if (companyId) {
        await invalidateMatchingQueries(queryClient, companyId);
      }
      if (onMatchUpdate) {
        onMatchUpdate();
      }
    } catch (error: any) {
      console.error('Error unmatching invoice:', error);
      toast({
        title: 'Hiba a párosítás megszüntetésekor',
        description: error.message || 'Ismeretlen hiba',
        variant: 'destructive',
      });
    } finally {
      setUnmatching(false);
    }
  };

  const subIdsKey = useMemo(
    () => matchedSubmittedInvoices.map((inv) => inv.id).sort().join(','),
    [matchedSubmittedInvoices]
  );
  const navIdsKey = useMemo(
    () => matchedNavInvoices.map((inv) => inv.id).sort().join(','),
    [matchedNavInvoices]
  );

  // Fetch linked transactions (only when matchedTransactions is NOT provided by parent batch query)
  const { data: fetchedTransactions = [] } = useQuery({
    queryKey: ['matched-transactions-for-invoice', invoiceId, transactionId, subIdsKey, navIdsKey],
    queryFn: async () => {
      if (!invoiceId && !transactionId) return [];

      const allRelatedInvoiceIds = [
        invoiceId,
        ...matchedSubmittedInvoices.map((inv) => inv.id),
        ...matchedNavInvoices.map((inv) => inv.id),
      ].filter(Boolean) as string[];

      const txMap = new Map<string, MatchedTransaction>();

      // 1. Direct matched_invoice_id or specific transactionId
      if (allRelatedInvoiceIds.length > 0 || transactionId) {
        let query = supabase
          .from('transactions')
          .select(
            'id, transaction_date, amount, description, currency, type, confidence_score, match_type, is_verified, reason, matched_invoice_id'
          );

        if (allRelatedInvoiceIds.length > 0 && transactionId) {
          query = query.or(
            `matched_invoice_id.in.(${allRelatedInvoiceIds.join(',')}),id.eq.${transactionId}`
          );
        } else if (allRelatedInvoiceIds.length > 0) {
          query = query.in('matched_invoice_id', allRelatedInvoiceIds);
        } else if (transactionId) {
          query = query.eq('id', transactionId);
        }

        const { data: directTxs, error: directErr } = await query;
        if (!directErr && directTxs) {
          directTxs.forEach((tx: any) => {
            txMap.set(tx.id, {
              id: tx.id,
              transaction_date: tx.transaction_date,
              amount: Number(tx.amount || 0),
              description: tx.description,
              currency: tx.currency,
              type: tx.type,
              confidence_score: tx.confidence_score,
              match_type: tx.match_type,
              is_verified: tx.is_verified,
              reason: tx.reason,
            });
          });
        }
      }

      // 2. Multi-match join table (transaction_invoice_matches)
      if (allRelatedInvoiceIds.length > 0) {
        const { data: joinMatches, error: joinErr } = await supabase
          .from('transaction_invoice_matches')
          .select('transaction_id')
          .in('invoice_id', allRelatedInvoiceIds);

        if (!joinErr && joinMatches && joinMatches.length > 0) {
          const additionalTxIds = joinMatches
            .map((m: any) => m.transaction_id)
            .filter((id: string) => id && !txMap.has(id));

          if (additionalTxIds.length > 0) {
            const { data: joinTxs, error: joinTxsErr } = await supabase
              .from('transactions')
              .select(
                'id, transaction_date, amount, description, currency, type, confidence_score, match_type, is_verified, reason, matched_invoice_id'
              )
              .in('id', additionalTxIds);

            if (!joinTxsErr && joinTxs) {
              joinTxs.forEach((tx: any) => {
                txMap.set(tx.id, {
                  id: tx.id,
                  transaction_date: tx.transaction_date,
                  amount: Number(tx.amount || 0),
                  description: tx.description,
                  currency: tx.currency,
                  type: tx.type,
                  confidence_score: tx.confidence_score,
                  match_type: tx.match_type,
                  is_verified: tx.is_verified,
                  reason: tx.reason,
                });
              });
            }
          }
        }
      }

      const result = Array.from(txMap.values());
      result.sort(
        (a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()
      );
      return result;
    },
    enabled: matchedTransactions === undefined && !!(invoiceId || transactionId),
  });

  const effectiveMatchedTransactions = useMemo(() => {
    if (matchedTransactions !== undefined) {
      return matchedTransactions;
    }
    return fetchedTransactions;
  }, [matchedTransactions, fetchedTransactions]);

  const matchingEnabled = !!(invoiceId && companyId && invoiceDate && !hideStandaloneTransactions);

  const matcher = useTransactionMatcher({
    invoiceId: invoiceId || '',
    invoiceAmount: invoiceAmount || 0,
    invoiceCurrency: invoiceCurrency || 'HUF',
    invoiceDate: invoiceDate || '',
    companyId: companyId || '',
    onUpdate: onMatchUpdate,
  });

  const hasBrokenChain =
    !linkedInvoicesLoading &&
    !!invoiceReferenceNumber &&
    !linkedInvoices.some(
      (inv) => inv.bizonylatsorszam?.toUpperCase() === invoiceReferenceNumber.toUpperCase()
    );

  const hasAny =
    matchedSubmittedInvoices.length > 0 ||
    matchedNavInvoices.length > 0 ||
    effectiveMatchedTransactions.length > 0 ||
    linkedInvoices.length > 0 ||
    matchedCourierReports.length > 0 ||
    hasBrokenChain;

  return (
    <>
      {/* Top spacer row */}
      <TableRow className="bg-transparent hover:bg-transparent border-none">
        <TableCell colSpan={colSpan} className="p-0 h-1 border-none" />
      </TableRow>

      <TableRow className="bg-muted/40 dark:bg-card hover:bg-muted/40 dark:hover:bg-card border-t border-b border-border/30">
        <TableCell colSpan={colSpan} className="p-0">
          <style>{`
            @keyframes accordionSlideDown {
              from { grid-template-rows: 0fr; }
              to { grid-template-rows: 1fr; }
            }
            @keyframes accordionFadeIn {
              from { opacity: 0; transform: translateY(-6px); }
              to { opacity: 1; transform: translateY(0); }
            }
            .accordion-grid-animate {
              display: grid;
              animation: accordionSlideDown 250ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
            .accordion-grid-animate > .accordion-overflow {
              overflow: hidden;
            }
            .expand-animate { animation: accordionFadeIn 250ms cubic-bezier(0.16, 1, 0.3, 1) forwards; }
            .expand-stagger-1 { animation: accordionFadeIn 250ms cubic-bezier(0.16, 1, 0.3, 1) 60ms forwards; opacity: 0; }
            .expand-stagger-2 { animation: accordionFadeIn 250ms cubic-bezier(0.16, 1, 0.3, 1) 120ms forwards; opacity: 0; }
            .expand-stagger-3 { animation: accordionFadeIn 250ms cubic-bezier(0.16, 1, 0.3, 1) 180ms forwards; opacity: 0; }
            .expand-stagger-4 { animation: accordionFadeIn 250ms cubic-bezier(0.16, 1, 0.3, 1) 240ms forwards; opacity: 0; }
          `}</style>
          <div className="accordion-grid-animate">
            <div className="accordion-overflow">
              <div className="py-6 px-8 space-y-4 max-w-5xl ml-4">
                {/* General Ledger numbers */}
                <GeneralLedgerBadgeSection
                  glNumbers={glNumbers}
                  hasSubmittedMatch={hasSubmittedMatch}
                />

                {/* Netting (kompenzálás) card */}
                <NettingCardSection nettingGroup={nettingGroup} />

                {/* Continuous service (Folyamatos szolgáltatás) card */}
                <ContinuousServiceCardSection
                  isContinuous={isContinuous}
                  servicePeriodStart={servicePeriodStart}
                  servicePeriodEnd={servicePeriodEnd}
                  calculatedTi={calculatedTi}
                  tiOverride={tiOverride}
                  tiCalculationMethod={tiCalculationMethod}
                />

                <div className="space-y-6 pt-2">
                  {/* Section: Related Items */}
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4 expand-animate">
                      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        <Link2 className="h-3.5 w-3.5" />
                        Kapcsolódó tételek
                      </div>
                      <div className="flex items-center gap-2">
                        {matchingEnabled && hasAny && (
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                matcher.openSearch();
                              }}
                              className="h-7 text-[11px] gap-1.5 px-2.5"
                            >
                              <Plus className="h-3 w-3" />
                              Tranzakció
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowManualPayment(true);
                              }}
                              className="h-7 text-[11px] gap-1.5 px-2.5 border-dashed"
                            >
                              <CreditCard className="h-3 w-3" />
                              Kézi fizetés
                            </Button>
                            {isStornoNav && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowStornoSettle(true);
                                }}
                                className={cn(
                                  "h-7 text-[11px] gap-1.5 px-2.5 border-dashed",
                                  isStornoSettled
                                    ? "border-muted-foreground/30 text-muted-foreground hover:bg-muted/50"
                                    : "border-orange-500/40 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10"
                                )}
                              >
                                {isStornoSettled ? (
                                  <>
                                    <RotateCcw className="h-3 w-3" /> Lezárás visszavonása
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="h-3 w-3" /> Sztornó lezárása
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        )}
                        {onToggleExclude && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleExclude();
                            }}
                            className={cn(
                              "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all duration-200 border",
                              excludeFromAccounting
                                ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-300/40 hover:bg-amber-500/25"
                                : "bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted hover:text-foreground"
                            )}
                          >
                            <div
                              className={cn(
                                "w-3 h-3 rounded-sm border-2 flex items-center justify-center transition-colors",
                                excludeFromAccounting
                                  ? "border-amber-500 bg-amber-500"
                                  : "border-muted-foreground/40"
                              )}
                            >
                              {excludeFromAccounting && (
                                <svg
                                  width="8"
                                  height="8"
                                  viewBox="0 0 8 8"
                                  fill="none"
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path
                                    d="M1.5 4L3 5.5L6.5 2"
                                    stroke="white"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              )}
                            </div>
                            Nem kerül könyvelésre
                          </button>
                        )}
                      </div>
                    </div>

                    {!hasAny && (
                      <Card className="bg-muted/30 border-border/50 expand-stagger-1">
                        <CardContent className="p-4 flex flex-col items-center justify-center gap-3">
                          <p className="text-sm text-muted-foreground italic">
                            Nincs párosított tétel ehhez a számlához.
                          </p>
                          {matchingEnabled && (
                            <div className="flex items-center gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  matcher.openSearch();
                                }}
                                className="h-8 text-xs gap-1.5"
                              >
                                <Plus className="h-3.5 w-3.5" />
                                Tranzakció hozzárendelése
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowManualPayment(true);
                                }}
                                className="h-8 text-xs gap-1.5 border-dashed"
                              >
                                <CreditCard className="h-3.5 w-3.5" />
                                Kézi fizetés
                              </Button>
                              {isStornoNav && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowStornoSettle(true);
                                  }}
                                  className={cn(
                                    "h-8 text-xs gap-1.5 border-dashed",
                                    isStornoSettled
                                      ? "border-muted-foreground/30 text-muted-foreground hover:bg-muted/50"
                                      : "border-orange-500/40 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10"
                                  )}
                                >
                                  {isStornoSettled ? (
                                    <>
                                      <RotateCcw className="h-3.5 w-3.5" /> Lezárás visszavonása
                                    </>
                                  ) : (
                                    <>
                                      <XCircle className="h-3.5 w-3.5" /> Sztornó lezárása
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Linked Invoices */}
                    <LinkedInvoicesSection
                      linkedInvoices={linkedInvoices}
                      invoiceReferenceNumber={invoiceReferenceNumber}
                      linkedInvoicesLoading={linkedInvoicesLoading}
                      onViewInvoice={onViewInvoice}
                      hasOtherMatches={
                        matchedSubmittedInvoices.length > 0 ||
                        matchedNavInvoices.length > 0 ||
                        effectiveMatchedTransactions.length > 0
                      }
                    />

                    {/* Matched Submitted Invoices */}
                    <MatchedSubmittedInvoicesSection
                      invoices={matchedSubmittedInvoices}
                      onViewInvoice={onViewInvoice}
                      categories={categories}
                      projects={projects}
                      transactionId={transactionId}
                      unmatching={unmatching}
                      onUnmatch={handleUnmatchInvoice}
                      hideStandaloneTransactions={hideStandaloneTransactions}
                      effectiveMatchedTransactions={effectiveMatchedTransactions}
                    />

                    {/* Matched NAV Invoices */}
                    <MatchedNavInvoicesSection
                      invoices={matchedNavInvoices}
                      transactionId={transactionId}
                      unmatching={unmatching}
                      onUnmatch={handleUnmatchInvoice}
                      hideStandaloneTransactions={hideStandaloneTransactions}
                      effectiveMatchedTransactions={effectiveMatchedTransactions}
                    />

                    {/* Matched Transactions (Standalone) */}
                    {!hideStandaloneTransactions && (
                      <MatchedTransactionsSection
                        transactions={effectiveMatchedTransactions}
                        matchingEnabled={matchingEnabled}
                        matcher={matcher}
                        invoiceAmount={invoiceAmount}
                        invoiceCurrency={invoiceCurrency}
                      />
                    )}

                    {/* Separator between transactions and courier reports */}
                    {(matchedSubmittedInvoices.length > 0 ||
                      matchedNavInvoices.length > 0 ||
                      matchedTransactions.length > 0) &&
                      matchedCourierReports.length > 0 && <Separator className="my-1" />}

                    {/* Matched Courier Reports */}
                    <MatchedCourierReportsSection courierReports={matchedCourierReports} />
                  </div>

                  {/* Section: Notes */}
                  <InvoiceNotesSection
                    invoiceId={invoiceId}
                    companyId={companyId}
                    transactionId={transactionId}
                    invoiceSource={invoiceSource}
                    matchedSubmittedInvoices={matchedSubmittedInvoices}
                    matchedNavInvoices={matchedNavInvoices}
                  />
                </div>

                {/* Manual Payment Dialog */}
                {matchingEnabled && (
                  <ManualPaymentDialog
                    open={showManualPayment}
                    onOpenChange={setShowManualPayment}
                    invoiceId={invoiceId || ''}
                    invoiceAmount={invoiceAmount || 0}
                    invoiceCurrency={invoiceCurrency || 'HUF'}
                    onSuccess={onMatchUpdate}
                  />
                )}

                {/* Storno Settle Dialog */}
                {isStornoNav && invoiceId && (
                  <StornoSettleDialog
                    open={showStornoSettle}
                    onOpenChange={setShowStornoSettle}
                    mode={isStornoSettled ? 'unsettle' : 'settle'}
                    stornoNavId={invoiceId}
                    stornoNumber={invoiceNumber || invoiceId || ''}
                    onSuccess={async () => {
                      if (onMatchUpdate) onMatchUpdate();
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </TableCell>
      </TableRow>

      {/* Bottom spacer row */}
      <TableRow className="bg-transparent hover:bg-transparent hover:brightness-100 border-none">
        <TableCell colSpan={colSpan} className="p-0 h-1 border-none" />
      </TableRow>
    </>
  );
}

export default ExpandedInvoiceRow;
