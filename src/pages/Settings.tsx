import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import { EmailPreferences } from "@/components/EmailPreferences";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog";
import { 
  Building2, 
  CreditCard, 
  Bell, 
  User, 
  Palette, 
  Shield,
  FileText,
  Mail,
  Download,
  Info,
  AlertCircle,
  Copy,
  RefreshCw,
  Users,
  X
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Profile {
  name: string;
  company: string;
  position: string;
  avatar_url: string;
}

interface BusinessSettings {
  company_name: string;
  tax_id: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  default_currency: string;
  default_payment_terms: number;
  tax_rate: number;
}

interface NotificationSettings {
  email_notifications: boolean;
  invoice_reminders: boolean;
  payment_alerts: boolean;
  system_updates: boolean;
}

interface SystemSettings {
  theme: string;
  language: string;
  date_format: string;
  number_format: string;
  timezone: string;
}

// --- Company Access Card (Share Token) with Countdown ---
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
      const { data } = await supabase
        .from('companies')
        .select('share_token, share_token_created_at')
        .eq('id', companyId)
        .single();
      setShareToken((data as any)?.share_token || null);
      setTokenCreatedAt((data as any)?.share_token_created_at || null);
      setLoading(false);
    };
    fetchToken();
  }, [companyId]);

  useEffect(() => {
    if (!shareToken || !tokenCreatedAt) {
      setRemainingSeconds(null);
      return;
    }
    const calcRemaining = () => {
      const created = new Date(tokenCreatedAt).getTime();
      const expires = created + TOKEN_DURATION_MS;
      return Math.max(0, Math.floor((expires - Date.now()) / 1000));
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

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const generateToken = async () => {
    setGenerating(true);
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let token = '';
    for (let i = 0; i < 6; i++) token += chars[Math.floor(Math.random() * chars.length)];
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('companies')
      .update({ share_token: token, share_token_created_at: now } as any)
      .eq('id', companyId);
    if (error) {
      toast({ title: "Hiba", description: "Nem sikerült a kód generálása.", variant: "destructive" });
    } else {
      setShareToken(token);
      setTokenCreatedAt(now);
      toast({ title: "Siker", description: "Meghívó kód generálva! 10 percig érvényes." });
    }
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
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Cég hozzáférés
        </CardTitle>
        <CardDescription>
          Meghívó kód generálása, amivel mások csatlakozhatnak a céghez (10 percig érvényes)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!shareToken ? (
          <Button onClick={generateToken} disabled={generating}>
            {generating ? 'Generálás...' : 'Meghívó kód generálása'}
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className={`flex-1 px-4 py-2 bg-muted rounded-md font-mono text-lg tracking-widest text-center transition-all ${isExpired ? 'blur-sm select-none' : ''}`}>
                {shareToken}
              </div>
              <Button variant="outline" size="icon" onClick={copyToken} title="Másolás" disabled={isExpired}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={generateToken} disabled={generating} title="Újragenerálás">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            {remainingSeconds !== null && (
              <div className="flex items-center gap-2 text-sm">
                {isExpired ? (
                  <span className="text-destructive font-medium">Lejárt — kattints az újragenerálásra</span>
                ) : (
                  <span className="text-muted-foreground">
                    Hátralévő idő: <span className="font-mono font-medium text-foreground">{formatTime(remainingSeconds)}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- Company Members Card ---
function CompanyMembersCard({ companyId, ownerId, isOwner, toast }: { companyId: string; ownerId: string; isOwner: boolean; toast: any }) {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMembers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('company_members')
      .select('id, user_id, created_at')
      .eq('company_id', companyId);

    if (data && data.length > 0) {
      // Fetch profiles for each member
      const userIds = data.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', userIds);

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
      setMembers(data.map(m => ({
        ...m,
        profile: profileMap.get(m.user_id) || null,
      })));
    } else {
      setMembers([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchMembers(); }, [companyId]);

  const removeMember = async (memberId: string, userId: string) => {
    if (userId === ownerId) return;
    const { error } = await supabase
      .from('company_members')
      .delete()
      .eq('id', memberId);

    if (error) {
      toast({ title: "Hiba", description: "Nem sikerült a tag eltávolítása.", variant: "destructive" });
    } else {
      toast({ title: "Siker", description: "Tag eltávolítva." });
      fetchMembers();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Tagok
        </CardTitle>
        <CardDescription>A céghez hozzáféréssel rendelkező felhasználók</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Betöltés...</p>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nincsenek tagok.</p>
        ) : (
          <div className="space-y-2">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div>
                  <p className="font-medium">
                    {member.profile?.name || 'Névtelen felhasználó'}
                    {member.user_id === ownerId ? (
                      <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Tulajdonos</span>
                    ) : (
                      <span className="ml-2 text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Admin</span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Csatlakozott: {new Date(member.created_at).toLocaleDateString('hu-HU')}
                  </p>
                </div>
                {isOwner && member.user_id !== ownerId && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeMember(member.id, member.user_id)} title="Tag eltávolítása">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const { companies, selectedCompany, setSelectedCompany, refreshCompanies, loading: companiesLoading } = useCompany();
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  
  const [profile, setProfile] = useState<Profile>({
    name: "",
    company: "",
    position: "",
    avatar_url: ""
  });

  // Company edit state
  const [companyName, setCompanyName] = useState("");
  const [companyTaxNumber, setCompanyTaxNumber] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [savingCompany, setSavingCompany] = useState(false);
  
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings>({
    company_name: "",
    tax_id: "",
    address: "",
    phone: "",
    email: "",
    website: "",
    default_currency: "HUF",
    default_payment_terms: 30,
    tax_rate: 27
  });

  // Initial state tracking for unsaved changes
  const [initialProfile, setInitialProfile] = useState<Profile | null>(null);
  const [initialCompanyData, setInitialCompanyData] = useState<{name: string, taxNumber: string, address: string} | null>(null);

  // Sync company data when selectedCompany changes
  useEffect(() => {
    if (selectedCompany) {
      setCompanyName(selectedCompany.name);
      setCompanyTaxNumber(selectedCompany.tax_number || "");
      setCompanyAddress(selectedCompany.address || "");
      // Set initial company state for comparison
      setInitialCompanyData({
        name: selectedCompany.name,
        taxNumber: selectedCompany.tax_number || "",
        address: selectedCompany.address || ""
      });
    }
  }, [selectedCompany]);

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    email_notifications: true,
    invoice_reminders: true,
    payment_alerts: true,
    system_updates: true
  });

  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    theme: theme,
    language: "hu",
    date_format: "DD/MM/YYYY",
    number_format: "1 234 567,89",
    timezone: "Europe/Budapest"
  });

  // Calculate unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (!initialDataLoaded || !initialProfile) return false;

    // Check profile changes
    const profileChanged = (
      profile.name !== initialProfile.name ||
      profile.company !== initialProfile.company ||
      profile.position !== initialProfile.position
    );

    // Check company changes
    let companyChanged = false;
    if (initialCompanyData && selectedCompany) {
      companyChanged = (
        companyName !== initialCompanyData.name ||
        companyTaxNumber !== initialCompanyData.taxNumber ||
        companyAddress !== initialCompanyData.address
      );
    }

    return profileChanged || companyChanged;
  }, [profile, initialProfile, companyName, companyTaxNumber, companyAddress, initialCompanyData, selectedCompany, initialDataLoaded]);

  const { showDialog, confirmNavigation, cancelNavigation } = useUnsavedChanges(hasUnsavedChanges);

  // Sync theme from context to local state
  useEffect(() => {
    setSystemSettings(prev => ({ ...prev, theme }));
  }, [theme]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchSettings();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (data) {
      const profileData = {
        name: data.name || "",
        company: data.company || "",
        position: data.position || "",
        avatar_url: data.avatar_url || ""
      };
      setProfile(profileData);
      setInitialProfile(profileData);
      setInitialDataLoaded(true);
    } else {
      setInitialProfile({
        name: "",
        company: "",
        position: "",
        avatar_url: ""
      });
      setInitialDataLoaded(true);
    }
  };

  const fetchSettings = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("settings")
      .select("*")
      .eq("user_id", user.id);

    if (data && data.length > 0) {
      data.forEach((setting) => {
        const value = setting.value;
        
        switch (setting.category) {
          case "business":
            setBusinessSettings(prev => ({ ...prev, [setting.key]: value }));
            break;
          case "notifications":
            setNotificationSettings(prev => ({ ...prev, [setting.key]: value }));
            break;
          case "system":
            setSystemSettings(prev => ({ ...prev, [setting.key]: value }));
            break;
        }
      });
    }
  };

  const updateProfile = async () => {
    if (!user) return;

    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({
        user_id: user.id,
        name: profile.name,
        company: profile.company,
        position: profile.position,
        avatar_url: profile.avatar_url
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      console.error('Profile update error:', error);
      toast({
        title: "Hiba történt",
        description: "A profil mentése sikertelen.",
        variant: "destructive"
      });
    } else {
      // Reset initial state after successful save
      setInitialProfile({ ...profile });
      toast({
        title: "Siker",
        description: "A profil sikeresen mentve."
      });
    }
    setLoading(false);
  };

  const updateSettings = async (category: string, settings: any) => {
    if (!user) return;

    setLoading(true);
    
    try {
      for (const [key, value] of Object.entries(settings)) {
        const { error } = await supabase
          .from("settings")
          .upsert({
            user_id: user.id,
            category,
            key,
            value: value as any
          }, {
            onConflict: 'user_id,category,key'
          });
        
        if (error) {
          console.error(`Error saving setting ${key}:`, error);
          throw error;
        }
      }

      toast({
        title: "Siker",
        description: "A beállítások sikeresen mentve."
      });
    } catch (error) {
      console.error('Settings save error:', error);
      toast({
        title: "Hiba történt",
        description: "A beállítások mentése sikertelen.",
        variant: "destructive"
      });
    }
    
    setLoading(false);
  };

  const saveCompanyData = async () => {
    if (!selectedCompany || !companyName.trim()) return;

    setSavingCompany(true);
    try {
      const { error } = await supabase
        .from('companies')
        .update({
          name: companyName.trim(),
          tax_number: companyTaxNumber.trim() || null,
          address: companyAddress.trim() || null,
        })
        .eq('id', selectedCompany.id);

      if (error) throw error;

      await refreshCompanies();
      setSelectedCompany({
        ...selectedCompany,
        name: companyName.trim(),
        tax_number: companyTaxNumber.trim() || null,
        address: companyAddress.trim() || null,
      });

      // Reset initial state after successful save
      setInitialCompanyData({
        name: companyName.trim(),
        taxNumber: companyTaxNumber.trim(),
        address: companyAddress.trim()
      });

      toast({
        title: "Siker",
        description: "Cég adatai sikeresen mentve."
      });
    } catch (error) {
      console.error('Error saving company:', error);
      toast({
        title: "Hiba történt",
        description: "A cég adatainak mentése sikertelen.",
        variant: "destructive"
      });
    } finally {
      setSavingCompany(false);
    }
  };

  const handleExportData = async () => {
    try {
      setExportLoading(true);
      
      const { data, error } = await supabase.functions.invoke('export-user-data', {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;

      // Create and download the JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { 
        type: 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `visibill-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Siker",
        description: "Adatok sikeresen exportálva és letöltve!",
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Hiba",
        description: "Hiba történt az adatok exportálása során. Kérlek, próbáld újra.",
        variant: "destructive",
      });
    } finally {
      setExportLoading(false);
    }
  };

  if (!initialDataLoaded || companiesLoading) {
    return <LoadingSpinner message="Beállítások betöltése..." />;
  }

  return (
    <div className="container mx-auto py-8 px-6">
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold">Beállítások</h1>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-5 w-5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Itt kezelheted a profil adataid, cég információid, értesítési beállításokat, témát és biztonságot.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <p className="text-muted-foreground mt-2">
          Rendszer és üzleti beállítások kezelése
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Profil
          </TabsTrigger>
          <TabsTrigger value="business" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Cég
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Értesítések
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Rendszer
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Biztonság
          </TabsTrigger>
        </TabsList>

        {/* Profile Settings */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Felhasználói profil
              </CardTitle>
              <CardDescription>
                Személyes információk és avatar kezelése
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Teljes név</Label>
                  <Input
                    id="name"
                    value={profile.name}
                    onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Kovács János"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="position">Pozíció</Label>
                  <Input
                    id="position"
                    value={profile.position}
                    onChange={(e) => setProfile(prev => ({ ...prev, position: e.target.value }))}
                    placeholder="Ügyvezető"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="company">Cég neve</Label>
                <Input
                  id="company"
                  value={profile.company}
                  onChange={(e) => setProfile(prev => ({ ...prev, company: e.target.value }))}
                  placeholder="Példa Kft."
                />
              </div>

              <Button onClick={updateProfile} disabled={loading}>
                Profil mentése
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Business Settings */}
        <TabsContent value="business">
          <div className="space-y-6">
            {/* Selected Company Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Kiválasztott cég adatai
                </CardTitle>
                <CardDescription>
                  {selectedCompany ? (
                    <>Az aktuálisan kiválasztott cég: <strong>{selectedCompany.name}</strong></>
                  ) : (
                    "Válassz céget a felső menüből"
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!selectedCompany ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Nincs kiválasztott cég. A cég adatainak szerkesztéséhez válassz egy céget a felső menüből.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    {selectedCompany.owner_id !== user?.id && (
                      <Alert className="mb-4">
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                          Csak a tulajdonos szerkesztheti a cég adatait.
                        </AlertDescription>
                      </Alert>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="company_name">Cég neve *</Label>
                        <Input
                          id="company_name"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="Pl. Példa Kft."
                          disabled={selectedCompany.owner_id !== user?.id}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="tax_number">Adószám</Label>
                        <Input
                          id="tax_number"
                          value={companyTaxNumber}
                          onChange={(e) => setCompanyTaxNumber(e.target.value)}
                          placeholder="Pl. 12345678-2-42"
                          disabled={selectedCompany.owner_id !== user?.id}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="company_address">Cím</Label>
                      <Textarea
                        id="company_address"
                        value={companyAddress}
                        onChange={(e) => setCompanyAddress(e.target.value)}
                        placeholder="Pl. 1234 Budapest, Példa utca 1."
                        rows={3}
                        disabled={selectedCompany.owner_id !== user?.id}
                      />
                    </div>

                    <div className="flex items-center gap-4 pt-2">
                      {selectedCompany.owner_id === user?.id && (
                        <Button 
                          onClick={saveCompanyData} 
                          disabled={!companyName.trim() || savingCompany}
                        >
                          {savingCompany ? "Mentés..." : "Cég adatainak mentése"}
                        </Button>
                      )}
                      <p className="text-sm text-muted-foreground">
                        Létrehozva: {new Date(selectedCompany.created_at).toLocaleDateString('hu-HU')}
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Company Access - Share Token */}
            {selectedCompany && selectedCompany.owner_id === user?.id && (
              <CompanyAccessCard companyId={selectedCompany.id} toast={toast} />
            )}

            {/* Company Members */}
            {selectedCompany && (
              <CompanyMembersCard 
                companyId={selectedCompany.id} 
                ownerId={selectedCompany.owner_id} 
                isOwner={selectedCompany.owner_id === user?.id} 
                toast={toast} 
              />
            )}

            {/* All Companies Overview */}
            {companies.length > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Összes cég áttekintése</CardTitle>
                  <CardDescription>
                    A fiókodhoz tartozó összes cég
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {companies.map((company) => (
                      <div 
                        key={company.id} 
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          selectedCompany?.id === company.id 
                            ? 'border-primary bg-primary/5' 
                            : 'border-border hover:bg-muted/50'
                        }`}
                      >
                        <div>
                          <p className="font-medium">{company.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {company.tax_number || 'Nincs adószám megadva'}
                          </p>
                        </div>
                        {selectedCompany?.id !== company.id && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedCompany(company)}
                          >
                            Kiválasztás
                          </Button>
                        )}
                        {selectedCompany?.id === company.id && (
                          <span className="text-sm text-primary font-medium">Aktív</span>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications">
          <EmailPreferences />
        </TabsContent>

        {/* System Settings */}
        <TabsContent value="system">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Rendszer beállítások
              </CardTitle>
              <CardDescription>
                Téma és megjelenítési beállítások
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="theme">Téma</Label>
                  <Select 
                    value={systemSettings.theme}
                    onValueChange={(value) => {
                      setTheme(value as "light" | "dark" | "system");
                      setSystemSettings(prev => ({ ...prev, theme: value }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Világos</SelectItem>
                      <SelectItem value="dark">Sötét</SelectItem>
                      <SelectItem value="system">Rendszer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="language">Nyelv</Label>
                  <Select disabled value={systemSettings.language}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hu">Magyar</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date_format">Dátum formátum</Label>
                  <Select disabled value={systemSettings.date_format}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="number_format">Szám formátum</Label>
                  <Select disabled value={systemSettings.number_format}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1 234 567,89">1 234 567,89</SelectItem>
                      <SelectItem value="1,234,567.89">1,234,567.89</SelectItem>
                      <SelectItem value="1.234.567,89">1.234.567,89</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button onClick={() => updateSettings('system', systemSettings)} disabled={loading}>
                Rendszer beállítások mentése
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Biztonsági beállítások
                </CardTitle>
                <CardDescription>
                  Jelszó és biztonsági opciók
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => setPasswordDialogOpen(true)}
                  >
                    Jelszó megváltoztatása
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start opacity-50" 
                    disabled
                  >
                    Kétfaktoros hitelesítés beállítása (hamarosan)
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start opacity-50" 
                    disabled
                  >
                    Aktív munkamenetek megtekintése (hamarosan)
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Adatok kezelése
                </CardTitle>
                <CardDescription>
                  Export és törlési opciók
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start" 
                    onClick={handleExportData}
                    disabled={exportLoading}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {exportLoading ? "Exportálás..." : "Adatok exportálása"}
                  </Button>
                  <Button 
                    variant="destructive" 
                    className="w-full justify-start opacity-50" 
                    disabled
                  >
                    Fiók törlése (hamarosan)
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <ChangePasswordDialog 
        open={passwordDialogOpen} 
        onOpenChange={setPasswordDialogOpen} 
      />

      <UnsavedChangesDialog
        open={showDialog}
        onConfirm={confirmNavigation}
        onCancel={cancelNavigation}
      />
    </div>
  );
}