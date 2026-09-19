import { describe, it, expect } from 'vitest';
import {
  calculateDividendTaxes,
  SZOCHO_ANNUAL_CAP_2026,
} from '@/hooks/useDividends';

describe('calculateDividendTaxes (2026 Dividend Tax Calculations)', () => {
  it('should calculate 15% SZJA and 13% SZOCHO on amount below cap', () => {
    const res = calculateDividendTaxes({
      grossAmount: 1_000_000,
      hasReachedSzochoCap: false,
    });

    expect(res.grossAmount).toBe(1_000_000);
    expect(res.szjaAmount).toBe(150_000); // 15%
    expect(res.szochoAmount).toBe(130_000); // 13%
    expect(res.netAmount).toBe(720_000); // 1_000_000 - 150_000 - 130_000
    expect(res.isCapped).toBe(false);
  });

  it('should calculate 0 SZOCHO when member has already reached SZOCHO cap', () => {
    const res = calculateDividendTaxes({
      grossAmount: 5_000_000,
      hasReachedSzochoCap: true,
    });

    expect(res.grossAmount).toBe(5_000_000);
    expect(res.szjaAmount).toBe(750_000); // 15%
    expect(res.szochoAmount).toBe(0); // 0%
    expect(res.netAmount).toBe(4_250_000); // 5_000_000 - 750_000
    expect(res.isCapped).toBe(true);
  });

  it('should cap SZOCHO at 24x minimum wage (7 747 200 Ft) when gross exceeds cap', () => {
    const res = calculateDividendTaxes({
      grossAmount: 15_000_000, // 15 million Ft dividend
      hasReachedSzochoCap: false,
    });

    expect(res.grossAmount).toBe(15_000_000);
    expect(res.szjaAmount).toBe(2_250_000); // 15% of 15M
    // SZOCHO cap: 7_747_200 * 0.13 = 1_007_136
    expect(res.szochoAmount).toBe(1_007_136);
    expect(res.taxableSzochoBase).toBe(SZOCHO_ANNUAL_CAP_2026);
    expect(res.isCapped).toBe(true);
    expect(res.netAmount).toBe(15_000_000 - 2_250_000 - 1_007_136);
  });

  it('should consider prior income towards SZOCHO cap', () => {
    // Prior income from employment: 5 000 000 Ft
    // Remaining cap: 7 747 200 - 5 000 000 = 2 747 200 Ft
    const res = calculateDividendTaxes({
      grossAmount: 4_000_000,
      hasReachedSzochoCap: false,
      priorIncomeForCap: 5_000_000,
    });

    expect(res.grossAmount).toBe(4_000_000);
    expect(res.szjaAmount).toBe(600_000); // 15% of 4M
    expect(res.taxableSzochoBase).toBe(2_747_200);
    expect(res.szochoAmount).toBe(Math.round(2_747_200 * 0.13)); // 357_136
    expect(res.isCapped).toBe(true);
  });

  it('should handle zero or negative amounts gracefully', () => {
    const res = calculateDividendTaxes({
      grossAmount: 0,
      hasReachedSzochoCap: false,
    });

    expect(res.grossAmount).toBe(0);
    expect(res.szjaAmount).toBe(0);
    expect(res.szochoAmount).toBe(0);
    expect(res.netAmount).toBe(0);
  });
});
