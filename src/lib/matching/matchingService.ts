import { supabase } from '@/integrations/supabase/client';
import { reportError } from '@/lib/errorReporter';
import { format, subDays, addDays } from 'date-fns';
import {
  MatchedInvoice,
  MatchedNavInvoice,
  MatchedSalary,
  MatchedCourierReport,
  AvailableInvoice,
  ExtraMatchItem,
  MatchOverridePayload,
  BookTransactionGlPayload,
} from './types';

/**
 * Builds the available invoices list by checking payments and cross-references.
 */
export async function buildAvailableInvoicesList(
  invoices: any[],
  navInvoices: any[],
  companyId: string
): Promise<AvailableInvoice[]> {
  const allInvoiceIds = [
    ...(invoices || []).map(i => i.id),
    ...(navInvoices || []).map(n => n.id),
  ];

  const submittedByNumber = new Map<string, string[]>();
  (invoices || []).forEach(inv => {
    if (inv.bizonylatsorszam) {
      const existing = submittedByNumber.get(inv.bizonylatsorszam) || [];
      existing.push(inv.id);
      submittedByNumber.set(inv.bizonylatsorszam, existing);
    }
  });

  const navByNumber = new Map<string, string[]>();
  (navInvoices || []).forEach(nav => {
    if (nav.invoice_number) {
      const existing = navByNumber.get(nav.invoice_number) || [];
      existing.push(nav.id);
      navByNumber.set(nav.invoice_number, existing);
    }
  });

  (invoices || []).forEach(inv => {
    if (inv.bizonylatsorszam) {
      const navIds = navByNumber.get(inv.bizonylatsorszam);
      if (navIds) allInvoiceIds.push(...navIds);
    }
  });

  (navInvoices || []).forEach(nav => {
    if (nav.invoice_number) {
      const subIds = submittedByNumber.get(nav.invoice_number);
      if (subIds) allInvoiceIds.push(...subIds);
    }
  });

  const uniqueIds = [...new Set(allInvoiceIds)];
  const paidByInvoiceId = new Map<string, number>();

  if (uniqueIds.length > 0 && companyId) {
    const CHUNK = 500;
    for (let i = 0; i < uniqueIds.length; i += CHUNK) {
      const chunk = uniqueIds.slice(i, i + CHUNK);
      const { data: matchedTxs } = await supabase
        .from('transactions')
        .select('matched_invoice_id, amount')
        .eq('company_id', companyId)
        .in('matched_invoice_id', chunk);

      (matchedTxs || []).forEach(tx => {
        if (tx.matched_invoice_id) {
          const prev = paidByInvoiceId.get(tx.matched_invoice_id) || 0;
          paidByInvoiceId.set(tx.matched_invoice_id, prev + Math.abs(tx.amount || 0));
        }
      });
    }
  }

  const combined: AvailableInvoice[] = [];

  for (const inv of invoices || []) {
    let alreadyPaid = paidByInvoiceId.get(inv.id) || 0;
    if (inv.bizonylatsorszam) {
      const navIds = navByNumber.get(inv.bizonylatsorszam);
      if (navIds) {
        navIds.forEach(nid => {
          alreadyPaid += paidByInvoiceId.get(nid) || 0;
        });
      }
    }
    combined.push({
      id: inv.id,
      bizonylatsorszam: inv.bizonylatsorszam,
      brutto_vegosszeg: inv.brutto_vegosszeg,
      elado_nev: inv.elado_nev,
      penznem: inv.penznem,
      kibocsatas_datuma: inv.kibocsatas_datuma,
      already_paid: alreadyPaid,
      remaining: Math.abs(inv.brutto_vegosszeg || 0) - alreadyPaid,
    });
  }

  for (const nav of navInvoices || []) {
    let navAlreadyPaid = paidByInvoiceId.get(nav.id) || 0;
    if (nav.invoice_number) {
      const subIds = submittedByNumber.get(nav.invoice_number);
      if (subIds) {
        subIds.forEach(sid => {
          navAlreadyPaid += paidByInvoiceId.get(sid) || 0;
        });
      }
    }
    const navBrutto = Math.abs(nav.invoice_gross_amount || 0);
    combined.push({
      id: nav.id,
      bizonylatsorszam: nav.invoice_number,
      brutto_vegosszeg: nav.invoice_gross_amount || 0,
      elado_nev: nav.supplier_name || nav.customer_name || '',
      penznem: nav.currency,
      kibocsatas_datuma: nav.invoice_issue_date || '',
      already_paid: navAlreadyPaid,
      remaining: navBrutto - navAlreadyPaid,
    });
  }

  return combined;
}

