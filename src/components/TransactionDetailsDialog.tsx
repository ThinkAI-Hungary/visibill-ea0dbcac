import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Search, Check, AlertTriangle, FileText, CheckCircle2, HelpCircle, Link2, Eye } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { format, subDays, addDays } from 'date-fns';
import { toast } from 'sonner';
import { InvoiceDetailPopup } from '@/components/InvoiceDetailPopup';

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

// Matched invoice from the 'invoices' table
interface MatchedInvoice {
  id: string;
  bizonylatsorszam: string | null;
  kibocsatas_datuma: string;
  teljesites_datuma: string | null;
  elado_nev: string;
  vevo_nev: string;
  brutto_vegosszeg: number;
  penznem: string | null;
  invoice_type: string;
}

// Available invoices for manual matching (from invoices table)
interface AvailableInvoice {
  id: string;
  bizonylatsorszam: string;
  brutto_vegosszeg: number;
  elado_nev: string;
  penznem: string | null;
  kibocsatas_datuma: string;
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
  const [invoiceDetailOpen, setInvoiceDetailOpen] = useState(false);
  const [invoiceDetailId, setInvoiceDetailId] = useState<string | null>(null);

  useEffect(() => {
    if (open && transaction) {
      setShowManualMatch(false);
      setSearch('');
      setSelectedInvoiceId(null);
      
      if (transaction.matched_invoice_id) {
        fetchMatchedInvoice();
      } else {
        setMatchedInvoice(null);
        // Auto-load available invoices for unmatched transactions
        fetchAvailableInvoices();
      }
    }
  }, [open, transaction]);

