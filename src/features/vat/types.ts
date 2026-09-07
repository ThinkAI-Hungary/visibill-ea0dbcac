export interface TaxValidationResult {
  isValid: boolean;
  isForeign?: boolean;
  vatCode?: string;
  reason: string;
  severity: 'success' | 'warning' | 'error' | 'info';
  status?: 'active' | 'exempt' | 'invalid';
}

export interface VatCode {
  id: string;
  company_id: string;
  code: string;
  label: string;
  vat_percent: number;
  direction: 'OUTBOUND' | 'INBOUND';
  is_deductible: boolean;
  is_reverse_charge: boolean;
  is_eu: boolean;
  target_rows: { row: string; col: 'base' | 'tax' }[];
  sort_order: number;
}

export interface FormRow {
  row_number: string;
  section: string;
  page: string;
  label: string;
  has_base: boolean;
  has_tax: boolean;
  is_summary: boolean;
  sort_order: number;
}

export interface ReturnLine {
  row_number: string;
  base_amount: number;
  tax_amount: number;
  base_amount_rounded: number;
  tax_amount_rounded: number;
  is_calculated: boolean;
  source_vat_codes: string[] | null;
}

export interface MLine {
  id: string;
  partner_name: string;
  partner_tax_number: string;
  invoice_count: number;
  base_amount_rounded: number;
  tax_amount_rounded: number;
  tax_5_amount: number;
  tax_18_amount: number;
  tax_27_amount: number;
  invoice_details: any[];
}

export interface XmlValidationCheck {
  id: string;
  name: string;
  status: 'pending' | 'success' | 'error';
  message: string;
}

export interface A60CalculationsResult {
  goodsSum: number;
  servicesSum: number;
  expectedGoods: number;
  expectedServices: number;
  goodsMismatch: boolean;
  servicesMismatch: boolean;
  itemsList: any[];
  taxErrors: string[];
  isValid: boolean;
}

export interface DeadlineInfo {
  daysLeft: number;
  dateFormatted: string;
}

export type VatFrequency = 'H' | 'N' | 'E';

export const MONTHS = [
  'Január',
  'Február',
  'Március',
  'Április',
  'Május',
  'Június',
  'Július',
  'Augusztus',
  'Szeptember',
  'Október',
  'November',
  'December',
];

export const fmtEft = (v: number | null | undefined) =>
  v === null || v === undefined ? '—' : `${v.toLocaleString('hu-HU')} eFt`;

export interface VatProRataSettings {
  id?: string;
  company_id: string;
  accounting_year: number;
  method: 'PREVIOUS_YEAR_9A' | 'CUMULATIVE_9B';
  prev_year_ratio: number;
  current_final_ratio?: number | null;
  is_finalized?: boolean;
  non_deductible_gl_account_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface VatProRataPeriod {
  id?: string;
  company_id: string;
  accounting_year: number;
  period_month: number;
  taxable_revenue: number;
  exempt_revenue: number;
  non_taxable_subsidies: number;
  raw_ratio: number;
  rounded_ratio: number;
  pro_rata_base_amount: number;
  pro_rata_input_vat: number;
  deductible_vat: number;
  non_deductible_vat: number;
  created_at?: string;
  updated_at?: string;
}

