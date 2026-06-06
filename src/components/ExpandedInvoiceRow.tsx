import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { useState } from 'react';
import { Eye, Link2, FileText, ArrowRightLeft, CheckCircle2, GitBranch, AlertTriangle, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { TableCell, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface MatchedSubmittedInvoice {
  id: string;
  bizonylatsorszam: string | null;
  kibocsatas_datuma: string;
  elado_nev: string;
  vevo_nev: string;
  brutto_vegosszeg: number;
  penznem: string | null;
  image_url: string | null;
  melleklet_url: string | null;
  invoice_type?: string | null;
}

// Human-readable invoice_type labels
const INVOICE_TYPE_LABELS: Record<string, string> = {
  sima_szla: 'Számla',
  dijbekero: 'Díjbekérő',
  elolegszamla: 'Előlegszámla',
  garanciajegy: 'Garanciajegy',
  szallitolevel: 'Szállítólevél',
  sztorno: 'Sztornó',
  modosito: 'Módosító',
  vegszamla: 'Végszámla',
  proforma: 'Proforma',
  nyugta: 'Nyugta',
};

function getInvoiceTypeLabel(rawType: string): string {
  return INVOICE_TYPE_LABELS[rawType] || rawType.replace(/_/g, ' ');
}

interface MatchedNavInvoice {
  id: string;
  invoice_number: string;
  invoice_issue_date: string | null;
  supplier_name: string | null;
  customer_name: string | null;
  invoice_gross_amount: number | null;
  currency: string | null;
  transaction_id: string | null;
  submitted: boolean | null;
}

interface MatchedTransaction {
  id: string;
  transaction_date: string;
  amount: number;
  description: string | null;
  currency: string | null;
  type: string | null;
  confidence_score: number | null;
  match_type: string | null;
  is_verified: boolean | null;
}

interface LinkedInvoice {
  id: string;
  bizonylatsorszam: string | null;
  kibocsatas_datuma: string;
  elado_nev: string;
  vevo_nev: string;
  brutto_vegosszeg: number;
  penznem: string | null;
  image_url?: string | null;
  melleklet_url?: string | null;
  reference_number?: string | null;
  invoice_type?: string | null;
  relationDirection?: 'parent' | 'child';
}

interface MatchedCourierReport {
  id: string;
  report_type: string;
  package_number: string | null;
  reference_number: string | null;
  delivery_date: string | null;
  cod_amount: number | null;
  recipient_name: string | null;
  matched_nav_invoice_id: string | null;
  matched_transaction_id: string | null;
}

interface ExpandedInvoiceRowProps {
  colSpan: number;
  matchedSubmittedInvoices: MatchedSubmittedInvoice[];
  matchedNavInvoices: MatchedNavInvoice[];
  matchedTransactions: MatchedTransaction[];
  linkedInvoices?: LinkedInvoice[];
  invoiceReferenceNumber?: string | null;
  linkedInvoicesLoading?: boolean;
  onViewInvoice?: (invoice: MatchedSubmittedInvoice) => void;
  onViewNavItems?: (invoice: MatchedNavInvoice) => void;
  matchedCourierReports?: MatchedCourierReport[];
  /** When true, show inline collapsible tx list inside invoice cards instead of standalone cards */
  hideStandaloneTransactions?: boolean;
  /** Invoice exclude from accounting state */
  excludeFromAccounting?: boolean;
  /** Callback to toggle exclude from accounting */
  onToggleExclude?: () => void;
}

// Compact collapsible transaction list inside invoice cards
function InlineTransactionList({ transactions, invoiceId }: { transactions: MatchedTransaction[]; invoiceId: string }) {
  const [open, setOpen] = useState(false);

  if (!transactions || transactions.length === 0) return null;

  return (
    <div className="mt-2 pt-2 border-t border-border/30">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors w-full"
      >
        <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", open && "rotate-180")} />
        <ArrowRightLeft className="h-2.5 w-2.5" />
        <span className="font-medium">Párosított tranzakciók ({transactions.length})</span>
      </button>
      {open && (
        <div className="mt-1.5 space-y-1">
          {transactions.map(tx => (
            <div key={tx.id} className="flex items-center gap-2 text-[10px] pl-4">
              <span className="text-muted-foreground whitespace-nowrap">
                {format(new Date(tx.transaction_date), 'MM.dd', { locale: hu })}
              </span>
              <span className={cn(
                "font-mono font-medium whitespace-nowrap",
                tx.amount < 0 ? "text-destructive" : "text-success"
              )}>
                {formatCurrency(tx.amount, tx.currency || 'HUF')}
              </span>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-muted-foreground truncate cursor-default">
                      {tx.description ? tx.description.substring(0, 60) + (tx.description.length > 60 ? '…' : '') : '-'}
                    </span>
                  </TooltipTrigger>
                  {tx.description && tx.description.length > 60 && (
                    <TooltipContent side="top" className="max-w-md text-xs">
                      {tx.description}
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const ExpandedInvoiceRow = ({
  colSpan,
  matchedSubmittedInvoices,
  matchedNavInvoices,
  matchedTransactions,
  linkedInvoices = [],
  invoiceReferenceNumber,
  linkedInvoicesLoading = false,
  onViewInvoice,
  onViewNavItems,
  matchedCourierReports = [],
  hideStandaloneTransactions = false,
  excludeFromAccounting = false,
  onToggleExclude,
}: ExpandedInvoiceRowProps) => {
  // Detect broken chain: reference_number exists but no matching linked invoice found
  const hasBrokenChain = !linkedInvoicesLoading
    && !!invoiceReferenceNumber
    && !linkedInvoices.some(
      (inv) => inv.bizonylatsorszam?.toUpperCase() === invoiceReferenceNumber.toUpperCase()
    );

  const hasAny = matchedSubmittedInvoices.length > 0 
    || matchedNavInvoices.length > 0 
    || matchedTransactions.length > 0 
    || linkedInvoices.length > 0 
    || matchedCourierReports.length > 0
    || hasBrokenChain;

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
            @keyframes accordionFadeIn {
              from { opacity: 0; transform: translateY(-6px); }
              to { opacity: 1; transform: translateY(0); }
            }
            .accordion-grid-animate {
              display: grid;
              animation: accordionSlideDown 250ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
            .accordion-grid-animate > .accordion-overflow {
              overflow: hidden;
            }
            .expand-animate { animation: accordionFadeIn 250ms cubic-bezier(0.16, 1, 0.3, 1) forwards; }
            .expand-stagger-1 { animation: accordionFadeIn 250ms cubic-bezier(0.16, 1, 0.3, 1) 60ms forwards; opacity: 0; }
            .expand-stagger-2 { animation: accordionFadeIn 250ms cubic-bezier(0.16, 1, 0.3, 1) 120ms forwards; opacity: 0; }
            .expand-stagger-3 { animation: accordionFadeIn 250ms cubic-bezier(0.16, 1, 0.3, 1) 180ms forwards; opacity: 0; }
            .expand-stagger-4 { animation: accordionFadeIn 250ms cubic-bezier(0.16, 1, 0.3, 1) 240ms forwards; opacity: 0; }
          `}</style>
          <div className="accordion-grid-animate">
            <div className="accordion-overflow">
              <div className="py-6 px-8 space-y-4 max-w-3xl ml-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 expand-animate">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <Link2 className="h-3.5 w-3.5" />
                Kapcsolódó tételek
              </div>
              {onToggleExclude && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onToggleExclude(); }}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all duration-200 border",
                    excludeFromAccounting
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-300/40 hover:bg-amber-500/25"
                      : "bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted hover:text-foreground"
                  )}
                >
                  <div className={cn(
                    "w-3 h-3 rounded-sm border-2 flex items-center justify-center transition-colors",
                    excludeFromAccounting ? "border-amber-500 bg-amber-500" : "border-muted-foreground/40"
                  )}>
                    {excludeFromAccounting && (
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1.5 4L3 5.5L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  Nem kerül könyvelésre
                </button>
              )}
            </div>

            {!hasAny && (
              <Card className="bg-muted/30 border-border/50 expand-stagger-1">
                <CardContent className="p-4 flex items-center justify-center">
                  <p className="text-sm text-muted-foreground italic">Nincs párosított tétel ehhez a számlához.</p>
                </CardContent>
              </Card>
            )}

            {/* Broken chain warning */}
            {hasBrokenChain && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Card className="bg-amber-500/8 border-amber-500/30 expand-stagger-1">
                      <CardContent className="p-3 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                        <div className="text-xs">
                          <span className="font-medium text-amber-500">Hiányzó bizonylat(ok)</span>
                          <span className="text-muted-foreground ml-1.5">
                            — A következő hivatkozott bizonylat(ok) hiányoznak vagy törölték őket: <code className="font-mono text-[11px] bg-muted px-1 rounded">{invoiceReferenceNumber}</code>
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="text-xs">A(z) <strong>{invoiceReferenceNumber}</strong> sorszámú bizonylat nem található a rendszerben. Lehetséges, hogy még nem töltötték fel, törölték, vagy hibás a hivatkozás.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Linked invoices (reference_number based) */}
            {linkedInvoices.length > 0 && (
              <>
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider expand-stagger-1">
                  <GitBranch className="h-3.5 w-3.5" />
                  Kapcsolt bizonylatok
                </div>
                {linkedInvoices.map((inv) => (
                  <Card
                    key={inv.id}
                    className={cn(
                      "bg-muted/30 border-border/50 transition-colors expand-stagger-1",
                      (inv.image_url || inv.melleklet_url) && onViewInvoice && "cursor-pointer hover:border-primary/50"
                    )}
                    onClick={() => {
                      if ((inv.image_url || inv.melleklet_url) && onViewInvoice) {
                        onViewInvoice(inv as MatchedSubmittedInvoice);
                      }
                    }}
                  >
                    <CardHeader className="py-2 px-3">
                      <CardTitle className="text-xs font-medium flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <GitBranch className="h-3 w-3 text-muted-foreground" />
                          Kapcsolt bizonylat
                        </span>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="gap-1 text-[10px] h-5">
                            <Link2 className="h-2.5 w-2.5" />
                            {inv.relationDirection === 'parent' ? 'Hivatkozott bizonylat' : inv.relationDirection === 'child' ? 'Hivatkozó bizonylat' : 'Kapcsolt'}
                          </Badge>
                          {inv.invoice_type && (
                            <Badge variant="outline" className="text-[10px] h-5 bg-violet-500/10 text-violet-600 border-violet-500/20">
                              {getInvoiceTypeLabel(inv.invoice_type)}
                            </Badge>
                          )}
                          {inv.reference_number && (
                            <Badge variant="outline" className="text-[10px] h-5">
                              → {inv.reference_number}
                            </Badge>
                          )}
                          {(inv.image_url || inv.melleklet_url) && onViewInvoice && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              Kattints a részletekért
                            </span>
                          )}
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Bizonylatsorszám:</span>
                          <span className="ml-1 font-mono font-medium">{inv.bizonylatsorszam || '-'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Eladó:</span>
                          <span className="ml-1 font-medium">{inv.elado_nev}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Vevő:</span>
                          <span className="ml-1 font-medium">{inv.vevo_nev}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Kiállítás:</span>
                          <span className="ml-1">
                            {format(new Date(inv.kibocsatas_datuma), 'yyyy.MM.dd', { locale: hu })}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Bruttó:</span>
                          <span className="ml-1 font-mono font-medium">
                            {formatCurrency(inv.brutto_vegosszeg, inv.penznem || 'HUF')}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {(matchedSubmittedInvoices.length > 0 || matchedNavInvoices.length > 0 || matchedTransactions.length > 0) && (
                  <Separator className="my-1" />
                )}
              </>
            )}

            {/* Matched submitted invoices */}
            {matchedSubmittedInvoices.map((inv) => (
              <Card
                key={inv.id}
                className={cn(
                  "bg-muted/30 border-border/50 transition-colors expand-stagger-2",
                  (inv.image_url || inv.melleklet_url) && onViewInvoice && "cursor-pointer hover:border-primary/50"
                )}
                onClick={() => {
                  if ((inv.image_url || inv.melleklet_url) && onViewInvoice) {
                    onViewInvoice(inv);
                  }
                }}
              >
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-xs font-medium flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <FileText className="h-3 w-3 text-muted-foreground" />
                      Párosított beküldött számla
                      {inv.invoice_type && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-violet-500/10 text-violet-600 border-violet-500/20">
                          {getInvoiceTypeLabel(inv.invoice_type)}
                        </Badge>
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant="success" className="gap-1 text-[10px] h-5">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        Párosított
                      </Badge>
                      {(inv.image_url || inv.melleklet_url) && onViewInvoice && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          Kattints a részletekért
                        </span>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Bizonylatsorszám:</span>
                      <span className="ml-1 font-mono font-medium">{inv.bizonylatsorszam || '-'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Eladó:</span>
                      <span className="ml-1 font-medium">{inv.elado_nev}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Vevő:</span>
                      <span className="ml-1 font-medium">{inv.vevo_nev}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Kiállítás:</span>
                      <span className="ml-1">
                        {format(new Date(inv.kibocsatas_datuma), 'yyyy.MM.dd', { locale: hu })}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Bruttó:</span>
                      <span className="ml-1 font-mono font-medium">
                        {formatCurrency(inv.brutto_vegosszeg, inv.penznem || 'HUF')}
                      </span>
                    </div>
                  </div>
                  {/* Inline collapsible transaction list (Transactions page only, 2+ tx) */}
                  {hideStandaloneTransactions && matchedTransactions.length >= 2 && (
                    <InlineTransactionList transactions={matchedTransactions} invoiceId={inv.id} />
                  )}
                </CardContent>
              </Card>
            ))}

            {/* Matched NAV invoices */}
            {matchedNavInvoices.map((inv) => (
              <Card key={inv.id} className="bg-muted/30 border-border/50 expand-stagger-3">
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-xs font-medium flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <FileText className="h-3 w-3 text-muted-foreground" />
                      Párosított NAV számla
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant="success" className="gap-1 text-[10px] h-5">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        Párosított
                      </Badge>
                      <div className="flex gap-1">
                        {!!inv.transaction_id && <Badge variant="outline" className="text-[10px] h-5">Fizetve</Badge>}
                        {inv.submitted && <Badge variant="outline" className="text-[10px] h-5">Beküldve</Badge>}
                      </div>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Bizonylatsorszám:</span>
                      <span className="ml-1 font-mono font-medium">{inv.invoice_number}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Eladó:</span>
                      <span className="ml-1 font-medium">{inv.supplier_name || '-'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Vevő:</span>
                      <span className="ml-1 font-medium">{inv.customer_name || '-'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Kiállítás:</span>
                      <span className="ml-1">
                        {inv.invoice_issue_date ? format(new Date(inv.invoice_issue_date), 'yyyy.MM.dd', { locale: hu }) : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Bruttó:</span>
                      <span className="ml-1 font-mono font-medium">
                        {formatCurrency(inv.invoice_gross_amount || 0, inv.currency || 'HUF')}
                      </span>
                    </div>
                  </div>
                  {/* Inline collapsible transaction list (Transactions page only, 2+ tx) */}
                  {hideStandaloneTransactions && matchedTransactions.length >= 2 && (
                    <InlineTransactionList transactions={matchedTransactions} invoiceId={inv.id} />
                  )}
                </CardContent>
              </Card>
            ))}

            {/* Standalone matched transactions (full card style — Invoices page only) */}
            {!hideStandaloneTransactions && matchedTransactions.map((tx) => {
              const isSuggested = tx.match_type !== 'manual' && !tx.is_verified && (tx.confidence_score ?? 1) < 0.9;
              return (
              <Card key={tx.id} className={cn(
                "bg-muted/30 border-border/50 expand-stagger-4",
                isSuggested && "border-l-2 border-l-yellow-500/70"
              )}>
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-xs font-medium flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                      {isSuggested ? 'Javasolt tranzakció' : 'Párosított tranzakció'}
                    </span>
                    <div className="flex items-center gap-2">
                      {isSuggested ? (
                        <Badge className="gap-1 text-[10px] h-5 bg-yellow-500/15 text-yellow-600 border-yellow-500/30 hover:bg-yellow-500/20">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          Javasolt
                        </Badge>
                      ) : (
                        <Badge variant="success" className="gap-1 text-[10px] h-5">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          Párosított
                        </Badge>
                      )}
                      {tx.type && (
                        <Badge variant="outline" className="text-[10px] h-5">{tx.type}</Badge>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Dátum:</span>
                      <span className="ml-1 font-medium">
                        {format(new Date(tx.transaction_date), 'yyyy.MM.dd', { locale: hu })}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Összeg:</span>
                      <span className={cn(
                        "ml-1 font-mono font-medium",
                        tx.amount < 0 ? "text-destructive" : "text-success"
                      )}>
                        {formatCurrency(tx.amount, tx.currency || 'HUF')}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Leírás:</span>
                      <span className="ml-1">{tx.description || '-'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              );
            })}

            {/* Separator between transactions and courier reports */}
            {((matchedSubmittedInvoices.length > 0 || matchedNavInvoices.length > 0 || matchedTransactions.length > 0) && matchedCourierReports.length > 0) && (
              <Separator className="my-1" />
            )}

            {/* Matched courier reports */}
            {matchedCourierReports.map((cr) => (
              <Card key={cr.id} className="bg-muted/30 border-border/50 expand-stagger-4">
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-xs font-medium flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Badge variant="outline" className="uppercase text-[9px] px-1.5 h-4.5 bg-primary/5 text-primary border-primary/20">
                        {cr.report_type}
                      </Badge>
                      Futárjelentés tétel
                    </span>
                    <Badge variant="success" className="gap-1 text-[10px] h-5">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      Párosított
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Csomagszám:</span>
                      <span className="ml-1 font-mono font-medium">{cr.package_number || '-'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Utánvét összeg:</span>
                      <span className="ml-1 font-mono font-medium">
                        {formatCurrency(cr.cod_amount || 0, 'HUF')}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Kézbesítés:</span>
                      <span className="ml-1 font-medium">
                        {cr.delivery_date ? format(new Date(cr.delivery_date), 'yyyy.MM.dd', { locale: hu }) : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Címzett:</span>
                      <span className="ml-1 font-medium">{cr.recipient_name || '-'}</span>
                    </div>
                    {cr.reference_number && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Hivatkozási szám:</span>
                        <span className="ml-1 font-mono">{cr.reference_number}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
              </div>
            </div>
        </TableCell>
      </TableRow>
      {/* Bottom spacer row */}
      <TableRow className="bg-transparent hover:bg-transparent border-none">
        <TableCell colSpan={colSpan} className="p-0 h-1 border-none" />
      </TableRow>
    </>
  );
};

export default ExpandedInvoiceRow;
export type { MatchedSubmittedInvoice, MatchedNavInvoice, MatchedTransaction, LinkedInvoice };
