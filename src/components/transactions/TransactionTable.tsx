import React, { useState, useEffect, useCallback } from 'react';
import { TableBody, TableRow, TableCell, TableHead, TableHeader } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn, formatCurrency } from '@/lib/utils';
import { CheckCircle2, AlertCircle, HelpCircle, ArrowUpDown, Eye, Settings, Ban, UploadCloud, ChevronDown, Link2, Link2Off, Copy, Download, FileText, X, Trash2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { computeMatchStatus } from '@/hooks/useComputedStatus';
import { TransactionReasonCell } from '@/components/TransactionReasonCell';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { TableEmptyState } from '@/components/ui/table-empty-state';
import { TablePlaceholderRows } from '@/components/ui/table-placeholder-rows';
import type { Transaction } from '@/hooks/useTransactionData';
import { useExchangeRates } from '@/hooks/useExchangeRates';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';


// ── Row styling helpers (static, outside component) ──

const getRowBackgroundClass = (transaction: Transaction): string => {
  const status = computeMatchStatus(transaction);
  if (status === 'matched') {
    return 'bg-[var(--row-matched-bg)]';
  }
  if (status === 'suggested') {
    return 'bg-[var(--row-suggested-bg)]';
  }
  if (status === 'auto_settled') {
    return 'bg-[var(--row-settled-bg)]';
  }
  if (status === 'no_invoice') {
    return 'bg-[var(--row-noinvoice-bg)]';
  }
  if (status === 'invoice_missing') {
    return 'bg-[var(--row-missing-bg)]';
  }
  return 'bg-[var(--row-unmatched-bg)]';
};

const getTypeBgClass = (type: string | null): string => {
  if (!type) return '';
  const t = type.toLowerCase().trim();

  if (t === 'szállítói tranzakció') return 'bg-[hsl(var(--tr-supplier-bg)/0.6)] text-[hsl(var(--tr-supplier-text))]';
  if (t === 'vevői tranzakció') return 'bg-[hsl(var(--tr-customer-bg)/0.6)] text-[hsl(var(--tr-customer-text))]';
  if (t === 'számlák közötti átvezetés') return 'bg-[hsl(var(--tr-transfer-bg)/0.6)] text-[hsl(var(--tr-transfer-text))]';
  if (t === 'banki számlavezetési díj') return 'bg-[hsl(var(--tr-bankfee-bg)/0.6)] text-[hsl(var(--tr-bankfee-text))]';
  if (t === 'kártyadíj') return 'bg-[hsl(var(--tr-cardfee-bg)/0.6)] text-[hsl(var(--tr-cardfee-text))]';
  if (t === 'hiteltörlesztés' || t === 'tranzakciós illeték' || t === 'kamat') return 'bg-[hsl(var(--tr-loan-bg)/0.6)] text-[hsl(var(--tr-loan-text))]';
  if (t === 'atm pénzfelvét') return 'bg-[hsl(var(--tr-atm-bg)/0.6)] text-[hsl(var(--tr-atm-text))]';
  if (t === 'pénztári kp felvét') return 'bg-[hsl(var(--tr-cashout-bg)/0.6)] text-[hsl(var(--tr-cashout-text))]';
  if (t === 'pénztári kp befizetés' || t === 'kp befizetés atm-en keresztül') return 'bg-[hsl(var(--tr-cashin-bg)/0.6)] text-[hsl(var(--tr-cashin-text))]';
  if (t === 'bérek') return 'bg-[hsl(var(--tr-salary-bg)/0.6)] text-[hsl(var(--tr-salary-text))]';
  if (t === 'járulékok/adók') return 'bg-[hsl(var(--tr-tax-bg)/0.6)] text-[hsl(var(--tr-tax-text))]';
  if (t === 'bankköltség') return 'bg-[hsl(var(--tr-bankcost-bg)/0.6)] text-[hsl(var(--tr-bankcost-text))]';
  if (t === 'kamatjóváírás') return 'bg-[hsl(var(--tr-interest-bg)/0.6)] text-[hsl(var(--tr-interest-text))]';
  if (t === 'atm készpénzfelvét') return 'bg-[hsl(var(--tr-atmcash-bg)/0.6)] text-[hsl(var(--tr-atmcash-text))]';

  return '';
};


// ── Expanded invoice inline (lazy-loaded, reuses ExpandedInvoiceRow) ──

import ExpandedInvoiceRow from '@/components/ExpandedInvoiceRow';

const ExpandedTransactionInvoice = React.memo(function ExpandedTransactionInvoice({
  matchedInvoiceId,
  transaction,
  onOpenDetails,
}: {
  matchedInvoiceId: string | null;
  transaction: Transaction;
  onOpenDetails: (transaction: Transaction) => void;
}) {
  const [matchedSubmitted, setMatchedSubmitted] = useState<any[]>([]);
  const [matchedNav, setMatchedNav] = useState<any[]>([]);
  const [siblingTransactions, setSiblingTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const submittedList: any[] = [];
      const navList: any[] = [];

      // 1. Fetch primary AI match (from matched_invoice_id)
      if (matchedInvoiceId) {
        const { data: submitted } = await supabase
          .from('invoices')
          .select('id, bizonylatsorszam, kibocsatas_datuma, teljesites_datuma, elado_nev, vevo_nev, adoalap_osszesen, brutto_vegosszeg, afa_osszeg_osszesen, penznem, image_url, melleklet_url, invoice_type, reference_number, fizetesi_mod')
          .eq('id', matchedInvoiceId)
          .maybeSingle();

        if (cancelled) return;

        if (submitted) {
          submittedList.push(submitted);
        } else {
          const { data: nav } = await supabase
            .from('nav_invoices')
            .select('id, invoice_number, invoice_issue_date, invoice_delivery_date, supplier_name, customer_name, supplier_tax_number, customer_tax_number, invoice_net_amount, invoice_gross_amount, invoice_vat_amount, currency, transaction_id, submitted')
            .eq('id', matchedInvoiceId)
            .maybeSingle();

          if (cancelled) return;
          if (nav) navList.push(nav);
        }
      }

      // 2. Fetch additional manual matches from join table
      const { data: extraMatchesRaw } = await supabase
        .from('transaction_invoice_matches' as any)
        .select('invoice_id, invoice_source')
        .eq('transaction_id', transaction.id);
      const extraMatches = extraMatchesRaw as Array<{ invoice_id: string; invoice_source: string }> | null;

      if (cancelled) return;

      if (extraMatches && extraMatches.length > 0) {
        // Separate by source, exclude already-fetched primary
        const extraSubmittedIds = extraMatches
          .filter(m => m.invoice_source === 'submitted' && m.invoice_id !== matchedInvoiceId)
          .map(m => m.invoice_id);
        const extraNavIds = extraMatches
          .filter(m => m.invoice_source === 'nav' && m.invoice_id !== matchedInvoiceId)
          .map(m => m.invoice_id);


        if (extraSubmittedIds.length > 0) {
          const { data } = await supabase
            .from('invoices')
            .select('id, bizonylatsorszam, kibocsatas_datuma, teljesites_datuma, elado_nev, vevo_nev, adoalap_osszesen, brutto_vegosszeg, afa_osszeg_osszesen, penznem, image_url, melleklet_url, invoice_type, reference_number, fizetesi_mod')
            .in('id', extraSubmittedIds);
          if (!cancelled && data) submittedList.push(...data);
        }

        if (extraNavIds.length > 0) {
          const { data } = await supabase
            .from('nav_invoices')
            .select('id, invoice_number, invoice_issue_date, invoice_delivery_date, supplier_name, customer_name, supplier_tax_number, customer_tax_number, invoice_net_amount, invoice_gross_amount, invoice_vat_amount, currency, transaction_id, submitted')
            .in('id', extraNavIds);
          if (!cancelled && data) navList.push(...data);
        }
      }

      // 3. Fetch sibling transactions matched to the same invoice(s)
      const allInvoiceIds = [
        ...submittedList.map(s => s.id),
        ...navList.map(n => n.id),
      ];

      if (allInvoiceIds.length > 0) {
        const { data: siblingTx } = await supabase
          .from('transactions')
          .select('id, transaction_date, amount, description, currency, type, confidence_score, match_type, is_verified')
          .in('matched_invoice_id', allInvoiceIds);

        if (!cancelled && siblingTx) {
          setSiblingTransactions(siblingTx);
        }
      }

      if (!cancelled) {
        setMatchedSubmitted(submittedList);
        setMatchedNav(navList);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [matchedInvoiceId, transaction.id]);

  if (loading) {
    return (
      <TableRow>
        <TableCell colSpan={8} className="bg-muted/20 py-3">
          <div className="flex items-center justify-center py-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="ml-2 text-xs text-muted-foreground">Számla betöltése...</span>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  if (matchedSubmitted.length === 0 && matchedNav.length === 0) {
    return (
      <>
        {/* Top spacer row */}
        <TableRow className="bg-transparent hover:bg-transparent border-none">
          <TableCell colSpan={8} className="p-0 h-1 border-none" />
        </TableRow>
        <TableRow className="bg-muted/40 dark:bg-card hover:bg-muted/40 dark:hover:bg-card border-t border-b border-border/30">
          <TableCell colSpan={8} className="p-0">
            <div className="py-6 px-8 space-y-4 max-w-3xl ml-4">
              {/* Header */}
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <Link2Off className="h-3.5 w-3.5" />
                Kapcsolódó tételek
              </div>
              <Card className="bg-muted/30 border-border/50">
                <CardContent className="p-4 flex flex-col items-center justify-center gap-3">
                  <p className="text-sm text-muted-foreground italic">Nincs párosított tétel ehhez a tranzakcióhoz.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); onOpenDetails(transaction); }}
                    className="h-8 text-xs gap-1.5"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    Számla hozzárendelése
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TableCell>
        </TableRow>
      </>
    );
  }

  return (
    <ExpandedInvoiceRow
      colSpan={8}
      matchedSubmittedInvoices={matchedSubmitted}
      matchedNavInvoices={matchedNav}
      matchedTransactions={siblingTransactions}
      linkedInvoices={[]}
      hideStandaloneTransactions
    />
  );
});

