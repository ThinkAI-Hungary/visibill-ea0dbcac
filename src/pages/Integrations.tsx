import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, Zap, Shield, AtSign, Info, Activity, CheckCircle, XCircle, Clock, AlertTriangle, Loader2, Upload, Database, FileText } from 'lucide-react';
import EmailAliasManager from '@/components/EmailAliasManager';
import EmailSettingsForm from '@/components/integrations/EmailSettingsForm';
import NavCredentialsForm from '@/components/nav/NavCredentialsForm';
import SzamlazzAgentForm from '@/components/integrations/SzamlazzAgentForm';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { ContentSkeleton } from '@/components/ui/content-skeleton';
import { cn } from '@/lib/utils';

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
  const { user } = useAuth();
  const { selectedCompany, loading: companyLoading } = useCompany();
  const isOwner = selectedCompany?.owner_id === user?.id;
  const [activeNavTab, setActiveNavTab] = useState('credentials');

  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [dmpFile, setDmpFile] = useState<File | null>(null);
  const [relaxUploading, setRelaxUploading] = useState(false);

  const compareNames = (name1: string, name2: string): boolean => {
    const normalize = (name: string) => {
      return name
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '')
        .replace(/\s+/g, '')
        .replace(/\b(kft|bt|zrt|nyrt|kkt|ev|egyeni\s*vallalkozo)\b/gi, '');
    };
    const norm1 = normalize(name1);
    const norm2 = normalize(name2);
    return norm1 === norm2 || norm1.includes(norm2) || norm2.includes(norm1);
  };

  const validateXmlFile = (file: File, activeCompanyName: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const match = text.match(/<Cegadatok>[\s\S]*?<Nev>([^<]+)<\/Nev>/);
        const fileCompanyName = match ? match[1].trim() : null;
        if (!fileCompanyName) {
          const generalMatch = text.match(/<Nev>([^<]+)<\/Nev>/);
          const fbName = generalMatch ? generalMatch[1].trim() : null;
          if (!fbName) {
            resolve(true);
            return;
          }
          resolve(compareNames(fbName, activeCompanyName));
          return;
        }
        resolve(compareNames(fileCompanyName, activeCompanyName));
      };
      reader.onerror = () => resolve(true);
      reader.readAsText(file.slice(0, 102400), "UTF-8");
    });
  };

  const validateDmpFile = (file: File, activeCompanyName: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const match = text.match(/INSERT INTO mv_ugyfelek VALUES \([^,]+,'([^']+)'/i);
        const fileCompanyName = match ? match[1].trim() : null;
        if (!fileCompanyName) {
          resolve(true);
          return;
        }
        resolve(compareNames(fileCompanyName, activeCompanyName));
      };
      reader.onerror = () => resolve(true);
      reader.readAsText(file.slice(0, 204800), "latin1");
    });
  };

  const handleXmlChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!selectedCompany?.name) {
      toast({ title: 'Válassz ki egy aktív céget előbb!', variant: 'destructive' });
      return;
    }

    const isValid = await validateXmlFile(file, selectedCompany.name);
    if (!isValid) {
      toast({
        title: 'Safeguard Hiba',
        description: `Az XML fájlban található cégnév nem egyezik az aktívan kiválasztott cég nevével (${selectedCompany.name})!`,
        variant: 'destructive',
      });
      if (e.target) e.target.value = '';
      setXmlFile(null);
      return;
    }

    setXmlFile(file);
  };

  const handleDmpChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!selectedCompany?.name) {
      toast({ title: 'Válassz ki egy aktív céget előbb!', variant: 'destructive' });
      return;
    }

    const isValid = await validateDmpFile(file, selectedCompany.name);
    if (!isValid) {
      toast({
        title: 'Safeguard Hiba',
        description: `A DMP fájlban található cégnév nem egyezik az aktívan kiválasztott cég nevével (${selectedCompany.name})!`,
        variant: 'destructive',
      });
      if (e.target) e.target.value = '';
      setDmpFile(null);
      return;
    }

    setDmpFile(file);
  };

  const handleRelaxUpload = async () => {
    if (!xmlFile || !selectedCompany?.id) return;

    setRelaxUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const xmlSafeName = xmlFile.name
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9._-]/g, '');
      const xmlPath = `audit-xml/${selectedCompany.id}/${xmlSafeName}`;
      const { error: xmlErr } = await supabase.storage
        .from('gl_uploads')
        .upload(xmlPath, xmlFile, { upsert: true });

      if (xmlErr) throw new Error(`XML feltöltési hiba: ${xmlErr.message}`);

      let storagePathVal = xmlPath;

      if (dmpFile) {
        const dmpSafeName = dmpFile.name
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, '_')
          .replace(/[^a-zA-Z0-9._-]/g, '');
        const dmpPath = `audit-dmp/${selectedCompany.id}/${dmpSafeName}`;
        const { error: dmpErr } = await supabase.storage
          .from('gl_uploads')
          .upload(dmpPath, dmpFile, { upsert: true });

        if (dmpErr) throw new Error(`DMP feltöltési hiba: ${dmpErr.message}`);

        storagePathVal = `${xmlPath};${dmpPath}`;
      }

      const { error: dbErr } = await supabase
        .from('gl_audit_imports')
        .insert({
          company_id: selectedCompany.id,
          file_name: xmlFile.name,
          storage_path: storagePathVal,
          period_start: '2022-01-01',
          period_end: '2026-12-31',
          processing_status: 'pending',
          imported_by: user?.id || null,
          dry_run: false
        });

      if (dbErr) throw new Error(`Adatbázis hiba: ${dbErr.message}`);

      toast({
        title: 'Sikeres feltöltés!',
        description: 'A Relax fájl(ok) feldolgozása elindult a háttérben.',
        className: 'bg-green-50 text-green-900 border-green-200',
      });

      setXmlFile(null);
      setDmpFile(null);
    } catch (err: any) {
      toast({
        title: 'Hiba a feltöltés során',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setRelaxUploading(false);
    }
  };

  const { data: syncLogs = [], isLoading: logsLoading } = useQuery({
    queryKey: queryKeys.syncLogs(selectedCompany?.id || ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nav_sync_logs')
        .select('id, status, sync_type, invoice_direction, invoices_fetched, error_message, started_at, completed_at, duration_ms, date_from, date_to')
        .eq('company_id', selectedCompany!.id)
        .order('started_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as SyncLog[];
    },
    enabled: !!selectedCompany?.id,
    staleTime: 2 * 60 * 1000,
  });

  if (companyLoading) {
    return <ContentSkeleton />;
  }

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
      <div className="container mx-auto px-6 pt-6 pb-12 space-y-8 page-animate">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Integrációk</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Csatlakoztasd szolgáltatásaidat és felületeidet a számlák automatikus szinkronizálásához
            </p>
          </div>
          <Badge variant="secondary" className="flex items-center gap-2 bg-primary/10 text-primary border-primary/20 px-3 py-1 text-xs">
            <Zap className="h-4 w-4" />
            Automatizáció
          </Badge>
        </div>

        {/* ── ROW 1: E-mail & Számlázz.hu Agent (2 Oszlopos kiegyenlített rács) ── */}
        <div className="grid lg:grid-cols-2 gap-6 items-stretch">
          {/* Email Services Section */}
          <Card className="border-primary/10 hover:border-primary/20 transition-colors h-full flex flex-col justify-between">
            <div>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl flex items-center justify-center border border-primary/20">
                    <AtSign className="w-6 h-6 text-primary" />
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">E-mail Integráció</CardTitle>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help ml-auto" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Fogadj számlákat a Visibill által generált e-mail aliasszal, vagy kapcsold össze saját levelező szerveredet (IMAP/SMTP).</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <CardDescription className="text-sm">
                      Automatikus számlafogadás és kézbesítés
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
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <Tabs defaultValue="alias" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="alias">Generált Alias</TabsTrigger>
                    <TabsTrigger value="custom-mail">Saját Levelező</TabsTrigger>
                  </TabsList>
                  <TabsContent value="alias" className="mt-0">
                    <EmailAliasManager />
                  </TabsContent>
                  <TabsContent value="custom-mail" className="mt-0">
                    <EmailSettingsForm />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </div>
          </Card>

          {/* Számlázz.hu Agent Integration */}
          <SzamlazzAgentForm />
        </div>

        {/* ── ROW 2: NAV Online Számla (Teljes szélességű tágas kártya) ── */}
        <Card className="border-primary/10 hover:border-primary/20 transition-colors">
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl flex items-center justify-center border border-primary/20">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">NAV Online Számla</CardTitle>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help ml-auto" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Csatlakoztasd a NAV Online Számla rendszert a kimenő és bejövő számlák automatikus szinkronizálásához.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <CardDescription className="text-sm">
                  Hivatalos magyar NAV API integráció
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
          <CardContent className="pt-2">
            <Tabs value={activeNavTab} onValueChange={setActiveNavTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4 max-w-md">
                <TabsTrigger value="credentials">Hitelesítés</TabsTrigger>
                <TabsTrigger value="logs">Szinkronizálási Logok</TabsTrigger>
              </TabsList>
              
              <TabsContent value="credentials" className="mt-0">
                <NavCredentialsForm 
                  companyId={selectedCompany?.id}
                  isOwner={isOwner}
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

        {/* ── ROW 3: Relax Adatimport (Teljes szélességű kártya) ── */}
        <Card className="border-primary/10 hover:border-primary/20 transition-colors">
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl flex items-center justify-center border border-primary/20">
                <Database className="w-6 h-6 text-primary" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-lg">Relax adatok importálása</CardTitle>
                <CardDescription className="text-sm">
                  Tölts fel Relax XML exportot és opcionális DMP dumpot történelmi adatok betöltéséhez
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              {/* XML Input */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">Relax XML Fájl (.xml) *</label>
                <div className="relative flex items-center justify-center border-2 border-dashed rounded-lg p-6 hover:bg-muted/30 transition-all cursor-pointer">
                  <input
                    type="file"
                    accept=".xml"
                    onChange={handleXmlChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center gap-1.5 text-center">
                    <FileText className={cn("w-6 h-6", xmlFile ? "text-emerald-500" : "text-muted-foreground/60")} />
                    <span className="text-xs font-medium truncate max-w-[200px]">
                      {xmlFile ? xmlFile.name : "Kattints a tallózáshoz..."}
                    </span>
                  </div>
                </div>
              </div>

              {/* DMP Input */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">Relax DMP Fájl (.dmp) (opcionális)</label>
                <div className="relative flex items-center justify-center border-2 border-dashed rounded-lg p-6 hover:bg-muted/30 transition-all cursor-pointer">
                  <input
                    type="file"
                    accept=".dmp"
                    onChange={handleDmpChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center gap-1.5 text-center">
                    <Database className={cn("w-6 h-6", dmpFile ? "text-emerald-500" : "text-muted-foreground/60")} />
                    <span className="text-xs font-medium truncate max-w-[200px]">
                      {dmpFile ? dmpFile.name : "Kattints a tallózáshoz..."}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t pt-4">
              <div className="text-xs text-muted-foreground">
                * Kötelező fájlok. A feltöltés előtt biztonsági ellenőrzés fut le a cégnevekre vonatkozóan.
              </div>
              <Button
                onClick={handleRelaxUpload}
                disabled={!xmlFile || relaxUploading}
                className="gap-2"
              >
                {relaxUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Feltöltés...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Importálás indítása
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
};

export default Integrations;
