import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useCompany, VatRegime } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { ContentSkeleton } from "@/components/ui/content-skeleton";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import { ChangeEmailDialog } from "@/components/ChangeEmailDialog";
import { EmailPreferences } from "@/components/EmailPreferences";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog";
import { Building2, Bell, User, Palette, Shield, Info, Users, Copy, RefreshCw, X, UserPlus, AlertTriangle, Landmark } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ProfileSection } from '@/components/settings/ProfileSection';
import { BusinessSection } from '@/components/settings/BusinessSection';
import { SystemSection } from '@/components/settings/SystemSection';
import { SecuritySection } from '@/components/settings/SecuritySection';
import { InviteUserDialog } from '@/components/settings/InviteUserDialog';
import { EaisybillPermissionPanel } from '@/components/settings/EaisybillPermissionPanel';
import { BankAccountsTab } from '@/components/settings/BankAccountsTab';
import { useUserRole } from '@/hooks/useUserRole';
import { reportError } from '@/lib/errorReporter';
import { useUrlTab } from '@/lib/navigation';

// ── Inline sub-components (CompanyAccessCard, CompanyMembersCard) kept here for simplicity ──
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
    // Cryptographically secure 6-char token (Crockford-style, no ambiguous chars).
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    let token = '';
    for (let i = 0; i < 6; i++) token += chars[bytes[i] % chars.length];
    const now = new Date().toISOString();
    const { error } = await supabase.from('companies').update({ share_token: token, share_token_created_at: now }).eq('id', companyId);
    if (error) { reportError({ type: 'db_query', component: 'Settings', action: 'generateToken', message: 'Share token generation failed', error }); toast({ title: "Hiba", description: "Nem sikerült a kód generálása.", variant: "destructive" }); }
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

