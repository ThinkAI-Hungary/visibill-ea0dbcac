import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TableRow, TableCell } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { CopyableCell } from '@/components/ui/copyable-cell';
import { InvoiceImagePreview } from '@/components/InvoiceImagePreview';
import ExpandedInvoiceRow from '@/components/ExpandedInvoiceRow';
import { ChevronDown, Scale, FileText, Package, Sparkles } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { getInitials, getAvatarColor } from '@/lib/helpers';
import { normalizeInvoiceNumber } from '@/lib/invoiceMatchingUtils';
import { InvoiceVatCodeSelector } from '@/components/vat/InvoiceVatCodeSelector';
import { format } from 'date-fns';
import { getDateFnsLocale } from '@/lib/locale/formatters';
import { useInvoiceContext } from '../../context/useInvoiceContext';
import { useCompanyJurisdiction } from '@/hooks/useCompanyJurisdiction';
import type { NavInvoice, SubmittedInvoice, TransactionRecord } from '../../types';
import { resolveLinkedInvoices, type SuggestedSubmittedInvoiceWithScore } from '../../utils/invoiceRelations';
import type { LinkedInvoice } from '../expanded-row/types';
import { supabase } from '@/integrations/supabase/client';

interface NavInvoiceRowProps {
  invoice: NavInvoice;
  navToSubmittedMap: Map<string, SubmittedInvoice[]>;
  navToSuggestedSubmittedMap?: Map<string, SuggestedSubmittedInvoiceWithScore[]>;
  pageInvoiceIdToTransactionsMap: Map<string, TransactionRecord[]>;
  nonDeductibleInfo?: {
    deductibleVat: number;
    nonDeductibleVat: number;
    minPercentage: number;
  } | null;
  onRowClick: (invoiceId: string, e: React.MouseEvent) => void;
  onToggleExclude: (invoiceId: string, currentValue: boolean) => Promise<void>;
}

interface LazyRowSelectProps {
  value: string | null;
  placeholder?: string;
  items: Array<{ id: string; name: string }>;
  onChange: (value: string) => void;
  className?: string;
}

const LazyRowSelect = React.memo(function LazyRowSelect({
  value,
  placeholder = 'Válassz...',
  items,
  onChange,
  className,
}: LazyRowSelectProps) {
  const [open, setOpen] = useState(false);
  const selectedItem = useMemo(() => items.find((i) => i.id === value), [items, value]);

  const displayLabel = value && value !== 'none'
    ? selectedItem?.name || placeholder
    : value === 'none'
    ? '-'
    : undefined;

  return (
    <Select
      value={value || 'none'}
      onValueChange={onChange}
      open={open}
      onOpenChange={setOpen}
    >
      <SelectTrigger
        className={cn(
          "w-[100px] h-8 mx-auto bg-transparent border-transparent hover:border-border/50 focus:border-primary/50 transition-colors [&>span]:truncate [&>span]:flex-1 [&>svg]:shrink-0",
          className
        )}
      >
        <SelectValue placeholder={placeholder}>
          {displayLabel}
        </SelectValue>
      </SelectTrigger>
      {open && (
        <SelectContent>
          <SelectItem value="none">-</SelectItem>
          {items.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.name}
            </SelectItem>
          ))}
        </SelectContent>
      )}
    </Select>
  );
});

