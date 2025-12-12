import { useState, useEffect } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, CreditCard, FileQuestion } from 'lucide-react';
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
  paid: boolean | null;
  submitted: boolean | null;
}

interface Partner {
  tax_number: string;
  name: string;
}

const InvoiceStatusTables = () => {
  const { selectedCompany } = useCompany();
  const [activeTab, setActiveTab] = useState<'payable' | 'missing'>('payable');
  const [payableInvoices, setPayableInvoices] = useState<NavInvoice[]>([]);
  const [missingInvoices, setMissingInvoices] = useState<NavInvoice[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (selectedCompany) {
      fetchData();
    }
  }, [selectedCompany]);

  const fetchData = async () => {
    if (!selectedCompany) return;
    
    setLoading(true);
    try {
      // Fetch payable invoices (INBOUND where paid is false or null)
      const { data: payableData, error: payableError } = await supabase
        .from('nav_invoices')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .eq('invoice_direction', 'INBOUND')
        .or('paid.is.null,paid.eq.false')
        .order('invoice_issue_date', { ascending: false });

      if (payableError) throw payableError;
      setPayableInvoices(payableData || []);

      // Fetch missing invoices (INBOUND where submitted is false or null)
      const { data: missingData, error: missingError } = await supabase
        .from('nav_invoices')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .eq('invoice_direction', 'INBOUND')
        .or('submitted.is.null,submitted.eq.false')
        .order('invoice_issue_date', { ascending: false });

      if (missingError) throw missingError;
      setMissingInvoices(missingData || []);

      // Fetch partners for name lookup
      const { data: partnersData, error: partnersError } = await supabase
        .from('partners')
        .select('tax_number, name')
        .eq('company_id', selectedCompany.id);

      if (partnersError) throw partnersError;
      setPartners(partnersData || []);

    } catch (error) {
      console.error('Error fetching invoice status data:', error);
    } finally {
      setLoading(false);
    }
  };

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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Számlaszám</TableHead>
              <TableHead>Kibocsátás</TableHead>
              <TableHead>Szállító</TableHead>
              <TableHead className="text-right">Bruttó</TableHead>
              <TableHead className="text-center">Státusz</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.slice(0, 20).map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell className="font-medium">
                  {invoice.invoice_number}
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
                <TableCell className="text-center">
                  {activeTab === 'payable' ? (
                    <Badge variant={invoice.paid ? "default" : "destructive"}>
                      {invoice.paid ? 'Fizetve' : 'Fizetendő'}
                    </Badge>
                  ) : (
                    <Badge variant={invoice.submitted ? "default" : "secondary"}>
                      {invoice.submitted ? 'Beküldve' : 'Hiányzik'}
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {invoices.length > 20 && (
          <div className="text-center py-2 text-sm text-muted-foreground">
            + {invoices.length - 20} további számla
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
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'payable' | 'missing')}>
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
              <div className="mb-4 p-3 bg-warning/10 rounded-lg border border-warning/20">
                <p className="text-sm font-medium text-warning">
                  {missingCount} számla vár beküldésre
                </p>
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
