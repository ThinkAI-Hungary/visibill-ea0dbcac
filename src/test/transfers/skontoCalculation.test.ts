import { describe, it, expect } from 'vitest';
import {
  calculateSkonto,
  detectShippingAmount,
  formatTransferNarrative,
} from '@/lib/skontoUtils';

describe('Skonto Utilities', () => {
  describe('calculateSkonto', () => {
    it('calculates Yamaha prompt payment discount (2% within 14 days, no shipping exclusion)', () => {
      const result = calculateSkonto({
        grossAmount: 235496,
        issueDate: '2026-09-11',
        skontoDays: 14,
        skontoPercent: 2.0,
        shippingAmount: 0,
        currentDate: '2026-09-15',
      });

      expect(result.skontoDueDate).toBe('2026-09-25');
      expect(result.discountBase).toBe(235496);
      // 235496 * 0.02 = 4709.92 -> 4710
      expect(result.discountAmount).toBe(4710);
      // 235496 - 4710 = 230786
      expect(result.skontoAmount).toBe(230786);
      expect(result.savedAmount).toBe(4710);
      expect(result.daysRemaining).toBe(10);
      expect(result.isExpired).toBe(false);
    });

    it('calculates GEWA discount excluding shipping costs from the base', () => {
      // Total gross: 561,164 Ft, Shipping: 7,000 Ft
      const result = calculateSkonto({
        grossAmount: 561164,
        issueDate: '2026-09-10',
        skontoDays: 8,
        skontoPercent: 2.0,
        shippingAmount: 7000,
        currentDate: '2026-09-15',
      });

      expect(result.skontoDueDate).toBe('2026-09-18');
      // Discount base excludes 7000 shipping: 561164 - 7000 = 554164
      expect(result.discountBase).toBe(554164);
      // 554164 * 0.02 = 11083.28 -> 11083
      expect(result.discountAmount).toBe(11083);
      // 561164 - 11083 = 550081
      expect(result.skontoAmount).toBe(550081);
      expect(result.savedAmount).toBe(11083);
      expect(result.daysRemaining).toBe(3);
      expect(result.isExpired).toBe(false);
    });

    it('flags expired skonto when current date is past the skonto due date', () => {
      const result = calculateSkonto({
        grossAmount: 100000,
        issueDate: '2026-09-01',
        skontoDays: 8,
        skontoPercent: 2.0,
        currentDate: '2026-09-15', // Due was 2026-09-09
      });

      expect(result.skontoDueDate).toBe('2026-09-09');
      expect(result.daysRemaining).toBe(-6);
      expect(result.isExpired).toBe(true);
    });
  });

  describe('detectShippingAmount', () => {
    it('detects GEWA "Transport flat rate" item and sums shipping charges', () => {
      const items = [
        { line_description: 'Transport flat rate for 1 Order/Orders', gross_amount: 7000 },
        { line_description: 'GEWA STRETCHER', gross_amount: 2000 },
        { line_description: 'JANSEN VIOLA SETS', gross_amount: 2000 },
        { line_description: 'LARSEN CELLO 11 CANNON', gross_amount: 6000 },
      ];

      const shipping = detectShippingAmount(items);
      expect(shipping).toBe(7000);
    });

    it('detects multilingual shipping descriptions (Hungarian, German, English)', () => {
      expect(detectShippingAmount([{ termek_nev: 'Szállítási és csomagolási díj', brutto_ar: 3500 }])).toBe(3500);
      expect(detectShippingAmount([{ line_description: 'Frachtkosten Pauschale', gross_amount: 4500 }])).toBe(4500);
      expect(detectShippingAmount([{ line_description: 'DHL Express Delivery', gross_amount: 2500 }])).toBe(2500);
      expect(detectShippingAmount([{ line_description: 'Fuvardíj', net_amount: 5000 }])).toBe(5000);
    });

    it('returns 0 when no shipping item is present or items array is empty', () => {
      expect(detectShippingAmount([])).toBe(0);
      expect(detectShippingAmount(null)).toBe(0);
      expect(detectShippingAmount([{ line_description: 'Hangszer tok', gross_amount: 15000 }])).toBe(0);
    });
  });

  describe('formatTransferNarrative', () => {
    it('appends (Skonto X%) when skonto is active', () => {
      expect(formatTransferNarrative('4000749568', true, 2)).toBe('4000749568 (Skonto 2%)');
      expect(formatTransferNarrative('4000749568', true)).toBe('4000749568 (Skonto)');
    });

    it('returns clean invoice number when skonto is not active', () => {
      expect(formatTransferNarrative('4000749568', false, 2)).toBe('4000749568');
      expect(formatTransferNarrative('INV-2026/01', false)).toBe('INV-2026/01');
    });
  });
});
