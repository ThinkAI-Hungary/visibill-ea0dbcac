import { describe, it, expect } from 'vitest';
import {
  calculatePayroll, calculateGross, calculateGarnishments, isEligibleForYoung25,
  DEFAULT_2026_PARAMS,
  type PayrollCalculationInput, type GrossSalaryInput, type Garnishment,
} from '../taxEngine';

function makeGross(base: number, overrides: Partial<GrossSalaryInput> = {}): GrossSalaryInput {
  return {
    baseSalary: base,
    overtime: 0,
    nightShift: 0,
    sundayPremium: 0,
    holidayPremium: 0,
    bonus: 0,
    sickLeave: 0,
    otherIncome: 0,
    ...overrides,
  };
}

function makeInput(baseSalary: number, overrides: Partial<PayrollCalculationInput> = {}): PayrollCalculationInput {
  return {
    grossComponents: makeGross(baseSalary),
    declarations: {},
    employeeAge: 35,
    employeeGender: 'male',
    isInsured: true,
    jobCode: '1101',
    weeklyHours: 40,
    params: DEFAULT_2026_PARAMS,
    ...overrides,
  };
}

describe('calculateGross', () => {
  it('should sum all gross components', () => {
    const result = calculateGross({
      baseSalary: 400_000,
      overtime: 50_000,
      nightShift: 10_000,
      sundayPremium: 5_000,
      holidayPremium: 3_000,
      bonus: 100_000,
      sickLeave: 0,
      otherIncome: 2_000,
    });
    expect(result).toBe(570_000);
  });

  it('should return zero for empty components', () => {
    expect(calculateGross(makeGross(0))).toBe(0);
  });
});

describe('calculatePayroll — Alapeset', () => {
  it('should calculate basic payroll for 500k gross', () => {
    const result = calculatePayroll(makeInput(500_000));

    expect(result.grossSalary).toBe(500_000);
    expect(result.szjaBase).toBe(500_000);
    expect(result.szjaAmount).toBe(75_000);       // 500k * 15%
    expect(result.tbAmount).toBe(92_500);          // 500k * 18.5%
    expect(result.szochoAmount).toBe(65_000);      // 500k * 13%
    expect(result.netSalary).toBe(332_500);        // 500k - 75k - 92.5k
    expect(result.totalEmployerCost).toBe(565_000); // 500k + 65k
  });

  it('should calculate for minimum wage 322.800', () => {
    const result = calculatePayroll(makeInput(322_800));

    expect(result.grossSalary).toBe(322_800);
    expect(result.szjaAmount).toBe(Math.round(322_800 * 0.15));
    expect(result.tbAmount).toBe(Math.round(322_800 * 0.185));
    expect(result.szochoAmount).toBe(Math.round(322_800 * 0.13));
  });

  it('should handle zero gross salary', () => {
    const result = calculatePayroll(makeInput(0));
    expect(result.grossSalary).toBe(0);
    expect(result.szjaAmount).toBe(0);
    expect(result.tbAmount).toBe(0);
    expect(result.netSalary).toBe(0);
  });

  it('should calculate for high salary (2M)', () => {
    const result = calculatePayroll(makeInput(2_000_000));
    expect(result.szjaAmount).toBe(300_000);
    expect(result.tbAmount).toBe(370_000);
    expect(result.szochoAmount).toBe(260_000);
    expect(result.netSalary).toBe(1_330_000);
  });
});

