// ── Petty Cash shared types, constants and utilities ──

export interface PettyCashRegister {
  id: string;
  company_id: string;
  name: string;
  location: string | null;
  currencies: string[];
  is_default: boolean;
  closing_mode?: 'daily' | 'weekly' | 'decade' | 'monthly' | 'custom';
  custom_days?: number;
  cash_limit?: number;
  limit_action?: 'warn' | 'block';
  receipt_policy?: 'always' | 'when_no_document';
  approval_threshold?: number;
  gl_account?: string;
  is_single_person_mode?: boolean;
  cashier_user_id?: string | null;
  controller_user_id?: string | null;
  authorizer_user_id?: string | null;
  receipt_prefix?: string | null;
  attachment_required?: 'mandatory' | 'when_no_document' | 'optional';
  valuation_method?: 'average' | 'fifo';
  created_at: string;
}

export interface OpeningBalance {
  id: string;
  register_id: string;
  currency: string;
  amount: number;
  start_date: string | null;
}

export interface PettyCashEntry {
  id: string;
  company_id: string;
  register_id: string;
  entry_date: string;
  description: string | null;
  amount: number;
  currency: string;
  source_type: string;
  source_id: string | null;
  source_table: string | null;
  routed_by: string;
  created_at: string;
  partner_id: string | null;
  cash_report_id?: string | null;
  line_no?: number | null;
  status?: 'draft' | 'pending_approval' | 'posted' | 'cancelled';
  direction?: 'in' | 'out' | null;
  legal_title?: string | null;
  gl_contra_account?: string | null;
  cancelled_reason?: string | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  receipt_id?: string | null;
  receipt_number?: string | null;
  payee_name?: string | null;
  net_amount?: number | null;
  vat_amount?: number | null;
  vat_code_id?: string | null;
  vat_row_override?: string | null;
  attachment_url?: string | null;
  attachment_path?: string | null;
  source_doc_type?: 'invoice' | 'payroll' | 'travel_order' | 'bank_withdrawal' | 'owner_loan' | 'other' | string | null;
  source_doc_id?: string | null;
}

export type CashReportStatus = 'open' | 'closing' | 'closed' | 'posted' | 'reopened';

