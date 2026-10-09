import { describe, it, expect } from 'vitest';
import { computeMatchStatus } from '@/hooks/useComputedStatus';

describe('computeMatchStatus transfer and auto_settled handling', () => {
  it('classifies számlák közötti átvezetés as auto_settled even without matched invoice', () => {
    const status = computeMatchStatus({
      type: 'számlák közötti átvezetés',
      match_type: null,
      matched_invoice_id: null,
      is_verified: null,
    });
    expect(status).toBe('auto_settled');
  });

  it('classifies transfer (English) as auto_settled', () => {
    const status = computeMatchStatus({
      type: 'transfer',
      match_type: null,
      matched_invoice_id: null,
      is_verified: null,
    });
    expect(status).toBe('auto_settled');
  });

  it('classifies no_match_category explicitly as auto_settled', () => {
    const status = computeMatchStatus({
      type: 'szállítói tranzakció',
      match_type: 'no_match_category',
      matched_invoice_id: null,
      is_verified: null,
    });
    expect(status).toBe('auto_settled');
  });

  it('preserves matched status when verified and matched to invoice', () => {
    const status = computeMatchStatus({
      type: 'szállítói tranzakció',
      match_type: 'exact',
      matched_invoice_id: 'inv-123',
      is_verified: true,
    });
    expect(status).toBe('matched');
  });
});
