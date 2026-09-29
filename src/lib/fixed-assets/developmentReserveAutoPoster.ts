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
    const { companyId, userId, assetName, inventoryNumber, reserveAmount, activationDate, reserveYear } = params;

    if (!reserveAmount || reserveAmount <= 0) {
      return { success: false, message: 'Nincs érvényes fejlesztési tartalék összeg.' };
    }

    // 1. Keresünk Vegyes naplót a cégnél
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

    // 2. Megkeressük a 414 és 413 főkönyvi számlákat
    const { gl414, gl413 } = await resolveReserveGlAccounts(companyId);

    if (!gl414 || !gl413) {
      return {
        success: false,
        message: 'A számlatükörben nem található 414 (Lekötött tartalék) vagy 413 (Eredménytartalék) számla.',
      };
    }

    const year = parseInt(activationDate.slice(0, 4), 10) || new Date().getFullYear();
    const cleanInv = inventoryNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
    const documentId = `FT-FELOLD-${cleanInv}`;
    const description = `Fejlesztési tartalék feloldása: ${assetName} (${inventoryNumber})${reserveYear ? ` — ${reserveYear}. évi keretből` : ''}`;

    // Megnézzük, van-e már ilyen bizonylatszám a duplikáció elkerülésére
    const { data: existingHeader } = await supabase
      .from('acc_journal_headers')
      .select('id')
      .eq('company_id', companyId)
      .eq('document_id', documentId)
      .maybeSingle();

    let headerId = existingHeader?.id;

    if (!headerId) {
      // Új fejléc létrehozása
      const { data: newHeader, error: headerErr } = await supabase
        .from('acc_journal_headers')
        .insert({
          company_id: companyId,
          journal_id: veJournal.id,
          accounting_year: year,
          status: 'KONYVELT',
          posting_date: activationDate,
          document_date: activationDate,
          document_id: documentId,
          description,
          justification: `Tárgyi eszköz aktiválás (Tao. tv. 7. § (15)): ${assetName}, összeg: ${reserveAmount.toLocaleString('hu-HU')} Ft`,
          created_by: userId || null,
          posted_by: userId || null,
          posted_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (headerErr || !newHeader) {
        return { success: false, message: `Napló fejléc hiba: ${headerErr?.message}` };
      }
      headerId = newHeader.id;
    } else {
      // Ha már volt korábbi tétel, a sorokat újraírjuk
      await supabase.from('acc_journal_lines').delete().eq('header_id', headerId);
    }

    // Sorok beszúrása:
    // 1. sor: Tartozik 414 (Lekötött tartalék csökken / feloldódik)
    // 2. sor: Követel 413 (Eredménytartalék nő / jóváíródik)
    const lines = [
      {
        header_id: headerId,
        sequence_number: 1,
        gl_account_id: gl414,
        dc_type: 'T',
        amount: reserveAmount,
        description: `Lekötött tartalék feloldása (414) — ${assetName}`,
      },
      {
        header_id: headerId,
        sequence_number: 2,
        gl_account_id: gl413,
        dc_type: 'K',
        amount: reserveAmount,
        description: `Eredménytartalékba visszavezetés (413) — ${assetName}`,
      },
    ];

    const { error: linesErr } = await supabase.from('acc_journal_lines').insert(lines);
    if (linesErr) {
      return { success: false, message: `Napló sorok hiba: ${linesErr?.message}` };
    }

    return { success: true, headerId };
  } catch (err: any) {
    console.error('postDevelopmentReserveReleaseToLedger error:', err);
    return { success: false, message: err?.message || 'Könyvelési hiba' };
  }
}

/**
 * Törli az eszközhöz tartozó fejlesztési tartalék feloldási könyvelési tételt (fejlécet és sorokat).
 */
export async function removeDevelopmentReservePosting(companyId: string, inventoryNumber: string): Promise<PostingResult> {
  try {
    const cleanInv = inventoryNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
    const documentId = `FT-FELOLD-${cleanInv}`;

    const { data: header, error: headErr } = await supabase
      .from('acc_journal_headers')
      .select('id')
      .eq('company_id', companyId)
      .eq('document_id', documentId)
      .maybeSingle();

    if (headErr) {
      return { success: false, message: headErr.message };
    }

    if (header?.id) {
      await supabase.from('acc_journal_lines').delete().eq('header_id', header.id);
      await supabase.from('acc_journal_headers').delete().eq('id', header.id);
    }

    return { success: true };
  } catch (err: any) {
    console.error('removeDevelopmentReservePosting error:', err);
    return { success: false, message: err?.message || 'Könyvelési törlési hiba' };
  }
}

