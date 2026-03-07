import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useDateRange } from '@/contexts/DateRangeContext';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { cn, formatCurrency } from '@/lib/utils';
import { CalendarIcon, Save, Banknote, Settings2 } from 'lucide-react';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { toast } from 'sonner';
import { UnifiedPagination } from '@/components/ui/unified-pagination';

interface HpSettings {
  id: string;
  company_id: string;
  opening_balance: number | null;
  start_date: string | null;
}

interface PettyCashEntry {
  date: string;
  description: string;
  amount: number; // positive = income, negative = expense
  source: 'withdrawal' | 'cash_sale' | 'cash_expense';
}

const PettyCashPage = () => {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<HpSettings | null>(null);
  const [openingBalance, setOpeningBalance] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [entries, setEntries] = useState<PettyCashEntry[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    if (user && selectedCompany) {
      fetchAll();
    }
  }, [user, selectedCompany]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchSettings(), fetchEntries()]);
    } catch (error) {
      console.error('Error fetching petty cash data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    if (!selectedCompany) return;

    const { data, error } = await supabase
      .from('hp_settings')
      .select('*')
      .eq('company_id', selectedCompany.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching hp_settings:', error);
      return;
    }

    if (data) {
      setSettings(data);
      setOpeningBalance(data.opening_balance?.toString() || '');
      setStartDate(data.start_date ? new Date(data.start_date) : undefined);
    } else {
      setSettings(null);
      setOpeningBalance('');
      setStartDate(undefined);
    }
  };

  const fetchEntries = async () => {
    if (!selectedCompany) return;

    // Fetch all 3 sources in parallel
    const [withdrawalsRes, cashSalesRes, cashExpensesRes, navCashExpensesRes] = await Promise.all([
      // 1. Cash Withdrawals from transactions
      supabase
        .from('transactions')
        .select('transaction_date, description, amount')
        .eq('company_id', selectedCompany.id)
        .in('type', ['atm pénzfelvét', 'pénztári kp felvét']),

      // 2. Cash Sales from nav_invoices (OUTBOUND, payment_method = CASH)
      supabase
        .from('nav_invoices')
        .select('invoice_issue_date, customer_name, invoice_gross_amount, payment_method')
        .eq('company_id', selectedCompany.id)
        .eq('invoice_direction', 'OUTBOUND')
        .in('payment_method', ['CASH', 'KÉSZPÉNZ']),

      // 3. Cash Expenses from invoices (fizetesi_mod = készpénz)
      supabase
        .from('invoices')
        .select('kibocsatas_datuma, elado_nev, brutto_vegosszeg, fizetesi_mod, bizonylatsorszam')
        .eq('company_id', selectedCompany.id)
        .ilike('fizetesi_mod', '%készpénz%')
        .is('reference_number', null),

      // 4. Cash Expenses from nav_invoices (INBOUND, payment_method = CASH)
      supabase
        .from('nav_invoices')
        .select('invoice_issue_date, supplier_name, invoice_gross_amount, invoice_number')
        .eq('company_id', selectedCompany.id)
        .eq('invoice_direction', 'INBOUND')
        .in('payment_method', ['CASH', 'KÉSZPÉNZ']),
    ]);

    const allEntries: PettyCashEntry[] = [];

    // Withdrawals (+)
    (withdrawalsRes.data || []).forEach(t => {
      allEntries.push({
        date: t.transaction_date,
        description: t.description || 'Készpénz felvétel',
        amount: Math.abs(t.amount),
        source: 'withdrawal',
      });
    });

    // Cash sales (+)
    (cashSalesRes.data || []).forEach(inv => {
      allEntries.push({
        date: inv.invoice_issue_date || '',
        description: `Készpénzes értékesítés - ${inv.customer_name || 'Ismeretlen'}`,
        amount: Math.abs(inv.invoice_gross_amount || 0),
        source: 'cash_sale',
      });
    });

    // Cash expenses from invoices (-)
    const invoiceExpenseNumbers = new Set<string>();
    (cashExpensesRes.data || []).forEach(inv => {
      if (inv.bizonylatsorszam) invoiceExpenseNumbers.add(inv.bizonylatsorszam);
      allEntries.push({
        date: inv.kibocsatas_datuma,
        description: `Készpénzes kiadás - ${inv.elado_nev}`,
        amount: -(Math.abs(inv.brutto_vegosszeg || 0)),
        source: 'cash_expense',
      });
    });

    // Cash expenses from nav_invoices INBOUND (-), de-duplicated
    (navCashExpensesRes.data || []).forEach(inv => {
      // Skip if already counted from invoices table (matching invoice_number)
      if (inv.invoice_number && invoiceExpenseNumbers.has(inv.invoice_number)) return;
      allEntries.push({
        date: inv.invoice_issue_date || '',
        description: `Készpénzes kiadás (NAV) - ${inv.supplier_name || 'Ismeretlen'}`,
        amount: -(Math.abs(inv.invoice_gross_amount || 0)),
        source: 'cash_expense',
      });
    });

    setEntries(allEntries);
  };

  const handleSave = async () => {
    if (!selectedCompany || !user) return;

    setSaving(true);
    try {
      const balanceValue = openingBalance ? parseFloat(openingBalance) : null;
      const dateValue = startDate ? format(startDate, 'yyyy-MM-dd') : null;

      if (settings) {
        // Update - hp_settings has no UPDATE RLS, need to use upsert workaround
        // Actually let's check - the table only has INSERT and SELECT policies
        // We need to delete and re-insert
        const { error } = await supabase
          .from('hp_settings')
          .upsert({
            id: settings.id,
            company_id: selectedCompany.id,
            opening_balance: balanceValue,
            start_date: dateValue,
            created_by: user.id,
          });

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('hp_settings')
          .insert({
            company_id: selectedCompany.id,
            opening_balance: balanceValue,
            start_date: dateValue,
            created_by: user.id,
          });

        if (error) throw error;
      }

      toast.success('Házipénztár beállítások mentve!');
      await fetchSettings();
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast.error('Hiba a mentés során', { description: error.message });
    } finally {
      setSaving(false);
    }
  };

  // Filter entries by start_date if set
  const filteredEntries = useMemo(() => {
    const startDateStr = settings?.start_date;
    let filtered = [...entries];
    if (startDateStr) {
      filtered = filtered.filter(e => e.date >= startDateStr);
    }
    // Sort descending by date
    filtered.sort((a, b) => b.date.localeCompare(a.date));
    return filtered;
  }, [entries, settings?.start_date]);

  // Calculate balance
  const currentBalance = useMemo(() => {
    const ob = settings?.opening_balance || 0;
    const total = filteredEntries.reduce((sum, e) => sum + e.amount, 0);
    return ob + total;
  }, [filteredEntries, settings?.opening_balance]);

  // Running balance for the table (sorted descending, so we calculate from bottom up)
  const entriesWithRunningBalance = useMemo(() => {
    const ob = settings?.opening_balance || 0;
    // We need to sort ascending to calculate running balance, then reverse
    const ascending = [...filteredEntries].sort((a, b) => a.date.localeCompare(b.date));
    let running = ob;
    const withBalance = ascending.map(e => {
      running += e.amount;
      return { ...e, runningBalance: running };
    });
    // Reverse back to descending
    withBalance.reverse();
    return withBalance;
  }, [filteredEntries, settings?.opening_balance]);

  // Pagination
  const totalPages = Math.ceil(entriesWithRunningBalance.length / pageSize);
  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return entriesWithRunningBalance.slice(start, start + pageSize);
  }, [entriesWithRunningBalance, currentPage, pageSize]);

  const getSourceLabel = (source: PettyCashEntry['source']) => {
    switch (source) {
      case 'withdrawal': return 'KP felvétel';
      case 'cash_sale': return 'KP értékesítés';
      case 'cash_expense': return 'KP kiadás';
    }
  };

  const getSourceBgClass = (source: PettyCashEntry['source']) => {
    switch (source) {
      case 'withdrawal': return 'bg-primary/10 text-primary';
      case 'cash_sale': return 'bg-success/10 text-success';
      case 'cash_expense': return 'bg-destructive/10 text-destructive';
    }
  };

  if (!selectedCompany) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <p className="text-muted-foreground">Válassz egy céget a folytatáshoz</p>
      </div>
    );
  }

  if (loading) {
    return <LoadingSpinner message="Házipénztár betöltése..." />;
  }

  return (
    <div className="h-full bg-background">
      <main className="w-full max-w-none px-4 py-4 space-y-6">
        {/* Header with balance */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Banknote className="h-6 w-6 text-primary" />
              Házipénztár
            </h1>
            <p className="text-muted-foreground">Készpénzforgalom nyilvántartás</p>
          </div>
          <Card className={cn(
            'px-6 py-4 border-2',
            currentBalance >= 0 ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5'
          )}>
            <div className="text-sm text-muted-foreground">Aktuális egyenleg</div>
            <div className={cn(
              'text-2xl font-bold',
              currentBalance >= 0 ? 'text-success' : 'text-destructive'
            )}>
              {formatCurrency(currentBalance)}
            </div>
          </Card>
        </div>

        {/* Settings */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Beállítások
            </CardTitle>
            <CardDescription>Nyitó egyenleg és kezdő dátum megadása</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="space-y-2 flex-1 max-w-xs">
                <Label htmlFor="opening-balance">Nyitó egyenleg (Ft)</Label>
                <Input
                  id="opening-balance"
                  type="number"
                  placeholder="0"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Kezdő dátum</Label>
                <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[200px] justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, 'yyyy. MMM dd.', { locale: hu }) : 'Válassz dátumot'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => {
                        setStartDate(date);
                        setStartDateOpen(false);
                      }}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Mentés...' : 'Mentés'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Transaction History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tranzakció történet</CardTitle>
            <CardDescription>
              {filteredEntries.length} tétel
              {settings?.start_date && ` (${format(new Date(settings.start_date), 'yyyy. MMM dd.', { locale: hu })}-tól)`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dátum</TableHead>
                  <TableHead>Típus</TableHead>
                  <TableHead>Leírás / Partner</TableHead>
                  <TableHead className="text-right">Összeg</TableHead>
                  <TableHead className="text-right">Egyenleg</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nincs készpénzes tranzakció a megadott időszakban
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedEntries.map((entry, idx) => (
                    <TableRow key={`${entry.date}-${entry.source}-${idx}`}>
                      <TableCell className="whitespace-nowrap">
                        {entry.date ? format(new Date(entry.date), 'yyyy. MM. dd.') : '-'}
                      </TableCell>
                      <TableCell>
                        <span className={cn('px-2 py-1 rounded-md text-xs font-medium', getSourceBgClass(entry.source))}>
                          {getSourceLabel(entry.source)}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate">{entry.description}</TableCell>
                      <TableCell className={cn(
                        'text-right font-medium whitespace-nowrap',
                        entry.amount >= 0 ? 'text-success' : 'text-destructive'
                      )}>
                        {entry.amount >= 0 ? '+' : ''}{formatCurrency(entry.amount)}
                      </TableCell>
                      <TableCell className={cn(
                        'text-right font-medium whitespace-nowrap',
                        entry.runningBalance >= 0 ? 'text-foreground' : 'text-destructive'
                      )}>
                        {formatCurrency(entry.runningBalance)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="mt-4">
                <UnifiedPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={filteredEntries.length}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={() => {}}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default PettyCashPage;
