import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Mail, Plus, Trash2, Copy, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface EmailAlias {
  id: string;
  alias_email: string;
  company_name: string;
  status: string;
  created_at: string;
}

const EmailAliasManager = () => {
  const [aliases, setAliases] = useState<EmailAlias[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchAliases();
    }
  }, [user]);

  const fetchAliases = async () => {
    try {
      const { data, error } = await supabase
        .from('email_aliases')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAliases(data || []);
    } catch (error: any) {
      console.error('Error fetching aliases:', error);
      toast({
        variant: 'destructive',
        title: 'Hiba',
        description: 'Nem sikerült betölteni az email aliasokat',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return;

    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-email-alias', {
        body: { company_name: companyName },
      });

      if (error) throw error;

      toast({
        title: 'Email alias létrehozva!',
        description: `Az új email cím: ${data.alias.alias_email}`,
      });

      setCompanyName('');
      fetchAliases();
    } catch (error: any) {
      console.error('Error creating alias:', error);
      
      // Extract error message from edge function response
      let errorMessage = 'Nem sikerült létrehozni az email aliast';
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.context?.body) {
        try {
          const body = JSON.parse(error.context.body);
          errorMessage = body.error || errorMessage;
        } catch {
          // Keep default message
        }
      }
      
      toast({
        variant: 'destructive',
        title: 'Létrehozási hiba',
        description: errorMessage,
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (aliasId: string) => {
    try {
      const { error } = await supabase.functions.invoke('delete-email-alias', {
        body: { alias_id: aliasId },
      });

      if (error) throw error;

      toast({
        title: 'Email alias törölve',
        description: 'Az email alias sikeresen törölve lett',
      });

      fetchAliases();
    } catch (error: any) {
      console.error('Error deleting alias:', error);
      toast({
        variant: 'destructive',
        title: 'Törlési hiba',
        description: error.message || 'Nem sikerült törölni az email aliast',
      });
    }
  };

  const handleCopyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      setCopiedEmail(email);
      toast({
        title: 'Email cím másolva',
        description: 'Az email cím a vágólapra került',
      });
      setTimeout(() => setCopiedEmail(null), 2000);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Másolási hiba',
        description: 'Nem sikerült másolni az email címet',
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>
            <span className="ml-2">Email aliasok betöltése...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Alias-ok
        </CardTitle>
        <CardDescription>
          Hozz létre egyedi email címeket cégek számára a számlák automatikus fogadásához
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Create new alias form */}
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="company-name">Cég neve</Label>
            <Input
              id="company-name"
              placeholder="pl. ACME Kft"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              disabled={creating}
            />
          </div>
          <Button type="submit" disabled={creating || !companyName.trim()} className="w-full">
            {creating ? (
              <>
                <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent mr-2"></div>
                Létrehozás...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Email alias létrehozása
              </>
            )}
          </Button>
        </form>

        {/* List of aliases */}
        {aliases.length > 0 && (
          <div className="space-y-2 pt-4 border-t">
            <h4 className="text-sm font-medium">Aktív aliasok</h4>
            {aliases.map((alias) => (
              <div
                key={alias.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-sm">{alias.company_name}</p>
                    <Badge variant="secondary" className="text-xs">
                      {alias.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground truncate">{alias.alias_email}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyEmail(alias.alias_email)}
                      className="h-6 w-6 p-0"
                    >
                      {copiedEmail === alias.alias_email ? (
                        <CheckCircle className="h-3 w-3 text-green-600" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Létrehozva: {new Date(alias.created_at).toLocaleDateString('hu-HU')}
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="ml-2">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Biztosan törölni szeretnéd?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Ez véglegesen törli az email aliast: <strong>{alias.alias_email}</strong>
                        <br />
                        Az erre az email címre érkező számlák többé nem lesznek feldolgozva.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Mégse</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(alias.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Törlés
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        )}

        {aliases.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Még nincs email aliasod. Hozz létre egyet a fenti űrlap segítségével!
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default EmailAliasManager;
