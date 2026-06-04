/**
 * Accounty Bérszámfejtési Modul — Adómotor (taxEngine)
 *
 * 2026-os magyar bérszámfejtési adómotor:
 * - 9 SZJA-kedvezmény jogszabályi érvényesítési sorrendben
 * - SZOCHO + SZOCHO-kedvezmények
 * - TB járulék (18.5%)
 * - Cafeteria-közteher kalkuláció
 * - Letiltás-számítás (Vht. 65.§)
 *
 * Jogszabályi háttér: Szja tv., Tbj., Szocho tv., Mt., Vht.
 */

// ── Típusok ──

export interface TaxParameters {
  szja_rate: number;           // 0.15
  tb_rate: number;             // 0.185
  szocho_rate: number;         // 0.13
  minimum_wage: number;        // 322800
  guaranteed_minimum: number;  // 373200

  // Családi kedvezmény (havi adóalap-csökkentés)
  family_1_child: number;      // 133340
  family_2_children: number;   // 266660
  family_3plus_children: number; // 440000

  // 25 év alattiak
  young_25_cap: number;        // 715765

  // Személyi kedvezmény
  personal_disability: number; // 107600

  // Első házasok
  first_marriage: number;      // 33335

  // EHO
  health_service_monthly: number; // 12300
}

export interface EmployeeDeclarations {
  /** 4+ gyermekes anyák (NÉTAK) - teljes SZJA-mentesség */
  netak?: { eligible: boolean };
  /** 3 gyermekes anyák */
  anyak3?: { eligible: boolean };
  /** 2 gyermekes anyák (40 év alatt, ÚJ 2026) */
  anyak2?: { eligible: boolean };
  /** 30 év alatti anyák */
  youngMother30?: { maxDeduction: number };
  /** 25 év alattiak */
  young25?: { eligible: boolean };
  /** Személyi kedvezmény (fogyatékosság) */
  personal?: { eligible: boolean };
  /** Első házasok */
  firstMarriage?: { eligible: boolean; monthsRemaining: number };
  /** Családi kedvezmény */
  family?: {
    dependentCount: number;      // eltartottak száma
    eligibleChildrenCount: number; // kedvezményezett gyermekek száma
    sharePct: number;            // megosztás % (50/100)
  };
}

export interface GrossSalaryInput {
  baseSalary: number;
  overtime: number;
  nightShift: number;
  sundayPremium: number;
  holidayPremium: number;
  bonus: number;
  sickLeave: number;          // betegszabadság díjazás (70%)
  otherIncome: number;
}

export interface PayrollCalculationInput {
  grossComponents: GrossSalaryInput;
  declarations: EmployeeDeclarations;
  employeeAge: number;        // kor (25 év alatti kedv.)
  employeeGender: 'male' | 'female' | 'other';
  isInsured: boolean;
  jobCode: string;
  weeklyHours: number;
  params: TaxParameters;
}

export interface TaxCreditDetail {
  type: string;
  name: string;
  baseReduction: number;      // adóalap-csökkentés (Ft)
  taxSaving: number;          // adómegtakarítás (Ft)
  tbSaving: number;           // TB megtakarítás (családi járulékkedv.)
}

export interface PayrollCalculationResult {
  // Bruttó
  grossSalary: number;

  // SZJA
  szjaBase: number;           // kedvezmények utáni adóalap
  szjaAmount: number;         // fizetendő SZJA

  // TB
  tbBase: number;
  tbAmount: number;           // TB járulék (18.5%)

  // Nettó
  netSalary: number;

  // Munkáltatói
  szochoBase: number;
  szochoAmount: number;       // SZOCHO (13%)
  totalEmployerCost: number;  // bruttó + SZOCHO

  // Részletezés
  taxCredits: TaxCreditDetail[];
  totalTaxSaving: number;
  totalTbSaving: number;

  // Levonások
  garnishmentTotal: number;
  netAfterGarnishment: number;
}

// ── Bruttó bér kalkuláció ──

export function calculateGross(input: GrossSalaryInput): number {
  return (
    input.baseSalary +
    input.overtime +
    input.nightShift +
    input.sundayPremium +
    input.holidayPremium +
    input.bonus +
    input.sickLeave +
    input.otherIncome
  );
}

// ── Fő számfejtési függvény ──

