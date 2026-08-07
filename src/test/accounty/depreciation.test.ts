import { describe, it, expect } from 'vitest';
import { calculateDepreciation } from '../../hooks/useDepreciation';

describe('calculateDepreciation', () => {
  const baseParams = {
    acquisitionValue: 1500000,
    residualValue: 0,
    activationDate: new Date('2026-01-01'),
    usefulLifeMonths: 36, // 3 years
    taoRatePercent: 20, // 20% linear Tao
  };

  it('calculates linear depreciation correctly', () => {
    // 1 year later (12 months)
    const res = calculateDepreciation({
      ...baseParams,
      calculationDate: new Date('2027-01-01'),
      depreciationMethod: 'linear',
    });

    // Accounting: 1500000 / 36 * 12 = 500000
    expect(res.accounting.accumulated).toBe(500000);
    expect(res.accounting.bookValue).toBe(1000000);

    // Tax: 1500000 * 0.2 = 300000
    expect(res.tax.accumulated).toBe(300000);
    expect(res.tax.bookValue).toBe(1200000);
  });

  it('calculates degressive years sum (SYD) correctly', () => {
    // SYD for 3 years: S = 1 + 2 + 3 = 6
    // Year 1 fraction: 3/6
    const res = calculateDepreciation({
      ...baseParams,
      calculationDate: new Date('2027-01-01'),
      depreciationMethod: 'degressive_syd',
    });

    // Year 1 accumulated: 1500000 * (3 / 6) = 750000
    expect(res.accounting.accumulated).toBe(750000);
    expect(res.accounting.bookValue).toBe(750000);
  });

  it('calculates declining balance (200% DB) correctly', () => {
    // 3 years useful life -> 66.6% annual rate -> 5.55% monthly rate
    const res = calculateDepreciation({
      ...baseParams,
      calculationDate: new Date('2027-01-01'),
      depreciationMethod: 'degressive_declining',
    });

    // Let's verify it depreciates rapidly in the first year
    expect(res.accounting.accumulated).toBeGreaterThan(600000);
    expect(res.accounting.bookValue).toBeLessThan(900000);
  });

  it('calculates progressive depreciation correctly', () => {
    // Progressive for 3 years: S = 6
    // Year 1 fraction: 1/6
    const res = calculateDepreciation({
      ...baseParams,
      calculationDate: new Date('2027-01-01'),
      depreciationMethod: 'progressive',
    });

    // Year 1 accumulated: 1500000 * (1 / 6) = 250000
    expect(res.accounting.accumulated).toBe(250000);
    expect(res.accounting.bookValue).toBe(1250000);
  });

  it('calculates performance-based depreciation correctly', () => {
    const res = calculateDepreciation({
      ...baseParams,
      calculationDate: new Date('2026-07-01'),
      depreciationMethod: 'performance',
      totalPlannedPerformance: 100000,
      performanceUnit: 'km',
      performanceLogs: [
        { date: '2026-03-01', amount: 12000 },
        { date: '2026-06-01', amount: 8000 },
        { date: '2026-08-01', amount: 15000 }, // after calculationDate
      ],
    });

    // Total actual performance up to 2026-07-01 is 12000 + 8000 = 20000
    // Accumulated: 1500000 * (20000 / 100000) = 300000
    expect(res.accounting.accumulated).toBe(300000);
  });

  it('calculates absolute schedule depreciation correctly', () => {
    const res = calculateDepreciation({
      ...baseParams,
      calculationDate: new Date('2027-01-01'),
      depreciationMethod: 'absolute',
      depreciationSchedule: [600000, 500000, 400000],
    });

    // Year 1 accumulated: 600000
    expect(res.accounting.accumulated).toBe(600000);
  });

  it('calculates multiplier schedule depreciation correctly', () => {
    const res = calculateDepreciation({
      ...baseParams,
      calculationDate: new Date('2027-01-01'),
      depreciationMethod: 'multiplier',
      depreciationSchedule: [1.5, 1.0, 0.5],
    });

    // Linear yearly = 1500000 / 3 = 500000
    // Year 1 accumulated: 500000 * 1.5 = 750000
    expect(res.accounting.accumulated).toBe(750000);
  });

  it('calculates immediate write-off correctly', () => {
    const res = calculateDepreciation({
      ...baseParams,
      calculationDate: new Date('2026-01-01'),
      depreciationMethod: 'immediate',
    });

    // Immediately 100% written off
    expect(res.accounting.accumulated).toBe(1500000);
    expect(res.accounting.bookValue).toBe(0);
  });
});
