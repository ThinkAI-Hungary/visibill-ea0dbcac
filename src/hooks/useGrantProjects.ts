import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { GrantProject, CreateGrantProjectInput } from '@/types/fixed-assets';
import { toast } from '@/hooks/use-toast';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useGrantProjects(companyId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading, error, refetch } = useQuery({
    queryKey: ['grantProjects', companyId],
    queryFn: async () => {
      if (!companyId || !UUID_REGEX.test(companyId)) return [];

      const { data, error: queryError } = await (supabase as any)
        .from('grant_projects')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (queryError) throw queryError;
      return (data || []) as GrantProject[];
    },
    enabled: !!companyId && UUID_REGEX.test(companyId),
  });

  const createMutation = useMutation({
    mutationFn: async (input: CreateGrantProjectInput) => {
      const { data, error: insertError } = await (supabase as any)
        .from('grant_projects')
        .insert({
          company_id: input.company_id,
          name: input.name,
          code: input.code,
          grantor: input.grantor || null,
          contract_number: input.contract_number || null,
          eligible_cost: input.eligible_cost ?? 0,
          grant_amount: input.grant_amount,
          intensity_rate: input.intensity_rate,
          own_contribution: input.own_contribution ?? Math.max(0, (input.eligible_cost ?? 0) - input.grant_amount),
          advance_amount: input.advance_amount ?? 0,
          disbursed_amount: input.disbursed_amount ?? 0,
          maintenance_period_years: input.maintenance_period_years ?? 3,
          maintenance_end_date: input.maintenance_end_date || null,
          status: input.status || 'active',
          notes: input.notes || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      return data as GrantProject;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grantProjects', companyId] });
      toast({ title: 'Pályázati projekt sikeresen rögzítve' });
    },
    onError: (err: any) => {
      toast({ title: 'Hiba a pályázati projekt mentésekor', description: err?.message || 'Ismeretlen hiba', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<GrantProject> }) => {
      const { data, error: updateError } = await (supabase as any)
        .from('grant_projects')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;
      return data as GrantProject;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grantProjects', companyId] });
      toast({ title: 'Pályázati projekt adatai frissítve' });
    },
    onError: (err: any) => {
      toast({ title: 'Hiba a projekt frissítésekor', description: err?.message || 'Ismeretlen hiba', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error: delError } = await (supabase as any)
        .from('grant_projects')
        .delete()
        .eq('id', id);

      if (delError) throw delError;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grantProjects', companyId] });
      toast({ title: 'Pályázati projekt törölve' });
    },
    onError: (err: any) => {
      toast({ title: 'Hiba a projekt törlésekor', description: err?.message || 'Ismeretlen hiba', variant: 'destructive' });
    },
  });

  return {
    projects,
    isLoading,
    error,
    refetch,
    createProject: createMutation.mutateAsync,
    updateProject: updateMutation.mutateAsync,
    deleteProject: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