export function calculatePayroll(input: PayrollCalculationInput): PayrollCalculationResult {
  const { grossComponents, declarations, params } = input;

  const grossSalary = calculateGross(grossComponents);
  const taxCredits: TaxCreditDetail[] = [];
  let totalBaseReduction = 0;
  let totalTbSaving = 0;

  // ═══════════════════════════════════════════════════════
  // 9 SZJA-KEDVEZMÉNY — JOGSZABÁLYI SORREND
  // ═══════════════════════════════════════════════════════
  //
  // A kedvezmények ebben a sorrendben érvényesítendők:
  // 1. NÉTAK (4+ gyermekes anyák) — TELJES mentesség
  // 2. 3 gyermekes anyák
  // 3. 2 gyermekes anyák (40 év alatt, ÚJ 2026)
  // 4. 30 év alatti anyák / 25 év alattiak
  // 5. Személyi kedvezmény (fogyatékosság)
  // 6. Első házasok
  // 7. Családi kedvezmény
  // 8. Családi járulékkedvezmény (TB terhére, ha az SZJA nem elég)

  // 1. NÉTAK — 4+ gyermekes anyák (teljes SZJA-mentesség)
  if (declarations.netak?.eligible && input.employeeGender === 'female') {
    const saving = grossSalary * params.szja_rate;
    taxCredits.push({
      type: 'netak',
      name: 'NÉTAK (4+ gyermekes anyák)',
      baseReduction: grossSalary,
      taxSaving: saving,
      tbSaving: 0,
    });
    totalBaseReduction = grossSalary; // Teljes mentesség
  }

  // 2. 3 gyermekes anyák
  if (declarations.anyak3?.eligible && input.employeeGender === 'female') {
    const remaining = grossSalary - totalBaseReduction;
    if (remaining > 0) {
      const saving = remaining * params.szja_rate;
      taxCredits.push({
        type: 'anyak3',
        name: '3 gyermekes anyák kedvezménye',
        baseReduction: remaining,
        taxSaving: saving,
        tbSaving: 0,
      });
      totalBaseReduction += remaining;
    }
  }

  // 3. 2 gyermekes anyák (ÚJ 2026: 40 év alatti)
  if (declarations.anyak2?.eligible && input.employeeGender === 'female') {
    const remaining = grossSalary - totalBaseReduction;
    if (remaining > 0) {
      const saving = remaining * params.szja_rate;
      taxCredits.push({
        type: 'anyak2',
        name: '2 gyermekes anyák kedvezménye (ÚJ 2026)',
        baseReduction: remaining,
        taxSaving: saving,
        tbSaving: 0,
      });
      totalBaseReduction += remaining;
    }
  }

  // 4a. 30 év alatti anyák
  if (declarations.youngMother30 && input.employeeAge < 30 && input.employeeGender === 'female') {
    const remaining = grossSalary - totalBaseReduction;
    const cap = declarations.youngMother30.maxDeduction || params.young_25_cap;
    const reduction = Math.min(remaining, cap);
    if (reduction > 0) {
      const saving = reduction * params.szja_rate;
      taxCredits.push({
        type: 'young_mother_30',
        name: '30 év alatti anyák kedvezménye',
        baseReduction: reduction,
        taxSaving: saving,
        tbSaving: 0,
      });
      totalBaseReduction += reduction;
    }
  }

  // 4b. 25 év alattiak
  if (declarations.young25?.eligible && input.employeeAge < 25) {
    const remaining = grossSalary - totalBaseReduction;
    const reduction = Math.min(remaining, params.young_25_cap);
    if (reduction > 0) {
      const saving = reduction * params.szja_rate;
      taxCredits.push({
        type: 'young_25',
        name: '25 év alattiak kedvezménye',
        baseReduction: reduction,
        taxSaving: saving,
        tbSaving: 0,
      });
      totalBaseReduction += reduction;
    }
  }

  // 5. Személyi kedvezmény (fogyatékosság)
  if (declarations.personal?.eligible) {
    const remaining = grossSalary - totalBaseReduction;
    const reduction = Math.min(remaining, params.personal_disability);
    if (reduction > 0) {
      const saving = reduction * params.szja_rate;
      taxCredits.push({
        type: 'personal',
        name: 'Személyi kedvezmény (fogyatékosság)',
        baseReduction: reduction,
        taxSaving: saving,
        tbSaving: 0,
      });
      totalBaseReduction += reduction;
    }
  }

  // 6. Első házasok
  if (declarations.firstMarriage?.eligible && (declarations.firstMarriage.monthsRemaining ?? 0) > 0) {
    const remaining = grossSalary - totalBaseReduction;
    const reduction = Math.min(remaining, params.first_marriage);
    if (reduction > 0) {
      const saving = reduction * params.szja_rate;
      taxCredits.push({
        type: 'first_marriage',
        name: 'Első házasok kedvezménye',
        baseReduction: reduction,
        taxSaving: saving,
        tbSaving: 0,
      });
      totalBaseReduction += reduction;
    }
  }

  // 7. Családi kedvezmény
  if (declarations.family && declarations.family.eligibleChildrenCount > 0) {
    const { eligibleChildrenCount, sharePct = 100 } = declarations.family;
    let perChildReduction: number;

    if (eligibleChildrenCount === 1) {
      perChildReduction = params.family_1_child;
    } else if (eligibleChildrenCount === 2) {
      perChildReduction = params.family_2_children;
    } else {
      perChildReduction = params.family_3plus_children;
    }

    const totalFamilyReduction = perChildReduction * eligibleChildrenCount * (sharePct / 100);
    const remaining = grossSalary - totalBaseReduction;
    const appliedReduction = Math.min(remaining, totalFamilyReduction);

    if (appliedReduction > 0) {
      const saving = appliedReduction * params.szja_rate;
      taxCredits.push({
        type: 'family',
        name: `Családi kedvezmény (${eligibleChildrenCount} gyermek)`,
        baseReduction: appliedReduction,
        taxSaving: saving,
        tbSaving: 0,
      });
      totalBaseReduction += appliedReduction;

      // 8. Családi járulékkedvezmény — ha az SZJA nem elég a teljes kedvezményhez
      const unusedReduction = totalFamilyReduction - appliedReduction;
      if (unusedReduction > 0) {
        // A fennmaradó kedvezmény a TB terhére érvényesíthető
        const tbCredit = Math.min(unusedReduction * params.szja_rate, grossSalary * params.tb_rate);
        if (tbCredit > 0) {
          taxCredits.push({
            type: 'family_tb',
            name: 'Családi járulékkedvezmény (TB terhére)',
            baseReduction: 0,
            taxSaving: 0,
            tbSaving: tbCredit,
          });
          totalTbSaving = tbCredit;
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════
  // SZJA SZÁMÍTÁS
  // ═══════════════════════════════════════════════════════

  const szjaBase = Math.max(0, grossSalary - totalBaseReduction);
  const szjaAmount = Math.round(szjaBase * params.szja_rate);

  // ═══════════════════════════════════════════════════════
  // TB JÁRULÉK (18.5%)
  // ═══════════════════════════════════════════════════════

  const tbBase = input.isInsured ? grossSalary : 0;
  const tbGross = Math.round(tbBase * params.tb_rate);
  const tbAmount = Math.max(0, tbGross - totalTbSaving);

  // ═══════════════════════════════════════════════════════
  // NETTÓ BÉR
  // ═══════════════════════════════════════════════════════

  const netSalary = grossSalary - szjaAmount - tbAmount;

  // ═══════════════════════════════════════════════════════
  // SZOCHO (13%, munkáltatói)
  // ═══════════════════════════════════════════════════════

  const szochoBase = input.isInsured ? grossSalary : 0;
  const szochoAmount = Math.round(szochoBase * params.szocho_rate);
  const totalEmployerCost = grossSalary + szochoAmount;

  // ═══════════════════════════════════════════════════════
  // ÖSSZESÍTÉS
  // ═══════════════════════════════════════════════════════

  const totalTaxSaving = taxCredits.reduce((sum, c) => sum + c.taxSaving, 0);

  return {
    grossSalary,
    szjaBase,
    szjaAmount,
    tbBase,
    tbAmount,
    netSalary,
    szochoBase,
    szochoAmount,
    totalEmployerCost,
    taxCredits,
    totalTaxSaving,
    totalTbSaving,
    garnishmentTotal: 0,
    netAfterGarnishment: netSalary,
  };
}

// ── Letiltás-számítás (Vht. 65.§) ──

export interface Garnishment {
  type: 'child_support' | 'public_debt' | 'private_debt';
  monthlyDeduction: number;
  maxDeductionPct: number;   // 0.33 vagy 0.50
  priority: number;
}

/**
 * Letiltás-levonás kalkuláció a Vht. 65.§ szerint.
 *
 * Szabályok:
 * - Tartásdíj: max 50% a nettóból
 * - Egyéb letiltás: max 33% a nettóból
 * - Több letiltás: sorrend a prioritás szerint
 * - Az összesített levonás nem haladhatja meg az 50%-ot
 */
export function calculateGarnishments(
  netSalary: number,
  garnishments: Garnishment[]
): { total: number; details: Array<Garnishment & { appliedAmount: number }> } {
  // Prioritás szerinti sorrend (tartásdíj > közjogi > magánjogi)
  const sorted = [...garnishments].sort((a, b) => a.priority - b.priority);

  let totalDeducted = 0;
  const maxTotal = netSalary * 0.50; // abszolút maximum 50%
  const details: Array<Garnishment & { appliedAmount: number }> = [];

  for (const g of sorted) {
    const maxForType = netSalary * g.maxDeductionPct;
    const available = Math.min(maxForType, maxTotal - totalDeducted);
    const applied = Math.min(g.monthlyDeduction, available);

    if (applied > 0) {
      details.push({ ...g, appliedAmount: applied });
      totalDeducted += applied;
    } else {
      details.push({ ...g, appliedAmount: 0 });
    }
  }

  return { total: totalDeducted, details };
}

// ── Default 2026-os paraméterek (fallback) ──

export const DEFAULT_2026_PARAMS: TaxParameters = {
  szja_rate: 0.15,
  tb_rate: 0.185,
  szocho_rate: 0.13,
  minimum_wage: 322800,
  guaranteed_minimum: 373200,
  family_1_child: 133340,
  family_2_children: 266660,
  family_3plus_children: 440000,
  young_25_cap: 715765,
  personal_disability: 107600,
  first_marriage: 33335,
  health_service_monthly: 12300,
};
