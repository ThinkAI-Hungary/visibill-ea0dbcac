import React from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { CopyableCell } from '@/components/ui/copyable-cell';
import { InvoiceImagePreview } from '@/components/InvoiceImagePreview';
import ExpandedInvoiceRow from '@/components/ExpandedInvoiceRow';
import { ChevronDown, Scale, FileText, Package } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { getInitials, getAvatarColor } from '@/lib/helpers';
import { normalizeInvoiceNumber } from '@/lib/invoiceMatchingUtils';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { useInvoiceContext } from '../../context/useInvoiceContext';
import type { NavInvoice, SubmittedInvoice, TransactionRecord } from '../../types';

interface NavInvoiceRowProps {
  invoice: NavInvoice;
  navToSubmittedMap: Map<string, SubmittedInvoice[]>;
  pageInvoiceIdToTransactionsMap: Map<string, TransactionRecord[]>;
  onRowClick: (invoiceId: string, e: React.MouseEvent) => void;
  onToggleExclude: (invoiceId: string, currentValue: boolean) => Promise<void>;
}

export function NavInvoiceRow({
  invoice,
  navToSubmittedMap,
  pageInvoiceIdToTransactionsMap,
  onRowClick,
  onToggleExclude,
}: NavInvoiceRowProps) {
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
    invalidateInvoiceData,
    navIdToCourierReportsMap,
  } = useInvoiceContext();

  const partnerName = getInvoicePartnerName(invoice);
  const matchStatus = (invoice as any).match_status || (invoice.paid ? 'matched' : 'unmatched');
  const isPaid = matchStatus === 'matched';
  const isPartiallyPaid = matchStatus === 'partially_paid';
  const isSuggested = matchStatus === 'suggested';
  const isNettingCandidate = nettingInvoiceIds.has(invoice.id);
  const isExpanded = expandedRowIds.has(invoice.id);
  const isSelected = selectedInvoiceIds.has(invoice.id);

  const getNavInvoiceMatches = (navInvoice: NavInvoice) => {
    const matchedSubmitted = navInvoice.invoice_number
      ? navToSubmittedMap.get(normalizeInvoiceNumber(navInvoice.invoice_number)) || []
      : [];
    const allTxMap = new Map<string, TransactionRecord>();
    (pageInvoiceIdToTransactionsMap.get(navInvoice.id) || []).forEach(tx => allTxMap.set(tx.id, tx));
    matchedSubmitted.forEach(sub => {
      (pageInvoiceIdToTransactionsMap.get(sub.id) || []).forEach(tx => allTxMap.set(tx.id, tx));
    });

    return {
      matchedSubmitted,
      matchedTransactions: Array.from(allTxMap.values()),
      matchedNav: [] as NavInvoice[],
      linkedInvoices: [] as any[],
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
            ? format(new Date(invoice.invoice_issue_date), 'yyyy.MM.dd.', { locale: hu })
            : '-'}
        </TableCell>

        <TableCell className="text-center text-muted-foreground tabular-nums whitespace-nowrap">
          {invoice.invoice_delivery_date
            ? format(new Date(invoice.invoice_delivery_date), 'yyyy.MM.dd.', { locale: hu })
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
          {formatCurrency(invoice.invoice_net_amount || 0, invoice.currency || 'HUF')}
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
          {formatCurrency(invoice.invoice_gross_amount || 0, invoice.currency || 'HUF')}
        </TableCell>

        <TableCell className="text-right font-mono tabular-nums text-muted-foreground whitespace-nowrap">
          {formatCurrency(invoice.invoice_vat_amount || 0, invoice.currency || 'HUF')}
        </TableCell>

        <TableCell className="text-center">
          <div className="flex items-center justify-center gap-1.5">
            {isPaid ? (
              <span className="inline-flex items-center justify-center min-w-[72px] px-2 py-0.5 rounded-md text-xs font-medium border border-black/10 dark:border-white/10 bg-success/10 text-success">
                Kifizetve
              </span>
            ) : isPartiallyPaid ? (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center justify-center min-w-[72px] px-2 py-0.5 rounded-md text-xs font-medium border border-blue-500/30 bg-blue-500/15 text-blue-600 dark:text-blue-400 cursor-help">
                      Részben fizetve
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs space-y-1">
                    <p className="font-semibold text-blue-400">Részben kifizetve</p>
                    <p>
                      Kifizetve:{' '}
                      <span className="font-mono font-medium text-emerald-400">
                        {formatCurrency(invoice.paid_amount || 0, invoice.currency || 'HUF')}
                      </span>
                    </p>
                    <p>
                      Fennmaradó:{' '}
                      <span className="font-mono font-medium text-destructive">
                        {formatCurrency(invoice.remaining_amount || 0, invoice.currency || 'HUF')}
                      </span>
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <span className="inline-flex items-center justify-center min-w-[72px] px-2 py-0.5 rounded-md text-xs font-medium border border-black/10 dark:border-white/10 bg-destructive/10 text-destructive">
                Nyitott
              </span>
            )}

            {isNettingCandidate && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-400/40 whitespace-nowrap cursor-help">
                      <Scale className="h-3 w-3" />
                      Kompenzálandó
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
                Nem könyvelt
              </span>
            )}

            {invoice.is_continuous && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-400/40 whitespace-nowrap cursor-help">
                      🔄 Foly.
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-[280px]">
                    <div className="text-xs space-y-1">
                      <p className="font-semibold">Folyamatos szolgáltatás</p>
                      {invoice.service_period_start && invoice.service_period_end && (
                        <p className="text-muted-foreground">
                          Szolg. időszak:{' '}
                          {format(new Date(invoice.service_period_start), 'yyyy.MM.dd', { locale: hu })} –{' '}
                          {format(new Date(invoice.service_period_end), 'yyyy.MM.dd', { locale: hu })}
                        </p>
                      )}
                      {(invoice.calculated_ti || invoice.ti_override) && (
                        <p>
                          TI:{' '}
                          <span className="font-mono">
                            {format(new Date(invoice.ti_override || invoice.calculated_ti!), 'yyyy.MM.dd', {
                              locale: hu,
                            })}
                          </span>
                          <span className="text-muted-foreground/70 ml-1">
                            (
                            {invoice.ti_calculation_method === 'manual'
                              ? 'kézi'
                              : invoice.ti_calculation_method === 'nav_period_end'
                                ? 'NAV'
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

        {activeTab === 'INBOUND' && (
          <TableCell className="text-center">
            <Checkbox
              checked={
                invoice.submitted === true ||
                (navToSubmittedMap.get(normalizeInvoiceNumber(invoice.invoice_number))?.length ?? 0) > 0
              }
              disabled
              className="cursor-default opacity-70"
            />
          </TableCell>
        )}

        {activeTab === 'INBOUND' &&
          (() => {
            const submittedMatches = navToSubmittedMap.get(normalizeInvoiceNumber(invoice.invoice_number)) || [];
            const effectiveCategoryId = invoice.category_id || submittedMatches[0]?.category_id || null;
            return (
              <TableCell className="text-center">
                <Select
                  value={effectiveCategoryId || 'none'}
                  onValueChange={(value) => handleCategoryChange(invoice.id, value, invoice.invoice_number)}
                >
                  <SelectTrigger className="w-[100px] h-8 mx-auto bg-transparent border-transparent hover:border-border/50 focus:border-primary/50 transition-colors [&>span]:truncate [&>span]:flex-1 [&>svg]:shrink-0">
                    <SelectValue placeholder="Válassz..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
            );
          })()}

        <TableCell className="text-center">
          {(() => {
            const submittedMatches = navToSubmittedMap.get(normalizeInvoiceNumber(invoice.invoice_number)) || [];
            const effectiveProjectId = invoice.project_id || submittedMatches[0]?.project_id || null;
            return (
              <Select
                value={effectiveProjectId || 'none'}
                onValueChange={(value) => handleProjectChange(invoice.id, value, invoice.invoice_number)}
              >
                <SelectTrigger className="w-[100px] h-8 mx-auto bg-transparent border-transparent hover:border-border/50 focus:border-primary/50 transition-colors [&>span]:truncate [&>span]:flex-1 [&>svg]:shrink-0">
                  <SelectValue placeholder="Válassz..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            );
          })()}
        </TableCell>

        <TableCell className="text-center">
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-muted/50 text-muted-foreground border border-black/10 dark:border-white/10">
            {getPaymentMethodLabel(invoice.payment_method)}
          </span>
        </TableCell>

        <TableCell className="text-center">
          {(() => {
            const matchedSubs = navToSubmittedMap.get(normalizeInvoiceNumber(invoice.invoice_number));
            const sub = matchedSubs?.find(s => s.image_url || s.melleklet_url);
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
                      isOpen={true}
                    />
                  </HoverCardContent>
                </HoverCard>
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
        />
      )}
    </React.Fragment>
  );
}