/**
 * Fetches matched invoice details from invoices, nav_invoices, or salary tables.
 */
export async function fetchMatchedEntityDetails(matchedInvoiceId: string): Promise<{
  invoice: MatchedInvoice | null;
  navInvoice: MatchedNavInvoice | null;
  salary: MatchedSalary | null;
}> {
  if (!matchedInvoiceId) {
    return { invoice: null, navInvoice: null, salary: null };
  }

  try {
    // 1. Invoices table
    const { data: invData, error: invError } = await supabase
      .from('invoices')
      .select('id, bizonylatsorszam, kibocsatas_datuma, teljesites_datuma, elado_nev, vevo_nev, brutto_vegosszeg, penznem, invoice_type')
      .eq('id', matchedInvoiceId)
      .maybeSingle();

    if (invError) throw invError;
    if (invData) {
      return { invoice: invData, navInvoice: null, salary: null };
    }

    // 2. NAV invoices table fallback
    const { data: navData, error: navError } = await supabase
      .from('nav_invoices')
      .select('id, invoice_number, invoice_issue_date, supplier_name, customer_name, invoice_gross_amount, currency, invoice_direction, transaction_id, submitted')
      .eq('id', matchedInvoiceId)
      .maybeSingle();

    if (navError) throw navError;
    if (navData) {
      return { invoice: null, navInvoice: navData, salary: null };
    }

    // 3. Salary table fallback
    const { data: salaryData, error: salaryError } = await supabase
      .from('salary')
      .select('id, "név", "összeg", tipus, fizetesi_mod, statusz, "dátum", munkavallalo_neve, megjegyzes, kifizetes_ideje, transaction_id')
      .eq('id', matchedInvoiceId)
      .maybeSingle();

    if (salaryError) throw salaryError;
    if (salaryData) {
      return {
        invoice: null,
        navInvoice: null,
        salary: {
          id: salaryData.id,
          név: salaryData['név'],
          összeg: salaryData['összeg'],
          tipus: salaryData.tipus,
          fizetesi_mod: salaryData.fizetesi_mod,
          transaction_id: salaryData.transaction_id,
          dátum: salaryData['dátum'],
          munkavallalo_neve: salaryData.munkavallalo_neve,
          megjegyzes: salaryData.megjegyzes,
        },
      };
    }
  } catch (error) {
    reportError({
      type: 'db_query',
      component: 'matchingService',
      action: 'error',
      message: 'Error fetching matched entity details:',
      error,
    });
  }

  return { invoice: null, navInvoice: null, salary: null };
}

/**
 * Fetches courier reports matched to a transaction.
 */
export async function fetchMatchedCourierReports(transactionId: string): Promise<MatchedCourierReport[]> {
  if (!transactionId) return [];
  try {
    const { data, error } = await supabase
      .from('courier_reports')
      .select('id, report_type, package_number, reference_number, delivery_date, cod_amount, recipient_name, match_status, match_confidence')
      .eq('matched_transaction_id', transactionId);

    if (error) throw error;
    return data || [];
  } catch (error) {
    reportError({
      type: 'db_query',
      component: 'matchingService',
      action: 'error',
      message: 'Error fetching courier reports:',
      error,
    });
    return [];
  }
}

/**
 * Fetches extra matches (split transactions) from the join table.
 */
