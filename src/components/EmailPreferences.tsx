import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";

interface EmailPreferences {
  welcome_email: boolean;
  invoice_processed: boolean;
  invoice_failed: boolean;
  subscription_warnings: boolean;
  monthly_summary: boolean;
}

export function EmailPreferences() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<EmailPreferences>({
    welcome_email: true,
    invoice_processed: true,
    invoice_failed: true,
    subscription_warnings: true,
    monthly_summary: false,
  });

  useEffect(() => {
    loadPreferences();
  }, [user]);

  const loadPreferences = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_email_preferences' as any)
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setPreferences({
          welcome_email: (data as any).welcome_email ?? true,
          invoice_processed: (data as any).invoice_processed ?? true,
          invoice_failed: (data as any).invoice_failed ?? true,
          subscription_warnings: (data as any).subscription_warnings ?? true,
          monthly_summary: (data as any).monthly_summary ?? false,
        });
      }
    } catch (error) {
      console.error('Error loading email preferences:', error);
      toast.error('Nem sikerült betölteni az email beállításokat');
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async (key: keyof EmailPreferences, value: boolean) => {
    if (!user) return;

    try {
      setSaving(true);
      const { error } = await supabase
        .from('user_email_preferences' as any)
        .upsert({
          user_id: user.id,
          [key]: value,
        });

      if (error) throw error;

      setPreferences(prev => ({ ...prev, [key]: value }));
      toast.success('Beállítás frissítve');
    } catch (error) {
      console.error('Error updating preference:', error);
      toast.error('Nem sikerült frissíteni a beállítást');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          <CardTitle>Email Értesítések</CardTitle>
        </div>
        <CardDescription>
          Válaszd ki, mely email értesítéseket szeretnéd fogadni
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="welcome_email">Üdvözlő emailek</Label>
            <p className="text-sm text-muted-foreground">
              Üdvözlő email fogadása regisztrációkor
            </p>
          </div>
          <Switch
            id="welcome_email"
            checked={preferences.welcome_email}
            onCheckedChange={(value) => updatePreference('welcome_email', value)}
            disabled={saving}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="invoice_processed">Számla feldolgozva</Label>
            <p className="text-sm text-muted-foreground">
              Értesítés a sikeresen feldolgozott számlákról
            </p>
          </div>
          <Switch
            id="invoice_processed"
            checked={preferences.invoice_processed}
            onCheckedChange={(value) => updatePreference('invoice_processed', value)}
            disabled={saving}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="invoice_failed">Számla feldolgozási hibák</Label>
            <p className="text-sm text-muted-foreground">
              Értesítés a sikertelen számla feldolgozásokról
            </p>
          </div>
          <Switch
            id="invoice_failed"
            checked={preferences.invoice_failed}
            onCheckedChange={(value) => updatePreference('invoice_failed', value)}
            disabled={saving}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="subscription_warnings">Használati figyelmeztetések</Label>
            <p className="text-sm text-muted-foreground">
              Értesítés a számla limit közeledésekor
            </p>
          </div>
          <Switch
            id="subscription_warnings"
            checked={preferences.subscription_warnings}
            onCheckedChange={(value) => updatePreference('subscription_warnings', value)}
            disabled={saving}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="monthly_summary">Havi összesítők</Label>
            <p className="text-sm text-muted-foreground">
              Havi összesítő a számláidról és adóidról
            </p>
          </div>
          <Switch
            id="monthly_summary"
            checked={preferences.monthly_summary}
            onCheckedChange={(value) => updatePreference('monthly_summary', value)}
            disabled={saving}
          />
        </div>
      </CardContent>
    </Card>
  );
}