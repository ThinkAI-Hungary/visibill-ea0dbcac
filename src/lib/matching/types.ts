// ── Domain Types for Transaction & Invoice Matching ──

export interface MatchedInvoice {
  id: string;
  bizonylatsorszam: string | null;
  kibocsatas_datuma: string;
  teljesites_datuma: string | null;
  elado_nev: string;
  vevo_nev: string;
  brutto_vegosszeg: number;
  penznem: string | null;
  invoice_type: string;
  invoice_direction?: string | null;
  transaction_id?: string | null;
  fizetve?: boolean | null;
  match_status?: string | null;
  paid_amount?: number | null;
  remaining_amount?: number | null;
}

export interface MatchedNavInvoice {
  id: string;
  invoice_number: string;
  invoice_issue_date: string | null;
  supplier_name: string | null;
  customer_name: string | null;
  invoice_gross_amount: number | null;
  currency: string | null;
  invoice_direction: string | null;
  transaction_id: string | null;
  submitted: boolean | null;
  match_status?: string | null;
  paid_amount?: number | null;
  remaining_amount?: number | null;
}

export interface MatchedSalary {
  id: string;
  név: string;
  összeg: number;
  tipus: string;
  fizetesi_mod: string;
  transaction_id: string | null;
  dátum: string | null;
  munkavallalo_neve: string | null;
  megjegyzes: string | null;
}

export interface MatchedCourierReport {
  id: string;
  report_type: string;
  package_number: string | null;
  reference_number: string | null;
  delivery_date: string | null;
  cod_amount: number | null;
  recipient_name: string | null;
  match_status: string;
  match_confidence: number | null;
}

export interface AvailableInvoice {
  id: string;
  bizonylatsorszam: string;
  brutto_vegosszeg: number;
  elado_nev: string;
  penznem: string | null;
  kibocsatas_datuma: string;
  already_paid: number;
  remaining: number;
}

export interface AvailableTransaction {
  id: string;
  transaction_date: string;
  amount: number;
  description: string | null;
  currency: string | null;
  type: string | null;
  matched_invoice_id: string | null;
  confidence_score: number | null;
  match_type: string | null;
  is_verified: boolean | null;
}

export interface ExtraMatchItem {
  id: string;
  invoice_id: string;
  invoice_source: 'submitted' | 'nav' | string;
  invoice?: MatchedInvoice | null;
  navInvoice?: MatchedNavInvoice | null;
}

export interface TransactionItem {
  id: string;
  transaction_date: string;
  description: string | null;
  amount: number;
  currency: string | null;
  type: string | null;
  matched_invoice_id: string | null;
  confidence_score: number | null;
  is_verified: boolean | null;
  match_type: string | null;
  reason: string | null;
  created_at: string | null;
  company_id: string | null;
  gl_account_id: string | null;
  gl_accounts?: {
    id: string;
    gl_number: string;
    short_name: string;
  } | null;
}

export interface MatchOverridePayload {
  companyId: string;
  transactionId: string;
  originalInvoiceId: string | null;
  originalMatchType: string | null;
  correctedInvoiceId: string | null;
  correctedMatchType: string;
  transactionDescription: string;
  transactionAmount: number;
  originalPartnerName: string | null;
  correctedPartnerName: string | null;
  userId?: string | null;
}

export interface BookTransactionGlPayload {
  transactionId: string;
  companyId: string;
  userId: string;
  presetId: string;
  selectedGlId: string;
  newGlNumber: string;
  originalGlAccountId: string | null;
}
