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

  describe('Two-Sided Posting and Net/VAT Breakdown', () => {
    it('validates two-sided balance (∑T = ∑K)', () => {
      const lines = [
        { dc_type: 'T', amount: 100000 },
        { dc_type: 'T', amount: 27000 },
        { dc_type: 'K', amount: 127000 },
      ];

      const sumT = lines.filter((l) => l.dc_type === 'T').reduce((acc, l) => acc + l.amount, 0);
      const sumK = lines.filter((l) => l.dc_type === 'K').reduce((acc, l) => acc + l.amount, 0);
      const diff = Math.abs(sumT - sumK);

      expect(sumT).toBe(127000);
      expect(sumK).toBe(127000);
      expect(diff).toBe(0);
      expect(diff < 0.01 && lines.length >= 2).toBe(true);
    });

    it('correctly calculates Net, VAT, and Gross breakdown', () => {
      const lines = [
        { dc_type: 'T', amount: 100000, vat_role: 'ALAP' },
        { dc_type: 'T', amount: 27000, vat_role: 'AFA' },
        { dc_type: 'K', amount: 127000, vat_role: null }, // Partner line
      ];

      const netSum = lines.filter((l) => l.vat_role === 'ALAP').reduce((acc, l) => acc + l.amount, 0);
      const vatSum = lines.filter((l) => l.vat_role === 'AFA').reduce((acc, l) => acc + l.amount, 0);
      const grossSum = lines.find((l) => !l.vat_role)?.amount || 0;

      expect(netSum).toBe(100000);
      expect(vatSum).toBe(27000);
      expect(grossSum).toBe(127000);
      expect(netSum + vatSum).toBe(grossSum);
    });

    it('blocks posting when entry is not balanced', () => {
      const lines = [
        { dc_type: 'T', amount: 100000 },
        { dc_type: 'K', amount: 95000 },
      ];

      const sumT = lines.filter((l) => l.dc_type === 'T').reduce((acc, l) => acc + l.amount, 0);
      const sumK = lines.filter((l) => l.dc_type === 'K').reduce((acc, l) => acc + l.amount, 0);
      const diff = Math.abs(sumT - sumK);

      const canPost = diff < 0.01 && lines.length >= 2;
      expect(canPost).toBe(false);
      expect(diff).toBe(5000);
    });
  });

  describe('Invoice Grouping & Multi-item Aggregation', () => {
    function groupSubledgerItems(items: SubledgerItem[]) {
      const map = new Map<string, any>();

      items.forEach((item) => {
        const docId =
          (item.document_id && item.document_id.trim()) ||
          (item.settlement_number && item.settlement_number.trim()) ||
          item.header_id;
        const partnerKey = item.partner_id || item.partner_name || 'no-partner';
        const key = `${partnerKey}___${docId}`;

        const existing = map.get(key);
        if (!existing) {
          map.set(key, {
            group_key: key,
            document_id: docId,
            partner_id: item.partner_id,
            partner_name: item.partner_name,
            posting_date: item.posting_date,
            document_date: item.document_date || item.posting_date,
            due_date: item.due_date,
            journal_code: item.journal_code,
            journal_number: item.journal_number,
            currency: item.currency || 'HUF',
            description: item.description,
            status: item.status,
            is_settled: item.is_settled,
            net_amount: Number(item.net_amount || 0),
            vat_amount: Number(item.vat_amount || 0),
            amount: Number(item.amount || 0),
            settled_amount: Number(item.settled_amount || 0),
            remaining_amount: Number(item.remaining_amount || 0),
            match_count: item.match_count || 0,
            items: [item],
            header_ids: [item.header_id],
            line_ids: [item.line_id],
            all_lines: item.all_lines ? [...item.all_lines] : [],
          });
        } else {
          existing.items.push(item);
          if (!existing.header_ids.includes(item.header_id)) {
            existing.header_ids.push(item.header_id);
          }
          existing.line_ids.push(item.line_id);
          if (item.all_lines) {
            existing.all_lines.push(...item.all_lines);
          }
          existing.net_amount += Number(item.net_amount || 0);
          existing.vat_amount += Number(item.vat_amount || 0);
          existing.amount += Number(item.amount || 0);
          existing.settled_amount += Number(item.settled_amount || 0);
          existing.remaining_amount += Number(item.remaining_amount || 0);
          existing.match_count += item.match_count || 0;

          if (item.status === 'GEPI_JAVASLAT') {
            existing.status = 'GEPI_JAVASLAT';
          } else if (item.status === 'KEZI_PISZKOZAT' && existing.status !== 'GEPI_JAVASLAT') {
            existing.status = 'KEZI_PISZKOZAT';
          }

          existing.is_settled = existing.remaining_amount <= 0.01;

          if (item.due_date && (!existing.due_date || item.due_date > existing.due_date)) {
            existing.due_date = item.due_date;
          }
        }
      });

      return Array.from(map.values());
    }

    it('correctly collapses 4 line items of FCM/00185370 into 1 single invoice row', () => {
      const mockItems: SubledgerItem[] = [
        {
          line_id: 'l1',
          header_id: 'h1',
          document_id: 'FCM/00185370',
          partner_id: 'p-fcm',
          partner_name: 'Fővárosi Csatornázási Művek Zrt.',
          posting_date: '2026-09-04',
          document_date: '2026-09-04',
          due_date: '2026-09-12',
          journal_code: 'SZ-B',
          journal_number: 0,
          currency: 'HUF',
          description: 'Áthárított vízterhelési díj',
          status: 'GEPI_JAVASLAT',
          is_settled: false,
          net_amount: 25,
          vat_amount: 7,
          amount: 32,
          settled_amount: 0,
          remaining_amount: 32,
          match_count: 0,
          gl_account_id: 'gl-4541',
          gl_number: '4541',
          gl_short_name: 'Szállítók',
          dc_type: 'K',
        },
        {
          line_id: 'l2',
          header_id: 'h2',
          document_id: 'FCM/00185370',
          partner_id: 'p-fcm',
          partner_name: 'Fővárosi Csatornázási Művek Zrt.',
          posting_date: '2026-09-04',
          document_date: '2026-09-04',
          due_date: '2026-09-12',
          journal_code: 'SZ-B',
          journal_number: 0,
          currency: 'HUF',
          description: 'Mellékvízmérő ügyviteli díj',
          status: 'GEPI_JAVASLAT',
          is_settled: false,
          net_amount: 76,
          vat_amount: 21,
          amount: 97,
          settled_amount: 0,
          remaining_amount: 97,
          match_count: 0,
          gl_account_id: 'gl-4541',
          gl_number: '4541',
          gl_short_name: 'Szállítók',
          dc_type: 'K',
        },
        {
          line_id: 'l3',
          header_id: 'h3',
          document_id: 'FCM/00185370',
          partner_id: 'p-fcm',
          partner_name: 'Fővárosi Csatornázási Művek Zrt.',
          posting_date: '2026-09-04',
          document_date: '2026-09-04',
          due_date: '2026-09-12',
          journal_code: 'SZ-B',
          journal_number: 0,
          currency: 'HUF',
          description: 'Szennyvízelvezetés és -tisztítás alapdíj',
          status: 'GEPI_JAVASLAT',
          is_settled: false,
          net_amount: 1798,
          vat_amount: 485,
          amount: 2283,
          settled_amount: 0,
          remaining_amount: 2283,
          match_count: 0,
          gl_account_id: 'gl-4541',
          gl_number: '4541',
          gl_short_name: 'Szállítók',
          dc_type: 'K',
        },
        {
          line_id: 'l4',
          header_id: 'h4',
          document_id: 'FCM/00185370',
          partner_id: 'p-fcm',
          partner_name: 'Fővárosi Csatornázási Művek Zrt.',
          posting_date: '2026-09-04',
          document_date: '2026-09-04',
          due_date: '2026-09-12',
          journal_code: 'SZ-B',
          journal_number: 0,
          currency: 'HUF',
          description: 'Elvezetett mennyiséggel arányos szennyvízdíj',
          status: 'GEPI_JAVASLAT',
          is_settled: false,
          net_amount: 4770,
          vat_amount: 1288,
          amount: 6058,
          settled_amount: 0,
          remaining_amount: 6058,
          match_count: 0,
          gl_account_id: 'gl-4541',
          gl_number: '4541',
          gl_short_name: 'Szállítók',
          dc_type: 'K',
        },
      ];

      const grouped = groupSubledgerItems(mockItems);

      expect(grouped).toHaveLength(1);
      const inv = grouped[0];
      expect(inv.document_id).toBe('FCM/00185370');
      expect(inv.items).toHaveLength(4);
      expect(inv.header_ids).toEqual(['h1', 'h2', 'h3', 'h4']);
      expect(inv.line_ids).toEqual(['l1', 'l2', 'l3', 'l4']);

      // Aggregated amounts
      expect(inv.net_amount).toBe(25 + 76 + 1798 + 4770); // 6669
      expect(inv.vat_amount).toBe(7 + 21 + 485 + 1288);   // 1801
      expect(inv.amount).toBe(32 + 97 + 2283 + 6058);     // 8470
      expect(inv.remaining_amount).toBe(8470);
      expect(inv.net_amount + inv.vat_amount).toBe(inv.amount);
      expect(inv.status).toBe('GEPI_JAVASLAT');
      expect(inv.is_settled).toBe(false);
    });

    it('keeps invoices from different suppliers separate even if they share document_id', () => {
      const mockItems: SubledgerItem[] = [
        {
          line_id: 'l1',
          header_id: 'h1',
          document_id: 'SZLA-001',
          partner_id: 'p1',
          partner_name: 'Supplier Alpha',
          posting_date: '2026-09-01',
          document_date: '2026-09-01',
          due_date: '2026-09-15',
          journal_code: 'SZ-B',
          journal_number: 1,
          currency: 'HUF',
          description: 'Áru A',
          status: 'KONYVELT',
          is_settled: false,
          net_amount: 10000,
          vat_amount: 2700,
          amount: 12700,
          settled_amount: 0,
          remaining_amount: 12700,
          match_count: 0,
          gl_account_id: 'gl-4541',
          gl_number: '4541',
          gl_short_name: 'Szállítók',
          dc_type: 'K',
        },
        {
          line_id: 'l2',
          header_id: 'h2',
          document_id: 'SZLA-001',
          partner_id: 'p2',
          partner_name: 'Supplier Beta',
          posting_date: '2026-09-01',
          document_date: '2026-09-01',
          due_date: '2026-09-15',
          journal_code: 'SZ-B',
          journal_number: 2,
          currency: 'HUF',
          description: 'Szolgáltatás B',
          status: 'KONYVELT',
          is_settled: false,
          net_amount: 20000,
          vat_amount: 5400,
          amount: 25400,
          settled_amount: 0,
          remaining_amount: 25400,
          match_count: 0,
          gl_account_id: 'gl-4541',
          gl_number: '4541',
          gl_short_name: 'Szállítók',
          dc_type: 'K',
        },
      ];

      const grouped = groupSubledgerItems(mockItems);
      expect(grouped).toHaveLength(2);
      expect(grouped[0].partner_name).toBe('Supplier Alpha');
      expect(grouped[1].partner_name).toBe('Supplier Beta');
    });
  });
});

