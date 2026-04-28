import React from 'react';
import { TableBody, TableRow, TableCell, TableHead, TableHeader } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { cn, formatCurrency } from '@/lib/utils';
import { CheckCircle2, AlertCircle, HelpCircle, ArrowUpDown, Eye, Sparkles, FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { computeMatchStatus } from '@/hooks/useComputedStatus';
import { TransactionReasonCell } from '@/components/TransactionReasonCell';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { TableEmptyState } from '@/components/ui/table-empty-state';
import { TablePlaceholderRows } from '@/components/ui/table-placeholder-rows';
import type { Transaction } from '@/hooks/useTransactionData';

// ── Row styling helpers (static, outside component) ──

const getRowBackgroundClass = (transaction: Transaction): string => {
  const hoverClass = '';
  const status = computeMatchStatus(transaction);
  if (status === 'matched') {
    return `bg-[hsl(var(--success-row-bg))] text-[hsl(var(--success-row-text))] border-l-4 border-l-success border-b border-border/40 ${hoverClass}`;
  }
  if (status === 'suggested') {
    return `bg-[hsl(var(--warning-row-bg))] text-[hsl(var(--warning-row-text))] border-l-4 border-l-warning border-b border-border/40 ${hoverClass}`;
  }
  return `bg-[hsl(var(--error-row-bg))] text-[hsl(var(--error-row-text))] border-l-4 border-l-destructive border-b border-border/40 ${hoverClass}`;
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
  const [isPreviewing, setIsPreviewing] = React.useState(false);
  const [hoverImage, setHoverImage] = React.useState<string | null>(null);
  const [isLoadingHover, setIsLoadingHover] = React.useState(false);
  const [hasFetchedHover, setHasFetchedHover] = React.useState(false);
  const { toast } = useToast();

  const handlePreview = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!transaction.matched_invoice_id) return;
    
    setIsPreviewing(true);
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('image_url')
        .eq('id', transaction.matched_invoice_id)
        .single();
        
      if (error) throw error;
      
      if (data?.image_url) {
        window.open(data.image_url, '_blank');
      } else {
        toast({ title: 'Nincs előnézet', description: 'A számlához nem tartozik kép vagy PDF.', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Hiba', description: 'Nem sikerült betölteni a számlát.', variant: 'destructive' });
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleHoverChange = async (open: boolean) => {
    if (open && !hasFetchedHover && transaction.matched_invoice_id) {
      setIsLoadingHover(true);
      try {
        const { data } = await supabase.from('invoices').select('image_url').eq('id', transaction.matched_invoice_id).single();
        if (data?.image_url) {
          setHoverImage(data.image_url);
        }
      } catch(e) {} finally {
        setIsLoadingHover(false);
        setHasFetchedHover(true);
      }
    }
  };

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
                {matchStatus === 'matched' && <CheckCircle2 className="h-4 w-4 text-success" />}
                {matchStatus === 'suggested' && <AlertCircle className="h-4 w-4 text-warning" />}
                {matchStatus === 'unmatched' && <HelpCircle className="h-4 w-4 text-destructive" />}
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
        <div className="flex items-center justify-center gap-1.5">
          {transaction.matched_invoice_id && (
            <HoverCard onOpenChange={handleHoverChange} openDelay={300}>
              <HoverCardTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0 relative"
                  onClick={handlePreview}
                  disabled={isPreviewing}
                >
                  {isPreviewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />}
                </Button>
              </HoverCardTrigger>
              <HoverCardContent side="left" align="center" className="w-[260px] h-[200px] p-1.5 flex flex-col overflow-hidden bg-zinc-950 border-zinc-800 shadow-2xl z-50 rounded-xl" sideOffset={15}>
                <div className="flex-1 relative bg-white rounded-md overflow-hidden flex items-center justify-center">
                  {isLoadingHover ? (
                    <div className="flex flex-col items-center gap-2 text-zinc-500">
                      <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                  ) : hoverImage ? (
                    hoverImage.toLowerCase().endsWith('.pdf') ? (
                      <>
                        {/* Overlay to prevent iframe from stealing mouse events and closing the HoverCard */}
                        <div className="absolute inset-0 z-10 cursor-pointer" onClick={handlePreview} title="Kattints a megnyitáshoz" />
                        <iframe src={`${hoverImage}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`} className="w-full h-full border-0 pointer-events-none" />
                      </>
                    ) : (
                      <div className="absolute inset-0 z-10 cursor-pointer" onClick={handlePreview} title="Kattints a megnyitáshoz">
                        <img src={hoverImage} className="w-full h-full object-cover" alt="Számlakép" />
                      </div>
                    )
                  ) : (
                    <span className="text-xs text-zinc-500">Nincs elérhető számlakép</span>
                  )}
                </div>
              </HoverCardContent>
            </HoverCard>
          )}
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
                  Részletek
                </Button>
              </TooltipTrigger>
              <TooltipContent>Tranzakció és lehetséges számlák részletei</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
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
            <TableHead className="font-semibold w-[28%]">Leírás</TableHead>
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
            <TableHead className="font-semibold w-[12%] text-center">Művelet</TableHead>
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
