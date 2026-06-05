import React, { useState, useEffect } from 'react';
import { TableBody, TableRow, TableCell, TableHead, TableHeader } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn, formatCurrency } from '@/lib/utils';
import { CheckCircle2, AlertCircle, HelpCircle, ArrowUpDown, Eye, Sparkles, Settings, Ban, UploadCloud, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { computeMatchStatus } from '@/hooks/useComputedStatus';
import { TransactionReasonCell } from '@/components/TransactionReasonCell';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { TableEmptyState } from '@/components/ui/table-empty-state';
import { TablePlaceholderRows } from '@/components/ui/table-placeholder-rows';
import type { Transaction } from '@/hooks/useTransactionData';
import { useExchangeRates } from '@/hooks/useExchangeRates';
import { supabase } from '@/integrations/supabase/client';


// ── Row styling helpers (static, outside component) ──

const getRowBackgroundClass = (transaction: Transaction): string => {
  const status = computeMatchStatus(transaction);
  if (status === 'matched') {
    return 'bg-emerald-100/70 dark:bg-emerald-950/40 border-l-2 border-l-emerald-500/60 border-b border-border/40';
  }
  if (status === 'suggested') {
    return 'bg-yellow-100/70 dark:bg-yellow-950/40 border-l-2 border-l-yellow-500/70 border-b border-border/40';
  }
  if (status === 'auto_settled') {
    return 'bg-blue-100/50 dark:bg-blue-950/30 border-l-2 border-l-blue-500/50 border-b border-border/40';
  }
  if (status === 'no_invoice') {
    return 'bg-purple-100/60 dark:bg-purple-950/40 border-l-2 border-l-purple-500/60 border-b border-border/40';
  }
  if (status === 'invoice_missing') {
    return 'bg-sky-100/60 dark:bg-sky-950/40 border-l-2 border-l-sky-500/60 border-b border-border/40';
  }
  return 'bg-rose-100/60 dark:bg-rose-950/30 border-l-2 border-l-rose-400/50 border-b border-border/40';
};

const getTypeBgClass = (type: string | null): string => {
  if (!type) return '';
  const t = type.toLowerCase().trim();

  if (t === 'szállítói tranzakció') return 'bg-[hsl(var(--tr-supplier-bg))] text-[hsl(var(--tr-supplier-text))]';
  if (t === 'vevői tranzakció') return 'bg-[hsl(var(--tr-customer-bg))] text-[hsl(var(--tr-customer-text))]';
  if (t === 'számlák közötti átvezetés') return 'bg-[hsl(var(--tr-transfer-bg))] text-[hsl(var(--tr-transfer-text))]';
  if (t === 'banki számlavezetési díj') return 'bg-[hsl(var(--tr-bankfee-bg))] text-[hsl(var(--tr-bankfee-text))]';
  if (t === 'kártyadíj') return 'bg-[hsl(var(--tr-cardfee-bg))] text-[hsl(var(--tr-cardfee-text))]';
  if (t === 'hiteltörlesztés' || t === 'tranzakciós illeték' || t === 'kamat') return 'bg-[hsl(var(--tr-loan-bg))] text-[hsl(var(--tr-loan-text))]';
  if (t === 'atm pénzfelvét') return 'bg-[hsl(var(--tr-atm-bg))] text-[hsl(var(--tr-atm-text))]';
  if (t === 'pénztári kp felvét') return 'bg-[hsl(var(--tr-cashout-bg))] text-[hsl(var(--tr-cashout-text))]';
  if (t === 'pénztári kp befizetés' || t === 'kp befizetés atm-en keresztül') return 'bg-[hsl(var(--tr-cashin-bg))] text-[hsl(var(--tr-cashin-text))]';
  if (t === 'bérek') return 'bg-[hsl(var(--tr-salary-bg))] text-[hsl(var(--tr-salary-text))]';
  if (t === 'járulékok/adók') return 'bg-[hsl(var(--tr-tax-bg))] text-[hsl(var(--tr-tax-text))]';
  if (t === 'bankköltség') return 'bg-[hsl(var(--tr-bankcost-bg))] text-[hsl(var(--tr-bankcost-text))]';
  if (t === 'kamatjóváírás') return 'bg-[hsl(var(--tr-interest-bg))] text-[hsl(var(--tr-interest-text))]';
  if (t === 'atm készpénzfelvét') return 'bg-[hsl(var(--tr-atmcash-bg))] text-[hsl(var(--tr-atmcash-text))]';

  return '';
};

// ── Expanded invoice inline (lazy-loaded, reuses ExpandedInvoiceRow) ──

import ExpandedInvoiceRow from '@/components/ExpandedInvoiceRow';

const ExpandedTransactionInvoice = React.memo(function ExpandedTransactionInvoice({
  matchedInvoiceId,
  transaction,
}: {
  matchedInvoiceId: string;
  transaction: Transaction;
}) {
  const [matchedSubmitted, setMatchedSubmitted] = useState<any[]>([]);
  const [matchedNav, setMatchedNav] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Try submitted invoices first
      const { data: submitted } = await supabase
        .from('invoices')
        .select('id, bizonylatsorszam, kibocsatas_datuma, teljesites_datuma, elado_nev, vevo_nev, adoalap_osszesen, brutto_vegosszeg, afa_osszeg_osszesen, penznem, image_url, melleklet_url, invoice_type, reference_number, fizetesi_mod')
        .eq('id', matchedInvoiceId)
        .maybeSingle();

      if (cancelled) return;

      if (submitted) {
        setMatchedSubmitted([submitted]);
        setLoading(false);
        return;
      }

      // Try NAV invoices
      const { data: nav } = await supabase
        .from('nav_invoices')
        .select('id, invoice_number, invoice_issue_date, invoice_delivery_date, supplier_name, customer_name, supplier_tax_number, customer_tax_number, invoice_net_amount, invoice_gross_amount, invoice_vat_amount, currency, transaction_id, submitted')
        .eq('id', matchedInvoiceId)
        .maybeSingle();

      if (cancelled) return;

      if (nav) {
        setMatchedNav([nav]);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [matchedInvoiceId]);

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
      <TableRow>
        <TableCell colSpan={8} className="bg-muted/20 py-3">
          <div className="text-xs text-muted-foreground text-center py-2">
            Nem található párosított számla
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <ExpandedInvoiceRow
      colSpan={8}
      matchedSubmittedInvoices={matchedSubmitted}
      matchedNavInvoices={matchedNav}
      matchedTransactions={[]}
      linkedInvoices={[]}
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
}

const TransactionRow = React.memo(function TransactionRow({ transaction, exchangeRates, isExpanded, onToggleExpand, onOpenDetails }: TransactionRowProps) {
  const matchStatus = computeMatchStatus(transaction);
  const hasMatch = !!transaction.matched_invoice_id;

  return (
    <>
    <TableRow
      className={cn(
        "h-10",
        getRowBackgroundClass(transaction),
        hasMatch && "cursor-pointer",
        isExpanded && "border-b-0"
      )}
      onClick={() => hasMatch && onToggleExpand?.(transaction.id)}
    >
      <TableCell className="font-medium text-xs whitespace-nowrap">
        <div className="flex items-center gap-1">
          {hasMatch && (
            <ChevronDown className={cn(
              "h-3 w-3 text-muted-foreground shrink-0 transition-transform duration-200",
              isExpanded && "rotate-180"
            )} />
          )}
          {transaction.transaction_date
            ? format(new Date(transaction.transaction_date), 'yyyy.MM.dd')
            : '-'}
        </div>
      </TableCell>
      <TableCell className="overflow-hidden">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="block truncate text-xs cursor-default">
                {transaction.description || '-'}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[500px]">
              <p className="whitespace-pre-wrap text-sm">{transaction.description}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TableCell>
      <TableCell className={cn(
        "text-right font-mono text-xs whitespace-nowrap",
        transaction.amount >= 0 ? "text-success" : "text-destructive"
      )}>
        <div className="flex flex-col items-end">
          <span>{formatCurrency(transaction.amount, transaction.currency || 'HUF')}</span>
          {transaction.currency && transaction.currency !== 'HUF' && exchangeRates && (
            <span className="text-[10px] text-muted-foreground font-normal leading-tight">
              ({formatCurrency(transaction.amount * (exchangeRates[transaction.currency] || 1), 'HUF')})
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-xs whitespace-nowrap">
        {transaction.currency && transaction.currency !== 'HUF' ? (
          <span className="font-semibold text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded text-[10px]">
            {transaction.currency}
          </span>
        ) : (
          <span className="text-muted-foreground">{transaction.currency || 'HUF'}</span>
        )}
      </TableCell>
      <TableCell className="overflow-hidden">
        {transaction.type ? (
          <span className={cn(
            "text-[11px] px-1.5 py-0.5 rounded-md inline-block truncate max-w-full text-center",
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
              <div className="flex items-center justify-center gap-1">
                {matchStatus === 'matched' && <><CheckCircle2 className="h-3.5 w-3.5 text-success" /><span className="text-[10px] font-medium text-emerald-600">Párosított</span></>}
                {matchStatus === 'suggested' && <><AlertCircle className="h-3.5 w-3.5 text-yellow-500" /><span className="text-[10px] font-medium text-yellow-600">Javasolt</span></>}
                {matchStatus === 'auto_settled' && <><Settings className="h-3.5 w-3.5 text-blue-500" /><span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">Rendezett</span></>}
                {matchStatus === 'unmatched' && <><HelpCircle className="h-3.5 w-3.5 text-destructive" /><span className="text-[10px] font-medium text-rose-500">Nincs</span></>}
                {matchStatus === 'no_invoice' && <><Ban className="h-3.5 w-3.5 text-purple-500" /><span className="text-[10px] font-medium text-purple-600 dark:text-purple-400">Nincs számla</span></>}
                {matchStatus === 'invoice_missing' && <><UploadCloud className="h-3.5 w-3.5 text-sky-500" /><span className="text-[10px] font-medium text-sky-600 dark:text-sky-400">Feltöltendő</span></>}
                {transaction.match_type === 'auto' && <Sparkles className="h-3 w-3 text-success" />}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {matchStatus === 'matched' && transaction.match_type === 'auto' && 'Automatikusan jóváhagyva (≥97%)'}
              {matchStatus === 'matched' && transaction.match_type !== 'auto' && 'Párosított és jóváhagyott'}
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
    {isExpanded && transaction.matched_invoice_id && (
      <ExpandedTransactionInvoice
        matchedInvoiceId={transaction.matched_invoice_id}
        transaction={transaction}
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
}

const TransactionTable = React.memo(function TransactionTable({
  transactions,
  loading,
  pageSize,
  hasActiveFilters,
  onClearFilters,
  onSort,
  onOpenDetails,
}: TransactionTableProps) {
  const { data: exchangeRates } = useExchangeRates();
  const [expandedTxIds, setExpandedTxIds] = useState<Set<string>>(new Set());

  const toggleExpand = React.useCallback((id: string) => {
    setExpandedTxIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <div className="rounded-xl border border-border/50 overflow-hidden">
      <table className="w-full caption-bottom text-sm compact-table" style={{ tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '8%' }} />
          <col style={{ width: '32%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '5%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '7%' }} />
        </colgroup>
        <TableHeader>
          <TableRow className="bg-muted hover:bg-muted">
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
            <TableSkeleton rows={10} columns={8} />
          ) : transactions.length === 0 ? (
            <TableEmptyState
              colSpan={8}
              title="Nincs tranzakció"
              description="Tölts fel bankkivonatot a Feltöltés oldalon, vagy módosítsd a szűrőket."
              onClearFilters={hasActiveFilters ? onClearFilters : undefined}
            />
          ) : (
            transactions.map((transaction) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                exchangeRates={exchangeRates}
                isExpanded={expandedTxIds.has(transaction.id)}
                onToggleExpand={toggleExpand}
                onOpenDetails={onOpenDetails}
              />
            ))
          )}
          <TablePlaceholderRows currentCount={transactions.length} pageSize={pageSize} columns={8} />
        </TableBody>
      </table>
    </div>
  );
});

export { TransactionRow };
export default TransactionTable;
