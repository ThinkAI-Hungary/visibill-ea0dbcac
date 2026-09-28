import { describe, it, expect } from 'vitest';
import type { SubledgerItem } from '@/types/subledger';

describe('Subledger & Open Items Management Unit Tests', () => {
  describe('Aging Buckets Calculation', () => {
    function calculateAgingBuckets(items: SubledgerItem[], referenceDate = new Date('2026-09-28')) {
      const buckets = {
        notDue: { count: 0, amount: 0 },
        d1_30: { count: 0, amount: 0 },
        d31_60: { count: 0, amount: 0 },
        d61_90: { count: 0, amount: 0 },
        d90plus: { count: 0, amount: 0 },
      };

      const openItems = items.filter((i) => !i.is_settled && i.remaining_amount > 0);

      openItems.forEach((i) => {
        const due = i.due_date ? new Date(i.due_date) : new Date(i.document_date);
        const diffTime = referenceDate.getTime() - due.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const rem = i.remaining_amount;

        if (diffDays <= 0) {
          buckets.notDue.count++;
          buckets.notDue.amount += rem;
        } else if (diffDays <= 30) {
          buckets.d1_30.count++;
          buckets.d1_30.amount += rem;
        } else if (diffDays <= 60) {
          buckets.d31_60.count++;
          buckets.d31_60.amount += rem;
        } else if (diffDays <= 90) {
          buckets.d61_90.count++;
          buckets.d61_90.amount += rem;
        } else {
          buckets.d90plus.count++;
          buckets.d90plus.amount += rem;
        }
      });

      return buckets;
    }

    it('correctly categorizes items across aging intervals', () => {
      const mockItems: SubledgerItem[] = [
        {
          line_id: '1',
          header_id: 'h1',
          posting_date: '2026-09-25',
          document_date: '2026-09-25',
          due_date: '2026-10-05', // Not due (+7 days)
          document_id: 'INV-001',
          partner_id: 'p1',
          partner_name: 'Partner A',
          gl_account_id: 'gl1',
          gl_number: '3111',
          gl_short_name: 'Vevők',
          dc_type: 'T',
          amount: 50000,
          foreign_amount: null,
          currency: 'HUF',
          settled_amount: 0,
          remaining_amount: 50000,
          is_settled: false,
          match_count: 0,
          description: 'Számla',
          status: 'KONYVELT',
          journal_code: 'V',
          journal_number: 1,
        },
        {
          line_id: '2',
          header_id: 'h2',
          posting_date: '2026-09-01',
          document_date: '2026-09-01',
          due_date: '2026-09-15', // 13 days overdue (1-30)
          document_id: 'INV-002',
          partner_id: 'p1',
          partner_name: 'Partner A',
          gl_account_id: 'gl1',
          gl_number: '3111',
          gl_short_name: 'Vevők',
          dc_type: 'T',
          amount: 120000,
          foreign_amount: null,
          currency: 'HUF',
          settled_amount: 20000,
          remaining_amount: 100000,
          is_settled: false,
          match_count: 1,
          description: 'Számla',
          status: 'KONYVELT',
          journal_code: 'V',
          journal_number: 2,
        },
        {
          line_id: '3',
          header_id: 'h3',
          posting_date: '2026-08-01',
          document_date: '2026-08-01',
          due_date: '2026-08-15', // 44 days overdue (31-60)
          document_id: 'INV-003',
          partner_id: 'p2',
          partner_name: 'Partner B',
          gl_account_id: 'gl1',
          gl_number: '3111',
          gl_short_name: 'Vevők',
          dc_type: 'T',
          amount: 80000,
          foreign_amount: null,
          currency: 'HUF',
          settled_amount: 0,
          remaining_amount: 80000,
          is_settled: false,
          match_count: 0,
          description: 'Számla',
          status: 'KONYVELT',
          journal_code: 'V',
          journal_number: 3,
        },
        {
          line_id: '4',
          header_id: 'h4',
          posting_date: '2026-05-01',
          document_date: '2026-05-01',
          due_date: '2026-05-15', // >90 days overdue
          document_id: 'INV-004',
          partner_id: 'p3',
          partner_name: 'Partner C',
          gl_account_id: 'gl1',
          gl_number: '3111',
          gl_short_name: 'Vevők',
          dc_type: 'T',
          amount: 200000,
          foreign_amount: null,
          currency: 'HUF',
          settled_amount: 0,
          remaining_amount: 200000,
          is_settled: false,
          match_count: 0,
          description: 'Számla',
          status: 'KONYVELT',
          journal_code: 'V',
          journal_number: 4,
        },
      ];

      const buckets = calculateAgingBuckets(mockItems);
      expect(buckets.notDue.count).toBe(1);
      expect(buckets.notDue.amount).toBe(50000);

      expect(buckets.d1_30.count).toBe(1);
      expect(buckets.d1_30.amount).toBe(100000);

      expect(buckets.d31_60.count).toBe(1);
      expect(buckets.d31_60.amount).toBe(80000);

      expect(buckets.d61_90.count).toBe(0);
      expect(buckets.d61_90.amount).toBe(0);

      expect(buckets.d90plus.count).toBe(1);
      expect(buckets.d90plus.amount).toBe(200000);
    });

    it('ignores completely settled items in aging calculation', () => {
      const mockItems: SubledgerItem[] = [
        {
          line_id: '5',
          header_id: 'h5',
          posting_date: '2026-05-01',
          document_date: '2026-05-01',
          due_date: '2026-05-15',
          document_id: 'INV-CLOSED',
          partner_id: 'p1',
          partner_name: 'Partner A',
          gl_account_id: 'gl1',
          gl_number: '3111',
          gl_short_name: 'Vevők',
          dc_type: 'T',
          amount: 60000,
          foreign_amount: null,
          currency: 'HUF',
          settled_amount: 60000,
          remaining_amount: 0,
          is_settled: true,
          match_count: 1,
          description: 'Lezárt',
          status: 'KONYVELT',
          journal_code: 'V',
          journal_number: 5,
        },
      ];

      const buckets = calculateAgingBuckets(mockItems);
      expect(buckets.notDue.count).toBe(0);
      expect(buckets.d90plus.count).toBe(0);
      expect(buckets.d90plus.amount).toBe(0);
    });
  });

  describe('Multi-Item Pairing & Greedy Matching Engine', () => {
    function computePairingSteps(tItems: { id: string; amount: number }[], kItems: { id: string; amount: number }[]) {
      const steps: { tId: string; kId: string; amount: number }[] = [];
      let tIdx = 0;
      let kIdx = 0;
      let remT = tItems[0]?.amount || 0;
      let remK = kItems[0]?.amount || 0;

      while (tIdx < tItems.length && kIdx < kItems.length) {
        const pairAmount = Math.min(remT, remK);
        if (pairAmount > 0.009) {
          steps.push({
            tId: tItems[tIdx].id,
            kId: kItems[kIdx].id,
            amount: Number(pairAmount.toFixed(2)),
          });
        }

        remT -= pairAmount;
        remK -= pairAmount;

        if (remT <= 0.01) {
          tIdx++;
          if (tIdx < tItems.length) {
            remT = tItems[tIdx].amount;
          }
        }

        if (remK <= 0.01) {
          kIdx++;
          if (kIdx < kItems.length) {
            remK = kItems[kIdx].amount;
          }
        }
      }

      return steps;
    }

    it('correctly pairs 1:1 exact amounts', () => {
      const t = [{ id: 'T1', amount: 100000 }];
      const k = [{ id: 'K1', amount: 100000 }];
      const steps = computePairingSteps(t, k);

      expect(steps).toHaveLength(1);
      expect(steps[0]).toEqual({ tId: 'T1', kId: 'K1', amount: 100000 });
    });

    it('correctly handles 1:N partial payments', () => {
      const t = [{ id: 'T1', amount: 100000 }];
      const k = [
        { id: 'K1', amount: 40000 },
        { id: 'K2', amount: 60000 },
      ];
      const steps = computePairingSteps(t, k);

      expect(steps).toHaveLength(2);
      expect(steps[0]).toEqual({ tId: 'T1', kId: 'K1', amount: 40000 });
      expect(steps[1]).toEqual({ tId: 'T1', kId: 'K2', amount: 60000 });
    });

    it('correctly handles N:1 consolidated bank statement', () => {
      const t = [
        { id: 'T1', amount: 35000 },
        { id: 'T2', amount: 65000 },
      ];
      const k = [{ id: 'K1', amount: 100000 }];
      const steps = computePairingSteps(t, k);

      expect(steps).toHaveLength(2);
      expect(steps[0]).toEqual({ tId: 'T1', kId: 'K1', amount: 35000 });
      expect(steps[1]).toEqual({ tId: 'T2', kId: 'K1', amount: 65000 });
    });

    it('correctly detects <= 10 Ft rounding threshold for write-off', () => {
      const sumT = 100008;
      const sumK = 100000;
      const diff = Math.abs(sumT - sumK);

      const isSmallRounding = diff > 0.01 && diff <= 10;
      expect(isSmallRounding).toBe(true);

      const largeDiff = Math.abs(100015 - 100000);
      expect(largeDiff <= 10).toBe(false);
    });
  });
});
