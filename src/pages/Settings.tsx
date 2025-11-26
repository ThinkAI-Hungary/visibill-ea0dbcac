import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/integrations/supabase/client";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { 
  Building2, 
  CreditCard, 
  Bell, 
  User, 
  Palette, 
  Shield,
  FileText,
  Mail,
  Upload,
  Download,
  Info
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [profile, setProfile] = useState<Profile>({
    name: "",
    company: "",
    position: "",
    avatar_url: ""
  });
  
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
      setProfile({
        name: data.name || "",
        company: data.company || "",
        position: data.position || "",
        avatar_url: data.avatar_url || ""
      });
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
              <div className="flex items-center gap-6">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={profile.avatar_url} />
                  <AvatarFallback className="text-lg">
                    {profile.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <Button variant="outline" size="sm">
                    <Upload className="h-4 w-4 mr-2" />
                    Avatar feltöltése
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    JPG, PNG vagy SVG. Max 2MB.
                  </p>
                </div>
              </div>

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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Céginformációk
                </CardTitle>
                <CardDescription>
                  Alapvető céginformációk és elérhetőségek
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="company_name">Cég neve</Label>
                    <Input
                      id="company_name"
                      value={businessSettings.company_name}
                      onChange={(e) => setBusinessSettings(prev => ({ ...prev, company_name: e.target.value }))}
                      placeholder="Példa Kft."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tax_id">Adószám</Label>
                    <Input
                      id="tax_id"
                      value={businessSettings.tax_id}
                      onChange={(e) => setBusinessSettings(prev => ({ ...prev, tax_id: e.target.value }))}
                      placeholder="12345678-1-23"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Cím</Label>
                  <Textarea
                    id="address"
                    value={businessSettings.address}
                    onChange={(e) => setBusinessSettings(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="1234 Budapest, Példa utca 1."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefon</Label>
                    <Input
                      id="phone"
                      value={businessSettings.phone}
                      onChange={(e) => setBusinessSettings(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+36 30 123 4567"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      value={businessSettings.email}
                      onChange={(e) => setBusinessSettings(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="info@pelda.hu"
                    />
                  </div>
                </div>

                <Button onClick={() => updateSettings('business', businessSettings)} disabled={loading}>
                  Céginformációk mentése
                </Button>
              </CardContent>
            </Card>

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
    </div>
  );
}