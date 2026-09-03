import { supabase } from '@/integrations/supabase/client';

/**
 * Robust client-side fallback draft generator for accounting journals.
 * Used when the PostgreSQL RPC `acc_generate_drafts_from_ledger` is unavailable or errors out.
 * 
 * Generates 3-legged journal drafts (Net + VAT = Gross) for invoices and 2-legged drafts for bank transactions.
 */
export async function generateDraftsFallback(
  companyId: string,
  activePresetId: string
): Promise<number> {
  // 1. Delete existing system suggestions
  await supabase
    .from('acc_journal_headers')
    .delete()
    .eq('company_id', companyId)
    .eq('status', 'GEPI_JAVASLAT');

  // 2. Ensure default journals exist
  await supabase.rpc('acc_seed_default_journals', { p_company_id: companyId });

  // 3. Fetch categorized items
  const { data: items, error: itemsErr } = await supabase.rpc('get_gl_categorized_items', {
    p_company_id: companyId,
    p_preset_id: activePresetId
  });
  if (itemsErr) throw itemsErr;
  if (!items || items.length === 0) return 0;

  // 4. Fetch GL Accounts & Journals
  const { data: glAccounts } = await supabase
    .from('gl_accounts')
    .select('id, gl_number')
    .or(`preset_id.eq.${activePresetId},company_id.eq.${companyId}`);

  const { data: journals } = await supabase
    .from('acc_journals')
    .select('id, code, type, currency')
    .eq('company_id', companyId);

  const glCustId = glAccounts?.find(g => g.gl_number.startsWith('311'))?.id || glAccounts?.[0]?.id;
  const glSuppId = glAccounts?.find(g => g.gl_number.startsWith('4541'))?.id || glAccounts?.find(g => g.gl_number.startsWith('454'))?.id || glCustId;
  const glVatDedId = glAccounts?.find(g => g.gl_number.startsWith('466'))?.id;
  const glVatPayId = glAccounts?.find(g => g.gl_number.startsWith('467'))?.id;

  if (!glCustId || !glSuppId) return 0;

  const validGlIds = new Set((glAccounts || []).map(g => g.id));

  // Filter valid mapped items (MUST have a valid gl_account_id in gl_accounts, NOT nil UUID)
  const validItems = items.filter(
    (item: any) =>
      item.gl_account_id &&
      item.gl_account_id !== '00000000-0000-0000-0000-000000000000' &&
      validGlIds.has(item.gl_account_id) &&
      item.amount &&
      Math.abs(item.amount) > 0
  );

  // Batch-fetch item VAT details in parallel to eliminate N+1 network waterfall
  const invoiceItemIds = validItems.filter((i: any) => i.source_table === 'invoice_items').map((i: any) => i.item_id);
  const navItemIds = validItems.filter((i: any) => i.source_table === 'nav_invoice_items').map((i: any) => i.item_id);

  const [invRes, navRes] = await Promise.all([
    invoiceItemIds.length > 0
      ? supabase.from('invoice_items').select('id, vat_amount, vat_rate').in('id', invoiceItemIds)
      : Promise.resolve({ data: [] }),
    navItemIds.length > 0
      ? supabase.from('nav_invoice_items').select('id, vat_amount, vat_rate').in('id', navItemIds)
      : Promise.resolve({ data: [] })
  ]);

  const vatDetailsMap = new Map<string, { vat_amount: number; vat_rate: string }>();
  invRes.data?.forEach((i: any) => {
    vatDetailsMap.set(i.id, { vat_amount: Number(i.vat_amount) || 0, vat_rate: i.vat_rate || '' });
  });
  navRes.data?.forEach((i: any) => {
    vatDetailsMap.set(i.id, { vat_amount: Number(i.vat_amount) || 0, vat_rate: i.vat_rate || '' });
  });

  const effectiveVatDedId = glVatDedId || glAccounts?.find(g => g.gl_number.startsWith('466'))?.id;
  const effectiveVatPayId = glVatPayId || glAccounts?.find(g => g.gl_number.startsWith('467'))?.id;

  // Fetch MNB daily exchange rates for currency conversions
  const { data: dbRates } = await supabase
    .from('daily_exchange_rates')
    .select('currency, rate_date, rate')
    .order('rate_date', { ascending: false });

  const getDailyRate = (curr: string, d: string): number => {
    if (!curr || curr === 'HUF') return 1;
    const match = dbRates?.find(r => r.currency === curr && r.rate_date <= d);
    if (match?.rate) return Number(match.rate);
    const fallback = dbRates?.find(r => r.currency === curr);
    return fallback?.rate ? Number(fallback.rate) : 1;
  };

  let createdCount = 0;

  for (const item of validItems) {
    const itemDate = item.item_date ? item.item_date.substring(0, 10) : new Date().toISOString().substring(0, 10);
    const year = Number(itemDate.substring(0, 4)) || new Date().getFullYear();
    const currency = item.original_currency || 'HUF';
    const isForeign = currency !== 'HUF';
    const foreignAmount = isForeign ? Math.round(Math.abs(item.original_amount ?? item.amount) * 100) / 100 : null;
    const exchangeRate = isForeign ? getDailyRate(currency, itemDate) : 1;
    const amount = (isForeign && foreignAmount) 
      ? Math.round(foreignAmount * exchangeRate * 100) / 100 
      : Math.round(Math.abs(item.amount) * 100) / 100;

    let journalId = journals?.find(j => j.code === 'VE')?.id || journals?.[0]?.id;
    let source = 'AUTO_RENDSZER';
    let docId = `MISC-${item.item_id.substring(0, 8).toUpperCase()}`;

    if (item.source_table === 'transactions') {
      source = 'AUTO_BANK';
      docId = `TR-${item.item_id.substring(0, 8).toUpperCase()}`;
      journalId = journals?.find(j => j.type === 'BANK' && j.currency === currency)?.id || journals?.find(j => j.code === 'B1')?.id || journalId;
    } else if (['invoice_items', 'nav_invoice_items'].includes(item.source_table)) {
      source = 'AUTO_SZAMLA';
      docId = `INV-${item.item_id.substring(0, 8).toUpperCase()}`;
      if (item.amount >= 0) {
        journalId = journals?.find(j => j.code === 'V')?.id || journalId;
      } else {
        journalId = journals?.find(j => j.code === 'SZ')?.id || journalId;
      }
    }

    if (item.source_table === 'transactions') {
      const glBankId = glAccounts?.find(g => g.gl_number.startsWith('384'))?.id || glAccounts?.[0]?.id;
      if (!glBankId || !validGlIds.has(glBankId) || !validGlIds.has(item.gl_account_id)) {
        continue;
      }

      const { data: header, error: hErr } = await supabase
        .from('acc_journal_headers')
        .insert({
          company_id: companyId,
          journal_id: journalId,
          accounting_year: year,
          status: 'GEPI_JAVASLAT',
          entry_type: 'NORMAL',
          source: source,
          posting_date: itemDate,
          document_date: itemDate,
          document_id: docId,
          description: item.description || 'Automatikus bizonylat javaslat',
          currency: currency,
          exchange_rate: exchangeRate,
          exchange_rate_date: itemDate,
          import_key: item.item_id.toString()
        })
        .select('id')
        .single();

      if (hErr) continue;

      let line1: any;
      let line2: any;
      if (item.amount >= 0) {
        line1 = { header_id: header.id, sequence_number: 1, gl_account_id: glBankId, dc_type: 'T', amount, foreign_amount: foreignAmount, description: item.description };
        line2 = { header_id: header.id, sequence_number: 2, gl_account_id: item.gl_account_id, dc_type: 'K', amount, foreign_amount: foreignAmount, description: item.description };
      } else {
        line1 = { header_id: header.id, sequence_number: 1, gl_account_id: item.gl_account_id, dc_type: 'T', amount, foreign_amount: foreignAmount, description: item.description };
        line2 = { header_id: header.id, sequence_number: 2, gl_account_id: glBankId, dc_type: 'K', amount, foreign_amount: foreignAmount, description: item.description };
      }

      await supabase.from('acc_journal_lines').insert([line1, line2]);
      createdCount++;
    } else {
      // Invoices: 3-legged double entry
      if (item.amount >= 0) {
        if (!glCustId || !validGlIds.has(glCustId) || !validGlIds.has(item.gl_account_id)) {
          continue;
        }
      } else {
        if (!glSuppId || !validGlIds.has(glSuppId) || !validGlIds.has(item.gl_account_id)) {
          continue;
        }
      }

      // Read item-level VAT from fast in-memory map
      const vatDetail = vatDetailsMap.get(item.item_id);
      const itemVat = vatDetail?.vat_amount || 0;
      const itemVatRate = vatDetail?.vat_rate || '';

      const isOutbound = item.amount >= 0;
      const targetVatAccountId = isOutbound ? effectiveVatPayId : effectiveVatDedId;
      const hufNet = amount;
      const foreignNet = foreignAmount;
      let hufVat = 0;
      let foreignVat: number | null = null;

      if (itemVat > 0 && targetVatAccountId) {
        if (currency !== 'HUF' && exchangeRate !== 1) {
          foreignVat = Math.round(itemVat * 100) / 100;
          hufVat = Math.round(foreignVat * exchangeRate * 100) / 100;
        } else {
          hufVat = Math.round(itemVat * 100) / 100;
        }
      }

      const hufGross = Math.round((hufNet + hufVat) * 100) / 100;
      const foreignGross = foreignNet !== null ? Math.round(((foreignNet || 0) + (foreignVat || 0)) * 100) / 100 : null;

      const { data: header, error: hErr } = await supabase
        .from('acc_journal_headers')
        .insert({
          company_id: companyId,
          journal_id: journalId,
          accounting_year: year,
          status: 'GEPI_JAVASLAT',
          entry_type: 'NORMAL',
          source: source,
          posting_date: itemDate,
          document_date: itemDate,
          document_id: docId,
          description: item.description || 'Automatikus bizonylat javaslat',
          currency: currency,
          exchange_rate: exchangeRate,
          exchange_rate_date: itemDate,
          import_key: item.item_id.toString()
        })
        .select('id')
        .single();

      if (hErr) continue;

      if (isOutbound) {
        // Outbound: Line 1 (T Vevő 311 Gross), Line 2 (K Árbevétel Net ALAP), Line 3 (K ÁFA 467 AFA)
        await supabase.from('acc_journal_lines').insert({
          header_id: header.id,
          sequence_number: 1,
          gl_account_id: glCustId,
          dc_type: 'T',
          amount: hufGross,
          foreign_amount: foreignGross,
          vat_role: 'NONE',
          description: item.description
        });

        const { data: baseLine } = await supabase
          .from('acc_journal_lines')
          .insert({
            header_id: header.id,
            sequence_number: 2,
            gl_account_id: item.gl_account_id,
            dc_type: 'K',
            amount: hufNet,
            foreign_amount: foreignNet,
            vat_code: itemVatRate.substring(0, 16) || null,
            vat_role: 'ALAP',
            description: item.description
          })
          .select('id')
          .single();

        if (hufVat > 0 && effectiveVatPayId && baseLine) {
          await supabase.from('acc_journal_lines').insert({
            header_id: header.id,
            sequence_number: 3,
            gl_account_id: effectiveVatPayId,
            dc_type: 'K',
            amount: hufVat,
            foreign_amount: foreignVat,
            vat_code: itemVatRate.substring(0, 16) || null,
            vat_role: 'AFA',
            parent_line_id: baseLine.id,
            description: 'Fizetendő ÁFA'
          });
        }
      } else {
        // Inbound: Line 1 (T Költség Net ALAP), Line 2 (T ÁFA 466 AFA), Line 3 (K Szállító 4541 Gross)
        const { data: baseLine } = await supabase
          .from('acc_journal_lines')
          .insert({
            header_id: header.id,
            sequence_number: 1,
            gl_account_id: item.gl_account_id,
            dc_type: 'T',
            amount: hufNet,
            foreign_amount: foreignNet,
            vat_code: itemVatRate.substring(0, 16) || null,
            vat_role: 'ALAP',
            description: item.description
          })
          .select('id')
          .single();

        if (hufVat > 0 && effectiveVatDedId && baseLine) {
          await supabase.from('acc_journal_lines').insert([
            {
              header_id: header.id,
              sequence_number: 2,
              gl_account_id: effectiveVatDedId,
              dc_type: 'T',
              amount: hufVat,
              foreign_amount: foreignVat,
              vat_code: itemVatRate.substring(0, 16) || null,
              vat_role: 'AFA',
              parent_line_id: baseLine.id,
              description: 'Levonható ÁFA'
            },
            {
              header_id: header.id,
              sequence_number: 3,
              gl_account_id: glSuppId,
              dc_type: 'K',
              amount: hufGross,
              foreign_amount: foreignGross,
              vat_role: 'NONE',
              description: item.description
            }
          ]);
        } else {
          await supabase.from('acc_journal_lines').insert({
            header_id: header.id,
            sequence_number: 2,
            gl_account_id: glSuppId,
            dc_type: 'K',
            amount: hufGross,
            foreign_amount: foreignGross,
            vat_role: 'NONE',
            description: item.description
          });
        }
      }

      createdCount++;
    }
  }

  return createdCount;
}
