import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Search, Check, AlertTriangle, FileText } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { format, subDays, addDays } from 'date-fns';
import { toast } from 'sonner';

interface Transaction {
  id: string;
  transaction_date: string;
  description: string | null;
  amount: number;
  currency: string | null;
  type: string | null;
  matched_invoice_id: string | null;
  confidence_score: number | null;
  is_verified: boolean | null;
  match_type: string | null;
  reason: string | null;
  created_at: string | null;
  company_id: string | null;
}

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_gross_amount: number | null;
  supplier_name: string | null;
  customer_name: string | null;
  currency: string | null;
  invoice_issue_date: string | null;
  already_paid: number;
  remaining: number;
}

interface TransactionMatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  companyId: string;
  onMatch: () => void;
}

export const TransactionMatchDialog = ({
  open,
  onOpenChange,
  transaction,
  companyId,
  onMatch
}: TransactionMatchDialogProps) => {
  const [search, setSearch] = useState('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  useEffect(() => {
    if (open && transaction) {
      fetchInvoices();
      setSearch('');
      setSelectedInvoiceId(null);
    }
  }, [open, transaction]);

  const fetchInvoices = async () => {
    if (!transaction || !companyId) return;

    setLoading(true);
    try {
      // Calculate date range: -30 days to +7 days from transaction date
      const transactionDate = new Date(transaction.transaction_date);
      const dateFrom = format(subDays(transactionDate, 30), 'yyyy-MM-dd');
      const dateTo = format(addDays(transactionDate, 7), 'yyyy-MM-dd');

      // Fetch NAV invoices
      const { data: navInvoices, error: navError } = await supabase
        .from('nav_invoices')
        .select('id, invoice_number, invoice_gross_amount, supplier_name, customer_name, currency, invoice_issue_date')
        .eq('company_id', companyId)
        .gte('invoice_issue_date', dateFrom)
        .lte('invoice_issue_date', dateTo)
        .order('invoice_issue_date', { ascending: false });

      if (navError) throw navError;

      // For each invoice, fetch already paid amount from matched transactions
      const invoicesWithPayments: Invoice[] = await Promise.all(
        (navInvoices || []).map(async (inv) => {
          const { data: matchedTransactions } = await supabase
            .from('transactions')
            .select('amount')
            .eq('matched_invoice_id', inv.id)
            .eq('is_verified', true);

          const alreadyPaid = matchedTransactions?.reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0;
          const invoiceAmount = Math.abs(inv.invoice_gross_amount || 0);
          const remaining = invoiceAmount - alreadyPaid;

          return {
            ...inv,
            already_paid: alreadyPaid,
            remaining: remaining
          };
        })
      );

      setInvoices(invoicesWithPayments);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast.error('Hiba a számlák betöltésekor');
    } finally {
      setLoading(false);
    }
  };

  const filteredInvoices = useMemo(() => {
    if (!search) return invoices;
    const searchLower = search.toLowerCase();
    return invoices.filter(inv =>
      inv.invoice_number.toLowerCase().includes(searchLower) ||
      inv.supplier_name?.toLowerCase().includes(searchLower) ||
      inv.customer_name?.toLowerCase().includes(searchLower) ||
      inv.invoice_gross_amount?.toString().includes(search)
    );
  }, [invoices, search]);

  const handleMatch = async () => {
    if (!transaction || !selectedInvoiceId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          matched_invoice_id: selectedInvoiceId,
          is_verified: true,
          match_type: 'manual'
        })
        .eq('id', transaction.id);

      if (error) throw error;

      toast.success('Tranzakció sikeresen párosítva!');
      onMatch();
      onOpenChange(false);
    } catch (error) {
      console.error('Error matching transaction:', error);
      toast.error('Hiba a párosítás mentésekor');
    } finally {
      setSaving(false);
    }
  };

  const transactionAmount = Math.abs(transaction?.amount || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Manuális számla párosítás</DialogTitle>
          <DialogDescription>
            Válaszd ki a tranzakcióhoz tartozó számlát
          </DialogDescription>
        </DialogHeader>

        {/* Transaction Summary */}
        {transaction && (
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Dátum:</span>
                  <span className="ml-2 font-medium">
                    {format(new Date(transaction.transaction_date), 'yyyy.MM.dd')}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Összeg:</span>
                  <span className={cn(
                    "ml-2 font-medium font-mono",
                    transaction.amount >= 0 ? "text-success" : "text-destructive"
                  )}>
                    {formatCurrency(transaction.amount, transaction.currency || 'HUF')}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Leírás:</span>
                  <span className="ml-2">{transaction.description || '-'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Keresés számlaszám, partner vagy összeg alapján..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Invoice List */}
        <ScrollArea className="h-[300px] border rounded-md">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <LoadingSpinner />
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <FileText className="h-8 w-8 mb-2" />
              <p>Nincs találat</p>
              <p className="text-xs">Próbálj más keresési feltételt</p>
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {filteredInvoices.map((invoice) => {
                const isSelected = selectedInvoiceId === invoice.id;
                const isExactMatch = Math.abs((invoice.invoice_gross_amount || 0) - transactionAmount) < 1;
                const isPartialMatch = invoice.remaining > 0 && invoice.remaining <= transactionAmount;

                return (
                  <Card
                    key={invoice.id}
                    className={cn(
                      "cursor-pointer transition-all hover:border-primary/50",
                      isSelected && "border-primary bg-primary/5",
                      isExactMatch && !isSelected && "border-success/50 bg-success/5"
                    )}
                    onClick={() => setSelectedInvoiceId(invoice.id)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm truncate">
                              {invoice.invoice_number}
                            </span>
                            {isExactMatch && (
                              <Badge variant="success" className="text-xs">
                                <Check className="h-3 w-3 mr-1" />
                                Pontos egyezés
                              </Badge>
                            )}
                            {isPartialMatch && !isExactMatch && (
                              <Badge variant="warning" className="text-xs">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Részfizetés
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {invoice.supplier_name || invoice.customer_name || '-'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {invoice.invoice_issue_date 
                              ? format(new Date(invoice.invoice_issue_date), 'yyyy.MM.dd')
                              : '-'
                            }
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-mono text-sm font-medium">
                            {formatCurrency(invoice.invoice_gross_amount || 0, invoice.currency || 'HUF')}
                          </div>
                          {invoice.already_paid > 0 && (
                            <div className="text-xs text-muted-foreground">
                              Fizetve: {formatCurrency(invoice.already_paid, invoice.currency || 'HUF')}
                            </div>
                          )}
                          {invoice.remaining > 0 && invoice.remaining < (invoice.invoice_gross_amount || 0) && (
                            <div className="text-xs text-warning">
                              Maradék: {formatCurrency(invoice.remaining, invoice.currency || 'HUF')}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Mégse
          </Button>
          <Button 
            onClick={handleMatch} 
            disabled={!selectedInvoiceId || saving}
          >
            {saving ? 'Mentés...' : 'Párosítás'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
