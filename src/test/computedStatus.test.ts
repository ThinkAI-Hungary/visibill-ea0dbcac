import { describe, it, expect } from 'vitest';
import { computePaymentStatus, getPaymentStatusBadge } from '@/hooks/useComputedStatus';
import { computePaymentStatus as computePaymentStatusUtil } from '@/lib/statusUtils';

describe('useComputedStatus & statusUtils', () => {
  describe('computePaymentStatus', () => {
    it('returns partially_paid when matchStatus is partially_paid', () => {
      expect(computePaymentStatus('tx-123', 'partially_paid')).toBe('partially_paid');
      expect(computePaymentStatus(null, 'partially_paid')).toBe('partially_paid');
      expect(computePaymentStatusUtil('tx-123', 'partially_paid')).toBe('Részben fizetve');
    });

    it('returns paid when transaction_id is present and matchStatus is not partially_paid', () => {
      expect(computePaymentStatus('tx-123', 'matched')).toBe('paid');
      expect(computePaymentStatus('tx-123')).toBe('paid');
      expect(computePaymentStatusUtil('tx-123')).toBe('Kifizetve');
    });

    it('returns pending / Nyitott when transaction_id is null/undefined and not partially_paid', () => {
      expect(computePaymentStatus(null, 'unmatched')).toBe('pending');
      expect(computePaymentStatus(undefined)).toBe('pending');
      expect(computePaymentStatusUtil(null)).toBe('Nyitott');
    });
  });

  describe('getPaymentStatusBadge', () => {
    it('returns green badge for paid', () => {
      const badge = getPaymentStatusBadge('tx-123', 'matched');
      expect(badge.label).toBe('Kifizetve');
      expect(badge.className).toContain('text-emerald-500');
    });

    it('returns blue badge for partially_paid', () => {
      const badge = getPaymentStatusBadge('tx-123', 'partially_paid');
      expect(badge.label).toBe('Részben fizetve');
      expect(badge.className).toContain('text-blue-600');
      expect(badge.className).toContain('border-blue-500/30');
    });

    it('returns yellow badge for pending', () => {
      const badge = getPaymentStatusBadge(null, 'unmatched');
      expect(badge.label).toBe('Nyitott');
      expect(badge.className).toContain('text-yellow-600');
    });
  });
});
