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
    .select('id, code, name, type, connected_gl_account, currency')
    .eq('company_id', companyId);

  // Fakov GL Account Resolution:
  // Suppliers: 4541 (Belföldi), 4542 (Külföldi), 4543 (Fordított ÁFA / FAD)
  // Customers: 3111 (Belföldi), 3112 (Külföldi), 3113 (Fordított ÁFA / FAD)
  // VAT: 466 (Levonható), 4668 (Arányosítandó / nem levonható), 467 (Fizetendő)
  const glSupp1Id = glAccounts?.find(g => g.gl_number === '4541')?.id || glAccounts?.find(g => g.gl_number.startsWith('454'))?.id;
  const glSupp2Id = glAccounts?.find(g => g.gl_number === '4542')?.id || glSupp1Id;
  const glSupp3Id = glAccounts?.find(g => g.gl_number === '4543')?.id || glSupp1Id;
  const glSuppId = glSupp1Id || glAccounts?.[0]?.id;

  const glCust1Id = glAccounts?.find(g => g.gl_number === '3111')?.id || glAccounts?.find(g => g.gl_number.startsWith('311'))?.id;
  const glCust2Id = glAccounts?.find(g => g.gl_number === '3112')?.id || glCust1Id;
  const glCust3Id = glAccounts?.find(g => g.gl_number === '3113')?.id || glCust1Id;
  const glCustId = glCust1Id || glAccounts?.[0]?.id;

  const glVatDedId = glAccounts?.find(g => g.gl_number === '4661')?.id || glAccounts?.find(g => g.gl_number === '466')?.id;
  const glVatProRataId = glAccounts?.find(g => g.gl_number === '4668')?.id;
  const glVatPayId = glAccounts?.find(g => g.gl_number === '4671')?.id || glAccounts?.find(g => g.gl_number === '467')?.id;

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

  // Batch-fetch item VAT details & parent invoice metadata (for pro-rata VAT & continuous service date & partner routing)
  const invoiceItemIds = validItems.filter((i: any) => i.source_table === 'invoice_items').map((i: any) => i.item_id);
  const navItemIds = validItems.filter((i: any) => i.source_table === 'nav_invoice_items').map((i: any) => i.item_id);

  const [invRes, navRes] = await Promise.all([
    invoiceItemIds.length > 0
      ? supabase.from('invoice_items').select('id, invoice_id, vat_amount, vat_rate, deductible_percentage').in('id', invoiceItemIds)
      : Promise.resolve({ data: [] }),
    navItemIds.length > 0
      ? supabase.from('nav_invoice_items').select('id, invoice_id, vat_amount, vat_rate, deductible_percentage').in('id', navItemIds)
      : Promise.resolve({ data: [] })
  ]);

  const parentInvIds = Array.from(new Set([
    ...(invRes.data || []).map((i: any) => i.invoice_id).filter(Boolean),
  ]));
  const parentNavIds = Array.from(new Set([
    ...(navRes.data || []).map((i: any) => i.invoice_id).filter(Boolean)
  ]));

  const [parentInvRes, parentNavRes] = await Promise.all([
    parentInvIds.length > 0
      ? supabase.from('invoices').select('id, service_period_end, is_continuous, partner_tax_number, currency').in('id', parentInvIds)
      : Promise.resolve({ data: [] }),
    parentNavIds.length > 0
      ? supabase.from('nav_invoices').select('id, service_period_end, is_continuous, seller_tax_number, buyer_tax_number, currency').in('id', parentNavIds)
      : Promise.resolve({ data: [] })
  ]);

  const parentInvMap = new Map<string, any>();
  const parentNavMap = new Map<string, any>();
  parentInvRes.data?.forEach((inv: any) => parentInvMap.set(inv.id, inv));
  parentNavRes.data?.forEach((inv: any) => parentNavMap.set(inv.id, inv));

  const vatDetailsMap = new Map<string, { 
    vat_amount: number; 
    vat_rate: string; 
    deductible_percentage: number;
    service_period_end: string | null;
    is_continuous: boolean;
    partner_tax_number: string | null;
    currency: string | null;
  }>();

  invRes.data?.forEach((i: any) => {
    const parent = parentInvMap.get(i.invoice_id);
    vatDetailsMap.set(i.id, {
      vat_amount: Number(i.vat_amount) || 0,
      vat_rate: i.vat_rate || '',
      deductible_percentage: i.deductible_percentage !== null && i.deductible_percentage !== undefined ? Number(i.deductible_percentage) : 100,
      service_period_end: parent?.service_period_end || null,
      is_continuous: !!parent?.is_continuous,
      partner_tax_number: parent?.partner_tax_number || null,
      currency: parent?.currency || null,
    });
  });

  navRes.data?.forEach((i: any) => {
    const parent = parentNavMap.get(i.invoice_id);
    vatDetailsMap.set(i.id, {
      vat_amount: Number(i.vat_amount) || 0,
      vat_rate: i.vat_rate || '',
      deductible_percentage: i.deductible_percentage !== null && i.deductible_percentage !== undefined ? Number(i.deductible_percentage) : 100,
      service_period_end: parent?.service_period_end || null,
      is_continuous: !!parent?.is_continuous,
      partner_tax_number: parent?.seller_tax_number || parent?.buyer_tax_number || null,
      currency: parent?.currency || null,
    });
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

      // Match specific BANK journal by keyword if multiple bank journals exist for this currency
      const descLower = (item.description || '').toLowerCase();
      const bankKeywords = ['otp', 'kh', 'k&h', 'erste', 'revolut', 'cib', 'raiffeisen', 'mbh', 'unicredit', 'binx', 'wise', 'oberbank', 'paypal'];
      const specificJournal = journals?.find(j => {
        if (j.type !== 'BANK' || j.currency !== currency) return false;
        const nameLower = (j.name || '').toLowerCase();
        const codeLower = (j.code || '').toLowerCase();
        return bankKeywords.some(kw => 
          (descLower.includes(kw) || (kw === 'kh' && descLower.includes('k&h'))) && 
          (nameLower.includes(kw) || codeLower.includes(kw) || (kw === 'kh' && nameLower.includes('k&h')))
        );
      });

      journalId = specificJournal?.id
               || journals?.find(j => j.type === 'BANK' && j.currency === currency && (currency === 'HUF' ? j.code === 'B1' : (currency === 'EUR' ? j.code === 'B2' : true)))?.id
               || journals?.find(j => j.type === 'BANK' && j.currency === currency)?.id
               || journals?.find(j => j.code === 'B1')?.id
               || journalId;
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
      const selectedJournal = journals?.find(j => j.id === journalId);
      let glBankId: string | undefined;
      if (selectedJournal?.connected_gl_account) {
        glBankId = glAccounts?.find(g => g.gl_number === selectedJournal.connected_gl_account)?.id;
      }
      if (!glBankId) {
        if (currency === 'HUF') {
          glBankId = glAccounts?.find(g => g.gl_number.startsWith('384') && g.gl_number !== '384')?.id
                  || glAccounts?.find(g => g.gl_number.startsWith('384'))?.id;
        } else {
          glBankId = glAccounts?.find(g => g.gl_number.startsWith('386') && g.gl_number !== '386')?.id
                  || glAccounts?.find(g => g.gl_number.startsWith('386'))?.id;
        }
      }
      if (!glBankId) {
        glBankId = glAccounts?.[0]?.id;
      }

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
      const vatDetail = vatDetailsMap.get(item.item_id);
      const itemVat = vatDetail?.vat_amount || 0;
      const itemVatRate = vatDetail?.vat_rate || '';
      const isOutbound = item.amount >= 0;

      // Fakov Rule 4: Continuous service posting date (Számviteli tv / Ptk: elszámolási időszak utolsó napja)
      const postingDate = (vatDetail?.is_continuous && vatDetail?.service_period_end)
        ? vatDetail.service_period_end.substring(0, 10)
        : itemDate;

      // Fakov Rule 5: Dynamic Partner GL routing
      // FAD check (vas/acél, építőipar, mezőgazdaság, HO, FAD)
      const isReverseCharge = itemVatRate.toUpperCase().includes('FAD') || 
                              itemVatRate.toUpperCase().includes('HO') || 
                              itemVatRate.toUpperCase().includes('REVERSE');
      const isForeignPartner = currency !== 'HUF' || 
                               (vatDetail?.partner_tax_number ? !vatDetail.partner_tax_number.trim().toUpperCase().startsWith('HU') : false);

      const targetCustId = isReverseCharge ? glCust3Id : (isForeignPartner ? glCust2Id : glCust1Id);
      const targetSuppId = isReverseCharge ? glSupp3Id : (isForeignPartner ? glSupp2Id : glSupp1Id);

      if (isOutbound) {
        if (!targetCustId || !validGlIds.has(targetCustId) || !validGlIds.has(item.gl_account_id)) {
          continue;
        }
      } else {
        if (!targetSuppId || !validGlIds.has(targetSuppId) || !validGlIds.has(item.gl_account_id)) {
          continue;
        }
      }

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
          posting_date: postingDate,
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
        // Outbound: Line 1 (T Vevő 3111/3112/3113 Gross), Line 2 (K Árbevétel Net ALAP), Line 3 (K ÁFA 467 AFA)
        await supabase.from('acc_journal_lines').insert({
          header_id: header.id,
          sequence_number: 1,
          gl_account_id: targetCustId,
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
        const deductiblePct = vatDetail?.deductible_percentage ?? 100;
        const isExpenseGross = (deductiblePct === 0 && !glVatProRataId);
        const hufExpense = isExpenseGross ? Math.round((hufNet + hufVat) * 100) / 100 : hufNet;
        const foreignExpense = (isExpenseGross && foreignVat !== null) ? Math.round(((foreignNet || 0) + foreignVat) * 100) / 100 : foreignNet;

        // Inbound: Line 1 (T Költség Net ALAP or Gross if no 4668)
        const { data: baseLine } = await supabase
          .from('acc_journal_lines')
          .insert({
            header_id: header.id,
            sequence_number: 1,
            gl_account_id: item.gl_account_id,
            dc_type: 'T',
            amount: hufExpense,
            foreign_amount: foreignExpense,
            vat_code: itemVatRate.substring(0, 16) || null,
            vat_role: 'ALAP',
            description: item.description
          })
          .select('id')
          .single();

        let seq = 2;
        // Pro-rata & Deductible VAT
        if (hufVat > 0 && baseLine && !isExpenseGross) {
          if (deductiblePct < 100 && deductiblePct > 0) {
            const hufVatDed = Math.round(hufVat * (deductiblePct / 100) * 100) / 100;
            const hufVatProRata = Math.round((hufVat - hufVatDed) * 100) / 100;

            if (hufVatDed > 0 && effectiveVatDedId) {
              await supabase.from('acc_journal_lines').insert({
                header_id: header.id,
                sequence_number: seq++,
                gl_account_id: effectiveVatDedId,
                dc_type: 'T',
                amount: hufVatDed,
                foreign_amount: foreignVat ? Math.round(foreignVat * (deductiblePct / 100) * 100) / 100 : null,
                vat_code: itemVatRate.substring(0, 16) || null,
                vat_role: 'AFA',
                parent_line_id: baseLine.id,
                description: `Levonható ÁFA (${deductiblePct}%)`
              });
            }

            if (hufVatProRata > 0 && glVatProRataId) {
              await supabase.from('acc_journal_lines').insert({
                header_id: header.id,
                sequence_number: seq++,
                gl_account_id: glVatProRataId,
                dc_type: 'T',
                amount: hufVatProRata,
                foreign_amount: foreignVat ? Math.round(foreignVat * ((100 - deductiblePct) / 100) * 100) / 100 : null,
                vat_code: itemVatRate.substring(0, 16) || null,
                vat_role: 'AFA',
                parent_line_id: baseLine.id,
                description: `Arányosítandó / nem levonható ÁFA (${100 - deductiblePct}%)`
              });
            }
          } else if (deductiblePct === 0 && glVatProRataId) {
            await supabase.from('acc_journal_lines').insert({
              header_id: header.id,
              sequence_number: seq++,
              gl_account_id: glVatProRataId,
              dc_type: 'T',
              amount: hufVat,
              foreign_amount: foreignVat,
              vat_code: itemVatRate.substring(0, 16) || null,
              vat_role: 'AFA',
              parent_line_id: baseLine.id,
              description: 'Nem levonható ÁFA (100%)'
            });
          } else if (effectiveVatDedId) {
            await supabase.from('acc_journal_lines').insert({
              header_id: header.id,
              sequence_number: seq++,
              gl_account_id: effectiveVatDedId,
              dc_type: 'T',
              amount: hufVat,
              foreign_amount: foreignVat,
              vat_code: itemVatRate.substring(0, 16) || null,
              vat_role: 'AFA',
              parent_line_id: baseLine.id,
              description: 'Levonható ÁFA'
            });
          }
        }

        // Supplier Credit Line (K 4541/4542/4543 Gross)
        await supabase.from('acc_journal_lines').insert({
          header_id: header.id,
          sequence_number: seq,
          gl_account_id: targetSuppId,
          dc_type: 'K',
          amount: hufGross,
          foreign_amount: foreignGross,
          vat_role: 'NONE',
          description: item.description
        });
      }

      createdCount++;
    }
  }

  // 5. Generate drafts for Petty Cash entries (P1 Journal)
  const p1Journal = journals?.find(j => j.code === 'P1' || j.type === 'PETTY_CASH' || j.type === 'CASH') || journals?.[0];
  const p1JournalId = p1Journal?.id;

  let glCashId: string | undefined;
  if (p1Journal?.connected_gl_account) {
    glCashId = glAccounts?.find(g => g.gl_number === p1Journal.connected_gl_account)?.id;
  }
  if (!glCashId) {
    glCashId = glAccounts?.find(g => g.gl_number.startsWith('381') && g.gl_number !== '381')?.id
            || glAccounts?.find(g => g.gl_number.startsWith('381'))?.id
            || glAccounts?.[0]?.id;
  }

  if (glCashId && p1JournalId) {
    const { data: rawPce } = await supabase
      .from('petty_cash_entries')
      .select('id, entry_date, description, amount, currency, source_type')
      .eq('company_id', companyId);

    const { data: existingPostings } = await supabase
      .from('acc_journal_headers')
      .select('import_key')
      .eq('company_id', companyId);

    const postedKeys = new Set((existingPostings || []).map(h => h.import_key));

    for (const pce of (rawPce || [])) {
      if (postedKeys.has(pce.id)) continue;
      if (!pce.amount || Math.abs(Number(pce.amount)) === 0) continue;

      const itemDate = pce.entry_date ? pce.entry_date.substring(0, 10) : new Date().toISOString().substring(0, 10);
      const year = Number(itemDate.substring(0, 4)) || new Date().getFullYear();
      const currency = pce.currency || 'HUF';
      const amount = Math.abs(Number(pce.amount));
      const docId = `KP-${pce.id.substring(0, 8).toUpperCase()}`;

      // Target expense/revenue account or default 52/91
      const glCounterId = Number(pce.amount) >= 0 
        ? (glAccounts?.find(g => g.gl_number.startsWith('91'))?.id || glCashId)
        : (glAccounts?.find(g => g.gl_number.startsWith('52'))?.id || glCashId);

      const { data: header, error: hErr } = await supabase
        .from('acc_journal_headers')
        .insert({
          company_id: companyId,
          journal_id: p1JournalId,
          accounting_year: year,
          status: 'GEPI_JAVASLAT',
          entry_type: 'NORMAL',
          source: 'AUTO_RENDSZER',
          posting_date: itemDate,
          document_date: itemDate,
          document_id: docId,
          description: pce.description || 'Pénztárbizonylat javaslat',
          currency: currency,
          exchange_rate: 1,
          exchange_rate_date: itemDate,
          import_key: pce.id.toString()
        })
        .select('id')
        .single();

      if (hErr) continue;

      let line1: any;
      let line2: any;
      if (Number(pce.amount) >= 0) {
        line1 = { header_id: header.id, sequence_number: 1, gl_account_id: glCashId, dc_type: 'T', amount, description: pce.description };
        line2 = { header_id: header.id, sequence_number: 2, gl_account_id: glCounterId, dc_type: 'K', amount, description: pce.description };
      } else {
        line1 = { header_id: header.id, sequence_number: 1, gl_account_id: glCounterId, dc_type: 'T', amount, description: pce.description };
        line2 = { header_id: header.id, sequence_number: 2, gl_account_id: glCashId, dc_type: 'K', amount, description: pce.description };
      }

      await supabase.from('acc_journal_lines').insert([line1, line2]);
      createdCount++;
    }
  }

  return createdCount;
}
