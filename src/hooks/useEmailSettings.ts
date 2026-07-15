import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { reportError } from '@/lib/errorReporter';

export interface CompanyEmailSettings {
  id: string;
  company_id: string;
  user_id: string;
  imap_host: string | null;
  imap_port: number | null;
  imap_username: string | null;
  imap_password_secret_id: string | null;
  imap_encryption: string | null;
  imap_status: 'pending' | 'valid' | 'invalid' | 'error';
  imap_last_validated_at: string | null;
  imap_validation_error: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_username: string | null;
  smtp_password_secret_id: string | null;
  smtp_encryption: string | null;
  smtp_status: 'pending' | 'valid' | 'invalid' | 'error';
  smtp_last_validated_at: string | null;
  smtp_validation_error: string | null;
  created_at: string;
  updated_at: string;
}

export function useEmailSettings() {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: queryKeys.emailSettings(selectedCompany?.id || ''),
    queryFn: async () => {
      if (!selectedCompany?.id) return null;
      
      const { data, error } = await supabase
        .from('company_email_settings')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .maybeSingle();

      if (error) {
        reportError({ type: 'db_query', component: 'useEmailSettings', action: 'error', message: 'Error fetching email settings', error });
        throw error;
      }
      return data as CompanyEmailSettings | null;
    },
    enabled: !!user && !!selectedCompany?.id,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.emailSettings(selectedCompany?.id || ''),
    });
  };

  const saveMutation = useMutation({
    mutationFn: async (form: {
      imap_host: string;
      imap_port: number;
      imap_username: string;
      imap_password?: string;
      imap_encryption: string;
      smtp_host: string;
      smtp_port: number;
      smtp_username: string;
      smtp_password?: string;
      smtp_encryption: string;
    }) => {
      if (!user || !selectedCompany) throw new Error('Nem található cég vagy felhasználó');

      const { data, error } = await supabase.rpc('save_company_email_settings', {
        p_company_id: selectedCompany.id,
        p_imap_host: form.imap_host?.trim() || null,
        p_imap_port: form.imap_port || null,
        p_imap_username: form.imap_username?.trim() || null,
        p_imap_password: form.imap_password || null,
        p_imap_encryption: form.imap_encryption || null,
        p_smtp_host: form.smtp_host?.trim() || null,
        p_smtp_port: form.smtp_port || null,
        p_smtp_username: form.smtp_username?.trim() || null,
        p_smtp_password: form.smtp_password || null,
        p_smtp_encryption: form.smtp_encryption || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Sikeres mentés', description: 'Levelezési beállítások elmentve.' });
      invalidate();
    },
    onError: (err: Error) => {
      reportError({ type: 'api_call', component: 'useEmailSettings', action: 'error', message: 'Error saving email settings', error: err });
      toast({
        variant: 'destructive',
        title: 'Mentési hiba',
        description: err.message || 'Nem sikerült menteni a beállításokat.',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!user || !selectedCompany) throw new Error('Nem található cég vagy felhasználó');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('delete-email-settings', {
        body: { companyId: selectedCompany.id },
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Sikeres törlés', description: 'Saját levelező szerver leválasztva.' });
      invalidate();
    },
    onError: (err: Error) => {
      reportError({ type: 'api_call', component: 'useEmailSettings', action: 'error', message: 'Error deleting email settings', error: err });
      toast({
        variant: 'destructive',
        title: 'Hiba a leválasztáskor',
        description: err.message || 'Nem sikerült leválasztani a szervert.',
      });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async (params: {
      type: 'imap' | 'smtp';
      config: {
        host: string;
        port: number;
        username: string;
        password?: string;
        encryption: string;
      }
    }) => {
      if (!user || !selectedCompany) throw new Error('Nem található cég vagy felhasználó');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('test-email-connection', {
        body: {
          type: params.type,
          companyId: selectedCompany.id,
          config: params.config
        },
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (error) throw error;
      if (data?.success === false) {
        throw new Error(data.error || 'A teszt sikertelen volt.');
      }
      return data;
    },
    onError: (err: Error) => {
      reportError({ type: 'api_call', component: 'useEmailSettings', action: 'error', message: 'Error testing connection', error: err });
    }
  });

  return {
    settings,
    isLoading,
    saveMutation,
    deleteMutation,
    testConnectionMutation,
    invalidate,
  };
}
