import { useState, useEffect, useMemo } from 'react';
import { computeMatchStatus, getPaymentStatusBadge } from '@/hooks/useComputedStatus';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Search, Check, AlertTriangle, FileText, CheckCircle2, HelpCircle, Link2, Eye, Wallet, Package } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { format, subDays, addDays } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { useScopedNavigate } from '@/lib/navigation';
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

// Matched invoice from the 'nav_invoices' table
interface MatchedNavInvoice {
  id: string;
  invoice_number: string;
  invoice_issue_date: string | null;
  supplier_name: string | null;
  customer_name: string | null;
  invoice_gross_amount: number | null;
  currency: string | null;
  invoice_direction: string | null;
  transaction_id: string | null;
  submitted: boolean | null;
}

// Matched salary record
interface MatchedSalary {
  id: string;
  név: string;
  összeg: number;
  tipus: string;
  fizetesi_mod: string;
  transaction_id: string | null;
  dátum: string | null;
  munkavallalo_neve: string | null;
  megjegyzes: string | null;
}

// Matched courier report
interface MatchedCourierReport {
  id: string;
  report_type: string;
  package_number: string | null;
  reference_number: string | null;
  delivery_date: string | null;
  cod_amount: number | null;
  recipient_name: string | null;
  match_status: string;
  match_confidence: number | null;
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
  const scopedNavigate = useScopedNavigate();
  const [matchedInvoice, setMatchedInvoice] = useState<MatchedInvoice | null>(null);
  const [matchedNavInvoice, setMatchedNavInvoice] = useState<MatchedNavInvoice | null>(null);
  const [matchedSalary, setMatchedSalary] = useState<MatchedSalary | null>(null);
  const [matchedCourierReports, setMatchedCourierReports] = useState<MatchedCourierReport[]>([]);
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
      
      // Always fetch courier reports for this transaction
      fetchCourierReports();
      
