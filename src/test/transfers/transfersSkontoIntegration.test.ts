import { describe, it, expect } from 'vitest';
import { calculateSkonto, formatTransferNarrative } from '@/lib/skontoUtils';

describe('TransfersPage Skonto Integration Logic', () => {
  const yamahaInvoice = {
    id: 'inv-yamaha-1',
    source: 'manual' as const,
    invoice_number: '4000749568',
    partner_name: 'Yamaha Music Europe GmbH',
    amount: 235496,
    currency: 'HUF',
    has_skonto: true,
    skonto_days: 14,
    skonto_percent: 2,
    skonto_due_date: '2026-09-15',
    skonto_amount: 230786,
    skonto_saved_amount: 4710,
    days_remaining: 0,
    is_skonto_expired: false,
  };

  const gewaInvoice = {
    id: 'inv-gewa-1',
    source: 'manual' as const,
    invoice_number: '2719111',
    partner_name: 'GEWA music GmbH',
    amount: 561164,
    currency: 'HUF',
    has_skonto: true,
    skonto_days: 10,
    skonto_percent: 2,
    skonto_shipping_amount: 7000,
    skonto_due_date: '2026-09-20',
    skonto_amount: 550081, // (561164 - 7000) * 0.98 + 7000 = 543080.72 + 7000 = 550081
    skonto_saved_amount: 11083,
    days_remaining: 5,
    is_skonto_expired: false,
  };

  describe('Effective amount resolution', () => {
    const isSkontoActive = (inv: typeof yamahaInvoice, override?: boolean) => {
      if (override !== undefined) return override;
      return !inv.is_skonto_expired;
    };

    const getEffectiveAmount = (inv: typeof yamahaInvoice, override?: boolean) => {
      if (isSkontoActive(inv, override) && inv.skonto_amount) {
        return inv.skonto_amount;
      }
      return inv.amount;
    };

    it('returns skonto discounted amount when skonto is active', () => {
      expect(getEffectiveAmount(yamahaInvoice, true)).toBe(230786);
      expect(getEffectiveAmount(gewaInvoice, true)).toBe(550081);
    });

    it('returns standard gross amount when user toggles to full payment', () => {
      expect(getEffectiveAmount(yamahaInvoice, false)).toBe(235496);
      expect(getEffectiveAmount(gewaInvoice, false)).toBe(561164);
    });
  });

  describe('Bank transfer narrative formatting', () => {
    it('appends (Skonto X%) to single invoice number when skonto is active', () => {
      const narrative = formatTransferNarrative(yamahaInvoice.invoice_number, true, yamahaInvoice.skonto_percent);
      expect(narrative).toBe('4000749568 (Skonto 2%)');
    });

    it('keeps clean invoice number when skonto is not selected', () => {
      const narrative = formatTransferNarrative(yamahaInvoice.invoice_number, false, yamahaInvoice.skonto_percent);
      expect(narrative).toBe('4000749568');
    });

    it('formats grouped invoices correctly with respective skonto statuses', () => {
      const invoices = [
        { invoice_number: 'INV-1', is_skonto: true, percent: 2 },
        { invoice_number: 'INV-2', is_skonto: false, percent: 0 },
      ];

      const formatted = invoices
        .map(inv => formatTransferNarrative(inv.invoice_number, inv.is_skonto, inv.percent))
        .join(', ');

      expect(formatted).toBe('INV-1 (Skonto 2%), INV-2');
    });
  });

  describe('Grouped partner totals and savings', () => {
    it('sums effective amounts and accumulated savings correctly', () => {
      const group = [yamahaInvoice, { ...yamahaInvoice, id: 'inv-yamaha-2', invoice_number: '4000749569' }];
      
      const totalAmount = group.reduce((sum, inv) => sum + (inv.skonto_amount || inv.amount), 0);
      const totalGross = group.reduce((sum, inv) => sum + inv.amount, 0);
      const totalSaved = group.reduce((sum, inv) => sum + (inv.skonto_saved_amount || 0), 0);

      expect(totalAmount).toBe(230786 * 2);
      expect(totalGross).toBe(235496 * 2);
      expect(totalSaved).toBe(4710 * 2);
      expect(totalGross - totalAmount).toBe(totalSaved);
    });
  });
});
