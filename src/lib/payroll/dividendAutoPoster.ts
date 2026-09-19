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
  userId?: string
): Promise<DividendPostingResult> {
  try {
    if (!dividend || dividend.gross_amount <= 0) {
      return { success: false, message: 'Érvénytelen osztalék összeg.' };
    }

    // 1. Find VE (Vegyes) journal for company
    const { data: journals = [] } = await supabase
      .from('acc_journals')
      .select('id, code, name')
      .eq('company_id', companyId);

    let veJournal = journals.find((j: any) => j.code === 'VE' || j.code === 'BÉR');
    if (!veJournal && journals.length > 0) {
      veJournal = journals.find((j: any) => j.code !== 'NY') || journals[0];
    }

    if (!veJournal) {
      return { success: false, message: 'Nem található Vegyes könyvelési napló (VE) a cégnél. Kérjük hozzon létre egyet a /journals oldalon.' };
    }

    // 2. Resolve GL Accounts
    const { gl413, gl4791, gl462, gl463 } = await resolveDividendGlAccounts(companyId);

    if (!gl413 || !gl4791) {
      return {
        success: false,
        message: 'A cég számlatükrében nem található Eredménytartalék (413/493) vagy Tagi kötelezettség (4791) főkönyvi számla. Kérjük ellenőrizze a számlatükröt a /general-ledger oldalon.'
      };
    }

    const postingDate = dividend.payout_date || dividend.declaration_date || new Date().toISOString().slice(0, 10);
    const documentDate = dividend.declaration_date || postingDate;
    const year = parseInt(postingDate.slice(0, 4), 10) || new Date().getFullYear();
    const cleanResolution = (dividend.resolution_number || '1').replace(/[^a-zA-Z0-9-]/g, '_');
    const documentId = `OSZT-${cleanResolution}-${year}`;
    const description = `Osztalék előírása és levonásai — ${dividend.member_name} (${dividend.resolution_number || 'Határozat'})`;

    // Check if already posted under this document_id to avoid duplicate headers
    const { data: existingHeaders } = await supabase
      .from('acc_journal_headers')
      .select('id')
      .eq('company_id', companyId)
      .eq('document_id', documentId)
      .maybeSingle();

    let headerId = existingHeaders?.id;

    if (!headerId) {
      // 3. Create Header in TERVEZET status first so lines can be inserted
      const headerData = {
        company_id: companyId,
        journal_id: veJournal.id,
        accounting_year: year,
        status: 'KEZI_PISZKOZAT',
        posting_date: postingDate,
        document_date: documentDate,
        document_id: documentId,
        description,
        justification: `Osztalék elszámolás: ${dividend.member_name}, Bruttó: ${dividend.gross_amount.toLocaleString('hu-HU')} Ft`,
        created_by: userId || null,
        posted_by: userId || null,
        posted_at: new Date().toISOString(),
      };

      const { data: newHeader, error: headerErr } = await supabase
        .from('acc_journal_headers')
        .insert(headerData)
        .select('id')
        .single();

      if (headerErr || !newHeader) {
        console.error('Error creating dividend journal header:', headerErr);
        return { success: false, message: `Bizonylat fejléc hiba: ${headerErr?.message}` };
      }
      headerId = newHeader.id;
    } else {
      // If re-posting an existing entry, unpost it first to allow line modifications
      try {
        await supabase.rpc('acc_unpost_journal_entry', {
          p_header_id: headerId,
          p_user_id: userId,
          p_reason: 'Osztalék újrakönyvelése',
        });
      } catch (e) {
        console.warn('Unpost attempt on existing header:', e);
      }
      // Clean existing lines if re-posting
      await supabase.from('acc_journal_lines').delete().eq('header_id', headerId);
    }

    // 4. Build Double-Entry Journal Lines
    const linesToInsert: any[] = [];
    let seq = 1;

    // Line 1: T 413/493 Bruttó osztalék előírása (Eredménytartalék terhére)
    linesToInsert.push({
      header_id: headerId,
      sequence_number: seq++,
      gl_account_id: gl413,
      dc_type: 'T',
      amount: dividend.gross_amount,
      description: `Bruttó jóváhagyott osztalék (${dividend.member_name})`,
    });

    // Line 2: K 4791/4792 Taggal szembeni bruttó kötelezettség
    linesToInsert.push({
      header_id: headerId,
      sequence_number: seq++,
      gl_account_id: gl4791,
      dc_type: 'K',
      amount: dividend.gross_amount,
      description: `Taggal szembeni kötelezettség előírása (${dividend.member_name})`,
    });

    // Line 3 & 4: Levont SZJA (15%)
    if (dividend.szja_amount > 0 && gl462) {
      linesToInsert.push({
        header_id: headerId,
        sequence_number: seq++,
        gl_account_id: gl4791,
        dc_type: 'T',
        amount: dividend.szja_amount,
        description: `Levont 15% SZJA elszámolása (${dividend.member_name})`,
      });

      linesToInsert.push({
        header_id: headerId,
        sequence_number: seq++,
        gl_account_id: gl462,
        dc_type: 'K',
        amount: dividend.szja_amount,
        description: `Levont 15% SZJA fizetési kötelezettség`,
      });
    }

    // Line 5 & 6: Levont SZOCHO (13%)
    if (dividend.szocho_amount > 0 && gl463) {
      linesToInsert.push({
        header_id: headerId,
        sequence_number: seq++,
        gl_account_id: gl4791,
        dc_type: 'T',
        amount: dividend.szocho_amount,
        description: `Levont 13% SZOCHO elszámolása (${dividend.member_name})`,
      });

      linesToInsert.push({
        header_id: headerId,
        sequence_number: seq++,
        gl_account_id: gl463,
        dc_type: 'K',
        amount: dividend.szocho_amount,
        description: `Levont 13% SZOCHO fizetési kötelezettség`,
      });
    }

    const { error: linesErr } = await supabase
      .from('acc_journal_lines')
      .insert(linesToInsert);

    if (linesErr) {
      console.error('Error inserting dividend journal lines:', linesErr);
      return { success: false, message: `Bizonylat sorok hiba: ${linesErr.message}` };
    }

    // 5. Post the entry
    let postSuccess = false;
    if (userId) {
      try {
        const { error: postErr } = await supabase.rpc('acc_post_journal_entry', {
          p_header_id: headerId,
          p_user_id: userId,
        });
        if (!postErr) postSuccess = true;
      } catch (err) {
        console.warn('acc_post_journal_entry failed, trying direct status update:', err);
      }
    }
    if (!postSuccess) {
      await supabase.from('acc_journal_headers').update({ status: 'KONYVELT' }).eq('id', headerId);
    }

    // 6. Update dividend record with journal_entry_id & status
    await supabase.from('accounty_dividends').update({
      status: 'posted',
      journal_entry_id: headerId,
    }).eq('id', dividend.id);

    return {
      success: true,
      headerId,
      journalNumber: documentId,
      message: `Osztalék sikeresen lekönyvelve a Vegyes naplóba (${documentId})! Megtekinthető a Főkönyvben és a Naplókban.`
    };
  } catch (err: any) {
    console.error('Exception in postDividendToLedger:', err);
    return {
      success: false,
      message: `Hiba a könyvelés során: ${err?.message || 'Váratlan hiba történt.'}`
    };
  }
}
