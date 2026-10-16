export type CarOwnershipType = 'OWNED' | 'RENTED' | 'LEASED' | 'PRIVATE_OPERATED';

export const CAR_OWNERSHIP_LABELS: Record<CarOwnershipType, string> = {
  OWNED: 'Saját tulajdonú cégautó',
  RENTED: 'Bérelt személygépkocsi',
  LEASED: 'Lízingelt személygépkocsi (pénzügyi/operatív)',
  PRIVATE_OPERATED: 'Magánszemélytől bérelt / kiküldetéses',
};

export type CarEnvironmentalCategory = 'EURO_5_6' | 'EURO_3_4' | 'EURO_0_2' | 'GREEN_ELECTRIC';

export const ENVIRONMENTAL_CATEGORY_LABELS: Record<CarEnvironmentalCategory, string> = {
  EURO_5_6: 'Korszerű (Euro 5, Euro 6 / V.9 kód ≥ 13)',
  EURO_3_4: 'Közepes (Euro 3, Euro 4 / V.9 kód 6–10)',
  EURO_0_2: 'Korszerűtlen (Euro 0, 1, 2 / V.9 kód 0–4)',
  GREEN_ELECTRIC: 'Környezetkímélő / Tisztán elektromos (5E/5Z kód – Mentes)',
};

export interface CompanyCar {
  id: string;
  company_id: string;
  license_plate: string;
  ownership_type: CarOwnershipType;
  fixed_asset_id: string | null;
  make_and_model: string | null;
  engine_power_kw: number;
  environmental_category: CarEnvironmentalCategory;
  tax_liability_from: string;
  tax_liability_to: string | null;
  monthly_tax_rate: number;
  is_tax_exempt: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  fixed_asset?: {
    id: string;
    inventory_number: string;
    name: string;
    status: string;
    disposal_date: string | null;
  } | null;
}

export interface CompanyCarTaxPayment {
  id: string;
  company_id: string;
  car_id: string;
  tax_year: number;
  quarter: 1 | 2 | 3 | 4;
  paid_amount: number;
  payment_date: string;
  due_date: string;
  is_deductible: boolean;
  notes: string | null;
  created_at: string;
}

export interface CreateCompanyCarInput {
  company_id: string;
  license_plate: string;
  ownership_type: CarOwnershipType;
  fixed_asset_id?: string | null;
  make_and_model?: string | null;
  engine_power_kw: number;
  environmental_category: CarEnvironmentalCategory;
  tax_liability_from: string;
  tax_liability_to?: string | null;
  monthly_tax_rate?: number;
  is_tax_exempt?: boolean;
  notes?: string | null;
}

export interface RecordVehicleTaxPaymentInput {
  company_id: string;
  car_id: string;
  tax_year: number;
  quarter: 1 | 2 | 3 | 4;
  paid_amount: number;
  payment_date: string;
  due_date: string;
  notes?: string | null;
}

export interface QuarterTaxCalculation {
  quarter: 1 | 2 | 3 | 4;
  taxYear: number;
  activeMonthsCount: number;
  grossQuarterlyTax: number;
  deductibleVehicleTax: number;
  latePaidVehicleTax: number;
  netPayableTax: number;
  dueDate: string;
  monthsActive: Array<{
    month: number;
    monthName: string;
    isTaxable: boolean;
    monthlyTaxRate: number;
  }>;
}
