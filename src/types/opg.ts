/**
 * Online Pénztárgép (OPG) típusdefiníciók
 * eaisyBILL - Online Cash Register Module
 */

export type OpgRegisterStatus = 'active' | 'suspended' | 'error' | 'disconnected';

export type OpgCashBookingMode = 'daily_z_summary' | 'itemized_receipt';

export type OpgTransactionType = 'receipt' | 'simplified_invoice' | 'z_report' | 'storno' | 'refund';

export type OpgProcessingStatus = 'new' | 'processed' | 'error' | 'skipped';

export type OpgSyncStatus = 'running' | 'success' | 'partial' | 'failed';

export interface OpgPaymentBreakdown {
  cash: number;
  card: number;
  szep_card: number;
  voucher: number;
  other: number;
}

export interface OpgVatDetail {
  net: number;
  vat: number;
  gross: number;
}

export interface OpgVatBreakdown {
  vat_27?: OpgVatDetail;
  vat_18?: OpgVatDetail;
  vat_5?: OpgVatDetail;
  vat_aam?: OpgVatDetail;
  vat_tam?: OpgVatDetail;
  [key: string]: OpgVatDetail | undefined;
}

export interface OpgCashRegister {
  id: string;
  company_id: string;
  ap_code: string;
  name: string;
  location: string | null;
  status: OpgRegisterStatus;
  petty_cash_register_id: string | null;
  cash_booking_mode: OpgCashBookingMode;
  sync_interval_minutes: number;
  last_successful_sync_at: string | null;
  last_failed_sync_at: string | null;
  last_error_message: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  petty_cash_register?: {
    id: string;
    name: string;
    is_default: boolean;
  } | null;
}

export interface OpgTransaction {
  id: string;
  company_id: string;
  opg_id: string;
  external_transaction_id: string;
  receipt_number: string;
  transaction_date: string; // YYYY-MM-DD
  transaction_time: string; // HH:mm:ss
  transaction_type: OpgTransactionType;
  total_gross_amount: number;
  cash_amount: number;
  card_amount: number;
  szep_card_amount: number;
  voucher_amount: number;
  other_payment_amount: number;
  payment_method_breakdown: OpgPaymentBreakdown;
  vat_breakdown: OpgVatBreakdown;
  processing_status: OpgProcessingStatus;
  cash_entry_id: string | null;
  source_payload?: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  cash_register?: Pick<OpgCashRegister, 'id' | 'name' | 'ap_code'> | null;
}

export interface OpgSyncLog {
  id: string;
  company_id: string;
  opg_id: string | null;
  started_at: string;
  finished_at: string | null;
  period_from: string | null;
  period_to: string | null;
  records_fetched: number;
  records_new: number;
  records_duplicated: number;
  records_errors: number;
  status: OpgSyncStatus;
  error_message: string | null;
  created_by?: string | null;
  cash_register?: Pick<OpgCashRegister, 'id' | 'name' | 'ap_code'> | null;
}

export interface OpgTransactionFilter {
  opg_id?: string;
  startDate?: string;
  endDate?: string;
  type?: OpgTransactionType | 'all';
  status?: OpgProcessingStatus | 'all';
  search?: string;
}

export interface OpgDailySummary {
  date: string;
  gross_total: number;
  cash_total: number;
  card_total: number;
  other_total: number;
  receipt_count: number;
  z_report_count: number;
  storno_count: number;
}

export interface OpgTurnoverKpi {
  totalGross: number;
  totalCash: number;
  totalCard: number;
  otherTotal: number;
  transactionCount: number;
  zReportCount: number;
  pendingCashBookingCount: number;
  activeRegisterCount: number;
}

export interface CreateOpgRegisterInput {
  company_id: string;
  ap_code: string;
  name: string;
  location?: string | null;
  petty_cash_register_id?: string | null;
  cash_booking_mode?: OpgCashBookingMode;
  sync_interval_minutes?: number;
  status?: OpgRegisterStatus;
}

export interface UpdateOpgRegisterInput extends Partial<CreateOpgRegisterInput> {
  id: string;
}
