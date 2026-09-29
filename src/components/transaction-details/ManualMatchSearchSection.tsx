import React, { useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Search,
  Link2,
  FileText,
  Loader2,
  CheckCircle2,
  Ban,
  UploadCloud,
  Check,
  Layers,
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { formatDate } from '@/lib/locale/formatters';
import { useTranslation } from 'react-i18next';
import { toHuf, isSameCurrency } from '@/lib/matching/candidateFinder';
import { AvailableInvoice, TransactionItem } from '@/lib/matching/types';

export interface ManualMatchSearchSectionProps {
  mode: 'primary' | 'extra';
  transaction: TransactionItem;
  candidateInvoices: AvailableInvoice[];
  search: string;
  setSearch: (query: string) => void;
  selectedInvoiceId?: string | null;
  setSelectedInvoiceId?: (id: string | null) => void;
  selectedInvoiceIds?: string[];
  setSelectedInvoiceIds?: (ids: string[]) => void;
  toggleSelectInvoice?: (id: string) => void;
  clearSelection?: () => void;
  loading: boolean;
  isSearchingServer: boolean;
  isSaving: boolean;
  matchStatus: string;
  onBack?: () => void;
  onMatch: () => void;
  onMarkNoInvoice?: () => void;
  onMarkInvoiceMissing?: () => void;
}

export const ManualMatchSearchSection: React.FC<ManualMatchSearchSectionProps> = ({
  mode,
  transaction,
  candidateInvoices,
  search,
  setSearch,
  selectedInvoiceId,
  setSelectedInvoiceId,
  selectedInvoiceIds,
  setSelectedInvoiceIds,
  toggleSelectInvoice,
  clearSelection,
  loading,
  isSearchingServer,
  isSaving,
  matchStatus,
  onBack,
  onMatch,
  onMarkNoInvoice,
  onMarkInvoiceMissing,
}) => {
  const { t } = useTranslation(['transactions']);
  const transactionAmount = transaction.amount || 0;
  const isExtra = mode === 'extra';

  const selectedIds = useMemo(() => {
    if (selectedInvoiceIds) return selectedInvoiceIds;
    return selectedInvoiceId ? [selectedInvoiceId] : [];
  }, [selectedInvoiceIds, selectedInvoiceId]);

  const handleToggle = useCallback(
    (id: string) => {
      if (toggleSelectInvoice) {
        toggleSelectInvoice(id);
      } else if (setSelectedInvoiceIds) {
        setSelectedInvoiceIds(
          selectedIds.includes(id)
            ? selectedIds.filter(i => i !== id)
            : [...selectedIds, id]
        );
      } else if (setSelectedInvoiceId) {
        setSelectedInvoiceId(selectedIds.includes(id) ? null : id);
      }
    },
    [toggleSelectInvoice, setSelectedInvoiceIds, setSelectedInvoiceId, selectedIds]
  );

  const handleClear = useCallback(() => {
    if (clearSelection) {
      clearSelection();
    } else if (setSelectedInvoiceIds) {
      setSelectedInvoiceIds([]);
    } else if (setSelectedInvoiceId) {
      setSelectedInvoiceId(null);
    }
  }, [clearSelection, setSelectedInvoiceIds, setSelectedInvoiceId]);

  const selectedInvoices = useMemo(() => {
    return candidateInvoices.filter(inv => selectedIds.includes(inv.id));
  }, [candidateInvoices, selectedIds]);

  const selectedCount = selectedIds.length;

  const { totalSelectedGross, txAbs, diff, displayCurrency, isExactMatch } = useMemo(() => {
    const txCurrency = (transaction.currency || 'HUF').toUpperCase();
    const allSameCurrency = selectedInvoices.every(
      inv => (inv.penznem || 'HUF').toUpperCase() === txCurrency
    );

    const sumGross = selectedInvoices.reduce((sum, inv) => {
      const amt = Math.abs(inv.brutto_vegosszeg || 0);
      if (allSameCurrency) return sum + amt;
      return sum + toHuf(amt, inv.penznem);
    }, 0);

    const txAbsolute = Math.abs(transactionAmount);
    const txCompare = allSameCurrency ? txAbsolute : toHuf(txAbsolute, transaction.currency);
    const cur = allSameCurrency ? txCurrency : 'HUF';

    const difference = sumGross - txCompare;
    const absDifference = Math.abs(difference);
    const exact = absDifference < (allSameCurrency ? 0.01 : 1);

    return {
      totalSelectedGross: sumGross,
      txAbs: txAbsolute,
      diff: difference,
      displayCurrency: cur,
      isExactMatch: exact,
    };
  }, [selectedInvoices, transaction.currency, transactionAmount]);

  return (
    <>
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-medium flex items-center gap-1.5">
              {isExtra ? (
                <FileText className="h-3.5 w-3.5 text-primary" />
              ) : (
                <Link2 className="h-3.5 w-3.5 text-primary" />
              )}
              {isExtra
                ? t('transactions:dialogs.details.search.title_extra')
                : transaction.matched_invoice_id
                ? t('transactions:dialogs.details.search.title_change')
                : t('transactions:dialogs.details.search.title_manual')}
            </h4>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {isExtra
                ? t('transactions:dialogs.details.search.desc_extra')
                : t('transactions:dialogs.details.search.desc_sort')}
              {!isExtra && (
                <span className="font-mono font-medium">
                  {formatCurrency(transactionAmount, transaction.currency || 'HUF')}
                </span>
              )}
            </p>
          </div>
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack} className="h-6 text-xs">
              {t('transactions:dialogs.details.search.back')}
            </Button>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder={t('transactions:dialogs.details.search.input_placeholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-8 h-8 text-xs"
            autoFocus
          />
          {isSearchingServer && (
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        {!loading && (
          <div className="flex items-center justify-between text-[10px] text-muted-foreground px-0.5">
            <span>
              {search
                ? t('transactions:dialogs.details.search.results_count', { count: candidateInvoices.length })
                : t('transactions:dialogs.details.search.period_count', { count: candidateInvoices.length })}
            </span>
          </div>
        )}

        <div
          className={cn(
            'overflow-y-auto border rounded-md',
            isExtra ? 'min-h-[200px] max-h-[200px]' : 'min-h-[240px] max-h-[240px]'
          )}
        >
          {loading ? (
            <div className="flex items-center justify-center h-20">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : candidateInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-20 text-muted-foreground">
              {isSearchingServer ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <p className="text-xs mt-2">{t('transactions:dialogs.details.search.searching_server')}</p>
                </>
              ) : (
                <>
                  <FileText className="h-5 w-5 mb-1" />
                  <p className="text-xs">
                    {search
                      ? t('transactions:dialogs.details.search.no_results_search')
                      : t('transactions:dialogs.details.search.no_results_period')}
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="p-1.5 space-y-1">
              {candidateInvoices.map(invoice => {
                const isSelected = selectedIds.includes(invoice.id);
                const invoiceAmt = invoice.brutto_vegosszeg || 0;
                const txCurrency = (transaction.currency || 'HUF').toUpperCase();
                const invCurrency = (invoice.penznem || 'HUF').toUpperCase();
                const isSame = isSameCurrency(txCurrency, invCurrency);

                const txAbsolute = Math.abs(transactionAmount);
                let compareInvAmt: number;
                let compareTxAmt: number;
                let diffCurrency: string;

                if (isSame) {
                  compareInvAmt = Math.abs(invoiceAmt);
                  compareTxAmt = txAbsolute;
                  diffCurrency = invCurrency;
                } else {
                  compareInvAmt = toHuf(Math.abs(invoiceAmt), invoice.penznem);
                  compareTxAmt = toHuf(txAbsolute, transaction.currency);
                  diffCurrency = 'HUF';
                }

                const singleDiff = compareInvAmt - compareTxAmt;
                const absDiff = Math.abs(singleDiff);
                const isExact = absDiff < (isSame ? 0.01 : 1);
                const isNear = !isExact && compareTxAmt > 0 && absDiff < compareTxAmt * 0.05;
                const pctDiff = compareTxAmt > 0 ? (absDiff / compareTxAmt) * 100 : 0;

                const partnerName = invoice.elado_nev?.toLowerCase() || '';
                const txDesc = transaction.description?.toLowerCase() || '';
                const cleanPartnerName = partnerName
                  .replace(/\b(kft|zrt|bt|s\.r\.o\.|ev\.)\b/g, '')
                  .trim();
                const hasPartnerMatch =
                  cleanPartnerName.length > 2 && txDesc.includes(cleanPartnerName);

                const brutto = Math.abs(invoice.brutto_vegosszeg || 0);
                const paid = invoice.already_paid || 0;
                const rem = brutto - paid;

                return (
                  <div
                    key={invoice.id}
                    className={cn(
                      'rounded-md border p-2.5 cursor-pointer transition-all flex items-start gap-2.5',
                      isSelected
                        ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                        : 'hover:bg-muted/40 hover:border-border',
                      isExact && !isSelected && 'border-emerald-500/40 bg-emerald-500/5',
                      isNear && !isSelected && 'border-amber-500/30 bg-amber-500/5'
                    )}
                    onClick={() => handleToggle(invoice.id)}
                  >
                    <div className="pt-0.5" onClick={e => e.stopPropagation()}>
                      <Checkbox
                        id={`select-inv-${invoice.id}`}
                        checked={isSelected}
                        onCheckedChange={() => handleToggle(invoice.id)}
                        aria-label={`Select ${invoice.bizonylatsorszam}`}
                      />
                    </div>

                    <div className="flex-1 min-w-0 flex justify-between items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium font-mono text-xs truncate">
                            {invoice.bizonylatsorszam}
                          </p>
                        </div>
                        <p className="text-muted-foreground text-[10px] mt-0.5 truncate flex items-center gap-1.5">
                          <span className="truncate">{invoice.elado_nev || '-'}</span>
                          {hasPartnerMatch && (
                            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[8px] h-3.5 px-1 font-semibold leading-none shrink-0 hover:bg-emerald-500/10">
                              {t('transactions:dialogs.details.search.badge_partner_match')}
                            </Badge>
                          )}
                        </p>
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                          {invoice.kibocsatas_datuma
                            ? formatDate(invoice.kibocsatas_datuma)
                            : ''}
                        </p>
                        {paid >= brutto && brutto > 0 ? (
                          <Badge className="text-[8px] h-3.5 px-1 mt-0.5 bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/10">
                            {t('transactions:dialogs.details.search.badge_paid')}
                          </Badge>
                        ) : paid > 0 ? (
                          <Badge className="text-[8px] h-3.5 px-1 mt-0.5 bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/10">
                            {t('transactions:dialogs.details.search.badge_partial_paid', {
                              amount: formatCurrency(rem, invoice.penznem || 'HUF'),
                            })}
                          </Badge>
                        ) : (
                          <Badge className="text-[8px] h-3.5 px-1 mt-0.5 bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500/10">
                            {t('transactions:dialogs.details.search.badge_unpaid')}
                          </Badge>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono font-medium text-xs">
                          {formatCurrency(invoice.brutto_vegosszeg || 0, invoice.penznem || 'HUF')}
                        </p>
                        {isExact ? (
                          <Badge variant="success" className="text-[9px] h-4 mt-0.5">
                            {t('transactions:dialogs.details.search.badge_exact')}
                          </Badge>
                        ) : isNear ? (
                          <Badge className="text-[9px] h-4 mt-0.5 bg-amber-500/20 text-amber-600 border-amber-500/30 hover:bg-amber-500/20">
                            {t('transactions:dialogs.details.search.badge_near', {
                              percent: pctDiff.toFixed(0),
                            })}
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/60 mt-0.5 block">
                            {singleDiff > 0 ? '+' : ''}
                            {formatCurrency(singleDiff, diffCurrency)}
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
      </div>

      {selectedCount > 1 && (
        <div className="p-3 rounded-lg border border-primary/25 bg-primary/5 space-y-1.5 text-xs animate-in fade-in-50 duration-200">
          <div className="flex items-center justify-between">
            <span className="font-medium text-foreground flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-primary" />
              {t('transactions:dialogs.details.search.multi_selected_count', { count: selectedCount })}
            </span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-foreground">
                {formatCurrency(totalSelectedGross, displayCurrency)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="h-5 text-[10px] px-1.5 text-muted-foreground hover:text-foreground"
              >
                {t('transactions:dialogs.details.search.clear_selection', 'Kijelölés törlése')}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1.5 border-t border-border/40">
            <span>{t('transactions:dialogs.details.search.tx_amount_label', 'Tranzakció összege')}:</span>
            <span className="font-mono font-medium">{formatCurrency(txAbs, transaction.currency || 'HUF')}</span>
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">
              {diff > 0
                ? t('transactions:dialogs.details.search.fee_difference_label', 'Levont jutalék / díj')
                : t('transactions:dialogs.details.search.difference_label', 'Különbözet')}:
            </span>
            <span
              className={cn(
                'font-mono font-medium',
                isExactMatch ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
              )}
            >
              {isExactMatch ? (
                t('transactions:dialogs.details.search.exact_match_label', '✓ Pontos összeg egyezés')
              ) : (
                `${diff > 0 ? '-' : '+'}${formatCurrency(Math.abs(diff), displayCurrency)}`
              )}
            </span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 pt-3 w-full mt-2 border-t border-border/40 bg-background sticky bottom-0">
        {!isExtra && onMarkNoInvoice && onMarkInvoiceMissing && (
          <div className="flex items-center gap-2 w-full">
            <Button
              variant="outline"
              size="sm"
              disabled={isSaving}
              onClick={onMarkNoInvoice}
              className={cn(
                'text-xs h-10 flex-1 border-purple-500/30 hover:bg-purple-500/10',
                matchStatus === 'no_invoice' && 'bg-purple-500/15 border-purple-500/50'
              )}
            >
              <Ban className="h-3 w-3 mr-1 text-purple-500" />
              {t('transactions:dialogs.details.search.btn_no_invoice')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isSaving}
              onClick={onMarkInvoiceMissing}
              className={cn(
                'text-xs h-10 flex-1 border-sky-500/30 hover:bg-sky-500/10',
                matchStatus === 'invoice_missing' && 'bg-sky-500/15 border-sky-500/50'
              )}
            >
              <UploadCloud className="h-3 w-3 mr-1 text-sky-500" />
              {t('transactions:dialogs.details.search.btn_invoice_missing')}
            </Button>
          </div>
        )}

        <div className="flex justify-end w-full">
          <Button
            size="sm"
            disabled={selectedCount === 0 || isSaving}
            onClick={onMatch}
            className="text-xs h-10 w-full"
          >
            <Check className="h-3 w-3 mr-1" />
            {isSaving
              ? t('transactions:dialogs.details.search.saving')
              : isExtra
              ? selectedCount > 1
                ? t('transactions:dialogs.details.search.btn_add_multi_extra', { count: selectedCount })
                : t('transactions:dialogs.details.search.btn_add_extra')
              : selectedCount > 1
              ? t('transactions:dialogs.details.search.btn_save_multi_match', { count: selectedCount })
              : t('transactions:dialogs.details.search.btn_save_match')}
          </Button>
        </div>
      </div>
    </>
  );
};
