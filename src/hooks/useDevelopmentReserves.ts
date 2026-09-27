import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DevelopmentReserve } from '@/types/fixed-assets';
import { reportError } from '@/lib/errorReporter';
import { postDevelopmentReserveReleaseToLedger, removeDevelopmentReservePosting } from '@/lib/fixed-assets/developmentReserveAutoPoster';
import { generateAndAttachAssetProtocolPdf } from '@/hooks/useFixedAssets';

export function useDevelopmentReserves(companyId?: string) {
  return useQuery({
    queryKey: ['developmentReserves', companyId],
    queryFn: async (): Promise<DevelopmentReserve[]> => {
      if (!companyId) return [];

      // 1. Fetch all development reserves for company
      const { data: reserves, error: reservesError } = await supabase
        .from('development_reserves')
        .select('*')
        .eq('company_id', companyId)
        .order('creation_year', { ascending: false });

      if (reservesError) throw reservesError;
      if (!reserves || reserves.length === 0) return [];

      // 2. Fetch utilized amounts from fixed_assets
      const { data: assets, error: assetsError } = await supabase
        .from('fixed_assets')
        .select('development_reserve_id, development_reserve_amount')
        .eq('company_id', companyId)
        .not('development_reserve_id', 'is', null);

      if (assetsError) throw assetsError;

      // Group utilized amounts by reserve id
      const utilizedMap = new Map<string, number>();
      (assets || []).forEach((a) => {
        if (a.development_reserve_id) {
          const prev = utilizedMap.get(a.development_reserve_id) || 0;
          utilizedMap.set(a.development_reserve_id, prev + (Number(a.development_reserve_amount) || 0));
        }
      });

      const todayStr = new Date().toISOString().split('T')[0];

      return reserves.map((r): DevelopmentReserve => {
        const reserveAmount = Number(r.reserve_amount) || 0;
        const utilizedAmount = utilizedMap.get(r.id) || 0;
        const remainingAmount = Math.max(0, reserveAmount - utilizedAmount);

        let status: 'active' | 'exhausted' | 'expired' = 'active';
        if (remainingAmount <= 0) {
          status = 'exhausted';
        } else if (r.expiration_date < todayStr) {
          status = 'expired';
        }

        return {
          id: r.id,
          company_id: r.company_id,
          user_id: r.user_id,
          creation_year: r.creation_year,
          reserve_amount: reserveAmount,
          expiration_date: r.expiration_date,
          description: r.description,
          gl_account_id: r.gl_account_id,
          created_at: r.created_at,
          updated_at: r.updated_at,
          utilized_amount: utilizedAmount,
          remaining_amount: remainingAmount,
          status,
        };
      });
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateDevelopmentReserve() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      companyId: string;
      userId?: string;
      creationYear: number;
      reserveAmount: number;
      expirationDate?: string;
      description?: string;
      glAccountId?: string;
    }) => {
      // Alapértelmezett lejárati dátum: a képzés éve + 4 év dec. 31.
      const expDate = params.expirationDate || `${params.creationYear + 4}-12-31`;

      const { data, error } = await supabase
        .from('development_reserves')
        .insert({
          company_id: params.companyId,
          user_id: params.userId || null,
          creation_year: params.creationYear,
          reserve_amount: params.reserveAmount,
          expiration_date: expDate,
          description: params.description || null,
          gl_account_id: params.glAccountId || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['developmentReserves', variables.companyId] });
    },
  });
}

export function useDeleteDevelopmentReserve() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id: string; companyId: string }) => {
      // Ellenőrizzük, hogy van-e hozzá rendelt eszköz
      const { count, error: countError } = await supabase
        .from('fixed_assets')
        .select('id', { count: 'exact', head: true })
        .eq('development_reserve_id', params.id);

      if (countError) throw countError;
      if (count && count > 0) {
        throw new Error(`Ehhez a fejlesztési tartalékhoz még ${count} tárgyi eszköz van rendelve. Előbb távolítsa el a hozzárendelést!`);
      }

      const { error } = await supabase
        .from('development_reserves')
        .delete()
        .eq('id', params.id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['developmentReserves', variables.companyId] });
    },
  });
}

/**
 * Fejlesztési tartalék utólagos hozzárendelése, módosítása vagy törlése egy tárgyi eszközön.
 * Opcionálisan Vegyes naplóbeli könyvelési tételt (T 414 - K 413) is automatikusan frissít/töröl,
 * valamint újragenerálja a csatolt aktiválási jegyzőkönyv PDF-et.
 */
export function useAssignDevelopmentReserve() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      assetId: string;
      companyId: string;
      userId?: string;
      reserveId: string | null;
      reserveAmount: number;
      postToLedger?: boolean;
    }) => {
      // 1. Lekérjük az eszköz adatait
      const { data: asset, error: getErr } = await supabase
        .from('fixed_assets')
        .select('*')
        .eq('id', params.assetId)
        .single();
      if (getErr || !asset) throw getErr || new Error('Asset not found');

      const oldReserveAmount = Number(asset.development_reserve_amount) || 0;
      const oldReserveId = asset.development_reserve_id;

      // 2. Frissítjük a tárgyi eszközt
      const { error: updateErr } = await supabase
        .from('fixed_assets')
        .update({
          development_reserve_id: params.reserveId,
          development_reserve_amount: params.reserveAmount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.assetId);

      if (updateErr) throw updateErr;

      // 3. Esemény naplózása
      await supabase.from('asset_events').insert({
        asset_id: params.assetId,
        company_id: params.companyId,
        user_id: params.userId || null,
        event_type: 'value_change',
        event_date: new Date().toISOString().split('T')[0],
        description: params.reserveId
          ? `Fejlesztési tartalék hozzárendelve: ${params.reserveAmount.toLocaleString('hu-HU')} Ft (Tao. tv. 7. § (15))`
          : 'Fejlesztési tartalék feloldva / leválasztva',
        old_values: {
          development_reserve_id: oldReserveId,
          development_reserve_amount: oldReserveAmount,
        },
        new_values: {
          development_reserve_id: params.reserveId,
          development_reserve_amount: params.reserveAmount,
        },
      });

      // 4. Vegyes napló könyvelés frissítése/törlése
      if (params.postToLedger !== false) {
        if (params.reserveId && params.reserveAmount > 0) {
          await postDevelopmentReserveReleaseToLedger({
            companyId: params.companyId,
            userId: params.userId,
            assetId: params.assetId,
            assetName: asset.name,
            inventoryNumber: asset.inventory_number,
            reserveAmount: params.reserveAmount,
            activationDate: asset.activation_date,
          });
        } else {
          await removeDevelopmentReservePosting(params.companyId, asset.inventory_number);
        }
      }

      // 5. Aktiválási jegyzőkönyv újragenerálása az új tartalommal
      try {
        await generateAndAttachAssetProtocolPdf(params.assetId, params.companyId, params.userId);
      } catch (pdfErr) {
        reportError({
          type: 'db_query',
          component: 'useAssignDevelopmentReserve',
          action: 'pdfRegeneration',
          message: 'PDF regeneration failed',
          error: pdfErr,
        });
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fixedAssets', variables.companyId] });
      queryClient.invalidateQueries({ queryKey: ['fixedAssetDetail', variables.assetId] });
      queryClient.invalidateQueries({ queryKey: ['developmentReserves', variables.companyId] });
      queryClient.invalidateQueries({ queryKey: ['acc_journal_headers', variables.companyId] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries', variables.companyId] });
    },
  });
}

