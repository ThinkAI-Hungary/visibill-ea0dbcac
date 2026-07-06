/* ────────────────────────────────────────── */
/*  VAT Return Module — Shared Types          */
/* ────────────────────────────────────────── */

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

export const MONTHS = ['Január','Február','Március','Április','Május','Június','Július','Augusztus','Szeptember','Október','November','December'];

export const fmtEft = (v: number | null | undefined) => (v === null || v === undefined) ? '—' : `${v.toLocaleString('hu-HU')} eFt`;
