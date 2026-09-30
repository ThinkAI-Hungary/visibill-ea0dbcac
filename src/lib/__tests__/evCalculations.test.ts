import { describe, it, expect } from 'vitest';
import {
  calculateFlatRateIncome,
  calculateEntrepreneurialTax,
  calculateKata,
  calculateQuarterlyContributions,
  calculateHipaSimplified,
  calculateHipaGeneral,
  checkThresholdStatus,
  getEvThresholds,
  compareTaxForms,
  formatHuf,
  formatPercent,
  formatMillionHuf,
  DEFAULT_2026_PARAMS,
  DEFAULT_2025_PARAMS,
} from '../evCalculations';

describe('EV Calculations Engine (Egyéni Vállalkozó Kalkulációk)', () => {
  describe('calculateFlatRateIncome (Átalányadó)', () => {
    it('calculates 45% general expense deduction and exempt threshold for 2026', () => {
      // 10,000,000 Ft revenue
      // cost = 45% = 4,500,000 Ft
      // income = 5,500,000 Ft
      // tax free in 2026 = 1,936,800 Ft
      // taxable income = 5,500,000 - 1,936,800 = 3,563,200 Ft
      // szja = 3,563,200 * 0.15 = 534,480 Ft
      const result = calculateFlatRateIncome(10_000_000, 'general', DEFAULT_2026_PARAMS);

      expect(result.revenue).toBe(10_000_000);
      expect(result.costRatio).toBe(0.45);
      expect(result.calculatedCosts).toBe(4_500_000);
      expect(result.income).toBe(5_500_000);
      expect(result.taxFreeAmount).toBe(1_936_800);
      expect(result.taxableIncome).toBe(3_563_200);
      expect(result.szja).toBe(534_480);
      expect(result.effectiveRate).toBeCloseTo(0.0534, 3);
    });

    it('returns 0 taxable income and 0 SZJA if income is below tax-free threshold', () => {
      // 2,000,000 Ft revenue, 45% costs -> 1,100,000 income < 1,936,800 tax free
      const result = calculateFlatRateIncome(2_000_000, 'general', DEFAULT_2026_PARAMS);

      expect(result.calculatedCosts).toBe(900_000);
      expect(result.income).toBe(1_100_000);
      expect(result.taxableIncome).toBe(0);
      expect(result.szja).toBe(0);
      expect(result.effectiveRate).toBe(0);
    });

    it('correctly handles high 80% and retail 90% expense ratio tiers', () => {
      const res80 = calculateFlatRateIncome(10_000_000, 'high_80', DEFAULT_2026_PARAMS);
      expect(res80.costRatio).toBe(0.80);
      expect(res80.calculatedCosts).toBe(8_000_000);
      expect(res80.income).toBe(2_000_000);

      const res90 = calculateFlatRateIncome(10_000_000, 'retail_90', DEFAULT_2026_PARAMS);
      expect(res90.costRatio).toBe(0.90);
      expect(res90.calculatedCosts).toBe(9_000_000);
      expect(res90.income).toBe(1_000_000);
    });

    it('uses 2025 params (40% general cost ratio, 1,600,800 tax free) when requested', () => {
      const result = calculateFlatRateIncome(10_000_000, 'general', DEFAULT_2025_PARAMS);
      expect(result.costRatio).toBe(0.40);
      expect(result.taxFreeAmount).toBe(1_600_800);
      expect(result.calculatedCosts).toBe(4_000_000);
      expect(result.income).toBe(6_000_000);
      expect(result.taxableIncome).toBe(4_399_200);
      expect(result.szja).toBe(Math.round(4_399_200 * 0.15));
    });
  });

  describe('calculateEntrepreneurialTax (Vállalkozói SZJA)', () => {
    it('calculates 9% corporate-like VSZJA and dividend taxes', () => {
      // 10M revenue, 4M costs, 2M kivét
      // taxBase = 10M - 4M = 6M
      // vszja = 6M * 0.09 = 540,000 Ft
      // afterTax = 6M - 540k = 5,460,000 Ft
      // dividendBase = 5,460,000 - 2,000,000 = 3,460,000 Ft
      // dividendSzja = 3,460,000 * 0.15 = 519,000 Ft
      // dividendSzocho = 3,460,000 * 0.13 = 449,800 Ft
      // totalTax = 540k + 519k + 449.8k = 1,508,800 Ft
      const result = calculateEntrepreneurialTax(10_000_000, 4_000_000, 2_000_000, 0, DEFAULT_2026_PARAMS);

      expect(result.taxBase).toBe(6_000_000);
      expect(result.entrepreneurialTax).toBe(540_000);
      expect(result.dividendBase).toBe(3_460_000);
      expect(result.dividendSzja).toBe(519_000);
      expect(result.dividendSzocho).toBe(449_800);
      expect(result.totalTax).toBe(1_508_800);
    });

    it('returns zero tax if costs exceed revenue', () => {
      const result = calculateEntrepreneurialTax(5_000_000, 6_000_000, 0, 0, DEFAULT_2026_PARAMS);
      expect(result.taxBase).toBe(0);
      expect(result.entrepreneurialTax).toBe(0);
      expect(result.dividendBase).toBe(0);
      expect(result.totalTax).toBe(0);
    });
  });

  describe('calculateKata', () => {
    it('calculates standard 50,000 Ft/month for active months within 18M limit', () => {
      const result = calculateKata(12_000_000, 12, DEFAULT_2026_PARAMS);

      expect(result.monthlyFee).toBe(50_000);
      expect(result.annualFee).toBe(600_000);
      expect(result.excessRevenue).toBe(0);
      expect(result.surchargeAmount).toBe(0);
      expect(result.totalTax).toBe(600_000);
    });

    it('calculates 40% surcharge on revenue exceeding 18,000,000 Ft', () => {
      // 20M revenue -> 2M excess -> 40% = 800,000 surcharge
      const result = calculateKata(20_000_000, 12, DEFAULT_2026_PARAMS);

      expect(result.revenueLimit).toBe(18_000_000);
      expect(result.excessRevenue).toBe(2_000_000);
      expect(result.surchargeAmount).toBe(800_000);
      expect(result.totalTax).toBe(600_000 + 800_000);
      expect(result.effectiveRate).toBe(1_400_000 / 20_000_000);
    });

    it('pro-rates annual fee for partial active months', () => {
      const result = calculateKata(5_000_000, 6, DEFAULT_2026_PARAMS);
      expect(result.annualFee).toBe(300_000);
      expect(result.activeMonths).toBe(6);
    });
  });

  describe('calculateQuarterlyContributions (TB-járulék & Szocho)', () => {
    it('returns 0 for pensioner (kiegeszito)', () => {
      const result = calculateQuarterlyContributions(1, 2_000_000, 0, 3, 'kiegeszito');
      expect(result.totalAmount).toBe(0);
      expect(result.tbAmount).toBe(0);
      expect(result.szochoAmount).toBe(0);
      expect(result.minimumBaseApplied).toBe(false);
    });

    it('applies minimum wage base for full-time (foallasu) entrepreneur when income is below minimum', () => {
      // 3 insurance months in Q1, minimal wage = 322,800 Ft
      // quarter minimum = 3 * 322,800 = 968,400 Ft
      // ytdIncome = 100,000 Ft < quarterMinimum -> minimumBaseApplied = true
      const result = calculateQuarterlyContributions(
        1,
        100_000,
        0,
        3,
        'foallasu',
        false, // not skilled
        DEFAULT_2026_PARAMS
      );

      expect(result.minimumBaseApplied).toBe(true);
      expect(result.currentQuarterBase).toBe(968_400);
      expect(result.tbAmount).toBe(Math.round(968_400 * 0.185)); // 179,154
      expect(result.szochoAmount).toBe(Math.round(968_400 * 0.13)); // 125,892
      expect(result.monthlyBreakdown).toHaveLength(3);
    });

    it('applies guaranteed wage minimum for skilled activity (garantalt berminimum)', () => {
      // 3 months * 373,200 = 1,119,600 Ft
      const result = calculateQuarterlyContributions(
        1,
        0,
        0,
        3,
        'foallasu',
        true, // skilled
        DEFAULT_2026_PARAMS
      );

      expect(result.minimumBaseApplied).toBe(true);
      expect(result.currentQuarterBase).toBe(1_119_600);
      expect(result.tbAmount).toBe(Math.round(1_119_600 * 0.185));
    });

    it('does not enforce minimum base for part-time (mellekallasu)', () => {
      const result = calculateQuarterlyContributions(
        1,
        200_000,
        0,
        3,
        'mellekallasu',
        false,
        DEFAULT_2026_PARAMS
      );

      expect(result.minimumBaseApplied).toBe(false);
      expect(result.currentQuarterBase).toBe(200_000);
      expect(result.tbAmount).toBe(Math.round(200_000 * 0.185));
      expect(result.szochoAmount).toBe(Math.round(200_000 * 0.13));
    });
  });

  describe('HIPA Calculations', () => {
    it('calculates simplified HIPA for revenue tiers (<=12M, <=18M, >18M)', () => {
      // <= 12M: tax base 2,500,000 * 0.02 = 50,000 Ft
      const res1 = calculateHipaSimplified(10_000_000, 0.02);
      expect(res1.taxBase).toBe(2_500_000);
      expect(res1.taxAmount).toBe(50_000);

      // <= 18M: tax base 6,000,000 * 0.02 = 120,000 Ft
      const res2 = calculateHipaSimplified(15_000_000, 0.02);
      expect(res2.taxBase).toBe(6_000_000);
      expect(res2.taxAmount).toBe(120_000);

      // > 18M: tax base 8,500,000 * 0.02 = 170,000 Ft
      const res3 = calculateHipaSimplified(22_000_000, 0.02);
      expect(res3.taxBase).toBe(8_500_000);
      expect(res3.taxAmount).toBe(170_000);
    });

    it('calculates general HIPA by deducting material and subcontractor costs', () => {
      // 20M net revenue - 5M ELAB - 2M subcontractor = 13M base * 0.02 = 260,000 Ft
      const res = calculateHipaGeneral(20_000_000, 5_000_000, 0, 0, 2_000_000, 0.02);
      expect(res.taxBase).toBe(13_000_000);
      expect(res.taxAmount).toBe(260_000);
    });
  });

  describe('Threshold Monitoring', () => {
    it('checkThresholdStatus returns green, yellow, and red based on usage ratio', () => {
      expect(checkThresholdStatus(70, 100)).toBe('green');
      expect(checkThresholdStatus(85, 100)).toBe('yellow');
      expect(checkThresholdStatus(100, 100)).toBe('red');
      expect(checkThresholdStatus(110, 100)).toBe('red');
    });

    it('getEvThresholds generates checks for atalany and AFA limits', () => {
      const checks = getEvThresholds(18_000_000, 'atalany', false, DEFAULT_2026_PARAMS);

      expect(checks).toHaveLength(2);
      const atalanyCheck = checks.find(c => c.name.includes('Átalány'));
      const afaCheck = checks.find(c => c.name.includes('ÁFA'));

      expect(atalanyCheck).toBeDefined();
      expect(atalanyCheck?.limit).toBe(38_736_000);
      expect(atalanyCheck?.status).toBe('green');

      expect(afaCheck).toBeDefined();
      expect(afaCheck?.limit).toBe(20_000_000);
      expect(afaCheck?.status).toBe('yellow'); // 18M / 20M = 90% >= 80%
    });
  });

  describe('Tax Form Comparison (compareTaxForms)', () => {
    it('compares atalany, vszja, and kata, picking the most cost-effective form', () => {
      const comparisons = compareTaxForms(
        15_000_000, // revenue
        2_000_000,  // deductible costs
        3_000_000,  // kivet
        'general',  // 45% cost ratio
        12,
        DEFAULT_2026_PARAMS,
        'foallasu',
        false
      );

      expect(comparisons).toHaveLength(3);
      const best = comparisons.find(c => c.isBest);
      expect(best).toBeDefined();
      expect(['atalany', 'vszja', 'kata']).toContain(best?.form);
    });
  });

  describe('Formatting Helpers', () => {
    it('formats HUF amounts without decimals', () => {
      const formatted = formatHuf(1500000);
      expect(formatted).toContain('1');
      expect(formatted).toContain('500');
      expect(formatted).toContain('Ft');
    });

    it('formats percentages correctly', () => {
      expect(formatPercent(0.185)).toBe('18.5%');
      expect(formatPercent(0.27, 0)).toBe('27%');
    });

    it('formats million HUF compactly when >= 1M', () => {
      expect(formatMillionHuf(25_400_000)).toBe('25.4 M Ft');
      expect(formatMillionHuf(500_000)).toContain('500');
    });
  });
});