function CompanyMembersCard({ companyId, companyName, ownerId, isOwnerOrAdmin, toast }: { companyId: string; companyName: string; ownerId: string; isOwnerOrAdmin: boolean; toast: any }) {
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; userId: string; name: string } | null>(null);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null); // member.id being updated
  const { data: members = [], isLoading: loading } = useQuery({
    queryKey: queryKeys.settingsMembers(companyId),
    queryFn: async () => {
      const { data } = await supabase.from('company_members').select('id, user_id, role, created_at').eq('company_id', companyId);
      if (data && data.length > 0) {
        const userIds = data.map(m => m.user_id);
        const { data: profiles } = await supabase.from('profiles').select('user_id, name').in('user_id', userIds);
        const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
        return data.map(m => ({ ...m, profile: profileMap.get(m.user_id) || null }));
      }
      return [];
    },
    placeholderData: keepPreviousData,
  });

  const EAISYBILL_ROLES = [
    { value: 'admin', label: 'Admin', desc: 'Teljes hozzáférés, beállítások', color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
    { value: 'member', label: 'Pénzügyes', desc: 'Pénzügyi modulok olvasás/írás', color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
    { value: 'assistant', label: 'Pénzügyi asszisztens', desc: 'Számlák, tranzakciók kezelése', color: 'bg-teal-500/15 text-teal-600 dark:text-teal-400' },
    { value: 'viewer', label: 'Betekintő', desc: 'Csak olvasás', color: 'bg-slate-500/15 text-slate-600 dark:text-slate-400' },
    { value: 'employee', label: 'Munkavállaló', desc: 'Csak munkaidő', color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  ];

  const getRoleBadge = (role: string, userId: string) => {
    if (userId === ownerId) return <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Tulajdonos</span>;
    const r = EAISYBILL_ROLES.find(rr => rr.value === role);
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r?.color || 'bg-muted text-muted-foreground'}`}>{r?.label || role}</span>;
  };

  const updateMemberRole = async (memberId: string, newRole: string) => {
    setUpdatingRole(memberId);
    const { data, error, count } = await supabase
      .from('company_members')
      .update({ role: newRole })
      .eq('id', memberId)
      .select();
    if (error) {
      reportError({ type: 'db_query', component: 'Settings', action: 'updateMemberRole', message: 'Role update failed', error });
      toast({ title: "Hiba", description: "Nem sikerült a szerepkör módosítása.", variant: "destructive" });
    } else if (!data || data.length === 0) {
      // RLS blocked — no rows affected
      toast({ title: "Hiba", description: "Nincs jogosultságod a szerepkör módosításához. Csak a cég tulajdonosa módosíthat.", variant: "destructive" });
    } else {
      toast({ title: "Siker", description: "Szerepkör frissítve." });
      queryClient.invalidateQueries({ queryKey: queryKeys.settingsMembers(companyId) });
      queryClient.invalidateQueries({ queryKey: ['user-role'] });
    }
    setUpdatingRole(null);
  };

  const removeMember = async (memberId: string, userId: string) => {
    if (userId === ownerId) return;
    const { error } = await supabase.from('company_members').delete().eq('id', memberId);
    if (error) { reportError({ type: 'db_query', component: 'Settings', action: 'removeMember', message: 'Member removal failed', error }); toast({ title: "Hiba", description: "Nem sikerült a tag eltávolítása.", variant: "destructive" }); }
    else { toast({ title: "Siker", description: "Tag eltávolítva." }); queryClient.invalidateQueries({ queryKey: queryKeys.settingsMembers(companyId) }); }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Tagok</CardTitle>
            <CardDescription>A céghez hozzáféréssel rendelkező felhasználók</CardDescription>
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
              const isOwnerRow = member.user_id === ownerId;
              const canChangeRole = isOwnerOrAdmin && !isOwnerRow;
              return (
                <div key={member.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{member.profile?.name || 'Névtelen felhasználó'}</p>
                      {getRoleBadge(member.role, member.user_id)}
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
                        {EAISYBILL_ROLES.map(r => (
                          <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>
                        ))}
                      </select>
                    )}
                    {isOwnerOrAdmin && !isOwnerRow && (
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
        onSuccess={() => queryClient.invalidateQueries({ queryKey: queryKeys.settingsMembers(companyId) })}
        toast={toast}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tag eltávolítása</AlertDialogTitle>
            <AlertDialogDescription>
              Biztosan el szeretné távolítani **{deleteTarget?.name}** felhasználót a(z) **{companyName}** cég tagjai közül?
              Ezzel a művelettel a felhasználó elveszíti hozzáférését a cég adataihoz, de a fiókja nem törlődik.
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

function FxSettingsCard({ companyId, toast }: { companyId: string; toast: any }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data: fxSettings, isLoading } = useQuery({
    queryKey: queryKeys.fxSettings(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_fx_settings')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const [rateSource, setRateSource] = useState('MNB');

  useEffect(() => {
    if (fxSettings?.rate_source) setRateSource(fxSettings.rate_source);
  }, [fxSettings]);

  const save = async () => {
    setSaving(true);
    try {
      if (fxSettings) {
        const { error } = await supabase
          .from('company_fx_settings')
          .update({ rate_source: rateSource, updated_at: new Date().toISOString() })
          .eq('company_id', companyId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('company_fx_settings')
          .insert({ company_id: companyId, rate_source: rateSource });
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.fxSettings(companyId) });
      toast({ title: 'Siker', description: 'Árfolyam beállítások mentve.' });
    } catch (err: any) {
      toast({ title: 'Hiba', description: err.message || 'Nem sikerült menteni.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Árfolyam-forrás
        </CardTitle>
        <CardDescription>
          Melyik intézmény napi árfolyamát használja a rendszer a devizás árfolyam-különbözet számításhoz?
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          <select
            value={rateSource}
            onChange={(e) => setRateSource(e.target.value)}
            className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="MNB">MNB (Magyar Nemzeti Bank)</option>
            <option value="ECB" disabled>EKB (Európai Központi Bank) — hamarosan</option>
            <option value="BANK" disabled>Számlavezető bank — hamarosan</option>
          </select>
          <Button onClick={save} disabled={saving} size="sm">
            {saving ? 'Mentés...' : 'Mentés'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Az MNB napi árfolyama a számviteli szabályok szerint a leggyakoribb választás.
        </p>
      </CardContent>
    </Card>
  );
}

const VAT_REGIME_LABELS: Record<VatRegime, string> = {
  normal: 'Általános ÁFA',
  penzforgalmi: 'Pénzforgalmi elszámolás',
  alanyi_mentes: 'Alanyi adómentesség',
};

const VAT_REGIME_COLORS: Record<VatRegime, string> = {
  normal: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  penzforgalmi: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
  alanyi_mentes: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
};

function VatRegimeCard({ companyId, currentRegime, toast, onSaved }: {
  companyId: string;
  currentRegime: VatRegime;
  toast: any;
  onSaved: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingRegime, setPendingRegime] = useState<VatRegime | null>(null);
  const [saving, setSaving] = useState(false);

  const nextYear = new Date().getFullYear() + 1;

  const handleRegimeChange = (value: string) => {
    const newRegime = value as VatRegime;
    if (newRegime === currentRegime) return;
    setPendingRegime(newRegime);
    setConfirmOpen(true);
  };

  const confirmChange = async () => {
    if (!pendingRegime) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('companies')
        .update({
          vat_regime: pendingRegime,
          vat_regime_effective_from: `${nextYear}-01-01`,
        })
        .eq('id', companyId);
      if (error) throw error;
      toast({ title: 'ÁFA rendszer módosítva', description: `A változás ${nextYear}.01.01-től érvényes.` });
      onSaved();
    } catch (err: any) {
      toast({ title: 'Hiba', description: err.message || 'Nem sikerült menteni.', variant: 'destructive' });
    } finally {
      setSaving(false);
      setConfirmOpen(false);
      setPendingRegime(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          ÁFA rendszer
        </CardTitle>
        <CardDescription>
          A cég ÁFA elszámolási módja. Módosítás esetén a változás a következő adóévtől lép érvénybe.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Jelenlegi:</span>
          <Badge variant="outline" className={VAT_REGIME_COLORS[currentRegime]}>
            {VAT_REGIME_LABELS[currentRegime]}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <Select value={currentRegime} onValueChange={handleRegimeChange}>
            <SelectTrigger className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Általános ÁFA</SelectItem>
              <SelectItem value="penzforgalmi">Pénzforgalmi elszámolás</SelectItem>
              <SelectItem value="alanyi_mentes">Alanyi adómentesség</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">
          Az ÁFA rendszer módosítása bejelentési kötelezettséggel jár a NAV felé.
          Kérjük, egyeztesd könyvelőddel, mielőtt megváltoztatod.
        </p>
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              ÁFA rendszer módosítása
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Az ÁFA rendszer módosítása bejelentési kötelezettséggel jár a NAV felé.
                  A változás a <strong>következő adóév első napjától ({nextYear}.01.01.)</strong> lép érvénybe.
                </p>
                <p>
                  Új rendszer: <strong>{pendingRegime ? VAT_REGIME_LABELS[pendingRegime] : ''}</strong>
                </p>
                <p className="text-amber-600">
                  Kérjük, győződj meg róla, hogy a NAV bejelentés megtörtént, és könyvelőddel egyeztetted!
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Mégse</AlertDialogCancel>
            <AlertDialogAction onClick={confirmChange} disabled={saving}>
              {saving ? 'Mentés...' : 'Megerősítem, a bejelentés megtörtént'}
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

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const { isAdmin, role: userRole } = useUserRole();
  const { companies, selectedCompany, setSelectedCompany, refreshCompanies, loading: companiesLoading } = useCompany();
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);

  // Sync settings tab to URL
  const SETTINGS_TABS = ['profile', 'business', 'bank-accounts', 'notifications', 'system', 'security'] as const;
  const [activeSettingsTab, setActiveSettingsTab] = useUrlTab('settings', 'profile', SETTINGS_TABS);

  const [profile, setProfile] = useState<Profile>({ name: '', company: '', position: '', avatar_url: '' });
  const [companyName, setCompanyName] = useState('');
  const [companyTaxNumber, setCompanyTaxNumber] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyDescription, setCompanyDescription] = useState('');
  const [companyPrimaryTeaor, setCompanyPrimaryTeaor] = useState('');
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  const [initialProfile, setInitialProfile] = useState<Profile | null>(null);
  const [initialCompanyData, setInitialCompanyData] = useState<{ name: string; taxNumber: string; address: string; description: string; primaryTeaor: string } | null>(null);

  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    theme, language: 'hu', date_format: 'DD/MM/YYYY', number_format: '1 234 567,89', timezone: 'Europe/Budapest',
  });

  useEffect(() => {
    if (selectedCompany) {
      setCompanyName(selectedCompany.name);
      setCompanyTaxNumber(selectedCompany.tax_number || '');
      setCompanyAddress(selectedCompany.address || '');
      setCompanyDescription(selectedCompany.description || '');
      setCompanyPrimaryTeaor(selectedCompany.primary_teaor || '');
      setInitialCompanyData({ 
        name: selectedCompany.name, 
        taxNumber: selectedCompany.tax_number || '', 
        address: selectedCompany.address || '',
        description: selectedCompany.description || '',
        primaryTeaor: selectedCompany.primary_teaor || '',
      });
    }
  }, [selectedCompany]);

  const hasUnsavedChanges = useMemo(() => {
    if (!initialDataLoaded || !initialProfile) return false;
    const profileChanged = profile.name !== initialProfile.name || profile.company !== initialProfile.company || profile.position !== initialProfile.position;
    let companyChanged = false;
    if (initialCompanyData && selectedCompany) {
      companyChanged = companyName !== initialCompanyData.name || 
                       companyTaxNumber !== initialCompanyData.taxNumber || 
                       companyAddress !== initialCompanyData.address ||
                       companyDescription !== initialCompanyData.description ||
                       companyPrimaryTeaor !== initialCompanyData.primaryTeaor;
    }
    return profileChanged || companyChanged;
  }, [profile, initialProfile, companyName, companyTaxNumber, companyAddress, companyDescription, companyPrimaryTeaor, initialCompanyData, selectedCompany, initialDataLoaded]);

  const { showDialog, confirmNavigation, cancelNavigation } = useUnsavedChanges(hasUnsavedChanges);

  useEffect(() => { setSystemSettings(prev => ({ ...prev, theme })); }, [theme]);

  useEffect(() => {
    if (user) { fetchProfile(); fetchSettings(); }
  }, [user]);

  const ACCOUNTY_ROLE_LABELS: Record<string, string> = {
    iroda_admin: 'Iroda Admin',
    senior_könyvelő: 'Senior Könyvelő',
    könyvelő: 'Könyvelő',
    asszisztens: 'Asszisztens',
  };

  /** Human-readable labels for eaisybill roles (company_members) */
  const EAISYBILL_ROLE_LABELS: Record<string, string> = {
    owner: 'Tulajdonos',
    admin: 'Admin',
    member: 'Pénzügyes',
    assistant: 'Pénzügyi asszisztens',
    viewer: 'Betekintő',
    employee: 'Munkavállaló',
  };

  const { data: accountantAssignmentInfo } = useQuery({
    queryKey: ['settings-accountant-assignment', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data: assignments, error } = await supabase
        .from('accounty_assignments')
        .select('accounting_firm_id, role')
        .eq('accountant_user_id', user.id);
      
      if (error || !assignments || assignments.length === 0) return null;

      // Role priority: pick the highest privilege
      const ROLE_PRIORITY: Record<string, number> = {
        'iroda_admin': 4,
        'senior_könyvelő': 3,
        'könyvelő': 2,
        'asszisztens': 1,
        'senior': 4,
        'admin': 4,
        'junior': 2,
      };

      const roles = assignments.map((d: any) => d.role as string);
      const bestRole = roles.reduce((best, current) => {
        const bestPrio = ROLE_PRIORITY[best] ?? 0;
        const currentPrio = ROLE_PRIORITY[current] ?? 0;
        return currentPrio > bestPrio ? current : best;
      }, roles[0]);

      // Map legacy values
      let finalRole = bestRole;
      if (bestRole === 'senior' || bestRole === 'admin') finalRole = 'iroda_admin';
      if (bestRole === 'junior') finalRole = 'könyvelő';

      const firmId = assignments[0].accounting_firm_id;
      const { data: company } = await supabase
        .from('companies')
        .select('name')
        .eq('id', firmId)
        .maybeSingle();

      return {
        role: finalRole,
        firmName: company?.name || null,
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

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
    if (error) { reportError({ type: 'db_query', component: 'Settings', action: 'updateProfile', message: 'Profile upsert failed', error }); toast({ title: 'Hiba történt', description: 'A profil mentése sikertelen.', variant: 'destructive' }); }
    else {
      // Sync name into auth user_metadata so the sidebar re-renders immediately
      await supabase.auth.updateUser({ data: { name: profile.name } });
      setInitialProfile({ ...profile });
      toast({ title: 'Siker', description: 'A profil sikeresen mentve.' });
    }
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
    } catch (err) { reportError({ type: 'db_query', component: 'Settings', action: 'updateSettings', message: 'Settings upsert failed', error: err }); toast({ title: 'Hiba történt', description: 'A beállítások mentése sikertelen.', variant: 'destructive' }); }
    setLoading(false);
  };

  const handleGenerateDescription = async () => {
    if (!companyName.trim()) {
      toast({ title: 'Kérjük, add meg a cég nevét a generáláshoz!', variant: 'destructive' });
      return;
    }
    if (!companyPrimaryTeaor.trim()) {
      toast({ title: 'Kérjük, add meg az elsődleges TEÁOR kódot a generáláshoz!', variant: 'destructive' });
      return;
    }

    setIsGeneratingDescription(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-company-description', {
        body: { teaorCode: companyPrimaryTeaor.trim(), companyName: companyName.trim() }
      });

      if (error) throw error;
      if (data?.description) {
        setCompanyDescription(data.description);
        toast({ title: 'Cégleírás sikeresen generálva!' });
      } else {
        throw new Error('Nem érkezett leírás a szervertől.');
      }
    } catch (err: any) {
      reportError({ type: 'edge_function', component: 'Settings', action: 'error', message: 'Error generating description:', error: err });
      toast({
        title: 'Generálás sikertelen',
        description: err.message || 'Hiba történt a generálás során',
        variant: 'destructive'
      });
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  const saveCompanyData = async () => {
    if (!selectedCompany || !companyName.trim()) return;
    setSavingCompany(true);
    try {
      const { error } = await supabase.from('companies').update({ 
        name: companyName.trim(), 
        tax_number: companyTaxNumber.trim() || null, 
        address: companyAddress.trim() || null,
        description: companyDescription.trim() || null,
        primary_teaor: companyPrimaryTeaor.trim() || null,
      }).eq('id', selectedCompany.id);
      if (error) throw error;
      await refreshCompanies();
      setSelectedCompany({ 
        ...selectedCompany, 
        name: companyName.trim(), 
        tax_number: companyTaxNumber.trim() || null, 
        address: companyAddress.trim() || null,
        description: companyDescription.trim() || null,
        primary_teaor: companyPrimaryTeaor.trim() || null,
      });
      setInitialCompanyData({ 
        name: companyName.trim(), 
        taxNumber: companyTaxNumber.trim(), 
        address: companyAddress.trim(),
        description: companyDescription.trim(),
        primaryTeaor: companyPrimaryTeaor.trim(),
      });
      toast({ title: 'Siker', description: 'Cég adatai sikeresen mentve.' });
    } catch (err) { reportError({ type: 'db_query', component: 'Settings', action: 'saveCompanyData', message: 'Company update failed', error: err }); toast({ title: 'Hiba történt', description: 'A cég adatainak mentése sikertelen.', variant: 'destructive' }); }
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
    } catch (err) { reportError({ type: 'api_call', component: 'Settings', action: 'exportData', message: 'Data export failed', error: err }); toast({ title: 'Hiba', description: 'Hiba történt az adatok exportálása során.', variant: 'destructive' }); }
    finally { setExportLoading(false); }
  };

  if (!initialDataLoaded || companiesLoading) return <ContentSkeleton />;

  return (
    <div className="container mx-auto py-8 px-6 page-animate">
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

      <Tabs value={activeSettingsTab} onValueChange={(v) => setActiveSettingsTab(v as typeof SETTINGS_TABS[number])} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 gap-2 bg-transparent h-auto">
          <TabsTrigger value="profile" className="flex items-center gap-2 border border-border/40 bg-card data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><User className="h-4 w-4" />Profil</TabsTrigger>
          <TabsTrigger value="business" className="flex items-center gap-2 border border-border/40 bg-card data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Building2 className="h-4 w-4" />Cég</TabsTrigger>
          <TabsTrigger value="bank-accounts" className="flex items-center gap-2 border border-border/40 bg-card data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Landmark className="h-4 w-4" />Bankszámlák</TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2 border border-border/40 bg-card data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Bell className="h-4 w-4" />Értesítések</TabsTrigger>
          <TabsTrigger value="system" className="flex items-center gap-2 border border-border/40 bg-card data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Palette className="h-4 w-4" />Rendszer</TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2 border border-border/40 bg-card data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Shield className="h-4 w-4" />Biztonság</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileSection
            profile={profile}
            setProfile={setProfile}
            onSave={updateProfile}
            loading={loading}
            readOnlyOverrides={accountantAssignmentInfo ? {
              position: ACCOUNTY_ROLE_LABELS[accountantAssignmentInfo.role] || accountantAssignmentInfo.role,
              company: accountantAssignmentInfo.firmName || undefined,
            } : {
              position: userRole ? (EAISYBILL_ROLE_LABELS[userRole] || userRole) : undefined,
              company: selectedCompany?.name || undefined,
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
            companyDescription={companyDescription}
            setCompanyDescription={setCompanyDescription}
            companyPrimaryTeaor={companyPrimaryTeaor}
            setCompanyPrimaryTeaor={setCompanyPrimaryTeaor}
            isGeneratingDescription={isGeneratingDescription}
            onGenerateDescription={handleGenerateDescription}
            savingCompany={savingCompany}
            onSave={saveCompanyData}
            companies={companies}
            setSelectedCompany={setSelectedCompany}
          >
            {selectedCompany && selectedCompany.owner_id === user?.id && (
              <CompanyAccessCard companyId={selectedCompany.id} toast={toast} />
            )}
            {selectedCompany && (
              <CompanyMembersCard companyId={selectedCompany.id} companyName={selectedCompany.name} ownerId={selectedCompany.owner_id} isOwnerOrAdmin={isAdmin} toast={toast} />
            )}
            {selectedCompany && isAdmin && (
              <EaisybillPermissionPanel companyId={selectedCompany.id} toast={toast} />
            )}
            {selectedCompany && (
              <VatRegimeCard
                companyId={selectedCompany.id}
                currentRegime={selectedCompany.vat_regime || 'normal'}
                toast={toast}
                onSaved={refreshCompanies}
              />
            )}
            {selectedCompany && (
              <FxSettingsCard companyId={selectedCompany.id} toast={toast} />
            )}
          </BusinessSection>
        </TabsContent>

        <TabsContent value="bank-accounts">
          {selectedCompany && (
            <BankAccountsTab companyId={selectedCompany.id} />
          )}
        </TabsContent>

        <TabsContent value="notifications">
          <EmailPreferences />
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
            onChangeEmail={() => setEmailDialogOpen(true)}
            onExportData={handleExportData}
            exportLoading={exportLoading}
          />
        </TabsContent>
      </Tabs>

      <ChangePasswordDialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen} />
      <ChangeEmailDialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen} />
      <UnsavedChangesDialog open={showDialog} onConfirm={confirmNavigation} onCancel={cancelNavigation} />
    </div>
  );
}