export interface CashReport {
  id: string;
  company_id: string;
  cash_register_id: string;
  seq_no: number | null;
  report_number: string | null;
  period_start: string;
  period_end: string;
  status: CashReportStatus;
  opening_balance: number;
  total_in: number;
  total_out: number;
  closing_balance_book: number;
  closing_balance_actual: number | null;
  difference: number | null;
  currency: string;
  closed_by: string | null;
  closed_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  content_hash: string | null;
  version: number;
  pdf_document_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CashReceipt {
  id: string;
  company_id: string;
  cash_register_id: string;
  cash_entry_id: string | null;
  receipt_type: 'in' | 'out';
  seq_no: number;
  receipt_number: string;
  issued_at: string;
  partner_id: string | null;
  payer_or_payee_name: string | null;
  payer_or_payee_address: string | null;
  amount: number;
  currency: string;
  amount_in_words: string;
  legal_title: string | null;
  description: string | null;
  attachments?: any[];
  payer_signature?: string | null;
  recipient_signature?: string | null;
  source_doc_type?: 'invoice' | 'payroll' | 'travel_order' | 'bank_withdrawal' | 'owner_loan' | 'other' | string | null;
  source_doc_id?: string | null;
  attachment_url?: string | null;
  attachment_path?: string | null;
  printed_copy_count?: number;
  last_printed_at?: string | null;
  is_cancelled: boolean;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CashContraPreset {
  id: string;
  direction: 'in' | 'out';
  code: string;
  name: string;
  glAccount: string;
  sourceDocType: 'invoice' | 'payroll' | 'travel_order' | 'bank_withdrawal' | 'owner_loan' | 'other';
  defaultTitle: string;
}

export const CASH_CONTRA_PRESETS: CashContraPreset[] = [
  // BPB (Bevételi)
  { id: 'bpb_customer', direction: 'in', code: '311', name: 'Vevői készpénz fizetés (311)', glAccount: '311', sourceDocType: 'invoice', defaultTitle: 'Vevőkövetelés készpénzes kiegyenlítése' },
  { id: 'bpb_advance', direction: 'in', code: '453', name: 'Vevőtől kapott előleg (453)', glAccount: '453', sourceDocType: 'invoice', defaultTitle: 'Készpénzes vevőelőleg átvétele' },
  { id: 'bpb_loan', direction: 'in', code: '451', name: 'Tagi kölcsön befizetés (451)', glAccount: '451', sourceDocType: 'owner_loan', defaultTitle: 'Tagi kölcsön készpénz befizetése' },
  { id: 'bpb_bank', direction: 'in', code: '389', name: 'Bankból felvett kp átvezetése (389)', glAccount: '389', sourceDocType: 'bank_withdrawal', defaultTitle: 'Banki készpénzfelvétel bevételezése' },
  { id: 'bpb_other', direction: 'in', code: '969', name: 'Egyéb bevétel / Többlet (969)', glAccount: '969', sourceDocType: 'other', defaultTitle: 'Pénztári egyéb készpénzbevétel' },

  // KPB (Kiadási)
  { id: 'kpb_supplier', direction: 'out', code: '454', name: 'Szállító készpénzes kiegyenlítése (454)', glAccount: '454', sourceDocType: 'invoice', defaultTitle: 'Szállítói számla készpénzes kifizetése' },
  { id: 'kpb_expense', direction: 'out', code: '51-53', name: 'Készpénzes költségszámla (51-53)', glAccount: '511', sourceDocType: 'invoice', defaultTitle: 'Készpénzes közvetlen költség' },
  { id: 'kpb_payroll', direction: 'out', code: '471', name: 'Nettó munkabér kifizetés (471)', glAccount: '471', sourceDocType: 'payroll', defaultTitle: 'Készpénzes munkabér / bérfizetés' },
  { id: 'kpb_advance', direction: 'out', code: '361', name: 'Dolgozói előleg / kártérítés (361)', glAccount: '361', sourceDocType: 'payroll', defaultTitle: 'Munkavállalói készpénzelőleg felvétele' },
  { id: 'kpb_travel', direction: 'out', code: '52', name: 'Kiküldetés és üzemanyag elszámolás (52)', glAccount: '52', sourceDocType: 'travel_order', defaultTitle: 'Kiküldetési rendelvény és üzemanyag megtérítés' },
  { id: 'kpb_bank', direction: 'out', code: '389', name: 'Bankba befizetett kp átvezetése (389)', glAccount: '389', sourceDocType: 'bank_withdrawal', defaultTitle: 'Pénztárból bankszámlára történő befizetés' },
  { id: 'kpb_other', direction: 'out', code: '869', name: 'Egyéb ráfordítás / Hiány (869)', glAccount: '869', sourceDocType: 'other', defaultTitle: 'Pénztári egyéb készpénzkiadás' },
];

export interface TimelineIntegrityResult {
  valid: boolean;
  message?: string;
  first_failing_date?: string;
  first_failing_entry_id?: string;
  first_failing_receipt_number?: string;
  running_balance_before_deficit?: number;
  deficit_amount?: number;
  opening_balance?: number;
  current_balance?: number;
  min_projected_balance?: number;
  failed_at_date?: string;
  failed_at_receipt_number?: string;
  failed_at_description?: string;
  failed_balance?: number;
  error_message?: string;
}

export interface GlReconciliationRegister {
  register_id: string;
  register_name: string;
  currency: string;
  currencies?: string[];
  gl_account_code: string;
  gl_account?: string;
  analytics_balance_fx: number;
  analytics_balance_huf: number;
  analytic_balance?: number;
  gl_balance_huf: number;
  gl_balance?: number;
  diff_huf: number;
  difference?: number;
  is_matching?: boolean;
}

export interface GlItemizedDiscrepancy {
  discrepancy_type: 'unposted_entry' | 'direct_gl_posting' | 'fx_difference' | string;
  date: string;
  description: string;
  amount_huf: number;
  remedy_suggestion: string;
}

export interface GlReconciliationResult {
  year: number;
  date_to: string;
  is_reconciled: boolean;
  is_fully_reconciled?: boolean;
  status_message?: string;
  analytics_total_huf: number;
  gl_total_huf: number;
  discrepancy_huf: number;
  total_analytic_balance?: number;
  total_gl_balance?: number;
  total_difference?: number;
  registers: GlReconciliationRegister[];
  itemized_discrepancies?: GlItemizedDiscrepancy[];
  unposted_entries?: Array<{
    id: string;
    entry_date: string;
    register_name: string;
    amount: number;
    currency: string;
    description: string;
    status: string;
    receipt_number?: string;
    cash_report_status?: string;
  }>;
  direct_gl_entries?: Array<{
    journal_header_id: string;
    journal_number: number;
    source: string;
    posting_date: string;
    description: string;
    dc_type: string;
    amount: number;
    gl_number: string;
  }>;
}

export interface FxCashRevaluationItem {
  register_id: string;
  register_name: string;
  currency: string;
  currency_balance: number;
  fx_balance?: number;
  book_value_huf: number;
  book_huf?: number;
  official_mnb_rate: number;
  mnb_rate?: number;
  revalued_huf: number;
  market_huf?: number;
  diff_huf: number;
  difference_huf?: number;
  direction?: 'GAIN' | 'LOSS';
}

export interface FxCashRevaluationResult {
  year: number;
  cutoff_date?: string;
  total_revaluation_diff_huf: number;
  total_gain_huf?: number;
  total_loss_huf?: number;
  net_revaluation_huf?: number;
  items: FxCashRevaluationItem[];
  voucher_number?: string | null;
  journal_header_id?: string | null;
}

export interface CashPartnerMonthlyLimit {
  partner_id: string;
  partner_name: string;
  tax_number?: string;
  partner_tax_number?: string;
  tx_count?: number;
  total_amount_huf: number;
  total_cash_huf?: number;
  monthly_threshold_huf: number;
  threshold_huf?: number;
  excess_amount_huf: number;
  excess_amount?: number;
  penalty_risk_huf: number;
  status: 'normal' | 'warning' | 'exceeded';
  is_exceeded?: boolean;
}

export interface CashPartnerMonthlyLimitResult {
  year: number;
  month: number;
  threshold_huf?: number;
  violating_partner_count: number;
  total_penalty_risk_huf: number;
  start_date?: string;
  end_date?: string;
  partners: CashPartnerMonthlyLimit[];
}

export interface DenominationRow {
  denomination: number;
  count: number;
  subtotal: number;
}

export interface DenominationSheet {
  id: string;
  company_id: string;
  cash_report_id: string;
  currency: string;
  rows: DenominationRow[];
  total_amount: number;
  version: number;
  created_at: string;
}

export interface CashClosingProtocol {
  id: string;
  company_id: string;
  cash_report_id: string;
  version: number;
  book_balance: number;
  actual_balance: number;
  difference: number;
  difference_reason: string | null;
  action: 'cashier_repays' | 'booked_as_shortage' | 'booked_as_surplus' | 'pending_investigation' | null;
  balancing_entry_id: string | null;
  cashier_user_id: string | null;
  cashier_signed_at: string | null;
  controller_user_id: string | null;
  controller_signed_at: string | null;
  is_single_person: boolean;
  notes: string | null;
  created_at: string;
}

/** Open (unpaid) invoice available for cash settlement (inbound or outbound) */
export interface OpenSettlementInvoice {
  id: string;
  bizonylatsorszam: string;
  invoice_direction?: string;
  vevo_nev?: string;
  elado_nev?: string;
  partner_name?: string;
  brutto_vegosszeg: number;
  kibocsatas_datuma: string;
  fizetesi_hatarido: string | null;
  penznem: string;
}

export type OpenOutboundInvoice = OpenSettlementInvoice;

export interface RoutingRule {
  id: string;
  company_id: string;
  target_register_id: string;
  priority: number;
  match_currency: string | null;
  match_source_type: string | null;
  match_description_pattern: string | null;
  match_partner_pattern: string | null;
  is_active: boolean;
}

export interface SummaryRow {
  register_id: string;
  register_name: string;
  is_default: boolean;
  currency: string;
  opening_balance: number;
  start_date: string | null;
  total_income: number;
  total_expense: number;
  current_balance: number;
}

export const COMMON_CURRENCIES = ['HUF', 'EUR', 'USD', 'GBP', 'CHF', 'CZK', 'PLN', 'RON', 'HRK', 'RSD'];

export const SOURCE_LABELS: Record<string, string> = {
  withdrawal: 'KP felvétel',
  cash_deposit: 'KP befizetés',
  cash_sale: 'KP értékesítés',
  cash_expense: 'KP kiadás',
  manual: 'Manuális',
  transfer: 'Átvezetés',
  invoice_settlement: 'Számla rendezés',
};

export const SOURCE_COLORS: Record<string, string> = {
  withdrawal: 'bg-primary/10 text-primary',
  cash_deposit: 'bg-orange-500/10 text-orange-500',
  cash_sale: 'bg-emerald-500/10 text-emerald-500',
  cash_expense: 'bg-destructive/10 text-destructive',
  manual: 'bg-violet-500/10 text-violet-500',
  transfer: 'bg-sky-500/10 text-sky-500',
  invoice_settlement: 'bg-blue-500/10 text-blue-500',
};

/** Round HUF to nearest 5 */
export const roundHuf = (amount: number, currency: string): number => {
  if (currency !== 'HUF') return Math.round(amount * 100) / 100;
  return Math.round(amount / 5) * 5;
};

import { getActiveLocale } from '@/lib/locale/formatters';

export const fmtAmount = (amount: number, currency: string): string => {
  const rounded = roundHuf(amount, currency);
  const locale = getActiveLocale() === 'hr' ? 'hr-HR' : 'hu-HU';
  const formatted = Math.abs(rounded).toLocaleString(locale, { maximumFractionDigits: currency === 'HUF' ? 0 : 2 });
  const sign = rounded >= 0 ? '+' : '-';
  return `${sign}${formatted} ${currency}`;
};

export const fmtBalance = (amount: number, currency: string): string => {
  const rounded = roundHuf(amount, currency);
  const locale = getActiveLocale() === 'hr' ? 'hr-HR' : 'hu-HU';
  return `${rounded.toLocaleString(locale, { maximumFractionDigits: currency === 'HUF' ? 0 : 2 })} ${currency}`;
};

/** Sanitize partner ID to avoid passing empty strings or 'none' to UUID columns */
export function sanitizePartnerId(partnerId: string | null | undefined): string | null {
  if (!partnerId || partnerId === 'none' || partnerId.trim() === '') return null;
  return partnerId.trim();
}

/** Cleanly parse amount string handling Hungarian spaces, dots, and commas */
export function parseCleanAmount(val: string | number | null | undefined): number {
  if (val == null) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).trim();
  if (!str) return 0;
  const cleaned = str.replace(/\s+/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/** Validate petty cash manual entry and invoice settlement payloads before database mutation */
export function validatePettyCashEntryPayload(params: {
  register_id: string | null | undefined;
  amount: number;
  description: string | null | undefined;
  invoiceMode?: boolean;
  selectedInvoiceCount?: number;
  isVat?: boolean;
  net_amount?: number;
  vat_amount?: number;
  vat_row_override?: string | null;
}): { valid: boolean; error?: string } {
  if (!params.register_id || params.register_id.trim() === '') {
    return { valid: false, error: 'Pénztár kiválasztása kötelező!' };
  }
  if (params.invoiceMode) {
    if (!params.selectedInvoiceCount || params.selectedInvoiceCount === 0) {
      return { valid: false, error: 'Legalább egy számla kiválasztása kötelező!' };
    }
  } else {
    if (!params.amount || params.amount <= 0) {
      return { valid: false, error: 'Az összegnek 0-nál nagyobbnak kell lennie!' };
    }
    if (!params.description || params.description.trim() === '') {
      return { valid: false, error: 'A leírás megadása kötelező!' };
    }
    if (params.isVat) {
      if (params.net_amount == null || params.net_amount < 0) {
        return { valid: false, error: 'A nettó összeg érvénytelen!' };
      }
      if (params.vat_amount == null || params.vat_amount < 0) {
        return { valid: false, error: 'Az ÁFA összeg érvénytelen!' };
      }
    }
  }
  return { valid: true };
}


