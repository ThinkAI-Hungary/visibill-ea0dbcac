import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, Zap, Shield, AtSign, Info, Activity, CheckCircle, XCircle, Clock, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import EmailAliasManager from '@/components/EmailAliasManager';
import NavCredentialsForm from '@/components/nav/NavCredentialsForm';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
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

const Integrations = () => {
  const { toast } = useToast();
  const { selectedCompany } = useCompany();
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [navSectionOpen, setNavSectionOpen] = useState(false);
  const [activeNavTab, setActiveNavTab] = useState('credentials');

  useEffect(() => {
    if (selectedCompany) {
      loadSyncLogs();
    }
  }, [selectedCompany]);

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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('hu-HU');
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="container mx-auto px-6 pt-6 pb-2 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integrációk</h1>
          <p className="text-muted-foreground">
            Csatlakoztasd szolgáltatásaidat a számla automatizáláshoz
          </p>
        </div>
        <Badge variant="secondary" className="flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Automatizáció
        </Badge>
      </div>

      <div className="grid gap-6">
        {/* Email Alias Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <AtSign className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xl">Email Alias-ok</CardTitle>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Hozz létre dedikált email címeket minden céghez. Add meg ezeket a címeket a számlázóknak, és a számlák automatikusan feldolgozásra kerülnek.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <CardDescription>
                  Egyedi email címek cégekhez a számlák automatikus fogadásához
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Mail className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-sm">Dedikált címek</p>
                  <p className="text-xs text-muted-foreground">Cégenkénti elkülönítés</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Zap className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="font-medium text-sm">Automatikus</p>
                  <p className="text-xs text-muted-foreground">Azonnali feldolgozás</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Shield className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-sm">Biztonságos</p>
                  <p className="text-xs text-muted-foreground">Ellenőrzött forrás</p>
                </div>
              </div>
            </div>

            <EmailAliasManager />
          </CardContent>
        </Card>

        {/* NAV Integration */}
        <Card>
          <Collapsible open={navSectionOpen} onOpenChange={setNavSectionOpen}>
            <CardHeader className="cursor-pointer" onClick={() => setNavSectionOpen(!navSectionOpen)}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Shield className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-xl">NAV Online Számla</CardTitle>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Csatlakoztasd a NAV Online Számla rendszert a kimenő számlák automatikus szinkronizálásához. Technikai felhasználó adatai szükségesek.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <CardDescription>
                      Magyar NAV online számla rendszer integráció
                    </CardDescription>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="secondary" className="text-xs">
                        <Shield className="w-3 h-3 mr-1" />
                        Biztonságos
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        <Zap className="w-3 h-3 mr-1" />
                        Automatikus
                      </Badge>
                    </div>
                  </div>
                </div>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">
                    {navSectionOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
              </div>
            </CardHeader>
            
            <CollapsibleContent>
              <CardContent className="pt-0">
                <Tabs value={activeNavTab} onValueChange={setActiveNavTab}>
                  <TabsList className="mb-4">
                    <TabsTrigger value="credentials">Hitelesítő Adatok</TabsTrigger>
                    <TabsTrigger value="logs">Sync Logok</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="credentials">
                    <NavCredentialsForm 
                      companyId={selectedCompany?.id}
                      onCredentialsSaved={() => {
                        toast({
                          title: 'Hitelesítő adatok frissítve',
                          description: 'A NAV API hitelesítő adatok sikeresen frissítve',
                        });
                      }} 
                    />
                  </TabsContent>
                  
                  <TabsContent value="logs">
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
                </Tabs>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

      </div>
    </div>
    </TooltipProvider>
  );
};

export default Integrations;