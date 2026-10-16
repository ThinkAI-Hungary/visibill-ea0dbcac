import { supabase } from '@/integrations/supabase/client';
import type {
  CompanyCar,
  CompanyCarTaxPayment,
  CreateCompanyCarInput,
  RecordVehicleTaxPaymentInput,
  QuarterTaxCalculation,
  CarEnvironmentalCategory,
} from '@/types/company-car-tax';

/**
 * Hatályos Gjt. szerinti havi cégautóadó tétel kiszámítása kW és környezetvédelmi kategória alapján.
 */
export function calculateMonthlyCompanyCarTaxRate(
  enginePowerKw: number,
  category: CarEnvironmentalCategory,
  isTaxExempt: boolean = false
): number {
  if (isTaxExempt || category === 'GREEN_ELECTRIC') {
    return 0;
  }

  const kw = Math.max(0, enginePowerKw);

  if (category === 'EURO_5_6') {
    if (kw <= 50) return 14000;
    if (kw <= 90) return 19800;
    if (kw <= 120) return 26200;
    return 41000;
  }

  if (category === 'EURO_3_4') {
    if (kw <= 50) return 16500;
    if (kw <= 90) return 24000;
    if (kw <= 120) return 32000;
    return 52000;
  }

  // EURO_0_2 és egyéb régebbi kategóriák
  if (kw <= 50) return 22000;
  if (kw <= 90) return 34000;
  if (kw <= 120) return 46000;
  return 81000;
}

const HUNGARIAN_MONTH_NAMES = [
  'Január', 'Február', 'Március', 'Április', 'Május', 'Június',
  'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December'
];

/**
 * Meghatározza egy adott hónapra (1-12) egy adott évben, hogy fennáll-e a cégautóadó kötelezettség.
 */
export function isMonthTaxable(
  year: number,
  month: number, // 1-12
  liabilityFrom: string,
  liabilityTo?: string | null
): boolean {
  // A hónap első és utolsó napja YYYY-MM-DD formátumban
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  // Ha a kötelezettség kezdete a hónap vége után van, nem adóköteles
  if (liabilityFrom > monthEnd) {
    return false;
  }

  // Ha van kötelezettség vége és az a hónap kezdete előtt volt, nem adóköteles
  if (liabilityTo && liabilityTo < monthStart) {
    return false;
  }

  return true;
}

/**
 * Negyedéves cégautóadó esedékességi dátuma
 */
export function getQuarterDueDate(year: number, quarter: 1 | 2 | 3 | 4): string {
  switch (quarter) {
    case 1:
      return `${year}-04-20`;
    case 2:
      return `${year}-07-20`;
    case 3:
      return `${year}-10-20`;
    case 4:
      return `${year + 1}-01-20`;
  }
}

/**
 * Gépjárműadó (súlyadó) törvényi esedékessége az adott negyedévre (I. félév: ápr 15, II. félév: szept 15)
 */
export function getVehicleTaxDueDate(year: number, quarter: 1 | 2 | 3 | 4): string {
  if (quarter === 1 || quarter === 2) {
    return `${year}-04-15`;
  }
  return `${year}-09-15`;
}

/**
 * Kiszámítja egy autó negyedéves cégautóadóját a befizetett gépjárműadó levonásával.
 */
export function calculateCarQuarterTax(
  car: Pick<CompanyCar, 'tax_liability_from' | 'tax_liability_to' | 'monthly_tax_rate' | 'is_tax_exempt' | 'engine_power_kw' | 'environmental_category'>,
  taxYear: number,
  quarter: 1 | 2 | 3 | 4,
  payments: CompanyCarTaxPayment[] = []
): QuarterTaxCalculation {
  const startMonth = (quarter - 1) * 3 + 1;
  const quarterMonths = [startMonth, startMonth + 1, startMonth + 2];

  const rate = car.monthly_tax_rate > 0
    ? car.monthly_tax_rate
    : calculateMonthlyCompanyCarTaxRate(car.engine_power_kw, car.environmental_category, car.is_tax_exempt);

  const monthsActive = quarterMonths.map(month => {
    const isTaxable = isMonthTaxable(taxYear, month, car.tax_liability_from, car.tax_liability_to);
    return {
      month,
      monthName: HUNGARIAN_MONTH_NAMES[month - 1],
      isTaxable,
      monthlyTaxRate: isTaxable ? rate : 0,
    };
  });

  const activeMonthsCount = monthsActive.filter(m => m.isTaxable).length;
  const grossQuarterlyTax = activeMonthsCount * rate;

  // Releváns gépjárműadó befizetések vizsgálata
  const relevantPayments = payments.filter(
    p => p.tax_year === taxYear && p.quarter === quarter
  );

  let deductibleVehicleTax = 0;
  let latePaidVehicleTax = 0;

  for (const payment of relevantPayments) {
    // Ha időben történt (fizetés dátuma <= esedékesség) és dedukálható
    if (payment.is_deductible && payment.payment_date <= payment.due_date) {
      deductibleVehicleTax += Number(payment.paid_amount || 0);
    } else {
      latePaidVehicleTax += Number(payment.paid_amount || 0);
    }
  }

  // A cégautóadó fizetési kötelezettség nem mehet 0 alá járművenként
  const netPayableTax = Math.max(0, grossQuarterlyTax - deductibleVehicleTax);

  return {
    quarter,
    taxYear,
    activeMonthsCount,
    grossQuarterlyTax,
    deductibleVehicleTax,
    latePaidVehicleTax,
    netPayableTax,
    dueDate: getQuarterDueDate(taxYear, quarter),
    monthsActive,
  };
}

