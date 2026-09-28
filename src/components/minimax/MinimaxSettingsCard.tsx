import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Shield,
  Zap,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Trash2,
  Building2,
  ExternalLink,
  Key,
  Info,
  Loader2,
  AlertTriangle,
  AlertCircle,
  ArrowUpRight,
  ArrowDownLeft,
  Activity,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface MinimaxSettingsCardProps {
  companyId?: string;
  isOwner?: boolean;
  onCredentialsSaved?: () => void;
}

interface MinimaxSyncLog {
  id: string;
  direction: string;
  status: string;
  invoices_fetched: number;
  invoices_saved: number;
  date_from?: string | null;
  date_to?: string | null;
  error_message?: string | null;
  sync_duration_ms?: number | null;
  sync_type: string;
  created_at: string;
}

export const MinimaxSettingsCard: React.FC<MinimaxSettingsCardProps> = ({
  companyId,
  isOwner = true,
  onCredentialsSaved,
}) => {
  const { t, i18n } = useTranslation(['settings', 'common']);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'credentials' | 'logs'>('credentials');
  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; organisations?: any[] } | null>(null);

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    organisationId: '',
    organisationName: '',
    isTestEnvironment: true, // Default to true until live credentials are ready
    autoSyncEnabled: true,
  });

  const [existingCreds, setExistingCreds] = useState<any | null>(null);

  const loadCredentials = async () => {
    if (!companyId) {
      setInitialLoading(false);
      return;
    }

    try {
      setInitialLoading(true);
      const { data, error } = await (supabase.rpc as any)('get_minimax_credentials', {
        p_company_id: companyId,
      });

      const credsData = data as any;
      if (!error && credsData && credsData.exists) {
        setExistingCreds(credsData);
        setFormData({
          username: credsData.minimax_username || '',
          password: '',
          organisationId: credsData.organisation_id || '',
          organisationName: credsData.organisation_name || '',
          isTestEnvironment: credsData.is_test_environment ?? true,
          autoSyncEnabled: credsData.auto_sync_enabled ?? true,
        });
      } else {
        setExistingCreds(null);
      }
    } catch (err: any) {
      console.error('[MinimaxSettingsCard] Error loading credentials:', err);
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    loadCredentials();
  }, [companyId]);

  // Fetch sync logs
  const { data: syncLogs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['minimax_sync_logs', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await (supabase.from as any)('minimax_sync_logs')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as MinimaxSyncLog[];
    },
    enabled: !!companyId,
    staleTime: 60 * 1000,
  });

  const handleTestConnection = async () => {
    if (!companyId) return;
    if (!formData.username) {
      toast({
        title: t('settings:integrations.minimax.toast_missing_username_title', 'Hiányzó felhasználónév'),
        description: t('settings:integrations.minimax.toast_missing_username_desc', 'Kérjük, add meg a Minimax API felhasználónevet a teszteléshez.'),
        variant: 'destructive',
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('minimax-sync', {
        body: {
          action: 'test_connection',
          companyId,
          testMode: formData.isTestEnvironment,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      setTestResult({
        success: true,
        message: data?.message || t('settings:integrations.minimax.toast_conn_success_desc', 'A Minimax API válaszolt.'),
        organisations: data?.organisations || [],
      });

      if (data?.organisations && data.organisations.length > 0) {
        const firstOrg = data.organisations[0];
        setFormData((prev) => ({
          ...prev,
          organisationId: firstOrg.OrganisationId || prev.organisationId,
          organisationName: firstOrg.Title || prev.organisationName,
        }));
      }

      toast({
        title: t('settings:integrations.minimax.toast_conn_success_title', 'Sikeres kapcsolat'),
        description: data?.message || t('settings:integrations.minimax.toast_conn_success_desc', 'A Minimax API válaszolt.'),
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || t('settings:integrations.minimax.toast_conn_error_desc', 'Ellenőrizd a megadott adatokat vagy a tesztmódot.'),
      });
      toast({
        title: t('settings:integrations.minimax.toast_conn_error_title', 'Kapcsolódási hiba'),
        description: err.message || t('settings:integrations.minimax.toast_conn_error_desc', 'Ellenőrizd a megadott adatokat vagy a tesztmódot.'),
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!companyId) return;

    if (!formData.username.trim()) {
      toast({
        title: t('settings:integrations.minimax.toast_incomplete_form_title', 'Hiányos űrlap'),
        description: t('settings:integrations.minimax.toast_missing_username_desc', 'A Minimax felhasználónév kitöltése kötelező.'),
        variant: 'destructive',
      });
      return;
    }

    // If new credentials and no password provided
    if (!existingCreds && !formData.password.trim() && !formData.isTestEnvironment) {
      toast({
        title: t('settings:integrations.minimax.toast_incomplete_form_title', 'Hiányos űrlap'),
        description: t('settings:integrations.minimax.toast_missing_password_desc', 'A jelszó kitöltése kötelező.'),
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await (supabase.rpc as any)('save_minimax_credentials', {
        p_company_id: companyId,
        p_username: formData.username.trim(),
        p_password: formData.password.trim() || 'dummy_test_password',
        p_organisation_id: formData.organisationId.trim() || null,
        p_organisation_name: formData.organisationName.trim() || null,
        p_is_test: formData.isTestEnvironment,
        p_auto_sync: formData.autoSyncEnabled,
        p_sync_frequency: 'daily',
      });

      if (error) throw new Error(error.message);

      toast({
        title: t('settings:integrations.minimax.toast_save_success_title', 'Sikeres mentés'),
        description: t('settings:integrations.minimax.toast_save_success_desc', 'A Minimax integrációs adatok elmentve.'),
      });

      await loadCredentials();
      queryClient.invalidateQueries({ queryKey: ['minimax_credentials', companyId] });
      queryClient.invalidateQueries({ queryKey: ['navCredentials', companyId] });
      onCredentialsSaved?.();
    } catch (err: any) {
      toast({
        title: t('settings:integrations.minimax.toast_save_error_title', 'Mentési hiba'),
        description: err.message || t('settings:integrations.minimax.toast_save_error_desc', 'Nem sikerült menteni a beállításokat.'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!companyId) return;
    const confirmPrompt = t(
      'settings:integrations.minimax.disconnect_confirm',
      'Biztosan bontani szeretnéd a Minimax kapcsolatot? Ez törli a mentett hitelesítő adatokat.'
    );
    if (!confirm(confirmPrompt)) {
      return;
    }

    setDisconnecting(true);
    try {
      const { error } = await (supabase.rpc as any)('disconnect_minimax_credentials', {
        p_company_id: companyId,
      });

      if (error) throw error;

      toast({
        title: t('settings:integrations.minimax.toast_disconnected_title', 'Kapcsolat bontva'),
        description: t(
          'settings:integrations.minimax.toast_disconnected_desc',
          'A Minimax API integráció sikeresen törölve lett erről a cégről.'
        ),
      });

      setExistingCreds(null);
      setFormData({
        username: '',
        password: '',
        organisationId: '',
        organisationName: '',
        isTestEnvironment: true,
        autoSyncEnabled: true,
      });
      setTestResult(null);

      queryClient.invalidateQueries({ queryKey: ['minimax_credentials', companyId] });
      queryClient.invalidateQueries({ queryKey: ['navCredentials', companyId] });
      onCredentialsSaved?.();
    } catch (err: any) {
      toast({
        title: t('settings:integrations.minimax.toast_disconnect_error_title', 'Hiba a leválasztáskor'),
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setDisconnecting(false);
    }
  };

  if (initialLoading) {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-28 w-full" />
        </div>
      </Card>
    );
  }

  const isConnected = !!existingCreds;
  const currentLocale = i18n.language === 'hr' ? 'hr-HR' : 'hu-HU';

  return (
    <Card className="border-primary/10 hover:border-primary/20 transition-colors shadow-xs">
      <CardHeader>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500/20 to-indigo-500/5 rounded-xl flex items-center justify-center border border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
            <Building2 className="w-6 h-6" />
          </div>
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">
                {t('settings:integrations.minimax.card_title', 'Minimax Számla-közvetítő API')}
              </CardTitle>
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help ml-auto" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>
                      {t(
                        'settings:integrations.minimax.tooltip',
                        'Horvátországi számlaközvetítői REST API integráció. A Minimax közvetítői szolgáltatásán keresztül érhetők el a kimenő és bejövő e-számlák.'
                      )}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <CardDescription className="text-sm">
              {t(
                'settings:integrations.minimax.card_subtitle',
                'Hivatalos horvát e-számla közvetítői kapcsolat (moj.minimax.hr)'
              )}
            </CardDescription>

            {/* Feature Pills */}
            <div className="flex flex-wrap gap-2 pt-1">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-medium">
                <Shield className="h-3 w-3" />
                {t('settings:integrations.minimax.badge_oauth', 'OAuth 2.0 Védelem')}
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                <Zap className="h-3 w-3" />
                {t('settings:integrations.minimax.badge_two_way', 'Kétirányú számlaszinkron (HR)')}
              </div>
              {formData.isTestEnvironment && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-medium">
                  <Activity className="h-3 w-3" />
                  {t('settings:integrations.minimax.badge_test_mode', 'Szimulált tesztmód aktív')}
                </div>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-2">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4 max-w-md">
            <TabsTrigger value="credentials">
              {t('settings:integrations.minimax.tab_credentials', 'Hitelesítés & Beállítás')}
            </TabsTrigger>
            <TabsTrigger value="logs">
              {t('settings:integrations.minimax.tab_logs', 'Szinkronizálási Logok')}
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Hitelesítés & Űrlap */}
          <TabsContent value="credentials" className="space-y-6 mt-0">
            {/* Kapcsolati Állapot Kártya */}
            {isConnected && (
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <h4 className="text-sm font-semibold text-emerald-950 dark:text-emerald-200">
                        {existingCreds.is_test_environment
                          ? t('settings:integrations.minimax.conn_active_test', 'Minimax Kapcsolat Aktív (Szimulált Tesztmód)')
                          : t('settings:integrations.minimax.conn_active_live', 'Élő Minimax API Kapcsolat Aktív')}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {t('settings:integrations.minimax.user_label', 'Felhasználó')}:{' '}
                        <span className="font-mono text-foreground font-medium">{existingCreds.minimax_username}</span>
                        {existingCreds.organisation_name &&
                          ` • ${t('settings:integrations.minimax.org_label', 'Szervezet')}: ${existingCreds.organisation_name}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleTestConnection}
                      disabled={testing}
                      className="h-8 gap-1.5 text-xs"
                    >
                      <RefreshCw className={cn('w-3.5 h-3.5', testing && 'animate-spin')} />
                      {t('settings:integrations.minimax.test_btn', 'Teszt')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDisconnect}
                      disabled={disconnecting}
                      className="h-8 text-xs text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      {t('settings:integrations.minimax.disconnect_btn', 'Leválasztás')}
                    </Button>
                  </div>
                </div>

                {existingCreds.last_synced_at && (
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-1 border-t border-emerald-500/20">
                    <Clock className="w-3 h-3" />
                    {t('settings:integrations.minimax.last_synced', {
                      date: new Date(existingCreds.last_synced_at).toLocaleString(currentLocale),
                      defaultValue: `Utolsó sikeres szinkronizáció: ${new Date(existingCreds.last_synced_at).toLocaleString(currentLocale)}`,
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Figyelmeztető értesítés ha tesztmódban van */}
            {formData.isTestEnvironment && (
              <Alert className="bg-amber-500/10 border-amber-500/20 text-amber-900 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertTitle className="font-semibold text-xs">
                  {t('settings:integrations.minimax.sim_mode_title', 'Fejlesztői & Könyvelői Szimulációs Mód')}
                </AlertTitle>
                <AlertDescription className="text-xs space-y-1 mt-1 leading-relaxed">
                  <p>
                    {t(
                      'settings:integrations.minimax.sim_mode_desc',
                      'Mivel még nincs véglegesített éles Minimax fejlesztői fiók, a rendszer szimulált módban fut. Ebben a módban valósághű horvát számlák (kimenő és bejövő, OIB számokkal és horvát ÁFA-kódokkal) szinkronizálhatók teszteléshez.'
                    )}
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {/* Űrlap */}
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                {/* Username */}
                <div className="space-y-1.5">
                  <Label htmlFor="minimax_username" className="text-xs font-semibold">
                    {t('settings:integrations.minimax.field_username', 'Minimax Felhasználónév (Email) *')}
                  </Label>
                  <Input
                    id="minimax_username"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder={t('settings:integrations.minimax.field_username_placeholder', 'pl. pelda@vallalkozas.hr')}
                    disabled={saving}
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {t('settings:integrations.minimax.field_username_hint', 'A Minimax.hr felületen használt bejelentkezési név.')}
                  </p>
                </div>

                {/* Password / App key */}
                <div className="space-y-1.5">
                  <Label htmlFor="minimax_password" className="text-xs font-semibold">
                    {t('settings:integrations.minimax.field_password', 'Külső Alkalmazás Jelszó')}{' '}
                    {existingCreds?.has_password
                      ? t('settings:integrations.minimax.field_password_optional', '(nem kötelező módosítani)')
                      : t('settings:integrations.minimax.field_password_required', '*')}
                  </Label>
                  <Input
                    id="minimax_password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={
                      existingCreds?.has_password
                        ? '••••••••••••'
                        : t('settings:integrations.minimax.field_password_placeholder', 'Minimax API alkalmazás jelszó')
                    }
                    disabled={saving}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {t(
                      'settings:integrations.minimax.field_password_hint',
                      'Minimax felületen: Postavke organizacije > Lozinka za pristup vanjskim aplikacijama.'
                    )}
                  </p>
                </div>

                {/* Organisation ID */}
                <div className="space-y-1.5">
                  <Label htmlFor="minimax_org_id" className="text-xs font-semibold">
                    {t('settings:integrations.minimax.field_org_id', 'Minimax Szervezet Azonosító (OrganisationId)')}
                  </Label>
                  <Input
                    id="minimax_org_id"
                    value={formData.organisationId}
                    onChange={(e) => setFormData({ ...formData, organisationId: e.target.value })}
                    placeholder={t(
                      'settings:integrations.minimax.field_org_id_placeholder',
                      'pl. 10001 (elhagyható, automatikusan felderíthető)'
                    )}
                    disabled={saving}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {t(
                      'settings:integrations.minimax.field_org_id_hint',
                      'A kapcsolt szervezet ID-ja. A Kapcsolat tesztelése gombbal automatikusan kitölthető.'
                    )}
                  </p>
                </div>

                {/* Organisation Name */}
                <div className="space-y-1.5">
                  <Label htmlFor="minimax_org_name" className="text-xs font-semibold">
                    {t('settings:integrations.minimax.field_org_name', 'Szervezet Neve (Megjelenítéshez)')}
                  </Label>
                  <Input
                    id="minimax_org_name"
                    value={formData.organisationName}
                    onChange={(e) => setFormData({ ...formData, organisationName: e.target.value })}
                    placeholder={t('settings:integrations.minimax.field_org_name_placeholder', 'pl. D-INVOICE D.O.O.')}
                    disabled={saving}
                  />
                </div>
              </div>

              {/* Switches */}
              <div className="pt-2 space-y-3 border-t">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="test_mode" className="text-xs font-semibold cursor-pointer">
                      {t('settings:integrations.minimax.switch_test_mode', 'Szimulált tesztmód engedélyezése')}
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      {t(
                        'settings:integrations.minimax.switch_test_mode_hint',
                        'Engedélyezi a szimulált horvát számlaszinkronizációt a fejlesztés és tesztelés idejére.'
                      )}
                    </p>
                  </div>
                  <Switch
                    id="test_mode"
                    checked={formData.isTestEnvironment}
                    onCheckedChange={(checked) => setFormData({ ...formData, isTestEnvironment: checked })}
                    disabled={saving}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="auto_sync" className="text-xs font-semibold cursor-pointer">
                      {t('settings:integrations.minimax.switch_auto_sync', 'Napi automatikus számlaszinkronizáció')}
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      {t(
                        'settings:integrations.minimax.switch_auto_sync_hint',
                        'A rendszer naponta automatikusan lekéri az új kimenő és bejövő e-számlákat.'
                      )}
                    </p>
                  </div>
                  <Switch
                    id="auto_sync"
                    checked={formData.autoSyncEnabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, autoSyncEnabled: checked })}
                    disabled={saving}
                  />
                </div>
              </div>

              {/* Gombok */}
              <div className="flex items-center justify-between pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTestConnection}
                  disabled={testing || saving || !formData.username}
                  className="gap-2"
                >
                  {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  {t('settings:integrations.minimax.btn_test_connection', 'Kapcsolat tesztelése')}
                </Button>

                <Button type="submit" size="sm" disabled={saving || !isOwner} className="gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t('settings:integrations.minimax.btn_save_settings', 'Beállítások mentése')}
                </Button>
              </div>
            </form>

            {/* Test result feedback */}
            {testResult && (
              <Alert variant={testResult.success ? 'default' : 'destructive'} className="mt-4">
                {testResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                <AlertTitle>
                  {testResult.success
                    ? t('settings:integrations.minimax.toast_conn_success_title', 'Sikeres kapcsolat')
                    : t('settings:integrations.minimax.toast_conn_error_title', 'Kapcsolati hiba')}
                </AlertTitle>
                <AlertDescription className="text-xs">
                  {testResult.message}
                  {testResult.organisations && testResult.organisations.length > 0 && (
                    <div className="mt-2 text-[11px]">
                      <strong>{t('settings:integrations.minimax.org_label', 'Szervezetek')}:</strong>{' '}
                      {testResult.organisations.map((o) => `${o.Title} (ID: ${o.OrganisationId})`).join(', ')}
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          {/* TAB 2: Szinkronizálási Logok */}
          <TabsContent value="logs" className="mt-0">
            <div className="rounded-lg border bg-card">
              <div className="p-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  <span className="font-medium text-sm">
                    {t('settings:integrations.minimax.logs_title', 'Minimax API Szinkronizálási Napló')}
                  </span>
                  {logsLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                </div>
              </div>

              <div className="p-4 max-h-[500px] overflow-y-auto space-y-2">
                {logsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                  </div>
                ) : syncLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    {t('settings:integrations.minimax.logs_empty', 'Még nincsenek rögzített Minimax szinkronizálási események.')}
                  </div>
                ) : (
                  syncLogs.map((log) => {
                    const isSuccess = log.status === 'completed';
                    return (
                      <div
                        key={log.id}
                        className={cn(
                          'p-3 rounded-lg border text-xs space-y-1.5 transition-colors',
                          isSuccess
                            ? 'bg-muted/30 border-border/50'
                            : 'bg-destructive/5 border-destructive/20 text-destructive'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[10px] px-2 py-0',
                                log.direction === 'OUTBOUND'
                                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 border-blue-200'
                                  : log.direction === 'INBOUND'
                                  ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 border-purple-200'
                                  : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 border-indigo-200'
                              )}
                            >
                              {log.direction === 'OUTBOUND'
                                ? t('settings:integrations.minimax.direction_outbound', 'Kimenő')
                                : log.direction === 'INBOUND'
                                ? t('settings:integrations.minimax.direction_inbound', 'Bejövő')
                                : t('settings:integrations.minimax.direction_both', 'Mindkettő')}
                            </Badge>
                            <Badge
                              variant={isSuccess ? 'default' : 'destructive'}
                              className={cn(
                                'text-[10px] px-2 py-0',
                                isSuccess && 'bg-emerald-600 text-white hover:bg-emerald-700'
                              )}
                            >
                              {isSuccess
                                ? t('settings:integrations.minimax.status_success', 'Sikeres')
                                : t('settings:integrations.minimax.status_failed', 'Sikertelen')}
                            </Badge>
                          </div>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {new Date(log.created_at).toLocaleString(currentLocale)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                          <span>
                            {t('settings:integrations.minimax.log_fetched', 'Letöltve:')}{' '}
                            <strong className="text-foreground">{log.invoices_fetched}</strong>{' '}
                            {t('settings:integrations.minimax.invoices_count', { count: log.invoices_fetched, defaultValue: 'db' })} •{' '}
                            {t('settings:integrations.minimax.log_saved', 'Mentve:')}{' '}
                            <strong className="text-foreground">{log.invoices_saved}</strong>{' '}
                            {t('settings:integrations.minimax.invoices_count', { count: log.invoices_saved, defaultValue: 'db' })}
                          </span>
                          <span>{log.sync_duration_ms ? `${(log.sync_duration_ms / 1000).toFixed(1)}s` : ''}</span>
                        </div>

                        {log.error_message && (
                          <div className="text-[11px] text-destructive bg-destructive/10 p-2 rounded break-words mt-1 font-mono">
                            {log.error_message}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
