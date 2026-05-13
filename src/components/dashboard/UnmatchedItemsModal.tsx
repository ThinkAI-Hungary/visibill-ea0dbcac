import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { useDateRange } from '@/contexts/DateRangeContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileX2, ArrowDownLeft, ArrowUpRight, Unlink } from 'lucide-react';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';

interface UnmatchedNavInvoice {
  id: string;
  invoice_number: string;
  invoice_direction: string | null;
  invoice_issue_date: string | null;
  supplier_name: string | null;
  customer_name: string | null;
  invoice_gross_amount: number | null;
  currency: string | null;
  payment_method: string | null;
}

interface UnmatchedTransaction {
  id: string;
  transaction_date: string;
  amount: number;
  description: string | null;
  currency: string | null;
  type: string | null;
}

const fetchAllUnmatchedNav = async (companyId: string, dateFrom: string, dateTo: string) => {
  const PAGE_SIZE = 1000;
  const all: UnmatchedNavInvoice[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('nav_invoices')
      .select('id, invoice_number, invoice_direction, invoice_issue_date, supplier_name, customer_name, invoice_gross_amount, currency, payment_method')
      .eq('company_id', companyId)
      .is('transaction_id', null)
      .gte('invoice_issue_date', dateFrom)
      .lte('invoice_issue_date', dateTo)
      .order('invoice_issue_date', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
};

const UnmatchedSection = () => {
  const { selectedCompany } = useCompany();
  const { dateFromFormatted, dateToFormatted } = useDateRange();
  const companyId = selectedCompany?.id || '';

  const [activeTab, setActiveTab] = useState<'nav' | 'transactions'>('nav');
  const [visibleNavCount, setVisibleNavCount] = useState(20);
  const [visibleTxCount, setVisibleTxCount] = useState(20);

  // Fetch unmatched NAV invoices
  const { data: unmatchedNav = [], isLoading: navLoading } = useQuery({
    queryKey: ['unmatchedNavInvoices', companyId, dateFromFormatted, dateToFormatted],
    queryFn: () => fetchAllUnmatchedNav(companyId, dateFromFormatted, dateToFormatted),
    enabled: !!companyId,
  });

  // Fetch unmatched transactions (paginated)
  const { data: unmatchedTx = [], isLoading: txLoading } = useQuery({
    queryKey: ['unmatchedTransactions', companyId, dateFromFormatted, dateToFormatted],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      const all: UnmatchedTransaction[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('transactions')
          .select('id, transaction_date, amount, description, currency, type')
          .eq('company_id', companyId)
          .is('matched_invoice_id', null)
          .gte('transaction_date', dateFromFormatted)
          .lte('transaction_date', dateToFormatted)
          .order('transaction_date', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        all.push(...(data || []));
        if (!data || data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      return all;
    },
    enabled: !!companyId,
  });

  const loading = navLoading || txLoading;

  const navTotal = unmatchedNav.reduce((sum, inv) => sum + Math.abs(inv.invoice_gross_amount || 0), 0);
  const txTotal = unmatchedTx.reduce((sum, tx) => sum + Math.abs(tx.amount || 0), 0);

  const renderNavTable = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (unmatchedNav.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <FileX2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
          Minden NAV számla párosítva van!
        </div>
      );
    }

    return (
      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
        <Table className="compact-table">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">Irány</TableHead>
              <TableHead className="min-w-[130px]">Bizonylatsorszám</TableHead>
              <TableHead>Kibocsátás</TableHead>
              <TableHead>Partner</TableHead>
              <TableHead className="text-right">Bruttó</TableHead>
              <TableHead className="text-center w-[80px]">Fiz. mód</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {unmatchedNav.slice(0, visibleNavCount).map(inv => {
              const isInbound = inv.invoice_direction === 'INBOUND';
              const partnerName = isInbound ? inv.supplier_name : inv.customer_name;
              return (
                <TableRow key={inv.id}>
                  <TableCell>
                    {isInbound ? (
                      <Badge variant="outline" className="gap-0.5 text-destructive border-destructive/30 bg-destructive/5 text-[10px] px-1 py-0">
                        <ArrowDownLeft className="h-3 w-3" />Be
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-0.5 text-success border-success/30 bg-success/5 text-[10px] px-1 py-0">
                        <ArrowUpRight className="h-3 w-3" />Ki
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-medium min-w-[130px]">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="block truncate max-w-[160px] cursor-help">
                            {inv.invoice_number}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-mono">{inv.invoice_number}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell>
                    {inv.invoice_issue_date
                      ? format(new Date(inv.invoice_issue_date), 'yyyy. MM. dd.', { locale: hu })
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <span className="block truncate max-w-[200px]">{partnerName || '-'}</span>
                  </TableCell>
                  <TableCell className={`text-right tabular-nums font-medium ${isInbound ? 'text-destructive' : 'text-success'}`}>
                    {formatCurrency(inv.invoice_gross_amount || 0, inv.currency || 'HUF')}
                  </TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">
                    {inv.payment_method || '-'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {unmatchedNav.length > visibleNavCount && (
          <div className="text-center py-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setVisibleNavCount(prev => prev + 20)}
            >
              + {unmatchedNav.length - visibleNavCount} további számla
            </Button>
          </div>
        )}
      </div>
    );
  };

  const renderTxTable = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (unmatchedTx.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <Unlink className="h-8 w-8 mx-auto mb-2 opacity-30" />
          Minden tranzakció párosítva van!
        </div>
      );
    }

    return (
      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
        <Table className="compact-table">
          <TableHeader>
            <TableRow>
              <TableHead>Dátum</TableHead>
              <TableHead className="text-right">Összeg</TableHead>
              <TableHead>Leírás</TableHead>
              <TableHead className="text-center w-[80px]">Típus</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {unmatchedTx.slice(0, visibleTxCount).map(tx => (
              <TableRow key={tx.id}>
                <TableCell>
                  {format(new Date(tx.transaction_date), 'yyyy. MM. dd.', { locale: hu })}
                </TableCell>
                <TableCell className={`text-right tabular-nums font-medium ${tx.amount >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(tx.amount, tx.currency || 'HUF')}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="block truncate max-w-[350px] cursor-help">
                          {tx.description || '-'}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[400px]">
                        <p className="text-xs">{tx.description || '-'}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {tx.type || '-'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {unmatchedTx.length > visibleTxCount && (
          <div className="text-center py-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setVisibleTxCount(prev => prev + 20)}
            >
              + {unmatchedTx.length - visibleTxCount} további tranzakció
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Nem párosított tételek</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as 'nav' | 'transactions'); }}>
          <TabsList className="grid w-full grid-cols-2 mb-4 bg-slate-100/80 dark:bg-muted border border-slate-200 dark:border-transparent">
            <TabsTrigger value="nav" className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-background data-[state=active]:text-slate-900 dark:data-[state=active]:text-foreground data-[state=active]:shadow-sm text-slate-500 dark:text-muted-foreground hover:text-slate-700 dark:hover:text-foreground">
              <FileX2 className="h-4 w-4" />
              NAV számlák ({unmatchedNav.length})
            </TabsTrigger>
            <TabsTrigger value="transactions" className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-background data-[state=active]:text-slate-900 dark:data-[state=active]:text-foreground data-[state=active]:shadow-sm text-slate-500 dark:text-muted-foreground hover:text-slate-700 dark:hover:text-foreground">
              <Unlink className="h-4 w-4" />
              Tranzakciók ({unmatchedTx.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="nav">
            {unmatchedNav.length > 0 && (
              <div className="mb-4 px-4 h-12 flex items-center justify-between rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  {unmatchedNav.length} számla nincs tranzakcióhoz párosítva · Összesen: {formatCurrency(navTotal, 'HUF')}
                </p>
              </div>
            )}
            {renderNavTable()}
          </TabsContent>

          <TabsContent value="transactions">
            {unmatchedTx.length > 0 && (
              <div className="mb-4 px-4 h-12 flex items-center justify-between rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  {unmatchedTx.length} tranzakció nincs számlához párosítva · Összesen: {formatCurrency(txTotal, 'HUF')}
                </p>
              </div>
            )}
            {renderTxTable()}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default UnmatchedSection;