describe('calculatePayroll — SZJA kedvezmények', () => {
  it('NÉTAK — 4+ gyermekes anya teljes SZJA mentesség', () => {
    const result = calculatePayroll(makeInput(500_000, {
      employeeGender: 'female',
      declarations: { netak: { eligible: true } },
    }));

    expect(result.szjaBase).toBe(0);
    expect(result.szjaAmount).toBe(0);
    // Nettó: 500k - 0 - TB
    expect(result.netSalary).toBe(500_000 - Math.round(500_000 * 0.185));
  });

  it('25 év alattiak — mentesség a cap erejéig', () => {
    const result = calculatePayroll(makeInput(500_000, {
      employeeAge: 23,
      declarations: { young25: { eligible: true } },
    }));

    // Cap: 715.765 Ft — 500k alatta van, tehát teljes mentesség
    expect(result.szjaBase).toBe(0);
    expect(result.szjaAmount).toBe(0);
  });

  it('25 év alattiak — cap feletti bér', () => {
    const result = calculatePayroll(makeInput(800_000, {
      employeeAge: 24,
      declarations: { young25: { eligible: true } },
    }));

    // Cap: 715.765 → SZJA alap: 800.000 - 715.765 = 84.235
    expect(result.szjaBase).toBe(800_000 - DEFAULT_2026_PARAMS.young_25_cap);
    expect(result.szjaAmount).toBe(Math.round((800_000 - DEFAULT_2026_PARAMS.young_25_cap) * 0.15));
  });

  it('25 év alattiak — nem jogosult ha >= 25', () => {
    const result = calculatePayroll(makeInput(500_000, {
      employeeAge: 25,
      declarations: { young25: { eligible: true } },
    }));

    // Nincs kedvezmény, teljes SZJA
    expect(result.szjaBase).toBe(500_000);
    expect(result.szjaAmount).toBe(75_000);
  });

  it('25 év alattiak — automatikus törvényi kedvezmény nyilatkozat nélkül ha életkor < 25', () => {
    const result = calculatePayroll(makeInput(373_200, {
      employeeAge: 21,
      declarations: {},
    }));

    // Bozóki Klaudia Kitti és Nagy Gréta esete: 373.200 Ft bruttó -> 0 Ft SZJA, nettó 304.158 Ft
    expect(result.szjaBase).toBe(0);
    expect(result.szjaAmount).toBe(0);
    expect(result.tbAmount).toBe(69_042);
    expect(result.netSalary).toBe(304_158);
    expect(result.taxCredits.some(c => c.type === 'young_25')).toBe(true);
  });

  it('25 év alattiak — lemondó nyilatkozat esetén nem érvényesül a kedvezmény', () => {
    const result = calculatePayroll(makeInput(373_200, {
      employeeAge: 21,
      declarations: { young25: { eligible: false } },
    }));

    // Explicit lemondás miatt teljes SZJA terheli
    expect(result.szjaBase).toBe(373_200);
    expect(result.szjaAmount).toBe(55_980);
    expect(result.netSalary).toBe(248_178);
  });

  describe('isEligibleForYoung25 — Szja tv. 29/F. § (2) bekezdés szerinti születési hónap szabály', () => {
    const birthDate = '2001-04-20'; // 25. születésnap: 2026. április 20.

    it('25. születésnap előtti hónapokban jogosult', () => {
      expect(isEligibleForYoung25(birthDate, 2026, 1)).toBe(true);
      expect(isEligibleForYoung25(birthDate, 2026, 2)).toBe(true);
      expect(isEligibleForYoung25(birthDate, 2026, 3)).toBe(true);
    });

    it('A 25. életév betöltésének hónapjában még teljes havi kedvezmény jár', () => {
      // 2026. áprilisban tölti be a 25-öt, a teljes áprilisi hónapra még jár a mentesség!
      expect(isEligibleForYoung25(birthDate, 2026, 4)).toBe(true);
    });

    it('A 25. életév betöltését követő hónaptól már nem jogosult', () => {
      // 2026. májustól (5. hónap) már nem jár
      expect(isEligibleForYoung25(birthDate, 2026, 5)).toBe(false);
      expect(isEligibleForYoung25(birthDate, 2026, 6)).toBe(false);
      expect(isEligibleForYoung25(birthDate, 2027, 1)).toBe(false);
    });

    it('Hiányzó vagy érvénytelen születési dátum esetén false', () => {
      expect(isEligibleForYoung25(null, 2026, 4)).toBe(false);
      expect(isEligibleForYoung25(undefined, 2026, 4)).toBe(false);
      expect(isEligibleForYoung25('invalid-date', 2026, 4)).toBe(false);
    });
  });


  it('Személyi kedvezmény (fogyatékosság)', () => {
    const result = calculatePayroll(makeInput(500_000, {
      declarations: { personal: { eligible: true } },
    }));

    // Personal disability: 107.600 adóalap-csökkentő
    expect(result.szjaBase).toBe(500_000 - DEFAULT_2026_PARAMS.personal_disability);
  });

  it('Első házasok kedvezménye', () => {
    const result = calculatePayroll(makeInput(500_000, {
      declarations: { firstMarriage: { eligible: true, monthsRemaining: 12 } },
    }));

    // 33.335 Ft adóalap-csökkentő
    expect(result.szjaBase).toBe(500_000 - DEFAULT_2026_PARAMS.first_marriage);
  });

  it('Első házasok — nem jogosult ha monthsRemaining = 0', () => {
    const result = calculatePayroll(makeInput(500_000, {
      declarations: { firstMarriage: { eligible: true, monthsRemaining: 0 } },
    }));

    expect(result.szjaBase).toBe(500_000);
  });

  it('Családi kedvezmény — 1 gyerek', () => {
    const result = calculatePayroll(makeInput(500_000, {
      declarations: { family: { dependentCount: 1, eligibleChildrenCount: 1, sharePct: 100 } },
    }));

    // 1 gyerek: 133.340 * 1 = 133.340 adóalap csökkentő
    expect(result.szjaBase).toBe(500_000 - 133_340);
  });

  it('Családi kedvezmény — 2 gyerek', () => {
    const result = calculatePayroll(makeInput(500_000, {
      declarations: { family: { dependentCount: 2, eligibleChildrenCount: 2, sharePct: 100 } },
    }));

    // 2 gyerek: 266.660 * 2 = 533.320 → cap at gross
    expect(result.szjaBase).toBe(0);
    expect(result.szjaAmount).toBe(0);
  });

  it('Családi kedvezmény — 3+ gyerek, járulékkedvezmény', () => {
    const result = calculatePayroll(makeInput(400_000, {
      declarations: { family: { dependentCount: 3, eligibleChildrenCount: 3, sharePct: 100 } },
    }));

    // 3+ gyerek: 440.000 * 3 = 1.320.000 >> 400.000 bruttó
    // SZJA alap = 0, SZJA = 0
    expect(result.szjaBase).toBe(0);
    expect(result.szjaAmount).toBe(0);
    // + családi járulékkedvezmény a TB terhére
    expect(result.totalTbSaving).toBeGreaterThan(0);
    expect(result.tbAmount).toBeLessThan(Math.round(400_000 * 0.185));
  });

  it('Családi kedvezmény — 50% megosztás', () => {
    const result = calculatePayroll(makeInput(500_000, {
      declarations: { family: { dependentCount: 2, eligibleChildrenCount: 2, sharePct: 50 } },
    }));

    // 50%: 266.660 * 2 * 0.5 = 266.660
    expect(result.szjaBase).toBe(500_000 - 266_660);
  });
});

