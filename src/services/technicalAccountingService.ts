/**
 * Technical Accounting & Analytics Service (Module 22)
 * eaisyBooks & Visibill intelligens főkönyvi adminisztráció,
 * partner 360° dossier, tömeges átvezetés és AI anomália motor.
 */

import { supabase } from '@/integrations/supabase/client';

export interface Partner360Account {
  gl_account_id: string;
  gl_number: string;
  short_name: string;
  account_nature: 'RECEIVABLE' | 'PAYABLE' | 'ADVANCE_GIVEN' | 'ADVANCE_RECEIVED' | 'RETAINED_WARRANTY' | 'OTHER_RECEIVABLE' | 'LOAN_LIABILITY' | 'OTHER_LIABILITY' | 'COST' | 'REVENUE' | 'OTHER';
  total_debit: number;
  total_credit: number;
  balance: number;
  raw_balance: number;
  entries_count: number;
  last_posting_date: string | null;
}

export interface Partner360Data {
  partner: {
    id: string;
    name: string;
    tax_number: string | null;
    partner_type: string | null;
    email: string | null;
    address: string | null;
    bank_account_number: string | null;
  };
  accounts: Partner360Account[];
  summary: {
    total_receivables: number;
    total_payables: number;
    net_position: number;
    position_type: 'NET_RECEIVABLE' | 'NET_PAYABLE' | 'BALANCED';
    can_compensate: boolean;
    compensable_amount: number;
  };
}

export interface OmniPartnerLedgerItem {
  partner_id: string | null;
  partner_name: string;
  partner_tax_number: string | null;
  total_debit: number;
  total_credit: number;
  net_balance: number;
  entries_count: number;
  last_entry_date: string | null;
}

export interface ReclassificationSimulationResult {
  is_simulation: boolean;
  affected_lines_count: number;
  total_amount: number;
  source_account: {
    id: string;
    gl_number: string;
    short_name: string;
    current_balance: number;
    simulated_balance: number;
    delta: number;
  };
  target_account: {
    id: string;
    gl_number: string;
    short_name: string;
    current_balance: number;
    simulated_balance: number;
    delta: number;
  };
  has_cross_class_impact: boolean;
}

export interface ReclassificationExecutionResult {
  success: boolean;
  reclassification_id: string;
  batch_number: string;
  document_id: string;
  header_id: string;
  affected_lines_count: number;
  total_amount: number;
}

export interface ReclassificationRecord {
  id: string;
  company_id: string;
  batch_number: string;
  source_gl_account_id: string;
  target_gl_account_id: string;
  clearing_gl_account_id: string | null;
  reclassification_date: string;
  status: 'SIMULATED' | 'EXECUTED' | 'ROLLED_BACK';
  affected_lines_count: number;
  total_amount: number;
  currency: string;
  source_journal_line_ids: string[];
  generated_journal_header_id: string | null;
  storno_journal_header_id: string | null;
  reason: string | null;
  created_at: string;
  rolled_back_at: string | null;
  source_account?: { gl_number: string; short_name: string };
  target_account?: { gl_number: string; short_name: string };
}

export interface AccountingAnomaly {
  type: 'MISSING_PARTNER' | 'INVERTED_BALANCE' | 'MISCLASSIFICATION' | 'VAT_INCONSISTENCY';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  line_id?: string;
  header_id?: string;
  document_id?: string;
  posting_date?: string;
  gl_number: string;
  gl_name: string;
  amount?: number;
  dc_type?: string;
  vat_code?: string;
  balance?: number;
  description?: string;
  message: string;
}

export interface AccountingAnomaliesResult {
  total_anomalies_count: number;
  missing_partners: AccountingAnomaly[];
  inverted_balances: AccountingAnomaly[];
  vat_inconsistencies: AccountingAnomaly[];
}

/**
 * Lekéri egy adott partner 360°-os főkönyvi pozícióját és likviditási mátrixát
 */
export async function getPartner360Matrix(
  companyId: string,
  partnerId: string,
  startDate?: string,
  endDate?: string
): Promise<Partner360Data> {
  const { data, error } = await supabase.rpc('get_partner_360_matrix', {
    p_company_id: companyId,
    p_partner_id: partnerId,
    p_start_date: startDate || null,
    p_end_date: endDate || null,
  });

  if (error) throw error;
  return data as Partner360Data;
}

