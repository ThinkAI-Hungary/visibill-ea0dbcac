import { describe, it, expect } from 'vitest';
import {
  calculateCafeteriaTax,
  DEFAULT_2026_SZEP_LIMITS,
  type CafeteriaAllocation,
  type YtdUsage,
} from '../cafeteriaCalculator';

function makeAlloc(overrides: Partial<CafeteriaAllocation> = {}): CafeteriaAllocation {
  return {
    employeeId: 'emp-1',
    employeeName: 'Teszt Elek',
    accommodation: 0,
    hospitality: 0,
    leisure: 0,
    recreation: 0,
    privatePhone: 0,
    ...overrides,
  };
}

function makeYtd(overrides: Partial<YtdUsage> = {}): YtdUsage {
  return {
    accommodationYtd: 0,
    hospitalityYtd: 0,
    leisureYtd: 0,
    recreationYtd: 0,
    ...overrides,
  };
}

describe('cafeteriaCalculator', () => {
  it('should return zero for no allocations', () => {
    const result = calculateCafeteriaTax(makeAlloc(), makeYtd());
    expect(result.totalBenefit).toBe(0);
    expect(result.totalTax).toBe(0);
    expect(result.totalCostToEmployer).toBe(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('should calculate 28% tax on SZÉP card', () => {
    const result = calculateCafeteriaTax(
      makeAlloc({ accommodation: 30_000, hospitality: 20_000, leisure: 10_000 }),
      makeYtd()
    );

    expect(result.szepTotal).toBe(60_000);
    expect(result.szepTax).toBe(Math.round(60_000 * 0.28)); // 16.800
    expect(result.totalTax).toBe(16_800);
    expect(result.totalCostToEmployer).toBe(60_000 + 16_800);
  });

  it('should warn when approaching yearly SZÉP limit', () => {
    const result = calculateCafeteriaTax(
      makeAlloc({ accommodation: 40_000 }),
      makeYtd({ accommodationYtd: 400_000 }) // 400k + 40k = 440k > 85% of 450k
    );

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0].type).toBe('approaching_limit');
    expect(result.warnings[0].pocket).toBe('Szálláshely');
  });

  it('should warn when exceeding yearly SZÉP limit', () => {
    const result = calculateCafeteriaTax(
      makeAlloc({ hospitality: 50_000 }),
      makeYtd({ hospitalityYtd: 420_000 }) // 420k + 50k = 470k > 450k
    );

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0].type).toBe('over_limit');
    expect(result.warnings[0].pocket).toBe('Vendéglátás');
  });

  it('should tax recreation within 120k limit at 1.0x rate', () => {
    const result = calculateCafeteriaTax(
      makeAlloc({ recreation: 10_000 }),
      makeYtd({ recreationYtd: 30_000 }) // 30k + 10k = 40k < 120k
    );

    expect(result.recreationTotal).toBe(10_000);
    expect(result.recreationTax).toBe(Math.round(10_000 * 0.28));
  });

  it('should tax recreation above 120k limit at 1.18x rate', () => {
    const result = calculateCafeteriaTax(
      makeAlloc({ recreation: 20_000 }),
      makeYtd({ recreationYtd: 110_000 }) // 110k + 20k = 130k → 10k low, 10k high
    );

    // 10_000 * 0.28 = 2.800
    // 10_000 * 1.18 * 0.28 = 3.304
    // total = 6.104
    expect(result.recreationTax).toBe(6104);
  });

  it('should tax 20% of private phone usage', () => {
    const result = calculateCafeteriaTax(
      makeAlloc({ privatePhone: 10_000 }),
      makeYtd()
    );

    expect(result.phoneTaxable).toBe(2_000); // 10.000 * 20%
    expect(result.phoneTax).toBe(Math.round(2_000 * 0.28)); // 560
  });

  it('should calculate combined benefits correctly', () => {
    const result = calculateCafeteriaTax(
      makeAlloc({
        accommodation: 37_500,  // 450k / 12
        hospitality: 37_500,
        leisure: 37_500,
        recreation: 10_000,      // 120k / 12
        privatePhone: 5_000,
      }),
      makeYtd()
    );

    const szepTotal = 37_500 * 3; // 112.500
    expect(result.szepTotal).toBe(szepTotal);
    expect(result.totalBenefit).toBe(szepTotal + 10_000 + 5_000); // 127.500
    expect(result.szepTax).toBe(Math.round(szepTotal * 0.28));
    expect(result.recreationTax).toBe(Math.round(10_000 * 0.28));
    expect(result.phoneTaxable).toBe(1_000); // 5.000 * 20%
  });

  it('should detect multiple limit warnings', () => {
    const result = calculateCafeteriaTax(
      makeAlloc({ accommodation: 50_000, hospitality: 50_000 }),
      makeYtd({ accommodationYtd: 420_000, hospitalityYtd: 410_000 })
    );

    // Accommodation: 420k+50k = 470k > 450k → over_limit
    // Hospitality: 410k+50k = 460k > 450k → over_limit
    expect(result.warnings.length).toBe(2);
    expect(result.warnings.every(w => w.type === 'over_limit')).toBe(true);
  });
});
