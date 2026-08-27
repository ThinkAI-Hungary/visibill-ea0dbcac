import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { reportError } from '@/lib/errorReporter';

export interface CompanyEmailAccount {
  id: string;
  company_id: string;
  user_id: string;
  name: string;
  is_active: boolean;
  is_default_smtp: boolean;
  is_default_imap: boolean;
  is_imap_enabled: boolean;
  imap_host: string | null;
  imap_port: number | null;
  imap_username: string | null;
  imap_password_secret_id: string | null;
  imap_encryption: string | null;
  imap_status: 'pending' | 'valid' | 'invalid' | 'error';
  imap_last_synced_at: string | null;
  imap_last_validated_at: string | null;
  imap_validation_error: string | null;
  is_smtp_enabled: boolean;
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

export interface SaveEmailAccountForm {
  id?: string;
  name: string;
  is_active: boolean;
  is_default_smtp: boolean;
  is_default_imap: boolean;
  is_imap_enabled: boolean;
  imap_host: string;
  imap_port: number;
  imap_username: string;
  imap_password?: string;
  imap_encryption: string;
  is_smtp_enabled: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password?: string;
  smtp_encryption: string;
}

export function useEmailAccounts() {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: queryKeys.emailAccounts(selectedCompany?.id || ''),
    queryFn: async () => {
      if (!selectedCompany?.id) return [];

      const { data, error } = await supabase
        .from('company_email_accounts')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .order('is_default_smtp', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) {
        reportError({
          type: 'db_query',
          component: 'useEmailAccounts',
          action: 'error',
          message: 'Error fetching email accounts',
          error,
        });
        throw error;
      }
      return (data || []) as CompanyEmailAccount[];
    },
    enabled: !!user && !!selectedCompany?.id,
  });

  const invalidate = () => {
    if (selectedCompany?.id) {
      queryClient.invalidateQueries({
        queryKey: queryKeys.emailAccounts(selectedCompany.id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.emailSettings(selectedCompany.id),
      });
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (form: SaveEmailAccountForm) => {
      if (!user || !selectedCompany) throw new Error('Nem található cég vagy felhasználó');

      const { data, error } = await supabase.rpc('save_company_email_account', {
        p_company_id: selectedCompany.id,
        p_name: form.name?.trim() || 'Levelező fiók',
        p_is_active: form.is_active,
        p_is_default_smtp: form.is_default_smtp,
        p_is_default_imap: form.is_default_imap,
        p_is_imap_enabled: form.is_imap_enabled,
        p_imap_host: form.imap_host?.trim() || null,
        p_imap_port: form.imap_port || null,
        p_imap_username: form.imap_username?.trim() || null,
        p_imap_password: form.imap_password || null,
        p_imap_encryption: form.imap_encryption || 'SSL/TLS',
        p_is_smtp_enabled: form.is_smtp_enabled,
        p_smtp_host: form.smtp_host?.trim() || null,
        p_smtp_port: form.smtp_port || null,
        p_smtp_username: form.smtp_username?.trim() || null,
        p_smtp_password: form.smtp_password || null,
        p_smtp_encryption: form.smtp_encryption || 'SSL/TLS',
        p_id: form.id || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Sikeres mentés', description: 'Levelező fiók beállításai elmentve.' });
      invalidate();
    },
    onError: (err: Error) => {
      reportError({
        type: 'api_call',
        component: 'useEmailAccounts',
        action: 'error',
        message: 'Error saving email account',
        error: err,
      });
      toast({
        variant: 'destructive',
        title: 'Mentési hiba',
        description: err.message || 'Nem sikerült menteni a fiókot.',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (accountId: string) => {
      if (!user || !selectedCompany) throw new Error('Nem található cég vagy felhasználó');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('delete-email-settings', {
        body: {
          companyId: selectedCompany.id,
          accountId,
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Sikeres törlés', description: 'Levelező fiók sikeresen eltávolítva.' });
      invalidate();
    },
    onError: (err: Error) => {
      reportError({
        type: 'api_call',
        component: 'useEmailAccounts',
        action: 'error',
        message: 'Error deleting email account',
        error: err,
      });
      toast({
        variant: 'destructive',
        title: 'Hiba a fiók törlésekor',
        description: err.message || 'Nem sikerült eltávolítani a fiókot.',
      });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async ({ accountId, type }: { accountId: string; type: 'smtp' | 'imap' | 'both' }) => {
      if (!user || !selectedCompany) throw new Error('Nem található cég vagy felhasználó');

      const { data, error } = await supabase.rpc('set_default_company_email_account', {
        p_account_id: accountId,
        p_type: type,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Alapértelmezés beállítva', description: 'Az alapértelmezett fiók frissítve.' });
      invalidate();
    },
    onError: (err: Error) => {
      toast({
        variant: 'destructive',
        title: 'Hiba',
        description: err.message || 'Nem sikerült beállítani az alapértelmezést.',
      });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async (params: {
      type: 'imap' | 'smtp';
      accountId?: string;
      config: {
        host: string;
        port: number;
        username: string;
        password?: string;
        encryption: string;
      };
    }) => {
      if (!user || !selectedCompany) throw new Error('Nem található cég vagy felhasználó');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('test-email-connection', {
        body: {
          type: params.type,
          companyId: selectedCompany.id,
          accountId: params.accountId,
          config: params.config,
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      if (data?.success === false) {
        throw new Error(data.error || 'A teszt sikertelen volt.');
      }
      return data;
    },
    onError: (err: Error) => {
      reportError({
        type: 'api_call',
        component: 'useEmailAccounts',
        action: 'error',
        message: 'Error testing connection',
        error: err,
      });
    },
  });

  return {
    accounts,
    isLoading,
    saveMutation,
    deleteMutation,
    setDefaultMutation,
    testConnectionMutation,
    invalidate,
  };
}
