import { describe, it, expect } from 'vitest';
import { extractDateRangeFromText, calculateAccrualSplit } from '../accrualMath';

describe('accrualMath — Date Range Extraction', () => {
  it('extracts date range from Hungarian dot-separated invoice description', () => {
    const text = 'GDPR Kieg.biztositásí díj 2026.09.01.-2027.08.31. Közvetitett szolgáltatást tartalmaz';
    const result = extractDateRangeFromText(text);

    expect(result).not.toBeNull();
    expect(result?.startDate).toBe('2026-09-01');
    expect(result?.endDate).toBe('2027-08-31');
  });

  it('extracts date range with spaces and parenthesized prefix', () => {
    const text = 'GDPR Kiegészítő biztosítási díj (Időszak: 2026.09.01.-2027.08.31.)';
    const result = extractDateRangeFromText(text);

    expect(result).not.toBeNull();
    expect(result?.startDate).toBe('2026-09-01');
    expect(result?.endDate).toBe('2027-08-31');
  });

  it('extracts date range with en-dash and spaced dots', () => {
    const text = 'Bérleti díj 2026. 10. 01. – 2027. 03. 31.';
    const result = extractDateRangeFromText(text);

    expect(result).not.toBeNull();
    expect(result?.startDate).toBe('2026-10-01');
    expect(result?.endDate).toBe('2027-03-31');
  });

  it('extracts date range from ISO formatted string', () => {
    const text = 'Szoftver előfizetés 2026-06-01 - 2027-05-31';
    const result = extractDateRangeFromText(text);

    expect(result).not.toBeNull();
    expect(result?.startDate).toBe('2026-06-01');
    expect(result?.endDate).toBe('2027-05-31');
  });

  it('returns null when text does not contain valid dates', () => {
    expect(extractDateRangeFromText('Irodaszer vásárlás toll és papír')).toBeNull();
    expect(extractDateRangeFromText('')).toBeNull();
    expect(extractDateRangeFromText(null)).toBeNull();
    expect(extractDateRangeFromText(undefined)).toBeNull();
  });
});

describe('accrualMath — Pro-rata & Monthly Accrual Calculation', () => {
  it('correctly calculates daily pro-rata accrual for Surányi Pál invoice (EB-0206)', () => {
    const split = calculateAccrualSplit({
      amount: 7700,
      startDate: '2026-09-01',
      endDate: '2027-08-31',
      method: 'daily',
      direction: 'INBOUND',
    });

    expect(split.hasCrossYearOverlap).toBe(true);
    expect(split.totalDays).toBe(365);
    // Sep (30) + Oct (31) + Nov (30) + Dec (31) = 122 days
    expect(split.currentPeriodDays).toBe(122);
    // 365 - 122 = 243 days
    expect(split.nextPeriodDays).toBe(243);
    expect(split.accrualType).toBe('AIE');
    expect(split.suggestedDebitGl).toBe('392');
    expect(split.accrualDate).toBe('2026-12-31');
    expect(split.reversalDate).toBe('2027-01-01');

    // Mathematical precision: round(7700 * 243 / 365) = round(5126.30) = 5126
    expect(split.accrualAmount).toBe(5126);
    expect(split.currentPeriodAmount).toBe(2574);
    expect(split.currentPeriodAmount + split.accrualAmount).toBe(7700);
  });

  it('correctly calculates monthly pro-rata accrual for Surányi Pál invoice (EB-0206)', () => {
    const split = calculateAccrualSplit({
      amount: 7700,
      startDate: '2026-09-01',
      endDate: '2027-08-31',
      method: 'monthly',
      direction: 'INBOUND',
    });

    expect(split.hasCrossYearOverlap).toBe(true);
    expect(split.totalMonths).toBe(12);
    expect(split.currentPeriodMonths).toBe(4);
    expect(split.nextPeriodMonths).toBe(8);

    // 7700 * (8 / 12) = 5133.33 -> 5133 Ft
    expect(split.accrualAmount).toBe(5133);
    // 7700 - 5133 = 2567 Ft
    expect(split.currentPeriodAmount).toBe(2567);
    expect(split.currentPeriodAmount + split.accrualAmount).toBe(7700);
  });

  it('handles within-year invoice without cross-year overlap', () => {
    const split = calculateAccrualSplit({
      amount: 100000,
      startDate: '2026-01-01',
      endDate: '2026-06-30',
      direction: 'INBOUND',
    });

    expect(split.hasCrossYearOverlap).toBe(false);
    expect(split.accrualAmount).toBe(0);
    expect(split.currentPeriodAmount).toBe(100000);
  });

  it('correctly sets PIE (Passzív időbeli elhatárolás) for OUTBOUND invoices', () => {
    const split = calculateAccrualSplit({
      amount: 1200000,
      startDate: '2026-07-01',
      endDate: '2027-06-30',
      method: 'monthly',
      direction: 'OUTBOUND',
    });

    expect(split.hasCrossYearOverlap).toBe(true);
    expect(split.accrualType).toBe('PIE');
    expect(split.suggestedCreditGl).toBe('481');
    expect(split.accrualAmount).toBe(600000);
    expect(split.currentPeriodAmount).toBe(600000);
  });
});
