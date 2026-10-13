import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface TypelessTransaction {
  id: string;
  transaction_date: string;
  amount: number;
  currency: string;
  description: string | null;
  type: string | null;
  gl_account_id: string | null;
  gl_classifications: Record<string, {
    gl_number?: string;
    gl_account_id?: string;
    reasoning?: string;
    confidence_score?: number;
    is_manual?: boolean;
  }> | null;
  gl_is_manually_overridden: boolean | null;
  is_verified: boolean | null;
}

export interface PresetGlAccount {
  id: string;
  gl_number: string;
  short_name: string;
  description?: string | null;
}

export interface ApproveTransactionPayload {
  transactionId: string;
  type: string;
  glAccountId: string;
  glNumber: string;
}

export function useTypelessTransactions(companyId?: string, activePresetId?: string | null) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // 1. Fetch unclassified / typeless transactions
  const {
    data: typelessTransactions = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['typeless-transactions', companyId],
    queryFn: async (): Promise<TypelessTransaction[]> => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from('transactions')
        .select('id, transaction_date, amount, currency, description, type, gl_account_id, gl_classifications, gl_is_manually_overridden, is_verified')
        .eq('company_id', companyId)
        .is('matched_invoice_id', null)
        .or('type.is.null,type.eq.,type.eq.nincs egyértelmű besorolás')
        .not('gl_is_manually_overridden', 'is', true)
        .not('is_verified', 'is', true)
        .order('transaction_date', { ascending: false });

      if (error) {
        console.error('Error fetching typeless transactions:', error);
        throw error;
      }

      return (data || []) as TypelessTransaction[];
    },
    enabled: Boolean(companyId),
    staleTime: 30_000,
  });

  // 2. Fetch GL accounts for the active preset for mapping suggestions
  const {
    data: presetAccounts = [],
    isLoading: isAccountsLoading,
  } = useQuery({
    queryKey: ['preset-gl-accounts', activePresetId],
    queryFn: async (): Promise<PresetGlAccount[]> => {
      if (!activePresetId) return [];

      const { data, error } = await supabase
        .from('gl_accounts')
        .select('id, gl_number, short_name, description')
        .eq('preset_id', activePresetId)
        .order('gl_number', { ascending: true });

      if (error) {
        console.error('Error fetching preset GL accounts:', error);
        throw error;
      }

      return (data || []) as PresetGlAccount[];
    },
    enabled: Boolean(activePresetId),
    staleTime: 60_000 * 5,
  });

  // 3. Mutation: Approve single transaction
  const approveMutation = useMutation({
    mutationFn: async (payload: ApproveTransactionPayload) => {
      if (!companyId || !activePresetId) {
        throw new Error('Cég vagy aktív számlatükör nincs megadva.');
      }

      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) throw new Error('Nincs bejelentkezett felhasználó.');

      // Step A: RPC call to update gl_classifications JSONB and audit log
      const { error: rpcError } = await supabase.rpc('override_gl_classification', {
        p_item_id: payload.transactionId,
        p_source_table: 'transactions',
        p_new_gl_account_id: payload.glAccountId,
        p_original_gl_account_id: null,
        p_company_id: companyId,
        p_user_id: userId,
        p_preset_id: activePresetId,
        p_new_gl_number: payload.glNumber,
      });

      if (rpcError) throw rpcError;

      // Step B: Update base transaction record
      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          type: payload.type,
          gl_account_id: payload.glAccountId,
          gl_is_manually_overridden: true,
          is_verified: true,
        })
        .eq('id', payload.transactionId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['typeless-transactions', companyId] });
      queryClient.invalidateQueries({ queryKey: ['glBalances'] });
      queryClient.invalidateQueries({ queryKey: ['glItems'] });
      queryClient.invalidateQueries({ queryKey: ['glCategorizedItems'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast({
        title: 'Tétel jóváhagyva',
        description: 'A tranzakció típusa és főkönyvi számlája sikeresen rögzítve.',
      });
    },
    onError: (err: any) => {
      console.error('Error approving transaction:', err);
      toast({
        title: 'Hiba a jóváhagyáskor',
        description: err?.message || 'Nem sikerült jóváhagyni a tételt.',
        variant: 'destructive',
      });
    },
  });

  // 4. Mutation: Approve batch of transactions
  const approveBatchMutation = useMutation({
    mutationFn: async (payloads: ApproveTransactionPayload[]) => {
      if (!companyId || !activePresetId) {
        throw new Error('Cég vagy aktív számlatükör nincs megadva.');
      }

      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) throw new Error('Nincs bejelentkezett felhasználó.');

      for (const payload of payloads) {
        const { error: rpcError } = await supabase.rpc('override_gl_classification', {
          p_item_id: payload.transactionId,
          p_source_table: 'transactions',
          p_new_gl_account_id: payload.glAccountId,
          p_original_gl_account_id: null,
          p_company_id: companyId,
          p_user_id: userId,
          p_preset_id: activePresetId,
          p_new_gl_number: payload.glNumber,
        });

        if (rpcError) throw rpcError;

        const { error: updateError } = await supabase
          .from('transactions')
          .update({
            type: payload.type,
            gl_account_id: payload.glAccountId,
            gl_is_manually_overridden: true,
            is_verified: true,
          })
          .eq('id', payload.transactionId);

        if (updateError) throw updateError;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['typeless-transactions', companyId] });
      queryClient.invalidateQueries({ queryKey: ['glBalances'] });
      queryClient.invalidateQueries({ queryKey: ['glItems'] });
      queryClient.invalidateQueries({ queryKey: ['glCategorizedItems'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast({
        title: 'Tételek jóváhagyva',
        description: `${variables.length} db tranzakció sikeresen jóváhagyva és feloldva a főkönyvben.`,
      });
    },
    onError: (err: any) => {
      console.error('Error approving batch transactions:', err);
      toast({
        title: 'Hiba a kötegelt jóváhagyáskor',
        description: err?.message || 'Nem sikerült jóváhagyni az összes tételt.',
        variant: 'destructive',
      });
    },
  });

  return {
    typelessTransactions,
    count: typelessTransactions.length,
    isLoading,
    refetch,
    presetAccounts,
    isAccountsLoading,
    approveTransaction: approveMutation.mutateAsync,
    isApproving: approveMutation.isPending,
    approveBatchTransactions: approveBatchMutation.mutateAsync,
    isApprovingBatch: approveBatchMutation.isPending,
  };
}
