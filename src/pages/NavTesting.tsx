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
  const [loading, setLoading] = useState(false);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [navInvoices, setNavInvoices] = useState<NavInvoice[]>([]);
  const [credentialsExist, setCredentialsExist] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  
  const [syncParams, setSyncParams] = useState({
    direction: 'OUTBOUND' as 'OUTBOUND' | 'INBOUND',
    dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    dateTo: new Date().toISOString().split('T')[0] // today
  });

  const [queryParams, setQueryParams] = useState({
    dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0]
  });
  
  const [queryResults, setQueryResults] = useState<any>(null);
  const [querying, setQuerying] = useState(false);

  useEffect(() => {
    checkCredentialsExist();
    loadSyncLogs();
    loadNavInvoices();
  }, []);

  const checkCredentialsExist = async () => {
    try {
      const { data, error } = await supabase
        .from('user_nav_credentials')
        .select('id')
        .maybeSingle();
      
      setCredentialsExist(!error && !!data);
    } catch (error) {
      setCredentialsExist(false);
    }
  };

  const loadSyncLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('nav_sync_logs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setSyncLogs(data || []);
    } catch (error: any) {
      console.error('Error loading sync logs:', error);
    }
  };

  const loadNavInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from('nav_invoices')
        .select('*')
        .order('fetched_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setNavInvoices(data || []);
    } catch (error: any) {
      console.error('Error loading nav invoices:', error);
    }
  };

  const handleTestConnection = async () => {
    setLoading(true);
    setValidationResult(null);
    try {
      console.log('[NavTesting] Starting connection test');
      
      // Get session and explicitly pass Authorization header
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      const { data, error } = await supabase.functions.invoke('nav-token', {
        body: { action: 'validate_credentials' },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      console.log('[NavTesting] nav-token response', { data, error });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const result = data as any;
      setValidationResult(result);
      
      if (result.success && result.status === 'valid') {
        toast({
          title: 'Kapcsolat teszt sikeres',
          description: 'NAV API kapcsolat működik!',
        });
      }
      // Don't show error toast for invalid credentials - show the card instead

    } catch (error: any) {
      console.error('Connection test error:', error);
      toast({
        title: 'Kapcsolat teszt hiba',
        description: error.message || 'Nem sikerült tesztelni a kapcsolatot',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`/functions/v1/query-nav-invoices`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          invoiceDirection: syncParams.direction,
          dateFrom: syncParams.dateFrom,
          dateTo: syncParams.dateTo,
          page: 1
        })
      });

      const result = await response.json();
      
      if (result.success) {
        toast({
          title: 'Szinkronizálás befejezve',
          description: `${result.count} számla letöltve`,
        });
        
        // Reload data
        loadSyncLogs();
        loadNavInvoices();
      } else {
        throw new Error(result.error);
      }

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

  const handleQueryOutbound = async () => {
    // Validate date range (max 35 days)
    const fromDate = new Date(queryParams.dateFrom);
    const toDate = new Date(queryParams.dateTo);
    const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff > 35) {
      toast({
        title: 'Érvénytelen dátum tartomány',
        description: 'A dátum tartomány nem haladhatja meg a 35 napot',
        variant: 'destructive'
      });
      return;
    }

    if (daysDiff < 0) {
      toast({
        title: 'Érvénytelen dátum tartomány',
        description: 'A kezdő dátum nem lehet később, mint a végső dátum',
        variant: 'destructive'
      });
      return;
    }

    setQuerying(true);
    setQueryResults(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      console.log('[NavTesting] Querying outbound invoices');
      
      const { data, error } = await supabase.functions.invoke('nav-query-outbound-invoices', {
        body: {
          dateFrom: queryParams.dateFrom,
          dateTo: queryParams.dateTo
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      console.log('[NavTesting] Query response:', { data, error });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setQueryResults(data);
      
      toast({
        title: 'Lekérdezés sikeres',
        description: `${data.totalInvoices} számla találva (${data.pagesFetched} oldal)`,
      });

    } catch (error: any) {
      console.error('Query error:', error);
      toast({
        title: 'Lekérdezési hiba',
        description: error.message || 'Nem sikerült lekérdezni a számlákat',
        variant: 'destructive'
      });
    } finally {
      setQuerying(false);
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

        <NavCredentialsForm onCredentialsSaved={() => {
          setCredentialsExist(true);
          checkCredentialsExist();
        }} />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
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
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                onClick={handleTestConnection} 
                disabled={loading}
                variant="outline"
              >
                <Shield className="w-4 h-4 mr-2" />
                Kapcsolat Tesztelése
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Ellenőrzi, hogy a NAV hitelesítési adatok helyesek-e</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Validation Result Card */}
      {validationResult && !validationResult.success && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>NAV elutasította az autentikációt</AlertTitle>
          <AlertDescription className="space-y-3">
            <div className="space-y-1">
              <p className="font-medium">{validationResult.message}</p>
              {validationResult.requestId && (
                <p className="text-sm">Request ID: {validationResult.requestId}</p>
              )}
            </div>
            
            {validationResult.diagnostics && (
              <div className="text-sm space-y-1 pt-2 border-t">
                <p className="font-medium">Mező diagnosztika:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Felhasználónév hossz: {validationResult.diagnostics.loginLength}</li>
                  <li>Adószám hossz: {validationResult.diagnostics.taxNumberLength}</li>
                  {validationResult.diagnostics.hasWhitespaceInLogin && (
                    <li className="text-yellow-200">⚠️ Felhasználónév tartalmazott whitespace karaktereket (eltávolítva)</li>
                  )}
                  {validationResult.diagnostics.hasWhitespaceInPassword && (
                    <li className="text-yellow-200">⚠️ Jelszó tartalmazott whitespace karaktereket (eltávolítva)</li>
                  )}
                </ul>
              </div>
            )}
            
            <Accordion type="single" collapsible className="mt-3">
              <AccordionItem value="details" className="border-none">
                <AccordionTrigger className="text-sm py-2 hover:no-underline">
                  <span className="flex items-center gap-2">
                    <ChevronDown className="h-3 w-3" />
                    NAV XML Válasz Részletei
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <pre className="text-xs bg-black/20 p-3 rounded overflow-x-auto max-h-48">
                    {validationResult.details}
                  </pre>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            
            <div className="pt-3 border-t">
              <p className="text-sm font-medium mb-2">Ellenőrizze:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>A technikai felhasználó és adószám azonos adózóhoz tartozik a NAV-nál</li>
                <li>A technikai felhasználó aktiválva van és nem lejárt/zárolva</li>
                <li>Jelszó és aláíró kulcs helyesen lett megadva (whitespace-ek automatikusan eltávolítva)</li>
                <li>Éles NAV API környezet van használva</li>
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="query" className="space-y-6">
        <TabsList>
          <TabsTrigger value="query">Kimenő Számlák Lekérdezése</TabsTrigger>
          <TabsTrigger value="sync">Szinkronizálás</TabsTrigger>
          <TabsTrigger value="invoices">NAV Számlák</TabsTrigger>
          <TabsTrigger value="logs">Sync Logok</TabsTrigger>
          <TabsTrigger value="credentials">Hitelesítő Adatok</TabsTrigger>
        </TabsList>

        <TabsContent value="query" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Kimenő Számlák Lekérdezése (OUTBOUND)
              </CardTitle>
              <CardDescription>
                Lekérdezi a NAV-tól az Ön által kibocsátott számlákat. Automatikusan lekérdez max. 3 oldalt (akár 300 számla).
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="queryDateFrom">Kezdő dátum (számlakeltezés)</Label>
                  <Input
                    id="queryDateFrom"
                    type="date"
                    value={queryParams.dateFrom}
                    onChange={(e) => setQueryParams(prev => ({ ...prev, dateFrom: e.target.value }))}
                  />
                </div>
                
                <div>
                  <Label htmlFor="queryDateTo">Végső dátum (számlakeltezés)</Label>
                  <Input
                    id="queryDateTo"
                    type="date"
                    value={queryParams.dateTo}
                    onChange={(e) => setQueryParams(prev => ({ ...prev, dateTo: e.target.value }))}
                  />
                </div>
              </div>

              <Alert>
                <Calendar className="h-4 w-4" />
                <AlertTitle>Dátum tartomány korlát</AlertTitle>
                <AlertDescription>
                  Maximum 35 napos időszakot lehet lekérdezni egy kérésben. A rendszer automatikusan lekérdezi az első 3 oldalt (max. 300 számla).
                </AlertDescription>
              </Alert>
              
              <Button 
                onClick={handleQueryOutbound} 
                disabled={querying}
                className="w-full"
              >
                {querying ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Lekérdezés folyamatban...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Kimenő Számlák Lekérdezése
                  </>
                )}
              </Button>

              {queryResults && (
                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Lekérdezés eredménye</h3>
                    <div className="flex gap-2">
                      <Badge variant="outline">
                        {queryResults.totalInvoices} számla
                      </Badge>
                      <Badge variant="outline">
                        {queryResults.pagesFetched}/{queryResults.totalPagesAvailable} oldal
                      </Badge>
                    </div>
                  </div>

                  {queryResults.invoices && queryResults.invoices.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Számlaszám</TableHead>
                            <TableHead>Művelet</TableHead>
                            <TableHead>Kategória</TableHead>
                            <TableHead>Keltezés</TableHead>
                            <TableHead>Vevő</TableHead>
                            <TableHead>Nettó (HUF)</TableHead>
                            <TableHead>ÁFA (HUF)</TableHead>
                            <TableHead>Fizetési mód</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {queryResults.invoices.map((invoice: any, index: number) => (
                            <TableRow key={`${invoice.transactionId}-${invoice.index || index}`}>
                              <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                              <TableCell>
                                <Badge variant={
                                  invoice.invoiceOperation === 'CREATE' ? 'default' :
                                  invoice.invoiceOperation === 'MODIFY' ? 'secondary' :
                                  'destructive'
                                }>
                                  {invoice.invoiceOperation}
                                </Badge>
                              </TableCell>
                              <TableCell>{invoice.invoiceCategory}</TableCell>
                              <TableCell>{invoice.invoiceIssueDate}</TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  <div className="font-medium">{invoice.customerName || '-'}</div>
                                  {invoice.customerTaxNumber && (
                                    <div className="text-muted-foreground text-xs">{invoice.customerTaxNumber}</div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>{formatCurrency(parseFloat(invoice.invoiceNetAmountHUF || 0))}</TableCell>
                              <TableCell>{formatCurrency(parseFloat(invoice.invoiceVatAmountHUF || 0))}</TableCell>
                              <TableCell>{invoice.paymentMethod || '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      Nincsenek számlák a megadott időszakban
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="direction">Irány</Label>
                  <Select
                    value={syncParams.direction}
                    onValueChange={(value: 'OUTBOUND' | 'INBOUND') => 
                      setSyncParams(prev => ({ ...prev, direction: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OUTBOUND">Kimenő (Eladási)</SelectItem>
                      <SelectItem value="INBOUND">Bejövő (Beszerzési)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
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
            
            <CardContent>
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
                        <TableRow key={log.id}>
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
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="credentials" className="space-y-6">
          <NavCredentialsForm onCredentialsSaved={() => {
            toast({
              title: 'Hitelesítő adatok frissítve',
              description: 'A NAV API hitelesítő adatok sikeresen frissítve',
            });
          }} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NavTesting;