      if (transaction.matched_invoice_id) {
        fetchMatchedInvoice();
      } else {
        setMatchedInvoice(null);
        setMatchedNavInvoice(null);
        // Auto-load available invoices for unmatched transactions
        fetchAvailableInvoices();
      }
    }
  }, [open, transaction]);

  // Fetch matched invoice - try 'invoices' first, then fallback to 'nav_invoices'
  const fetchMatchedInvoice = async () => {
    if (!transaction?.matched_invoice_id) return;
    
    setLoadingInvoice(true);
    setMatchedNavInvoice(null);
    setMatchedInvoice(null);
    setMatchedSalary(null);
    try {
      // Try invoices table first
      const { data, error } = await supabase
        .from('invoices')
        .select('id, bizonylatsorszam, kibocsatas_datuma, teljesites_datuma, elado_nev, vevo_nev, brutto_vegosszeg, penznem, invoice_type')
        .eq('id', transaction.matched_invoice_id)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setMatchedInvoice(data);
      } else {
        // Fallback: try nav_invoices table
        const { data: navData, error: navError } = await supabase
          .from('nav_invoices')
          .select('id, invoice_number, invoice_issue_date, supplier_name, customer_name, invoice_gross_amount, currency, invoice_direction, transaction_id, submitted')
          .eq('id', transaction.matched_invoice_id)
          .maybeSingle();

        if (navError) throw navError;
        
        if (navData) {
          setMatchedNavInvoice(navData);
        } else {
          // Fallback: try salary table
          const { data: salaryData, error: salaryError } = await supabase
            .from('salary')
            .select('id, "név", "összeg", tipus, fizetesi_mod, statusz, "dátum", munkavallalo_neve, megjegyzes, kifizetes_ideje, transaction_id')
            .eq('id', transaction.matched_invoice_id)
            .maybeSingle();

          if (salaryError) throw salaryError;
          if (salaryData) {
            setMatchedSalary({
              id: salaryData.id,
              név: salaryData['név'],
              összeg: salaryData['összeg'],
              tipus: salaryData.tipus,
              fizetesi_mod: salaryData.fizetesi_mod,
              transaction_id: salaryData.transaction_id,
              dátum: salaryData['dátum'],
              munkavallalo_neve: salaryData.munkavallalo_neve,
              megjegyzes: salaryData.megjegyzes,
            });
          }
        }
      }
    } catch (error) {
      console.error('Error fetching matched invoice:', error);
      setMatchedInvoice(null);
      setMatchedNavInvoice(null);
    } finally {
      setLoadingInvoice(false);
    }
  };

  // Fetch courier reports matched to this transaction
  const fetchCourierReports = async () => {
    if (!transaction) return;
    try {
      const { data, error } = await supabase
        .from('courier_reports')
        .select('id, report_type, package_number, reference_number, delivery_date, cod_amount, recipient_name, match_status, match_confidence')
        .eq('matched_transaction_id', transaction.id);

      if (error) throw error;
      setMatchedCourierReports(data || []);
    } catch (error) {
      console.error('Error fetching courier reports:', error);
      setMatchedCourierReports([]);
    }
  };

  const fetchAvailableInvoices = async () => {
    if (!transaction || !companyId) return;

    setLoadingAvailable(true);
    try {
      const transactionDate = new Date(transaction.transaction_date);
      const dateFrom = format(subDays(transactionDate, 60), 'yyyy-MM-dd');
      const dateTo = format(addDays(transactionDate, 14), 'yyyy-MM-dd');
      const txAmount = Math.abs(transaction.amount);

      // 1. Fetch from invoices table
      const { data: invoices } = await supabase
        .from('invoices')
        .select('id, bizonylatsorszam, brutto_vegosszeg, elado_nev, penznem, kibocsatas_datuma')
        .eq('company_id', companyId)
        .gte('kibocsatas_datuma', dateFrom)
        .lte('kibocsatas_datuma', dateTo)
        .order('kibocsatas_datuma', { ascending: false })
        .limit(100);

      // 2. Fetch from nav_invoices table
      const { data: navInvoices } = await supabase
        .from('nav_invoices')
        .select('id, invoice_number, invoice_gross_amount, supplier_name, customer_name, currency, invoice_issue_date, invoice_direction')
        .eq('company_id', companyId)
        .gte('invoice_issue_date', dateFrom)
        .lte('invoice_issue_date', dateTo)
        .is('transaction_id', null)
        .order('invoice_issue_date', { ascending: false })
        .limit(100);

      // 3. Combine into unified list
      const combined: AvailableInvoice[] = [];

      for (const inv of (invoices || [])) {
        // Check already paid amounts
        const { data: matchedTx } = await supabase
          .from('transactions')
          .select('amount')
          .eq('matched_invoice_id', inv.id)
          .eq('is_verified', true);

        const alreadyPaid = matchedTx?.reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0;
        const invoiceAmount = Math.abs(inv.brutto_vegosszeg || 0);

        combined.push({
          id: inv.id,
          bizonylatsorszam: inv.bizonylatsorszam,
          brutto_vegosszeg: inv.brutto_vegosszeg,
          elado_nev: inv.elado_nev,
          penznem: inv.penznem,
          kibocsatas_datuma: inv.kibocsatas_datuma,
          already_paid: alreadyPaid,
          remaining: invoiceAmount - alreadyPaid,
        });
      }

      for (const nav of (navInvoices || [])) {
        combined.push({
          id: nav.id,
          bizonylatsorszam: nav.invoice_number,
          brutto_vegosszeg: nav.invoice_gross_amount || 0,
          elado_nev: nav.supplier_name || nav.customer_name || '',
          penznem: nav.currency,
          kibocsatas_datuma: nav.invoice_issue_date || '',
          already_paid: 0,
          remaining: Math.abs(nav.invoice_gross_amount || 0),
        });
      }

      // 4. Sort: exact matches first, then by amount proximity (raw values, no abs)
      combined.sort((a, b) => {
        const diffA = Math.abs((a.brutto_vegosszeg || 0) - txAmount);
        const diffB = Math.abs((b.brutto_vegosszeg || 0) - txAmount);
        return diffA - diffB;
      });

      setAvailableInvoices(combined);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast({ title: 'Hiba a számlák betöltésekor', variant: 'destructive' });
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

      toast({ title: 'Tranzakció jóváhagyva!' });
      onUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error('Error verifying transaction:', error);
      toast({ title: 'Hiba a jóváhagyás során', variant: 'destructive' });
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

      toast({ title: 'Tranzakció sikeresen párosítva!' });
      onUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error('Error matching transaction:', error);
      toast({ title: 'Hiba a párosítás mentésekor', variant: 'destructive' });
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

      toast({ title: 'Párosítás megszüntetve!' });
      onUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error('Error unmatching transaction:', error);
      toast({ title: 'Hiba a párosítás megszüntetésekor', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Approximate exchange rates for frontend filtering only
  const approxRates: Record<string, number> = { EUR: 395, USD: 370, GBP: 470, CHF: 420 };
  const toHuf = (amount: number, currency?: string) => {
    const ccy = (currency || 'HUF').toUpperCase();
    if (ccy !== 'HUF' && approxRates[ccy]) return amount * approxRates[ccy];
    return amount;
  };

  const filteredInvoices = useMemo(() => {
    const txAmt = Math.abs(transaction?.amount || 0);
    let list = availableInvoices;

    // When no search: only show invoices within tolerance of transaction amount
    if (!search) {
      if (txAmt > 0) {
        list = list.filter(inv => {
          const invHuf = Math.abs(toHuf(inv.brutto_vegosszeg || 0, inv.penznem));
          const diff = Math.abs(invHuf - txAmt);
          // Use wider tolerance (50%) for cross-currency, 30% for same currency
          const isCrossCurrency = (inv.penznem || 'HUF').toUpperCase() !== (transaction?.currency || 'HUF').toUpperCase();
          const tolerance = isCrossCurrency ? 0.50 : 0.30;
          return diff / txAmt <= tolerance;
        });
      }
      return list;
    }

    // When searching: match text, no amount filter
    const searchLower = search.toLowerCase();
    return availableInvoices.filter(inv =>
      inv.bizonylatsorszam.toLowerCase().includes(searchLower) ||
      inv.elado_nev?.toLowerCase().includes(searchLower) ||
      inv.brutto_vegosszeg?.toString().includes(search)
    );
  }, [availableInvoices, search, transaction?.amount, transaction?.currency]);

  const transactionAmount = transaction?.amount || 0;
  const matchStatus = transaction ? computeMatchStatus(transaction) : 'unmatched';

  if (!transaction) return null;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Tranzakció részletei
          </DialogTitle>
          <DialogDescription className="text-xs">
            Tranzakció és párosított számla adatai
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
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
                  <p className="mt-1 text-[10px] bg-background/50 p-1.5 rounded border border-border/30 max-h-[80px] overflow-y-auto">
                    {transaction.reason}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Matched Courier Reports */}
        {matchedCourierReports.length > 0 && (
          <>
            <Separator className="my-1" />
            <Card className="bg-muted/30 border-border/50">
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-xs font-medium flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5" />
                    Futár riport
                  </span>
                  <Badge variant="outline" className="text-[10px] h-5">
                    {matchedCourierReports.length} tétel
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {matchedCourierReports.map((report) => (
                    <div key={report.id} className="rounded-md border border-border/50 bg-background/50 p-2.5 text-xs">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-medium font-mono">
                          {report.package_number || 'Összesítő sor'}
                        </span>
                        <Badge variant="outline" className={cn(
                          "text-[10px] h-4",
                          report.report_type === 'gls' && 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30',
                          report.report_type === 'mpl' && 'bg-blue-500/10 text-blue-700 border-blue-500/30',
                          report.report_type === 'mixpack' && 'bg-purple-500/10 text-purple-700 border-purple-500/30'
                        )}>
                          {report.report_type === 'gls' ? 'GLS' : report.report_type === 'mpl' ? 'MPL / Posta' : 'Mixpack'}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-[11px]">
                        {report.reference_number && (
                          <div>
                            <span className="text-muted-foreground">Hivatkozás:</span>
                            <span className="ml-1 font-mono">{report.reference_number}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-muted-foreground">Kézbesítés:</span>
                          <span className="ml-1">
                            {report.delivery_date
                              ? format(new Date(report.delivery_date), 'yyyy.MM.dd')
                              : '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Utánvét:</span>
                          <span className="ml-1 font-mono font-medium">
                            {report.cod_amount != null
                              ? formatCurrency(report.cod_amount)
                              : '-'}
                          </span>
                        </div>
                        {report.recipient_name && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Címzett:</span>
                            <span className="ml-1">{report.recipient_name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <Separator className="my-1" />

        {/* Matched Invoice Section - Simplified */}
        {transaction.matched_invoice_id && !showManualMatch && (
          <>
            <Card 
              className={cn(
                "bg-muted/30 border-border/50 transition-colors",
                (matchedInvoice || matchedSalary) && "cursor-pointer hover:border-primary/50"
              )}
              onClick={() => {
                if (matchedInvoice) {
                  setInvoiceDetailId(matchedInvoice.id);
                  setInvoiceDetailOpen(true);
                } else if (matchedSalary) {
                  onOpenChange(false);
                  scopedNavigate('salaries');
                }
              }}
            >
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-xs font-medium flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    {matchedSalary ? <Wallet className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                    {matchedSalary ? 'Párosított bértétel' : matchedNavInvoice ? 'Párosított NAV számla' : 'Párosított számla'}
                  </span>
                  {(matchedInvoice || matchedSalary) && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {matchedSalary ? 'Kattints a bérek oldalhoz' : 'Kattints a részletekért'}
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
                      <span className="text-muted-foreground">Bizonylatsorszám:</span>
                      <span className="ml-1 font-mono font-medium">{matchedInvoice.bizonylatsorszam || '-'}</span>
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
                ) : matchedNavInvoice ? (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Számlaszám:</span>
                      <span className="ml-1 font-mono font-medium">{matchedNavInvoice.invoice_number}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Szállító:</span>
                      <span className="ml-1 font-medium">{matchedNavInvoice.supplier_name || '-'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Vevő:</span>
                      <span className="ml-1 font-medium">{matchedNavInvoice.customer_name || '-'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Kiállítás:</span>
                      <span className="ml-1">
                        {matchedNavInvoice.invoice_issue_date 
                          ? format(new Date(matchedNavInvoice.invoice_issue_date), 'yyyy.MM.dd')
                          : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Bruttó:</span>
                      <span className="ml-1 font-mono font-medium">
                        {formatCurrency(matchedNavInvoice.invoice_gross_amount || 0, matchedNavInvoice.currency || 'HUF')}
                      </span>
                    </div>
                    <div className="col-span-2 flex gap-1">
                      {matchedNavInvoice.invoice_direction && (
                        <Badge variant="outline" className="text-[10px] h-5">
                          {matchedNavInvoice.invoice_direction === 'INBOUND' ? 'Bejövő' : 'Kimenő'}
                        </Badge>
                      )}
                      {!!matchedNavInvoice.transaction_id && (
                        <Badge variant="success" className="text-[10px] h-5">Fizetve</Badge>
                      )}
                      {matchedNavInvoice.submitted && (
                        <Badge variant="outline" className="text-[10px] h-5">Beküldve</Badge>
                      )}
                    </div>
                  </div>
                ) : matchedSalary ? (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Megnevezés:</span>
                      <span className="ml-1 font-medium">{matchedSalary.név}</span>
                    </div>
                    {matchedSalary.munkavallalo_neve && (
                      <div>
                        <span className="text-muted-foreground">Munkavállaló:</span>
                        <span className="ml-1 font-medium">{matchedSalary.munkavallalo_neve}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground">Típus:</span>
                      <span className="ml-1">{matchedSalary.tipus}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Dátum:</span>
                      <span className="ml-1">
                        {matchedSalary.dátum 
                          ? format(new Date(matchedSalary.dátum), 'yyyy.MM.dd')
                          : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Összeg:</span>
                      <span className="ml-1 font-mono font-medium">
                        {formatCurrency(matchedSalary.összeg)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Fizetési mód:</span>
                      <span className="ml-1">{matchedSalary.fizetesi_mod}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Státusz:</span>
                      {(() => {
                        const badge = getPaymentStatusBadge(matchedSalary.transaction_id);
                        return <Badge variant="outline" className={cn("ml-1 text-[10px] h-5", badge.className)}>{badge.label}</Badge>;
                      })()}
                    </div>
                    {matchedSalary.megjegyzes && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Megjegyzés:</span>
                        <span className="ml-1">{matchedSalary.megjegyzes}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 py-1">
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-amber-500">Törölt bizonylat</p>
                      <p className="text-[10px] text-muted-foreground">A párosított bizonylat már nem létezik az adatbázisban (árva hivatkozás).</p>
                    </div>
                  </div>
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

        {/* Manual Match Section - Smart Matching */}
        {(showManualMatch || !transaction.matched_invoice_id) && (
          <>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-medium flex items-center gap-1.5">
                    <Link2 className="h-3.5 w-3.5 text-primary" />
                    {transaction.matched_invoice_id ? 'Másik számla választása' : 'Manuális párosítás'}
                  </h4>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Összeg alapján rendezve · keresett: <span className="font-mono font-medium">{formatCurrency(transactionAmount, transaction.currency || 'HUF')}</span>
                  </p>
                </div>
                {transaction.matched_invoice_id && (
                  <Button variant="ghost" size="sm" onClick={() => setShowManualMatch(false)} className="h-6 text-xs">
                    Vissza
                  </Button>
                )}
              </div>

              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder={`Keresés számlaszám, partner vagy összeg alapján...`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-xs"
                  autoFocus
                />
              </div>

              {/* Results count */}
              {!loadingAvailable && filteredInvoices.length > 0 && (
                <div className="flex items-center justify-between text-[10px] text-muted-foreground px-0.5">
                  <span>{filteredInvoices.length} számla az időszakban (±60 nap)</span>
                </div>
              )}

              <div className="max-h-[240px] overflow-y-auto border rounded-md">
                {loadingAvailable ? (
                  <div className="flex items-center justify-center h-20">
                    <LoadingSpinner />
                  </div>
                ) : filteredInvoices.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-20 text-muted-foreground">
                    <FileText className="h-5 w-5 mb-1" />
                    <p className="text-xs">{search ? 'Nincs találat a keresésre' : 'Nincs elérhető számla az időszakban'}</p>
                  </div>
                ) : (
                  <div className="p-1.5 space-y-1">
                    {filteredInvoices.map((invoice) => {
                      const isSelected = selectedInvoiceId === invoice.id;
                      const invoiceAmt = invoice.brutto_vegosszeg || 0;
                      const diff = invoiceAmt - transactionAmount;
                      const absDiff = Math.abs(diff);
                      const isExact = absDiff < 1;
                      const isNear = !isExact && absDiff < Math.abs(transactionAmount) * 0.05;
                      const pctDiff = transactionAmount !== 0 ? (absDiff / Math.abs(transactionAmount) * 100) : 0;

                      const partnerName = invoice.elado_nev?.toLowerCase() || '';
                      const txDesc = transaction.description?.toLowerCase() || '';
                      const cleanPartnerName = partnerName.replace(/\b(kft|zrt|bt|s\.r\.o\.|ev\.)\b/g, '').trim();
                      const hasPartnerMatch = cleanPartnerName.length > 2 && txDesc.includes(cleanPartnerName);

                      return (
                        <div
                          key={invoice.id}
                          className={cn(
                            "rounded-md border p-2.5 cursor-pointer transition-all",
                            isSelected
                              ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                              : "hover:bg-muted/40 hover:border-border",
                            isExact && !isSelected && "border-emerald-500/40 bg-emerald-500/5",
                            isNear && !isSelected && "border-amber-500/30 bg-amber-500/5"
                          )}
                          onClick={() => setSelectedInvoiceId(invoice.id)}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                {isSelected && <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />}
                                <p className="font-medium font-mono text-xs truncate">{invoice.bizonylatsorszam}</p>
                              </div>
                              <p className="text-muted-foreground text-[10px] mt-0.5 truncate flex items-center gap-1.5">
                                <span className="truncate">{invoice.elado_nev || '-'}</span>
                                {hasPartnerMatch && (
                                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[8px] h-3.5 px-1 font-semibold leading-none shrink-0 hover:bg-emerald-500/10">
                                    Partner egyezik
                                  </Badge>
                                )}
                              </p>
                              <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                                {invoice.kibocsatas_datuma ? format(new Date(invoice.kibocsatas_datuma), 'yyyy.MM.dd') : ''}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-mono font-medium text-xs">
                                {formatCurrency(invoice.brutto_vegosszeg || 0, invoice.penznem || 'HUF')}
                              </p>
                              {isExact ? (
                                <Badge variant="success" className="text-[9px] h-4 mt-0.5">✓ Egyező</Badge>
                              ) : isNear ? (
                                <Badge className="text-[9px] h-4 mt-0.5 bg-amber-500/20 text-amber-600 border-amber-500/30 hover:bg-amber-500/20">
                                  ~{pctDiff.toFixed(0)}% elt.
                                </Badge>
                              ) : (
                                <span className="text-[10px] text-muted-foreground/60 mt-0.5 block">
                                  {diff > 0 ? '+' : ''}{formatCurrency(diff, invoice.penznem || 'HUF')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
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
        </div>
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
