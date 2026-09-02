import React from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { CopyableCell } from '@/components/ui/copyable-cell';
import { InvoiceImagePreview } from '@/components/InvoiceImagePreview';
import ExpandedInvoiceRow from '@/components/ExpandedInvoiceRow';
import { ChevronDown, FileText, Package, Pencil } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { getInitials, getAvatarColor } from '@/lib/helpers';
import { normalizeInvoiceNumber } from '@/lib/invoiceMatchingUtils';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { useInvoiceContext } from '../../context/useInvoiceContext';
import type { SubmittedInvoice, NavInvoice, TransactionRecord } from '../../types';

interface SubmittedInvoiceRowProps {
  invoice: SubmittedInvoice;
  submittedToNavMap: Map<string, NavInvoice[]>;
  pageInvoiceIdToTransactionsMap: Map<string, TransactionRecord[]>;
  onRowClick: (invoiceId: string, e: React.MouseEvent) => void;
  onToggleExclude: (invoiceId: string, currentValue: boolean) => Promise<void>;
}

export function SubmittedInvoiceRow({
  invoice,
  submittedToNavMap,
  pageInvoiceIdToTransactionsMap,
  onRowClick,
  onToggleExclude,
}: SubmittedInvoiceRowProps) {
  const {
    activeTab,
    companyId,
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
  } = useInvoiceContext();

  const isExpanded = expandedRowIds.has(invoice.id);
  const isSelected = selectedSubmittedIds.has(invoice.id);
  const matchStatus = (invoice as any).match_status || 'unmatched';
  const isMatched = matchStatus === 'matched';
  const isPartiallyPaid = matchStatus === 'partially_paid';
  const isSuggested = matchStatus === 'suggested';
  const partnerName = activeTab === 'SUBMITTED_INBOUND' ? invoice.elado_nev || '-' : invoice.vevo_nev || '-';

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
          <CopyableCell
            value={invoice.bizonylatsorszam || '-'}
            ariaLabel={`${invoice.bizonylatsorszam} bizonylatsorszám másolása`}
          />
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
          {formatCurrency(invoice.afa_osszeg_osszesen || 0, invoice.penznem || 'HUF')}
        </TableCell>

        <TableCell className="text-center">
          <div className="flex items-center justify-center gap-1.5">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-muted/50 text-muted-foreground border border-black/10 dark:border-white/10">
              {invoice.fizetesi_mod || 'Nem megadott'}
            </span>
            {invoice.exclude_from_accounting && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-300/40 whitespace-nowrap">
                Nem könyvelt
              </span>
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
          colSpan={12}
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
          onMatchUpdate={invalidateInvoiceData}
          categories={categories}
          projects={projects}
        />
      )}
    </React.Fragment>
  );
}
