import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { FixedAsset, AssetEvent, TaoTemplate } from '@/types/fixed-assets';
import { reportError } from '@/lib/errorReporter';
import { generateAssetActivationProtocolBlob, AssetProtocolData } from '@/lib/assetActivationProtocolPdf';

export const DEPRECIATION_METHOD_LABELS: Record<string, string> = {
  linear: 'Lineáris (Egyenletes)',
  degressive_syd: 'Degresszív (Évek száma összege)',
  degressive_declining: 'Degresszív (Nettó érték alapú)',
  progressive: 'Progresszív (Növekvő)',
  performance: 'Teljesítményarányos',
  absolute: 'Abszolút összegű',
  multiplier: 'Szorzószámos',
  immediate: 'Azonnali (Kisértékű eszköz)',
};

// ── Generálja és feltölti/csatolja a Tárgyi Eszköz Aktiválási Jegyzőkönyvet ──
export async function generateAndAttachAssetProtocolPdf(assetId: string, companyId: string, customUserId?: string) {
  try {
    // 1. Cég adatok lekérése
    const { data: company } = await supabase
      .from('companies')
      .select('name, tax_number, address')
      .eq('id', companyId)
      .maybeSingle();

    // 2. Eszköz részleteinek lekérése a csatolt adatokkal
    const { data: asset, error: assetErr } = await supabase
      .from('fixed_assets')
      .select(`
        *,
        location:company_locations(id, name, address),
        project:projects(id, name, project_code),
        tao_template:tao_depreciation_templates(id, name, tao_rate_percent),
        gl_account:gl_accounts(id, gl_number, short_name)
      `)
      .eq('id', assetId)
      .single();

    if (assetErr || !asset) throw assetErr || new Error('Asset not found');

    // 3. User ID felderítése a storage RLS szabályhoz ((storage.foldername(name))[1] = auth.uid())
    let uId = customUserId;
    if (!uId) {
      const { data: { user } } = await supabase.auth.getUser();
      uId = user?.id;
    }

    const usefulYears = (asset.useful_life_months / 12).toFixed(1).replace('.0', '');
    const annualRate = asset.useful_life_months > 0
      ? (12 / asset.useful_life_months * 100).toFixed(1).replace('.0', '') + '%'
      : '-';

    const protocolData: AssetProtocolData = {
      companyName: company?.name || 'Cég neve',
      companyAddress: company?.address || asset.location?.address || '',
      companyTaxNumber: company?.tax_number || '',
      protocolNumber: `JK-${asset.inventory_number}`,
      protocolDate: asset.activation_date,
      activatedByName: asset.activated_by_name || 'Aktiváló személy',
      assetName: asset.name,
      assetTypeManufacturer: asset.description || undefined,
      serialNumber: asset.inventory_number,
      vtszTeszor: asset.vtsz_teszor || undefined,
      inventoryNumber: asset.inventory_number,
      quantity: 1,
      locationNameAddress: asset.location?.name
        ? `${asset.location.name}${asset.location.address ? ` (${asset.location.address})` : ''}`
        : (asset.project?.name ? `Projekt: ${asset.project.name}` : undefined),
      supplierName: asset.supplier_name || undefined,
      invoiceNumber: asset.source_invoice_number || undefined,
      invoiceDate: asset.purchase_date,
      invoiceNetAmount: asset.acquisition_value,
      activationDate: asset.activation_date,
      acquisitionValue: asset.acquisition_value,
      glAccountNumber: asset.gl_account?.gl_number,
      glAccountName: asset.gl_account?.short_name,
      accountingVoucherNumber: asset.source_invoice_number || asset.inventory_number,
      depreciationStartDate: asset.activation_date,
      depreciationMethodLabel: DEPRECIATION_METHOD_LABELS[asset.depreciation_method] || asset.depreciation_method,
      depreciationRateAnnual: annualRate,
      usefulLifeYears: usefulYears,
      residualValue: asset.residual_value,
      taoRatePercent: asset.tao_template?.tao_rate_percent,
    };

    const blob = generateAssetActivationProtocolBlob(protocolData);
    const safeInv = asset.inventory_number.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `aktivalasi_jegyzokonyv_${safeInv}.pdf`;
    
    // Elsődlegesen user.id mappa (hogy megfeleljen az (storage.foldername(name))[1] = auth.uid() RLS-nek)
    const folderPrefix = uId || companyId;
    const storagePath = `${folderPrefix}/${asset.id}/${fileName}`;

    let documentUrl = '';

    try {
      const { error: uploadError } = await supabase.storage
        .from('asset-documents')
        .upload(storagePath, blob, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (uploadError) {
        // Próbálkozás a másodlagos céges mappával ha a user mapper dobna hibát
        const fallbackPath = `${companyId}/${asset.id}/${fileName}`;
        const { error: fallbackErr } = await supabase.storage
          .from('asset-documents')
          .upload(fallbackPath, blob, {
            contentType: 'application/pdf',
            upsert: true,
          });

        if (fallbackErr) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('asset-documents')
          .getPublicUrl(fallbackPath);
        documentUrl = publicUrl;
      } else {
        const { data: { publicUrl } } = supabase.storage
          .from('asset-documents')
          .getPublicUrl(storagePath);
        documentUrl = publicUrl;
      }
    } catch (storageErr: any) {
      reportError({
        type: 'db_query',
        component: 'useFixedAssets',
        action: 'storageUploadFallback',
        message: 'Storage upload failed, falling back to data URL',
        error: storageErr,
      });

      // Fallback: konvertálás Data URL-re ha a storage tiltott
      const reader = new FileReader();
      documentUrl = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    }

    const docItem = {
      name: 'Tárgyi Eszköz Aktiválási Jegyzőkönyv',
      url: documentUrl,
      type: 'protocol',
    };

    const existingDocs = ((asset.documents as any[]) || []).filter((d: any) => d.type !== 'protocol');
    const updatedDocs = [...existingDocs, docItem];

    const { error: dbError } = await supabase
      .from('fixed_assets')
      .update({ documents: updatedDocs })
      .eq('id', asset.id);

    if (dbError) throw dbError;

    return documentUrl;
  } catch (err: any) {
    reportError({
      type: 'db_query',
      component: 'useFixedAssets',
      action: 'generateAndAttachAssetProtocolPdf',
      message: err?.message || 'Failed to generate asset protocol PDF',
      error: err,
    });
    throw err;
  }
}

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
      vtszTeszor?: string;
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
          vtsz_teszor: params.vtszTeszor || null,
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

      // 3. Automatikusan elkészíti és csatolja a Tárgyi Eszköz Aktiválási Jegyzőkönyvet
      try {
        await generateAndAttachAssetProtocolPdf(asset.id, params.companyId);
      } catch (pdfErr) {
        reportError({
          type: 'db_query',
          component: 'useFixedAssets',
          action: 'useCreateFixedAsset:pdf',
          message: 'Auto protocol generation failed',
          error: pdfErr,
        });
      }

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


