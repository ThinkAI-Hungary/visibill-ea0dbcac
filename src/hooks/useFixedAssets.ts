import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { FixedAsset, AssetEvent, TaoTemplate } from '@/types/fixed-assets';
import { reportError } from '@/lib/errorReporter';

// ── Lista lekérés ──
export function useFixedAssets(companyId: string | undefined) {
  return useQuery({
    queryKey: ['fixedAssets', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('fixed_assets')
        .select(`
          *,
          location:company_locations(id, name, address, location_type),
          project:projects(id, name, project_code, color, icon),
          tao_template:tao_depreciation_templates(id, name, tao_rate_percent),
          gl_account:gl_accounts(id, gl_number, short_name)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as FixedAsset[];
    },
    enabled: !!companyId,
  });
}

// ── Részletek + events ──
export function useFixedAssetDetail(assetId: string | null) {
  return useQuery({
    queryKey: ['fixedAssetDetail', assetId],
    queryFn: async () => {
      if (!assetId) return null;
      const [assetRes, eventsRes] = await Promise.all([
        supabase
          .from('fixed_assets')
          .select(`
            *,
            location:company_locations(id, name, address, location_type),
            project:projects(id, name, project_code, color, icon),
            tao_template:tao_depreciation_templates(id, name, tao_rate_percent),
            gl_account:gl_accounts(id, gl_number, short_name)
          `)
          .eq('id', assetId)
          .single(),
        supabase
          .from('asset_events')
          .select('*')
          .eq('asset_id', assetId)
          .order('event_date', { ascending: true }),
      ]);
      if (assetRes.error) throw assetRes.error;
      return {
        asset: (assetRes.data || null) as unknown as FixedAsset,
        events: (eventsRes.data || []) as AssetEvent[],
      };
    },
    enabled: !!assetId,
  });
}

// ── Tao sablonok ──
export function useTaoTemplates() {
  return useQuery({
    queryKey: ['taoTemplates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tao_depreciation_templates')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return (data || []) as TaoTemplate[];
    },
    staleTime: 60 * 60 * 1000, // 1 hour — rarely changes
  });
}

// ── GL accounts for asset mapping (1xx = Befektetett eszközök) ──
export function useAssetGlAccounts(companyId: string | undefined, presetId: string | undefined) {
  return useQuery({
    queryKey: ['assetGlAccounts', companyId, presetId],
    queryFn: async () => {
      if (!companyId || !presetId) return [];
      const { data, error } = await supabase
        .from('gl_accounts')
        .select('id, gl_number, short_name')
        .eq('preset_id', presetId)
        .like('gl_number', '1%')
        .order('gl_number', { ascending: true });
      if (error) throw error;
      // Only leaf-level accounts (4+ digit gl_number) for assignment
      return (data || []).filter((a: any) => a.gl_number.replace('.','').length >= 3);
    },
    enabled: !!companyId && !!presetId,
    staleTime: 60 * 60 * 1000,
  });
}

// ── Create asset mutation ──
export function useCreateFixedAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      companyId: string;
      userId: string;
      inventoryNumber: string;
      name: string;
      description?: string;
      acquisitionValue: number;
      residualValue: number;
      currency: string;
      purchaseDate: string;
      activationDate: string;
      usefulLifeMonths: number;
      depreciationMethod: string;
      performanceUnit?: string | null;
      totalPlannedPerformance?: number | null;
      depreciationSchedule?: number[] | null;
      taoTemplateId: string | null;
      locationId: string | null;
      projectId?: string | null;
      activatedByUserId: string;
      activatedByName: string;
      sourceInvoiceId: string | null;
      sourceInvoiceType: 'submitted' | 'nav' | null;
      sourceInvoiceNumber: string | null;
      supplierName: string | null;
      glAccountId: string | null;
    }) => {
      // 1. Insert fixed asset
      const { data: asset, error: assetError } = await supabase
        .from('fixed_assets')
        .insert({
          company_id: params.companyId,
          user_id: params.userId,
          inventory_number: params.inventoryNumber,
          name: params.name,
          description: params.description || null,
          acquisition_value: params.acquisitionValue,
          residual_value: params.residualValue,
          currency: params.currency,
          purchase_date: params.purchaseDate,
          activation_date: params.activationDate,
          useful_life_months: params.usefulLifeMonths,
          depreciation_method: params.depreciationMethod,
          performance_unit: params.performanceUnit || null,
          total_planned_performance: params.totalPlannedPerformance || null,
          depreciation_schedule: params.depreciationSchedule || null,
          tao_template_id: params.taoTemplateId,
          location_id: params.locationId,
          project_id: params.projectId || null,
          activated_by_user_id: params.activatedByUserId,
          activated_by_name: params.activatedByName,
          source_invoice_id: params.sourceInvoiceId,
          source_invoice_type: params.sourceInvoiceType,
          source_invoice_number: params.sourceInvoiceNumber,
          supplier_name: params.supplierName,
          gl_account_id: params.glAccountId,
        })
        .select()
        .single();

      if (assetError) throw assetError;

      // 2. Insert activation event
      const { error: eventError } = await supabase
        .from('asset_events')
        .insert({
          asset_id: asset.id,
          company_id: params.companyId,
          user_id: params.userId,
          event_type: 'activation',
          event_date: params.activationDate,
          description: `Eszköz aktiválva: ${params.name}`,
          new_values: {
            acquisition_value: params.acquisitionValue,
            activation_date: params.activationDate,
            activated_by: params.activatedByName,
            ...(params.projectId ? { project_id: params.projectId } : {}),
          },
        });

      if (eventError) reportError({ type: 'db_query', component: 'useFixedAssets', action: 'error', message: 'Event insert error:', error: eventError });

      return asset;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fixedAssets', variables.companyId] });
      queryClient.invalidateQueries({ queryKey: ['project-fixed-assets'] });
    },
  });
}

// ── Generate inventory number ──
export async function generateInventoryNumber(
  companyId: string,
  invoiceNumber: string
): Promise<string> {
  const now = new Date();
  const yymm = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `${invoiceNumber} - ${yymm} - `;

  // Count existing assets with same prefix
  const { count, error } = await supabase
    .from('fixed_assets')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .like('inventory_number', `${prefix}%`);

  if (error) throw error;

  const nextNum = (count || 0) + 1;
  return `${prefix}${String(nextNum).padStart(4, '0')}`;
}

// ── Transfer asset (áthelyezés / projekt hozzárendelés) ──
export function useTransferAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      assetId: string;
      companyId: string;
      userId: string;
      newLocationId?: string | null;
      newLocationName?: string;
      oldLocationName?: string;
      newProjectId?: string | null;
      newProjectName?: string;
      oldProjectName?: string;
      eventDate: string;
      description?: string;
    }) => {
      const updatePayload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (params.newLocationId !== undefined) {
        updatePayload.location_id = params.newLocationId || null;
      }
      if (params.newProjectId !== undefined) {
        updatePayload.project_id = params.newProjectId || null;
      }

      const { error: updateError } = await supabase
        .from('fixed_assets')
        .update(updatePayload)
        .eq('id', params.assetId);
      if (updateError) throw updateError;

      // Determine event type & description
      const isLocationChange = params.newLocationId !== undefined && params.newLocationName !== params.oldLocationName;
      const isProjectChange = params.newProjectId !== undefined && params.newProjectName !== params.oldProjectName;

      let eventType: 'transfer' | 'project_transfer' = 'transfer';
      let autoDesc = '';
      const oldVals: Record<string, any> = {};
      const newVals: Record<string, any> = {};

      if (isLocationChange && isProjectChange) {
        eventType = 'transfer';
        autoDesc = `Áthelyezés: ${params.oldLocationName || 'Nincs'} → ${params.newLocationName || 'Nincs'}, Projekt: ${params.oldProjectName || 'Nincs'} → ${params.newProjectName || 'Nincs'}`;
        oldVals.location = params.oldLocationName;
        oldVals.project = params.oldProjectName;
        newVals.location = params.newLocationName;
        newVals.project = params.newProjectName;
      } else if (isProjectChange) {
        eventType = 'project_transfer';
        autoDesc = `Projekt hozzárendelés: ${params.oldProjectName || 'Nincs'} → ${params.newProjectName || 'Nincs'}`;
        oldVals.project = params.oldProjectName;
        newVals.project = params.newProjectName;
      } else {
        eventType = 'transfer';
        autoDesc = `Áthelyezés: ${params.oldLocationName || 'Nincs'} → ${params.newLocationName || 'Nincs'}`;
        oldVals.location = params.oldLocationName;
        newVals.location = params.newLocationName;
      }

      const { error: eventError } = await supabase
        .from('asset_events')
        .insert({
          asset_id: params.assetId,
          company_id: params.companyId,
          user_id: params.userId,
          event_type: eventType,
          event_date: params.eventDate,
          description: params.description || autoDesc,
          old_values: oldVals,
          new_values: newVals,
        });
      if (eventError) reportError({ type: 'db_query', component: 'useFixedAssets', action: 'error', message: 'Event insert error:', error: eventError });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fixedAssets', variables.companyId] });
      queryClient.invalidateQueries({ queryKey: ['fixedAssetDetail', variables.assetId] });
      queryClient.invalidateQueries({ queryKey: ['project-fixed-assets'] });
    },
  });
}

// ── Reactivation / Value increase (ráaktiválás) ──
export function useReactivateAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      assetId: string;
      companyId: string;
      userId: string;
      additionalValue: number;
      eventDate: string;
      description?: string;
      oldAcquisitionValue: number;
    }) => {
      const newValue = params.oldAcquisitionValue + params.additionalValue;

      const { error: updateError } = await supabase
        .from('fixed_assets')
        .update({
          acquisition_value: newValue,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.assetId);
      if (updateError) throw updateError;

      const { error: eventError } = await supabase
        .from('asset_events')
        .insert({
          asset_id: params.assetId,
          company_id: params.companyId,
          user_id: params.userId,
          event_type: 'reactivation',
          event_date: params.eventDate,
          description: params.description || `Ráaktiválás: +${params.additionalValue.toLocaleString('hu-HU')} Ft`,
          old_values: { acquisition_value: params.oldAcquisitionValue },
          new_values: { acquisition_value: newValue, added_value: params.additionalValue },
        });
      if (eventError) reportError({ type: 'db_query', component: 'useFixedAssets', action: 'error', message: 'Event insert error:', error: eventError });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fixedAssets', variables.companyId] });
      queryClient.invalidateQueries({ queryKey: ['fixedAssetDetail', variables.assetId] });
    },
  });
}

// ── Disposal / Scrap (kivezetés / selejtezés) ──
export function useDisposeAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      assetId: string;
      companyId: string;
      userId: string;
      disposalDate: string;
      status: 'disposed' | 'sold';
      reason?: string;
      saleValue?: number;
    }) => {
      const { error: updateError } = await supabase
        .from('fixed_assets')
        .update({
          disposal_date: params.disposalDate,
          status: params.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.assetId);
      if (updateError) throw updateError;

      const { error: eventError } = await supabase
        .from('asset_events')
        .insert({
          asset_id: params.assetId,
          company_id: params.companyId,
          user_id: params.userId,
          event_type: 'disposal',
          event_date: params.disposalDate,
          description: params.reason || (params.status === 'sold' ? 'Értékesítés' : 'Selejtezés / Kivezetés'),
          new_values: {
            status: params.status,
            disposal_date: params.disposalDate,
            ...(params.saleValue ? { sale_value: params.saleValue } : {}),
          },
        });
      if (eventError) reportError({ type: 'db_query', component: 'useFixedAssets', action: 'error', message: 'Event insert error:', error: eventError });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fixedAssets', variables.companyId] });
      queryClient.invalidateQueries({ queryKey: ['fixedAssetDetail', variables.assetId] });
      queryClient.invalidateQueries({ queryKey: ['project-fixed-assets'] });
    },
  });
}

// ── Projekthez rendelt eszközök lekérése ──
export function useProjectFixedAssets(companyId: string | undefined, projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-fixed-assets', companyId, projectId],
    queryFn: async () => {
      if (!companyId || !projectId) return [];
      const { data, error } = await supabase
        .from('fixed_assets')
        .select(`
          id,
          inventory_number,
          name,
          acquisition_value,
          residual_value,
          currency,
          purchase_date,
          activation_date,
          status,
          useful_life_months,
          depreciation_method,
          tao_rate_override,
          location:company_locations(id, name),
          tao_template:tao_depreciation_templates(tao_rate_percent)
        `)
        .eq('company_id', companyId)
        .eq('project_id', projectId)
        .order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId && !!projectId,
  });
}