describe('calculatePayroll — nem biztosított', () => {
  it('should not charge TB/SZOCHO if not insured', () => {
    const result = calculatePayroll(makeInput(500_000, { isInsured: false }));

    expect(result.tbAmount).toBe(0);
    expect(result.szochoAmount).toBe(0);
    expect(result.netSalary).toBe(500_000 - result.szjaAmount);
  });
});

describe('calculateGarnishments — Letiltások', () => {
  it('should deduct child support up to 50%', () => {
    const garnishments: Garnishment[] = [
      { type: 'child_support', monthlyDeduction: 200_000, maxDeductionPct: 0.5, priority: 1 },
    ];
    const result = calculateGarnishments(300_000, garnishments);

    expect(result.total).toBe(150_000); // 300k * 50% cap
    expect(result.details[0].appliedAmount).toBe(150_000);
  });

  it('should deduct private debt up to 33%', () => {
    const garnishments: Garnishment[] = [
      { type: 'private_debt', monthlyDeduction: 200_000, maxDeductionPct: 0.33, priority: 3 },
    ];
    const result = calculateGarnishments(300_000, garnishments);

    expect(result.total).toBe(99_000); // 300k * 33%
  });

  it('should respect total 50% cap for multiple garnishments', () => {
    const garnishments: Garnishment[] = [
      { type: 'child_support', monthlyDeduction: 100_000, maxDeductionPct: 0.5, priority: 1 },
      { type: 'private_debt', monthlyDeduction: 100_000, maxDeductionPct: 0.33, priority: 3 },
    ];
    const result = calculateGarnishments(300_000, garnishments);

    // Child support: 100k (within 50%)
    // Private debt: min(100k, 99k, 150k-100k=50k) = 50k
    expect(result.total).toBe(150_000);
  });

  it('should handle zero net salary', () => {
    const result = calculateGarnishments(0, [
      { type: 'child_support', monthlyDeduction: 50_000, maxDeductionPct: 0.5, priority: 1 },
    ]);
    expect(result.total).toBe(0);
  });
});

