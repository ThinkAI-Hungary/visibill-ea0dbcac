import { supabase } from '@/integrations/supabase/client';
import { fetchAllGlAccountsByPreset } from '@/lib/glData';

export interface PayrollPostingSummary {
  cycleId: string;
  year: number;
  month: number;
  totalGross: number;
  totalSzocho: number;
  totalSzja: number;
  totalTb: number;
  totalDeductions: number;
  totalNet: number;
  totalCommute: number;
  journalEntryId?: string;
  journalNumber?: string;
  isBalanced: boolean;
}

/**
 * Calculates double-entry accounting lines for a given payroll cycle.
 */
export async function getPayrollPostingSummary(cycleId: string): Promise<PayrollPostingSummary | null> {
  const { data: cycle, error: cycleErr } = await supabase
    .from('accounty_payroll_cycles')
    .select('*')
    .eq('id', cycleId)
    .single();

  if (cycleErr || !cycle) {
    console.error('Error fetching payroll cycle for posting:', cycleErr);
    return null;
  }

  const { data: calcs = [], error: calcsErr } = await supabase
    .from('accounty_payroll_calculations')
    .select('*')
    .eq('cycle_id', cycleId);

  if (calcsErr) {
    console.error('Error fetching calculations for posting:', calcsErr);
    return null;
  }

  const { data: employments = [] } = await supabase
    .from('accounty_employments')
    .select('id')
    .eq('company_id', cycle.company_id);

  const employmentIds = employments.map(e => e.id);
  let cafeteriaItems: any[] = [];
  if (employmentIds.length > 0) {
    const { data: cafe } = await supabase
      .from('accounty_cafeteria')
      .select('*')
      .in('employment_id', employmentIds);
    cafeteriaItems = cafe || [];
  }

  const getHomeOffice = (empId: string) => {
    const item = cafeteriaItems.find(
      c => c.employment_id === empId && (c.sub_type === 'home_office' || c.benefit_type === 'home_office')
    );
    return item ? Number(item.amount) : 0;
  };

  const getCommute = (calc: any) => Number((calc?.metadata as any)?.travel_reimbursement || 0);

  const totalGross = calcs.reduce((s, c) => s + (c.gross_salary || 0), 0);
  const totalSzocho = calcs.reduce((s, c) => s + (c.szocho_amount || 0), 0);
  const totalSzja = calcs.reduce((s, c) => s + (c.szja_amount || 0), 0);
  const totalTb = calcs.reduce((s, c) => s + (c.tb_amount || 0), 0);
  const totalDeductions = calcs.reduce((s, c) => s + (c.total_deductions || 0), 0);
  const totalHomeOffice = calcs.reduce((s, c) => s + getHomeOffice(c.employment_id), 0);
  const totalCommute = calcs.reduce((s, c) => s + getCommute(c), 0);
  const totalNet = calcs.reduce((s, c) => s + (c.net_salary || 0), 0) + totalHomeOffice;

  const totalDebits = totalGross + totalCommute + totalSzocho;
  const totalCredits = totalSzocho + totalSzja + totalTb + totalDeductions + totalNet + totalCommute;
  const isBalanced = Math.abs(totalDebits - totalCredits) < 1;

  return {
    cycleId,
    year: cycle.year,
    month: cycle.month,
    totalGross,
    totalSzocho,
    totalSzja,
    totalTb,
    totalDeductions,
    totalNet,
    totalCommute,
    isBalanced,
  };
}

export interface PayrollGlMapping {
  activePresetId?: string;
  presetName?: string;
  gl541: string | null;
  gl551?: string | null;
  gl561: string | null;
  gl463: string | null;
  gl462: string | null;
  gl464: string | null;
  gl479: string | null;
  gl471: string | null;
}

/**
 * Resolves GL accounts for payroll posting taking into account:
 * 1. Saved custom mappings in `accounty_tax_profiles.payroll_settings.gl_mapping`.
 * 2. Company's active custom or generic chart of accounts preset (`chart_of_accounts_presets`).
 * 3. Company-specific `gl_accounts` entries.
 * 4. Multi-tier fallback matching (Exact prefix -> Short name keyword -> Broad prefix).
 */
