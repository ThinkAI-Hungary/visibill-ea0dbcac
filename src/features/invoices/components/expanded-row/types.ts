import type { NettingGroup } from '@/hooks/useNettingDetection';

export interface MatchedSubmittedInvoice {
  id: string;
  bizonylatsorszam: string | null;
  kibocsatas_datuma: string;
  elado_nev: string;
  vevo_nev: string;
  brutto_vegosszeg: number;
  penznem: string | null;
  image_url: string | null;
  melleklet_url: string | null;
  invoice_type?: string | null;
  category_id?: string | null;
  project_id?: string | null;
}

export interface MatchedNavInvoice {
  id: string;
  invoice_number: string;
  invoice_issue_date: string | null;
  supplier_name: string | null;
  customer_name: string | null;
  invoice_gross_amount: number | null;
  currency: string | null;
  transaction_id: string | null;
  submitted: boolean | null;
}

export interface MatchedTransaction {
  id: string;
  transaction_date: string;
  amount: number;
  description: string | null;
  currency: string | null;
  type: string | null;
  confidence_score: number | null;
  match_type: string | null;
  is_verified: boolean | null;
  reason: string | null;
}

export interface LinkedInvoice {
  id: string;
  bizonylatsorszam: string | null;
  kibocsatas_datuma: string;
  elado_nev: string;
  vevo_nev: string;
  brutto_vegosszeg: number;
  penznem: string | null;
  image_url?: string | null;
  melleklet_url?: string | null;
  reference_number?: string | null;
  invoice_type?: string | null;
  relationDirection?: 'parent' | 'child';
}

export interface MatchedCourierReport {
  id: string;
  report_type: string;
  package_number: string | null;
  reference_number: string | null;
  delivery_date: string | null;
  cod_amount: number | null;
  recipient_name: string | null;
  matched_nav_invoice_id: string | null;
  matched_transaction_id: string | null;
}

export interface InvoiceNote {
  id: string;
  title: string | null;
  content: string;
  is_private: boolean;
  created_at: string;
  user_id: string;
  profile_name: string;
}

export interface ExpandedInvoiceRowProps {
  colSpan: number;
  matchedSubmittedInvoices: MatchedSubmittedInvoice[];
  matchedNavInvoices: MatchedNavInvoice[];
  matchedTransactions: MatchedTransaction[];
  linkedInvoices?: LinkedInvoice[];
  invoiceReferenceNumber?: string | null;
  linkedInvoicesLoading?: boolean;
  onViewInvoice?: (invoice: MatchedSubmittedInvoice) => void;
  onViewNavItems?: (invoice: MatchedNavInvoice) => void;
  matchedCourierReports?: MatchedCourierReport[];
  /** When true, show inline collapsible tx list inside invoice cards instead of standalone cards */
  hideStandaloneTransactions?: boolean;
  /** Invoice exclude from accounting state */
  excludeFromAccounting?: boolean;
  /** Callback to toggle exclude from accounting */
  onToggleExclude?: () => void;
  // ── Invoice-side transaction matching props ──
  /** Invoice ID for matching (enables matching UI when set) */
  invoiceId?: string;
  /** Invoice gross amount (for proximity sorting) */
  invoiceAmount?: number;
  /** Invoice currency */
  invoiceCurrency?: string;
  /** Invoice issue date (for ±180 day window) */
  invoiceDate?: string;
  /** Company ID for transaction search */
  companyId?: string;
  /** Called after successful match/unmatch/verify operations */
  onMatchUpdate?: () => void;
  glNumbers?: string | null;
  hasSubmittedMatch?: boolean;
  /** Categories list for badge lookup */
  categories?: Array<{ id: string; name: string; color?: string | null }>;
  /** Projects list for badge lookup */
  projects?: Array<{ id: string; name: string; color?: string | null }>;
  /** Netting group data if this invoice is part of a netting (kompenzálás) group */
  nettingGroup?: NettingGroup | null;
  /** Continuous service data */
  isContinuous?: boolean;
  servicePeriodStart?: string | null;
  servicePeriodEnd?: string | null;
  calculatedTi?: string | null;
  tiOverride?: string | null;
  tiCalculationMethod?: string | null;
  transactionId?: string;
  invoiceSource?: 'submitted' | 'nav';
  /** invoice_operation mező (NAV sztornó detektálásához) */
  invoiceOperation?: string | null;
  /** is_manual_payment flag (sztornó lezárás state-jéhez) */
  isManualPayment?: boolean | null;
  /** invoice_number (sztornó dialog szövegéhez) */
  invoiceNumber?: string;
  // ── NAV Online Számla Cross-Check & Approval Gate ──
  navStatus?: string;
  statusz?: string;
  approvedAt?: string | null;
  approvalNote?: string | null;
  onOpenApprovalDialog?: () => void;
}