describe('calculatePayroll — Minimális járulékalap és Új Cafeteria / Lakhatás szabályok', () => {
  it('minimális járulékalap — minimálbér szabály (gross < minimálbér)', () => {
    const result = calculatePayroll(makeInput(200_000, {
      minimumContributionBaseRule: 'minimal_wage',
      isInsured: true,
    }));

    // gross = 200_000, minimal_wage = 322_800
    // tbBase and szochoBase should be bumped to 322_800
    expect(result.tbAmount).toBe(Math.round(322_800 * 0.185));
    expect(result.szochoAmount).toBe(Math.round(322_800 * 0.13));
  });

  it('minimális járulékalap — garantált bérminimum szabály (gross < bérminimum)', () => {
    const result = calculatePayroll(makeInput(300_000, {
      minimumContributionBaseRule: 'guaranteed_minimum',
      isInsured: true,
    }));

    // gross = 300_000, guaranteed_minimum = 373_200
    // tbBase and szochoBase should be bumped to 373_200
    expect(result.tbAmount).toBe(Math.round(373_200 * 0.185));
    expect(result.szochoAmount).toBe(Math.round(373_200 * 0.13));
  });

  it('minimális járulékalap mentesség — ha más cégnél megfizetve', () => {
    const result = calculatePayroll(makeInput(200_000, {
      minimumContributionBaseRule: 'minimal_wage',
      isMinBasePaidElsewhere: true,
      isInsured: true,
    }));

    // exempt from minimum base, so normal gross base (200k) is used
    expect(result.tbAmount).toBe(Math.round(200_000 * 0.185));
    expect(result.szochoAmount).toBe(Math.round(200_000 * 0.13));
  });

  it('cafeteria és lakhatás — munkáltatói terhek kiszámítása (35 év alatti lakhatás)', () => {
    const result = calculatePayroll(makeInput(500_000, {
      employeeAge: 30,
      cafeteria: [
        { amount: 120_000, subType: 'basic', isHousingAllowance: true }, // housing allowance under 150k limit
      ],
    }));

    // 120k is free for employee, so not in gross.
    // Employer pays 28% tax on 1.0x of the free amount.
    // 120_000 * 0.28 = 33_600
    expect(result.cafeteriaTaxEmployer).toBe(33_600);
  });

  it('cafeteria és lakhatás — 35 év feletti lakhatás (teljesen adóköteles)', () => {
    const result = calculatePayroll(makeInput(500_000, {
      employeeAge: 40,
      cafeteria: [
        { amount: 120_000, subType: 'basic', isHousingAllowance: true },
      ],
    }));

    // Over 35, housing allowance is taxable as regular income (added to gross components).
    // Gross salary: 500k + 120k = 620k
    expect(result.grossSalary).toBe(620_000);
    expect(result.cafeteriaTaxEmployer).toBe(0);
  });

  it('kiküldetés — eurRate paraméter használata', () => {
    const result = calculatePayroll(makeInput(500_000, {
      travelReimbursement: {
        businessDaysForeign: 5,
      },
      eurRate: 420,
    }));

    // Foreign trip: 5 days * 15 EUR * 420 = 31_500
    expect(result.travelReimbursementAmount).toBe(31_500);
  });

  describe('Munkába járás utazási költségtérítés (39/2010. (II. 26.) Korm. rend. és Szja tv. 25. § (2))', () => {
    it('gépkocsi költségtérítés alapértelmezett 30 Ft/km rátával és 0% adóteherrel', () => {
      // 20 km oda-vissza, 20 ledolgozott nap -> 20 * 20 * 30 = 12 000 Ft
      const result = calculatePayroll(makeInput(500_000, {
        travelReimbursement: {
          commuteType: 'car',
          commuteKm: 20,
          commuteDays: 20,
        },
      }));

      expect(result.travelReimbursementAmount).toBe(12_000);
      // Munkabér adóalapok nem változnak (adómentes térítés)
      expect(result.grossSalary).toBe(500_000);
      expect(result.szjaBase).toBe(500_000);
      expect(result.tbBase).toBe(500_000);
      expect(result.szochoBase).toBe(500_000);
    });

    it('gépkocsi költségtérítés céges minimum 18 Ft/km rátával', () => {
      // 25 km oda-vissza, 22 ledolgozott nap, 18 Ft/km -> 25 * 22 * 18 = 9 900 Ft
      const result = calculatePayroll(makeInput(500_000, {
        travelReimbursement: {
          commuteType: 'car',
          commuteKm: 25,
          commuteDays: 22,
          commuteCarRate: 18,
        },
      }));

      expect(result.travelReimbursementAmount).toBe(9_900);
    });

    it('közösségi közlekedés bérlet térítés 86%-os törvényi minimummal', () => {
      // Volánbusz/MÁV bérlet 14 200 Ft, 86% -> Math.round(14 200 * 0.86) = 12 212 Ft
      const result = calculatePayroll(makeInput(400_000, {
        travelReimbursement: {
          commuteType: 'public_transit',
          commuteTransitPassCost: 14_200,
          commuteReimbursementPct: 86,
        },
      }));

      expect(result.travelReimbursementAmount).toBe(12_212);
      expect(result.grossSalary).toBe(400_000);
    });

    it('közösségi közlekedés bérlet térítés 100%-os munkáltatói vállalással', () => {
      // Bérlet 14 200 Ft, 100% -> 14 200 Ft
      const result = calculatePayroll(makeInput(400_000, {
        travelReimbursement: {
          commuteType: 'public_transit',
          commuteTransitPassCost: 14_200,
          commuteReimbursementPct: 100,
        },
      }));

      expect(result.travelReimbursementAmount).toBe(14_200);
    });
  });

  describe('Nyugdíjas munkavállaló járulék- és adómentessége (Tbj. 6. § és Szocho tv. 5. § (1) f))', () => {
    it('öregségi nyugdíjas normál munkaviszonyban mentes a 18.5% TB és a 13% SZOCHO alól, csak 15% SZJA terheli', () => {
      // Zsófi / Carman-Food esete: 322 800 Ft bruttó bér
      const result = calculatePayroll(makeInput(322_800, {
        isPensioner: true,
        isInsured: true,
      }));

      expect(result.grossSalary).toBe(322_800);
      expect(result.szjaAmount).toBe(48_420); // 15% SZJA
      expect(result.tbAmount).toBe(0); // 0% TB (nem biztosított)
      expect(result.szochoAmount).toBe(0); // 0% SZOCHO (mentes kifizetői teher)
      expect(result.netSalary).toBe(274_380); // 322 800 - 48 420
      expect(result.totalEmployerCost).toBe(322_800); // 322 800 + 0 Szocho
    });

    it('nyugdíjas magasabb bérnél (500 000 Ft) is 0 Ft TB-t és 0 Ft SZOCHO-t kap', () => {
      const result = calculatePayroll(makeInput(500_000, {
        isPensioner: true,
      }));

      expect(result.szjaAmount).toBe(75_000); // 500k * 0.15
      expect(result.tbAmount).toBe(0);
      expect(result.szochoAmount).toBe(0);
      expect(result.netSalary).toBe(425_000);
      expect(result.totalEmployerCost).toBe(500_000);
    });
  });

  describe('Felszolgálási díj vendéglátásban (71/2005. GKM, Szja tv. 1. sz. melléklet 4.38., Szocho tv. 5. § (1) m))', () => {
    it('normál munkavállaló esetén: SZJA mentes (0%), SZOCHO mentes (0%), de TB járulék köteles (18.5%)', () => {
      const input = makeInput(300_000);
      input.grossComponents.serviceCharge = 100_000;

      const result = calculatePayroll(input);

      // Bruttó bér = 300 000 alapbér + 100 000 felszolgálási díj = 400 000 Ft
      expect(result.grossSalary).toBe(400_000);
      // SZJA adóalap csak a 300 000 Ft (felszolgálási díj 0% SZJA) -> 45 000 Ft
      expect(result.szjaBase).toBe(300_000);
      expect(result.szjaAmount).toBe(45_000);
      // TB alap a teljes 400 000 Ft (18.5%) -> 74 000 Ft
      expect(result.tbBase).toBe(400_000);
      expect(result.tbAmount).toBe(74_000);
      // SZOCHO alap csak a 300 000 Ft (felszolgálási díj mentes) -> 39 000 Ft
      expect(result.szochoBase).toBe(300_000);
      expect(result.szochoAmount).toBe(39_000);
      // Nettó bér: 400 000 - 45 000 (SZJA) - 74 000 (TB) = 281 000 Ft
      expect(result.netSalary).toBe(281_000);
      // Munkáltatói összköltség: 400 000 bruttó + 39 000 szocho = 439 000 Ft
      expect(result.totalEmployerCost).toBe(439_000);
      expect(result.serviceChargeAmount).toBe(100_000);
    });

    it('nyugdíjas munkavállaló esetén a felszolgálási díj is teljesen TB és SZOCHO mentes', () => {
      const input = makeInput(300_000, { isPensioner: true });
      input.grossComponents.serviceCharge = 100_000;

      const result = calculatePayroll(input);

      expect(result.grossSalary).toBe(400_000);
      expect(result.szjaAmount).toBe(45_000); // csak az alapbérre 15%
      expect(result.tbAmount).toBe(0); // nyugdíjas mentes TB alól
      expect(result.szochoAmount).toBe(0); // nyugdíjas mentes SZOCHO alól
      expect(result.netSalary).toBe(355_000); // 400 000 - 45 000
      expect(result.totalEmployerCost).toBe(400_000);
    });
  });

  describe('Tbj. szerinti TB 4-es bontás és 2026-os minimum járulékalap (JS-02, JS-04, KE-01)', () => {
    it('TB 18,5% pontos 4-es törvényi bontása (10% nyugdíj, 4% term. egészség, 3% pénzbeli, 1.5% munkaerőpiaci)', () => {
      const result = calculatePayroll(makeInput(400_000, { isInsured: true }));

      expect(result.grossSalary).toBe(400_000);
      expect(result.tbAmount).toBe(74_000); // 400_000 * 0.185

      // 4-es bontás
      expect(result.tbPension).toBe(40_000);        // 10%
      expect(result.tbHealthNature).toBe(16_000);   // 4%
      expect(result.tbHealthCash).toBe(12_000);     // 3%
      expect(result.tbLabor).toBe(6_000);           // 1.5%
      expect(result.tbPension + result.tbHealthNature + result.tbHealthCash + result.tbLabor).toBe(74_000);
    });

    it('Családi járulékkedvezmény törvényi levonási sorrendje (KE-01: nyugdíj -> term. eg. -> pénzbeli eg. -> munkaerőpiaci)', () => {
      // 200_000 Ft bruttó, 3 gyermek (családi kedvezmény: 3 * 440_000 = 1_320_000 Ft adóalap kedvezmény)
      // SZJA alap 0 Ft lesz, a fennmaradó rész a TB-ből vonható le (teljes TB = 200_000 * 0.185 = 37_000 Ft)
      const input = makeInput(200_000, {
        isInsured: true,
        declarations: {
          family: { eligibleChildrenCount: 3, dependentCount: 3, sharePct: 100 }
        }
      });
      const result = calculatePayroll(input);

      expect(result.szjaAmount).toBe(0);
      expect(result.totalTbSaving).toBe(37_000); // 200_000 * 0.185
      expect(result.tbAmount).toBe(0);

      // Kedvezmények bontása
      expect(result.tbPensionCreditUsed).toBe(20_000);      // 10%
      expect(result.tbHealthNatureCreditUsed).toBe(8_000);   // 4%
      expect(result.tbHealthCashCreditUsed).toBe(6_000);     // 3%
      expect(result.tbLaborCreditUsed).toBe(3_000);          // 1.5%
      expect(result.tbPension).toBe(0);
      expect(result.tbHealthNature).toBe(0);
      expect(result.tbHealthCash).toBe(0);
      expect(result.tbLabor).toBe(0);
    });

    it('Tbj. 27. § (2) szerinti 30%-os minimális járulékalap (96.840 Ft) különbözet munkáltatói terhe (JS-04)', () => {
      // Munkaviszony (1101), 60 000 Ft bruttó bér (pl. 2 órás részmunkaidő, nem mentesített)
      // Alsó határ: 322 800 * 0.3 = 96 840 Ft
      // Munkavállaló levonása: 60 000 * 0.185 = 11 100 Ft
      // Különbözet: 96 840 - 60 000 = 36 840 Ft
      // Munkáltatói TB teher a különbözet után: 36 840 * 0.185 = 6 815 Ft
      const input = makeInput(60_000, {
        jobCode: '1101',
        isInsured: true,
      });
      const result = calculatePayroll(input);

      expect(result.grossSalary).toBe(60_000);
      expect(result.tbBase).toBe(60_000);
      expect(result.tbAmount).toBe(11_100);
      expect(result.minBaseDiff).toBe(36_840);
      expect(result.minBaseEmployerContribution).toBe(6_815);
      // Munkáltatói összköltség tartalmazza a különbözeti járulékot is:
      // 60 000 bruttó + (96 840 * 0.13 szocho = 12 589) + 6 815 = 79 404 Ft
      expect(result.totalEmployerCost).toBe(60_000 + result.szochoAmount + 6_815);
    });

    it('Tartós megbízás (1115) alsó határ és szünetelési napok arányosítása (JS-06, TA-06)', () => {
      // 30 napos hónap, 10 nap szünetelés -> 20 biztosítási nap
      // Alsó határ: 96 840 * (20 / 30) = 64 560 Ft
      const input = makeInput(40_000, {
        jobCode: '1115',
        isInsured: true,
        monthDays: 30,
        suspensionDays: 10,
        insuredDays: 20,
      });
      const result = calculatePayroll(input);

      expect(result.insuredDays).toBe(20);
      expect(result.suspensionDays).toBe(10);
      expect(result.minBaseDiff).toBe(64_560 - 40_000); // 24 560 Ft
      expect(result.minBaseEmployerContribution).toBe(Math.round(24_560 * 0.185));
    });

    it('Hóközi nyugdíjba lépés esetén az ellátás előtti napokra arányos TB és SZOCHO jár', () => {
      // 30 napos hónap, a nyugdíj 16-án indul (15 aktív biztosított nap = 50% arány)
      const input = makeInput(400_000, {
        isInsured: true,
        isPensioner: true,
        pensionStartDate: '2026-03-16',
        monthDays: 30,
      });
      const result = calculatePayroll(input);

      expect(result.tbBase).toBe(200_000); // 400 000 * (15/30)
      expect(result.tbAmount).toBe(37_000); // 200 000 * 0.185
      expect(result.tbPension).toBe(20_000); // 10%
      expect(result.tbHealthNature).toBe(8_000); // 4%
      expect(result.tbHealthCash).toBe(6_000); // 3%
      expect(result.tbLabor).toBe(3_000); // 1.5%
      expect(result.szochoAmount).toBe(26_000); // 200 000 * 0.13
    });
  });
});
