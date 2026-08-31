export interface AnnualReport {
  id: string;
  company_id: string;
  preset_id: string;
  fiscal_year: number;
  status: string;
  representative_name: string | null;
  representative_role: string | null;
  report_date: string | null;
  frozen_bs_data: any[] | null;
  frozen_pnl_data: any[] | null;
  frozen_at: string | null;
  validation_results: any[];
  validated_at: string | null;
  notes_sections: any[];
  net_income: number;
  dividend_amount: number;
  retained_earnings: number;
  dividend_resolution_date: string | null;
  dividend_resolution_number: string | null;
  created_at: string;
  updated_at: string;
  accounting_method?: string | null;
}

export interface ValidationResult {
  rule_id: string;
  rule_name: string;
  passed: boolean;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

export interface AnnualReportStep {
  id: number;
  title: string;
  icon: any;
  description: string;
}

export interface SalaryMetrics {
  headcount: number;
  totalWages: number;
  totalContrib: number;
  total: number;
}

export interface AssetMovementSummary {
  total: number;
  active: number;
  disposed: number;
  totalAcquisition: number;
  activeAcquisition: number;
}

export interface EquityRowItem {
  bs_structure_id?: string;
  row_code?: string;
  name?: string;
  prior_year_balance?: number | string;
  current_balance?: number | string;
  section?: string;
  type?: string;
}

export interface FinancialMetrics {
  totalAssets: number;
  totalLiabilities: number;
  equityTotal: number;
  equityPrior: number;
  equityChange: 'növekedett' | 'csökkent';
  roe: string;
  liquidity: string;
  liquidityEval: string;
  netIncome: number;
}

export interface NotesSectionItem {
  section_key: string;
  title?: string;
  text: string;
  is_custom?: boolean;
}

export interface NotesTemplateItem {
  id?: string;
  section_key: string;
  section_title: string;
  is_required: boolean;
  default_text: string;
  order_num?: number;
}
