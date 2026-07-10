import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { reportError } from '@/lib/errorReporter';
import { ContentSkeleton } from '@/components/ui/content-skeleton';
import { urlBase64ToUint8Array, unsubscribeFromPush } from '@/hooks/usePushNotifications';
import {
  Mail,
  Bell,
  CalendarClock,
  AlertTriangle,
  FileWarning,
  Clock,
  Users,
  CheckCircle2,
  TrendingUp,
  Shield,
  BellRing,
  MailCheck,
  BellOff,
} from 'lucide-react';

// ── Types ──

interface EmailNotifPrefs {
  missingInvoiceAlert: boolean;
  deadlineReminder: boolean;
  clientStatusChange: boolean;
  approvalRequest: boolean;
  weeklyReport: boolean;
  monthlyReport: boolean;
}

interface PushNotifPrefs {
  enabled: boolean;
  missingInvoiceAlert: boolean;
  deadlineReminder: boolean;
  clientStatusChange: boolean;
  approvalRequest: boolean;
  criticalAlerts: boolean;
}

interface DigestPrefs {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'biweekly';
  deliveryTime: string;
  includeKpis: boolean;
  includeDeadlines: boolean;
  includeMissingItems: boolean;
  includeClientSummary: boolean;
  includeAuditLog: boolean;
}

// ── Notification Item ──

function NotifToggle({
  id,
  icon: Icon,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  id: string;
  icon: React.ElementType;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-muted p-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="space-y-0.5">
          <Label htmlFor={id} className="text-sm font-medium cursor-pointer">{label}</Label>
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        </div>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </div>
  );
}

// ── Main Component ──

