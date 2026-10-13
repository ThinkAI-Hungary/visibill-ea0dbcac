import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CompanySubLocation } from '@/types/fixed-assets';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Hierarchikus fa építése a lapos sub_locations listából.
 */
export function buildSubLocationTree(items: CompanySubLocation[]): CompanySubLocation[] {
  const itemMap = new Map<string, CompanySubLocation>();
  const rootItems: CompanySubLocation[] = [];

  // Első lépés: minden elem klónozása üres children tömbbel
  items.forEach(item => {
    itemMap.set(item.id, { ...item, children: [] });
  });

  // Második lépés: szülő-gyermek kapcsolatok felépítése
  items.forEach(item => {
    const node = itemMap.get(item.id)!;
    if (item.parent_id && itemMap.has(item.parent_id)) {
      const parent = itemMap.get(item.parent_id)!;
      parent.children = parent.children || [];
      parent.children.push(node);
      node.parent = { id: parent.id, name: parent.name, code: parent.code };
    } else {
      rootItems.push(node);
    }
  });

  return rootItems;
}

export function useCompanySubLocations(companyId: string | undefined, locationId?: string | null) {
  const queryClient = useQueryClient();

  const { data: subLocations = [], isLoading, error } = useQuery({
    queryKey: ['companySubLocations', companyId, locationId || '_all'],
    queryFn: async () => {
      if (!companyId || !UUID_REGEX.test(companyId)) return [];

      let query = supabase
        .from('company_sub_locations')
        .select('*')
        .eq('company_id', companyId)
        .order('name', { ascending: true });

      if (locationId && UUID_REGEX.test(locationId)) {
        query = query.eq('location_id', locationId);
      }

      const { data, error: queryError } = await query;
      if (queryError) throw queryError;

      return (data || []) as CompanySubLocation[];
    },
    enabled: !!companyId && UUID_REGEX.test(companyId),
  });

  const subLocationTree = buildSubLocationTree(subLocations);

  const createSubLocation = useMutation({
    mutationFn: async (params: {
      location_id: string;
      parent_id?: string | null;
      name: string;
      code?: string | null;
      description?: string | null;
      is_active?: boolean;
    }) => {
      if (!companyId) throw new Error('Nincs kiválasztva cég');

      const { data, error: insertError } = await supabase
        .from('company_sub_locations')
        .insert({
          company_id: companyId,
          location_id: params.location_id,
          parent_id: params.parent_id || null,
          name: params.name.trim(),
          code: params.code?.trim() || null,
          description: params.description?.trim() || null,
          is_active: params.is_active ?? true,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      return data as CompanySubLocation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companySubLocations', companyId] });
    },
  });

  const updateSubLocation = useMutation({
    mutationFn: async (params: {
      id: string;
      location_id?: string;
      parent_id?: string | null;
      name?: string;
      code?: string | null;
      description?: string | null;
      is_active?: boolean;
    }) => {
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (params.location_id !== undefined) updateData.location_id = params.location_id;
      if (params.parent_id !== undefined) updateData.parent_id = params.parent_id || null;
      if (params.name !== undefined) updateData.name = params.name.trim();
      if (params.code !== undefined) updateData.code = params.code?.trim() || null;
      if (params.description !== undefined) updateData.description = params.description?.trim() || null;
      if (params.is_active !== undefined) updateData.is_active = params.is_active;

      const { data, error: updateError } = await supabase
        .from('company_sub_locations')
        .update(updateData)
        .eq('id', params.id)
        .select()
        .single();

      if (updateError) throw updateError;
      return data as CompanySubLocation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companySubLocations', companyId] });
    },
  });

  const deleteSubLocation = useMutation({
    mutationFn: async (subLocationId: string) => {
      const { error: deleteError } = await supabase
        .from('company_sub_locations')
        .delete()
        .eq('id', subLocationId);

      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companySubLocations', companyId] });
    },
  });

  return {
    subLocations,
    subLocationTree,
    isLoading,
    error,
    createSubLocation,
    updateSubLocation,
    deleteSubLocation,
  };
}