export async function fetchExtraMatches(transactionId: string): Promise<ExtraMatchItem[]> {
  if (!transactionId) return [];
  try {
    const { data, error } = await supabase
      .from('transaction_invoice_matches')
      .select('id, invoice_id, invoice_source')
      .eq('transaction_id', transactionId);

    if (error) throw error;
    if (!data || data.length === 0) return [];

    return await Promise.all(
      data.map(async m => {
        if (m.invoice_source === 'submitted') {
          const { data: inv } = await supabase
            .from('invoices')
            .select('id, bizonylatsorszam, kibocsatas_datuma, teljesites_datuma, elado_nev, vevo_nev, brutto_vegosszeg, penznem, invoice_type')
            .eq('id', m.invoice_id)
            .maybeSingle();
          return { ...m, invoice: inv as MatchedInvoice | null, navInvoice: null };
        } else {
          const { data: nav } = await supabase
            .from('nav_invoices')
            .select('id, invoice_number, invoice_issue_date, supplier_name, customer_name, invoice_gross_amount, currency, invoice_direction, transaction_id, submitted')
            .eq('id', m.invoice_id)
            .maybeSingle();
          return { ...m, invoice: null, navInvoice: nav as MatchedNavInvoice | null };
        }
      })
    );
  } catch (error) {
    reportError({
      type: 'db_query',
      component: 'matchingService',
      action: 'error',
      message: 'Error fetching extra matches:',
      error,
    });
    return [];
  }
}

/**
 * Loads default available candidate invoices within a 180-day window.
 */
export async function fetchAvailableInvoices(
  companyId: string,
  transactionDateStr: string
): Promise<AvailableInvoice[]> {
  if (!companyId || !transactionDateStr) return [];
  try {
    const transactionDate = new Date(transactionDateStr);
    const dateFrom = format(subDays(transactionDate, 180), 'yyyy-MM-dd');
    const dateTo = format(addDays(transactionDate, 30), 'yyyy-MM-dd');

    const [{ data: invoices, error: invError }, { data: navInvoices, error: navError }] = await Promise.all([
      supabase
        .from('invoices')
        .select('id, bizonylatsorszam, brutto_vegosszeg, elado_nev, penznem, kibocsatas_datuma')
        .eq('company_id', companyId)
        .gte('kibocsatas_datuma', dateFrom)
        .lte('kibocsatas_datuma', dateTo)
        .order('kibocsatas_datuma', { ascending: false })
        .limit(200),
      supabase
        .from('nav_invoices')
        .select('id, invoice_number, invoice_gross_amount, supplier_name, customer_name, currency, invoice_issue_date, invoice_direction')
        .eq('company_id', companyId)
        .gte('invoice_issue_date', dateFrom)
        .lte('invoice_issue_date', dateTo)
        .order('invoice_issue_date', { ascending: false })
        .limit(200),
    ]);

    if (invError) throw invError;
    if (navError) throw navError;

    return await buildAvailableInvoicesList(invoices || [], navInvoices || [], companyId);
  } catch (error) {
    reportError({
      type: 'db_query',
      component: 'matchingService',
      action: 'error',
      message: 'Error fetching available candidate invoices:',
      error,
    });
    return [];
  }
}

/**
 * Searches server-side invoices across invoices and nav_invoices tables.
 */
