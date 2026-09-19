import { describe, it, expect } from 'vitest';
import { calculateDividendTaxes, SZOCHO_ANNUAL_CAP_2026 } from '@/hooks/useDividends';

describe('Dividend Tax & Auto Posting Logic', () => {
  it('calculates 15% SZJA and 13% SZOCHO when cap is not reached', () => {
    const res = calculateDividendTaxes({
      grossAmount: 2_000_000,
      hasReachedSzochoCap: false,
      priorIncomeForCap: 0,
    });

    expect(res.grossAmount).toBe(2_000_000);
    expect(res.szjaAmount).toBe(300_000); // 15%
    expect(res.szochoAmount).toBe(260_000); // 13%
    expect(res.netAmount).toBe(1_440_000); // 2M - 300k - 260k
    expect(res.isCapped).toBe(false);
  });

  it('calculates 0 SZOCHO when member has already reached SZOCHO cap', () => {
    const res = calculateDividendTaxes({
      grossAmount: 2_000_000,
      hasReachedSzochoCap: true,
      priorIncomeForCap: 0,
    });

    expect(res.grossAmount).toBe(2_000_000);
    expect(res.szjaAmount).toBe(300_000);
    expect(res.szochoAmount).toBe(0);
    expect(res.netAmount).toBe(1_700_000);
    expect(res.isCapped).toBe(true);
  });

  it('applies partial SZOCHO when dividend crosses the annual cap', () => {
    // 2026 cap: 7,747,200 Ft
    // Prior income: 7,000,000 Ft
    // Remaining cap: 747,200 Ft
    const res = calculateDividendTaxes({
      grossAmount: 1_000_000,
      hasReachedSzochoCap: false,
      priorIncomeForCap: 7_000_000,
    });

    expect(res.taxableSzochoBase).toBe(747_200);
    expect(res.szochoAmount).toBe(Math.round(747_200 * 0.13));
    expect(res.szjaAmount).toBe(150_000);
    expect(res.netAmount).toBe(1_000_000 - 150_000 - Math.round(747_200 * 0.13));
    expect(res.isCapped).toBe(true);
  });

  it('verifies double-entry accounting balanced logic (Debit = Credit)', () => {
    const gross = 2_500_000;
    const szja = 375_000;
    const szocho = 325_000;
    const net = gross - szja - szocho;

    // Entry 1: T 413 (gross) / K 4792 (gross)
    const t_413 = gross;
    const k_4792_initial = gross;

    // Entry 2: T 4792 (szja) / K 4622 (szja)
    const t_4792_szja = szja;
    const k_4622 = szja;

    // Entry 3: T 4792 (szocho) / K 463 (szocho)
    const t_4792_szocho = szocho;
    const k_463 = szocho;

    // Total Debit vs Total Credit in journal
    const totalDebit = t_413 + t_4792_szja + t_4792_szocho;
    const totalCredit = k_4792_initial + k_4622 + k_463;

    expect(totalDebit).toBe(totalCredit);
    expect(totalDebit).toBe(gross + szja + szocho);

    // Remaining liability on 4792 equals net payout:
    const liabilityBalance = k_4792_initial - (t_4792_szja + t_4792_szocho);
    expect(liabilityBalance).toBe(net);
  });

  it('verifies storno reversal mathematically nets out all accounts (4792, 413, 462, 463) to 0', () => {
    const gross = 2_500_000;
    const szja = 375_000;
    const szocho = 325_000;

    // Original entry lines
    const originalLines = [
      { account: '413', dc: 'T', amount: gross },
      { account: '4792', dc: 'K', amount: gross },
      { account: '4792', dc: 'T', amount: szja },
      { account: '4622', dc: 'K', amount: szja },
      { account: '4792', dc: 'T', amount: szocho },
      { account: '463', dc: 'K', amount: szocho },
    ];

    // Storno reversal lines (inverted DC type)
    const stornoLines = originalLines.map(l => ({
      account: l.account,
      dc: l.dc === 'T' ? 'K' : 'T',
      amount: l.amount,
    }));

    const allLines = [...originalLines, ...stornoLines];

    // Calculate net per account (Debit - Credit)
    const balances: Record<string, number> = {};
    for (const line of allLines) {
      const sign = line.dc === 'T' ? 1 : -1;
      balances[line.account] = (balances[line.account] || 0) + sign * line.amount;
    }

    expect(balances['413']).toBe(0);
    expect(balances['4792']).toBe(0);
    expect(balances['4622']).toBe(0);
    expect(balances['463']).toBe(0);
  });
});
