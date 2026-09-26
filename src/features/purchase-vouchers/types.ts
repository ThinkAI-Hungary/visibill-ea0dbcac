export interface PurchaseVoucherItem {
  id?: string;
  voucher_id?: string;
  company_id?: string;
  item_name: string;
  vtszt_kn_code?: string | null;
  quantity: number;
  unit_of_measure: string;
  unit_price: number;
  net_amount: number;
  compensation_rate: number;
  compensation_amount: number;
  gross_amount: number;
}

export interface PurchaseVoucher {
  id: string;
  company_id: string;
  voucher_number: string;
  producer_name: string;
  producer_tax_id?: string | null;
  producer_card_number?: string | null;
  producer_address?: string | null;
  producer_bank_account?: string | null;
  issue_date: string;
  fulfillment_date: string;
  payment_due_date?: string | null;
  payment_method: 'CASH' | 'TRANSFER';
  net_amount: number;
  compensation_surcharge_rate: number;
  compensation_surcharge_amount: number;
  gross_amount: number;
  tax_deducted: number;
  paid_amount: number;
  payment_status: 'unpaid' | 'paid';
  paid_at?: string | null;
  payroll_period?: string | null;
  payroll_processed: boolean;
  description?: string | null;
  document_url?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  items?: PurchaseVoucherItem[];
}

export interface PurchaseVouchersSummary {
  total_count: number;
  total_net: number;
  total_compensation: number;
  total_gross: number;
  unpaid_gross: number;
  paid_gross: number;
  unique_producers: number;
}

export interface PurchaseVoucherFormData {
  voucher_number: string;
  producer_name: string;
  producer_tax_id?: string;
  producer_card_number?: string;
  producer_address?: string;
  producer_bank_account?: string;
  issue_date: string;
  fulfillment_date: string;
  payment_due_date?: string;
  payment_method: 'CASH' | 'TRANSFER';
  compensation_surcharge_rate: number;
  description?: string;
  document_url?: string;
  tax_deducted?: number;
  payment_status?: 'unpaid' | 'paid';
  payroll_period?: string;
  items: Array<{
    id?: string;
    item_name: string;
    vtszt_kn_code?: string;
    quantity: number;
    unit_of_measure: string;
    unit_price: number;
  }>;
}
