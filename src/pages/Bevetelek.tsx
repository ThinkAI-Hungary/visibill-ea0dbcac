import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { TrendingUp, Eye, RefreshCw, Download } from "lucide-react";
import { NavCredentialsForm } from "@/components/nav/NavCredentialsForm";
import { NavInvoiceViewer } from "@/components/nav/NavInvoiceViewer";
import { supabase } from "@/integrations/supabase/client";

interface NavCredentials {
  login: string;
  password: string;
  signatureKey: string;
  taxNumber: string;
}

interface NavQueryParams {
  useTestEnvironment: boolean;
  direction: string;
  page: number;
}

interface NavInvoice {
  invoiceNumber: string;
  supplierTaxNumber: string;
  customerTaxNumber: string;
  invoiceOperation: string;
  insDate: string;
  invoiceAmount?: number;
  currency?: string;
  lastUpdated?: string;
}

interface RevenueSummary {
  totalRevenue: number;
  invoiceCount: number;
  averageInvoice: number;
  taxAmount: number;
}

export default function Bevetelek() {
  const [credentials, setCredentials] = useState<NavCredentials>({
    login: "",
    password: "",
    signatureKey: "",
    taxNumber: "",
  });
  const [useTest, setUseTest] = useState(true);
  const [invoices, setInvoices] = useState<NavInvoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<NavInvoice | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [summary, setSummary] = useState<RevenueSummary>({
    totalRevenue: 0,
    invoiceCount: 0,
    averageInvoice: 0,
    taxAmount: 0,
  });

  // Load stored invoices from Supabase
  const loadStoredInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from('nav_outbound_invoices')
        .select('*')
        .gte('ins_date', dateFrom)
        .lte('ins_date', dateTo)
        .eq('nav_environment', useTest ? 'test' : 'production')
        .order('ins_date', { ascending: false });

      if (error) throw error;

      const mappedInvoices = data.map(invoice => ({
        invoiceNumber: invoice.invoice_number,
        supplierTaxNumber: invoice.supplier_tax_number || '',
        customerTaxNumber: invoice.customer_tax_number || '',
        invoiceOperation: invoice.invoice_operation || '',
        insDate: invoice.ins_date || '',
        invoiceAmount: invoice.invoice_amount || 0,
        currency: invoice.currency || 'HUF',
        lastUpdated: invoice.last_updated,
      }));

      setInvoices(mappedInvoices);
      calculateSummary(mappedInvoices);
      
      if (data.length > 0) {
        setLastSync(data[0].last_updated);
      }
    } catch (error) {
      console.error('Hiba a tárolt számlák betöltésekor:', error);
    }
  };

  // Calculate revenue summary
  const calculateSummary = (invoiceList: NavInvoice[]) => {
    const total = invoiceList.reduce((sum, inv) => sum + (inv.invoiceAmount || 0), 0);
    const count = invoiceList.length;
    const average = count > 0 ? total / count : 0;
    const tax = total * 0.27; // Simplified 27% VAT calculation

    setSummary({
      totalRevenue: total,
      invoiceCount: count,
      averageInvoice: average,
      taxAmount: tax,
    });
  };

  // Fetch fresh data from NAV and store in Supabase
  const fetchFromNAV = async (forceRefresh = false) => {
    if (!connected && !forceRefresh) {
      toast({ title: "NAV kapcsolat szükséges", description: "Először csatlakozzon a NAV rendszerhez", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('nav', {
        body: {
          ...credentials,
          direction: 'OUTBOUND',
          page: currentPage,
          issueDateFrom: dateFrom,
          issueDateTo: dateTo,
          action: 'list',
          test: useTest,
          store_data: true,
        },
      });

      if (error) {
        console.error('NAV invoke error:', error);
        toast({ title: "NAV hiba", description: error.message || 'Hiba történt a NAV lekérdezés során', variant: "destructive" });
      } else if (result && result.success && result.data) {
        toast({ title: "NAV szinkron", description: `${result.data.currentPage}/${result.data.availablePage} oldal betöltve a NAV-ból` });
        setCurrentPage(result.data.currentPage);
        setTotalPages(result.data.availablePage);
        await loadStoredInvoices();
      } else {
        toast({ title: "NAV hiba", description: (result && result.error) || 'Hiba történt a NAV lekérdezés során', variant: "destructive" });
      }
    } catch (error) {
      console.error('NAV API hiba:', error);
      toast({ title: "Kapcsolódási hiba", description: "Kapcsolódási hiba a NAV rendszerrel", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Test connection
  const testConnection = async () => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('nav', {
        body: {
          ...credentials,
          direction: 'OUTBOUND',
          page: 1,
          issueDateFrom: dateFrom,
          issueDateTo: dateTo,
          action: 'list',
          test: useTest,
          store_data: false,
        },
      });

      if (!error && result?.success) {
        setConnected(true);
        toast({ title: 'Sikeres csatlakozás', description: 'Sikeres csatlakozás a NAV rendszerhez!' });
      } else {
        setConnected(false);
        toast({ title: 'Sikertelen csatlakozás', description: (error && (error as any).message) || result?.error || 'Sikertelen csatlakozás', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Kapcsolódási hiba:', error);
      setConnected(false);
      toast({ title: 'Kapcsolódási hiba', description: 'Kapcsolódási hiba', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Load stored data on component mount and when filters change
  useEffect(() => {
    loadStoredInvoices();
  }, [dateFrom, dateTo, useTest]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hu-HU', {
      style: 'currency',
      currency: 'HUF',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('hu-HU');
  };

  const getOperationBadge = (operation: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      'CREATE': 'default',
      'MODIFY': 'secondary',
      'STORNO': 'destructive',
    };
    return <Badge variant={variants[operation] || 'default'}>{operation}</Badge>;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Bevételek</h1>
          <p className="text-muted-foreground">NAV kimenő számlák kezelése és nyomon követése</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Összes bevétel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalRevenue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Számlák száma</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.invoiceCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Átlagos számla</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.averageInvoice)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Becsült ÁFA</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.taxAmount)}</div>
          </CardContent>
        </Card>
      </div>

      {/* NAV Credentials */}
      <Card>
        <CardHeader>
          <CardTitle>NAV Kapcsolat</CardTitle>
          <CardDescription>
            Csatlakozzon a NAV Online Számla rendszerhez
            {lastSync && (
              <span className="block mt-1 text-sm">
                Utolsó szinkronizálás: {formatDate(lastSync)}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NavCredentialsForm
            onCredentialsChange={(creds) => creds && setCredentials(creds)}
            onTestConnection={testConnection}
            isLoading={loading}
            isConnected={connected}
          />
        </CardContent>
      </Card>

      {/* Date Filters and Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Szűrők és műveletek</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium">Dátum-tól</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Dátum-ig</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={() => fetchFromNAV()} disabled={loading}>
                <RefreshCw className="w-4 h-4 mr-2" />
                NAV szinkronizálás
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle>Kimenő számlák</CardTitle>
          <CardDescription>
            {invoices.length} számla található az adott időszakra
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Számlaszám</TableHead>
                <TableHead>Vevő adószám</TableHead>
                <TableHead>Művelet</TableHead>
                <TableHead>Kiállítás dátuma</TableHead>
                <TableHead>Összeg</TableHead>
                <TableHead>Műveletek</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                  <TableCell>{invoice.customerTaxNumber}</TableCell>
                  <TableCell>{getOperationBadge(invoice.invoiceOperation)}</TableCell>
                  <TableCell>{formatDate(invoice.insDate)}</TableCell>
                  <TableCell>{invoice.invoiceAmount ? formatCurrency(invoice.invoiceAmount) : '-'}</TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedInvoice(invoice)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      XML
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Invoice Viewer Modal */}
      {selectedInvoice && (
        <NavInvoiceViewer
          onClose={() => setSelectedInvoice(null)}
          invoiceNumber={selectedInvoice.invoiceNumber}
          credentials={credentials}
          queryParams={{
            useTestEnvironment: useTest,
            direction: "OUTBOUND",
            page: currentPage
          }}
        />
      )}
    </div>
  );
}