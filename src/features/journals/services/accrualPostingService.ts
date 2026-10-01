import { supabase } from '@/integrations/supabase/client';

export interface CreateAccrualJournalParams {
  companyId: string;
  presetId: string;
  invoiceId: string;
  invoiceNumber: string;
  partnerId?: string | null;
  partnerName?: string | null;
  itemDescription: string;
  accrualType: 'AIE' | 'PIE';
  accrualDate: string; // ISO: YYYY-MM-DD (pl. 2026-12-31)
  reversalDate?: string | null; // ISO: YYYY-MM-DD (pl. 2027-01-01)
  accrualAmount: number;
  debitGlAccountId: string;
  debitGlNumber: string;
  creditGlAccountId: string;
  creditGlNumber: string;
  currency?: string;
  status?: 'KONYVELT' | 'KEZI_PISZKOZAT';
}

export interface ExistingAccrualInfo {
  id: string;
  invoice_id: string;
  accrual_type: string;
  accrual_date: string;
  reversal_date: string | null;
  amount: number;
  gl_debit: string;
  gl_credit: string;
  status: string | null;
  booked_journal_entry_id: string | null;
}

/**
 * Megkeresi a céghez tartozó aktív Vegyes (VE) naplót.
 */
export async function findActiveMixedJournal(companyId: string) {
  const { data, error } = await supabase
    .from('acc_journals')
    .select('id, code, name, type')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .or('type.eq.MIXED,code.eq.VE')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[accrualPostingService] Error finding mixed journal:', error);
    throw error;
  }

  // Ha nincs kifejezetten VE vagy MIXED, lekérjük az első nem-nyitó naplót
  if (!data) {
    const { data: fallback, error: fbError } = await supabase
      .from('acc_journals')
      .select('id, code, name, type')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .neq('code', 'NY')
      .limit(1)
      .maybeSingle();

    if (fbError || !fallback) {
      throw new Error('Nem található aktív könyvelési napló a céghez.');
    }
    return fallback;
  }

  return data;
}

/**
 * Lekérdezi egy számlához a már rögzített időbeli elhatárolásokat.
 */
export async function getExistingAccrualForInvoice(invoiceId: string): Promise<ExistingAccrualInfo | null> {
  const { data, error } = await supabase
    .from('accrual_entries')
    .select('*')
    .eq('invoice_id', invoiceId)
    .neq('status', 'reversed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('[accrualPostingService] Error fetching existing accrual:', error);
    return null;
  }

  return data as ExistingAccrualInfo | null;
}

/**
 * Létrehozza az időbeli elhatárolás vegyes könyvelési bizonylatát és bejegyzi az accrual_entries táblába.
 */
export async function createAccrualJournalEntry(params: CreateAccrualJournalParams): Promise<{
  headerId: string;
  accrualId: string;
}> {
  const {
    companyId,
    presetId,
    invoiceId,
    invoiceNumber,
    partnerId,
    partnerName,
    itemDescription,
    accrualType,
    accrualDate,
    reversalDate,
    accrualAmount,
    debitGlAccountId,
    debitGlNumber,
    creditGlAccountId,
    creditGlNumber,
    currency = 'HUF',
    status = 'KONYVELT',
  } = params;

  if (accrualAmount <= 0) {
    throw new Error('Az elhatárolandó összegnek nullánál nagyobbnak kell lennie.');
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Bejelentkezés szükséges a könyveléshez.');
  }

  const mixedJournal = await findActiveMixedJournal(companyId);
  const accountingYear = Number(accrualDate.substring(0, 4)) || new Date().getFullYear();

  const description = `${accrualType === 'AIE' ? 'Aktív' : 'Passzív'} időbeli elhatárolás - Bizonylatszám: ${invoiceNumber} (${itemDescription.substring(0, 80)})`;

  // 1. Beszúrás az acc_journal_headers táblába
  const headerPayload: Record<string, any> = {
    company_id: companyId,
    journal_id: mixedJournal.id,
    accounting_year: accountingYear,
    status: status,
    posting_date: accrualDate,
    document_date: accrualDate,
    document_id: invoiceNumber,
    partner_id: partnerId || null,
    description: description,
    currency: currency,
    exchange_rate: 1.0,
    created_by: user.id,
  };

  const { data: newHeader, error: headerErr } = await supabase
    .from('acc_journal_headers')
    .insert(headerPayload)
    .select('id')
    .single();

  if (headerErr) {
    console.error('[accrualPostingService] Failed to create journal header:', headerErr);
    throw headerErr;
  }

  const headerId = newHeader.id;

  // 2. Beszúrás az acc_journal_lines táblába (T és K oldal)
  const linesPayload = [
    {
      header_id: headerId,
      sequence_number: 1,
      gl_account_id: debitGlAccountId,
      dc_type: 'T',
      amount: accrualAmount,
      description: `${accrualType === 'AIE' ? 'Aktív' : 'Passzív'} időbeli elhatárolás képzése (${debitGlNumber})`,
    },
    {
      header_id: headerId,
      sequence_number: 2,
      gl_account_id: creditGlAccountId,
      dc_type: 'K',
      amount: accrualAmount,
      description: `Elhatárolás ellenszámlája (${creditGlNumber})`,
    },
  ];

  const { error: linesErr } = await supabase
    .from('acc_journal_lines')
    .insert(linesPayload);

  if (linesErr) {
    console.error('[accrualPostingService] Failed to create journal lines, rolling back header:', linesErr);
    await supabase.from('acc_journal_headers').delete().eq('id', headerId);
    throw linesErr;
  }

  // 3. Bejegyzés az accrual_entries táblába
  const accrualPayload = {
    company_id: companyId,
    preset_id: presetId,
    invoice_id: invoiceId,
    accrual_type: accrualType,
    accrual_date: accrualDate,
    reversal_date: reversalDate || null,
    amount: accrualAmount,
    gl_debit: debitGlNumber,
    gl_credit: creditGlNumber,
    status: 'booked',
    booked_journal_entry_id: headerId,
  };

  const { data: newAccrual, error: accrualErr } = await supabase
    .from('accrual_entries')
    .insert(accrualPayload)
    .select('id')
    .single();

  if (accrualErr) {
    console.warn('[accrualPostingService] Warning: failed to insert into accrual_entries (journal entry was created):', accrualErr);
    return { headerId, accrualId: '' };
  }

  return { headerId, accrualId: newAccrual.id };
}

/**
 * Törli / visszavonja a korábban rögzített elhatárolást és kapcsolódó naplótételét.
 */
export async function deleteAccrualEntry(accrualId: string, headerId?: string | null): Promise<void> {
  if (headerId) {
    // 1. Töröljük a napló sorokat és fejlécet
    await supabase.from('acc_journal_lines').delete().eq('header_id', headerId);
    await supabase.from('acc_journal_headers').delete().eq('id', headerId);
  }

  // 2. Töröljük vagy frissítjük az elhatárolási rekordot
  const { error } = await supabase
    .from('accrual_entries')
    .delete()
    .eq('id', accrualId);

  if (error) {
    console.error('[accrualPostingService] Failed to delete accrual entry:', error);
    throw error;
  }
}
