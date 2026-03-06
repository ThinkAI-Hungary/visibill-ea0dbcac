import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { Eye, Link2, FileText, ArrowRightLeft, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { TableCell, TableRow } from '@/components/ui/table';
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
    <TableRow className="bg-muted/40 dark:bg-[hsl(222_47%_7%)] hover:bg-muted/40 dark:hover:bg-[hsl(222_47%_7%)] border-b border-border/30">
      <TableCell colSpan={colSpan} className="py-6 px-8">
        <div className="space-y-4 max-w-3xl ml-4">
          {/* Header */}
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            <Link2 className="h-3.5 w-3.5" />
            Kapcsolódó tételek
          </div>

          {!hasAny && (
            <Card className="bg-muted/30 border-border/50">
              <CardContent className="p-4 flex items-center justify-center">
                <p className="text-sm text-muted-foreground italic">Nincs párosított tétel ehhez a számlához.</p>
              </CardContent>
            </Card>
          )}

          {/* Matched submitted invoices */}
          {matchedSubmittedInvoices.map((inv) => (
            <Card
              key={inv.id}
              className={cn(
                "bg-muted/30 border-border/50 transition-colors",
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
              </CardContent>
            </Card>
          ))}

          {/* Matched NAV invoices */}
          {matchedNavInvoices.map((inv) => (
            <Card key={inv.id} className="bg-muted/30 border-border/50">
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
                      {inv.paid && <Badge variant="outline" className="text-[10px] h-5">Fizetve</Badge>}
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
              </CardContent>
            </Card>
          ))}

          {/* Separator between invoices and transactions */}
          {(matchedSubmittedInvoices.length > 0 || matchedNavInvoices.length > 0) && matchedTransactions.length > 0 && (
            <Separator className="my-1" />
          )}

          {/* Matched transactions */}
          {matchedTransactions.map((tx) => (
            <Card key={tx.id} className="bg-muted/30 border-border/50">
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-xs font-medium flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                    Párosított tranzakció
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant="success" className="gap-1 text-[10px] h-5">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      Párosított
                    </Badge>
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
          ))}
        </div>
      </TableCell>
    </TableRow>
  );
};

export default ExpandedInvoiceRow;
export type { MatchedSubmittedInvoice, MatchedNavInvoice, MatchedTransaction };
