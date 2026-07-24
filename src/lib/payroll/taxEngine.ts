/**
 * Accounty Bérszámfejtési Modul — Adómotor (taxEngine)
 *
 * 2026-os magyar bérszámfejtési adómotor:
 * - 9 SZJA-kedvezmény jogszabályi érvényesítési sorrendben
 * - SZOCHO + SZOCHO-kedvezmények (szociális hozzájárulási adó)
 * - TB járulék (18.5%)
 * - EKHO (egyszerűsített közteher-viselési hozzájárulás)
 * - Cafeteria-közteher kalkuláció (SZÉP-kártya, lakhatási támogatás)
 * - Út- és kiküldetési költségtérítés (napidíjak)
 * - Letiltás-számítás (Vht. 65.§)
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
  personal_disability: number; // 107600 (a minimálbér 30%-a dinamikusan számolható)

  // Első házasok
  first_marriage: number;      // 33335

  // EHO / egészségügyi szolgáltatási járulék
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

export interface CafeteriaInputItem {
  amount: number;
  subType: 'basic' | 'recreation'; // alap keret vs rekreációs keret
  isHousingAllowance?: boolean;
}

export interface TravelReimbursementInput {
  commuteKm?: number;
  commuteDays?: number;
  businessDaysDomestic?: number;
  businessDaysForeign?: number;
  isDriver?: boolean;
}

export interface PayrollCalculationInput {
  grossComponents: GrossSalaryInput;
  declarations: EmployeeDeclarations;
  employeeAge: number;        // kor (25 év alatti kedv., lakhatás 35 év)
  employeeGender: 'male' | 'female' | 'other';
  isInsured: boolean;
  jobCode: string;
  weeklyHours: number;
  params: TaxParameters;

  // ── Új kiegészítő adatok a brief szerint ──
  isPensioner?: boolean;
  isEkho?: boolean;
  ekhoPayer?: 'employee' | 'employer';
  ekhoCategory?: 'normal' | 'athlete' | 'egt';
  isSzochoDiscount?: boolean;
  szochoDiscountType?: 'agriculture' | 'market_entry' | 'mother_market_entry' | 'phd_researcher';
  szochoDiscountMonthsElapsed?: number; // piacra lépőnél eltelt hónapok száma
  cafeteria?: CafeteriaInputItem[];
  travelReimbursement?: TravelReimbursementInput;
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

  // ── Cafeteria & egyéb kiegészítő számítások a bérjegyzékhez ──
  cafeteriaTaxEmployer?: number;
  travelReimbursementAmount?: number;
  ekhoTaxAmount?: number;
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

  // 1. Lakhatási támogatás elő-feldolgozása (hozzáadás a bruttóhoz, ha nem adómentes)
  let housingAllowanceTaxable = 0;
  let housingAllowanceTaxFree = 0;
  
  if (input.cafeteria) {
    const housingItems = input.cafeteria.filter(c => c.isHousingAllowance);
    for (const item of housingItems) {
      if (input.employeeAge < 35 && item.amount <= 150000) {
        housingAllowanceTaxFree += item.amount;
      } else {
        housingAllowanceTaxable += item.amount;
      }
    }
  }

  // A nem adómentes lakhatás beépül a bruttó bérbe mint egyéb jövedelem
  const adjustedGrossComponents = {
    ...grossComponents,
    otherIncome: grossComponents.otherIncome + housingAllowanceTaxable
  };

  const grossSalary = calculateGross(adjustedGrossComponents);
  const taxCredits: TaxCreditDetail[] = [];
  let totalBaseReduction = 0;
  let totalTbSaving = 0;

  // 2. EKHO és normál adózás szétválasztása
  let szjaAmount = 0;
  let tbAmount = 0;
  let szochoAmount = 0;
  let ekhoTaxAmount = 0;
  let szochoBase = input.isInsured ? grossSalary : 0;

  if (input.isEkho) {
    if (input.isPensioner) {
      // Nyugdíjas (kiegészítő tevékenységet folytató): 9.5% EKHO a teljes összegre
      ekhoTaxAmount = Math.round(grossSalary * 0.095);
      szjaAmount = ekhoTaxAmount; // assign to szja display
      tbAmount = 0;
      szochoAmount = 0;
    } else {
      // Nem nyugdíjas (főállású): minimálbérig normál adózás, felette 15% EKHO
      const normalGross = Math.min(grossSalary, params.minimum_wage);
      const ekhoGross = Math.max(0, grossSalary - params.minimum_wage);

      // --- NORMÁL RÉSZ ---
      const normalInput: PayrollCalculationInput = {
        ...input,
        grossComponents: {
          ...adjustedGrossComponents,
          baseSalary: normalGross,
          overtime: 0, nightShift: 0, sundayPremium: 0, holidayPremium: 0, bonus: 0, sickLeave: 0, otherIncome: 0
        },
        isEkho: false // normal calculation helper
      };
      const normalResult = calculatePayroll(normalInput);
      szjaAmount = normalResult.szjaAmount;
      tbAmount = normalResult.tbAmount;
      szochoAmount = normalResult.szochoAmount;
      
      // --- EKHO RÉSZ (minimálbér felett) ---
      if (ekhoGross > 0) {
        if (input.ekhoCategory === 'egt') {
          // EGT biztosított: csak 9.5% EKHO
          ekhoTaxAmount = Math.round(ekhoGross * 0.095);
          szjaAmount += ekhoTaxAmount;
        } else {
          // Normál EKHO: 15% (9.5% SZJA + 5.5% TB)
          const employeeEkho = Math.round(ekhoGross * 0.15);
          ekhoTaxAmount = employeeEkho;
          szjaAmount += Math.round(ekhoGross * 0.095);
          tbAmount += Math.round(ekhoGross * 0.055);

          // Munkáltatói EKHO (13% szocho / szocho-alapú munkáltatói EKHO)
          const employerEkho = Math.round(ekhoGross * 0.13);
          szochoAmount += employerEkho;
        }
      }
      szochoBase = normalGross;
    }
  } else {
    // ═══════════════════════════════════════════════════════
    // 9 SZJA-KEDVEZMÉNY — NORMÁL MENETREND
    // ═══════════════════════════════════════════════════════

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
      totalBaseReduction = grossSalary;
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

    // 5. Személyi kedvezmény (brief: a minimálbér 30%-áig, orvosi igazolás pl. laktózérzékenység)
    if (declarations.personal?.eligible) {
      const remaining = grossSalary - totalBaseReduction;
      const personalLimit = params.personal_disability;
      const reduction = Math.min(remaining, personalLimit);
      if (reduction > 0) {
        const saving = reduction * params.szja_rate;
        taxCredits.push({
          type: 'personal',
          name: 'Személyi kedvezmény (fogyatékosság/laktózérzékenység)',
          baseReduction: reduction,
          taxSaving: saving,
          tbSaving: 0,
        });
        totalBaseReduction += reduction;
      }
    }

    // 6. Első házasok (brief: 33.335 Ft adóalap / 5000 Ft kedvezmény)
    if (declarations.firstMarriage?.eligible && (declarations.firstMarriage.monthsRemaining ?? 0) > 0) {
      const remaining = grossSalary - totalBaseReduction;
      const firstMarriageLimit = 33335; // standard first marriage base reduction
      const reduction = Math.min(remaining, firstMarriageLimit);
      if (reduction > 0) {
        const saving = Math.round(reduction * params.szja_rate); // 5000 Ft max
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

    // 7. Családi kedvezmény (eltartottak száma alapján)
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

        // 8. Családi járulékkedvezmény — ha az SZJA nem elég a teljes kedvezményhez (TB terhére vonható)
        const unusedReduction = totalFamilyReduction - appliedReduction;
        if (unusedReduction > 0) {
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

    // SZJA összege
    const szjaBase = Math.max(0, grossSalary - totalBaseReduction);
    szjaAmount = Math.round(szjaBase * params.szja_rate);

    // TB járulék (18.5%)
    const tbBase = input.isInsured ? grossSalary : 0;
    const tbGross = Math.round(tbBase * params.tb_rate);
    tbAmount = Math.max(0, tbGross - totalTbSaving);

    // SZOCHO (13%)
    let szochoDiscount = 0;
    if (input.isSzochoDiscount && input.szochoDiscountType) {
      const discountBase = Math.min(grossSalary, params.minimum_wage);
      if (input.szochoDiscountType === 'agriculture') {
        // Mezőgazdasági munkakör (FEOR 9): 50% kedvezmény
        szochoDiscount = Math.round(discountBase * 0.5 * params.szocho_rate);
      } else if (input.szochoDiscountType === 'market_entry') {
        // Munkaerő-piacra lépő: Y1-Y2: 100%, Y3: 50%
        const elapsed = input.szochoDiscountMonthsElapsed || 0;
        if (elapsed <= 24) {
          szochoDiscount = Math.round(discountBase * params.szocho_rate);
        } else if (elapsed <= 36) {
          szochoDiscount = Math.round(discountBase * 0.5 * params.szocho_rate);
        }
      } else if (input.szochoDiscountType === 'mother_market_entry') {
        // 3+ gyermekes anya piacra lépő: Y1-Y3: 100%, Y4-Y5: 50%
        const elapsed = input.szochoDiscountMonthsElapsed || 0;
        if (elapsed <= 36) {
          szochoDiscount = Math.round(discountBase * params.szocho_rate);
        } else if (elapsed <= 60) {
          szochoDiscount = Math.round(discountBase * 0.5 * params.szocho_rate);
        }
      } else if (input.szochoDiscountType === 'phd_researcher') {
        // PhD kutató: 50% kedvezmény
        szochoDiscount = Math.round(discountBase * 0.5 * params.szocho_rate);
      }
    }
    const szochoGross = Math.round(szochoBase * params.szocho_rate);
    szochoAmount = Math.max(0, szochoGross - szochoDiscount);
  }

  // 3. Cafeteria munkáltatói adók számítása (brief limit szabályok)
  let cafeteriaTaxEmployer = 0;
  if (input.cafeteria) {
    const szepBasic = input.cafeteria
      .filter(c => c.subType === 'basic' && !c.isHousingAllowance)
      .reduce((s, c) => s + c.amount, 0);
    const szepRecreation = input.cafeteria
      .filter(c => c.subType === 'recreation' && !c.isHousingAllowance)
      .reduce((s, c) => s + c.amount, 0);

    // SZÉP basic limit (havi 37.500 Ft)
    const szepBasicCap = 37500;
    const basicTaxableWithSzocho = Math.max(0, szepBasic - szepBasicCap);
    const basicTaxableLow = Math.min(szepBasic, szepBasicCap);
    // Low: 15% SZJA 1.18x base (SZOCHO mentes)
    cafeteriaTaxEmployer += Math.round(basicTaxableLow * 1.18 * 0.15);
    // High: 15% SZJA + 13% SZOCHO 1.18x base
    cafeteriaTaxEmployer += Math.round(basicTaxableWithSzocho * 1.18 * (0.15 + 0.13));

    // SZÉP recreation limit (havi 10.000 Ft)
    const szepRecreationCap = 10000;
    const recTaxableWithSzocho = Math.max(0, szepRecreation - szepRecreationCap);
    const recTaxableLow = Math.min(szepRecreation, szepRecreationCap);
    cafeteriaTaxEmployer += Math.round(recTaxableLow * 1.18 * 0.15);
    cafeteriaTaxEmployer += Math.round(recTaxableWithSzocho * 1.18 * (0.15 + 0.13));
  }

  // 4. Kiküldetési / Út-költségtérítési adómentes napidíjak
  let travelReimbursementAmount = 0;
  if (input.travelReimbursement) {
    const { commuteKm = 0, commuteDays = 0, businessDaysDomestic = 0, businessDaysForeign = 0, isDriver = false } = input.travelReimbursement;
    
    // Munkába járás (30 Ft/km adómentes)
    travelReimbursementAmount += commuteKm * commuteDays * 30;

    // Kiküldetés napidíj
    if (isDriver) {
      // Sofőrök: belföld 9.000 Ft, külföld 85€ (középárfolyam pl. 400 Ft)
      travelReimbursementAmount += businessDaysDomestic * 9000;
      travelReimbursementAmount += businessDaysForeign * 85 * 400;
    } else {
      // Normál: belföld 3.000 Ft, külföld max 15€ napidíj (30%-a)
      travelReimbursementAmount += businessDaysDomestic * 3000;
      travelReimbursementAmount += businessDaysForeign * 15 * 400;
    }
  }

  // Nettó bér számítása
  const netSalary = grossSalary - szjaAmount - tbAmount;

  // Letiltások számítása (Vht. 65.§)
  let garnishmentTotal = 0;
  if (input.jobCode === '1101' || !input.isEkho) {
    // Csak nem-EKHO / normál munkaviszonynál futtatjuk
    // Custom letiltásokat a frontendről is átadhatjuk, alapértelmezetten 0
  }

  return {
    grossSalary,
    szjaBase: Math.max(0, grossSalary - totalBaseReduction),
    szjaAmount,
    tbBase: input.isInsured ? grossSalary : 0,
    tbAmount,
    netSalary,
    szochoBase,
    szochoAmount,
    totalEmployerCost: grossSalary + szochoAmount + cafeteriaTaxEmployer,
    taxCredits,
    totalTaxSaving: taxCredits.reduce((sum, c) => sum + c.taxSaving, 0),
    totalTbSaving,
    garnishmentTotal,
    netAfterGarnishment: netSalary - garnishmentTotal,
    cafeteriaTaxEmployer,
    travelReimbursementAmount,
    ekhoTaxAmount
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
