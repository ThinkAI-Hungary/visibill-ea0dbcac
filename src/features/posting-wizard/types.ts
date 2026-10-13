export type PostingMode = 'wizard' | 'auto';
export type RuleScopeOption = 'company' | 'tenant' | 'none';

export interface PostingItem {
  item_id: string;
  source_table: 'nav_invoice_items' | 'invoice_items';
  invoice_id: string;
  invoice_number: string;
  invoice_direction: 'INBOUND' | 'OUTBOUND';
  invoice_date: string;
  partner_name: string;
  partner_tax_number: string;
  line_number: number;
  line_description: string;
  net_amount: number;
  vat_amount: number;
  gross_amount: number;
  vat_rate: string;
  vat_code: string;
  currency: string;
  suggested_gl_account_id: string | null;
  suggested_gl_number: string;
  suggested_gl_name: string;
  rule_name: string | null;
  reasoning: string | null;
  is_approved: boolean;
}

export interface PostingGroup {
  gl_number: string;
  gl_name: string;
  gl_account_id: string | null;
  items: PostingItem[];
  total_net_amount: number;
  total_count: number;
  approved_count: number;
}

export interface PostingSummary {
  pending_item_count: number;
  pending_invoice_count: number;
  total_net_amount: number;
  currency: string;
}

export interface RuleToCreate {
  description_pattern: string;
  partner_tax_number?: string;
  partner_name?: string;
  target_gl_account_id: string;
  target_gl_number: string;
  target_vat_code_id?: string;
  target_vat_code?: string;
  direction?: 'INBOUND' | 'OUTBOUND' | 'ALL';
  name?: string;
}
