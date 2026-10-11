/**
 * Accounty — Osztalék Automatikus Főkönyvi Feladás
 *
 * Jóváhagyott tagi osztalék lekönyvelése a kettős könyvvitelbe (acc_journal_headers & acc_journal_lines).
 * Kontírozási szabályok (Sztv. és magyar számviteli standard):
 * 1. Bruttó osztalék előírása: T 413/493 (Eredménytartalék) – K 4791 (Kötelezettség taggal szemben)
 * 2. Levont SZJA (15%):        T 4791 – K 462 (SZJA kötelezettség)
 * 3. Levont SZOCHO (13%):      T 4791 – K 463 (SZOCHO kötelezettség)
 * 4. Tagi nettó követelés maradvány (4791 K egyenleg): banki átutaláskor T 4791 – K 384.
 */

import { supabase } from '@/integrations/supabase/client';
import { fetchAllGlAccountsByPreset } from '@/lib/glData';
import type { DividendRecord } from '@/hooks/useDividends';

export interface DividendPostingResult {
  success: boolean;
  headerId?: string;
  journalNumber?: string;
  message: string;
}

export async function resolveDividendGlAccounts(companyId: string) {
  // 1. Resolve active chart of accounts preset for company
  const { data: presets } = await supabase
    .from('chart_of_accounts_presets')
    .select('id, name, company_id, is_active, type');

  let activePreset = presets?.find(p => p.company_id === companyId && p.is_active);
  if (!activePreset) {
    activePreset = presets?.find(p => p.company_id === companyId) || presets?.find(p => p.type === 'generic');
  }

  const activePresetId = activePreset?.id;

  // 2. Fetch GL accounts
  let glAccounts: any[] = [];
  if (activePresetId) {
    try {
      glAccounts = await fetchAllGlAccountsByPreset(activePresetId);
    } catch (err) {
      console.warn('Failed to fetch paginated GL accounts by preset:', err);
    }
  }

  if (glAccounts.length === 0) {
    let query = supabase
      .from('gl_accounts')
      .select('id, gl_number, short_name, description, preset_id, company_id');

    if (activePresetId && companyId) {
      query = query.or(`preset_id.eq.${activePresetId},company_id.eq.${companyId}`);
    } else if (companyId) {
      query = query.eq('company_id', companyId);
    } else if (activePresetId) {
      query = query.eq('preset_id', activePresetId);
    }

    const { data = [] } = await query;
    glAccounts = data || [];
  }

  const findGlId = (prefixes: string[], keywords: string[], accountClass = '4') => {
    // 1. Strict prefix matching first
    for (const prefix of prefixes) {
      const match = glAccounts.find((a: any) => a.gl_number.startsWith(prefix));
      if (match) return match.id;
    }
    // 2. Keyword matching ONLY within matching account class to prevent cross-matching
    for (const kw of keywords) {
      const kwLower = kw.toLowerCase();
      const match = glAccounts.find((a: any) =>
        a.gl_number.startsWith(accountClass) &&
        ((a.short_name && a.short_name.toLowerCase().includes(kwLower)) ||
         (a.description && a.description.toLowerCase().includes(kwLower)))
      );
      if (match) return match.id;
    }
    return null;
  };

  // 413 / 493 Eredménytartalék / Jóváhagyott osztalék (4. számlaosztály)
  const gl413 = findGlId(['413', '4130', '493', '4930'], ['eredménytartalék', 'adózott eredmény'], '4');
  // 4792 / 4791 / 479 Kötelezettségek tagokkal/alapítókkal szemben (4. számlaosztály)
  const gl4791 = findGlId(['4792', '4791', '479', '4790'], ['alapítókkal szembeni', 'tagokkal szembeni', 'tagi kötelezettség', 'különféle egyéb rövid'], '4');
  // 4622 / 4624 / 4621 / 462 Levont SZJA (4. számlaosztály)
  const gl462 = findGlId(['4622', '4624', '4623', '4621', '462'], ['osztalék után levont szja', 'magánszemélytõl levont szja', 'személyi jövedelemadó'], '4');
  // 463 / 46302 Levont SZOCHO (4. számlaosztály)
  const gl463 = findGlId(['46302', '4630', '46311', '46310', '463'], ['szoc.hj', 'szociális hozzájárulási', 'költségvetési befizetési'], '4');
  // 384 Bank (3. számlaosztály)
  const gl384 = findGlId(['384', '3841', '3840'], ['elszámolási betétszámla', 'bank'], '3');

  return { gl413, gl4791, gl462, gl463, gl384 };
}

/**
 * Automatikus osztalék könyvelés a Vegyes naplóba.
 */
export async function postDividendToLedger(
  dividend: DividendRecord,
  companyId: string,
  _userId?: string
): Promise<DividendPostingResult> {
  try {
    if (!dividend || dividend.gross_amount <= 0) {
      return { success: false, message: 'Érvénytelen osztalék összeg.' };
    }

    // 1. Resolve GL Accounts
    const { gl413, gl4791, gl462, gl463 } = await resolveDividendGlAccounts(companyId);

    if (!gl413 || !gl4791) {
      return {
        success: false,
        message: 'A cég számlatükrében nem található Eredménytartalék (413/493) vagy Tagi kötelezettség (4791) főkönyvi számla. Kérjük ellenőrizze a számlatükröt a /general-ledger oldalon.'
      };
    }

    const postingDate = dividend.payout_date || dividend.declaration_date || new Date().toISOString().slice(0, 10);
    const documentDate = dividend.declaration_date || postingDate;

    // 2. Feladás tranzakcionális SECURITY DEFINER RPC-n keresztül
    const { data, error } = await supabase.rpc('post_dividend_to_gl', {
      p_company_id: companyId,
      p_dividend_id: dividend.id,
      p_gross_amount: dividend.gross_amount,
      p_szja_amount: dividend.szja_amount || 0,
      p_szocho_amount: dividend.szocho_amount || 0,
      p_member_name: dividend.member_name || 'Tag',
      p_resolution_number: dividend.resolution_number || '1',
      p_posting_date: postingDate,
      p_document_date: documentDate,
      p_gl_413_id: gl413,
      p_gl_4791_id: gl4791,
      p_gl_462_id: gl462 || null,
      p_gl_463_id: gl463 || null,
    });

    if (error) {
      return {
        success: false,
        message: `Hiba a könyvelés során: ${error.message}`
      };
    }

    const res = data as any;
    return {
      success: res?.success ?? true,
      headerId: res?.header_id,
      journalNumber: res?.journal_number ? String(res.journal_number) : undefined,
      message: res?.message || 'Osztalék sikeresen lekönyvelve a Vegyes naplóba!',
    };
  } catch (err: any) {
    console.error('Exception in postDividendToLedger:', err);
    return {
      success: false,
      message: `Hiba a könyvelés során: ${err?.message || 'Váratlan hiba történt.'}`
    };
  }
}