export function AccountyNotificationPreferences() {
  const { user } = useAuth();

  // DB column name mapping
  type DbColumnKey = 'missing_invoice_alert' | 'deadline_reminder' | 'client_status_change' | 'approval_request' | 'weekly_report' | 'monthly_report';

  // Email prefs — loaded from DB
  const [emailPrefs, setEmailPrefs] = useState<EmailNotifPrefs>({
    missingInvoiceAlert: false,
    deadlineReminder: false,
    clientStatusChange: false,
    approvalRequest: false,
    weeklyReport: false,
    monthlyReport: false,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Map frontend key → DB column
  const keyToColumn: Record<keyof EmailNotifPrefs, DbColumnKey> = {
    missingInvoiceAlert: 'missing_invoice_alert',
    deadlineReminder: 'deadline_reminder',
    clientStatusChange: 'client_status_change',
    approvalRequest: 'approval_request',
    weeklyReport: 'weekly_report',
    monthlyReport: 'monthly_report',
  };

  type PushDbColumnKey = 'enabled' | 'missing_invoice_alert' | 'deadline_reminder' | 'client_status_change' | 'approval_request' | 'critical_alerts';
  const pushKeyToColumn: Record<keyof PushNotifPrefs, PushDbColumnKey> = {
    enabled: 'enabled',
    missingInvoiceAlert: 'missing_invoice_alert',
    deadlineReminder: 'deadline_reminder',
    clientStatusChange: 'client_status_change',
    approvalRequest: 'approval_request',
    criticalAlerts: 'critical_alerts',
  };

  // Load from DB
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        setLoading(true);
        // Fetch Email Prefs
        const emailReq = supabase
          .from('accounty_email_preferences' as any)
          .select('missing_invoice_alert, deadline_reminder, client_status_change, approval_request, weekly_report, monthly_report, digest_enabled, digest_frequency, digest_delivery_time, digest_include_kpis, digest_include_deadlines, digest_include_missing_items, digest_include_client_summary, digest_include_audit_log')
          .eq('user_id', user.id)
          .maybeSingle();

        // Fetch Push Prefs
        const pushReq = supabase
          .from('accounty_push_preferences' as any)
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        const [emailRes, pushRes] = await Promise.all([emailReq, pushReq]);

        if (emailRes.error && emailRes.error.code !== 'PGRST116') throw emailRes.error;
        if (pushRes.error && pushRes.error.code !== 'PGRST116') throw pushRes.error;

        if (emailRes.data) {
          const d = emailRes.data as any;
          setEmailPrefs({
            missingInvoiceAlert: d.missing_invoice_alert ?? false,
            deadlineReminder: d.deadline_reminder ?? false,
            clientStatusChange: d.client_status_change ?? false,
            approvalRequest: d.approval_request ?? false,
            weeklyReport: d.weekly_report ?? false,
            monthlyReport: d.monthly_report ?? false,
          });
          setDigestPrefs({
            enabled: d.digest_enabled ?? false,
            frequency: d.digest_frequency ?? 'daily',
            deliveryTime: d.digest_delivery_time ?? '08:00',
            includeKpis: d.digest_include_kpis ?? true,
            includeDeadlines: d.digest_include_deadlines ?? true,
            includeMissingItems: d.digest_include_missing_items ?? true,
            includeClientSummary: d.digest_include_client_summary ?? true,
            includeAuditLog: d.digest_include_audit_log ?? false,
          });
        }

        if (pushRes.data) {
          const pd = pushRes.data as any;
          setPushPrefs({
            enabled: pd.enabled ?? false,
            missingInvoiceAlert: pd.missing_invoice_alert ?? false,
            deadlineReminder: pd.deadline_reminder ?? false,
            clientStatusChange: pd.client_status_change ?? false,
            approvalRequest: pd.approval_request ?? false,
            criticalAlerts: pd.critical_alerts ?? false,
          });
        }
      } catch (err) {
        reportError({ type: 'db_query', component: 'AccountyNotificationPreferences', action: 'load', message: 'Error loading prefs', error: err });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  // Save to DB
  const updateEmail = async (key: keyof EmailNotifPrefs, value: boolean) => {
    if (!user) return;
    const newPrefs = { ...emailPrefs, [key]: value };
    setEmailPrefs(newPrefs);

    try {
      setSaving(true);
      const { error } = await supabase
        .from('accounty_email_preferences' as any)
        .upsert(
          {
            user_id: user.id,
            [keyToColumn[key]]: value,
          } as any,
          { onConflict: 'user_id' }
        );

      if (error) throw error;
      toast({ title: 'Beállítás frissítve' });
    } catch (err) {
      // Revert on error
      setEmailPrefs(emailPrefs);
      reportError({ type: 'db_query', component: 'AccountyNotificationPreferences', action: 'update', message: 'Error updating pref', error: err });
      toast({ title: 'Nem sikerült menteni a beállítást', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Push prefs (now persisted in DB)
  const [pushPrefs, setPushPrefs] = useState<PushNotifPrefs>({
    enabled: false,
    missingInvoiceAlert: false,
    deadlineReminder: false,
    clientStatusChange: false,
    approvalRequest: false,
    criticalAlerts: false,
  });

  const [pushPermission, setPushPermission] = useState<'default' | 'granted' | 'denied'>(() => {
    if (typeof Notification !== 'undefined') return Notification.permission as any;
    return 'default';
  });

  // Digest prefs
  const [digestPrefs, setDigestPrefs] = useState<DigestPrefs>({
    enabled: false,
    frequency: 'daily',
    deliveryTime: '08:00',
    includeKpis: true,
    includeDeadlines: true,
    includeMissingItems: true,
    includeClientSummary: true,
    includeAuditLog: false,
  });

  const updatePush = async (key: keyof PushNotifPrefs, value: boolean) => {
    if (!user) return;
    const newPrefs = { ...pushPrefs, [key]: value };
    setPushPrefs(newPrefs);

    try {
      setSaving(true);
      const { error } = await supabase
        .from('accounty_push_preferences' as any)
        .upsert(
          {
            user_id: user.id,
            [pushKeyToColumn[key]]: value,
          } as any,
          { onConflict: 'user_id' }
        );

      if (error) throw error;
      
      // Ha globálisan kikapcsolja a push-t ezen a kliensen, leiratkozunk
      if (key === 'enabled' && value === false) {
        await unsubscribeFromPush(user.id);
      }

      toast({ title: 'Beállítás frissítve' });
    } catch (err) {
      setPushPrefs(pushPrefs);
      reportError({ type: 'db_query', component: 'AccountyNotificationPreferences', action: 'update_push', message: 'Error updating push pref', error: err });
      toast({ title: 'Nem sikerült menteni a beállítást', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  type DigestDbColumnKey = 'digest_enabled' | 'digest_frequency' | 'digest_delivery_time' | 'digest_include_kpis' | 'digest_include_deadlines' | 'digest_include_missing_items' | 'digest_include_client_summary' | 'digest_include_audit_log';
  const digestKeyToColumn: Record<keyof DigestPrefs, DigestDbColumnKey> = {
    enabled: 'digest_enabled',
    frequency: 'digest_frequency',
    deliveryTime: 'digest_delivery_time',
    includeKpis: 'digest_include_kpis',
    includeDeadlines: 'digest_include_deadlines',
    includeMissingItems: 'digest_include_missing_items',
    includeClientSummary: 'digest_include_client_summary',
    includeAuditLog: 'digest_include_audit_log',
  };

  const updateDigest = async <K extends keyof DigestPrefs>(key: K, value: DigestPrefs[K]) => {
    if (!user) return;
    const newPrefs = { ...digestPrefs, [key]: value };
    setDigestPrefs(newPrefs);

    try {
      setSaving(true);
      const { error } = await supabase
        .from('accounty_email_preferences' as any)
        .upsert(
          {
            user_id: user.id,
            [digestKeyToColumn[key]]: value,
          } as any,
          { onConflict: 'user_id' }
        );

      if (error) throw error;
      toast({ title: 'Beállítás frissítve' });
    } catch (err) {
      setDigestPrefs(digestPrefs);
      reportError({ type: 'db_query', component: 'AccountyNotificationPreferences', action: 'update_digest', message: 'Error updating digest pref', error: err });
      toast({ title: 'Nem sikerült menteni a beállítást', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const requestPushPermission = async () => {
    if (!user) return;
    if (typeof Notification === 'undefined') {
      toast({ title: 'Push értesítések nem támogatottak', description: 'Ez a böngésző nem támogatja a push értesítéseket.', variant: 'destructive' });
      return;
    }
    const result = await Notification.requestPermission();
    setPushPermission(result as any);
    if (result === 'granted') {
      try {
        setSaving(true);
        if ('serviceWorker' in navigator && 'PushManager' in window) {
          const publicVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
          const registration = await navigator.serviceWorker.ready;
          
          let subscription = await registration.pushManager.getSubscription();
          if (!subscription && publicVapidKey) {
            subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
            });
          }
          
          if (subscription) {
            const subJson = subscription.toJSON();
            if (subJson.endpoint && subJson.keys?.auth && subJson.keys?.p256dh) {
              await supabase
                .from('accounty_push_subscriptions' as any)
                .upsert({
                  user_id: user.id,
                  endpoint: subJson.endpoint,
                  auth_key: subJson.keys.auth,
                  p256dh_key: subJson.keys.p256dh,
                }, { onConflict: 'endpoint' });
            }
          }
        }
        await updatePush('enabled', true);
        toast({ title: 'Push értesítések engedélyezve', description: 'Mostantól böngésző értesítéseket is kapsz.' });
      } catch (err) {
        console.error('Hiba a feliratkozás során:', err);
        toast({ title: 'Hiba történt', description: 'Nem sikerült feliratkozni az értesítésekre.', variant: 'destructive' });
      } finally {
        setSaving(false);
      }
    } else if (result === 'denied') {
      toast({ title: 'Push értesítések tiltva', description: 'A böngésző beállításaiban engedélyezheted újra.', variant: 'destructive' });
    }
  };

  const emailNotifCount = Object.values(emailPrefs).filter(Boolean).length;
  const pushNotifCount = pushPrefs.enabled ? Object.entries(pushPrefs).filter(([k, v]) => k !== 'enabled' && v).length : 0;

  if (loading) {
    return <ContentSkeleton lines={8} />;
  }

  return (
    <div className="space-y-6">
      {/* ═══ EMAIL NOTIFICATIONS ═══ */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                E-mail értesítések
              </CardTitle>
              <CardDescription>Válaszd ki, mely eseményekről kapsz e-mail értesítést</CardDescription>
            </div>
            <Badge variant="outline" className="gap-1.5 text-xs">
              <MailCheck className="h-3 w-3" />
              {emailNotifCount} aktív
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          <NotifToggle
            id="email-missing"
            icon={FileWarning}
            label="Hiányzó számla riasztás"
            description="Értesítés, ha új hiányzó tétel érkezik egy ügyfélnél"
            checked={emailPrefs.missingInvoiceAlert}
            onCheckedChange={(v) => updateEmail('missingInvoiceAlert', v)}
            disabled={saving}
          />
          <Separator />
          <NotifToggle
            id="email-deadline"
            icon={Clock}
            label="Határidő emlékeztető"
            description="Értesítés 3 nappal a zárlati vagy NAV beadási határidő előtt"
            checked={emailPrefs.deadlineReminder}
            onCheckedChange={(v) => updateEmail('deadlineReminder', v)}
            disabled={saving}
          />
          <Separator />
          <NotifToggle
            id="email-status"
            icon={CheckCircle2}
            label="Ügyfél státusz változás"
            description="Értesítés, ha egy ügyfél státusza megváltozik (pl. Rendben → Kritikus)"
            checked={emailPrefs.clientStatusChange}
            onCheckedChange={(v) => updateEmail('clientStatusChange', v)}
            disabled={saving}
          />
          <Separator />
          <NotifToggle
            id="email-approval"
            icon={Shield}
            label="Jóváhagyási kérelem"
            description="Értesítés, ha új jóváhagyásra váró tétel érkezik"
            checked={emailPrefs.approvalRequest}
            onCheckedChange={(v) => updateEmail('approvalRequest', v)}
            disabled={saving}
          />
          <Separator />
          <NotifToggle
            id="email-weekly"
            icon={TrendingUp}
            label="Heti riport"
            description="Heti összesítő a portfólió állapotáról e-mailben"
            checked={emailPrefs.weeklyReport}
            onCheckedChange={(v) => updateEmail('weeklyReport', v)}
            disabled={saving}
          />
          <Separator />
          <NotifToggle
            id="email-monthly"
            icon={TrendingUp}
            label="Havi riport"
            description="Havi összesítő KPI-kkel, trendekkel és teljesítmény adatokkal"
            checked={emailPrefs.monthlyReport}
            onCheckedChange={(v) => updateEmail('monthlyReport', v)}
            disabled={saving}
          />
        </CardContent>
      </Card>

      {/* ═══ PUSH NOTIFICATIONS ═══ */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Push értesítések
              </CardTitle>
              <CardDescription>Böngésző értesítések — azonnali jelzés, az app megnyitása nélkül</CardDescription>
            </div>
            {pushPrefs.enabled ? (
              <Badge variant="outline" className="gap-1.5 text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-0">
                <BellRing className="h-3 w-3" />
                {pushNotifCount} aktív
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1.5 text-xs bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-0">
                <BellOff className="h-3 w-3" />
                Kikapcsolva
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Permission / Enable */}
          {!pushPrefs.enabled ? (
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 p-4 space-y-3">
              <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
                A push értesítések lehetővé teszik, hogy azonnal értesülj a fontos eseményekről, még akkor is ha az alkalmazás nincs megnyitva.
              </p>
              {pushPermission === 'denied' ? (
                <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                  ⚠️ A push értesítéseket a böngésző beállításaiban tiltottad le. Kérjük, engedélyezd újra a böngésző beállításaiban.
                </p>
              ) : (
                <Button onClick={requestPushPermission} className="gap-2">
                  <Bell className="h-4 w-4" />
                  Push értesítések engedélyezése
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Master toggle */}
              <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50 border border-border">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Push értesítések</span>
                </div>
                <Switch
                  checked={pushPrefs.enabled}
                  onCheckedChange={(v) => updatePush('enabled', v)}
                />
              </div>

              <div className="space-y-1">
                <NotifToggle
                  id="push-missing"
                  icon={FileWarning}
                  label="Hiányzó számla riasztás"
                  description="Azonnali push, ha hiányzó tétel érkezik"
                  checked={pushPrefs.missingInvoiceAlert}
                  onCheckedChange={(v) => updatePush('missingInvoiceAlert', v)}
                  disabled={!pushPrefs.enabled}
                />
                <Separator />
                <NotifToggle
                  id="push-deadline"
                  icon={Clock}
                  label="Határidő emlékeztető"
                  description="Push értesítés közelgő határidők előtt"
                  checked={pushPrefs.deadlineReminder}
                  onCheckedChange={(v) => updatePush('deadlineReminder', v)}
                  disabled={!pushPrefs.enabled}
                />
                <Separator />
                <NotifToggle
                  id="push-status"
                  icon={CheckCircle2}
                  label="Ügyfél státusz változás"
                  description="Push, ha ügyfél státusza változik"
                  checked={pushPrefs.clientStatusChange}
                  onCheckedChange={(v) => updatePush('clientStatusChange', v)}
                  disabled={!pushPrefs.enabled}
                />
                <Separator />
                <NotifToggle
                  id="push-approval"
                  icon={Shield}
                  label="Jóváhagyási kérelem"
                  description="Azonnali push új jóváhagyási kérelemnél"
                  checked={pushPrefs.approvalRequest}
                  onCheckedChange={(v) => updatePush('approvalRequest', v)}
                  disabled={!pushPrefs.enabled}
                />
                <Separator />
                <NotifToggle
                  id="push-critical"
                  icon={AlertTriangle}
                  label="Kritikus riasztások"
                  description="Azonnali push, ha kritikus státuszú ügyfél van (mindig ajánlott)"
                  checked={pushPrefs.criticalAlerts}
                  onCheckedChange={(v) => updatePush('criticalAlerts', v)}
                  disabled={!pushPrefs.enabled}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ═══ DIGEST ═══ */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5" />
                Összefoglaló (Digest)
              </CardTitle>
              <CardDescription>Időszakos összefoglaló e-mail a portfólió állapotáról — egy helyen minden fontos infó</CardDescription>
            </div>
            <Switch
              checked={digestPrefs.enabled}
              onCheckedChange={(v) => updateDigest('enabled', v)}
            />
          </div>
        </CardHeader>
        {digestPrefs.enabled && (
          <CardContent className="space-y-6">
            {/* Schedule settings */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Gyakoriság</Label>
                <Select value={digestPrefs.frequency} onValueChange={(v: DigestPrefs['frequency']) => updateDigest('frequency', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">
                      <div className="flex items-center gap-2">
                        <span>Naponta</span>
                        <span className="text-xs text-muted-foreground">— Minden munkanap</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="weekly">
                      <div className="flex items-center gap-2">
                        <span>Hetente</span>
                        <span className="text-xs text-muted-foreground">— Hétfő reggel</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="biweekly">
                      <div className="flex items-center gap-2">
                        <span>Kéthetente</span>
                        <span className="text-xs text-muted-foreground">— Hónap 1. és 15.</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Küldés időpontja</Label>
                <Select value={digestPrefs.deliveryTime} onValueChange={(v) => updateDigest('deliveryTime', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="07:00">07:00 — Kora reggel</SelectItem>
                    <SelectItem value="08:00">08:00 — Reggel</SelectItem>
                    <SelectItem value="09:00">09:00 — Munkakezdéskor</SelectItem>
                    <SelectItem value="12:00">12:00 — Délben</SelectItem>
                    <SelectItem value="17:00">17:00 — Munkaidő végén</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Content toggles */}
            <div>
              <p className="text-sm font-semibold text-foreground mb-3">Digest tartalom</p>
              <div className="space-y-1">
                <NotifToggle
                  id="digest-kpis"
                  icon={TrendingUp}
                  label="KPI mutatók"
                  description="Zárlati státusz, kritikus ügyfelek száma, feldolgozási arány"
                  checked={digestPrefs.includeKpis}
                  onCheckedChange={(v) => updateDigest('includeKpis', v)}
                />
                <Separator />
                <NotifToggle
                  id="digest-deadlines"
                  icon={Clock}
                  label="Közelgő határidők"
                  description="A következő időszakra eső NAV és zárlati határidők listája"
                  checked={digestPrefs.includeDeadlines}
                  onCheckedChange={(v) => updateDigest('includeDeadlines', v)}
                />
                <Separator />
                <NotifToggle
                  id="digest-missing"
                  icon={FileWarning}
                  label="Hiányzó tételek"
                  description="Összes nyitott hiányzó számla összesítő ügyfelenként"
                  checked={digestPrefs.includeMissingItems}
                  onCheckedChange={(v) => updateDigest('includeMissingItems', v)}
                />
                <Separator />
                <NotifToggle
                  id="digest-clients"
                  icon={Users}
                  label="Ügyfél összesítő"
                  description="Portfólió állapota: rendben/feldolgozandó/kritikus arány"
                  checked={digestPrefs.includeClientSummary}
                  onCheckedChange={(v) => updateDigest('includeClientSummary', v)}
                />
                <Separator />
                <NotifToggle
                  id="digest-audit"
                  icon={Shield}
                  label="Audit napló"
                  description="Az időszak fontosabb eseményeinek naplója"
                  checked={digestPrefs.includeAuditLog}
                  onCheckedChange={(v) => updateDigest('includeAuditLog', v)}
                />
              </div>
            </div>

            {/* Preview hint */}
            <div className="rounded-lg bg-muted/50 border border-border p-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                💡 <strong>Tipp:</strong> A{' '}
                {digestPrefs.frequency === 'daily' ? 'napi' : digestPrefs.frequency === 'weekly' ? 'heti' : 'kétheti'}{' '}
                digest e-mail {digestPrefs.deliveryTime}-kor érkezik a regisztrált e-mail címedre. 
                Az összefoglaló {Object.entries(digestPrefs).filter(([k, v]) => k.startsWith('include') && v).length} szekciót fog tartalmazni.
              </p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
