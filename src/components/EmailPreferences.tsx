import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2, Mail } from "lucide-react";

interface EmailPreferences {
  invoice_processed: boolean;
  invoice_failed: boolean;
  subscription_warnings: boolean;
  monthly_summary: boolean;
  weekly_summary: boolean;
}

export function EmailPreferences() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<EmailPreferences>({
    invoice_processed: true,
    invoice_failed: true,
    subscription_warnings: true,
    monthly_summary: false,
    weekly_summary: true,
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
        .select('id, user_id, invoice_processed, invoice_failed, weekly_summary, monthly_summary, subscription_warnings')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setPreferences({
          invoice_processed: (data as any).invoice_processed ?? true,
          invoice_failed: (data as any).invoice_failed ?? true,
          subscription_warnings: (data as any).subscription_warnings ?? true,
          monthly_summary: (data as any).monthly_summary ?? false,
          weekly_summary: (data as any).weekly_summary ?? true,
        });
      }
    } catch (error) {
      console.error('Error loading email preferences:', error);
      toast({ title: 'Nem sikerült betölteni az email beállításokat', variant: 'destructive' });
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
        .upsert(
          {
            user_id: user.id,
            [key]: value,
          },
          { onConflict: 'user_id' }
        );

      if (error) throw error;

      setPreferences(prev => ({ ...prev, [key]: value }));
      toast({ title: 'Beállítás frissítve' });
    } catch (error) {
      console.error('Error updating preference:', error);
      toast({ title: 'Nem sikerült frissíteni a beállítást', variant: 'destructive' });
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
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="weekly_summary">Heti összesítők</Label>
            <p className="text-sm text-muted-foreground">
              Heti összesítő a pénzügyi helyzetedről, teendőkről és aktivitásról
            </p>
          </div>
          <Switch
            id="weekly_summary"
            checked={preferences.weekly_summary}
            onCheckedChange={(value) => updatePreference('weekly_summary', value)}
            disabled={saving}
          />
        </div>
      </CardContent>
    </Card>
  );
}