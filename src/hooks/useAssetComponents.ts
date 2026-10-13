import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { FixedAssetComponent, CreateFixedAssetComponentInput } from '@/types/fixed-assets';
import { toast } from '@/hooks/use-toast';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useAssetComponents(assetId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: components = [], isLoading, error, refetch } = useQuery({
    queryKey: ['assetComponents', assetId],
    queryFn: async () => {
      if (!assetId || !UUID_REGEX.test(assetId)) return [];

      const { data, error: queryError } = await (supabase as any)
        .from('fixed_asset_components')
        .select(`
          *,
          grant_project:grant_projects(*)
        `)
        .eq('fixed_asset_id', assetId)
        .order('activation_date', { ascending: true });

      if (queryError) throw queryError;
      return (data || []) as FixedAssetComponent[];
    },
    enabled: !!assetId && UUID_REGEX.test(assetId),
  });

  const createMutation = useMutation({
    mutationFn: async (input: CreateFixedAssetComponentInput) => {
      const gross = input.gross_value || 0;
      const grantAmount = input.grant_funding_amount || 0;
      const ownAmount = input.own_funding_amount ?? Math.max(0, gross - grantAmount);
      const ratio = input.grant_ratio_percent ?? (gross > 0 && grantAmount > 0 ? Math.round((grantAmount / gross) * 10000) / 100 : 0);

      const { data, error: insertError } = await (supabase as any)
        .from('fixed_asset_components')
        .insert({
          company_id: input.company_id,
          fixed_asset_id: input.fixed_asset_id,
          name: input.name,
          component_type: input.component_type || 'initial',
          activation_date: input.activation_date,
          gross_value: gross,
          grant_project_id: input.grant_project_id || null,
          grant_funding_amount: grantAmount,
          own_funding_amount: ownAmount,
          grant_ratio_percent: ratio,
          useful_life_months: input.useful_life_months || null,
          depreciation_rate: input.depreciation_rate || null,
          gl_asset_account: input.gl_asset_account || null,
          notes: input.notes || null,
        })
        .select(`
          *,
          grant_project:grant_projects(*)
        `)
        .single();

      if (insertError) throw insertError;
      return data as FixedAssetComponent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assetComponents', assetId] });
      queryClient.invalidateQueries({ queryKey: ['fixedAssets'] });
      toast({ title: 'Komponens sikeresen hozzáadva' });
    },
    onError: (err: any) => {
      toast({ title: 'Hiba a komponens mentésekor', description: err?.message || 'Ismeretlen hiba', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<FixedAssetComponent> }) => {
      const { data, error: updateError } = await (supabase as any)
        .from('fixed_asset_components')
        .update(updates)
        .eq('id', id)
        .select(`
          *,
          grant_project:grant_projects(*)
        `)
        .single();

      if (updateError) throw updateError;
      return data as FixedAssetComponent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assetComponents', assetId] });
      queryClient.invalidateQueries({ queryKey: ['fixedAssets'] });
      toast({ title: 'Komponens adatai frissítve' });
    },
    onError: (err: any) => {
      toast({ title: 'Hiba a komponens frissítésekor', description: err?.message || 'Ismeretlen hiba', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error: delError } = await (supabase as any)
        .from('fixed_asset_components')
        .delete()
        .eq('id', id);

      if (delError) throw delError;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assetComponents', assetId] });
      queryClient.invalidateQueries({ queryKey: ['fixedAssets'] });
      toast({ title: 'Komponens törölve' });
    },
    onError: (err: any) => {
      toast({ title: 'Hiba a komponens törlésekor', description: err?.message || 'Ismeretlen hiba', variant: 'destructive' });
    },
  });

  return {
    components,
    isLoading,
    error,
    refetch,
    createComponent: createMutation.mutateAsync,
    updateComponent: updateMutation.mutateAsync,
    deleteComponent: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

export function useCompanyAssetComponents(companyId: string | undefined) {
  return useQuery({
    queryKey: ['companyAssetComponents', companyId],
    queryFn: async () => {
      if (!companyId || !UUID_REGEX.test(companyId)) return [];

      const { data, error: queryError } = await (supabase as any)
        .from('fixed_asset_components')
        .select(`
          *,
          grant_project:grant_projects(*)
        `)
        .eq('company_id', companyId);

      if (queryError) throw queryError;
      return (data || []) as FixedAssetComponent[];
    },
    enabled: !!companyId && UUID_REGEX.test(companyId),
  });
}
