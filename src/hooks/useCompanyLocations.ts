import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CompanyLocation } from '@/types/fixed-assets';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useCompanyLocations(companyId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['companyLocations', companyId],
    queryFn: async () => {
      if (!companyId || !UUID_REGEX.test(companyId)) return [];
      const { data, error } = await supabase
        .from('company_locations')
        .select('*')
        .eq('company_id', companyId)
        .order('location_type', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      return (data || []) as CompanyLocation[];
    },
    enabled: !!companyId && UUID_REGEX.test(companyId),
  });

  const addLocation = useMutation({
    mutationFn: async (params: { name: string; address: string; location_type: 'headquarters' | 'branch' }) => {
      if (!companyId) throw new Error('No company selected');
      const { data, error } = await supabase
        .from('company_locations')
        .insert({
          company_id: companyId,
          name: params.name,
          address: params.address,
          location_type: params.location_type,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companyLocations', companyId] });
    },
  });

  const deleteLocation = useMutation({
    mutationFn: async (locationId: string) => {
      const { error } = await supabase
        .from('company_locations')
        .delete()
        .eq('id', locationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companyLocations', companyId] });
    },
  });

  return { locations, isLoading, addLocation, deleteLocation };
}
