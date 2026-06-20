import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { ContentSkeleton } from "@/components/ui/content-skeleton";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import { AccountyNotificationPreferences } from '@/components/settings/AccountyNotificationPreferences';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog";
import { Building2, Bell, User, Palette, Shield, Info, Users, Copy, RefreshCw, X, UserPlus } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ProfileSection } from '@/components/settings/ProfileSection';
import { BusinessSection } from '@/components/settings/BusinessSection';
import { SystemSection } from '@/components/settings/SystemSection';
import { SecuritySection } from '@/components/settings/SecuritySection';
import { InviteUserDialog } from '@/components/settings/InviteUserDialog';
import { useUserRole } from '@/hooks/useUserRole';
import { useAccountyRole, type AccountyRole } from '@/pages/Accounty/AccountyRoleContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSearchParams } from "react-router-dom";

// ── Inline sub-components ──

function CompanyAccessCard({ companyId, toast }: { companyId: string; toast: any }) {
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [tokenCreatedAt, setTokenCreatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const TOKEN_DURATION_MS = 10 * 60 * 1000;

  useEffect(() => {
    const fetchToken = async () => {
      setLoading(true);
      const { data } = await supabase.from('companies').select('share_token, share_token_created_at').eq('id', companyId).single();
      setShareToken((data as any)?.share_token || null);
      setTokenCreatedAt((data as any)?.share_token_created_at || null);
      setLoading(false);
    };
    fetchToken();
  }, [companyId]);

  useEffect(() => {
    if (!shareToken || !tokenCreatedAt) { setRemainingSeconds(null); return; }
    const calcRemaining = () => {
      const created = new Date(tokenCreatedAt).getTime();
      return Math.max(0, Math.floor((created + TOKEN_DURATION_MS - Date.now()) / 1000));
    };
    setRemainingSeconds(calcRemaining());
    const interval = setInterval(() => {
      const r = calcRemaining();
      setRemainingSeconds(r);
      if (r <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [shareToken, tokenCreatedAt]);

  const isExpired = remainingSeconds !== null && remainingSeconds <= 0;
  const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

  const generateToken = async () => {
    setGenerating(true);
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    let token = '';
    for (let i = 0; i < 6; i++) token += chars[bytes[i] % chars.length];
    const now = new Date().toISOString();
    const { error } = await supabase.from('companies').update({ share_token: token, share_token_created_at: now } as any).eq('id', companyId);
    if (error) toast({ title: "Hiba", description: "Nem sikerült a kód generálása.", variant: "destructive" });
    else { setShareToken(token); setTokenCreatedAt(now); toast({ title: "Siker", description: "Meghívó kód generálva! 10 percig érvényes." }); }
    setGenerating(false);
  };

  const copyToken = () => {
    if (shareToken && !isExpired) {
      navigator.clipboard.writeText(shareToken);
      toast({ title: "Másolva", description: "Csatlakozási kód a vágólapra másolva." });
    }
  };

  if (loading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Cég hozzáférés</CardTitle>
        <CardDescription>Meghívó kód generálása, amivel mások csatlakozhatnak a céghez (10 percig érvényes)</CardDescription>
      </CardHeader>
      <CardContent>
        {!shareToken ? (
          <Button onClick={generateToken} disabled={generating}>{generating ? 'Generálás...' : 'Meghívó kód generálása'}</Button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className={`flex-1 px-4 py-2 bg-muted rounded-md font-mono text-lg tracking-widest text-center transition-all ${isExpired ? 'blur-sm select-none' : ''}`}>{shareToken}</div>
              <Button variant="outline" size="icon" onClick={copyToken} title="Másolás" disabled={isExpired}><Copy className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" onClick={generateToken} disabled={generating} title="Újragenerálás"><RefreshCw className="h-4 w-4" /></Button>
            </div>
            {remainingSeconds !== null && (
              <div className="flex items-center gap-2 text-sm">
                {isExpired ? <span className="text-destructive font-medium">Lejárt — kattints az újragenerálásra</span>
                  : <span className="text-muted-foreground">Hátralévő idő: <span className="font-mono font-medium text-foreground">{formatTime(remainingSeconds)}</span></span>}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FirmMembersCard({ companyId, companyName, isOwnerOrAdmin, toast }: { companyId: string; companyName: string; isOwnerOrAdmin: boolean; toast: any }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; userId: string; name: string } | null>(null);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const { data: members = [], isLoading: loading } = useQuery({
    queryKey: ['accounty-firm-members', companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from('accounty_assignments' as any)
        .select('id, accountant_user_id, role, created_at')
        .eq('accounting_firm_id', companyId);
      if (data && data.length > 0) {
        const userIds = (data as any[]).map((m: any) => m.accountant_user_id);
        const { data: profiles } = await supabase.from('profiles').select('user_id, name').in('user_id', userIds);
        const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
        return (data as any[]).map((m: any) => ({
          id: m.id,
          user_id: m.accountant_user_id,
          role: m.role,
          created_at: m.created_at,
          profile: profileMap.get(m.accountant_user_id) || null,
        }));
      }
      return [];
    },
    placeholderData: keepPreviousData,
  });

  const EAISYBOOKS_ROLES = [
    { value: 'iroda_admin', label: 'Iroda Admin', desc: 'Teljes hozzáférés, iroda kezelés', color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
    { value: 'senior_könyvelő', label: 'Senior Könyvelő', desc: 'Könyvelés, felügyelet', color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
    { value: 'könyvelő', label: 'Könyvelő', desc: 'Könyvelési feladatok', color: 'bg-teal-500/15 text-teal-600 dark:text-teal-400' },
    { value: 'asszisztens', label: 'Asszisztens', desc: 'Adminisztrációs feladatok', color: 'bg-slate-500/15 text-slate-600 dark:text-slate-400' },
  ];

  const getRoleBadge = (role: string) => {
    const r = EAISYBOOKS_ROLES.find(rr => rr.value === role);
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r?.color || 'bg-muted text-muted-foreground'}`}>{r?.label || role}</span>;
  };

  const updateMemberRole = async (memberId: string, newRole: string) => {
    setUpdatingRole(memberId);
    const { data, error } = await supabase
      .from('accounty_assignments' as any)
      .update({ role: newRole } as any)
      .eq('id', memberId)
      .select();
    if (error) {
      toast({ title: "Hiba", description: "Nem sikerült a szerepkör módosítása.", variant: "destructive" });
    } else if (!data || data.length === 0) {
      toast({ title: "Hiba", description: "Nincs jogosultságod a szerepkör módosításához.", variant: "destructive" });
    } else {
      toast({ title: "Siker", description: "Szerepkör frissítve." });
      queryClient.invalidateQueries({ queryKey: ['accounty-firm-members', companyId] });
    }
    setUpdatingRole(null);
  };

  const removeMember = async (memberId: string, userId: string) => {
    if (userId === user?.id) return; // Can't remove yourself
    const { error } = await supabase.from('accounty_assignments' as any).delete().eq('id', memberId);
    if (error) toast({ title: "Hiba", description: "Nem sikerült a tag eltávolítása.", variant: "destructive" });
    else { toast({ title: "Siker", description: "Tag eltávolítva." }); queryClient.invalidateQueries({ queryKey: ['accounty-firm-members', companyId] }); }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Tagok</CardTitle>
            <CardDescription>Az irodához tartozó munkatársak</CardDescription>
          </div>
          {isOwnerOrAdmin && (
            <Button size="sm" onClick={() => setInviteOpen(true)} className="gap-1.5">
              <UserPlus className="h-4 w-4" />
              Tag hozzáadása
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <p className="text-sm text-muted-foreground">Betöltés...</p> : members.length === 0 ? <p className="text-sm text-muted-foreground">Nincsenek tagok.</p> : (
          <div className="space-y-2">
            {members.map(member => {
              const isSelf = member.user_id === user?.id;
              const canChangeRole = isOwnerOrAdmin && !isSelf;
              return (
                <div key={member.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{member.profile?.name || 'Névtelen felhasználó'}</p>
                      {getRoleBadge(member.role)}
                    </div>
                    <p className="text-sm text-muted-foreground">Csatlakozott: {new Date(member.created_at).toLocaleDateString('hu-HU')}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {canChangeRole && (
                      <select
                        value={member.role}
                        disabled={updatingRole === member.id}
                        onChange={(e) => updateMemberRole(member.id, e.target.value)}
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {EAISYBOOKS_ROLES.map(r => (
                          <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>
                        ))}
                      </select>
                    )}
                    {isOwnerOrAdmin && !isSelf && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setDeleteTarget({ id: member.id, userId: member.user_id, name: member.profile?.name || 'Névtelen felhasználó' })}
                        title="Tag eltávolítása"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <InviteUserDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        companyId={companyId}
        companyName={companyName}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['accounty-firm-members', companyId] })}
        toast={toast}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tag eltávolítása</AlertDialogTitle>
            <AlertDialogDescription>
              Biztosan el szeretné távolítani **{deleteTarget?.name}** munkatársat a(z) **{companyName}** irodából?
              Ezzel a művelettel a felhasználó elveszíti hozzáférését az irodai funkciókhoz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Mégsem</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) {
                  removeMember(deleteTarget.id, deleteTarget.userId);
                  setDeleteTarget(null);
                }
              }}
            >
              Eltávolítás
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ── Types ──

interface Profile { name: string; company: string; position: string; avatar_url: string; }
interface SystemSettings { theme: string; language: string; date_format: string; number_format: string; timezone: string; }

// ── Main ──

export default function ProfileSettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const { isAdmin } = useUserRole();
  const { role: accountyRole } = useAccountyRole();
  const { companies, selectedCompany, setSelectedCompany, refreshCompanies, loading: companiesLoading } = useCompany();

  // Fetch the accounting firm name for the current user
  const { data: firmName } = useQuery({
    queryKey: ['accounty-firm-name', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('accounty_assignments' as any)
        .select('accounting_firm_id')
        .eq('accountant_user_id', user!.id)
        .limit(1);
      if (!data || data.length === 0) return null;
      const firmId = (data[0] as any).accounting_firm_id;
      const { data: company } = await supabase
        .from('companies')
        .select('name')
        .eq('id', firmId)
        .single();
      return company?.name || null;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const ACCOUNTY_ROLE_LABELS: Record<string, string> = {
    iroda_admin: 'Iroda Admin',
    senior_könyvelő: 'Senior Könyvelő',
    könyvelő: 'Könyvelő',
    asszisztens: 'Asszisztens',
  };
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);

  // Tab management via search params
  const SETTINGS_TABS = ['profile', 'business', 'notifications', 'system', 'security'] as const;
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') as typeof SETTINGS_TABS[number] | null;
  const activeSettingsTab = tabFromUrl && SETTINGS_TABS.includes(tabFromUrl) ? tabFromUrl : 'profile';
  const setActiveSettingsTab = (tab: string) => {
    setSearchParams({ tab }, { replace: true });
  };

  const [profile, setProfile] = useState<Profile>({ name: '', company: '', position: '', avatar_url: '' });
  const [companyName, setCompanyName] = useState('');
  const [companyTaxNumber, setCompanyTaxNumber] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [savingCompany, setSavingCompany] = useState(false);
  const [initialProfile, setInitialProfile] = useState<Profile | null>(null);
  const [initialCompanyData, setInitialCompanyData] = useState<{ name: string; taxNumber: string; address: string } | null>(null);

  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    theme, language: 'hu', date_format: 'DD/MM/YYYY', number_format: '1 234 567,89', timezone: 'Europe/Budapest',
  });

  // Sync company data
  useEffect(() => {
    if (selectedCompany) {
      setCompanyName(selectedCompany.name);
      setCompanyTaxNumber(selectedCompany.tax_number || '');
      setCompanyAddress(selectedCompany.address || '');
      setInitialCompanyData({ name: selectedCompany.name, taxNumber: selectedCompany.tax_number || '', address: selectedCompany.address || '' });
    }
  }, [selectedCompany]);

  // Unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (!initialDataLoaded || !initialProfile) return false;
    const profileChanged = profile.name !== initialProfile.name || profile.company !== initialProfile.company || profile.position !== initialProfile.position;
    let companyChanged = false;
    if (initialCompanyData && selectedCompany) {
      companyChanged = companyName !== initialCompanyData.name || companyTaxNumber !== initialCompanyData.taxNumber || companyAddress !== initialCompanyData.address;
    }
    return profileChanged || companyChanged;
  }, [profile, initialProfile, companyName, companyTaxNumber, companyAddress, initialCompanyData, selectedCompany, initialDataLoaded]);

  const { showDialog, confirmNavigation, cancelNavigation } = useUnsavedChanges(hasUnsavedChanges);

  useEffect(() => { setSystemSettings(prev => ({ ...prev, theme })); }, [theme]);

  useEffect(() => {
    if (user) { fetchProfile(); fetchSettings(); }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase.from('profiles').select('name, company, position, avatar_url').eq('user_id', user.id).single();
    if (data) {
      const p = { name: data.name || '', company: data.company || '', position: data.position || '', avatar_url: data.avatar_url || '' };
      setProfile(p); setInitialProfile(p); setInitialDataLoaded(true);
    } else {
      setInitialProfile({ name: '', company: '', position: '', avatar_url: '' }); setInitialDataLoaded(true);
    }
  };

  const fetchSettings = async () => {
    if (!user) return;
    const { data } = await supabase.from('settings').select('category, key, value').eq('user_id', user.id);
    if (data && data.length > 0) {
      data.forEach(setting => {
        if (setting.category === 'system') setSystemSettings(prev => ({ ...prev, [setting.key]: setting.value }));
      });
    }
  };

  const updateProfile = async () => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from('profiles').upsert({ user_id: user.id, name: profile.name, company: profile.company, position: profile.position, avatar_url: profile.avatar_url }, { onConflict: 'user_id' });
    if (error) toast({ title: 'Hiba történt', description: 'A profil mentése sikertelen.', variant: 'destructive' });
    else { setInitialProfile({ ...profile }); toast({ title: 'Siker', description: 'A profil sikeresen mentve.' }); }
    setLoading(false);
  };

  const updateSettings = async (category: string, settings: any) => {
    if (!user) return;
    setLoading(true);
    try {
      for (const [key, value] of Object.entries(settings)) {
        const { error } = await supabase.from('settings').upsert({ user_id: user.id, category, key, value: value as any }, { onConflict: 'user_id,category,key' });
        if (error) throw error;
      }
      toast({ title: 'Siker', description: 'A beállítások sikeresen mentve.' });
    } catch { toast({ title: 'Hiba történt', description: 'A beállítások mentése sikertelen.', variant: 'destructive' }); }
    setLoading(false);
  };

  const saveCompanyData = async () => {
    if (!selectedCompany || !companyName.trim()) return;
    setSavingCompany(true);
    try {
      const { error } = await supabase.from('companies').update({ name: companyName.trim(), tax_number: companyTaxNumber.trim() || null, address: companyAddress.trim() || null }).eq('id', selectedCompany.id);
      if (error) throw error;
      await refreshCompanies();
      setSelectedCompany({ ...selectedCompany, name: companyName.trim(), tax_number: companyTaxNumber.trim() || null, address: companyAddress.trim() || null });
      setInitialCompanyData({ name: companyName.trim(), taxNumber: companyTaxNumber.trim(), address: companyAddress.trim() });
      toast({ title: 'Siker', description: 'Cég adatai sikeresen mentve.' });
    } catch { toast({ title: 'Hiba történt', description: 'A cég adatainak mentése sikertelen.', variant: 'destructive' }); }
    finally { setSavingCompany(false); }
  };

  const handleExportData = async () => {
    try {
      setExportLoading(true);
      const { data, error } = await supabase.functions.invoke('export-user-data', {
        headers: { Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` },
      });
      if (error) throw error;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `eaisybill-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: 'Siker', description: 'Adatok sikeresen exportálva és letöltve!' });
    } catch { toast({ title: 'Hiba', description: 'Hiba történt az adatok exportálása során.', variant: 'destructive' }); }
    finally { setExportLoading(false); }
  };

  if (!initialDataLoaded || companiesLoading) return <ContentSkeleton />;

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      <div className="mb-2">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Beállítások</h1>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild><Info className="h-5 w-5 text-muted-foreground cursor-help" /></TooltipTrigger>
              <TooltipContent className="max-w-xs"><p>Itt kezelheted a profil adataid, cég információid, értesítési beállításokat, témát és biztonságot.</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Rendszer és üzleti beállítások kezelése</p>
      </div>

      <Tabs value={activeSettingsTab} onValueChange={setActiveSettingsTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="profile" className="flex items-center gap-2"><User className="h-4 w-4" />Profil</TabsTrigger>
          <TabsTrigger value="business" className="flex items-center gap-2"><Building2 className="h-4 w-4" />Cég</TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2"><Bell className="h-4 w-4" />Értesítések</TabsTrigger>
          <TabsTrigger value="system" className="flex items-center gap-2"><Palette className="h-4 w-4" />Rendszer</TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2"><Shield className="h-4 w-4" />Biztonság</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileSection
            profile={profile}
            setProfile={setProfile}
            onSave={updateProfile}
            loading={loading}
            readOnlyOverrides={{
              position: ACCOUNTY_ROLE_LABELS[accountyRole] || accountyRole,
              company: firmName || undefined,
            }}
          />
        </TabsContent>

        <TabsContent value="business">
          <BusinessSection
            selectedCompany={selectedCompany}
            userId={user?.id}
            companyName={companyName}
            setCompanyName={setCompanyName}
            companyTaxNumber={companyTaxNumber}
            setCompanyTaxNumber={setCompanyTaxNumber}
            companyAddress={companyAddress}
            setCompanyAddress={setCompanyAddress}
            savingCompany={savingCompany}
            onSave={saveCompanyData}
            companies={companies}
            setSelectedCompany={setSelectedCompany}
          >
            {selectedCompany && selectedCompany.owner_id === user?.id && (
              <CompanyAccessCard companyId={selectedCompany.id} toast={toast} />
            )}
            {selectedCompany && (
              <FirmMembersCard companyId={selectedCompany.id} companyName={selectedCompany.name} isOwnerOrAdmin={isAdmin} toast={toast} />
            )}
          </BusinessSection>
        </TabsContent>

        <TabsContent value="notifications">
          <AccountyNotificationPreferences />
        </TabsContent>

        <TabsContent value="system">
          <SystemSection
            systemSettings={systemSettings}
            onThemeChange={(value) => { const resolved = value === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : value as 'light' | 'dark'; setTheme(resolved); setSystemSettings(prev => ({ ...prev, theme: value })); }}
            onSave={() => updateSettings('system', systemSettings)}
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="security">
          <SecuritySection
            onChangePassword={() => setPasswordDialogOpen(true)}
            onExportData={handleExportData}
            exportLoading={exportLoading}
            showAvdh
          />
        </TabsContent>
      </Tabs>

      <ChangePasswordDialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen} />
      <UnsavedChangesDialog open={showDialog} onConfirm={confirmNavigation} onCancel={cancelNavigation} />
    </div>
  );
}
