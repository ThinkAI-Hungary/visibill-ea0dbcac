export type ImportProcedureType = 'LEVY' | 'SELF_ASSESSMENT';
export type ImportDeclarationStatus = 'DRAFT' | 'CONFIRMED' | 'PAID' | 'CANCELLED';
export type ImportPaymentStatus = 'PENDING' | 'PAID';

export interface ImportCustomsDeclaration {
  id: string;
  company_id: string;
  declaration_number: string;
  customs_office_code?: string | null;
  decision_date: string;
  tax_period_date: string;
  procedure_type: ImportProcedureType;
  status: ImportDeclarationStatus;

  // Foreign invoice linking
  foreign_supplier_invoice_id?: string | null;
  foreign_supplier_name?: string | null;
  foreign_currency: string;
  foreign_invoice_amount: number;

  // Customs base computation
  customs_exchange_rate: number;
  customs_value_huf: number;
  customs_duty_huf: number;
  other_import_costs_huf: number;
  vat_base_huf: number;

  // VAT details
  vat_code: string;
  vat_rate_percent: number;
  vat_amount_huf: number;
  is_deductible: boolean;

  // Payment tracking (crucial for LEVY procedure 70. row)
  payment_status: ImportPaymentStatus;
  payment_date?: string | null;
  bank_transaction_ref?: string | null;
  bank_transaction_id?: string | null;

  // Indirect representative
  indirect_customs_rep_name?: string | null;
  indirect_customs_rep_tax_number?: string | null;

  // GL entry linkage
  gl_journal_header_id?: string | null;
  notes?: string | null;

  created_at?: string;
  updated_at?: string;
}

export interface ImportCustomsFormData {
  declaration_number: string;
  customs_office_code: string;
  decision_date: string;
  tax_period_date: string;
  procedure_type: ImportProcedureType;
  status: ImportDeclarationStatus;

  foreign_supplier_invoice_id?: string | null;
  foreign_supplier_name: string;
  foreign_currency: string;
  foreign_invoice_amount: number;

  customs_exchange_rate: number;
  customs_value_huf: number;
  customs_duty_huf: number;
  other_import_costs_huf: number;
  vat_base_huf: number;

  vat_code: string;
  vat_rate_percent: number;
  vat_amount_huf: number;
  is_deductible: boolean;

  payment_status: ImportPaymentStatus;
  payment_date?: string | null;
  bank_transaction_ref: string;

  indirect_customs_rep_name?: string;
  indirect_customs_rep_tax_number?: string;
  notes: string;
}
