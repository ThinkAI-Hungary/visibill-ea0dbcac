import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Loader2, CreditCard, FileQuestion, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';

interface NavInvoice {
  id: string;
  invoice_number: string;
  invoice_issue_date: string | null;
  invoice_delivery_date: string | null;
  supplier_tax_number: string | null;
  invoice_net_amount: number | null;
  invoice_gross_amount: number | null;
  invoice_vat_amount: number | null;
  currency: string | null;
  transaction_id: string | null;
  submitted: boolean | null;
}

interface Partner {
  tax_number: string;
  name: string;
}

const fetchAllInboundInvoices = async (companyId: string, mode: 'payable' | 'missing') => {
  const PAGE_SIZE = 1000;
  const all: NavInvoice[] = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from('nav_invoices')
      .select('id, invoice_number, invoice_issue_date, invoice_delivery_date, supplier_tax_number, invoice_net_amount, invoice_gross_amount, invoice_vat_amount, currency, transaction_id, submitted')
      .eq('company_id', companyId)
      .eq('invoice_direction', 'INBOUND')
      .order('invoice_issue_date', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (mode === 'payable') {
      query = query.is('transaction_id', null);
    } else {
      query = query.or('submitted.is.null,submitted.eq.false');
    }

    const { data, error } = await query;
    if (error) throw error;

    const page = (data || []) as NavInvoice[];
    all.push(...page);

    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
};

const InvoiceStatusTables = () => {
  const navigate = useNavigate();
  const { selectedCompany } = useCompany();
  const [activeTab, setActiveTab] = useState<'payable' | 'missing'>('payable');
  const [visibleCount, setVisibleCount] = useState(20);

  const companyId = selectedCompany?.id;

  const { data: payableInvoices = [], isLoading: loadingPayable } = useQuery({
    queryKey: ['invoiceStatusPayable', companyId],
    queryFn: () => fetchAllInboundInvoices(companyId!, 'payable'),
    enabled: !!companyId,
  });

  const { data: missingInvoices = [], isLoading: loadingMissing } = useQuery({
    queryKey: ['invoiceStatusMissing', companyId],
    queryFn: () => fetchAllInboundInvoices(companyId!, 'missing'),
    enabled: !!companyId,
  });

  const { data: partners = [] } = useQuery({
    queryKey: ['invoiceStatusPartners', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partners')
        .select('tax_number, name')
        .eq('company_id', companyId!);
      if (error) throw error;
      return (data || []) as Partner[];
    },
    enabled: !!companyId,
  });

  const loading = loadingPayable || loadingMissing;

  const getPartnerName = (taxNumber: string | null): string => {
    if (!taxNumber) return '-';
    const partner = partners.find(p => p.tax_number === taxNumber);
    return partner?.name || taxNumber;
  };

  const renderInvoiceTable = (invoices: NavInvoice[]) => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (invoices.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          Nincs megjeleníthető számla
        </div>
      );
    }

    return (
      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
        <Table className="compact-table">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[130px]">Bizonylatsorszám</TableHead>
              <TableHead>Kibocsátás</TableHead>
              <TableHead>Szállító</TableHead>
              <TableHead className="text-right">Bruttó</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.slice(0, visibleCount).map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell className="font-medium min-w-[130px]">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="block truncate max-w-[120px] cursor-help">
                          {invoice.invoice_number}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-mono">{invoice.invoice_number}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
                <TableCell>
                  {invoice.invoice_issue_date 
                    ? format(new Date(invoice.invoice_issue_date), 'yyyy. MM. dd.', { locale: hu })
                    : '-'}
                </TableCell>
                <TableCell>
                  {getPartnerName(invoice.supplier_tax_number)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(invoice.invoice_gross_amount || 0, invoice.currency || 'HUF')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {invoices.length > visibleCount && (
          <div className="text-center py-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setVisibleCount(prev => prev + 20)}
            >
              + {invoices.length - visibleCount} további számla
            </Button>
          </div>
        )}
      </div>
    );
  };

  const payableTotal = payableInvoices.reduce((sum, inv) => sum + (inv.invoice_gross_amount || 0), 0);
  const missingCount = missingInvoices.length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Bejövő számlák állapota</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as 'payable' | 'missing'); setVisibleCount(20); }}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="payable" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Fizetendő ({payableInvoices.length})
            </TabsTrigger>
            <TabsTrigger value="missing" className="flex items-center gap-2">
              <FileQuestion className="h-4 w-4" />
              Hiányzó ({missingCount})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="payable">
            {payableInvoices.length > 0 && (
              <div className="mb-4 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                <p className="text-sm font-medium text-destructive">
                  Fizetendő összeg: {formatCurrency(payableTotal, 'HUF')}
                </p>
              </div>
            )}
            {renderInvoiceTable(payableInvoices)}
          </TabsContent>

          <TabsContent value="missing">
            {missingInvoices.length > 0 && (
              <div className="mb-4 p-3 bg-warning/10 rounded-lg border border-warning/20 flex items-center justify-between">
                <p className="text-sm font-medium text-warning">
                  {missingCount} számla vár beküldésre
                </p>
                <Button 
                  size="sm" 
                  onClick={() => navigate('/manual-upload')}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Beküldés
                </Button>
              </div>
            )}
            {renderInvoiceTable(missingInvoices)}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default InvoiceStatusTables;
