import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { Eye, Link2, FileText, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface MatchedSubmittedInvoice {
  id: string;
  szamlaszam: string | null;
  kibocsatas_datuma: string;
  elado_nev: string;
  vevo_nev: string;
  brutto_vegosszeg: number;
  penznem: string | null;
  image_url: string | null;
  melleklet_url: string | null;
}

interface MatchedNavInvoice {
  id: string;
  invoice_number: string;
  invoice_issue_date: string | null;
  supplier_name: string | null;
  customer_name: string | null;
  invoice_gross_amount: number | null;
  currency: string | null;
  paid: boolean | null;
  submitted: boolean | null;
}

interface MatchedTransaction {
  id: string;
  transaction_date: string;
  amount: number;
  description: string | null;
  currency: string | null;
  type: string | null;
}

interface ExpandedInvoiceRowProps {
  colSpan: number;
  matchedSubmittedInvoices: MatchedSubmittedInvoice[];
  matchedNavInvoices: MatchedNavInvoice[];
  matchedTransactions: MatchedTransaction[];
  onViewInvoice?: (invoice: MatchedSubmittedInvoice) => void;
  onViewNavItems?: (invoice: MatchedNavInvoice) => void;
}

const ExpandedInvoiceRow = ({
  colSpan,
  matchedSubmittedInvoices,
  matchedNavInvoices,
  matchedTransactions,
  onViewInvoice,
  onViewNavItems,
}: ExpandedInvoiceRowProps) => {
  const hasAny = matchedSubmittedInvoices.length > 0 || matchedNavInvoices.length > 0 || matchedTransactions.length > 0;

  return (
    <TableRow className="bg-muted/20 hover:bg-muted/20 border-b border-border/30">
      <TableCell colSpan={colSpan} className="py-3 px-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <Link2 className="h-3.5 w-3.5" />
            Kapcsolódó tételek
          </div>

          {!hasAny && (
            <p className="text-sm text-muted-foreground italic">Nincs párosított tétel ehhez a számlához.</p>
          )}

          {/* Matched submitted invoices */}
          {matchedSubmittedInvoices.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <FileText className="h-3 w-3" />
                Párosított beküldött számla ({matchedSubmittedInvoices.length})
              </div>
              <div className="space-y-1">
                {matchedSubmittedInvoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border/40 bg-card/50 px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <span className="font-mono text-xs font-medium shrink-0">{inv.szamlaszam || '-'}</span>
                      <span className="text-muted-foreground truncate">{inv.elado_nev} → {inv.vevo_nev}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {inv.kibocsatas_datuma ? format(new Date(inv.kibocsatas_datuma), 'yyyy.MM.dd.', { locale: hu }) : '-'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono text-xs font-medium">
                        {formatCurrency(inv.brutto_vegosszeg, inv.penznem || 'HUF')}
                      </span>
                      {(inv.image_url || inv.melleklet_url) && onViewInvoice && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewInvoice(inv);
                          }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Matched NAV invoices */}
          {matchedNavInvoices.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <FileText className="h-3 w-3" />
                Párosított NAV számla ({matchedNavInvoices.length})
              </div>
              <div className="space-y-1">
                {matchedNavInvoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border/40 bg-card/50 px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <span className="font-mono text-xs font-medium shrink-0">{inv.invoice_number}</span>
                      <span className="text-muted-foreground truncate">
                        {inv.supplier_name || '-'} → {inv.customer_name || '-'}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {inv.invoice_issue_date ? format(new Date(inv.invoice_issue_date), 'yyyy.MM.dd.', { locale: hu }) : '-'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono text-xs font-medium">
                        {formatCurrency(inv.invoice_gross_amount || 0, inv.currency || 'HUF')}
                      </span>
                      <div className="flex gap-1">
                        {inv.paid && <Badge variant="outline" className="text-[10px] h-5">Fizetve</Badge>}
                        {inv.submitted && <Badge variant="outline" className="text-[10px] h-5">Beküldve</Badge>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Matched transactions */}
          {matchedTransactions.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <ArrowRightLeft className="h-3 w-3" />
                Párosított tranzakció ({matchedTransactions.length})
              </div>
              <div className="space-y-1">
                {matchedTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border/40 bg-card/50 px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <span className="text-xs text-muted-foreground shrink-0">
                        {format(new Date(tx.transaction_date), 'yyyy.MM.dd.', { locale: hu })}
                      </span>
                      <span className="text-muted-foreground truncate text-xs">{tx.description || '-'}</span>
                      {tx.type && (
                        <Badge variant="outline" className="text-[10px] h-5 shrink-0">{tx.type}</Badge>
                      )}
                    </div>
                    <span className={cn(
                      "font-mono text-xs font-medium shrink-0",
                      tx.amount < 0 ? "text-destructive" : "text-success"
                    )}>
                      {formatCurrency(tx.amount, tx.currency || 'HUF')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
};

export default ExpandedInvoiceRow;
export type { MatchedSubmittedInvoice, MatchedNavInvoice, MatchedTransaction };
