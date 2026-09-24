import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Mail,
  Zap,
  Shield,
  AtSign,
  Info,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  Upload,
  Database,
  FileText,
  Landmark,
  Receipt,
  ChevronRight,
} from 'lucide-react';
import EmailAliasManager from '@/components/EmailAliasManager';
import EmailSettingsForm from '@/components/integrations/EmailSettingsForm';
import NavCredentialsForm from '@/components/nav/NavCredentialsForm';
import SzamlazzAgentForm from '@/components/integrations/SzamlazzAgentForm';
import { Aggreg8BankConnections } from '@/components/banking/Aggreg8BankConnections';
import { ApiKeysCard } from '@/components/settings/ApiKeysCard';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAggreg8 } from '@/hooks/useAggreg8';
import { useUserRole } from '@/hooks/useUserRole';
import { ContentSkeleton } from '@/components/ui/content-skeleton';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { useCompanyJurisdiction } from '@/hooks/useCompanyJurisdiction';

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
  const { t } = useTranslation(['navigation', 'common', 'settings']);
  const { toast } = useToast();
  const { user } = useAuth();
  const { selectedCompany, loading: companyLoading } = useCompany();
  const { role } = useUserRole();
  const isOwner = selectedCompany?.owner_id === user?.id || role === 'owner';
  const { hasNavIntegration } = useCompanyJurisdiction();

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'banking';
  const setActiveTab = (tabId: string) => {
    setSearchParams({ tab: tabId }, { replace: true });
  };

  useEffect(() => {
    if (!hasNavIntegration && activeTab === 'nav') {
      setActiveTab('banking');
    }
  }, [hasNavIntegration, activeTab]);

  const { consents = [] } = useAggreg8(selectedCompany?.id || '');

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
          dry_run: false,
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
    enabled: !!selectedCompany?.id && hasNavIntegration,
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

  // Master-Detail Navigációs csoportok és elemek (jurisdiction-tudatos)
  const INTEGRATION_NAV = useMemo(() => {
    const rawNav = [
      {
        group: 'Pénzintézet & Hatóság',
        items: [
          {
            id: 'banking',
            title: 'Banki Szinkronizáció',
            subtitle: 'Valós idejű kapcsolat (Aggreg8)',
            icon: Landmark,
            color: 'text-sky-600 bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800',
            badgeText: consents.length > 0 ? `${consents.length} bank` : 'Nincs kapcsolat',
            badgeClass: consents.length > 0
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
              : 'bg-muted text-muted-foreground',
          },
          ...(hasNavIntegration
            ? [
                {
                  id: 'nav',
                  title: 'NAV Online Számla',
                  subtitle: '3.0 Rendszerkapcsolat & Szinkron',
                  icon: Shield,
                  color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
                  badgeText: syncLogs.length > 0 ? 'Aktív' : 'Beállítás',
                  badgeClass: syncLogs.length > 0
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                    : 'bg-muted text-muted-foreground',
                },
              ]
            : []),
        ],
      },
      {
        group: 'Számlázás & Dokumentum',
        items: [
          {
            id: 'szamlazz',
            title: 'Számlázz.hu Agent',
            subtitle: 'Közvetlen számlaátvétel',
            icon: Receipt,
            color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
            badgeText: 'Agent API',
            badgeClass: 'bg-muted text-muted-foreground',
          },
          {
            id: 'email',
            title: 'E-mail Számlafogadás',
            subtitle: 'Alias & Saját IMAP/SMTP',
            icon: Mail,
            color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800',
            badgeText: 'Alias aktív',
            badgeClass: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border-purple-200 dark:border-purple-800',
          },
          {
            id: 'relax',
            title: 'Relax Adatimport',
            subtitle: 'XML és DMP könyvelési import',
            icon: Database,
            color: 'text-teal-600 bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800',
            badgeText: 'Archívum',
            badgeClass: 'bg-muted text-muted-foreground',
          },
        ],
      },
      {
        group: 'Fejlesztők & Rendszer',
        items: [
          {
            id: 'api',
            title: 'REST API & Kulcsok',
            subtitle: 'M2M kapcsolatok & Webhookok',
            icon: Zap,
            color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800',
            badgeText: 'API hozzáférés',
            badgeClass: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
          },
        ],
      },
    ];
    return rawNav.filter(group => group.items.length > 0);
  }, [hasNavIntegration, consents.length, syncLogs.length]);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="container mx-auto px-4 sm:px-6 pt-6 pb-12 space-y-6 page-animate">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{t('settings:integrations.title', 'Integrációk')}</h1>
              <Badge variant="secondary" className="flex items-center gap-1.5 bg-primary/10 text-primary border-primary/20 px-2.5 py-0.5 text-xs">
                <Zap className="h-3.5 w-3.5" />
                {t('settings:integrations.badge_automation', 'Automatizáció')}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              {t('settings:integrations.subtitle', 'Csatlakoztasd szolgáltatásaidat és felületeidet a számlák és banki adatok automatikus szinkronizálásához.')}
            </p>
          </div>

          {selectedCompany?.name && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card shadow-xs text-xs font-semibold text-foreground shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{selectedCompany.name}</span>
            </div>
          )}
        </div>

        {/* Mobil Görgethető Választó (Csak lg méret alatt látható) */}
        <div className="lg:hidden overflow-x-auto pb-2 flex gap-2 no-scrollbar">
          {INTEGRATION_NAV.flatMap((g) => g.items).map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border shrink-0",
                  isActive
                    ? "bg-primary/10 text-primary border-primary/30 shadow-xs font-semibold"
                    : "bg-card text-foreground border-border hover:bg-muted"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.title}</span>
              </button>
            );
          })}
        </div>

        {/* Master-Detail Split View Grid (300px bal oszlop + 1fr jobb munkaterület) */}
        <div className="grid lg:grid-cols-[300px_1fr] gap-6 items-start">
          
          {/* 1. Master Sidebar (Desktop) */}
          <Card className="hidden lg:block border border-border shadow-xs p-3 space-y-5 sticky top-20">
            {INTEGRATION_NAV.map((group, gIdx) => (
              <div key={gIdx} className="space-y-1.5">
                <div className="px-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
                  {group.group}
                </div>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={cn(
                          "w-full flex items-center justify-between p-2.5 rounded-lg text-left transition-all border group",
                          isActive
                            ? "bg-primary/10 border-primary/30 shadow-xs text-foreground font-medium"
                            : "bg-transparent border-transparent hover:bg-muted/70 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={cn("p-2 rounded-lg border shrink-0 transition-colors", item.color)}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className={cn("text-xs font-semibold truncate", isActive ? "text-primary" : "text-foreground group-hover:text-foreground")}>
                              {item.title}
                            </div>
                            <div className={cn("text-[11px] truncate", isActive ? "text-primary/70" : "text-muted-foreground")}>
                              {item.subtitle}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", item.badgeClass)}>
                            {item.badgeText}
                          </Badge>
                          <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground/50 transition-transform", isActive && "text-primary translate-x-0.5")} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </Card>

          {/* 2. Detail Canvas */}
          <div className="min-w-0 space-y-6">
            
            {/* ── PANEL 1: Élő Banki Kapcsolatok (PSD2 Open Banking - Aggreg8) ── */}
            <div className={activeTab === 'banking' ? 'block' : 'hidden'}>
              {selectedCompany?.id ? (
                <Aggreg8BankConnections companyId={selectedCompany.id} isOwner={isOwner} />
              ) : (
                <Card className="border border-border p-8 text-center text-muted-foreground text-sm">
                  Kérjük, válassz ki egy aktív céget a banki kapcsolatok kezeléséhez.
                </Card>
              )}
            </div>

            {/* ── PANEL 2: NAV Online Számla ── */}
            {hasNavIntegration && (
              <div className={activeTab === 'nav' ? 'block' : 'hidden'}>
              <Card className="border-primary/10 hover:border-primary/20 transition-colors shadow-xs">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl flex items-center justify-center border border-primary/20">
                      <Shield className="w-6 h-6 text-primary" />
                    </div>
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{t('settings:integrations.nav.title', 'NAV Online Számla')}</CardTitle>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground cursor-help ml-auto" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>{t('settings:integrations.nav.tooltip', 'Csatlakoztasd a NAV Online Számla rendszert a kimenő és bejövő számlák automatikus szinkronizálásához.')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <CardDescription className="text-sm">
                        {t('settings:integrations.nav.subtitle', 'Hivatalos magyar NAV API integráció (3.0)')}
                      </CardDescription>
                      {/* Feature Pills */}
                      <div className="flex flex-wrap gap-2 pt-1">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                          <Shield className="h-3 w-3" />
                          {t('settings:integrations.nav.badge_secure', 'Biztonságos')}
                        </div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                          <Zap className="h-3 w-3" />
                          {t('settings:integrations.nav.badge_autosync', 'Automatikus sync')}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-2">
                  <Tabs value={activeNavTab} onValueChange={setActiveNavTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4 max-w-md">
                      <TabsTrigger value="credentials">{t('settings:integrations.credentials', 'Hitelesítés')}</TabsTrigger>
                      <TabsTrigger value="logs">{t('settings:integrations.sync_logs', 'Szinkronizálási Logok')}</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="credentials" className="mt-0">
                      <NavCredentialsForm 
                        companyId={selectedCompany?.id}
                        isOwner={isOwner}
                        onCredentialsSaved={() => {
                          toast({
                            title: t('settings:integrations.nav.toast_credentials_updated_title', 'Hitelesítő adatok frissítve'),
                            description: t('settings:integrations.nav.toast_credentials_updated_desc', 'A NAV API hitelesítő adatok sikeresen frissítve'),
                          });
                        }} 
                      />
                    </TabsContent>
                    
                    <TabsContent value="logs" className="mt-0">
                      <div className="rounded-lg border bg-card">
                        <div className="p-4 border-b">
                          <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-primary" />
                            <span className="font-medium text-sm">{t('settings:integrations.sync_logs', 'Szinkronizálási Logok')}</span>
                            {logsLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                          </div>
                        </div>
                        
                        <div className="p-4 max-h-[600px] overflow-y-auto">
                          {logsLoading ? (
                            <LogsSkeleton />
                          ) : syncLogs.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground text-sm">
                              {t('settings:integrations.nav.logs_empty', 'Még nincsenek szinkronizálási logok.')}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {syncLogs.map((log) => (
                                <div key={log.id} className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Badge variant={log.invoice_direction === 'OUTBOUND' ? 'default' : 'secondary'} className="text-xs">
                                        {log.invoice_direction === 'OUTBOUND' ? t('settings:integrations.nav.direction_outbound', 'Kimenő') : t('settings:integrations.nav.direction_inbound', 'Bejövő')}
                                      </Badge>
                                      {getStatusBadge(log.status)}
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                      {t('settings:integrations.nav.invoices_count', { count: log.invoices_fetched, defaultValue: `${log.invoices_fetched} számla` })}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>{formatDate(log.started_at)}</span>
                                    <span>{log.duration_ms ? `${Math.round(log.duration_ms / 1000)}s` : '-'}</span>
                                  </div>
                                  {log.error_message && (
                                    <div className="mt-2 p-2 rounded bg-destructive/10 border border-destructive/20">
                                      <div className="flex items-start gap-2">
                                        <AlertTriangle className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0" />
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
            )}

            {/* ── PANEL 3: Számlázz.hu Agent ── */}
            <div className={activeTab === 'szamlazz' ? 'block' : 'hidden'}>
              <SzamlazzAgentForm />
            </div>

            {/* ── PANEL 4: E-mail Számlafogadás ── */}
            <div className={activeTab === 'email' ? 'block' : 'hidden'}>
              <Card className="border-primary/10 hover:border-primary/20 transition-colors shadow-xs">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl flex items-center justify-center border border-primary/20">
                      <AtSign className="w-6 h-6 text-primary" />
                    </div>
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{t('settings:integrations.email.title', 'E-mail Integráció')}</CardTitle>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground cursor-help ml-auto" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>{t('settings:integrations.email.tooltip', 'Fogadj számlákat a Visibill által generált e-mail aliasszal, vagy kapcsold össze saját levelező szerveredet (IMAP/SMTP).')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <CardDescription className="text-sm">
                        {t('settings:integrations.email.subtitle', 'Automatikus számlafogadás és kézbesítés')}
                      </CardDescription>
                      {/* Feature Pills */}
                      <div className="flex flex-wrap gap-2 pt-1">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-medium">
                          <Mail className="h-3 w-3" />
                          {t('settings:integrations.email.dedicated_addresses', 'Dedikált címek')}
                        </div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-medium">
                          <Zap className="h-3 w-3" />
                          {t('settings:integrations.email.instant_processing', 'Azonnali feldolgozás')}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-2">
                  <Tabs defaultValue="alias" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4 max-w-md">
                      <TabsTrigger value="alias">{t('settings:integrations.generated_alias', 'Generált Alias')}</TabsTrigger>
                      <TabsTrigger value="custom-mail">{t('settings:integrations.custom_mail', 'Saját Levelező')}</TabsTrigger>
                    </TabsList>
                    <TabsContent value="alias" className="mt-0">
                      <EmailAliasManager />
                    </TabsContent>
                    <TabsContent value="custom-mail" className="mt-0">
                      <EmailSettingsForm />
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>

            {/* ── PANEL 5: Relax Adatimport ── */}
            <div className={activeTab === 'relax' ? 'block' : 'hidden'}>
              <Card className="border-primary/10 hover:border-primary/20 transition-colors shadow-xs">
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

            {/* ── PANEL 6: Hivatalos REST API & Programozói Hozzáférés ── */}
            <div className={activeTab === 'api' ? 'block' : 'hidden'}>
              <ApiKeysCard />
            </div>

          </div>

        </div>
      </div>
    </TooltipProvider>
  );
};

export default Integrations;
