import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  TestTube, 
  RefreshCw, 
  Download, 
  CheckCircle, 
  XCircle, 
  Clock,
  Shield,
  Database,
  Info
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';

interface NavInvoice {
  id: string;
  invoice_number: string;
  invoice_direction: string;
  supplier_tax_number: string;
  customer_tax_number: string;
  invoice_issue_date: string;
  invoice_net_amount: number;
  invoice_vat_amount: number;
  invoice_gross_amount: number;
  currency: string;
  fetched_at: string;
}

const NavTesting: React.FC = () => {
  const { toast } = useToast();
  const { selectedCompany } = useCompany();
  const [loading, setLoading] = useState(false);
  const [navInvoices, setNavInvoices] = useState<NavInvoice[]>([]);
  const [credentialsExist, setCredentialsExist] = useState(false);
  
  const [syncParams, setSyncParams] = useState({
    dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0]
  });

  const [invoiceFilters, setInvoiceFilters] = useState({
    direction: 'ALL' as 'ALL' | 'OUTBOUND' | 'INBOUND',
    dateFrom: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (selectedCompany) {
      checkCredentialsExist();
    }
  }, [selectedCompany]);

  useEffect(() => {
    if (credentialsExist && selectedCompany) {
      loadNavInvoices();
    }
  }, [invoiceFilters, credentialsExist, selectedCompany]);

  const checkCredentialsExist = async () => {
    if (!selectedCompany) {
      setCredentialsExist(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('user_nav_credentials')
        .select('id')
        .eq('company_id', selectedCompany.id)
        .maybeSingle();
      
      setCredentialsExist(!error && !!data);
    } catch (error) {
      setCredentialsExist(false);
    }
  };

  const loadNavInvoices = async () => {
    if (!selectedCompany) return;
    try {
      let query = supabase
        .from('nav_invoices')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .gte('invoice_issue_date', invoiceFilters.dateFrom)
        .lte('invoice_issue_date', invoiceFilters.dateTo)
        .order('invoice_issue_date', { ascending: false });

      if (invoiceFilters.direction !== 'ALL') {
        query = query.eq('invoice_direction', invoiceFilters.direction);
      }

      const { data, error } = await query;

      if (error) throw error;
      setNavInvoices(data || []);
    } catch (error: any) {
      console.error('Error loading nav invoices:', error);
    }
  };

  const handleSync = async () => {
    if (!selectedCompany) {
      toast({
        title: 'Nincs kiválasztott cég',
        description: 'Kérlek válassz ki egy céget a szinkronizáláshoz',
        variant: 'destructive'
      });
      return;
    }
    
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const [outboundResult, inboundResult] = await Promise.allSettled([
        supabase.functions.invoke('nav-query-outbound-invoices', {
          body: {
            invoiceDirection: 'OUTBOUND',
            dateFrom: syncParams.dateFrom,
            dateTo: syncParams.dateTo,
            companyId: selectedCompany.id
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        }),
        supabase.functions.invoke('nav-query-outbound-invoices', {
          body: {
            invoiceDirection: 'INBOUND',
            dateFrom: syncParams.dateFrom,
            dateTo: syncParams.dateTo,
            companyId: selectedCompany.id
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        })
      ]);

      let totalInvoices = 0;
      const errors: string[] = [];

      if (outboundResult.status === 'fulfilled') {
        const { data, error } = outboundResult.value;
        if (error || data?.error) {
          errors.push(`Kimenő: ${error?.message || data?.error}`);
        } else if (data?.success) {
          totalInvoices += data.totalInvoices || 0;
        }
      } else {
        errors.push(`Kimenő: ${outboundResult.reason?.message || 'Ismeretlen hiba'}`);
      }

      if (inboundResult.status === 'fulfilled') {
        const { data, error } = inboundResult.value;
        if (error || data?.error) {
          errors.push(`Bejövő: ${error?.message || data?.error}`);
        } else if (data?.success) {
          totalInvoices += data.totalInvoices || 0;
        }
      } else {
        errors.push(`Bejövő: ${inboundResult.reason?.message || 'Ismeretlen hiba'}`);
      }

      if (errors.length === 2) {
        throw new Error(errors.join('; '));
      } else if (errors.length === 1) {
        toast({
          title: 'Szinkronizálás részben sikeres',
          description: `${totalInvoices} számla letöltve. Hibák: ${errors.join('; ')}`,
          variant: 'default'
        });
      } else {
        toast({
          title: 'Szinkronizálás befejezve',
          description: `${totalInvoices} számla letöltve (kimenő és bejövő)`,
        });
      }
      
      loadNavInvoices();

    } catch (error: any) {
      console.error('Sync error:', error);
      toast({
        title: 'Szinkronizálási hiba',
        description: error.message || 'Nem sikerült szinkronizálni a számlákat',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'HUF') => {
    return new Intl.NumberFormat('hu-HU', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('hu-HU');
  };

  if (!credentialsExist) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-2">
          <TestTube className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">NAV API Tesztelés</h1>
        </div>
        
        <div className="text-center py-12">
          <Shield className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Először állítsa be a NAV hitelesítő adatokat</h2>
          <p className="text-muted-foreground mb-6">
            A tesztelés megkezdéséhez szükséges a NAV API hozzáférési adatok megadása az Integrációk oldalon
          </p>
          <Button asChild>
            <a href="/integrations">Ugrás az Integrációkhoz</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2">
        <TestTube className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold">NAV API Tesztelés</h1>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-5 w-5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>Teszteld a NAV kapcsolatot és szinkronizáld a számlaidat.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <Tabs defaultValue="sync" className="space-y-6">
        <TabsList>
          <TabsTrigger value="sync">Szinkronizálás</TabsTrigger>
          <TabsTrigger value="invoices">NAV Számlák</TabsTrigger>
        </TabsList>

        <TabsContent value="sync" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="w-5 h-5" />
                Számlák Szinkronizálása
              </CardTitle>
              <CardDescription>
                Számlák letöltése a NAV online számla rendszerből
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dateFrom">Kezdő dátum</Label>
                  <Input
                    id="dateFrom"
                    type="date"
                    value={syncParams.dateFrom}
                    onChange={(e) => setSyncParams(prev => ({ ...prev, dateFrom: e.target.value }))}
                  />
                </div>
                
                <div>
                  <Label htmlFor="dateTo">Végső dátum</Label>
                  <Input
                    id="dateTo"
                    type="date"
                    value={syncParams.dateTo}
                    onChange={(e) => setSyncParams(prev => ({ ...prev, dateTo: e.target.value }))}
                  />
                </div>
              </div>
              
              <Button 
                onClick={handleSync} 
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Szinkronizálás...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Számlák Szinkronizálása
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                NAV Számlák ({navInvoices.length})
              </CardTitle>
              <CardDescription>
                A NAV API-ból letöltött számlák listája
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <Label htmlFor="filterDirection">Irány</Label>
                  <Select
                    value={invoiceFilters.direction}
                    onValueChange={(value: 'ALL' | 'OUTBOUND' | 'INBOUND') => 
                      setInvoiceFilters(prev => ({ ...prev, direction: value }))
                    }
                  >
                    <SelectTrigger id="filterDirection">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Mindkettő</SelectItem>
                      <SelectItem value="OUTBOUND">Kimenő (Eladási)</SelectItem>
                      <SelectItem value="INBOUND">Bejövő (Beszerzési)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="filterDateFrom">Kezdő dátum</Label>
                  <Input
                    id="filterDateFrom"
                    type="date"
                    value={invoiceFilters.dateFrom}
                    onChange={(e) => setInvoiceFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                  />
                </div>
                
                <div>
                  <Label htmlFor="filterDateTo">Végső dátum</Label>
                  <Input
                    id="filterDateTo"
                    type="date"
                    value={invoiceFilters.dateTo}
                    onChange={(e) => setInvoiceFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                  />
                </div>
              </div>
              
              {navInvoices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Még nincsenek letöltött számlák. Indítson szinkronizálást a fenti lapon.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Számlaszám</TableHead>
                        <TableHead>Irány</TableHead>
                        <TableHead>Keltezés</TableHead>
                        <TableHead>Nettó</TableHead>
                        <TableHead>ÁFA</TableHead>
                        <TableHead>Bruttó</TableHead>
                        <TableHead>Letöltve</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {navInvoices.slice(0, 20).map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                          <TableCell>
                            <Badge variant={invoice.invoice_direction === 'OUTBOUND' ? 'default' : 'secondary'}>
                              {invoice.invoice_direction === 'OUTBOUND' ? 'Kimenő' : 'Bejövő'}
                            </Badge>
                          </TableCell>
                          <TableCell>{invoice.invoice_issue_date}</TableCell>
                          <TableCell>{formatCurrency(invoice.invoice_net_amount, invoice.currency)}</TableCell>
                          <TableCell>{formatCurrency(invoice.invoice_vat_amount, invoice.currency)}</TableCell>
                          <TableCell>{formatCurrency(invoice.invoice_gross_amount, invoice.currency)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(invoice.fetched_at)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NavTesting;