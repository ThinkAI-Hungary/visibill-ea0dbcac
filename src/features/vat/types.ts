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
  country_code?: string;
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

export const formatThousands = (
  v: number | string | null | undefined,
  options?: { decimals?: number; fallback?: string }
): string => {
  if (v === null || v === undefined || v === '') return options?.fallback ?? '0';
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\s+/g, '').replace(',', '.'));
  if (isNaN(n)) return options?.fallback ?? '0';
  const isNegative = n < 0;
  const absNum = Math.abs(n);
  if (options?.decimals !== undefined) {
    const parts = absNum.toFixed(options.decimals).split('.');
    const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const formatted = parts.length > 1 ? `${intPart},${parts[1]}` : intPart;
    return `${isNegative ? '-' : ''}${formatted}`;
  }
  const rounded = Math.round(absNum).toString();
  const formatted = rounded.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${isNegative ? '-' : ''}${formatted}`;
};

export const fmtEft = (v: number | string | null | undefined): string => {
  if (v === null || v === undefined || v === '') return '—';
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\s+/g, '').replace(',', '.'));
  if (isNaN(n)) return '—';
  return `${formatThousands(n)} eFt`;
};

export const fmtEur = (v: number | string | null | undefined): string => {
  if (v === null || v === undefined || v === '') return '—';
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\s+/g, '').replace(',', '.'));
  if (isNaN(n)) return '—';
  return `${formatThousands(n, { decimals: 2 })} €`;
};

export const fmtVatAmount = (v: number | string | null | undefined, isCroatia: boolean): string => {
  return isCroatia ? fmtEur(v) : fmtEft(v);
};

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

export { formatVatRate } from '@/lib/utils';

export interface VatSteelItemSummary {
  id: string;
  invoice_id: string;
  invoice_number: string;
  partner_name: string;
  partner_tax_number: string;
  delivery_date: string;
  product_code: string; // VTSZ (vámtarifaszám)
  line_description: string;
  net_amount: number;
  net_weight_kg: number;
}


