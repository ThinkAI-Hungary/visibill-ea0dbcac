import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Search, Check, AlertTriangle, FileText, CheckCircle2, HelpCircle, Link2 } from 'lucide-react';
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

interface MatchedInvoice {
  id: string;
  invoice_number: string;
  invoice_gross_amount: number | null;
  invoice_net_amount: number | null;
  invoice_vat_amount: number | null;
  supplier_name: string | null;
  customer_name: string | null;
  currency: string | null;
  invoice_issue_date: string | null;
  invoice_delivery_date: string | null;
  payment_method: string | null;
  paid: boolean | null;
}

interface AvailableInvoice {
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

interface TransactionDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  companyId: string;
  onUpdate: () => void;
}

export const TransactionDetailsDialog = ({
  open,
  onOpenChange,
  transaction,
  companyId,
  onUpdate
}: TransactionDetailsDialogProps) => {
  const [matchedInvoice, setMatchedInvoice] = useState<MatchedInvoice | null>(null);
  const [availableInvoices, setAvailableInvoices] = useState<AvailableInvoice[]>([]);
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showManualMatch, setShowManualMatch] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  useEffect(() => {
    if (open && transaction) {
      setShowManualMatch(false);
      setSearch('');
      setSelectedInvoiceId(null);
      
      if (transaction.matched_invoice_id) {
        fetchMatchedInvoice();
      } else {
        setMatchedInvoice(null);
      }
    }
  }, [open, transaction]);

  const fetchMatchedInvoice = async () => {
    if (!transaction?.matched_invoice_id) return;
    
    setLoadingInvoice(true);
    try {
      const { data, error } = await supabase
        .from('nav_invoices')
        .select('id, invoice_number, invoice_gross_amount, invoice_net_amount, invoice_vat_amount, supplier_name, customer_name, currency, invoice_issue_date, invoice_delivery_date, payment_method, paid')
        .eq('id', transaction.matched_invoice_id)
        .maybeSingle();

      if (error) throw error;
      setMatchedInvoice(data);
    } catch (error) {
      console.error('Error fetching matched invoice:', error);
      setMatchedInvoice(null);
    } finally {
      setLoadingInvoice(false);
    }
  };

  const fetchAvailableInvoices = async () => {
    if (!transaction || !companyId) return;

    setLoadingAvailable(true);
    try {
      const transactionDate = new Date(transaction.transaction_date);
      const dateFrom = format(subDays(transactionDate, 30), 'yyyy-MM-dd');
      const dateTo = format(addDays(transactionDate, 7), 'yyyy-MM-dd');

      const { data: navInvoices, error: navError } = await supabase
        .from('nav_invoices')
        .select('id, invoice_number, invoice_gross_amount, supplier_name, customer_name, currency, invoice_issue_date')
        .eq('company_id', companyId)
        .gte('invoice_issue_date', dateFrom)
        .lte('invoice_issue_date', dateTo)
        .order('invoice_issue_date', { ascending: false });

      if (navError) throw navError;

      const invoicesWithPayments: AvailableInvoice[] = await Promise.all(
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

      setAvailableInvoices(invoicesWithPayments);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast.error('Hiba a számlák betöltésekor');
    } finally {
      setLoadingAvailable(false);
    }
  };

  const handleShowManualMatch = () => {
    setShowManualMatch(true);
    fetchAvailableInvoices();
  };

  const handleVerify = async () => {
    if (!transaction) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ is_verified: true })
        .eq('id', transaction.id);

      if (error) throw error;

      toast.success('Tranzakció jóváhagyva!');
      onUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error('Error verifying transaction:', error);
      toast.error('Hiba a jóváhagyás során');
    } finally {
      setSaving(false);
    }
  };

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
      onUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error('Error matching transaction:', error);
      toast.error('Hiba a párosítás mentésekor');
    } finally {
      setSaving(false);
    }
  };

  const handleUnmatch = async () => {
    if (!transaction) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          matched_invoice_id: null,
          is_verified: false,
          match_type: null
        })
        .eq('id', transaction.id);

      if (error) throw error;

      toast.success('Párosítás megszüntetve!');
      onUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error('Error unmatching transaction:', error);
      toast.error('Hiba a párosítás megszüntetésekor');
    } finally {
      setSaving(false);
    }
  };

  const filteredInvoices = useMemo(() => {
    if (!search) return availableInvoices;
    const searchLower = search.toLowerCase();
    return availableInvoices.filter(inv =>
      inv.invoice_number.toLowerCase().includes(searchLower) ||
      inv.supplier_name?.toLowerCase().includes(searchLower) ||
      inv.customer_name?.toLowerCase().includes(searchLower) ||
      inv.invoice_gross_amount?.toString().includes(search)
    );
  }, [availableInvoices, search]);

  const transactionAmount = Math.abs(transaction?.amount || 0);
  const matchStatus = transaction?.is_verified && transaction?.matched_invoice_id 
    ? 'matched' 
    : transaction?.matched_invoice_id 
      ? 'suggested' 
      : 'unmatched';

  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Tranzakció részletei
          </DialogTitle>
          <DialogDescription>
            Tranzakció és párosított számla adatai
          </DialogDescription>
        </DialogHeader>

        {/* Transaction Details */}
        <Card className="bg-muted/30 border-border/50">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span>Tranzakció</span>
              {matchStatus === 'matched' && (
                <Badge variant="success" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Párosított
                </Badge>
              )}
              {matchStatus === 'suggested' && (
                <Badge variant="warning" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Javasolt
                </Badge>
              )}
              {matchStatus === 'unmatched' && (
                <Badge variant="destructive" className="gap-1">
                  <HelpCircle className="h-3 w-3" />
                  Párosítatlan
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid grid-cols-2 gap-3 text-sm">
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
              {transaction.type && (
                <div>
                  <span className="text-muted-foreground">Típus:</span>
                  <span className="ml-2">{transaction.type}</span>
                </div>
              )}
              {transaction.reason && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">AI indoklás:</span>
                  <p className="mt-1 text-xs bg-background/50 p-2 rounded border border-border/30">
                    {transaction.reason}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Matched Invoice Section */}
        {transaction.matched_invoice_id && !showManualMatch && (
          <>
            <Card className="bg-muted/30 border-border/50">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-medium">Párosított számla</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {loadingInvoice ? (
                  <div className="flex items-center justify-center py-4">
                    <LoadingSpinner />
                  </div>
                ) : matchedInvoice ? (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Számlaszám:</span>
                      <span className="ml-2 font-medium font-mono">{matchedInvoice.invoice_number}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Kiállítás:</span>
                      <span className="ml-2">
                        {matchedInvoice.invoice_issue_date 
                          ? format(new Date(matchedInvoice.invoice_issue_date), 'yyyy.MM.dd')
                          : '-'}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Partner:</span>
                      <span className="ml-2">{matchedInvoice.supplier_name || matchedInvoice.customer_name || '-'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Nettó:</span>
                      <span className="ml-2 font-mono">
                        {formatCurrency(matchedInvoice.invoice_net_amount || 0, matchedInvoice.currency || 'HUF')}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Bruttó:</span>
                      <span className="ml-2 font-mono font-medium">
                        {formatCurrency(matchedInvoice.invoice_gross_amount || 0, matchedInvoice.currency || 'HUF')}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">ÁFA:</span>
                      <span className="ml-2 font-mono">
                        {formatCurrency(matchedInvoice.invoice_vat_amount || 0, matchedInvoice.currency || 'HUF')}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Fizetési mód:</span>
                      <span className="ml-2">{matchedInvoice.payment_method || '-'}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Számla nem található</p>
                )}
              </CardContent>
            </Card>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={handleUnmatch} disabled={saving}>
                Párosítás megszüntetése
              </Button>
              <Button variant="outline" onClick={handleShowManualMatch}>
                <Link2 className="h-4 w-4 mr-2" />
                Másik számla választása
              </Button>
              {matchStatus === 'suggested' && (
                <Button onClick={handleVerify} disabled={saving}>
                  <Check className="h-4 w-4 mr-2" />
                  {saving ? 'Mentés...' : 'Rendben'}
                </Button>
              )}
            </DialogFooter>
          </>
        )}

        {/* Manual Match Section */}
        {(showManualMatch || !transaction.matched_invoice_id) && (
          <>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">
                  {transaction.matched_invoice_id ? 'Másik számla választása' : 'Manuális párosítás'}
                </h4>
                {transaction.matched_invoice_id && (
                  <Button variant="ghost" size="sm" onClick={() => setShowManualMatch(false)}>
                    Vissza
                  </Button>
                )}
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Keresés számlaszám, partner vagy összeg alapján..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              <ScrollArea className="h-[250px] border rounded-md">
                {loadingAvailable ? (
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
            </div>

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
          </>
        )}

        {/* No Match, No Manual Mode */}
        {!transaction.matched_invoice_id && !showManualMatch && availableInvoices.length === 0 && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Bezárás
            </Button>
            <Button onClick={handleShowManualMatch}>
              <Link2 className="h-4 w-4 mr-2" />
              Számla párosítása
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};
