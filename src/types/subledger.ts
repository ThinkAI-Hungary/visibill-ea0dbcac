export type SubledgerMode = 'OPEN' | 'CLOSED' | 'ALL';

export type SubledgerStatusFilter = 'ALL_ACTIVE' | 'POSTED_ONLY' | 'DRAFT_ONLY';

export type SubledgerType = 'none' | 'partner' | 'detail';

export interface SubledgerLineDetail {
  id: string;
  sequence_number: number;
  gl_account_id: string;
  gl_number: string;
  gl_short_name: string;
  dc_type: 'T' | 'K';
  amount: number;
  foreign_amount?: number | null;
  vat_role?: string | null;
  vat_code?: string | null;
  description?: string | null;
}

export interface SubledgerItem {
  line_id: string;
  header_id: string;
  posting_date: string;
  document_date: string;
  due_date: string;
  document_id: string;
  settlement_number: string;
  partner_id: string | null;
  partner_name: string;
  gl_account_id: string;
  gl_number: string;
  gl_short_name: string;
  dc_type: 'T' | 'K';
  amount: number;
  gross_amount?: number;
  net_amount: number;
  vat_amount: number;
  foreign_amount: number | null;
  currency: string;
  exchange_rate?: number | null;
  settled_amount: number;
  remaining_amount: number;
  is_settled: boolean;
  match_count: number;
  description: string | null;
  status: string;
  journal_code: string;
  journal_number: number;
  import_key: string | null;
  all_lines?: SubledgerLineDetail[];
}

export interface GroupedSubledgerInvoice {
  group_key: string;
  document_id: string;
  partner_id: string | null;
  partner_name: string;
  posting_date: string;
  document_date: string;
  due_date: string;
  journal_code: string;
  journal_number: number;
  currency: string;
  exchange_rate?: number | null;
  description: string | null;
  status: string;
  is_settled: boolean;
  net_amount: number;
  vat_amount: number;
  amount: number;
  foreign_amount?: number | null;
  foreign_net_amount?: number | null;
  foreign_vat_amount?: number | null;
  foreign_settled_amount?: number | null;
  foreign_remaining_amount?: number | null;
  settled_amount: number;
  remaining_amount: number;
  match_count: number;
  items: SubledgerItem[];
  header_ids: string[];
  line_ids: string[];
  all_lines: SubledgerLineDetail[];
}

export interface SubledgerItemMatch {
  match_id: string;
  settled_amount_huf: number;
  settled_amount_foreign: number | null;
  currency: string;
  settled_at: string;
  match_type: string;
  notes: string | null;
  other_line_id: string;
  other_header_id: string;
  other_document_id: string;
  other_posting_date: string;
  other_dc_type: 'T' | 'K';
  other_amount: number;
  other_journal_code: string;
  other_description: string | null;
}

export interface SettleParams {
  companyId: string;
  invoiceLineId: string;
  settlingLineId: string;
  amountHuf: number;
  amountForeign?: number | null;
  matchType?: string;
  notes?: string | null;
}

export interface WriteOffParams {
  companyId: string;
  lineId: string;
  type: 'ROUNDING' | 'FX_DIFFERENCE';
  amountHuf: number;
  targetGlId?: string | null;
  description?: string | null;
}
