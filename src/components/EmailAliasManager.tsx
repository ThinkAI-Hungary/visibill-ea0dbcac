import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { Copy, CheckCircle, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface EmailAlias {
  id: string;
  alias_email: string;
  company_name: string;
  company_id: string | null;
  status: string;
  created_at: string;
}

const EmailAliasManager = () => {
  const [alias, setAlias] = useState<EmailAlias | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const { toast } = useToast();

  useEffect(() => {
    if (user && selectedCompany) {
      fetchOrGenerateAlias();
    }
  }, [user, selectedCompany]);

  const fetchOrGenerateAlias = async () => {
    if (!selectedCompany) return;
    
    setLoading(true);
    try {
      // First try to fetch existing alias for this company
      const { data, error } = await supabase
        .from('email_aliases')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setAlias(data);
      } else {
        // No alias exists, generate one
        await generateAlias();
      }
    } catch (error: any) {
      console.error('Error fetching alias:', error);
      toast({
        variant: 'destructive',
        title: 'Hiba',
        description: 'Nem sikerült betölteni az email aliast',
      });
    } finally {
      setLoading(false);
    }
  };

  const generateAlias = async () => {
    if (!selectedCompany) return;
    
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-email-alias', {
        body: { 
          company_name: selectedCompany.name,
          company_id: selectedCompany.id 
        },
      });

      if (error) throw error;

      if (data?.alias) {
        setAlias(data.alias);
      } else {
        // Refetch to get the newly created alias
        const { data: newAlias, error: fetchError } = await supabase
          .from('email_aliases')
          .select('*')
          .eq('company_id', selectedCompany.id)
          .maybeSingle();

        if (fetchError) throw fetchError;
        setAlias(newAlias);
      }
    } catch (error: any) {
      console.error('Error generating alias:', error);
      
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
        title: 'Hiba',
        description: errorMessage,
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!alias) return;
    
    try {
      await navigator.clipboard.writeText(alias.alias_email);
      setCopied(true);
      toast({
        title: 'Másolva',
        description: 'Az email cím a vágólapra került',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Másolási hiba',
        description: 'Nem sikerült másolni az email címet',
      });
    }
  };

  if (loading || generating) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {generating ? 'Email alias generálása...' : 'Betöltés...'}
          </span>
        </div>
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
    );
  }

  if (!selectedCompany) {
    return (
      <p className="text-sm text-muted-foreground">
        Válassz ki egy céget az email alias megtekintéséhez.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Instruction text */}
      <p className="text-sm text-muted-foreground">
        Állítsa be minden mailfiókjában, hogy az e-mailjei ide is továbbításra kerüljenek, az alább megadott e-mail címre.
      </p>

      {/* Read-only email alias input with copy button */}
      {alias ? (
        <div className="flex items-center gap-2">
          <Input
            value={alias.alias_email}
            readOnly
            disabled
            className="bg-muted text-muted-foreground cursor-default"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={handleCopy}
            className="shrink-0"
          >
            {copied ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Input
            value="Nincs elérhető alias"
            readOnly
            disabled
            className="bg-muted text-muted-foreground cursor-default"
          />
        </div>
      )}
    </div>
  );
};

export default EmailAliasManager;