// ── Individual Row ──

interface TransactionRowProps {
  transaction: Transaction;
  exchangeRates?: Record<string, number>;
  isExpanded?: boolean;
  onToggleExpand?: (id: string) => void;
  onOpenDetails: (transaction: Transaction) => void;
  bankLabel?: string | null;
  bankBgClass?: string;
  isDuplicate?: boolean;
  isSelected?: boolean;
  onSelect?: (id: string, shiftKey: boolean) => void;
  showCheckbox?: boolean;
}

const TransactionRow = React.memo(function TransactionRow({ transaction, exchangeRates, isExpanded, onToggleExpand, onOpenDetails, bankLabel, bankBgClass, isDuplicate, isSelected, onSelect, showCheckbox }: TransactionRowProps) {
  const matchStatus = computeMatchStatus(transaction);

  return (
    <>
    <TableRow
      data-row-hover
      className={cn(
        "h-10 cursor-pointer",
        getRowBackgroundClass(transaction),
        isExpanded && "border-b-0",
        isSelected && "ring-1 ring-primary/40 ring-inset"
      )}
      onClick={() => onToggleExpand?.(transaction.id)}
    >
      {/* F1: Checkbox cell */}
      {showCheckbox && (
        <TableCell className="w-8 px-2">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => {}}
            onClick={(e) => {
              e.stopPropagation();
              onSelect?.(transaction.id, (e as any).shiftKey || false);
            }}
            className="translate-y-[1px]"
          />
        </TableCell>
      )}
      <TableCell className="font-medium text-xs whitespace-nowrap">
        <div className="flex items-center gap-2">
            <ChevronDown className={cn(
              "h-3 w-3 text-muted-foreground shrink-0 transition-transform duration-200",
              isExpanded && "rotate-180"
            )} />
          {transaction.transaction_date
            ? format(new Date(transaction.transaction_date), 'yyyy.MM.dd')
            : '-'}
          {/* F2: Duplicate warning icon */}
          {isDuplicate && (
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Copy className="h-3 w-3 text-amber-500 shrink-0" />
                </TooltipTrigger>
                <TooltipContent>Lehetséges duplikátum — azonos dátum és összeg</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </TableCell>
      <TableCell className="overflow-hidden">
        <div className="flex items-center gap-1.5">
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="block truncate text-xs cursor-default flex-1 min-w-0">
                  {transaction.description || '-'}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[500px]">
                <p className="whitespace-pre-wrap text-sm">{transaction.description}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {bankLabel && (
            <span className={cn(
              "text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0 border",
              bankBgClass || 'bg-muted text-muted-foreground'
            )}>
              {bankLabel}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className={cn(
        "text-right font-mono text-xs whitespace-nowrap [text-shadow:_0_0_3px_rgba(255,255,255,0.8)] dark:[text-shadow:_0_0_3px_rgba(0,0,0,0.6)]",
        transaction.amount >= 0 ? "text-success" : "text-destructive"
      )}>
        <div className="flex flex-col items-end">
          <span className="font-medium">{formatCurrency(transaction.amount, transaction.currency || 'HUF')}</span>
          {transaction.currency && transaction.currency !== 'HUF' && exchangeRates && (
            <span className="text-[10px] text-muted-foreground font-normal leading-tight">
              ({formatCurrency(transaction.amount * (exchangeRates[transaction.currency] || 1), 'HUF')})
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-xs whitespace-nowrap">
        <span className={cn(
          "inline-block w-[3rem] text-center font-semibold px-1.5 py-0.5 rounded text-[10px] border border-black/10 dark:border-white/10 text-foreground",
          transaction.currency && transaction.currency !== 'HUF'
            ? "bg-amber-500/20 dark:bg-yellow-500/10"
            : "bg-muted/60"
        )}>
          {transaction.currency || 'HUF'}
        </span>
      </TableCell>
      <TableCell className="overflow-hidden">
        {transaction.type ? (
          <span className={cn(
            "text-[11px] font-semibold px-1.5 py-0.5 rounded-md inline-block w-[10.5rem] text-center whitespace-nowrap overflow-hidden text-ellipsis border border-black/10 dark:border-white/10",
            getTypeBgClass(transaction.type) || "text-muted-foreground"
          )}>
            {transaction.type}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell className="text-center whitespace-nowrap">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger>
              <div className="flex items-center justify-center">
                {matchStatus === 'matched' && (
                  <span className="inline-flex items-center gap-1 w-[5.5rem] justify-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-600/15 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400 border border-black/10 dark:border-white/10">
                    <CheckCircle2 className="h-3 w-3" />Párosított
                  </span>
                )}
                {matchStatus === 'suggested' && (
                  <span className="inline-flex items-center gap-1 w-[5.5rem] justify-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/15 text-amber-800 dark:bg-yellow-500/15 dark:text-yellow-400 border border-black/10 dark:border-white/10">
                    <AlertCircle className="h-3 w-3" />Javasolt
                  </span>
                )}
                {matchStatus === 'auto_settled' && (
                  <span className="inline-flex items-center gap-1 w-[5.5rem] justify-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-blue-500/15 text-blue-800 dark:bg-blue-500/15 dark:text-blue-400 border border-black/10 dark:border-white/10">
                    <Settings className="h-3 w-3" />Rendezett
                  </span>
                )}
                {matchStatus === 'unmatched' && (
                  <span className="inline-flex items-center gap-1 w-[5.5rem] justify-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-rose-500/15 text-rose-800 dark:bg-rose-500/15 dark:text-rose-400 border border-black/10 dark:border-white/10">
                    <HelpCircle className="h-3 w-3" />Nincs
                  </span>
                )}
                {matchStatus === 'no_invoice' && (
                  <span className="inline-flex items-center gap-1 w-[5.5rem] justify-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-purple-500/15 text-purple-800 dark:bg-purple-500/15 dark:text-purple-400 border border-black/10 dark:border-white/10">
                    <Ban className="h-3 w-3" />Nincs számla
                  </span>
                )}
                {matchStatus === 'invoice_missing' && (
                  <span className="inline-flex items-center gap-1 w-[5.5rem] justify-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-sky-500/15 text-sky-800 dark:bg-sky-500/15 dark:text-sky-400 border border-black/10 dark:border-white/10">
                    <UploadCloud className="h-3 w-3" />Feltöltendő
                  </span>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {matchStatus === 'matched' && 'Párosított és jóváhagyott'}
              {matchStatus === 'suggested' && `Javasolt párosítás ${transaction.confidence_score ? `(${Math.round(transaction.confidence_score * 100)}%)` : ''}`}
              {matchStatus === 'auto_settled' && 'Rendezett — nem igényel számlát (bankköltség, ATM, stb.)'}
              {matchStatus === 'unmatched' && 'Nincs párosítva'}
              {matchStatus === 'no_invoice' && 'Nincs hozzá számla — könyvelő feladata'}
              {matchStatus === 'invoice_missing' && 'Számla nincs feltöltve — fel kell tölteni'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TableCell>
      <TableCell className="overflow-hidden">
        <TransactionReasonCell reason={transaction.reason} />
      </TableCell>
      <TableCell className="text-center">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => { e.stopPropagation(); onOpenDetails(transaction); }}
              >
                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Tranzakció és számla részletei</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TableCell>
    </TableRow>
    {isExpanded && (
      <ExpandedTransactionInvoice
        matchedInvoiceId={transaction.matched_invoice_id}
        transaction={transaction}
        onOpenDetails={onOpenDetails}
      />
    )}
    </>
  );
});

// ── Table ──

interface TransactionTableProps {
  transactions: Transaction[];
  loading: boolean;
  pageSize: number;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onSort: (field: string) => void;
  onOpenDetails: (transaction: Transaction) => void;
  uploadBankMap?: Record<string, string>;
  bankConfig?: Record<string, { label: string; bgClass: string }>;
  duplicateTxIds?: Set<string>;
  onBulkStatusChange?: (ids: string[], matchType: string) => void;
  onBulkExport?: (ids: string[], format: 'csv' | 'xlsx') => void;
  onBulkDelete?: (ids: string[]) => void;
}

const TransactionTable = React.memo(function TransactionTable({
  transactions,
  loading,
  pageSize,
  hasActiveFilters,
  onClearFilters,
  onSort,
  onOpenDetails,
  uploadBankMap,
  bankConfig,
  duplicateTxIds,
  onBulkStatusChange,
  onBulkExport,
  onBulkDelete,
}: TransactionTableProps) {
  const { data: exchangeRates } = useExchangeRates();
  const [expandedTxIds, setExpandedTxIds] = useState<Set<string>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');

  // F1: Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedIdx, setLastSelectedIdx] = useState<number | null>(null);

  const showBulkMode = duplicateTxIds !== undefined || onBulkStatusChange !== undefined || onBulkExport !== undefined;

  // Clear selection when transactions change (page change, filter change)
  useEffect(() => {
    setSelectedIds(new Set());
    setLastSelectedIdx(null);
  }, [transactions]);

  const handleSelect = useCallback((id: string, shiftKey: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const currentIdx = transactions.findIndex(t => t.id === id);

      if (shiftKey && lastSelectedIdx !== null && currentIdx !== -1) {
        // Shift+click: range selection
        const start = Math.min(lastSelectedIdx, currentIdx);
        const end = Math.max(lastSelectedIdx, currentIdx);
        for (let i = start; i <= end; i++) {
          next.add(transactions[i].id);
        }
      } else {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      }

      setLastSelectedIdx(currentIdx);
      return next;
    });
  }, [transactions, lastSelectedIdx]);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      if (prev.size === transactions.length) return new Set();
      return new Set(transactions.map(t => t.id));
    });
  }, [transactions]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setLastSelectedIdx(null);
  }, []);

  const toggleExpand = React.useCallback((id: string) => {
    setExpandedTxIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const colCount = showBulkMode ? 9 : 8;

  return (
    <div className="space-y-0 relative">
      {/* F1: Floating bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="sticky top-0 z-20 bg-primary text-primary-foreground rounded-xl px-4 py-2.5 mb-3 flex items-center justify-between gap-3 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedIds.size === transactions.length}
              onCheckedChange={handleSelectAll}
              className="border-primary-foreground/50 data-[state=checked]:bg-primary-foreground data-[state=checked]:text-primary"
            />
            <span className="text-sm font-medium">{selectedIds.size} tranzakció kijelölve</span>
          </div>
          <div className="flex items-center gap-2">
            {onBulkExport && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => onBulkExport(Array.from(selectedIds), 'csv')}
                >
                  <Download className="w-3 h-3" /> CSV
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => onBulkExport(Array.from(selectedIds), 'xlsx')}
                >
                  <FileText className="w-3 h-3" /> XLSX
                </Button>
              </>
            )}
            {onBulkStatusChange && (
              <>
                <div className="w-px h-5 bg-primary-foreground/20" />
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => onBulkStatusChange(Array.from(selectedIds), 'no_match_category')}
                >
                  <Settings className="w-3 h-3" /> Rendezettnek jelölés
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => onBulkStatusChange(Array.from(selectedIds), 'no_invoice')}
                >
                  <Ban className="w-3 h-3" /> Nincs számla
                </Button>
              </>
            )}
            {onBulkDelete && (
              <>
                <div className="w-px h-5 bg-primary-foreground/20" />
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 text-xs gap-1.5 bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => { setDeleteConfirmInput(''); setDeleteConfirmOpen(true); }}
                >
                  <Trash2 className="w-3 h-3" /> Törlés
                </Button>
              </>
            )}
            <div className="w-px h-5 bg-primary-foreground/20" />
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
              onClick={clearSelection}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Tranzakciók végleges törlése
            </DialogTitle>
            <DialogDescription>
              <strong className="text-destructive">{selectedIds.size}</strong> tranzakció véglegesen törlődik. Ez a művelet nem vonható vissza.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3">
            <label className="text-sm font-medium text-foreground">
              A megerősítéshez írd be a kijelölt tranzakciók számát: <strong>{selectedIds.size}</strong>
            </label>
            <Input
              className="mt-2"
              placeholder={`${selectedIds.size}`}
              value={deleteConfirmInput}
              onChange={e => setDeleteConfirmInput(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Mégse</Button>
            <Button
              variant="destructive"
              disabled={deleteConfirmInput !== String(selectedIds.size)}
              onClick={() => {
                onBulkDelete!(Array.from(selectedIds));
                setDeleteConfirmOpen(false);
                clearSelection();
              }}
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              Törlés ({selectedIds.size} db)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="rounded-xl border border-border/50 overflow-x-auto">
        <table className="w-full caption-bottom text-sm compact-table min-w-[1000px]" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            {showBulkMode && <col style={{ width: '3%' }} />}
            <col style={{ width: showBulkMode ? '8%' : '8%' }} />
            <col style={{ width: showBulkMode ? '29%' : '32%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '5%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: showBulkMode ? '14%' : '14%' }} />
            <col style={{ width: '7%' }} />
          </colgroup>
          <TableHeader>
            <TableRow className="bg-muted hover:bg-muted">
              {/* F1: Select all checkbox */}
              {showBulkMode && (
                <TableHead className="w-8 px-2">
                  <Checkbox
                    checked={transactions.length > 0 && selectedIds.size === transactions.length}
                    onCheckedChange={handleSelectAll}
                    aria-label="Összes kijelölése"
                    className="translate-y-[1px]"
                  />
                </TableHead>
              )}
              <TableHead
                className="cursor-pointer hover:bg-muted/50 font-semibold"
                onClick={() => onSort('transaction_date')}
              >
                <div className="flex items-center gap-1">
                  Dátum
                  <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                </div>
              </TableHead>
              <TableHead className="font-semibold">Leírás</TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 text-right font-semibold"
                onClick={() => onSort('amount')}
              >
                <div className="flex items-center justify-end gap-1">
                  Összeg
                  <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                </div>
              </TableHead>
              <TableHead className="font-semibold">Pénznem</TableHead>
              <TableHead className="font-semibold">Típus</TableHead>
              <TableHead className="font-semibold text-center">Státusz</TableHead>
              <TableHead className="font-semibold">Indoklás</TableHead>
              <TableHead className="font-semibold text-center">Tételek</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeleton rows={10} columns={colCount} />
            ) : transactions.length === 0 ? (
              <TableEmptyState
                colSpan={colCount}
                title="Nincs tranzakció"
                description="Tölts fel bankkivonatot a Feltöltés oldalon, vagy módosítsd a szűrőket."
                onClearFilters={hasActiveFilters ? onClearFilters : undefined}
              />
            ) : (
              transactions.map((transaction) => {
                const bankKey = uploadBankMap && transaction.upload_id ? uploadBankMap[transaction.upload_id] : undefined;
                const cfg = bankKey && bankConfig ? bankConfig[bankKey] : undefined;
                return (
                  <TransactionRow
                    key={transaction.id}
                    transaction={transaction}
                    exchangeRates={exchangeRates}
                    isExpanded={expandedTxIds.has(transaction.id)}
                    onToggleExpand={toggleExpand}
                    onOpenDetails={onOpenDetails}
                    bankLabel={cfg?.label}
                    bankBgClass={cfg?.bgClass}
                    isDuplicate={duplicateTxIds?.has(transaction.id)}
                    isSelected={selectedIds.has(transaction.id)}
                    onSelect={handleSelect}
                    showCheckbox={showBulkMode}
                  />
                );
              })
            )}
            <TablePlaceholderRows currentCount={transactions.length} pageSize={pageSize} columns={colCount} />
          </TableBody>
        </table>
      </div>
    </div>
  );
});

export { TransactionRow };
export default TransactionTable;