// ── Adatbázis Műveletek ───────────────────────────────────────────────────────

export async function fetchCompanyCars(companyId: string): Promise<CompanyCar[]> {
  const { data, error } = await supabase
    .from('company_cars')
    .select(`
      *,
      fixed_asset:fixed_assets(id, inventory_number, name, status, disposal_date)
    `)
    .eq('company_id', companyId)
    .order('license_plate', { ascending: true });

  if (error) {
    throw new Error(`Nem sikerült betölteni a gépjárműveket: ${error.message}`);
  }

  return (data || []) as CompanyCar[];
}

export async function fetchCompanyCarTaxPayments(
  companyId: string,
  taxYear: number
): Promise<CompanyCarTaxPayment[]> {
  const { data, error } = await supabase
    .from('company_car_tax_payments')
    .select('*')
    .eq('company_id', companyId)
    .eq('tax_year', taxYear)
    .order('payment_date', { ascending: true });

  if (error) {
    throw new Error(`Nem sikerült betölteni a gépjárműadó befizetéseket: ${error.message}`);
  }

  return (data || []) as CompanyCarTaxPayment[];
}

export async function createCompanyCar(input: CreateCompanyCarInput): Promise<CompanyCar> {
  const monthlyRate = input.monthly_tax_rate !== undefined
    ? input.monthly_tax_rate
    : calculateMonthlyCompanyCarTaxRate(input.engine_power_kw, input.environmental_category, input.is_tax_exempt);

  const { data, error } = await supabase
    .from('company_cars')
    .insert({
      company_id: input.company_id,
      license_plate: input.license_plate.toUpperCase().trim(),
      ownership_type: input.ownership_type,
      fixed_asset_id: input.fixed_asset_id || null,
      make_and_model: input.make_and_model?.trim() || null,
      engine_power_kw: input.engine_power_kw,
      environmental_category: input.environmental_category,
      tax_liability_from: input.tax_liability_from,
      tax_liability_to: input.tax_liability_to || null,
      monthly_tax_rate: monthlyRate,
      is_tax_exempt: !!input.is_tax_exempt,
      notes: input.notes?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Nem sikerült rögzíteni a céges személygépkocsit: ${error.message}`);
  }

  return data as CompanyCar;
}

export async function updateCompanyCar(
  carId: string,
  companyId: string,
  updates: Partial<CreateCompanyCarInput>
): Promise<CompanyCar> {
  const payload: any = { ...updates };
  if (payload.license_plate) {
    payload.license_plate = payload.license_plate.toUpperCase().trim();
  }

  if (payload.engine_power_kw !== undefined && payload.environmental_category) {
    payload.monthly_tax_rate = calculateMonthlyCompanyCarTaxRate(
      payload.engine_power_kw,
      payload.environmental_category,
      payload.is_tax_exempt
    );
  }

  const { data, error } = await supabase
    .from('company_cars')
    .update(payload)
    .eq('id', carId)
    .eq('company_id', companyId)
    .select()
    .single();

  if (error) {
    throw new Error(`Nem sikerült frissíteni a gépjárművet: ${error.message}`);
  }

  return data as CompanyCar;
}

export async function recordVehicleTaxPayment(
  input: RecordVehicleTaxPaymentInput
): Promise<CompanyCarTaxPayment> {
  const isDeductible = input.payment_date <= input.due_date;

  const { data, error } = await supabase
    .from('company_car_tax_payments')
    .insert({
      company_id: input.company_id,
      car_id: input.car_id,
      tax_year: input.tax_year,
      quarter: input.quarter,
      paid_amount: input.paid_amount,
      payment_date: input.payment_date,
      due_date: input.due_date,
      is_deductible: isDeductible,
      notes: input.notes?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Nem sikerült rögzíteni a gépjárműadó befizetést: ${error.message}`);
  }

  return data as CompanyCarTaxPayment;
}

export async function deleteCompanyCar(carId: string, companyId: string): Promise<void> {
  const { error } = await supabase
    .from('company_cars')
    .delete()
    .eq('id', carId)
    .eq('company_id', companyId);

  if (error) {
    throw new Error(`Nem sikerült törölni a gépjárművet: ${error.message}`);
  }
}
