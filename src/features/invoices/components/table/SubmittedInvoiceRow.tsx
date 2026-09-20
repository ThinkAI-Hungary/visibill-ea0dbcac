import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TableRow, TableCell } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { CopyableCell } from '@/components/ui/copyable-cell';
import { InvoiceImagePreview } from '@/components/InvoiceImagePreview';
import ExpandedInvoiceRow from '@/components/ExpandedInvoiceRow';
import { ChevronDown, FileText, Package, Pencil, AlertTriangle, AlertOctagon, Check, Sparkles } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { getInitials, getAvatarColor } from '@/lib/helpers';
import { normalizeInvoiceNumber, checkBuyerTaxMismatch } from '@/lib/invoiceMatchingUtils';
import { InvoiceVatCodeSelector } from '@/components/vat/InvoiceVatCodeSelector';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { useInvoiceContext } from '../../context/useInvoiceContext';
import type { SubmittedInvoice, NavInvoice, TransactionRecord } from '../../types';
import { supabase } from '@/integrations/supabase/client';

interface SubmittedInvoiceRowProps {
  invoice: SubmittedInvoice;
  submittedToNavMap: Map<string, NavInvoice[]>;
  pageInvoiceIdToTransactionsMap: Map<string, TransactionRecord[]>;
  nonDeductibleInfo?: {
    deductibleVat: number;
    nonDeductibleVat: number;
    minPercentage: number;
  } | null;
  onRowClick: (invoiceId: string, e: React.MouseEvent) => void;
  onToggleExclude: (invoiceId: string, currentValue: boolean) => Promise<void>;
}

