import { describe, it, expect } from 'vitest';
import {
  calculateDefaultTaxCreditRetentionUntil,
  checkTaxCreditAlienationRestriction,
} from '@/lib/fixed-assets/taxCreditRestrictionService';

describe('taxCreditRestrictionService', () => {
  it('correctly calculates 4-year default retention date', () => {
    expect(calculateDefaultTaxCreditRetentionUntil('2024-05-10')).toBe('2028-05-10');
    expect(calculateDefaultTaxCreditRetentionUntil('2026-01-01')).toBe('2030-01-01');
    expect(calculateDefaultTaxCreditRetentionUntil('')).toBe('');
  });

  it('returns not restricted if asset does not have tax credit', () => {
    const res = checkTaxCreditAlienationRestriction({
      hasTaxCredit: false,
      disposalDate: '2026-06-01',
      activationDate: '2025-01-01',
    });
    expect(res.restricted).toBe(false);
  });

  it('returns restricted when disposal date is within 4-year retention period', () => {
    const res = checkTaxCreditAlienationRestriction({
      hasTaxCredit: true,
      activationDate: '2024-05-10',
      disposalDate: '2026-06-01', // Before 2028-05-10
    });
    expect(res.restricted).toBe(true);
    expect(res.retentionUntil).toBe('2028-05-10');
    expect(res.daysRemaining).toBeGreaterThan(0);
    expect(res.reasonMessage).toContain('2028-05-10');
  });

  it('returns not restricted when disposal date is on or after retention period', () => {
    const res = checkTaxCreditAlienationRestriction({
      hasTaxCredit: true,
      activationDate: '2020-01-01',
      taxCreditRetentionUntil: '2024-01-01',
      disposalDate: '2024-01-01',
    });
    expect(res.restricted).toBe(false);

    const resAfter = checkTaxCreditAlienationRestriction({
      hasTaxCredit: true,
      activationDate: '2020-01-01',
      taxCreditRetentionUntil: '2024-01-01',
      disposalDate: '2024-05-15',
    });
    expect(resAfter.restricted).toBe(false);
  });

  it('respects explicitly provided custom taxCreditRetentionUntil', () => {
    const res = checkTaxCreditAlienationRestriction({
      hasTaxCredit: true,
      activationDate: '2024-01-01',
      taxCreditRetentionUntil: '2029-12-31', // 5 years custom
      disposalDate: '2028-06-01',
    });
    expect(res.restricted).toBe(true);
    expect(res.retentionUntil).toBe('2029-12-31');
  });
});
