import { describe, it, expect } from 'vitest';
import {
  calculatePayroll, calculateGross, calculateGarnishments,
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
