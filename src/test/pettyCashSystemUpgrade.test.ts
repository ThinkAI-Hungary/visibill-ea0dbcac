import { describe, it, expect } from 'vitest';
import { numberToWordsHu } from '@/lib/documents/templates/cashReceiptTemplate';
import { fmtBalance, roundHuf } from '@/components/petty-cash/types';

describe('Petty Cash System Upgrade Unit & Contract Tests (Sections 4.1 & 4.2)', () => {
  // ─── 1. TIMELINE INTEGRITY & FIRST FAILING DETECTOR ───────────────────────
  describe('Timeline Integrity & First Failing Transaction Detector', () => {
    interface SimulatedEntry {
      id: string;
      entry_date: string;
      amount: number; // positive = income, negative = expense
      receipt_number: string;
    }

    function checkTimelineIntegrityPure(
      entries: SimulatedEntry[],
      candidate?: { entry_date: string; amount: number; exclude_id?: string }
    ) {
      let working = [...entries];
      if (candidate?.exclude_id) {
        working = working.filter(e => e.id !== candidate.exclude_id);
      }
      if (candidate?.entry_date && candidate.amount !== undefined) {
        working.push({
          id: 'candidate-test',
          entry_date: candidate.entry_date,
          amount: candidate.amount,
          receipt_number: 'TEST-CANDIDATE',
        });
      }

      // Sort chronologically ascending
      working.sort((a, b) => a.entry_date.localeCompare(b.entry_date));

      let runningBalance = 0;
      for (const entry of working) {
        const balBefore = runningBalance;
        runningBalance += entry.amount;

        if (runningBalance < 0) {
          return {
            valid: false,
            first_failing_date: entry.entry_date,
            first_failing_entry_id: entry.id,
            first_failing_receipt_number: entry.receipt_number,
            running_balance_before_deficit: balBefore,
            deficit_amount: runningBalance,
            message: `A pénztár egyenlege negatívba fordulna (${entry.entry_date}): ${runningBalance} HUF`,
          };
        }
      }

      return {
        valid: true,
        final_balance: runningBalance,
        message: 'A pénztár idővonala folytonos és pozitív.',
      };
    }

    const baselineEntries: SimulatedEntry[] = [
      { id: 'e1', entry_date: '2026-10-01', amount: 100000, receipt_number: 'BPB-2026-00001' },
      { id: 'e2', entry_date: '2026-10-05', amount: -40000, receipt_number: 'KPB-2026-00001' },
      { id: 'e3', entry_date: '2026-10-10', amount: -50000, receipt_number: 'KPB-2026-00002' },
      // Balance on 2026-10-10 is +10 000 HUF
    ];

    it('allows expense when balance remains positive', () => {
      const res = checkTimelineIntegrityPure(baselineEntries, {
        entry_date: '2026-10-11',
        amount: -8000,
      });

      expect(res.valid).toBe(true);
      expect((res as any).final_balance).toBe(2000);
    });

    it('blocks immediate expense that exceeds current balance (Hard-stop)', () => {
      const res = checkTimelineIntegrityPure(baselineEntries, {
        entry_date: '2026-10-11',
        amount: -15000, // Deficit of -5000
      });

      expect(res.valid).toBe(false);
      expect(res.first_failing_date).toBe('2026-10-11');
      expect(res.deficit_amount).toBe(-5000);
      expect(res.running_balance_before_deficit).toBe(10000);
    });

    it('detects backdated entry causing future deficit on a later date', () => {
      // If we insert a backdated expense on 2026-10-02 of -20000,
      // on 2026-10-02 balance is 80000 (ok)
      // on 2026-10-05 balance is 40000 (ok)
      // on 2026-10-10 balance is -10000 -> FAILS on 2026-10-10!
      const res = checkTimelineIntegrityPure(baselineEntries, {
        entry_date: '2026-10-02',
        amount: -20000,
      });

      expect(res.valid).toBe(false);
      expect(res.first_failing_date).toBe('2026-10-10');
      expect(res.first_failing_receipt_number).toBe('KPB-2026-00002');
      expect(res.deficit_amount).toBe(-10000);
      expect(res.running_balance_before_deficit).toBe(40000);
    });

    it('blocks deleting an income entry that leaves subsequent expenses without cash coverage', () => {
      // If we delete e1 (the initial 100 000 HUF deposit),
      // the next expense on 2026-10-05 would fail immediately!
      const res = checkTimelineIntegrityPure(baselineEntries, {
        exclude_id: 'e1',
        entry_date: '',
        amount: 0,
      });

      expect(res.valid).toBe(false);
      expect(res.first_failing_date).toBe('2026-10-05');
      expect(res.deficit_amount).toBe(-40000);
    });
  });

  // ─── 2. ART. 114. § 1.5M FT PARTNER CASH LIMIT & 20% PENALTY RISK ─────────
  describe('Art. 114. § Monthly 1.5M Ft Cash Limit Monitor', () => {
    function evaluatePartnerCashLimit(monthlyTotalHuf: number) {
      const threshold = 1500000;
      const warningThreshold = 1000000;
      const excess = Math.max(0, monthlyTotalHuf - threshold);
      const penaltyRisk = Math.round(excess * 0.20);

      let status: 'normal' | 'warning' | 'exceeded';
      if (monthlyTotalHuf > threshold) {
        status = 'exceeded';
      } else if (monthlyTotalHuf >= warningThreshold) {
        status = 'warning';
      } else {
        status = 'normal';
      }

      return {
        threshold,
        total: monthlyTotalHuf,
        excess,
        penaltyRisk,
        status,
        nav40ReportingRequired: status === 'exceeded',
      };
    }

    it('classifies small transaction as normal with zero penalty risk', () => {
      const res = evaluatePartnerCashLimit(450000);
      expect(res.status).toBe('normal');
      expect(res.excess).toBe(0);
      expect(res.penaltyRisk).toBe(0);
      expect(res.nav40ReportingRequired).toBe(false);
    });

    it('classifies amount over 1M Ft as warning', () => {
      const res = evaluatePartnerCashLimit(1250000);
      expect(res.status).toBe('warning');
      expect(res.excess).toBe(0);
      expect(res.penaltyRisk).toBe(0);
      expect(res.nav40ReportingRequired).toBe(false);
    });

    it('classifies amount over 1.5M Ft as exceeded, requiring NAV 40 and 20% penalty', () => {
      const res = evaluatePartnerCashLimit(2000000);
      expect(res.status).toBe('exceeded');
      expect(res.excess).toBe(500000);
      expect(res.penaltyRisk).toBe(100000); // 20% of 500,000 Ft
      expect(res.nav40ReportingRequired).toBe(true);
    });
  });

  // ─── 3. SZTV. 60. § FOREIGN CURRENCY DEC 31 MNB REVALUATION ───────────────
  describe('Sztv. 60. § Year-End MNB Foreign Currency Revaluation', () => {
    function calculateFxRevaluationItem(
      currency: string,
      fxBalance: number,
      bookValueHuf: number,
      officialMnbRate: number
    ) {
      const revaluedHuf = Math.round(fxBalance * officialMnbRate);
      const diffHuf = revaluedHuf - bookValueHuf;
      const glAccount = diffHuf >= 0 ? '976' : '876';
      const side = diffHuf >= 0 ? 'T 382 / K 976' : 'T 876 / K 382';

      return {
        currency,
        fxBalance,
        bookValueHuf,
        officialMnbRate,
        revaluedHuf,
        diffHuf,
        glAccount,
        side,
      };
    }

    it('calculates unrealized exchange gain (976) when MNB rate increases', () => {
      // 1000 EUR bought at 390 HUF (book value 390 000 HUF), Dec 31 MNB is 405 HUF
      const res = calculateFxRevaluationItem('EUR', 1000, 390000, 405.50);
      expect(res.revaluedHuf).toBe(405500);
      expect(res.diffHuf).toBe(15500);
      expect(res.glAccount).toBe('976');
      expect(res.side).toBe('T 382 / K 976');
    });

    it('calculates unrealized exchange loss (876) when MNB rate decreases', () => {
      // 2000 USD booked at 360 HUF (book value 720 000 HUF), Dec 31 MNB is 350 HUF
      const res = calculateFxRevaluationItem('USD', 2000, 720000, 350.00);
      expect(res.revaluedHuf).toBe(700000);
      expect(res.diffHuf).toBe(-20000);
      expect(res.glAccount).toBe('876');
      expect(res.side).toBe('T 876 / K 382');
    });
  });

  // ─── 4. SZIGORÚ SZÁMADÁSÚ BPB/KPB SORSZÁMOZÁS & PREFIX ─────────────────────
  describe('Strict Sequential BPB/KPB Receipt Number Generation', () => {
    function formatReceiptNumber(
      receiptType: 'in' | 'out',
      year: number,
      seqNo: number,
      registerPrefix?: string | null
    ): string {
      const typeCode = receiptType === 'in' ? 'BPB' : 'KPB';
      const cleanPrefix = registerPrefix ? registerPrefix.trim().replace(/-+$/, '') : '';
      const prefixPart = cleanPrefix ? `-${cleanPrefix}` : '';
      const paddedSeq = String(seqNo).padStart(5, '0');
      return `${typeCode}${prefixPart}-${year}-${paddedSeq}`;
    }

    it('generates standard sequential BPB receipt number', () => {
      const num = formatReceiptNumber('in', 2026, 1);
      expect(num).toBe('BPB-2026-00001');
    });

    it('generates standard sequential KPB receipt number', () => {
      const num = formatReceiptNumber('out', 2026, 42);
      expect(num).toBe('KPB-2026-00042');
    });

    it('applies custom branch register prefix (e.g. GYOR)', () => {
      const num = formatReceiptNumber('out', 2026, 12, 'GYOR');
      expect(num).toBe('KPB-GYOR-2026-00012');
    });

    it('cleans up trailing dashes in prefix gracefully', () => {
      const num = formatReceiptNumber('in', 2026, 5, 'BP-KASSZA-');
      expect(num).toBe('BPB-BP-KASSZA-2026-00005');
    });
  });

  // ─── 5. SZTV. 167. § AMOUNT IN WORDS (BETŰVEL KIÍRT ÖSSZEG) ───────────────
  describe('Amount in Words Hungarian Formatting (Sztv. 167. §)', () => {
    it('converts common cash amounts to grammatical Hungarian text', () => {
      expect(numberToWordsHu(0)).toBe('nulla');
      expect(numberToWordsHu(5000)).toBe('ötezer forint');
      expect(numberToWordsHu(12500)).toBe('tizenkettőezer-ötszáz forint');
      expect(numberToWordsHu(1500000)).toBe('egymillió-ötszázezer forint');
    });
  });
});