  // Fetch from 'invoices' table - this is the correct connection
  const fetchMatchedInvoice = async () => {
    if (!transaction?.matched_invoice_id) return;
    
    setLoadingInvoice(true);
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, bizonylatsorszam, kibocsatas_datuma, teljesites_datuma, elado_nev, vevo_nev, brutto_vegosszeg, penznem, invoice_type')
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

      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('id, bizonylatsorszam, brutto_vegosszeg, elado_nev, penznem, kibocsatas_datuma')
        .eq('company_id', companyId)
        .gte('kibocsatas_datuma', dateFrom)
        .lte('kibocsatas_datuma', dateTo)
        .order('kibocsatas_datuma', { ascending: false });

      if (error) throw error;

      const invoicesWithPayments: AvailableInvoice[] = await Promise.all(
        (invoices || []).map(async (inv) => {
          const { data: matchedTransactions } = await supabase
            .from('transactions')
            .select('amount')
            .eq('matched_invoice_id', inv.id)
            .eq('is_verified', true);

          const alreadyPaid = matchedTransactions?.reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0;
          const invoiceAmount = Math.abs(inv.brutto_vegosszeg || 0);
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
      inv.bizonylatsorszam.toLowerCase().includes(searchLower) ||
      inv.elado_nev?.toLowerCase().includes(searchLower) ||
      inv.brutto_vegosszeg?.toString().includes(search)
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
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Tranzakció részletei
          </DialogTitle>
          <DialogDescription className="text-xs">
            Tranzakció és párosított számla adatai
          </DialogDescription>
        </DialogHeader>

        {/* Transaction Details - Compact */}
        <Card className="bg-muted/30 border-border/50">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-medium flex items-center justify-between">
              <span>Tranzakció</span>
              {matchStatus === 'matched' && (
                <Badge variant="success" className="gap-1 text-[10px] h-5">
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  Párosított
                </Badge>
              )}
              {matchStatus === 'suggested' && (
                <Badge variant="warning" className="gap-1 text-[10px] h-5">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  Javasolt
                </Badge>
              )}
              {matchStatus === 'unmatched' && (
                <Badge variant="destructive" className="gap-1 text-[10px] h-5">
                  <HelpCircle className="h-2.5 w-2.5" />
                  Párosítatlan
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Dátum:</span>
                <span className="ml-1 font-medium">
                  {format(new Date(transaction.transaction_date), 'yyyy.MM.dd')}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Összeg:</span>
                <span className={cn(
                  "ml-1 font-medium font-mono",
                  transaction.amount >= 0 ? "text-success" : "text-destructive"
                )}>
                  {formatCurrency(transaction.amount, transaction.currency || 'HUF')}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Leírás:</span>
                <span className="ml-1">{transaction.description || '-'}</span>
              </div>
              {transaction.reason && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">AI indoklás:</span>
                  <p className="mt-1 text-[10px] bg-background/50 p-1.5 rounded border border-border/30 line-clamp-2">
                    {transaction.reason}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Separator className="my-1" />

        {/* Matched Invoice Section - Simplified */}
        {transaction.matched_invoice_id && !showManualMatch && (
          <>
            <Card 
              className="bg-muted/30 border-border/50 cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => {
                if (matchedInvoice) {
                  setInvoiceDetailId(matchedInvoice.id);
                  setInvoiceDetailOpen(true);
                }
              }}
            >
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-xs font-medium flex items-center justify-between">
                  <span>Párosított számla</span>
                  {matchedInvoice && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      Kattints a részletekért
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                {loadingInvoice ? (
                  <div className="flex items-center justify-center py-2">
                    <LoadingSpinner />
                  </div>
                ) : matchedInvoice ? (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Számlaszám:</span>
                      <span className="ml-1 font-mono font-medium">{matchedInvoice.szamlaszam || '-'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Eladó:</span>
                      <span className="ml-1 font-medium">{matchedInvoice.elado_nev || '-'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Vevő:</span>
                      <span className="ml-1 font-medium">{matchedInvoice.vevo_nev || '-'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Kiállítás:</span>
                      <span className="ml-1">
                        {matchedInvoice.kibocsatas_datuma 
                          ? format(new Date(matchedInvoice.kibocsatas_datuma), 'yyyy.MM.dd')
                          : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Bruttó:</span>
                      <span className="ml-1 font-mono font-medium">
                        {formatCurrency(matchedInvoice.brutto_vegosszeg || 0, matchedInvoice.penznem || 'HUF')}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-xs">Számla nem található</p>
                )}
              </CardContent>
            </Card>

            <DialogFooter className="flex-row gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={handleUnmatch} disabled={saving} className="text-xs h-8">
                Párosítás megszüntetése
              </Button>
              <Button variant="outline" size="sm" onClick={handleShowManualMatch} className="text-xs h-8">
                <Link2 className="h-3 w-3 mr-1" />
                Másik számla
              </Button>
              {matchStatus === 'suggested' && (
                <Button size="sm" onClick={handleVerify} disabled={saving} className="text-xs h-8">
                  <Check className="h-3 w-3 mr-1" />
                  {saving ? 'Mentés...' : 'Rendben'}
                </Button>
              )}
            </DialogFooter>
          </>
        )}

        {/* Manual Match Section - Compact */}
        {(showManualMatch || !transaction.matched_invoice_id) && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-medium">
                  {transaction.matched_invoice_id ? 'Másik számla választása' : 'Manuális párosítás'}
                </h4>
                {transaction.matched_invoice_id && (
                  <Button variant="ghost" size="sm" onClick={() => setShowManualMatch(false)} className="h-6 text-xs">
                    Vissza
                  </Button>
                )}
              </div>

              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  placeholder="Keresés..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-7 h-8 text-xs"
                />
              </div>

              <div className="max-h-[180px] overflow-y-auto border rounded-md">
                {loadingAvailable ? (
                  <div className="flex items-center justify-center h-20">
                    <LoadingSpinner />
                  </div>
                ) : filteredInvoices.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-20 text-muted-foreground">
                    <FileText className="h-5 w-5 mb-1" />
                    <p className="text-xs">Nincs találat</p>
                  </div>
                ) : (
                  <div className="p-1.5 space-y-1">
                    {filteredInvoices.slice(0, 5).map((invoice) => {
                      const isSelected = selectedInvoiceId === invoice.id;
                      const isExactMatch = Math.abs((invoice.brutto_vegosszeg || 0) - transactionAmount) < 1;

                      return (
                        <Card
                          key={invoice.id}
                          className={cn(
                            "cursor-pointer transition-colors p-2",
                            isSelected ? "border-primary bg-primary/10" : "hover:bg-muted/50",
                            isExactMatch && "border-success/50"
                          )}
                          onClick={() => setSelectedInvoiceId(invoice.id)}
                        >
                          <div className="flex justify-between items-center text-xs">
                            <div>
                              <p className="font-medium font-mono">{invoice.szamlaszam}</p>
                              <p className="text-muted-foreground text-[10px]">
                                {invoice.elado_nev || '-'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-mono font-medium">
                                {formatCurrency(invoice.brutto_vegosszeg || 0, invoice.penznem || 'HUF')}
                              </p>
                              {isExactMatch && (
                                <Badge variant="success" className="text-[9px] h-4">Egyező összeg</Badge>
                              )}
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                size="sm"
                disabled={!selectedInvoiceId || saving}
                onClick={handleMatch}
                className="text-xs h-8"
              >
                <Check className="h-3 w-3 mr-1" />
                {saving ? 'Mentés...' : 'Párosítás mentése'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>

    <InvoiceDetailPopup
      open={invoiceDetailOpen}
      onOpenChange={setInvoiceDetailOpen}
      invoiceId={invoiceDetailId}
    />
    </>
  );
};