export async function searchServerInvoices(
  companyId: string,
  searchQuery: string
): Promise<AvailableInvoice[]> {
  const query = searchQuery.trim();
  if (!companyId || query.length < 2) return [];

  try {
    const cleanTerm = query.replace(/[%_]/g, '\\$&');

    const [{ data: invoices, error: invError }, { data: navInvoices, error: navError }] = await Promise.all([
      supabase
        .from('invoices')
        .select('id, bizonylatsorszam, brutto_vegosszeg, elado_nev, vevo_nev, penznem, kibocsatas_datuma')
        .eq('company_id', companyId)
        .or(`bizonylatsorszam.ilike.%${cleanTerm}%,elado_nev.ilike.%${cleanTerm}%,vevo_nev.ilike.%${cleanTerm}%`)
        .order('kibocsatas_datuma', { ascending: false })
        .limit(50),
      supabase
        .from('nav_invoices')
        .select('id, invoice_number, invoice_gross_amount, supplier_name, customer_name, currency, invoice_issue_date, invoice_direction')
        .eq('company_id', companyId)
        .or(`invoice_number.ilike.%${cleanTerm}%,supplier_name.ilike.%${cleanTerm}%,customer_name.ilike.%${cleanTerm}%`)
        .order('invoice_issue_date', { ascending: false })
        .limit(50),
    ]);

    if (invError) throw invError;
    if (navError) throw navError;

    return await buildAvailableInvoicesList(invoices || [], navInvoices || [], companyId);
  } catch (error) {
    reportError({
      type: 'db_query',
      component: 'matchingService',
      action: 'error',
      message: 'Error searching server invoices:',
      error,
    });
    return [];
  }
}

/**
 * Logs a match override for AI learning / audit log.
 */
export async function logMatchOverride(payload: MatchOverridePayload): Promise<void> {
  if (!payload.transactionId || !payload.companyId) return;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase.from('match_transaction_overrides_log').insert({
      company_id: payload.companyId,
      transaction_id: payload.transactionId,
      original_invoice_id: payload.originalInvoiceId || null,
      original_match_type: payload.originalMatchType || null,
      corrected_invoice_id: payload.correctedInvoiceId || null,
      corrected_match_type: payload.correctedMatchType,
      transaction_description: payload.transactionDescription || '',
      transaction_amount: payload.transactionAmount,
      original_partner_name: payload.originalPartnerName,
      corrected_partner_name: payload.correctedPartnerName,
      created_by: payload.userId || user?.id || null,
    });
  } catch (error) {
    reportError({
      type: 'db_query',
      severity: 'warning',
      component: 'matchingService',
      action: 'warn',
      message: 'Failed to log match override:',
      error,
    });
  }
}

/**
 * Applies a match between a transaction and an invoice.
 */
export async function applyMatch(params: {
  transactionId: string;
  invoiceId: string;
  matchType?: string;
  confidenceScore?: number;
  overridePayload?: MatchOverridePayload;
}): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .update({
      matched_invoice_id: params.invoiceId,
      is_verified: true,
      match_type: params.matchType || 'manual',
      confidence_score: params.confidenceScore ?? 1.0,
    })
    .eq('id', params.transactionId);

  if (error) throw error;

  if (params.overridePayload) {
    // Fire-and-forget
    logMatchOverride(params.overridePayload);
  }
}

/**
 * Unmatches a transaction, clearing references in transactions, invoices, nav_invoices, salary, and join table.
 */
export async function unmatchTransaction(transactionId: string): Promise<void> {
  if (!transactionId) return;

  // 1. Clear transaction
  const { error } = await supabase
    .from('transactions')
    .update({
      matched_invoice_id: null,
      is_verified: false,
      match_type: null,
    })
    .eq('id', transactionId);

  if (error) throw error;

  // 2. Clear related invoice records
  await Promise.all([
    supabase
      .from('invoices')
      .update({ transaction_id: null, fizetve: false })
      .eq('transaction_id', transactionId),
    supabase
      .from('nav_invoices')
      .update({ transaction_id: null, paid: false })
      .eq('transaction_id', transactionId),
    supabase
      .from('salary')
      .update({ transaction_id: null, statusz: 'Nyitott' })
      .eq('transaction_id', transactionId),
    supabase
      .from('transaction_invoice_matches')
      .delete()
      .eq('transaction_id', transactionId),
  ]);
}

/**
 * Verifies a transaction match.
 */
export async function verifyMatch(transactionId: string): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .update({ is_verified: true })
    .eq('id', transactionId);

  if (error) throw error;
}

