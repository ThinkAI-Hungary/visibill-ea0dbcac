import { describe, it, expect } from 'vitest';
import { fmtBalance, fmtAmount, roundHuf } from '@/components/petty-cash/types';

describe('Petty Cash GL Reconciliation & Balance Formatting Resilience', () => {
  describe('roundHuf resilience', () => {
    it('returns 0 for null, undefined, or NaN inputs', () => {
      expect(roundHuf(null)).toBe(0);
      expect(roundHuf(undefined)).toBe(0);
      expect(roundHuf(NaN)).toBe(0);
    });

    it('rounds to nearest 5 for HUF', () => {
      expect(roundHuf(102, 'HUF')).toBe(100);
      expect(roundHuf(103, 'HUF')).toBe(105);
      expect(roundHuf(0, 'HUF')).toBe(0);
    });

    it('rounds to 2 decimals for non-HUF currencies', () => {
      expect(roundHuf(12.3456, 'EUR')).toBe(12.35);
      expect(roundHuf(-3.25, 'EUR')).toBe(-3.25);
    });
  });

  describe('fmtBalance resilience against NaN and undefined', () => {
    it('formats 0 HUF when passed null, undefined, or NaN', () => {
      expect(fmtBalance(null as any, 'HUF')).toContain('0');
      expect(fmtBalance(null as any, 'HUF')).toContain('HUF');
      expect(fmtBalance(undefined as any, 'HUF')).toContain('0');
      expect(fmtBalance(undefined as any, 'HUF')).toContain('HUF');
      expect(fmtBalance(NaN as any, 'HUF')).toContain('0');
      expect(fmtBalance(NaN as any, 'HUF')).toContain('HUF');
      expect(fmtBalance(null as any, 'HUF')).not.toContain('NaN');
    });

    it('defaults currency to HUF if currency is undefined or empty', () => {
      expect(fmtBalance(1500, undefined as any)).toContain('1');
      expect(fmtBalance(1500, undefined as any)).toContain('HUF');
      expect(fmtBalance(undefined as any, undefined as any)).toBe('0 HUF');
      expect(fmtBalance(NaN as any, undefined as any)).toBe('0 HUF');
    });

    it('formats valid numbers with currency cleanly', () => {
      expect(fmtBalance(0, 'HUF')).toBe('0 HUF');
      expect(fmtBalance(50000, 'HUF')).toMatch(/50[\s\u00A0.]000 HUF/);
      expect(fmtBalance(25.5, 'EUR')).toBe('25,5 EUR');
    });
  });

  describe('fmtAmount resilience', () => {
    it('formats 0 HUF with sign when passed null, undefined, or NaN', () => {
      expect(fmtAmount(null as any, 'HUF')).toBe('+0 HUF');
      expect(fmtAmount(undefined as any, 'HUF')).toBe('+0 HUF');
      expect(fmtAmount(NaN as any, 'HUF')).toBe('+0 HUF');
      expect(fmtAmount(NaN as any, undefined as any)).toBe('+0 HUF');
    });
  });

  describe('Reconciliation RPC normalization logic', () => {
    it('correctly maps RPC fields to frontend model', () => {
      // Raw payload returned by reconcile_petty_cash_with_gl
      const rawRpcResponse = {
        year: 2026,
        date_to: '2026-12-31',
        registers: [
          {
            register_id: '0cbb5d82-b270-452d-99f6-0a9dc8766eb3',
            register_name: 'Központi pénztár',
            gl_account: '381',
            currencies: ['HUF'],
            analytic_balance: 0,
            gl_balance: 0,
            difference: 0,
            is_matching: true,
          },
          {
            register_id: 'test-reg-id',
            register_name: 'Valutakassza',
            gl_account: '382',
            currencies: ['EUR'],
            analytic_balance: 100.5,
            gl_balance: 100.5,
            difference: 0,
            is_matching: true,
          },
        ],
        total_difference: 0,
        total_gl_balance: 0,
        total_analytic_balance: 0,
        is_fully_reconciled: true,
        unposted_entries: [],
        direct_gl_entries: [],
      };

      // Normalization as implemented in useGlReconciliation
      const totalAnalytic = Number(rawRpcResponse.total_analytic_balance ?? (rawRpcResponse as any).analytics_total_huf ?? 0);
      const totalGl = Number(rawRpcResponse.total_gl_balance ?? (rawRpcResponse as any).gl_total_huf ?? 0);
      const totalDiff = Number(rawRpcResponse.total_difference ?? (rawRpcResponse as any).discrepancy_huf ?? 0);
      const isReconciled = Boolean(rawRpcResponse.is_fully_reconciled ?? (rawRpcResponse as any).is_reconciled ?? false);

      expect(totalAnalytic).toBe(0);
      expect(totalGl).toBe(0);
      expect(totalDiff).toBe(0);
      expect(isReconciled).toBe(true);

      expect(fmtBalance(totalAnalytic, 'HUF')).toBe('0 HUF');
      expect(fmtBalance(totalGl, 'HUF')).toBe('0 HUF');
      expect(fmtBalance(totalDiff, 'HUF')).toBe('0 HUF');

      const mappedRegisters = rawRpcResponse.registers.map((r: any) => {
        const cur = r.currency || (Array.isArray(r.currencies) && r.currencies[0]) || 'HUF';
        const glAcc = r.gl_account || r.gl_account_code || (cur === 'HUF' ? '381' : '382');
        const anBal = Number(r.analytic_balance ?? r.analytics_balance_huf ?? r.analytics_balance_fx ?? 0);
        const glBal = Number(r.gl_balance ?? r.gl_balance_huf ?? 0);
        const diff = Number(r.difference ?? r.diff_huf ?? (anBal - glBal));
        const isMatch = Boolean(r.is_matching ?? (Math.abs(diff) <= 0.01));

        return {
          cur,
          glAcc,
          anBal,
          glBal,
          diff,
          isMatch,
        };
      });

      expect(mappedRegisters[0].cur).toBe('HUF');
      expect(mappedRegisters[0].glAcc).toBe('381');
      expect(mappedRegisters[0].anBal).toBe(0);
      expect(mappedRegisters[0].isMatch).toBe(true);

      expect(mappedRegisters[1].cur).toBe('EUR');
      expect(mappedRegisters[1].glAcc).toBe('382');
      expect(mappedRegisters[1].anBal).toBe(100.5);

      // Verify that formatting never produces NaN
      for (const reg of mappedRegisters) {
        expect(fmtBalance(reg.anBal, reg.cur)).not.toContain('NaN');
        expect(fmtBalance(reg.glBal, 'HUF')).not.toContain('NaN');
        expect(fmtBalance(reg.diff, 'HUF')).not.toContain('NaN');
        expect(reg.cur).not.toBe('undefined');
      }
    });
  });
});