/**
 * Bármely főkönyvi számla vagy számlacsoport partner szerinti felbontása (Omni-Account Partner Ledger)
 */
export async function getOmniPartnerLedger(
  companyId: string,
  glAccountId?: string,
  accountCodePrefix?: string,
  startDate?: string,
  endDate?: string
): Promise<OmniPartnerLedgerItem[]> {
  const { data, error } = await supabase.rpc('get_omni_partner_ledger', {
    p_company_id: companyId,
    p_gl_account_id: glAccountId || null,
    p_account_code_prefix: accountCodePrefix || null,
    p_start_date: startDate || null,
    p_end_date: endDate || null,
  });

  if (error) throw error;
  return (data || []) as OmniPartnerLedgerItem[];
}

/**
 * Tömeges átvezetés szimulációja (Előtte/utána számlaegyenleg kalkuláció)
 */
export async function simulateReclassification(params: {
  companyId: string;
  sourceGlAccountId: string;
  targetGlAccountId: string;
  journalLineIds: string[];
  reclassificationDate: string;
  reason?: string;
}): Promise<ReclassificationSimulationResult> {
  const { data, error } = await supabase.rpc('execute_journal_reclassification', {
    p_company_id: params.companyId,
    p_source_gl_account_id: params.sourceGlAccountId,
    p_target_gl_account_id: params.targetGlAccountId,
    p_journal_line_ids: params.journalLineIds,
    p_reclassification_date: params.reclassificationDate,
    p_reason: params.reason || 'Tömeges főkönyvi átvezetés szimuláció',
    p_is_simulation: true,
  });

  if (error) throw error;
  return data as ReclassificationSimulationResult;
}

/**
 * Tömeges átvezetés éles végrehajtása V-ATV technikai vegyes bizonylattal
 */
export async function executeReclassification(params: {
  companyId: string;
  sourceGlAccountId: string;
  targetGlAccountId: string;
  journalLineIds: string[];
  reclassificationDate: string;
  reason: string;
  clearingGlAccountId?: string;
}): Promise<ReclassificationExecutionResult> {
  const { data, error } = await supabase.rpc('execute_journal_reclassification', {
    p_company_id: params.companyId,
    p_source_gl_account_id: params.sourceGlAccountId,
    p_target_gl_account_id: params.targetGlAccountId,
    p_journal_line_ids: params.journalLineIds,
    p_reclassification_date: params.reclassificationDate,
    p_reason: params.reason,
    p_clearing_gl_account_id: params.clearingGlAccountId || null,
    p_is_simulation: false,
  });

  if (error) throw error;
  return data as ReclassificationExecutionResult;
}

/**
 * Korábbi átvezetési csomag 1-kattintásos sztornózása / visszagörgetése
 */
export async function rollbackReclassification(
  companyId: string,
  reclassificationId: string,
  reason?: string
): Promise<{ success: boolean; storno_document_id: string; storno_header_id: string }> {
  const { data, error } = await supabase.rpc('rollback_journal_reclassification', {
    p_company_id: companyId,
    p_reclassification_id: reclassificationId,
    p_reason: reason || 'Átvezetési csomag visszagörgetése',
  });

  if (error) throw error;
  return data as { success: boolean; storno_document_id: string; storno_header_id: string };
}

/**
 * Könyvelési anomáliák lekérdezése (AI Audit Guard)
 */
export async function detectAccountingAnomalies(
  companyId: string,
  startDate?: string,
  endDate?: string
): Promise<AccountingAnomaliesResult> {
  const { data, error } = await supabase.rpc('detect_accounting_anomalies', {
    p_company_id: companyId,
    p_start_date: startDate || null,
    p_end_date: endDate || null,
  });

  if (error) throw error;
  return data as AccountingAnomaliesResult;
}

/**
 * Korábbi átvezetések történetének lekérdezése
 */
export async function getReclassificationHistory(companyId: string): Promise<ReclassificationRecord[]> {
  const { data, error } = await supabase
    .from('acc_reclassifications')
    .select(`
      *,
      source_account:gl_accounts!source_gl_account_id(gl_number, short_name),
      target_account:gl_accounts!target_gl_account_id(gl_number, short_name)
    `)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as ReclassificationRecord[];
}
