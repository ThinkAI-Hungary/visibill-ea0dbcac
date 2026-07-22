// ── Petty Cash shared types, constants and utilities ──

export interface PettyCashRegister {
  id: string;
  company_id: string;
  name: string;
  location: string | null;
  currencies: string[];
  is_default: boolean;
  created_at: string;
}

export interface OpeningBalance {
  id: string;
  register_id: string;
  currency: string;
  amount: number;
  start_date: string | null;
}

export interface PettyCashEntry {
  id: string;
  company_id: string;
  register_id: string;
  entry_date: string;
  description: string | null;
  amount: number;
  currency: string;
  source_type: string;
  source_id: string | null;
  source_table: string | null;
  routed_by: string;
  created_at: string;
  partner_id: string | null;
}

/** Open (unpaid) outbound invoice available for cash settlement */
export interface OpenOutboundInvoice {
  id: string;
  bizonylatsorszam: string;
  vevo_nev: string;
  brutto_vegosszeg: number;
  kibocsatas_datuma: string;
  fizetesi_hatarido: string | null;
  penznem: string;
}

export interface RoutingRule {
  id: string;
  company_id: string;
  target_register_id: string;
  priority: number;
  match_currency: string | null;
  match_source_type: string | null;
  match_description_pattern: string | null;
  match_partner_pattern: string | null;
  is_active: boolean;
}

export interface SummaryRow {
  register_id: string;
  register_name: string;
  is_default: boolean;
  currency: string;
  opening_balance: number;
  start_date: string | null;
  total_income: number;
  total_expense: number;
  current_balance: number;
}

export const COMMON_CURRENCIES = ['HUF', 'EUR', 'USD', 'GBP', 'CHF', 'CZK', 'PLN', 'RON', 'HRK', 'RSD'];

export const SOURCE_LABELS: Record<string, string> = {
  withdrawal: 'KP felvétel',
  cash_deposit: 'KP befizetés',
  cash_sale: 'KP értékesítés',
  cash_expense: 'KP kiadás',
  manual: 'Manuális',
  transfer: 'Átvezetés',
  invoice_settlement: 'Számla rendezés',
};

export const SOURCE_COLORS: Record<string, string> = {
  withdrawal: 'bg-primary/10 text-primary',
  cash_deposit: 'bg-orange-500/10 text-orange-500',
  cash_sale: 'bg-emerald-500/10 text-emerald-500',
  cash_expense: 'bg-destructive/10 text-destructive',
  manual: 'bg-violet-500/10 text-violet-500',
  transfer: 'bg-sky-500/10 text-sky-500',
  invoice_settlement: 'bg-blue-500/10 text-blue-500',
};

/** Round HUF to nearest 5 */
export const roundHuf = (amount: number, currency: string): number => {
  if (currency !== 'HUF') return Math.round(amount * 100) / 100;
  return Math.round(amount / 5) * 5;
};

export const fmtAmount = (amount: number, currency: string): string => {
  const rounded = roundHuf(amount, currency);
  const formatted = Math.abs(rounded).toLocaleString('hu-HU', { maximumFractionDigits: currency === 'HUF' ? 0 : 2 });
  const sign = rounded >= 0 ? '+' : '-';
  return `${sign}${formatted} ${currency}`;
};

export const fmtBalance = (amount: number, currency: string): string => {
  const rounded = roundHuf(amount, currency);
  return `${rounded.toLocaleString('hu-HU', { maximumFractionDigits: currency === 'HUF' ? 0 : 2 })} ${currency}`;
};
