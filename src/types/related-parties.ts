export type RelationType = 'parent' | 'subsidiary' | 'sister' | 'owner_interest' | 'other';

export const RELATION_TYPE_LABELS: Record<RelationType, string> = {
  parent: 'Anyavállalat',
  subsidiary: 'Leányvállalat',
  sister: 'Közös vezetésű / Testvérvállalat',
  owner_interest: 'Tulajdonos egyéb érdekeltsége',
  other: 'Egyéb kapcsolt viszony',
};

export const RELATION_TYPE_COLORS: Record<RelationType, { bg: string; text: string; border: string }> = {
  parent: { bg: 'bg-indigo-500/10', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-500/20' },
  subsidiary: { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/20' },
  sister: { bg: 'bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500/20' },
  owner_interest: { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/20' },
  other: { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border' },
};

export interface RelatedPartnerFields {
  related_party?: boolean;
  relation_type?: RelationType | null;
  ownership_percent?: number | null;
  valid_from?: string | null;
  valid_to?: string | null;
  parent_partner_id?: string | null;
  custom_gl_account_id?: string | null;
  related_party_notes?: string | null;
}

export interface RelatedPartyInvoiceItem {
  id: string;
  source: 'nav' | 'uploaded';
  invoice_number: string;
  issue_date: string;
  delivery_date: string;
  due_date?: string | null;
  direction: 'inbound' | 'outbound';
  net_amount: number;
  vat_amount: number;
  gross_amount: number;
  currency: string;
  payment_method: string;
  is_cash: boolean;
  paid: boolean;
}

export interface RelatedPartyTurnoverItem {
  partnerId: string;
  partnerName: string;
  taxNumber: string;
  relationType: RelationType;
  ownershipPercent?: number | null;
  validFrom?: string | null;
  validTo?: string | null;
  parentPartnerName?: string | null;
  customGlAccount?: { gl_number: string; short_name: string } | null;
  // Outbound (Vevői / Árbevétel)
  outboundCount: number;
  outboundNet: number;
  outboundVat: number;
  outboundGross: number;
  // Inbound (Szállítói / Költség)
  inboundCount: number;
  inboundNet: number;
  inboundVat: number;
  inboundGross: number;
  // Balances
  totalGrossTurnover: number;
  netBalance: number; // Outbound Gross - Inbound Gross (pozitív: nekünk tartoznak, negatív: mi tartozunk)
  // Cash monitoring (Art. 114. § havi 1,5M Ft)
  monthlyCashGross: number;
  isCashLimitExceeded: boolean;
  // Transfer pricing check (Tao. tv. 18. § 100M Ft)
  isTransferPricingDocRequired: boolean;
  invoices: RelatedPartyInvoiceItem[];
}

export interface RelatedPartyTurnoverTotals {
  partnerCount: number;
  totalOutboundGross: number;
  totalInboundGross: number;
  totalGrossTurnover: number;
  totalNetBalance: number;
  cashExceededPartnerCount: number;
  transferPricingRequiredCount: number;
}