export async function resolveCompanyGlAccounts(companyId: string): Promise<PayrollGlMapping> {
  // 1. Fetch saved payroll settings / custom GL mapping if previously saved
  const { data: taxProfile } = await supabase
    .from('accounty_tax_profiles')
    .select('payroll_settings')
    .eq('company_id', companyId)
    .maybeSingle();

  const savedMapping: Partial<PayrollGlMapping> = (taxProfile?.payroll_settings as any)?.gl_mapping || {};

  // 2. Resolve active chart of accounts preset for company
  const { data: presets } = await supabase
    .from('chart_of_accounts_presets')
    .select('id, name, company_id, is_active, type');

  let activePreset = presets?.find(p => p.company_id === companyId && p.is_active);
  if (!activePreset) {
    activePreset = presets?.find(p => p.company_id === companyId) || presets?.find(p => p.type === 'generic');
  }

  const activePresetId = activePreset?.id;

  // 3. Fetch GL accounts with pagination to prevent PostgREST 1000 row truncation
  let glAccounts: any[] = [];
  if (activePresetId) {
    try {
      glAccounts = await fetchAllGlAccountsByPreset(activePresetId);
    } catch (err) {
      console.warn('Failed to fetch paginated GL accounts by preset, falling back to direct query:', err);
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

  const findGlId = (prefixes: string[], keywords: string[], broadPrefix?: string) => {
    for (const prefix of prefixes) {
      const match = glAccounts.find((a: any) => a.gl_number.startsWith(prefix));
      if (match) return match.id;
    }

    for (const kw of keywords) {
      const kwLower = kw.toLowerCase();
      const match = glAccounts.find((a: any) =>
        (a.short_name && a.short_name.toLowerCase().includes(kwLower)) ||
        (a.description && a.description.toLowerCase().includes(kwLower))
      );
      if (match) return match.id;
    }

    if (broadPrefix) {
      const match = glAccounts.find((a: any) => a.gl_number.startsWith(broadPrefix));
      if (match) return match.id;
    }

    return null;
  };

  const isIdValid = (id: string | null | undefined) => {
    if (!id) return false;
    return glAccounts.some((a: any) => a.id === id);
  };

  const gl541 = isIdValid(savedMapping.gl541)
    ? savedMapping.gl541!
    : findGlId(['541', '5410', '5411', '540'], ['munkabér', 'bruttó bér', 'alapbér', 'bérköltség'], '54');

  const gl551 = isIdValid(savedMapping.gl551)
    ? savedMapping.gl551!
    : findGlId(['551', '5510', '5511', '550'], ['személyi jellegű egyéb', 'utazási költségtérítés', 'munkába járás', 'kiküldetés'], '55');

  const gl561 = isIdValid(savedMapping.gl561)
    ? savedMapping.gl561!
    : findGlId(['561', '5610', '5611', '560'], ['szocho', 'szociális hozzájárulási'], '56');

  const gl463 = isIdValid(savedMapping.gl463)
    ? savedMapping.gl463!
    : findGlId(['463', '4630', '4631'], ['szocho kötelezettség', 'szocho adó'], '463');

  const gl462 = isIdValid(savedMapping.gl462)
    ? savedMapping.gl462!
    : findGlId(['462', '4620', '4621'], ['szja kötelezettség', 'szja', 'személyi jövedelemadó'], '462');

  const gl464 = isIdValid(savedMapping.gl464)
    ? savedMapping.gl464!
    : findGlId(['464', '4640', '4641'], ['tb kötelezettség', 'társadalombiztosítás', 'tb járulék'], '464');

  const gl479 = isIdValid(savedMapping.gl479)
    ? savedMapping.gl479!
    : findGlId(['479', '4790', '4791'], ['letiltás', 'előleg', 'bérből levont'], '47');

  const gl471 = isIdValid(savedMapping.gl471)
    ? savedMapping.gl471!
    : findGlId(['4711', '4710', '471'], ['nettó bér', 'munkabér kötelezettség', 'kifizetendő bér'], '471');

  return {
    activePresetId,
    presetName: activePreset?.name || 'Alapértelmezett Számlatükör',
    gl541,
    gl551,
    gl561,
    gl463,
    gl462,
    gl464,
    gl479,
    gl471,
  };
}

/**
 * Persists customized payroll GL mapping to company tax profile settings
 */
export async function saveCompanyPayrollGlMapping(companyId: string, mapping: PayrollGlMapping): Promise<void> {
  const { data: taxProfile } = await supabase
    .from('accounty_tax_profiles')
    .select('id, payroll_settings')
    .eq('company_id', companyId)
    .maybeSingle();

  if (!taxProfile) return;

  const currentSettings = (taxProfile.payroll_settings as any) || {};
  const updatedSettings = {
    ...currentSettings,
    gl_mapping: {
      gl541: mapping.gl541,
      gl551: mapping.gl551,
      gl561: mapping.gl561,
      gl463: mapping.gl463,
      gl462: mapping.gl462,
      gl464: mapping.gl464,
      gl479: mapping.gl479,
      gl471: mapping.gl471,
    },
  };

  await supabase
    .from('accounty_tax_profiles')
    .update({ payroll_settings: updatedSettings })
    .eq('id', taxProfile.id);
}

/**
 * Posts payroll cycle summary automatically to the General Ledger (acc_journal_headers & acc_journal_lines).
 */
export async function postPayrollCycleToLedger(
  cycleId: string,
  companyId: string,
  userId: string,
  customGlMapping?: Partial<PayrollGlMapping>
): Promise<{ success: boolean; headerId?: string; journalNumber?: string; message: string }> {
  try {
    const summary = await getPayrollPostingSummary(cycleId);
    if (!summary || summary.totalGross === 0) {
      return { success: false, message: 'Nincsenek lekönyvelhető bérszámfejtési adatok a ciklusban.' };
    }

    // Double check KIVA status to guarantee SZOCHO lines are never posted for KIVA companies
    const { data: taxProfile } = await supabase
      .from('accounty_tax_profiles')
      .select('is_kiva')
      .eq('company_id', companyId)
      .maybeSingle();

    if (taxProfile?.is_kiva) {
      summary.totalSzocho = 0;
    }

    // 1. Find VE (Vegyes) journal for company
    const { data: journals = [] } = await supabase
      .from('acc_journals')
      .select('id, code, name')
      .eq('company_id', companyId);

    let veJournal = journals.find((j: any) => j.code === 'VE' || j.code === 'BER');
    if (!veJournal && journals.length > 0) {
      veJournal = journals.find((j: any) => j.code !== 'NY') || journals[0];
    }

    if (!veJournal) {
      return { success: false, message: 'Nem található könyvelési napló (Vegyes napló) a cégnél. Kérjük ellenőrizze a /journals oldalon.' };
    }

    // 2. Fetch & Resolve GL Accounts for Company Active Chart of Accounts Preset (merged with custom user selections)
    const resolvedCoa = await resolveCompanyGlAccounts(companyId);
    const coaMapping: PayrollGlMapping = {
      ...resolvedCoa,
      ...(customGlMapping || {}),
    };

    if (!coaMapping.gl541 || !coaMapping.gl471) {
      return {
        success: false,
        message: `A cég aktív számlatükrében (${coaMapping.presetName}) nem található Bérköltség (541) vagy Nettó bér (471) főkönyvi számla. Kérjük ellenőrizze a főkönyvi számlákat a /general-ledger oldalon.`
      };
    }

    const { gl541, gl551, gl561, gl463, gl462, gl464, gl479, gl471 } = coaMapping;

    const lastDayOfMonth = new Date(summary.year, summary.month, 0).toISOString().slice(0, 10);
    const documentId = `BER-${summary.year}-${String(summary.month).padStart(2, '0')}`;
    const description = `Bérfeladás könyvelése — ${summary.year}. ${String(summary.month).padStart(2, '0')}. hó`;

    // 3. Create Header in acc_journal_headers
    const headerData = {
      company_id: companyId,
      journal_id: veJournal.id,
      accounting_year: summary.year,
      status: 'KONYVELT',
      posting_date: lastDayOfMonth,
      document_date: lastDayOfMonth,
      document_id: documentId,
      description,
      justification: 'Automatikus bérfeladás lezárt bérciklusból',
      created_by: userId,
      posted_by: userId,
      posted_at: new Date().toISOString(),
    };

    const { data: newHeader, error: headerErr } = await supabase
      .from('acc_journal_headers')
      .insert(headerData)
      .select('id')
      .single();

    if (headerErr || !newHeader) {
      console.error('Error inserting payroll journal header:', headerErr);
      return { success: false, message: `Bizonylat fejléc hiba: ${headerErr?.message}` };
    }

    // 4. Build Journal Lines (Double-Entry: T = K)
    const linesToInsert: any[] = [];
    let seq = 1;

    // Line 1: T 541 Bérköltség (Bruttó)
    linesToInsert.push({
      header_id: newHeader.id,
      sequence_number: seq++,
      gl_account_id: gl541,
      dc_type: 'T',
      amount: summary.totalGross,
      description: 'Munkabér költség (bruttó bér)',
    });

    // Line: T 551 Munkába járás utazási költségtérítés (ha van)
    if (summary.totalCommute && summary.totalCommute > 0) {
      linesToInsert.push({
        header_id: newHeader.id,
        sequence_number: seq++,
        gl_account_id: gl551 || gl541,
        dc_type: 'T',
        amount: summary.totalCommute,
        description: 'Munkába járás utazási költségtérítés (39/2010. Korm. rend.)',
      });
    }

    // Line 2: T 561 SZOCHO költség
    if (summary.totalSzocho > 0) {
      linesToInsert.push({
        header_id: newHeader.id,
        sequence_number: seq++,
        gl_account_id: gl561,
        dc_type: 'T',
        amount: summary.totalSzocho,
        description: 'Szociális hozzájárulási adó költség',
      });
    }

    // Line 3: K 463 SZOCHO kötelezettség
    if (summary.totalSzocho > 0) {
      linesToInsert.push({
        header_id: newHeader.id,
        sequence_number: seq++,
        gl_account_id: gl463,
        dc_type: 'K',
        amount: summary.totalSzocho,
        description: 'SZOCHO fizetési kötelezettség',
      });
    }

    // Line 4: K 462 SZJA kötelezettség
    if (summary.totalSzja > 0) {
      linesToInsert.push({
        header_id: newHeader.id,
        sequence_number: seq++,
        gl_account_id: gl462,
        dc_type: 'K',
        amount: summary.totalSzja,
        description: 'Levont SZJA kötelezettség',
      });
    }

    // Line 5: K 464 TB kötelezettség
    if (summary.totalTb > 0) {
      linesToInsert.push({
        header_id: newHeader.id,
        sequence_number: seq++,
        gl_account_id: gl464,
        dc_type: 'K',
        amount: summary.totalTb,
        description: 'Levont TB járulék kötelezettség',
      });
    }

    // Line 6: K 479 Letiltások / Egyéb
    if (summary.totalDeductions > 0) {
      linesToInsert.push({
        header_id: newHeader.id,
        sequence_number: seq++,
        gl_account_id: gl479,
        dc_type: 'K',
        amount: summary.totalDeductions,
        description: 'Bérből levont letiltások és előlegek',
      });
    }

    // Line 7: K 471 Nettó bér kötelezettség (kifizetendő bér + adómentes munkába járás)
    const calculatedNet = summary.totalGross - summary.totalSzja - summary.totalTb - summary.totalDeductions + (summary.totalCommute || 0);
    if (calculatedNet > 0) {
      linesToInsert.push({
        header_id: newHeader.id,
        sequence_number: seq++,
        gl_account_id: gl471,
        dc_type: 'K',
        amount: calculatedNet,
        description: 'Kifizetendő nettó munkabér és térítés kötelezettség',
      });
    }

    const { error: linesErr } = await supabase
      .from('acc_journal_lines')
      .insert(linesToInsert);

    if (linesErr) {
      console.error('Error inserting payroll journal lines:', linesErr);
      return { success: false, message: `Bizonylat sorok hiba: ${linesErr.message}` };
    }

    // 5. Try calling RPC acc_post_journal_entry if available
    try {
      await supabase.rpc('acc_post_journal_entry', { p_header_id: newHeader.id, p_user_id: userId });
    } catch {
      // Ignored if RPC is not present, status is already KONYVELT
    }

    // 6. Update cycle notes with journal reference
    await supabase.from('accounty_payroll_cycles').update({
      status: 'closed',
      current_step: 8,
      notes: `Bérfeladás lekönyvelve: ${documentId} (Bizonylat azonosító: ${newHeader.id})`
    }).eq('id', cycleId);

    return {
      success: true,
      headerId: newHeader.id,
      journalNumber: documentId,
      message: `Bérfeladás sikeresen lekönyvelve a Vegyes naplóba (${documentId})!`
    };

  } catch (err: any) {
    console.error('Exception in postPayrollCycleToLedger:', err);
    return { success: false, message: err?.message || 'Váratlan hiba történt a bérfeladás során.' };
  }
}
