// Shared types for TAO wizard step components

export interface TaoFormData {
  revenue: number;
  other_revenue: number;
  material_costs: number;
  personnel_costs: number;
  depreciation: number;
  other_costs: number;
  financial_result: number;
  decreasing: Record<string, number>;
  increasing: Record<string, number>;
  interest_expense: number;
  has_cfc: boolean;
  cfc_country: string;
  cfc_company: string;
  cfc_income: number;
  cfc_tax_rate: number;
  credits: Record<string, number>;
  donations: Record<string, number>;
  advance_payments: number;
}

export interface TaoComputed {
  totalRevenue: number;
  totalCosts: number;
  aee: number;
  decreasingTotal: number;
  increasingTotal: number;
  ebitda: number;
  interestLimit: number;
  interestAdjustment: number;
  modifiedTaxBase: number;
  taxBase: number;
  calculatedTax: number;
  creditsTotal: number;
  donationsTotal: number;
  effectiveDonations: number;
  maxDonation: number;
  payableTax: number;
}

export interface TaoStepProps {
  data: TaoFormData;
  computed: TaoComputed;
  upd: (key: string, val: any) => void;
  updItem: (group: 'decreasing' | 'increasing' | 'credits' | 'donations', key: string, val: number) => void;
}