function NavInvoiceRowComponent({
  invoice,
  navToSubmittedMap,
  navToSuggestedSubmittedMap,
  pageInvoiceIdToTransactionsMap,
  nonDeductibleInfo,
  onRowClick,
  onToggleExclude,
}: NavInvoiceRowProps) {
  const { t } = useTranslation(['invoices', 'common']);
  const { defaultCurrency } = useCompanyJurisdiction();
  const {
    activeTab,
    companyId,
    categories,
    projects,
    nettingInvoiceIds,
    getNettingGroup,
    selectedInvoiceIds,
    toggleSelectRow,
    expandedRowIds,
    getInvoicePartnerName,
    getPartnerTaxNumber,
    getPaymentMethodLabel,
    handleCategoryChange,
    handleProjectChange,
    setSelectedInvoice,
    setImageDialogOpen,
    setSelectedNavInvoice,
    setItemsDialogOpen,
    setInvoiceParam,
    linkedInvoicesLoading,
    linkedInvoicesMap,
    invalidateInvoiceData,
    navIdToCourierReportsMap,
    setSuggestedLinkDialogOpen,
    setSelectedSuggestedLinkPair,
  } = useInvoiceContext();

  const navKey = useMemo(() => normalizeInvoiceNumber(invoice.invoice_number), [invoice.invoice_number]);
  const submittedMatches = useMemo(() => navToSubmittedMap.get(navKey) || [], [navToSubmittedMap, navKey]);
  const effectiveCategoryId = invoice.category_id || submittedMatches[0]?.category_id || null;
  const effectiveProjectId = invoice.project_id || submittedMatches[0]?.project_id || null;

  const partnerName = getInvoicePartnerName(invoice);
  const matchStatus = (invoice as any).match_status || (invoice.paid ? 'matched' : 'unmatched');
  const isPaid = matchStatus === 'matched';
  const isPartiallyPaid = matchStatus === 'partially_paid';
  const isSuggested = matchStatus === 'suggested';
  const isNettingCandidate = nettingInvoiceIds.has(invoice.id);
  const isExpanded = expandedRowIds.has(invoice.id);
  const isSelected = selectedInvoiceIds.has(invoice.id);

  const [isOptimisticReviewed, setIsOptimisticReviewed] = useState<boolean | null>(null);

  useEffect(() => {
    setIsOptimisticReviewed(null);
  }, [invoice.id, invoice.is_accountant_reviewed]);

  const isReviewed = isOptimisticReviewed !== null
    ? isOptimisticReviewed
    : (
        invoice.is_accountant_reviewed === true ||
        invoice.submitted === true ||
        (navToSubmittedMap.get(navKey)?.length ?? 0) > 0
      );

  const getNavInvoiceMatches = (navInvoice: NavInvoice) => {
    const matchedSubmitted = navInvoice.invoice_number
      ? navToSubmittedMap.get(navKey) || []
      : [];
    const allTxMap = new Map<string, TransactionRecord>();
    (pageInvoiceIdToTransactionsMap.get(navInvoice.id) || []).forEach(tx => allTxMap.set(tx.id, tx));
    matchedSubmitted.forEach(sub => {
      (pageInvoiceIdToTransactionsMap.get(sub.id) || []).forEach(tx => allTxMap.set(tx.id, tx));
    });

    let linkedInvoices: LinkedInvoice[] = [];
    if (matchedSubmitted.length > 0) {
      linkedInvoices = resolveLinkedInvoices(matchedSubmitted[0], linkedInvoicesMap);
    } else if (navInvoice.original_invoice_number || navInvoice.invoice_number) {
      const pseudoSub = {
        id: navInvoice.id,
        bizonylatsorszam: navInvoice.invoice_number,
        reference_number: navInvoice.original_invoice_number,
      } as SubmittedInvoice;
      linkedInvoices = resolveLinkedInvoices(pseudoSub, linkedInvoicesMap);
    }

    return {
      matchedSubmitted,
      matchedTransactions: Array.from(allTxMap.values()),
      matchedNav: [] as NavInvoice[],
      linkedInvoices,
      matchedCourierReports: navIdToCourierReportsMap.get(navInvoice.id) || [],
    };
  };

  const matches = isExpanded ? getNavInvoiceMatches(invoice) : null;

  return (
    <React.Fragment key={invoice.id}>
      <TableRow
        data-row-hover
        className={cn(
          'group cursor-pointer transition-colors',
          isSelected && 'bg-primary/10',
          !isSelected && isPaid && 'bg-[var(--row-matched-bg)]',
          !isSelected && isPartiallyPaid && 'bg-blue-500/[0.06]',
          !isSelected && isSuggested && 'bg-[var(--row-suggested-bg)]',
          !isSelected && !isPaid && !isPartiallyPaid && !isSuggested && !isNettingCandidate && 'bg-[var(--row-unmatched-bg)]',
          !isSelected && isNettingCandidate && !isPaid && !isPartiallyPaid && !isSuggested && 'bg-orange-500/[0.06]',
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
              aria-label={`${invoice.invoice_number} kijelölése`}
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
            {partnerName === 'Ismeretlen partner' ? (
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
          {invoice.invoice_issue_date
            ? format(new Date(invoice.invoice_issue_date), 'yyyy.MM.dd.', { locale: getDateFnsLocale() })
            : '-'}
        </TableCell>

        <TableCell className="text-center text-muted-foreground tabular-nums whitespace-nowrap">
          {invoice.invoice_delivery_date
            ? format(new Date(invoice.invoice_delivery_date), 'yyyy.MM.dd.', { locale: getDateFnsLocale() })
            : '-'}
        </TableCell>

        <TableCell className="font-medium font-mono whitespace-nowrap">
          <CopyableCell
            value={invoice.invoice_number || '-'}
            ariaLabel={`${invoice.invoice_number} bizonylatsorszám másolása`}
          />
        </TableCell>

        <TableCell
          className={cn(
            'text-right font-mono tabular-nums whitespace-nowrap',
            !invoice.invoice_net_amount
              ? 'text-muted-foreground'
              : activeTab === 'INBOUND'
                ? 'text-destructive'
                : 'text-success'
          )}
        >
          {formatCurrency(invoice.invoice_net_amount || 0, invoice.currency || defaultCurrency)}
        </TableCell>

        <TableCell
          className={cn(
            'text-right font-mono tabular-nums font-medium whitespace-nowrap',
            !invoice.invoice_gross_amount
              ? 'text-muted-foreground'
              : activeTab === 'INBOUND'
                ? 'text-destructive'
                : 'text-success'
          )}
        >
          {formatCurrency(invoice.invoice_gross_amount || 0, invoice.currency || defaultCurrency)}
        </TableCell>

        <TableCell className="text-right font-mono tabular-nums text-muted-foreground whitespace-nowrap">
          <div className="flex flex-col items-end gap-1">
            <span>{formatCurrency(invoice.invoice_vat_amount || 0, invoice.currency || defaultCurrency)}</span>
            {nonDeductibleInfo && nonDeductibleInfo.nonDeductibleVat > 0 && activeTab !== 'OUTBOUND' && (
              <div onClick={(e) => e.stopPropagation()}>
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-400/40 cursor-help transition-colors hover:bg-amber-500/25">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                        {nonDeductibleInfo.minPercentage === 0 ? '0% lev.' : `${nonDeductibleInfo.minPercentage}/${100 - nonDeductibleInfo.minPercentage}`}
                        <span className="text-muted-foreground/80 font-normal">(-{formatCurrency(nonDeductibleInfo.nonDeductibleVat, invoice.currency || defaultCurrency)})</span>
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
                          <span className="font-mono font-medium">{formatCurrency((invoice.invoice_vat_amount || 0) - nonDeductibleInfo.nonDeductibleVat, invoice.currency || defaultCurrency)}</span>
                        </div>
                        <div className="flex justify-between gap-3 text-amber-600 dark:text-amber-400">
                          <span>Nem levonható:</span>
                          <span className="font-mono font-medium">{formatCurrency(nonDeductibleInfo.nonDeductibleVat, invoice.currency || defaultCurrency)}</span>
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
                navInvoiceId={invoice.id}
                invoiceNumber={invoice.invoice_number}
                companyId={companyId}
                currentVatCodeId={invoice.vat_code_id}
                currentVatRowOverride={invoice.vat_row_override}
                direction={(invoice.invoice_direction?.toUpperCase() as 'INBOUND' | 'OUTBOUND') || (activeTab === 'OUTBOUND' ? 'OUTBOUND' : 'INBOUND')}
                onUpdated={invalidateInvoiceData}
              />
            </div>
          </div>
        </TableCell>

        <TableCell className="text-center">
          <div className="flex items-center justify-center gap-1.5">
            {isPaid ? (
              <span className="inline-flex items-center justify-center min-w-[72px] px-2 py-0.5 rounded-md text-xs font-medium border border-black/10 dark:border-white/10 bg-success/10 text-success">
                {t('invoices:filters.paid', 'Kifizetve')}
              </span>
            ) : isPartiallyPaid ? (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center justify-center min-w-[72px] px-2 py-0.5 rounded-md text-xs font-medium border border-blue-500/30 bg-blue-500/15 text-blue-600 dark:text-blue-400 cursor-help">
                      {t('invoices:filters.partial', 'Részben fizetve')}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs space-y-1">
                    <p className="font-semibold text-blue-400">{t('invoices:filters.partial', 'Részben kifizetve')}</p>
                    <p>
                      {t('invoices:expanded.paid_label', 'Kifizetve:')}{' '}
                      <span className="font-mono font-medium text-emerald-400">
                        {formatCurrency(invoice.paid_amount || 0, invoice.currency || 'HUF')}
                      </span>
                    </p>
                    <p>
                      {t('invoices:expanded.remaining_label', 'Fennmaradó:')}{' '}
                      <span className="font-mono font-medium text-destructive">
                        {formatCurrency(invoice.remaining_amount || 0, invoice.currency || 'HUF')}
                      </span>
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <span className="inline-flex items-center justify-center min-w-[72px] px-2 py-0.5 rounded-md text-xs font-medium border border-black/10 dark:border-white/10 bg-destructive/10 text-destructive">
                {t('invoices:filters.open', 'Nyitott')}
              </span>
            )}

            {isNettingCandidate && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-400/40 whitespace-nowrap cursor-help">
                      <Scale className="h-3 w-3" />
                      {t('invoices:expanded.compensation_candidate', 'Kompenzálandó')}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-[280px]">
                    {(() => {
                      const ng = getNettingGroup(invoice.id);
                      if (!ng) return null;
                      return (
                        <div className="text-xs space-y-1">
                          <p className="font-semibold">{ng.partnerName}</p>
                          <p className="text-muted-foreground">Teljesítési hónap: {ng.deliveryMonth}</p>
                          <p>
                            Bejövő:{' '}
                            <span className="font-mono text-destructive">
                              {formatCurrency(ng.inboundTotal, ng.currency)}
                            </span>
                          </p>
                          <p>
                            Kimenő:{' '}
                            <span className="font-mono text-success">
                              {formatCurrency(ng.outboundTotal, ng.currency)}
                            </span>
                          </p>
                          <p className="font-medium pt-0.5 border-t border-border/30">
                            Különbözet:{' '}
                            <span className="font-mono">{formatCurrency(Math.abs(ng.netDifference), ng.currency)}</span>
                          </p>
                        </div>
                      );
                    })()}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {invoice.exclude_from_accounting && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-300/40 whitespace-nowrap">
                {t('invoices:expanded.not_booked', 'Nem könyvelt')}
              </span>
            )}

            {((invoice as any).is_cross_year || (
              invoice.invoice_delivery_date && invoice.invoice_issue_date &&
              new Date(invoice.invoice_delivery_date).getFullYear() < new Date(invoice.invoice_issue_date).getFullYear()
            )) && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-300/40 whitespace-nowrap cursor-help">
                      {t('invoices:expanded.cross_year_badge', '⏳ Áthúzódó')}
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

            {invoice.is_continuous && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-400/40 whitespace-nowrap cursor-help">
                      {t('invoices:expanded.continuous_badge', '🔄 Foly.')}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-[280px]">
                    <div className="text-xs space-y-1">
                      <p className="font-semibold">{t('invoices:expanded.continuous_service', 'Folyamatos szolgáltatás')}</p>
                      {invoice.service_period_start && invoice.service_period_end && (
                        <p className="text-muted-foreground">
                          {t('invoices:expanded.service_period', 'Szolg. időszak:')}{' '}
                          {format(new Date(invoice.service_period_start), 'yyyy.MM.dd', { locale: getDateFnsLocale() })} –{' '}
                          {format(new Date(invoice.service_period_end), 'yyyy.MM.dd', { locale: getDateFnsLocale() })}
                        </p>
                      )}
                      {(invoice.calculated_ti || invoice.ti_override) && (
                        <p>
                          {t('invoices:expanded.ti_label', 'TI:')}{' '}
                          <span className="font-mono">
                            {format(new Date(invoice.ti_override || invoice.calculated_ti!), 'yyyy.MM.dd', {
                              locale: getDateFnsLocale(),
                            })}
                          </span>
                          <span className="text-muted-foreground/70 ml-1">
                            (
                            {invoice.ti_calculation_method === 'manual'
                              ? t('invoices:expanded.ti_method_manual', 'kézi')
                              : invoice.ti_calculation_method === 'nav_period_end'
                                ? t('invoices:expanded.ti_method_nav', 'NAV')
                                : invoice.ti_calculation_method === 'payment_due'
                                  ? 'fiz. hat.'
                                  : 'telj. dátum'}
                            )
                          </span>
                        </p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
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
                          .from('nav_invoices')
                          .update({ is_accountant_reviewed: nextVal })
                          .eq('id', invoice.id);
                        if (error) {
                          console.error('Failed to update nav invoice accountant reviewed status:', error);
                          setIsOptimisticReviewed(null);
                          return;
                        }
                        invalidateInvoiceData?.();
                      } catch (err) {
                        console.error('Error updating nav invoice accountant reviewed status:', err);
                        setIsOptimisticReviewed(null);
                      }
                    }}
                    className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600 cursor-pointer"
                    aria-label="Kikontírozva statusz valtoztatasa"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs font-medium">{t('invoices:expanded.accountant_reviewed_tooltip', 'Kikontírozott / Könyvelve jelölés')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </TableCell>

        {activeTab === 'INBOUND' && (
          <TableCell className="text-center">
            <LazyRowSelect
              value={effectiveCategoryId}
              items={categories}
              onChange={(value) => handleCategoryChange(invoice.id, value, invoice.invoice_number)}
            />
          </TableCell>
        )}

        <TableCell className="text-center">
          <LazyRowSelect
            value={effectiveProjectId}
            items={projects}
            onChange={(value) => handleProjectChange(invoice.id, value)}
          />
        </TableCell>

        <TableCell className="text-center">
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-muted/50 text-muted-foreground border border-black/10 dark:border-white/10">
            {getPaymentMethodLabel(invoice.payment_method)}
          </span>
        </TableCell>

        <TableCell className="text-center">
          {(() => {
            const sub = submittedMatches.find(s => s.image_url || s.melleklet_url);
            if (sub) {
              return (
                <HoverCard openDelay={200} closeDelay={100}>
                  <HoverCardTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 opacity-70 group-hover:opacity-100"
                      onClick={() => {
                        setSelectedInvoice(sub as any);
                        setImageDialogOpen(true);
                      }}
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                  </HoverCardTrigger>
                  <HoverCardContent side="left" align="center" className="w-64 p-1.5">
                    <InvoiceImagePreview
                      invoiceId={sub.id}
                      imageUrl={sub.image_url}
                      mellekletUrl={sub.melleklet_url}
                      attachments={(sub as any).attachments}
                      isOpen={true}
                    />
                  </HoverCardContent>
                </HoverCard>
              );
            }

            const suggestedSubs = navToSuggestedSubmittedMap?.get(navKey);
            const suggestedSub = suggestedSubs?.[0];
            if (suggestedSub) {
              return (
                <>
                  <TooltipProvider delayDuration={150}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-1.5 gap-1 bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/40 text-amber-600 dark:text-amber-400 font-medium text-xs transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSuggestedLinkPair({
                              navInvoice: invoice,
                              suggestedInvoice: suggestedSub,
                            });
                            setSuggestedLinkDialogOpen(true);
                          }}
                        >
                          <FileText className="h-3.5 w-3.5" />
                          <Sparkles className="h-3 w-3 text-amber-500 animate-pulse" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-[280px]">
                        <div className="text-xs space-y-1">
                          <p className="font-semibold text-amber-600 dark:text-amber-400">
                            Javasolt számlakép ({suggestedSub.suggestedScore}%)
                          </p>
                          <p className="text-muted-foreground">
                            Kinyert sorszám: <span className="font-mono font-medium text-foreground">{suggestedSub.bizonylatsorszam || '-'}</span>
                          </p>
                          <p className="text-[11px] text-muted-foreground">Kattintson az összerendeléshez és jóváhagyáshoz!</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </>
              );
            }

            return <FileText className="h-4 w-4 mx-auto text-muted-foreground/30" />;
          })()}
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
                    setSelectedNavInvoice(invoice);
                    setItemsDialogOpen(true);
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
      </TableRow>

      {isExpanded && matches && (
        <ExpandedInvoiceRow
          colSpan={activeTab === 'INBOUND' ? 15 : 13}
          matchedSubmittedInvoices={matches.matchedSubmitted}
          matchedNavInvoices={[]}
          matchedTransactions={matches.matchedTransactions}
          matchedCourierReports={matches.matchedCourierReports}
          linkedInvoices={matches.linkedInvoices}
          invoiceReferenceNumber={invoice.original_invoice_number || (matches.matchedSubmitted[0]?.reference_number ?? null)}
          linkedInvoicesLoading={linkedInvoicesLoading}
          onViewInvoice={(inv) => {
            setSelectedInvoice(inv as any);
            setImageDialogOpen(true);
          }}
          excludeFromAccounting={!!invoice.exclude_from_accounting}
          onToggleExclude={() => onToggleExclude(invoice.id, !!invoice.exclude_from_accounting)}
          invoiceId={invoice.id}
          invoiceAmount={invoice.invoice_gross_amount || 0}
          invoiceCurrency={invoice.currency || 'HUF'}
          invoiceDate={invoice.invoice_issue_date || ''}
          companyId={companyId}
          transactionId={invoice.transaction_id || undefined}
          invoiceSource="nav"
          onMatchUpdate={invalidateInvoiceData}
          glNumbers={invoice.gl_numbers}
          hasSubmittedMatch={matches.matchedSubmitted.length > 0}
          categories={categories}
          projects={projects}
          nettingGroup={getNettingGroup(invoice.id)}
          isContinuous={!!invoice.is_continuous}
          servicePeriodStart={invoice.service_period_start}
          servicePeriodEnd={invoice.service_period_end}
          calculatedTi={invoice.calculated_ti}
          tiOverride={invoice.ti_override}
          tiCalculationMethod={invoice.ti_calculation_method}
          invoiceOperation={invoice.invoice_operation}
          isManualPayment={invoice.is_manual_payment}
          invoiceNumber={invoice.invoice_number}
          vatCodeId={invoice.vat_code_id}
          vatRowOverride={invoice.vat_row_override}
          invoiceType={(invoice.invoice_direction?.toLowerCase() as 'inbound' | 'outbound') || (activeTab === 'OUTBOUND' ? 'outbound' : 'inbound')}
          vatSummary={(invoice as any).vat_summary}
          nonDeductibleInfo={nonDeductibleInfo}
        />
      )}
    </React.Fragment>
  );
}

export const NavInvoiceRow = React.memo(NavInvoiceRowComponent);

