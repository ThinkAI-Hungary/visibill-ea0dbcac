import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Shield,
  Zap,
  CheckCircle,
  XCircle,
  Clock,
  Copy,
  Check,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Users,
  Calendar,
  FileText,
  Trash2,
  Info,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Link2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface NavUpoM2mCardProps {
  companyId?: string;
  isOwner?: boolean;
}

interface CredentialStatus {
  is_connected: boolean;
  status: string;
  client_id: string;
  username_masked?: string;
  environment: 'production' | 'development';
  last_validated_at?: string | null;
  last_sync_at?: string | null;
  auto_efo_sync_enabled: boolean;
  auto_employee_sync_enabled: boolean;
  error_message?: string | null;
}

interface AccountantCredStatus {
  has_active_accountant_cred: boolean;
  source_company_id?: string;
  source_company_name?: string;
  username_masked?: string;
  environment?: 'production' | 'development';
  client_id?: string;
  last_validated_at?: string | null;
  total_companies_count: number;
  already_connected_count: number;
  unconnected_count: number;
}

interface AuditLogEntry {
  id: string;
  created_at: string;
  action: string;
  endpoint: string;
  status_code: number;
  result_code: string;
  result_message: string;
  duration_ms: number;
  request_id: string;
}

export interface EfoEntry {
  id: string;
  company_id: string;
  tax_id: string;
  name: string;
  taj_number: string | null;
  target_year: number;
  days_alkalmi: number;
  days_mezogazdasag: number;
  days_turisztika: number;
  days_filmipar: number;
  days_total_used: number;
  days_total_available: number;
  days_agri_available: number;
  last_sync_at: string;
}

const PROD_CLIENT_ID = 'kD67QsLcF8';
const DEV_CLIENT_ID = '8WRh8DdR8p';

