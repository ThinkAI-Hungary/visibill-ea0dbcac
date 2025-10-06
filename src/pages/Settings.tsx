import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Upload
} from "lucide-react";

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
  const [loading, setLoading] = useState(false);
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
    theme: "light",
    language: "hu",
    date_format: "DD/MM/YYYY",
    number_format: "1 234 567,89",
    timezone: "Europe/Budapest"
  });

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

  // Test function to verify settings functionality
  const testSettings = async () => {
    console.log('Current settings state:', {
      profile,
      businessSettings,
      notificationSettings,
      systemSettings
    });
    
    // Test saving a simple setting
    await updateSettings('system', { test_setting: 'test_value' });
  };

  return (
    <div className="container mx-auto py-8 px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Beállítások</h1>
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
              
              {/* Debug: Test settings functionality */}
              <div className="mt-4 p-4 bg-muted/30 rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">Tesztelés:</p>
                <Button variant="outline" size="sm" onClick={testSettings}>
                  Beállítások tesztelése
                </Button>
              </div>
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Értesítési beállítások
              </CardTitle>
              <CardDescription>
                E-mail és rendszer értesítések kezelése
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="email_notifications">E-mail értesítések</Label>
                    <p className="text-sm text-muted-foreground">
                      Általános e-mail értesítések fogadása
                    </p>
                  </div>
                  <Switch
                    id="email_notifications"
                    checked={notificationSettings.email_notifications}
                    onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, email_notifications: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="invoice_reminders">Számla emlékeztetők</Label>
                    <p className="text-sm text-muted-foreground">
                      Fizetési határidő emlékeztetők
                    </p>
                  </div>
                  <Switch
                    id="invoice_reminders"
                    checked={notificationSettings.invoice_reminders}
                    onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, invoice_reminders: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="payment_alerts">Befizetési értesítések</Label>
                    <p className="text-sm text-muted-foreground">
                      Sikeres fizetések értesítései
                    </p>
                  </div>
                  <Switch
                    id="payment_alerts"
                    checked={notificationSettings.payment_alerts}
                    onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, payment_alerts: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="system_updates">Rendszer frissítések</Label>
                    <p className="text-sm text-muted-foreground">
                      Új funkciók és frissítések
                    </p>
                  </div>
                  <Switch
                    id="system_updates"
                    checked={notificationSettings.system_updates}
                    onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, system_updates: checked }))}
                  />
                </div>
              </div>

              <Button onClick={() => updateSettings('notifications', notificationSettings)} disabled={loading}>
                Értesítési beállítások mentése
              </Button>
            </CardContent>
          </Card>
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
                Megjelenítés és formátum beállítások
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="theme">Téma</Label>
                  <Select
                    value={systemSettings.theme}
                    onValueChange={(value) => setSystemSettings(prev => ({ ...prev, theme: value }))}
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
                  <Select
                    value={systemSettings.language}
                    onValueChange={(value) => setSystemSettings(prev => ({ ...prev, language: value }))}
                  >
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
                  <Select
                    value={systemSettings.date_format}
                    onValueChange={(value) => setSystemSettings(prev => ({ ...prev, date_format: value }))}
                  >
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
                  <Select
                    value={systemSettings.number_format}
                    onValueChange={(value) => setSystemSettings(prev => ({ ...prev, number_format: value }))}
                  >
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
                  <Button variant="outline" className="w-full justify-start">
                    Jelszó megváltoztatása
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    Kétfaktoros hitelesítés beállítása
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    Aktív munkamenetek megtekintése
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
                  <Button variant="outline" className="w-full justify-start">
                    Adatok exportálása
                  </Button>
                  <Button variant="destructive" className="w-full justify-start">
                    Fiók törlése
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}