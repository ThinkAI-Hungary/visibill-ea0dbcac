import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, Zap, Shield, AtSign, Info, Activity, CheckCircle, XCircle, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import EmailAliasManager from '@/components/EmailAliasManager';
import NavCredentialsForm from '@/components/nav/NavCredentialsForm';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
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
  const [logsLoading, setLogsLoading] = useState(true);
  const [activeNavTab, setActiveNavTab] = useState('credentials');

  useEffect(() => {
    if (selectedCompany) {
      loadSyncLogs();
    }
  }, [selectedCompany]);

  const loadSyncLogs = async () => {
    if (!selectedCompany) return;
    setLogsLoading(true);
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
    } finally {
      setLogsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"><CheckCircle className="w-3 h-3 mr-1" />Sikeres</Badge>;
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

  const LogsSkeleton = () => (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-8" />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div className="container mx-auto px-6 pt-6 pb-2 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Integrációk</h1>
            <p className="text-muted-foreground">
              Csatlakoztasd szolgáltatásaidat a számla automatizáláshoz
            </p>
          </div>
          <Badge variant="secondary" className="flex items-center gap-2 bg-primary/10 text-primary border-primary/20">
            <Zap className="h-4 w-4" />
            Automatizáció
          </Badge>
        </div>

        {/* Two Column Grid */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Email Alias Section */}
          <Card className="border-primary/10 hover:border-primary/20 transition-colors">
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl flex items-center justify-center border border-primary/20">
                  <AtSign className="w-6 h-6 text-primary" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">Email Alias-ok</CardTitle>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Hozz létre dedikált email címeket minden céghez. Add meg ezeket a címeket a számlázóknak, és a számlák automatikusan feldolgozásra kerülnek.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <CardDescription className="text-sm">
                    Automatikus számla fogadás
                  </CardDescription>
                  {/* Feature Pills */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-medium">
                      <Mail className="h-3 w-3" />
                      Dedikált címek
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-medium">
                      <Zap className="h-3 w-3" />
                      Azonnali feldolgozás
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-medium">
                      <Shield className="h-3 w-3" />
                      Biztonságos
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <EmailAliasManager />
            </CardContent>
          </Card>

          {/* NAV Integration Section */}
          <Card className="border-primary/10 hover:border-primary/20 transition-colors">
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl flex items-center justify-center border border-primary/20">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">NAV Online Számla</CardTitle>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Csatlakoztasd a NAV Online Számla rendszert a kimenő számlák automatikus szinkronizálásához.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <CardDescription className="text-sm">
                    Magyar NAV integráció
                  </CardDescription>
                  {/* Feature Pills */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                      <Shield className="h-3 w-3" />
                      Biztonságos
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                      <Zap className="h-3 w-3" />
                      Automatikus sync
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <Tabs value={activeNavTab} onValueChange={setActiveNavTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="credentials">Hitelesítés</TabsTrigger>
                  <TabsTrigger value="logs">Logok</TabsTrigger>
                </TabsList>
                
                <TabsContent value="credentials" className="mt-0">
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
                
                <TabsContent value="logs" className="mt-0">
                  <div className="rounded-lg border bg-card">
                    <div className="p-4 border-b">
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-primary" />
                        <span className="font-medium text-sm">Szinkronizálási Logok</span>
                        {logsLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                      </div>
                    </div>
                    
                    <div className="p-4 max-h-[600px] overflow-y-auto">
                      {logsLoading ? (
                        <LogsSkeleton />
                      ) : syncLogs.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          Még nincsenek szinkronizálási logok.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {syncLogs.map((log) => (
                            <div key={log.id} className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Badge variant={log.invoice_direction === 'OUTBOUND' ? 'default' : 'secondary'} className="text-xs">
                                    {log.invoice_direction === 'OUTBOUND' ? 'Kimenő' : 'Bejövő'}
                                  </Badge>
                                  {getStatusBadge(log.status)}
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {log.invoices_fetched} számla
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>{formatDate(log.started_at)}</span>
                                <span>{log.duration_ms ? `${Math.round(log.duration_ms / 1000)}s` : '-'}</span>
                              </div>
                              {log.error_message && (
                                <div className="mt-2 p-2 rounded bg-destructive/10 border border-destructive/20">
                                  <div className="flex items-start gap-2">
                                    <AlertTriangle className="w-3.5 h-3.5 text-destructive mt-0.5 flex-shrink-0" />
                                    <p className="text-xs text-destructive/90 break-all">{log.error_message}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default Integrations;
