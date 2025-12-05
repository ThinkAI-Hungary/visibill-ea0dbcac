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
  Activity,
  Calendar,
  AlertTriangle,
  ChevronDown,
  Info
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import NavCredentialsForm from '@/components/nav/NavCredentialsForm';
import { useCompany } from '@/contexts/CompanyContext';

interface SyncLog {
  id: string;
  sync_type: string;
  invoice_direction: string;
  date_from: string;
  date_to: string;
  invoices_fetched: number;
  status: string;
  error_message?: string;
  duration_ms?: number;
  started_at: string;
  completed_at?: string;
}

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
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [navInvoices, setNavInvoices] = useState<NavInvoice[]>([]);
  const [credentialsExist, setCredentialsExist] = useState(false);
  
  const [syncParams, setSyncParams] = useState({
    dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    dateTo: new Date().toISOString().split('T')[0] // today
  });

  const [invoiceFilters, setInvoiceFilters] = useState({
    direction: 'ALL' as 'ALL' | 'OUTBOUND' | 'INBOUND',
    dateFrom: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 90 days ago
    dateTo: new Date().toISOString().split('T')[0] // today
  });

  useEffect(() => {
    if (selectedCompany) {
      checkCredentialsExist();
      loadSyncLogs();
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

  const loadSyncLogs = async () => {
    if (!selectedCompany) return;
    try {
      const { data, error } = await supabase
        .from('nav_sync_logs')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .order('started_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setSyncLogs(data || []);
    } catch (error: any) {
      console.error('Error loading sync logs:', error);
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

      // Apply direction filter if not ALL
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

      // Sync both OUTBOUND and INBOUND invoices
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

      // Process OUTBOUND result
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

      // Process INBOUND result
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

      // Show result
      if (errors.length === 2) {
        // Both failed
        throw new Error(errors.join('; '));
      } else if (errors.length === 1) {
        // One succeeded, one failed
        toast({
          title: 'Szinkronizálás részben sikeres',
          description: `${totalInvoices} számla letöltve. Hibák: ${errors.join('; ')}`,
          variant: 'default'
        });
      } else {
        // Both succeeded
        toast({
          title: 'Szinkronizálás befejezve',
          description: `${totalInvoices} számla letöltve (kimenő és bejövő)`,
        });
      }
      
      // Reload data
      loadSyncLogs();
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Sikeres</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Sikertelen</Badge>;
      case 'running':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Futó</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
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
            A tesztelés megkezdéséhez szükséges a NAV API hozzáférési adatok megadása
          </p>
        </div>

        <NavCredentialsForm 
          companyId={selectedCompany?.id}
          onCredentialsSaved={() => {
            checkCredentialsExist();
          }} 
        />
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
              <p>Teszteld a NAV kapcsolatot és szinkronizáld a kimenő számláidat. Technikai felhasználó adatokra van szükség.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <Tabs defaultValue="sync" className="space-y-6">
        <TabsList>
          <TabsTrigger value="sync">Szinkronizálás</TabsTrigger>
          <TabsTrigger value="invoices">NAV Számlák</TabsTrigger>
          <TabsTrigger value="logs">Sync Logok</TabsTrigger>
          <TabsTrigger value="credentials">Hitelesítő Adatok</TabsTrigger>
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

        <TabsContent value="logs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Szinkronizálási Logok
              </CardTitle>
              <CardDescription>
                NAV API szinkronizálási műveletek történetje
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              {syncLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Még nincsenek szinkronizálási logok.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Indítva</TableHead>
                        <TableHead>Típus</TableHead>
                        <TableHead>Irány</TableHead>
                        <TableHead>Időszak</TableHead>
                        <TableHead>Státusz</TableHead>
                        <TableHead>Számlák</TableHead>
                        <TableHead>Időtartam</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {syncLogs.map((log) => (
                        <React.Fragment key={log.id}>
                          <TableRow>
                            <TableCell>{formatDate(log.started_at)}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{log.sync_type}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={log.invoice_direction === 'OUTBOUND' ? 'default' : 'secondary'}>
                                {log.invoice_direction === 'OUTBOUND' ? 'Kimenő' : 'Bejövő'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {log.date_from} - {log.date_to}
                            </TableCell>
                            <TableCell>{getStatusBadge(log.status)}</TableCell>
                            <TableCell>{log.invoices_fetched}</TableCell>
                            <TableCell>
                              {log.duration_ms ? `${Math.round(log.duration_ms / 1000)}s` : '-'}
                            </TableCell>
                          </TableRow>
                          {log.error_message && (
                            <TableRow>
                              <TableCell colSpan={7} className="bg-destructive/5 border-l-4 border-destructive">
                                <div className="flex items-start gap-2 py-2">
                                  <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                                  <div className="flex-1">
                                    <div className="text-sm font-medium text-destructive mb-1">Hibaüzenet:</div>
                                    <div className="text-sm text-muted-foreground font-mono break-all">
                                      {log.error_message}
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="credentials" className="space-y-6">
          <NavCredentialsForm 
            companyId={selectedCompany?.id}
            onCredentialsSaved={() => {
              checkCredentialsExist();
              toast({
                title: 'Hitelesítő adatok frissítve',
                description: 'A NAV API hitelesítő adatok sikeresen frissítve',
              });
            }} 
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NavTesting;