import React from 'react';
import { TableBody, TableRow, TableCell, TableHead, TableHeader } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn, formatCurrency } from '@/lib/utils';
import { CheckCircle2, AlertCircle, HelpCircle, ArrowUpDown, Eye, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { computeMatchStatus } from '@/hooks/useComputedStatus';
import { TransactionReasonCell } from '@/components/TransactionReasonCell';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { TableEmptyState } from '@/components/ui/table-empty-state';
import { TablePlaceholderRows } from '@/components/ui/table-placeholder-rows';
import type { Transaction } from '@/hooks/useTransactionData';

// ── Row styling helpers (static, outside component) ──

const getRowBackgroundClass = (transaction: Transaction): string => {
  const status = computeMatchStatus(transaction);
  if (status === 'matched') {
    return 'bg-emerald-100/70 dark:bg-emerald-950/40 border-l-2 border-l-emerald-500/60 border-b border-border/40';
  }
  if (status === 'suggested') {
    return 'bg-amber-100/60 dark:bg-amber-950/40 border-l-2 border-l-amber-500/60 border-b border-border/40';
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

// ── Individual Row ──

interface TransactionRowProps {
  transaction: Transaction;
  onOpenDetails: (transaction: Transaction) => void;
}

const TransactionRow = React.memo(function TransactionRow({ transaction, onOpenDetails }: TransactionRowProps) {
  const matchStatus = computeMatchStatus(transaction);

  return (
    <TableRow className={cn("h-10", getRowBackgroundClass(transaction))}>
      <TableCell className="font-medium text-xs">
        {transaction.transaction_date
          ? format(new Date(transaction.transaction_date), 'yyyy.MM.dd')
          : '-'}
      </TableCell>
      <TableCell className="max-w-[200px] text-xs">
        {transaction.description ? (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="block truncate cursor-default">{transaction.description}</span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[400px]">
                <p className="whitespace-pre-wrap text-sm">{transaction.description}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : '-'}
      </TableCell>
      <TableCell className={cn(
        "text-right font-mono text-xs",
        transaction.amount >= 0 ? "text-success" : "text-destructive"
      )}>
        {formatCurrency(transaction.amount, transaction.currency || 'HUF')}
      </TableCell>
      <TableCell className="text-xs">{transaction.currency || 'HUF'}</TableCell>
      <TableCell>
        {transaction.type ? (
          <span className={cn(
            "text-xs px-2.5 py-0.5 rounded-md inline-flex items-center justify-center text-center min-w-[170px] min-h-[24px] whitespace-nowrap",
            getTypeBgClass(transaction.type) || "text-muted-foreground"
          )}>
            {transaction.type}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell className="text-center">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger>
              <div className="flex items-center justify-center gap-1">
                {matchStatus === 'matched' && <><CheckCircle2 className="h-3.5 w-3.5 text-success" /><span className="text-[10px] font-medium text-emerald-600">Párosított</span></>}
                {matchStatus === 'suggested' && <><AlertCircle className="h-3.5 w-3.5 text-warning" /><span className="text-[10px] font-medium text-amber-600">Javasolt</span></>}
                {matchStatus === 'unmatched' && <><HelpCircle className="h-3.5 w-3.5 text-destructive" /><span className="text-[10px] font-medium text-rose-500">Nincs</span></>}
                {transaction.match_type === 'auto' && <Sparkles className="h-3 w-3 text-success" />}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {matchStatus === 'matched' && transaction.match_type === 'auto' && 'Automatikusan jóváhagyva (≥97%)'}
              {matchStatus === 'matched' && transaction.match_type !== 'auto' && 'Párosított és jóváhagyott'}
              {matchStatus === 'suggested' && `Javasolt párosítás ${transaction.confidence_score ? `(${Math.round(transaction.confidence_score * 100)}%)` : ''}`}
              {matchStatus === 'unmatched' && 'Nincs párosítva'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TableCell>
      <TableCell>
        <TransactionReasonCell reason={transaction.reason} />
      </TableCell>
      <TableCell className="text-center">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => onOpenDetails(transaction)}
              >
                <Eye className="h-3 w-3 mr-1" />
                Számlák
              </Button>
            </TooltipTrigger>
            <TooltipContent>Tranzakció és számla részletei</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TableCell>
    </TableRow>
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
  return (
    <div className="rounded-lg border border-border/50 overflow-auto max-h-[calc(100vh-320px)]">
      <table className="w-full caption-bottom text-sm table-fixed compact-table">
        <TableHeader className="sticky top-0 z-10">
          <TableRow className="bg-muted hover:bg-muted">
            <TableHead
              className="cursor-pointer hover:bg-muted/50 font-semibold w-[10%]"
              onClick={() => onSort('transaction_date')}
            >
              <div className="flex items-center gap-2">
                Dátum
                <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </TableHead>
            <TableHead className="font-semibold w-[30%]">Leírás</TableHead>
            <TableHead
              className="cursor-pointer hover:bg-muted/50 text-right font-semibold w-[12%]"
              onClick={() => onSort('amount')}
            >
              <div className="flex items-center justify-end gap-2">
                Összeg
                <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </TableHead>
            <TableHead className="font-semibold w-[7%]">Pénznem</TableHead>
            <TableHead className="font-semibold w-[14%]">Típus</TableHead>
            <TableHead className="font-semibold w-[8%] text-center">Státusz</TableHead>
            <TableHead className="font-semibold w-[9%]">Indoklás</TableHead>
            <TableHead className="font-semibold w-[10%] text-center">Művelet</TableHead>
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