export const NavUpoM2mCard: React.FC<NavUpoM2mCardProps> = ({ companyId, isOwner = true }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'main' | 'efo' | 'audit'>('main');
  const [environment, setEnvironment] = useState<'production' | 'development'>('production');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showAdvancedFields, setShowAdvancedFields] = useState(false);
  const [customUsername, setCustomUsername] = useState('');
  const [customPassword, setCustomPassword] = useState('');
  const [customKeyPart1, setCustomKeyPart1] = useState('');
  const [customNonce, setCustomNonce] = useState('');
  const [copiedClientId, setCopiedClientId] = useState(false);

  const activeClientId = environment === 'production' ? PROD_CLIENT_ID : DEV_CLIENT_ID;

  // 1. Lekérdezzük a státuszt a biztonságos SECURITY DEFINER RPC-n keresztül
  const {
    data: statusData,
    isLoading: isStatusLoading,
    refetch: refetchStatus,
  } = useQuery<CredentialStatus>({
    queryKey: ['nav-upo-status', companyId, environment],
    queryFn: async () => {
      if (!companyId) throw new Error('Nincs kiválasztva cég');
      const { data, error } = await supabase.rpc('get_upo_credentials_status', {
        p_company_id: companyId,
        p_env: environment,
      });
      if (error) throw error;
      return data as CredentialStatus;
    },
    enabled: !!companyId,
    staleTime: 30000,
  });

  // 1b. Felhasználó aktív könyvelői hitelesítésének ellenőrzése más cégekből
  const {
    data: accountantCred,
    refetch: refetchAccountantCred,
  } = useQuery<AccountantCredStatus>({
    queryKey: ['nav-upo-accountant-cred', environment],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_user_accountant_upo_status', {
        p_env: environment,
      });
      if (error) throw error;
      return data as AccountantCredStatus;
    },
    staleTime: 10000,
  });

  // Könyvelői kulcs átvétele / kiterjesztése mutáció (akár 200+ cégre)
  const adoptMutation = useMutation({
    mutationFn: async ({ applyToAll }: { applyToAll: boolean }) => {
      if (!companyId && !applyToAll) throw new Error('Nincs kiválasztott cég!');
      const { data, error } = await supabase.rpc('adopt_upo_credentials', {
        p_target_company_id: companyId,
        p_env: environment,
        p_apply_to_all: applyToAll,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Sikeres kapcsolat beállítás!',
        description: data?.message || 'A könyvelői NAV kapcsolat sikeresen hozzárendelve.',
      });
      refetchStatus();
      refetchAccountantCred();
      queryClient.invalidateQueries({ queryKey: ['nav-upo-status'] });
      queryClient.invalidateQueries({ queryKey: ['nav-upo-audit-logs', companyId] });
      queryClient.invalidateQueries({ queryKey: ['nav-upo-accountant-cred'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Hiba a kapcsolat átvételekor',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  // 2. Audit napló lekérdezése
  const {
    data: auditLogs = [],
    isLoading: isLogsLoading,
    refetch: refetchAuditLogs,
  } = useQuery<AuditLogEntry[]>({
    queryKey: ['nav-upo-audit-logs', companyId, environment],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('nav_m2m_audit_logs')
        .select('*')
        .eq('company_id', companyId)
        .eq('environment', environment)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as AuditLogEntry[];
    },
    enabled: !!companyId && activeTab === 'audit',
    staleTime: 10000,
  });

  // 3. EFO bejegyzések lekérdezése
  const {
    data: efoEntries = [],
    isLoading: isEfoLoading,
    refetch: refetchEfoEntries,
  } = useQuery<EfoEntry[]>({
    queryKey: ['accounty-efo-entries', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('accounty_efo_entries')
        .select('*')
        .eq('company_id', companyId)
        .order('name', { ascending: true });
      if (error) throw error;
      return (data || []) as EfoEntry[];
    },
    enabled: !!companyId,
    staleTime: 10000,
  });

  // 4. Dolgozók létszáma
  const {
    data: employees = [],
    isLoading: isEmployeesLoading,
  } = useQuery({
    queryKey: ['accounty-employees', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('accounty_employees')
        .select('id, first_name, last_name, tax_id, taj_number, status')
        .eq('company_id', companyId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
    staleTime: 10000,
  });

  // Másolás vágólapra
  const handleCopyClientId = () => {
    navigator.clipboard.writeText(activeClientId);
    setCopiedClientId(true);
    setTimeout(() => setCopiedClientId(false), 2000);
    toast({
      title: 'Kliensazonosító másolva!',
      description: `${activeClientId} a vágólapra került. Illeszd be a NAV Ügyfélportál felületén.`,
    });
  };

  // Teszt adatok automatikus kitöltése (Sandbox teszthez)
  const handlePrefillSandbox = () => {
    setApiKeyInput('U3VjYLldpTostHdsoNKLyAxBGX6hqa6i1tdpJmrF');
    setCustomUsername('U3VjYLldpT');
    setCustomPassword('ostHdsoNKL');
    setCustomKeyPart1('yAxBGX6hqa');
    setCustomNonce('6i1tdpJmrF');
    toast({
      title: 'Teszt sandbox adatok betöltve',
      description: 'A NAV tesztkörnyezeti demó adatai kitöltve. Kattints az aktiválásra!',
    });
  };

  // Biztonságos proxy hívó, amely kinyeri az Edge Function és a NAV részletes hibaüzenetét
  const invokeNavM2mProxy = async (body: Record<string, any>) => {
    const { data, error } = await supabase.functions.invoke('nav-m2m-proxy', { body });
    if (error) {
      let errorMsg = error.message;
      try {
        if ('context' in error && error.context && typeof (error.context as any).json === 'function') {
          const bodyJson = await (error.context as Response).clone().json();
          if (bodyJson?.error) {
            errorMsg = bodyJson.error;
            if (bodyJson.resultMessage && bodyJson.resultMessage !== bodyJson.error) {
              errorMsg += ` (NAV válasz: ${bodyJson.resultMessage})`;
            }
          }
        }
      } catch (_) {}
      throw new Error(errorMsg);
    }
    if (data?.error) {
      throw new Error(data.error + (data.resultMessage ? ` (NAV válasz: ${data.resultMessage})` : ''));
    }
    return data;
  };

  // Aktiválási mutáció
  const activateMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('Nincs kiválasztott cég!');

      const payload: Record<string, any> = {
        action: 'activate',
        company_id: companyId,
        environment,
      };

      if (apiKeyInput.trim().length === 40) {
        payload.api_key = apiKeyInput.trim();
      } else if (customUsername && customPassword && customKeyPart1 && customNonce) {
        payload.username = customUsername.trim();
        payload.password = customPassword.trim();
        payload.key_part_1 = customKeyPart1.trim();
        payload.nonce = customNonce.trim();
      } else {
        throw new Error('Kérjük, add meg a 40 karakteres API kulcsot, vagy töltsd ki mind a 4 mezőt!');
      }

      return await invokeNavM2mProxy(payload);
    },
    onSuccess: (data) => {
      toast({
        title: 'Sikeres aktiválás!',
        description: data.message || 'A NAV M2M gép-gép kapcsolat aktív és használatra kész.',
      });
      setApiKeyInput('');
      setCustomUsername('');
      setCustomPassword('');
      setCustomKeyPart1('');
      setCustomNonce('');
      queryClient.invalidateQueries({ queryKey: ['nav-upo-status', companyId] });
      queryClient.invalidateQueries({ queryKey: ['nav-upo-audit-logs', companyId] });
      queryClient.invalidateQueries({ queryKey: ['nav-upo-accountant-cred'] });
      refetchAccountantCred();
    },
    onError: (err: any) => {
      toast({
        title: 'Aktiválási hiba',
        description: err.message || 'Nem sikerült a kapcsolat aktiválása a NAV-val.',
        variant: 'destructive',
      });
    },
  });

  // Dolgozói szinkronizáció mutáció
  const syncEmployeesMutation = useMutation({
    mutationFn: async () => {
      return await invokeNavM2mProxy({
        action: 'sync_employees',
        company_id: companyId,
        environment,
        jogviszony_tipus: 'NYITOTT',
      });
    },
    onSuccess: (data) => {
      const count = data.synced_count ?? data.foglalkoztatottak?.length ?? 0;
      if (data.is_pending) {
        toast({
          title: 'Szinkronizáció folyamatban a NAV-nál',
          description: 'A NAV szervere még készíti az adatállományt. Pár perc múlva próbáld újra!',
        });
      } else {
        toast({
          title: 'Dolgozói jogviszonyok szinkronizálva!',
          description: `${count} munkavállaló adatai és T1041 biztosítási jogviszonyai sikeresen frissítve.`,
        });
      }
      refetchStatus();
      queryClient.invalidateQueries({ queryKey: ['nav-upo-audit-logs', companyId] });
      queryClient.invalidateQueries({ queryKey: ['accounty-employees', companyId] });
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Hiba a dolgozók lekérdezésekor',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  // EFO szinkronizáció mutáció
  const syncEfoMutation = useMutation({
    mutationFn: async () => {
      return await invokeNavM2mProxy({
        action: 'sync_efo',
        company_id: companyId,
        environment,
        target_year: new Date().getFullYear(),
      });
    },
    onSuccess: (data) => {
      toast({
        title: 'EFO alkalmi munka napok lekérdezve!',
        description: `${data.count ?? 0} fő egyszerűsített foglalkoztatási adatai és felhasznált napjai frissítve.`,
      });
      refetchStatus();
      refetchEfoEntries();
      queryClient.invalidateQueries({ queryKey: ['accounty-efo-entries', companyId] });
      queryClient.invalidateQueries({ queryKey: ['nav-upo-audit-logs', companyId] });
      queryClient.invalidateQueries({ queryKey: ['accounty-employees', companyId] });
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Hiba az EFO adatok szinkronizálásakor',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  // Health Check / KOMA mutáció
  const testHealthMutation = useMutation({
    mutationFn: async () => {
      return await invokeNavM2mProxy({
        action: 'test_health',
        company_id: companyId,
        environment,
      });
    },
    onSuccess: (data) => {
      toast({
        title: 'NAV kapcsolat rendben!',
        description: `Hitelesítés és aláírás érvényes. NAV eredménykód: ${data.resultCode}`,
      });
      queryClient.invalidateQueries({ queryKey: ['nav-upo-audit-logs', companyId] });
    },
    onError: (err: any) => {
      toast({
        title: 'Kapcsolati ellenőrzés sikertelen',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  // Automatikus szinkron kapcsolók
  const toggleAutoSyncMutation = useMutation({
    mutationFn: async ({ autoEfo, autoEmployee }: { autoEfo?: boolean; autoEmployee?: boolean }) => {
      return await invokeNavM2mProxy({
        action: 'toggle_auto_sync',
        company_id: companyId,
        environment,
        auto_efo: autoEfo,
        auto_employee: autoEmployee,
      });
    },
    onSuccess: () => {
      toast({
        title: 'Beállítások elmentve',
        description: 'Az automatikus háttérszinkronizációs szabályok frissültek.',
      });
      refetchStatus();
    },
    onError: (err: any) => {
      toast({
        title: 'Hiba a mentés során',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  // Kapcsolat bontása és kulcsok végleges megsemmisítése
  const revokeMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) return;
      const { data, error } = await supabase.rpc('revoke_upo_credentials', {
        p_company_id: companyId,
        p_env: environment,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: 'NAV kapcsolat felbontva',
        description: 'Az aláírókulcsok és azonosítók véglegesen törölve lettek az adatbázisból.',
      });
      queryClient.invalidateQueries({ queryKey: ['nav-upo-status', companyId] });
      queryClient.invalidateQueries({ queryKey: ['nav-upo-audit-logs', companyId] });
      queryClient.invalidateQueries({ queryKey: ['nav-upo-accountant-cred'] });
      refetchAccountantCred();
    },
    onError: (err: any) => {
      toast({
        title: 'Hiba a kapcsolat bontásakor',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const isConnected = statusData?.is_connected ?? false;

  return (
    <Card className="border-primary/10 shadow-xs overflow-hidden">
      {/* Kártya Fejléc */}
      <CardHeader className="bg-muted/10 border-b border-border/50 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600/20 to-blue-600/5 rounded-xl flex items-center justify-center border border-blue-600/20 shrink-0">
              <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <CardTitle className="text-lg font-semibold tracking-tight">
                  NAV Ügyfélportál (ÜPO) M2M
                </CardTitle>
                {isStatusLoading ? (
                  <Badge variant="outline" className="text-xs">
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Betöltés...
                  </Badge>
                ) : isConnected ? (
                  <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1.5" />
                    Kapcsolódva (Aktív)
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    Nincs beállítva
                  </Badge>
                )}
                {environment === 'development' && (
                  <Badge variant="outline" className="border-amber-400/40 text-amber-600 bg-amber-500/10 text-[11px]">
                    Tesztkörnyezet (Sandbox)
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs mt-1">
                Kétirányú gép-gép interfész dolgozói jogviszonyok (T1041), EFO alkalmi munka és adózói adatok szinkronjához
              </CardDescription>
            </div>
          </div>

          {/* Környezet választó */}
          <div className="flex items-center gap-2 self-start sm:self-auto bg-card border border-border/80 rounded-lg p-1 text-xs">
            <button
              type="button"
              onClick={() => setEnvironment('production')}
              className={`px-3 py-1 rounded-md transition-colors font-medium ${
                environment === 'production'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Éles (m2m.nav.gov.hu)
            </button>
            <button
              type="button"
              onClick={() => setEnvironment('development')}
              className={`px-3 py-1 rounded-md transition-colors font-medium ${
                environment === 'development'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Teszt (Sandbox)
            </button>
          </div>
        </div>
      </CardHeader>

      {/* Fülek: Beállítások vs 90 napos Audit Napló */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <div className="px-6 border-b border-border/50 bg-muted/5">
          <TabsList className="bg-transparent border-0 p-0 h-11 gap-6">
            <TabsTrigger
              value="main"
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-11 px-1 font-medium text-xs"
            >
              Kapcsolat & Műveletek
            </TabsTrigger>
            <TabsTrigger
              value="efo"
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-11 px-1 font-medium text-xs flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5" />
              EFO Napkeretek
              {efoEntries.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border-0">
                  {efoEntries.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="audit"
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-11 px-1 font-medium text-xs flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              M2M Audit Napló (90 nap)
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── 1. FÜL: KAPCSOLAT & MŰVELETEK ── */}
        <TabsContent value="main" className="m-0 p-6 space-y-6">
          {/* HA NEM KAPCSOLÓDIK: BEÁLLÍTÁSI ÉS AKTIVÁLÁSI WIZARD */}
          {!isConnected ? (
            <div className="space-y-6">
              {/* KÖNYVELŐI KULCS GYORS ÁTVÉTELE (200 CÉGES TÁMOGATÁS) */}
              {accountantCred?.has_active_accountant_cred && (
                <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-50/40 dark:bg-blue-950/20 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">
                          Elérhető aktív könyvelői NAV M2M kapcsolat
                        </span>
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-300 font-mono text-[11px]">
                          {accountantCred.username_masked}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        A fiókodhoz már tartozik egy működő, NAV-nál hitelesített technikai felhasználó (Forrás: <strong className="text-foreground">{accountantCred.source_company_name}</strong>). Mivel a NAV-nál a képviseleti jogosultság a könyvelő személyéhez kötődik, nem szükséges új kulcsot igényelned!
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 self-start md:self-center shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => adoptMutation.mutate({ applyToAll: false })}
                      disabled={adoptMutation.isPending}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-xs"
                    >
                      {adoptMutation.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      ) : (
                        <Link2 className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      Kulcs átvétele ehhez a céghez
                    </Button>
                    {accountantCred.total_companies_count > 1 && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={adoptMutation.isPending}
                            className="text-xs border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                          >
                            Kiterjesztés mind a(z) {accountantCred.total_companies_count} cégemre
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Könyvelői NAV kapcsolat kiterjesztése</AlertDialogTitle>
                            <AlertDialogDescription className="text-xs space-y-2">
                              Biztosan szeretnéd a(z) <strong className="text-foreground">{accountantCred.username_masked}</strong> könyvelői NAV kapcsolatot egyszerre beállítani mind a(z) <strong className="text-foreground">{accountantCred.total_companies_count}</strong> általad kezelt cégnél?
                              <br /><br />
                              A NAV a lekérdezéseknél a képviseleti meghatalmazásod (EGYKE) alapján fogja engedélyezni az adatok elérését az összes cégednél.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="text-xs">Mégse</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => adoptMutation.mutate({ applyToAll: true })}
                              className="text-xs bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              Igen, kiterjesztés az összes cégemre
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              )}

              <Alert className="bg-blue-50/60 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertTitle className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                  Hogyan működik a NAV Ügyfélportál M2M kapcsolat?
                </AlertTitle>
                <AlertDescription className="text-xs text-blue-800/90 dark:text-blue-300/90 leading-relaxed mt-1">
                  A NAV ÜPO felületén hozhatsz létre gép-gép kapcsolatot az alábbi Kliensazonosító (Client ID) megadásával.
                  A NAV által generált 40 karakteres egyszer használatos kódot ide beillesztve a rendszer 72 órán belül automatikusan
                  aktiválja a biztonságos, titkosított kapcsolatot és kimenti a dolgozói adatokat.
                </AlertDescription>
              </Alert>

              {/* Lépések */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Lépés */}
                <div className="p-4 rounded-xl border border-border bg-card/60 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">
                      1
                    </span>
                    <span className="text-xs font-semibold text-foreground">Kliensazonosító megadása</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-normal">
                    Lépj be a NAV ÜPO-ba ({environment === 'production' ? 'upo.nav.gov.hu' : 'm2m-dev.nav.gov.hu'}), válaszd az Új gép-gép kapcsolatot.
                  </p>
                  <div className="pt-2 flex items-center justify-between gap-2 p-2 bg-muted/40 rounded-md border border-border/40">
                    <code className="text-xs font-mono font-bold text-foreground">{activeClientId}</code>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyClientId}
                      className="h-7 px-2 text-xs"
                    >
                      {copiedClientId ? <Check className="w-3.5 h-3.5 text-emerald-500 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                      {copiedClientId ? 'Másolva' : 'Másolás'}
                    </Button>
                  </div>
                </div>

                {/* 2. Lépés */}
                <div className="p-4 rounded-xl border border-border bg-card/60 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">
                      2
                    </span>
                    <span className="text-xs font-semibold text-foreground">Kód generálása a NAV-nál</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-normal">
                    A NAV rendszere generál egy 40 karakteres egyszer használatos hozzáférési kódot (username, password, kulcs, nonce).
                  </p>
                  <a
                    href={environment === 'production' ? 'https://upo.nav.gov.hu' : 'https://m2m-dev.nav.gov.hu'}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium pt-2"
                  >
                    Megnyitás a NAV-on <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {/* 3. Lépés */}
                <div className="p-4 rounded-xl border border-border bg-card/60 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">
                      3
                    </span>
                    <span className="text-xs font-semibold text-foreground">Aktiválás a Visibillben</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-normal">
                    Másold ki az egybefüggő 40 karaktert és illeszd be az alábbi mezőbe az azonnali titkosított kapcsolódáshoz.
                  </p>
                  <span className="inline-block text-[11px] text-emerald-600 dark:text-emerald-400 font-medium pt-2">
                    ✓ Érvényességi idő: 72 óra
                  </span>
                </div>
              </div>

              {/* Aktiválási Űrlap */}
              <div className="p-5 rounded-xl border border-border bg-muted/20 space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="apiKeyInput" className="text-xs font-semibold">
                      40 karakteres egyszer használatos kód (API Key)
                    </Label>
                    <span className={`text-[11px] font-mono ${apiKeyInput.length === 40 ? 'text-emerald-500 font-bold' : 'text-muted-foreground'}`}>
                      {apiKeyInput.length} / 40 karakter
                    </span>
                  </div>
                  <Input
                    id="apiKeyInput"
                    placeholder="Pl. U3VjYLldpTostHdsoNKLyAxBGX6hqa6i1tdpJmrF"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value.replace(/\s+/g, ''))}
                    className="font-mono text-sm tracking-wide bg-background"
                  />
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    💡 <strong>Fontos:</strong> Ha a kapcsolatot újra be kell állítani, a NAV ÜPO-ban ne egy korábbi felhasználó jelszavát módosítsd, hanem hozz létre egy <strong>„Új gép-gép kapcsolatot”</strong>! A NAV csak új kapcsolat generálásakor ad érvényes, egyszer használatos (Nonce) aktiváló kódot.
                  </p>
                </div>

                {/* Haladó külön mezők lenyitása */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowAdvancedFields(!showAdvancedFields)}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-medium transition-colors"
                  >
                    {showAdvancedFields ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    Különálló mezők megadása (Felhasználónév, Jelszó, Kulcs, Nonce)
                  </button>

                  {showAdvancedFields && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3">
                      <div className="space-y-1">
                        <Label className="text-[11px]">Felhasználónév (10 kar.)</Label>
                        <Input
                          placeholder="Pl. U3VjYLldpT"
                          value={customUsername}
                          onChange={(e) => setCustomUsername(e.target.value.trim())}
                          className="font-mono text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Felhasználó Jelszó (10 kar.)</Label>
                        <Input
                          type="password"
                          placeholder="Pl. ostHdsoNKL"
                          value={customPassword}
                          onChange={(e) => setCustomPassword(e.target.value.trim())}
                          className="font-mono text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Aláírókulcs 1. fele (10 kar.)</Label>
                        <Input
                          placeholder="Pl. yAxBGX6hqa"
                          value={customKeyPart1}
                          onChange={(e) => setCustomKeyPart1(e.target.value.trim())}
                          className="font-mono text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Nonce kód (10 kar.)</Label>
                        <Input
                          placeholder="Pl. 6i1tdpJmrF"
                          value={customNonce}
                          onChange={(e) => setCustomNonce(e.target.value.trim())}
                          className="font-mono text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  {environment === 'development' ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handlePrefillSandbox}
                      className="text-xs border-amber-300 text-amber-700 dark:text-amber-400"
                    >
                      Teszt Sandbox adatok betöltése
                    </Button>
                  ) : (
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-emerald-500" />
                      A Client Secret a Supabase Vaultban tárolt, nem kerül a böngészőbe.
                    </div>
                  )}

                  <Button
                    type="button"
                    onClick={() => activateMutation.mutate()}
                    disabled={
                      activateMutation.isPending ||
                      (apiKeyInput.length !== 40 &&
                        (!customUsername || !customPassword || !customKeyPart1 || !customNonce))
                    }
                    className="w-full sm:w-auto text-xs px-5 font-semibold"
                  >
                    {activateMutation.isPending ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                        Hitelesítés & Aktiválás...
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5 mr-1.5" />
                        Kapcsolat aktiválása & Ellenőrzés
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* HA KAPCSOLÓDVA VAN: INFORMÁCIÓK ÉS MŰVELETEK */
            <div className="space-y-6">
              {/* Kapcsolati összefoglaló sáv */}
              <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                      Biztonságos M2M kapcsolat létrejött
                    </span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-background border text-foreground">
                      User: {statusData?.username_masked || '••••'}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Kliensazonosító: <strong className="font-mono text-foreground">{statusData?.client_id}</strong> | Környezet: {environment === 'production' ? 'Éles NAV' : 'Teszt Sandbox'}
                  </p>
                </div>

                <div className="text-left sm:text-right text-[11px] text-muted-foreground space-y-0.5 shrink-0">
                  <div>
                    Utolsó szinkron: <strong className="text-foreground">{statusData?.last_sync_at ? new Date(statusData.last_sync_at).toLocaleString('hu-HU') : 'Még nem futott'}</strong>
                  </div>
                  <div>
                    Aláírókulcs: <strong className="text-emerald-600 dark:text-emerald-400">Aktív (SHA-256)</strong>
                  </div>
                </div>
              </div>

              {/* KÖNYVELŐI KITERJESZTÉS TÖBBI CÉGRE */}
              {accountantCred && accountantCred.total_companies_count > 1 && (
                <div className="p-3 bg-muted/40 border border-border/60 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span className="text-xs text-foreground font-medium">
                      {accountantCred.unconnected_count > 0 ? (
                        <>Még <strong>{accountantCred.unconnected_count}</strong> általad kezelt cégnél nincs aktiválva a NAV kapcsolat.</>
                      ) : (
                        <>Ez a könyvelői kapcsolat mind a <strong>{accountantCred.total_companies_count}</strong> cégedhez hozzá van rendelve.</>
                      )}
                    </span>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={adoptMutation.isPending}
                        className="text-xs h-7 px-3 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 font-medium"
                      >
                        {adoptMutation.isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                        )}
                        {accountantCred.unconnected_count > 0 ? 'Kiterjesztés a többi cégemre' : 'Kulcs újraszinkronizálása a cégeimre'}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Könyvelői NAV kapcsolat kiterjesztése</AlertDialogTitle>
                        <AlertDialogDescription className="text-xs space-y-2">
                          Szeretnéd a jelenlegi <strong className="text-foreground">{statusData?.username_masked}</strong> technikai felhasználót egyszerre beállítani/frissíteni mind a(z) <strong className="text-foreground">{accountantCred.total_companies_count}</strong> általad kezelt cégre?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="text-xs">Mégse</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => adoptMutation.mutate({ applyToAll: true })}
                          className="text-xs bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          Igen, kiterjesztés az összes cégemre
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}

              {/* Gyorsműveletek */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Dolgozói szinkronizáció */}
                <div className="p-4 rounded-xl border border-border bg-card space-y-3 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                        <Users className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-semibold text-foreground">Dolgozói jogviszonyok (T1041)</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-normal">
                      Lekéri a bejelentett munkavállalók adatait, TAJ számát, FEOR kódját, heti óraszámát és biztosítási jogviszonyát.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => syncEmployeesMutation.mutate()}
                    disabled={syncEmployeesMutation.isPending}
                    className="w-full text-xs font-medium"
                  >
                    {syncEmployeesMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Azonnali Szinkronizáció
                  </Button>
                </div>

                {/* 2. EFO Alkalmi munka */}
                <div className="p-4 rounded-xl border border-border bg-card space-y-3 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-semibold text-foreground">EFO alkalmi munkavállalók</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-normal">
                      Egyszerűsített foglalkoztatottak felhasznált és még rendelkezésre álló napjainak lekérdezése az idei évre ({new Date().getFullYear()}).
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => syncEfoMutation.mutate()}
                    disabled={syncEfoMutation.isPending}
                    className="w-full text-xs font-medium"
                  >
                    {syncEfoMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Calendar className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    EFO Napok Lekérdezése
                  </Button>
                </div>

                {/* 3. Kapcsolat Tesztelése (KOMA) */}
                <div className="p-4 rounded-xl border border-border bg-card space-y-3 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                        <Shield className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-semibold text-foreground">Kapcsolat Ellenőrzése</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-normal">
                      NAV KOMA (Köztartozásmentes Adózói Adatbázis) teszthívás az aláírókulcs és a munkamenet érvényességének igazolására.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => testHealthMutation.mutate()}
                    disabled={testHealthMutation.isPending}
                    className="w-full text-xs font-medium"
                  >
                    {testHealthMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Zap className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Kapcsolat Tesztelése
                  </Button>
                </div>
              </div>

              {/* EFO Dolgozók és Napkeret összefoglaló kártya */}
              {efoEntries.length > 0 && (
                <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-foreground flex items-center gap-2">
                          Szinkronizált EFO Alkalmi Munkavállalók
                          <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 font-medium">
                            {efoEntries.length} fő nyilvántartva
                          </Badge>
                        </span>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date().getFullYear()}. évi alkalmi munka napkeretek a NAV Ügyfélportálról
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveTab('efo')}
                      className="text-xs text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 self-start sm:self-auto font-medium"
                    >
                      Részletes EFO táblázat &rarr;
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                    {efoEntries.map((efo) => {
                      const totalUsed = efo.days_total_used || 0;
                      const maxDays = totalUsed + (efo.days_total_available || 120);
                      const usedPct = Math.min(100, Math.round((totalUsed / (maxDays || 120)) * 100));

                      return (
                        <div key={efo.id} className="p-3 rounded-lg border border-border/70 bg-card space-y-2">
                          <div className="flex items-start justify-between gap-1">
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-foreground truncate" title={efo.name}>
                                {efo.name}
                              </div>
                              <div className="text-[10px] font-mono text-muted-foreground">Adóaz: {efo.tax_id}</div>
                              {efo.taj_number && (
                                <div className="text-[10px] font-mono text-muted-foreground">TAJ: {efo.taj_number}</div>
                              )}
                            </div>
                            <Badge
                              variant="outline"
                              className="text-[10px] font-mono bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 shrink-0"
                            >
                              {totalUsed} / 120 nap
                            </Badge>
                          </div>

                          {/* Progress bar */}
                          <div className="space-y-1">
                            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  usedPct > 80 ? 'bg-destructive' : usedPct > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.max(usedPct, 4)}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                              <span>Felhasznált: <strong className="text-foreground">{efo.days_alkalmi} nap</strong></span>
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                {efo.days_total_available} nap keret
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Ha vannak szinkronizált dolgozók */}
              {employees.length > 0 && (
                <div className="p-3.5 rounded-xl border border-blue-500/20 bg-blue-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">
                        {employees.length} munkavállaló nyilvántartása aktív
                      </span>
                      <p className="text-[11px] text-muted-foreground">
                        A NAV T1041-ből és egyszerűsített foglalkoztatásból szinkronizált adatok automatikusan bekerültek a bérszámfejtésbe.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/accounty/employees')}
                    className="text-xs border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 shrink-0"
                  >
                    Munkavállalók megnyitása &rarr;
                  </Button>
                </div>
              )}

              {/* Automatikus Háttérfolyamatok Kapcsolói */}
              <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                <span className="text-xs font-semibold text-foreground">Automatizációs Szabályok</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-border/60">
                    <div className="space-y-0.5 pr-2">
                      <Label className="text-xs font-medium">Napi EFO automatikus szinkron</Label>
                      <p className="text-[10px] text-muted-foreground">Minden éjfélkor automatikusan frissíti az alkalmi munka napokat</p>
                    </div>
                    <Switch
                      checked={statusData?.auto_efo_sync_enabled ?? true}
                      onCheckedChange={(checked) => toggleAutoSyncMutation.mutate({ autoEfo: checked })}
                      disabled={toggleAutoSyncMutation.isPending}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-border/60">
                    <div className="space-y-0.5 pr-2">
                      <Label className="text-xs font-medium">Dolgozói jogviszony ellenőrzés</Label>
                      <p className="text-[10px] text-muted-foreground">Heti rendszerességgel ellenőrzi az új T1041 bejelentéseket</p>
                    </div>
                    <Switch
                      checked={statusData?.auto_employee_sync_enabled ?? true}
                      onCheckedChange={(checked) => toggleAutoSyncMutation.mutate({ autoEmployee: checked })}
                      disabled={toggleAutoSyncMutation.isPending}
                    />
                  </div>
                </div>
              </div>

              {/* Végleges Kapcsolatbontás (Megsemmisítés) */}
              <div className="pt-2 flex items-center justify-between border-t border-border/50">
                <div className="text-[11px] text-muted-foreground">
                  A kapcsolat bontásakor a titkos aláírókulcs a NAV ÁSZF előírásai szerint azonnal és véglegesen törlődik.
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-xs text-destructive hover:bg-destructive/10">
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      Kapcsolat bontása & Kulcsok törlése
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-destructive flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        Biztosan megszünteted a NAV M2M kapcsolatot?
                      </AlertDialogTitle>
                      <AlertDialogDescription className="text-xs space-y-2">
                        <p>
                          A művelet végleges és visszavonhatatlan. A szerveren tárolt felhasználói azonosító és a titkos aláírókulcs
                          azonnal megsemmisítésre kerül.
                        </p>
                        <p className="font-semibold text-foreground">
                          A bontás ténye a NAV ÁSZF 6.2 pontjának megfelelően rögzítésre kerül az audit naplóban.
                        </p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="text-xs">Mégse</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => revokeMutation.mutate()}
                        className="bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs"
                      >
                        Igen, kulcsok végleges törlése
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── 2. FÜL: EFO ALKALMI MUNKAVÁLLALÓK RÉSZLETES TÁBLÁZATA ── */}
        <TabsContent value="efo" className="m-0 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-amber-500" />
                Egyszerűsített Foglalkoztatottak (EFO) Napkeret Nyilvántartása ({new Date().getFullYear()})
              </span>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                A NAV adatbázisa alapján a munkavállalók tárgyévben felhasznált alkalmi munka, mezőgazdasági és turisztikai napjai, valamint a még rendelkezésre álló törvényi napkeret (max. 120 nap/év).
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => syncEfoMutation.mutate()}
                disabled={syncEfoMutation.isPending}
                className="text-xs"
              >
                {syncEfoMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                )}
                Szinkronizálás a NAV-val
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => navigate('/accounty/employees')}
                className="text-xs"
              >
                <Users className="w-3.5 h-3.5 mr-1.5" />
                Alkalmazottak Listája
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border overflow-hidden bg-card">
            <Table>
              <TableHeader className="bg-muted/40 text-[11px]">
                <TableRow>
                  <TableHead>Munkavállaló Neve</TableHead>
                  <TableHead>Adóazonosító</TableHead>
                  <TableHead>TAJ szám</TableHead>
                  <TableHead className="text-center">Alkalmi Munka</TableHead>
                  <TableHead className="text-center">Mezőgazd. / Turisztika</TableHead>
                  <TableHead className="text-center">Összes Felhasznált</TableHead>
                  <TableHead className="text-center">Hátralévő Keret</TableHead>
                  <TableHead className="text-right">Utolsó Szinkron</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs font-mono">
                {isEfoLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground font-sans">
                      <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                      EFO adatok betöltése...
                    </TableCell>
                  </TableRow>
                ) : efoEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground font-sans">
                      Még nem futott EFO szinkronizáció. Kattints az „EFO Napok Lekérdezése” gombra!
                    </TableCell>
                  </TableRow>
                ) : (
                  efoEntries.map((efo) => {
                    const totalUsed = efo.days_total_used || 0;
                    const available = efo.days_total_available || 0;
                    const maxDays = totalUsed + available || 120;
                    const isLimitWarning = available <= 20;

                    return (
                      <TableRow key={efo.id} className="hover:bg-muted/30">
                        <TableCell className="font-sans font-semibold text-foreground">
                          {efo.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {efo.tax_id}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {efo.taj_number || '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="font-mono text-xs">
                            {efo.days_alkalmi} nap
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">
                          {efo.days_mezogazdasag + efo.days_turisztika > 0
                            ? `${efo.days_mezogazdasag + efo.days_turisztika} nap`
                            : '-'}
                        </TableCell>
                        <TableCell className="text-center font-bold text-foreground">
                          {totalUsed} nap
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className={`text-xs font-mono font-bold ${
                              isLimitWarning
                                ? 'bg-destructive/10 text-destructive border-destructive/30'
                                : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                            }`}
                          >
                            {available} / {maxDays} nap
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-sans text-[11px] text-muted-foreground whitespace-nowrap">
                          {efo.last_sync_at ? new Date(efo.last_sync_at).toLocaleString('hu-HU') : '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── 2. FÜL: 90 NAPOS M2M AUDIT NAPLÓ (NAV ÁSZF 6.2 ELŐÍRÁS) ── */}
        <TabsContent value="audit" className="m-0 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-primary" />
                Hivatalos NAV M2M Audit Napló
              </span>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                A NAV M2M ÁSZF 6.2 pontja szerint a gép-gép interfészen indított minden kérés, válasz, kérésazonosító és időtartam naplózásra kerül (legalább 90 napos megőrzés).
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refetchAuditLogs()}
              disabled={isLogsLoading}
              className="text-xs shrink-0 self-start sm:self-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLogsLoading ? 'animate-spin' : ''}`} />
              Frissítés
            </Button>
          </div>

          <div className="rounded-lg border border-border overflow-hidden bg-card">
            <Table>
              <TableHeader className="bg-muted/40 text-[11px]">
                <TableRow>
                  <TableHead className="w-[150px]">Időpont</TableHead>
                  <TableHead>Művelet / Végpont</TableHead>
                  <TableHead>Eredmény</TableHead>
                  <TableHead>Válaszidő</TableHead>
                  <TableHead className="w-[180px]">Kérésazonosító (UUID)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs font-mono">
                {isLogsLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground font-sans">
                      <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                      Audit napló beolvasása...
                    </TableCell>
                  </TableRow>
                ) : auditLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground font-sans">
                      Még nem található M2M naplóbejegyzés ennél a cégnél.
                    </TableCell>
                  </TableRow>
                ) : (
                  auditLogs.map((log) => {
                    const isSuccess = log.status_code === 200 && log.result_code !== 'FAILED';
                    return (
                      <TableRow key={log.id} className="hover:bg-muted/30">
                        <TableCell className="font-sans text-[11px] text-muted-foreground whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString('hu-HU')}
                        </TableCell>
                        <TableCell className="font-sans">
                          <div className="font-semibold text-foreground text-xs">{log.action}</div>
                          <div className="text-[10px] text-muted-foreground truncate max-w-xs">{log.endpoint}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                isSuccess
                                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                                  : 'bg-destructive/10 text-destructive border-destructive/30'
                              }`}
                            >
                              {log.result_code || `${log.status_code}`}
                            </Badge>
                          </div>
                          {log.result_message && (
                            <div className="text-[10px] text-muted-foreground font-sans truncate max-w-xs mt-0.5">
                              {log.result_message}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-[11px]">
                          {log.duration_ms ? `${log.duration_ms} ms` : '-'}
                        </TableCell>
                        <TableCell className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                          {log.request_id || '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
};

export default NavUpoM2mCard;
