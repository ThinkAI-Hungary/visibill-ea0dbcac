import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import { EmailPreferences } from "@/components/EmailPreferences";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog";
import { Building2, Bell, User, Palette, Shield, Info, Users, Copy, RefreshCw, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ProfileSection } from '@/components/settings/ProfileSection';
import { BusinessSection } from '@/components/settings/BusinessSection';
import { SystemSection } from '@/components/settings/SystemSection';
import { SecuritySection } from '@/components/settings/SecuritySection';

// ── Inline sub-components (CompanyAccessCard, CompanyMembersCard) kept here for simplicity ──
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let token = '';
    for (let i = 0; i < 6; i++) token += chars[Math.floor(Math.random() * chars.length)];
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

function CompanyMembersCard({ companyId, ownerId, isOwner, toast }: { companyId: string; ownerId: string; isOwner: boolean; toast: any }) {
  const queryClient = useQueryClient();
  const { data: members = [], isLoading: loading } = useQuery({
    queryKey: queryKeys.settingsMembers(companyId),
    queryFn: async () => {
      const { data } = await supabase.from('company_members').select('id, user_id, created_at').eq('company_id', companyId);
      if (data && data.length > 0) {
        const userIds = data.map(m => m.user_id);
        const { data: profiles } = await supabase.from('profiles').select('user_id, name').in('user_id', userIds);
        const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
        return data.map(m => ({ ...m, profile: profileMap.get(m.user_id) || null }));
      }
      return [];
    },
  });

  const removeMember = async (memberId: string, userId: string) => {
    if (userId === ownerId) return;
    const { error } = await supabase.from('company_members').delete().eq('id', memberId);
    if (error) toast({ title: "Hiba", description: "Nem sikerült a tag eltávolítása.", variant: "destructive" });
    else { toast({ title: "Siker", description: "Tag eltávolítva." }); queryClient.invalidateQueries({ queryKey: queryKeys.settingsMembers(companyId) }); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Tagok</CardTitle>
        <CardDescription>A céghez hozzáféréssel rendelkező felhasználók</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? <p className="text-sm text-muted-foreground">Betöltés...</p> : members.length === 0 ? <p className="text-sm text-muted-foreground">Nincsenek tagok.</p> : (
          <div className="space-y-2">
            {members.map(member => (
              <div key={member.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div>
                  <p className="font-medium">
                    {member.profile?.name || 'Névtelen felhasználó'}
                    {member.user_id === ownerId ? <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Tulajdonos</span>
                      : <span className="ml-2 text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Admin</span>}
                  </p>
                  <p className="text-sm text-muted-foreground">Csatlakozott: {new Date(member.created_at).toLocaleDateString('hu-HU')}</p>
                </div>
                {isOwner && member.user_id !== ownerId && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeMember(member.id, member.user_id)} title="Tag eltávolítása"><X className="h-4 w-4" /></Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Types ──

interface Profile { name: string; company: string; position: string; avatar_url: string; }
interface SystemSettings { theme: string; language: string; date_format: string; number_format: string; timezone: string; }

// ── Main ──

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const { companies, selectedCompany, setSelectedCompany, refreshCompanies, loading: companiesLoading } = useCompany();
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);

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
      link.download = `visibill-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: 'Siker', description: 'Adatok sikeresen exportálva és letöltve!' });
    } catch { toast({ title: 'Hiba', description: 'Hiba történt az adatok exportálása során.', variant: 'destructive' }); }
    finally { setExportLoading(false); }
  };

  if (!initialDataLoaded || companiesLoading) return <LoadingSpinner message="Beállítások betöltése..." />;

  return (
    <div className="container mx-auto py-8 px-6">
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold">Beállítások</h1>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild><Info className="h-5 w-5 text-muted-foreground cursor-help" /></TooltipTrigger>
              <TooltipContent className="max-w-xs"><p>Itt kezelheted a profil adataid, cég információid, értesítési beállításokat, témát és biztonságot.</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <p className="text-muted-foreground mt-2">Rendszer és üzleti beállítások kezelése</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="profile" className="flex items-center gap-2"><User className="h-4 w-4" />Profil</TabsTrigger>
          <TabsTrigger value="business" className="flex items-center gap-2"><Building2 className="h-4 w-4" />Cég</TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2"><Bell className="h-4 w-4" />Értesítések</TabsTrigger>
          <TabsTrigger value="system" className="flex items-center gap-2"><Palette className="h-4 w-4" />Rendszer</TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2"><Shield className="h-4 w-4" />Biztonság</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileSection profile={profile} setProfile={setProfile} onSave={updateProfile} loading={loading} />
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
              <CompanyMembersCard companyId={selectedCompany.id} ownerId={selectedCompany.owner_id} isOwner={selectedCompany.owner_id === user?.id} toast={toast} />
            )}
          </BusinessSection>
        </TabsContent>

        <TabsContent value="notifications">
          <EmailPreferences />
        </TabsContent>

        <TabsContent value="system">
          <SystemSection
            systemSettings={systemSettings}
            onThemeChange={(value) => { setTheme(value as 'light' | 'dark' | 'system'); setSystemSettings(prev => ({ ...prev, theme: value })); }}
            onSave={() => updateSettings('system', systemSettings)}
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="security">
          <SecuritySection
            onChangePassword={() => setPasswordDialogOpen(true)}
            onExportData={handleExportData}
            exportLoading={exportLoading}
          />
        </TabsContent>
      </Tabs>

      <ChangePasswordDialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen} />
      <UnsavedChangesDialog open={showDialog} onConfirm={confirmNavigation} onCancel={cancelNavigation} />
    </div>
  );
}
