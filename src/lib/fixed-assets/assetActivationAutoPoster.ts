import { supabase } from '@/integrations/supabase/client';

export interface AssetActivationPostingParams {
  companyId: string;
  userId?: string;
  assetId: string;
  assetName: string;
  inventoryNumber: string;
  acquisitionValue: number;
  activationDate: string;
  currency?: string;
  glAccountId?: string | null;
}

export interface AssetActivationPostingResult {
  success: boolean;
  message?: string;
  headerId?: string;
}

/**
 * Lekéri a cég számlatükréből a 161 (Befejezetlen beruházások) számlát.
 */
async function resolveCipGlAccount(companyId: string): Promise<string | null> {
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

  // 1. Strict prefix matching for 161
  for (const prefix of ['161', '1611', '1610']) {
    const match = accounts.find((a: any) => a.gl_number.startsWith(prefix));
    if (match) return match.id;
  }

  // 2. Keyword matching within 1st class
  const match = accounts.find((a: any) =>
    a.gl_number.startsWith('1') &&
    ((a.short_name && a.short_name.toLowerCase().includes('befejezetlen')) ||
     (a.description && a.description.toLowerCase().includes('befejezetlen')))
  );

  return match?.id || null;
}

/**
 * Automatikusan lekönyveli a tárgyi eszköz aktiválását a Vegyes naplóba:
 * T [Eszköz főkönyvi számla (pl. 1341)] — K 161 (Befejezetlen beruházások)
 */
export async function postAssetActivationToLedger(
  params: AssetActivationPostingParams
): Promise<AssetActivationPostingResult> {
  try {
    const {
      companyId,
      assetId,
      assetName,
      inventoryNumber,
      acquisitionValue,
      activationDate,
      currency = 'HUF',
      glAccountId,
    } = params;

    if (!acquisitionValue || acquisitionValue <= 0) {
      return { success: false, message: 'Nincs érvényes aktiválási bekerülési érték.' };
    }

    if (!glAccountId) {
      return { success: false, message: 'Nincs megadva eszköz főkönyvi számla az aktiváláshoz.' };
    }

    // 1. Megkeressük a 161 (Befejezetlen beruházások) számlát
    const gl161 = await resolveCipGlAccount(companyId);
    if (!gl161) {
      return {
        success: false,
        message: 'A számlatükörben nem található 161 (Befejezetlen beruházások) számla.',
      };
    }

    // 2. Aktiválás feladása tranzakcionális SECURITY DEFINER RPC-n keresztül
    const { data, error } = await supabase.rpc('post_asset_activation_to_gl', {
      p_company_id: companyId,
      p_asset_id: assetId,
      p_asset_name: assetName,
      p_inventory_number: inventoryNumber,
      p_acquisition_value: acquisitionValue,
      p_activation_date: activationDate,
      p_gl_account_id: glAccountId,
      p_cip_gl_account_id: gl161,
      p_currency: currency || 'HUF',
    });

    if (error) {
      return { success: false, message: `Aktiválás könyvelési hiba: ${error.message}` };
    }

    const res = data as any;
    return {
      success: res?.success ?? true,
      headerId: res?.header_id,
      message: res?.message,
    };
  } catch (err: any) {
    console.error('postAssetActivationToLedger error:', err);
    return { success: false, message: err?.message || 'Aktiválás könyvelési hiba' };
  }
}

/**
 * Törli vagy sztornózza az eszközhöz tartozó aktiválási könyvelési tételt.
 */
export async function removeAssetActivationPosting(companyId: string, inventoryNumber: string): Promise<AssetActivationPostingResult> {
  try {
    const { data, error } = await supabase.rpc('remove_asset_activation_from_gl', {
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
    console.error('removeAssetActivationPosting error:', err);
    return { success: false, message: err?.message || 'Könyvelési törlési hiba' };
  }
}
