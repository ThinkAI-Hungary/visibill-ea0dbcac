import { supabase } from '@/integrations/supabase/client';

export interface DevelopmentReservePostingParams {
  companyId: string;
  userId?: string;
  assetId: string;
  assetName: string;
  inventoryNumber: string;
  reserveAmount: number;
  activationDate: string;
  reserveYear?: number;
}

export interface PostingResult {
  success: boolean;
  message?: string;
  headerId?: string;
}

/**
 * Lekéri a cég számlatükréből a 414 (Lekötött tartalék) és 413 (Eredménytartalék) számlákat.
 */
async function resolveReserveGlAccounts(companyId: string): Promise<{ gl414: string | null; gl413: string | null }> {
  // Check active preset for company
  const { data: presets } = await supabase
    .from('chart_of_accounts_presets')
    .select('id, company_id, is_active, type');

  const activeCustom = presets?.find(p => p.company_id === companyId && p.is_active);
  const activePresetId = activeCustom?.id ||
    presets?.find(p => p.company_id === companyId)?.id ||
    presets?.find(p => p.type === 'generic')?.id || null;

  let query = supabase.from('gl_accounts').select('id, gl_number, short_name, description');
  if (activePresetId && companyId) {
    query = query.or(`preset_id.eq.${activePresetId},company_id.eq.${companyId}`);
  } else if (activePresetId) {
    query = query.eq('preset_id', activePresetId);
  } else if (companyId) {
    query = query.eq('company_id', companyId);
  }

  const { data: glAccounts = [] } = await query.limit(3000);
  const accounts = glAccounts || [];

  const findGlId = (prefixes: string[], keywords: string[]) => {
    // 1. Strict prefix matching
    for (const prefix of prefixes) {
      const match = accounts.find((a: any) => a.gl_number.startsWith(prefix));
      if (match) return match.id;
    }
    // 2. Keyword matching within 4th class
    for (const kw of keywords) {
      const kwLower = kw.toLowerCase();
      const match = accounts.find((a: any) =>
        a.gl_number.startsWith('4') &&
        ((a.short_name && a.short_name.toLowerCase().includes(kwLower)) ||
         (a.description && a.description.toLowerCase().includes(kwLower)))
      );
      if (match) return match.id;
    }
    return null;
  };

  const gl414 = findGlId(['414', '4140', '4141'], ['lekötött tartalék', 'fejlesztési tartalék']);
  const gl413 = findGlId(['413', '4130', '4131'], ['eredménytartalék']);

  return { gl414, gl413 };
}

/**
 * Automatikusan lekönyveli a fejlesztési tartalék feloldását a Vegyes naplóba:
 * T 414 (Lekötött tartalék) — K 413 (Eredménytartalék)
 */
export async function postDevelopmentReserveReleaseToLedger(
  params: DevelopmentReservePostingParams
): Promise<PostingResult> {
  try {
    const { companyId, assetId, assetName, inventoryNumber, reserveAmount, activationDate, reserveYear } = params;

    if (!reserveAmount || reserveAmount <= 0) {
      return { success: false, message: 'Nincs érvényes fejlesztési tartalék összeg.' };
    }

    // 1. Megkeressük a 414 és 413 főkönyvi számlákat
    const { gl414, gl413 } = await resolveReserveGlAccounts(companyId);

    if (!gl414 || !gl413) {
      return {
        success: false,
        message: 'A számlatükörben nem található 414 (Lekötött tartalék) vagy 413 (Eredménytartalék) számla.',
      };
    }

    // 2. Feladás tranzakcionális SECURITY DEFINER RPC-n keresztül
    const { data, error } = await supabase.rpc('post_development_reserve_to_gl', {
      p_company_id: companyId,
      p_asset_id: assetId,
      p_asset_name: assetName,
      p_inventory_number: inventoryNumber,
      p_reserve_amount: reserveAmount,
      p_activation_date: activationDate,
      p_reserve_year: reserveYear || null,
      p_gl_414_id: gl414,
      p_gl_413_id: gl413,
    });

    if (error) {
      return { success: false, message: `Könyvelési hiba: ${error.message}` };
    }

    const res = data as any;
    return {
      success: res?.success ?? true,
      headerId: res?.header_id,
      message: res?.message,
    };
  } catch (err: any) {
    console.error('postDevelopmentReserveReleaseToLedger error:', err);
    return { success: false, message: err?.message || 'Könyvelési hiba' };
  }
}

/**
 * Törli vagy sztornózza az eszközhöz tartozó fejlesztési tartalék feloldási könyvelési tételt.
 */
export async function removeDevelopmentReservePosting(companyId: string, inventoryNumber: string): Promise<PostingResult> {
  try {
    const { data, error } = await supabase.rpc('remove_development_reserve_from_gl', {
      p_company_id: companyId,
      p_inventory_number: inventoryNumber,
    });

    if (error) {
      return { success: false, message: `Könyvelési törlési hiba: ${error.message}` };
    }

    const res = data as any;
    return {
      success: res?.success ?? true,
      message: res?.message,
    };
  } catch (err: any) {
    console.error('removeDevelopmentReservePosting error:', err);
    return { success: false, message: err?.message || 'Könyvelési törlési hiba' };
  }
}