/**
 * Marks a transaction as having no invoice.
 */
export async function markNoInvoice(transactionId: string): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .update({
      match_type: 'no_invoice',
      matched_invoice_id: null,
      is_verified: false,
    })
    .eq('id', transactionId);

  if (error) throw error;
}

/**
 * Marks a transaction as invoice missing.
 */
export async function markInvoiceMissing(transactionId: string): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .update({
      match_type: 'invoice_missing',
      matched_invoice_id: null,
      is_verified: false,
    })
    .eq('id', transactionId);

  if (error) throw error;
}

/**
 * Reverts the special match_type of a transaction back to null.
 */
export async function revertStatus(transactionId: string): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .update({
      match_type: null,
    })
    .eq('id', transactionId);

  if (error) throw error;
}

/**
 * Adds an extra match to the transaction_invoice_matches join table.
 */
export async function addExtraMatch(params: {
  transactionId: string;
  invoiceId: string;
  overridePayload?: MatchOverridePayload;
}): Promise<void> {
  // Determine if it is a submitted invoice or nav invoice
  const { data: submittedCheck } = await supabase
    .from('invoices')
    .select('id')
    .eq('id', params.invoiceId)
    .maybeSingle();

  const source = submittedCheck ? 'submitted' : 'nav';

  const { error } = await supabase.from('transaction_invoice_matches').insert({
    transaction_id: params.transactionId,
    invoice_id: params.invoiceId,
    invoice_source: source,
    created_by: 'manual',
  });

  if (error) throw error;

  if (params.overridePayload) {
    logMatchOverride(params.overridePayload);
  }
}

/**
 * Removes an extra match from the join table.
 */
export async function removeExtraMatch(matchId: string): Promise<void> {
  const { error } = await supabase
    .from('transaction_invoice_matches')
    .delete()
    .eq('id', matchId);

  if (error) throw error;
}

/**
 * Directly books a transaction to a General Ledger account.
 */
export async function bookTransactionDirect(payload: BookTransactionGlPayload): Promise<void> {
  // Step A: RPC update mapping
  const { error: rpcError } = await supabase.rpc('override_gl_classifications_batch', {
    p_items: [
      {
        item_id: payload.transactionId,
        source_table: 'transactions',
        original_gl_account_id: payload.originalGlAccountId || null,
      },
    ],
    p_new_gl_account_id: payload.selectedGlId,
    p_company_id: payload.companyId,
    p_user_id: payload.userId,
    p_preset_id: payload.presetId,
    p_new_gl_number: payload.newGlNumber,
  });

  if (rpcError) throw rpcError;

  // Step B: Update base transaction fields
  const { error } = await supabase
    .from('transactions')
    .update({
      gl_account_id: payload.selectedGlId,
      gl_is_manually_overridden: true,
      is_verified: true,
      matched_invoice_id: null,
      match_type: null,
    })
    .eq('id', payload.transactionId);

  if (error) throw error;
}

/**
 * Unbooks a direct GL booking on a transaction.
 */
export async function unbookTransactionDirect(params: {
  transactionId: string;
  companyId: string;
  userId: string;
  presetId: string;
  originalGlAccountId?: string | null;
}): Promise<void> {
  // Step A: RPC remove mapping
  const { error: rpcError } = await supabase.rpc('override_gl_classifications_batch', {
    p_items: [
      {
        item_id: params.transactionId,
        source_table: 'transactions',
        original_gl_account_id: params.originalGlAccountId || null,
      },
    ],
    p_new_gl_account_id: null,
    p_company_id: params.companyId,
    p_user_id: params.userId,
    p_preset_id: params.presetId,
    p_new_gl_number: '',
  });

  if (rpcError) throw rpcError;

  // Step B: Clear base transaction fields
  const { error } = await supabase
    .from('transactions')
    .update({
      gl_account_id: null,
      gl_is_manually_overridden: false,
      is_verified: false,
    })
    .eq('id', params.transactionId);

  if (error) throw error;
}
