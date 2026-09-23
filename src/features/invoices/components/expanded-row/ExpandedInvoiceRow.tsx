import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link2, Plus, CreditCard, RotateCcw, XCircle, AlertTriangle, CheckCircle2, ShieldCheck, Tag, Sparkles } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { TableCell, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { cn, formatCurrency } from '@/lib/utils';
import { useTransactionMatcher } from '@/hooks/useTransactionMatcher';
import { unmatchTransaction } from '@/lib/matching/matchingService';
import { invalidateMatchingQueries } from '@/lib/matching/matchingKeys';
import { ManualPaymentDialog } from '@/components/invoices/ManualPaymentDialog';
import { StornoSettleDialog } from '@/components/invoices/StornoSettleDialog';

// Subcomponents
import { GeneralLedgerBadgeSection } from './GeneralLedgerBadgeSection';
import { InvoiceVatCodeSelector } from '@/components/vat/InvoiceVatCodeSelector';
import { NavInvoiceVatSummaryCard } from '@/components/nav/NavInvoiceVatSummaryCard';
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
import { useCompanyJurisdiction } from '@/hooks/useCompanyJurisdiction';

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
  navStatus,
  statusz,
  approvedAt,
  approvalNote,
  onOpenApprovalDialog,
  vatCodeId,
  vatRowOverride,
  invoiceType,
  vatSummary: propVatSummary,
  isReverseCharge: propIsReverseCharge,
  nonDeductibleInfo: propNonDeductibleInfo,
}: ExpandedInvoiceRowProps) {
  const { t } = useTranslation(['invoices', 'common']);
  const queryClient = useQueryClient();
  const { hasNavIntegration, defaultCurrency } = useCompanyJurisdiction();

  // Fetch official NAV VAT summary if not provided and source is NAV
  const { data: navVatData } = useQuery({
    queryKey: ['nav-invoice-vat-summary', invoiceId],
    queryFn: async () => {
      if (!invoiceId || invoiceSource !== 'nav') return null;
      const { data, error } = await supabase
        .from('nav_invoices')
        .select('vat_summary, is_reverse_charge, currency')
        .eq('id', invoiceId)
        .single();
      if (error || !data) return null;
      return data;
    },
    enabled: !propVatSummary && !!invoiceId && invoiceSource === 'nav',
    staleTime: 5 * 60 * 1000,
  });

  const effectiveVatSummary = propVatSummary || navVatData?.vat_summary;
  const effectiveIsReverseCharge = propIsReverseCharge ?? navVatData?.is_reverse_charge;

  // Deductibility query if not provided via props and invoice is INBOUND
  const isInbound = (invoiceType?.toUpperCase() || 'INBOUND') === 'INBOUND';
  const { data: fetchedDeductibility } = useQuery({
    queryKey: ['expanded-row-deductibility', invoiceSource, invoiceId],
    queryFn: async () => {
      if (!invoiceId || !isInbound) return null;
      const table = invoiceSource === 'submitted' ? 'invoice_items' : 'nav_invoice_items';
      const foreignKey = invoiceSource === 'submitted' ? 'invoice_id' : 'nav_invoice_id';
      const { data, error } = await supabase
        .from(table as any)
        .select('vat_amount, net_amount, vat_rate, deductible_percentage')
        .eq(foreignKey, invoiceId)
        .lt('deductible_percentage', 100);

      if (error || !data || data.length === 0) return null;

      let totalVat = 0;
      let deductibleVat = 0;
      let nonDeductibleVat = 0;
      let minPercentage = 100;

      for (const item of data as any[]) {
        let vat = item.vat_amount;
        if ((vat === null || vat === 0 || vat === undefined) && item.net_amount && item.vat_rate) {
          const num = parseFloat(item.vat_rate);
          if (!isNaN(num) && num > 0) {
            const rate = num >= 1 ? num / 100 : num;
            vat = Math.round(item.net_amount * rate);
          }
        }
        const itemVat = vat || 0;
        const pct = item.deductible_percentage != null ? Number(item.deductible_percentage) : 100;
        const ded = Math.round(itemVat * (pct / 100));
        const nonDed = itemVat - ded;

        totalVat += itemVat;
        deductibleVat += ded;
        nonDeductibleVat += nonDed;
        minPercentage = Math.min(minPercentage, pct);
      }

      if (nonDeductibleVat <= 0) return null;

      return {
        deductibleVat,
        nonDeductibleVat,
        minPercentage,
      };
    },
    enabled: propNonDeductibleInfo === undefined && !!invoiceId && isInbound,
    staleTime: 60_000,
  });

  const effectiveDeductibility = propNonDeductibleInfo !== undefined ? propNonDeductibleInfo : fetchedDeductibility;

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
    invoiceCurrency: invoiceCurrency || defaultCurrency,
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

  const isInvoiceSettled =
    !!isManualPayment ||
    !!transactionId ||
    effectiveMatchedTransactions.length > 0 ||
    statusz === 'Fizetve' ||
    statusz === 'paid' ||
    navStatus === 'paid';

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
            .accordion-grid-animate {
              display: grid;
              animation: accordionSlideDown 180ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
            .accordion-grid-animate > .accordion-overflow {
              overflow: hidden;
              min-height: 0;
            }
            .expand-animate,
            .expand-stagger-1,
            .expand-stagger-2,
            .expand-stagger-3,
            .expand-stagger-4 {
              opacity: 1;
            }
          `}</style>
          <div className="accordion-grid-animate">
            <div className="accordion-overflow">
              <div className="pt-3 pb-5 px-8 space-y-4 max-w-5xl ml-4">
                {/* General Ledger & VAT classification section */}
                <div className="flex flex-wrap items-start gap-4">
                  {/* General Ledger numbers */}
                  <GeneralLedgerBadgeSection
                    glNumbers={glNumbers}
                    hasSubmittedMatch={hasSubmittedMatch}
                  />

                  {/* Manual VAT code & 2665 declaration target row override card */}
                  <div className="mb-4 expand-animate bg-card border border-border/40 p-3 rounded-lg flex flex-col gap-2 min-w-[240px]">
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <Tag className="h-3.5 w-3.5 text-primary" />
                      <span>ÁFA kód & 2665 bevallási sor</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <InvoiceVatCodeSelector
                        invoiceId={invoiceSource === 'submitted' ? invoiceId : undefined}
                        navInvoiceId={invoiceSource === 'nav' ? invoiceId : undefined}
                        invoiceNumber={invoiceNumber}
                        companyId={companyId}
                        currentVatCodeId={vatCodeId}
                        currentVatRowOverride={vatRowOverride}
                        direction={invoiceType ? (invoiceType.toUpperCase() as 'INBOUND' | 'OUTBOUND') : 'INBOUND'}
                        onUpdated={onMatchUpdate}
                      />
                    </div>
                  </div>

                  {/* Non-deductible VAT card (Option 3) */}
                  {effectiveDeductibility && effectiveDeductibility.nonDeductibleVat > 0 && (
                    <div className="mb-4 expand-animate bg-card border border-amber-500/40 bg-amber-500/5 p-3 rounded-lg flex flex-col gap-2 min-w-[260px] shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                          <span>ÁFA levonhatóság</span>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                          {effectiveDeductibility.minPercentage === 0 ? '0% levonható' : `${effectiveDeductibility.minPercentage}% hányad`}
                        </span>
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                            Levonható ÁFA:
                          </span>
                          <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(effectiveDeductibility.deductibleVat, invoiceCurrency || defaultCurrency)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                            Nem levonható ÁFA:
                          </span>
                          <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                            {formatCurrency(effectiveDeductibility.nonDeductibleVat, invoiceCurrency || defaultCurrency)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

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

                {/* NAV Online Számla Cross-Check Banner */}
                {hasNavIntegration && (navStatus === 'missing_nav' || statusz === 'jovahagyasra_var') && (
                  approvedAt ? (
                    <div className="flex items-center justify-between p-3 rounded-lg border border-blue-200/70 bg-blue-50/50 dark:bg-blue-950/20 text-xs text-blue-800 dark:text-blue-300">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                        <span>
                          <strong>Könyvelői jóváhagyással engedélyezve:</strong> {approvalNote || 'Könyvelői jóváhagyás (NAV adatszolgáltatás nélkül)'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 rounded-lg border border-amber-300/70 bg-amber-500/10 dark:bg-amber-950/30 text-xs">
                      <div className="flex items-center gap-2.5">
                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                        <div>
                          <span className="font-semibold text-amber-800 dark:text-amber-300">
                            NAV Online Számla adatszolgáltatás hiányzik!
                          </span>
                          <p className="text-muted-foreground mt-0.5">
                            Ehhez a bizonylathoz nem található online számla adatszolgáltatás. A rendszer zárolta az automatikus könyvelést.
                          </p>
                        </div>
                      </div>
                      {onOpenApprovalDialog && (
                        <Button
                          type="button"
                          size="sm"
                          className="bg-amber-600 hover:bg-amber-700 text-white h-7 text-xs gap-1.5 shrink-0 cursor-pointer shadow-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenApprovalDialog();
                          }}
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Jóváhagyás könyvelésre
                        </Button>
                      )}
                    </div>
                  )
                )}

                {/* Official NAV VAT Summary Block */}
                {effectiveVatSummary && (
                  <div className="pt-2">
                    <NavInvoiceVatSummaryCard
                      vatSummary={effectiveVatSummary}
                      currency={invoiceCurrency || navVatData?.currency || defaultCurrency}
                      isReverseCharge={effectiveIsReverseCharge}
                      defaultExpanded={false}
                      className="mb-2"
                    />
                  </div>
                )}

                <div className="space-y-6 pt-2">
                  {/* Section: Related Items */}
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4 expand-animate">
                      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        <Link2 className="h-3.5 w-3.5" />
                        {t('invoices:expanded.related_items', 'Kapcsolódó tételek')}
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
                              {t('invoices:expanded.add_transaction_short', 'Tranzakció')}
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
                              {t('invoices:expanded.manual_payment', 'Kézi fizetés')}
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
                                    <RotateCcw className="h-3 w-3" /> {t('invoices:expanded.undo_storno_close', 'Lezárás visszavonása')}
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="h-3 w-3" /> {t('invoices:expanded.storno_close', 'Sztornó lezárása')}
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
                              e.preventDefault();
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
                            {t('invoices:expanded.exclude_from_accounting', 'Nem kerül könyvelésre')}
                          </button>
                        )}
                      </div>
                    </div>

                    {!hasAny && (
                      <Card className="bg-muted/30 border-border/50 expand-stagger-1">
                        <CardContent className="p-4 flex flex-col items-center justify-center gap-3">
                          <p className="text-sm text-muted-foreground italic">
                            {t('invoices:expanded.no_matched_items', 'Nincs párosított tétel ehhez a számlához.')}
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
                                {t('invoices:expanded.add_transaction', 'Tranzakció hozzárendelése')}
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
                                {t('invoices:expanded.manual_payment', 'Kézi fizetés')}
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
                                      <RotateCcw className="h-3.5 w-3.5" /> {t('invoices:expanded.undo_storno_close', 'Lezárás visszavonása')}
                                    </>
                                  ) : (
                                    <>
                                      <XCircle className="h-3.5 w-3.5" /> {t('invoices:expanded.storno_close', 'Sztornó lezárása')}
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
                    <MatchedCourierReportsSection
                      courierReports={matchedCourierReports}
                      isInvoiceSettled={isInvoiceSettled}
                    />
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
                    invoiceCurrency={invoiceCurrency || defaultCurrency}
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