export function SubmittedInvoiceRow({
  invoice,
  submittedToNavMap,
  pageInvoiceIdToTransactionsMap,
  nonDeductibleInfo,
  onRowClick,
  onToggleExclude,
}: SubmittedInvoiceRowProps) {
  const {
    activeTab,
    companyId,
    selectedCompany,
    categories,
    projects,
    writable,
    selectedSubmittedIds,
    toggleSelectRow,
    expandedRowIds,
    setSelectedInvoice,
    setImageDialogOpen,
    setEditDialogOpen,
    setSelectedSubmittedForItems,
    setSubmittedItemsDialogOpen,
    setInvoiceParam,
    linkedInvoicesLoading,
    invalidateInvoiceData,
    setApprovalDialogOpen,
    setSelectedInvoiceForApproval,
    getPaymentMethodLabel,
  } = useInvoiceContext();
  const { t } = useTranslation(['invoices', 'common']);

  const isExpanded = expandedRowIds.has(invoice.id);
  const isSelected = selectedSubmittedIds.has(invoice.id);

  const [isOptimisticReviewed, setIsOptimisticReviewed] = useState<boolean | null>(null);

  useEffect(() => {
    setIsOptimisticReviewed(null);
  }, [invoice.id, invoice.is_accountant_reviewed]);

  const isReviewed = isOptimisticReviewed !== null
    ? isOptimisticReviewed
    : invoice.is_accountant_reviewed === true;
  const matchStatus = (invoice as any).match_status || 'unmatched';
  const isMatched = matchStatus === 'matched';
  const isPartiallyPaid = matchStatus === 'partially_paid';
  const isSuggested = matchStatus === 'suggested';
  const partnerName = activeTab === 'SUBMITTED_INBOUND' ? invoice.elado_nev || '-' : invoice.vevo_nev || '-';

  const buyerMismatch = React.useMemo(
    () => checkBuyerTaxMismatch(invoice, selectedCompany),
    [invoice, selectedCompany]
  );

  const getSubmittedInvoiceMatches = (subInvoice: SubmittedInvoice) => {
    const matchedNav = subInvoice.bizonylatsorszam
      ? submittedToNavMap.get(normalizeInvoiceNumber(subInvoice.bizonylatsorszam)) || []
      : [];

    const allTxMap = new Map<string, TransactionRecord>();
    (pageInvoiceIdToTransactionsMap.get(subInvoice.id) || []).forEach(tx => allTxMap.set(tx.id, tx));
    matchedNav.forEach(nav => {
      (pageInvoiceIdToTransactionsMap.get(nav.id) || []).forEach(tx => allTxMap.set(tx.id, tx));
    });

    return {
      matchedSubmitted: [] as SubmittedInvoice[],
      matchedTransactions: Array.from(allTxMap.values()),
      matchedNav,
      linkedInvoices: [] as any[],
    };
  };

  const matches = isExpanded ? getSubmittedInvoiceMatches(invoice) : null;

  return (
    <React.Fragment key={invoice.id}>
      <TableRow
        data-row-hover
        className={cn(
          'group cursor-pointer',
          isSelected && 'bg-primary/5',
          !isSelected && isMatched && 'bg-[var(--row-matched-bg)]',
          !isSelected && isPartiallyPaid && 'bg-blue-500/[0.06]',
          !isSelected && isSuggested && 'bg-[var(--row-suggested-bg)]',
          !isSelected && !isMatched && !isPartiallyPaid && !isSuggested && 'bg-[var(--row-unmatched-bg)]',
          isExpanded && 'border-b-0'
        )}
        onClick={(e) => onRowClick(invoice.id, e)}
      >
        <TableCell className="pl-2">
          <div className="flex items-center gap-2">
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200',
                isExpanded && 'rotate-180'
              )}
            />
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => toggleSelectRow(invoice.id)}
              aria-label={`${invoice.bizonylatsorszam || invoice.id} kijelölése`}
            />
          </div>
        </TableCell>

        <TableCell>
          <div className="flex items-center gap-1.5 min-w-0">
            <div
              className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0',
                getAvatarColor(partnerName)
              )}
            >
              {getInitials(partnerName)}
            </div>
            {partnerName === '-' || partnerName === 'Ismeretlen partner' ? (
              <span className="text-xs text-muted-foreground italic">Ismeretlen partner</span>
            ) : (
              <CopyableCell
                value={partnerName}
                displayValue={partnerName.length > 16 ? partnerName.slice(0, 16) + '…' : partnerName}
                truncate
                maxWidth="100%"
                className="font-medium text-xs"
                ariaLabel={`${partnerName} másolása`}
              />
            )}
          </div>
        </TableCell>

        <TableCell className="text-center text-muted-foreground tabular-nums whitespace-nowrap">
          {invoice.kibocsatas_datuma ? format(new Date(invoice.kibocsatas_datuma), 'yyyy.MM.dd.', { locale: hu }) : '-'}
        </TableCell>

        <TableCell className="text-center text-muted-foreground tabular-nums whitespace-nowrap">
          {invoice.teljesites_datuma ? format(new Date(invoice.teljesites_datuma), 'yyyy.MM.dd.', { locale: hu }) : '-'}
        </TableCell>

        <TableCell className="font-medium font-mono">
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <CopyableCell
              value={invoice.bizonylatsorszam || '-'}
              ariaLabel={`${invoice.bizonylatsorszam} bizonylatsorszám másolása`}
            />

            {/* Buyer mismatch warning badge */}
            {buyerMismatch.isMismatch && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-sans font-semibold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-300/60 dark:border-rose-700/60 shrink-0 cursor-help">
                      <AlertOctagon className="h-3 w-3" />
                      Eltérő vevő
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs font-sans">
                    <p className="font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                      <AlertOctagon className="h-3.5 w-3.5" /> A számla vevője eltér az aktív cégtől!
                    </p>
                    <p className="mt-1 text-foreground">
                      Számlán szereplő vevő: <strong>{buyerMismatch.buyerName || 'Ismeretlen vevő'}</strong>
                      {buyerMismatch.buyerTax ? ` (${buyerMismatch.buyerTax})` : ''}
                    </p>
                    <p className="text-muted-foreground mt-0.5">
                      Aktív cég: {buyerMismatch.companyName || '-'} ({buyerMismatch.companyTax || '-'})
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* NAV missing warning icon right after bizonylatsorszám */}
            {(invoice.nav_status === 'missing_nav' || invoice.statusz === 'jovahagyasra_var') && (
              invoice.approved_at ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center justify-center p-0.5 text-blue-600 dark:text-blue-400 shrink-0 cursor-help" aria-label="Könyvelő által jóváhagyva">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs font-sans">
                      <p className="font-semibold text-blue-600 dark:text-blue-400">Könyvelő által jóváhagyva</p>
                      <p className="text-muted-foreground mt-0.5">{invoice.approval_note || 'NAV adatszolgáltatás nélkül engedélyezve'}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center p-1 rounded-full text-amber-600 hover:text-amber-700 bg-amber-500/15 hover:bg-amber-500/25 dark:text-amber-400 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 transition-colors cursor-pointer shrink-0 border border-amber-300/60 dark:border-amber-700/60"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedInvoiceForApproval(invoice);
                          setApprovalDialogOpen(true);
                        }}
                        aria-label="Nincs NAV online számla adatszolgáltatás! Kattintson a könyvelői jóváhagyáshoz."
                      >
                        <AlertTriangle className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs font-sans">
                      <p className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" /> NAV adatszolgáltatás hiányzik!
                      </p>
                      <p className="text-muted-foreground mt-0.5">
                        A számlához nem tartozik online számla adatszolgáltatás. Kattintson ide a könyvelői jóváhagyáshoz!
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )
            )}
          </div>
        </TableCell>

        <TableCell
          className={cn(
            'text-right font-mono tabular-nums whitespace-nowrap',
            invoice.reference_number
              ? 'text-muted-foreground italic'
              : !invoice.adoalap_osszesen
                ? 'text-muted-foreground'
                : activeTab === 'SUBMITTED_INBOUND'
                  ? 'text-destructive'
                  : 'text-success'
          )}
        >
          {formatCurrency(invoice.adoalap_osszesen || 0, invoice.penznem || 'HUF')}
        </TableCell>

        <TableCell
          className={cn(
            'text-right font-mono tabular-nums font-medium whitespace-nowrap',
            invoice.reference_number
              ? 'text-muted-foreground italic'
              : !invoice.brutto_vegosszeg
                ? 'text-muted-foreground'
                : activeTab === 'SUBMITTED_INBOUND'
                  ? 'text-destructive'
                  : 'text-success'
          )}
        >
          {formatCurrency(invoice.brutto_vegosszeg || 0, invoice.penznem || 'HUF')}
        </TableCell>

        <TableCell className="text-right font-mono tabular-nums text-muted-foreground whitespace-nowrap">
          <div className="flex flex-col items-end gap-1">
            <span>{formatCurrency(invoice.afa_osszeg_osszesen || 0, invoice.penznem || 'HUF')}</span>
            {nonDeductibleInfo && nonDeductibleInfo.nonDeductibleVat > 0 && activeTab !== 'SUBMITTED_OUTBOUND' && (
              <div onClick={(e) => e.stopPropagation()}>
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-400/40 cursor-help transition-colors hover:bg-amber-500/25">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                        {nonDeductibleInfo.minPercentage === 0 ? '0% lev.' : `${nonDeductibleInfo.minPercentage}/${100 - nonDeductibleInfo.minPercentage}`}
                        <span className="text-muted-foreground/80 font-normal">(-{formatCurrency(nonDeductibleInfo.nonDeductibleVat, invoice.penznem || 'HUF')})</span>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="text-xs space-y-1.5 max-w-[240px] text-left">
                      <p className="font-semibold text-amber-500 flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        ÁFA Levonási Korlátozás
                      </p>
                      <div className="space-y-0.5 font-sans">
                        <div className="flex justify-between gap-3 text-emerald-600 dark:text-emerald-400">
                          <span>Levonható:</span>
                          <span className="font-mono font-medium">{formatCurrency((invoice.afa_osszeg_osszesen || 0) - nonDeductibleInfo.nonDeductibleVat, invoice.penznem || 'HUF')}</span>
                        </div>
                        <div className="flex justify-between gap-3 text-amber-600 dark:text-amber-400">
                          <span>Nem levonható:</span>
                          <span className="font-mono font-medium">{formatCurrency(nonDeductibleInfo.nonDeductibleVat, invoice.penznem || 'HUF')}</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground pt-1 border-t border-border/30">
                        Áfa tv. szerinti levonási hányad (pl. telefon 70/30, szgk.)
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}
            <div onClick={(e) => e.stopPropagation()}>
              <InvoiceVatCodeSelector
                invoiceId={invoice.id}
                invoiceNumber={invoice.bizonylatsorszam || undefined}
                companyId={companyId}
                currentVatCodeId={invoice.vat_code_id}
                currentVatRowOverride={invoice.vat_row_override}
                direction={activeTab === 'SUBMITTED_OUTBOUND' ? 'OUTBOUND' : 'INBOUND'}
                onUpdated={invalidateInvoiceData}
              />
            </div>
          </div>
        </TableCell>

        <TableCell className="text-center">
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div onClick={(e) => e.stopPropagation()} className="inline-flex items-center justify-center p-1">
                  <Checkbox
                    checked={isReviewed}
                    onCheckedChange={async (checked) => {
                      const nextVal = !!checked;
                      setIsOptimisticReviewed(nextVal);
                      try {
                        const { error } = await supabase
                          .from('invoices')
                          .update({ is_accountant_reviewed: nextVal })
                          .eq('id', invoice.id);
                        if (error) {
                          console.error('Failed to update invoice accountant reviewed status:', error);
                          setIsOptimisticReviewed(null);
                          return;
                        }
                        invalidateInvoiceData?.();
                      } catch (err) {
                        console.error('Error updating invoice accountant reviewed status:', err);
                        setIsOptimisticReviewed(null);
                      }
                    }}
                    className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600 cursor-pointer"
                    aria-label="Kikontírozva statusz valtoztatasa"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs font-medium">Kikontírozott / Könyvelve jelölés</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </TableCell>

        <TableCell className="text-center">
          <div className="flex items-center justify-center gap-1.5">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-muted/50 text-muted-foreground border border-black/10 dark:border-white/10">
              {getPaymentMethodLabel(invoice.fizetesi_mod)}
            </span>
            {invoice.exclude_from_accounting && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-300/40 whitespace-nowrap">
                {t('invoices:expanded.not_booked', 'Nem könyvelt')}
              </span>
            )}
            {((invoice as any).is_cross_year || (
              invoice.teljesites_datuma && invoice.kibocsatas_datuma &&
              new Date(invoice.teljesites_datuma).getFullYear() < new Date(invoice.kibocsatas_datuma).getFullYear()
            )) && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-300/40 whitespace-nowrap cursor-help">
                      ⏳ Áthúzódó
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-[280px]">
                    <div className="text-xs space-y-1">
                      <p className="font-semibold">{t('invoices:expanded.cross_year_title', 'Áthúzódó gazdasági teljesítés')}</p>
                      <p className="text-muted-foreground">
                        {t('invoices:expanded.cross_year_desc', 'A számla gazdasági teljesítése korábbi üzleti évre esik, mint a bizonylatkelt. A folyó évi eredményt és ÁFA-t közvetlenül nem terheli.')}
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </TableCell>

        <TableCell className="text-center">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-70 group-hover:opacity-100"
                  onClick={() => {
                    setSelectedSubmittedForItems(invoice);
                    setSubmittedItemsDialogOpen(true);
                    setInvoiceParam(invoice.id);
                  }}
                >
                  <Package className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Számlatételek megtekintése</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </TableCell>

        <TableCell className="text-center">
          {invoice.image_url || invoice.melleklet_url ? (
            <HoverCard openDelay={200} closeDelay={100}>
              <HoverCardTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 opacity-70 group-hover:opacity-100"
                  onClick={() => {
                    setSelectedInvoice(invoice);
                    setImageDialogOpen(true);
                    setInvoiceParam(invoice.id, 'view');
                  }}
                >
                  <FileText className="h-4 w-4" />
                </Button>
              </HoverCardTrigger>
              <HoverCardContent side="left" align="center" className="w-64 p-1.5">
                <InvoiceImagePreview
                  invoiceId={invoice.id}
                  imageUrl={invoice.image_url}
                  mellekletUrl={invoice.melleklet_url}
                  isOpen={true}
                />
              </HoverCardContent>
            </HoverCard>
          ) : (
            <FileText className="h-4 w-4 mx-auto text-muted-foreground/30" />
          )}
        </TableCell>

        <TableCell className="text-center">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 opacity-70 group-hover:opacity-100"
                  onClick={() => {
                    setSelectedInvoice(invoice);
                    setEditDialogOpen(true);
                    setInvoiceParam(invoice.id, 'edit');
                  }}
                  disabled={!writable}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Számla szerkesztése</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </TableCell>
      </TableRow>

      {isExpanded && matches && (
        <ExpandedInvoiceRow
          colSpan={13}
          matchedSubmittedInvoices={[]}
          matchedNavInvoices={matches.matchedNav}
          matchedTransactions={matches.matchedTransactions}
          linkedInvoices={matches.linkedInvoices}
          invoiceReferenceNumber={invoice.reference_number}
          linkedInvoicesLoading={linkedInvoicesLoading}
          onViewInvoice={(inv) => {
            setSelectedInvoice(inv as any);
            setImageDialogOpen(true);
          }}
          excludeFromAccounting={!!invoice.exclude_from_accounting}
          onToggleExclude={() => onToggleExclude(invoice.id, !!invoice.exclude_from_accounting)}
          invoiceId={invoice.id}
          invoiceAmount={invoice.brutto_vegosszeg || 0}
          invoiceCurrency={invoice.penznem || 'HUF'}
          invoiceDate={invoice.kibocsatas_datuma || ''}
          companyId={companyId}
          transactionId={(invoice as any).transaction_id || undefined}
          invoiceNumber={invoice.bizonylatsorszam || undefined}
          invoiceSource="submitted"
          navStatus={invoice.nav_status}
          statusz={invoice.statusz}
          approvedAt={invoice.approved_at}
          approvalNote={invoice.approval_note}
          onOpenApprovalDialog={() => {
            setSelectedInvoiceForApproval(invoice);
            setApprovalDialogOpen(true);
          }}
          onMatchUpdate={invalidateInvoiceData}
          categories={categories}
          projects={projects}
          vatCodeId={invoice.vat_code_id}
          vatRowOverride={invoice.vat_row_override}
          invoiceType={activeTab === 'SUBMITTED_OUTBOUND' ? 'outbound' : 'inbound'}
          nonDeductibleInfo={nonDeductibleInfo}
        />
      )}
    </React.Fragment>
  );
}
