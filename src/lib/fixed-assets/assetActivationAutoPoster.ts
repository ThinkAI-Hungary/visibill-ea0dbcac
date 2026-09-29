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
      userId,
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

    // 1. Keresünk Vegyes naplót a cégnél
    const cleanInv = inventoryNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
    const documentId = `JK-${cleanInv}`;

    // Megnézzük, van-e már ilyen bizonylatszám a duplikáció elkerülésére
    const { data: existingHeader } = await supabase
      .from('acc_journal_headers')
      .select('id, status')
      .eq('company_id', companyId)
      .eq('document_id', documentId)
      .neq('status', 'SZTORNOZOTT')
      .maybeSingle();

    if (existingHeader?.id) {
      return {
        success: true,
        headerId: existingHeader.id,
        message: `Az eszköz aktiválása már korábban le lett könyvelve (${documentId}).`,
      };
    }

    const { data: journals = [] } = await supabase
      .from('acc_journals')
      .select('id, code, name')
      .eq('company_id', companyId)
      .eq('is_active', true);

    const veJournal =
      journals?.find(j => j.code?.toUpperCase() === 'VE' || j.code?.toUpperCase() === 'VEG') ||
      journals?.find(j => j.name?.toLowerCase().includes('vegyes')) ||
      journals?.[0];

    if (!veJournal) {
      return { success: false, message: 'Nem található Vegyes könyvelési napló a cégnél.' };
    }

    // 2. Megkeressük a 161 (Befejezetlen beruházások) számlát
    const gl161 = await resolveCipGlAccount(companyId);
    if (!gl161) {
      return {
        success: false,
        message: 'A számlatükörben nem található 161 (Befejezetlen beruházások) számla.',
      };
    }

    const year = parseInt(activationDate.slice(0, 4), 10) || new Date().getFullYear();
    const description = `Tárgyi eszköz aktiválás: ${assetName} (${inventoryNumber})`;

    // 3. Új fejléc létrehozása
    const { data: newHeader, error: headerErr } = await supabase
      .from('acc_journal_headers')
      .insert({
        company_id: companyId,
        journal_id: veJournal.id,
        accounting_year: year,
        status: 'PISZKOZAT',
        entry_type: 'NORMAL',
        source: 'AUTOMATIKUS',
        currency: currency || 'HUF',
        posting_date: activationDate,
        document_date: activationDate,
        document_id: documentId,
        description,
        justification: `Tárgyi eszköz aktiválási jegyzőkönyv: ${assetName}, összeg: ${acquisitionValue.toLocaleString('hu-HU')} ${currency}`,
        created_by: userId || null,
        posted_by: userId || null,
      })
      .select('id')
      .single();

    if (headerErr || !newHeader) {
      return { success: false, message: `Napló fejléc hiba: ${headerErr?.message}` };
    }

    const headerId = newHeader.id;

    // 4. Sorok beszúrása:
    // 1. sor: Tartozik [Eszköz számla, pl. 1341] (Állományba vétel)
    // 2. sor: Követel 161 (Befejezetlen beruházás kivezetése)
    const lines = [
      {
        header_id: headerId,
        sequence_number: 1,
        gl_account_id: glAccountId,
        dc_type: 'T',
        amount: acquisitionValue,
        description: `Tárgyi eszköz aktiválás — ${assetName}`,
      },
      {
        header_id: headerId,
        sequence_number: 2,
        gl_account_id: gl161,
        dc_type: 'K',
        amount: acquisitionValue,
        description: `Befejezetlen beruházás átvezetése (161) — ${assetName}`,
      },
    ];

    const { error: linesErr } = await supabase.from('acc_journal_lines').insert(lines);
    if (linesErr) {
      return { success: false, message: `Napló sorok hiba: ${linesErr?.message}` };
    }

    // 5. Véglegesítés az acc_post_journal_entry RPC-n keresztül
    try {
      const { error: rpcErr } = await supabase.rpc('acc_post_journal_entry', {
        p_header_id: headerId,
        p_user_id: userId || null,
      });

      if (rpcErr) {
        console.warn('acc_post_journal_entry RPC warning, falling back to direct update:', rpcErr);
        await supabase
          .from('acc_journal_headers')
          .update({
            status: 'KONYVELT',
            posted_at: new Date().toISOString(),
            posted_by: userId || null,
          })
          .eq('id', headerId);
      }
    } catch {
      await supabase
        .from('acc_journal_headers')
        .update({
          status: 'KONYVELT',
          posted_at: new Date().toISOString(),
          posted_by: userId || null,
        })
        .eq('id', headerId);
    }

    return { success: true, headerId };
  } catch (err: any) {
    console.error('postAssetActivationToLedger error:', err);
    return { success: false, message: err?.message || 'Aktiválás könyvelési hiba' };
  }
}

/**
 * Törli az eszközhöz tartozó aktiválási könyvelési tételt.
 */
export async function removeAssetActivationPosting(companyId: string, inventoryNumber: string): Promise<AssetActivationPostingResult> {
  try {
    const cleanInv = inventoryNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
    const documentId = `JK-${cleanInv}`;

    const { data: header, error: headErr } = await supabase
      .from('acc_journal_headers')
      .select('id, journal_number')
      .eq('company_id', companyId)
      .eq('document_id', documentId)
      .maybeSingle();

    if (headErr) {
      return { success: false, message: headErr.message };
    }

    if (header?.id) {
      // Ha már van sorszáma, nem töröljük a sorszámfolytonosság védelme miatt, hanem sztornózzuk
      if (header.journal_number) {
        await supabase
          .from('acc_journal_headers')
          .update({ status: 'SZTORNOZOTT' })
          .eq('id', header.id);
      } else {
        await supabase.from('acc_journal_lines').delete().eq('header_id', header.id);
        await supabase.from('acc_journal_headers').delete().eq('id', header.id);
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error('removeAssetActivationPosting error:', err);
    return { success: false, message: err?.message || 'Könyvelési törlési hiba' };
  }
}
