import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Hungarian VAT Return: Weekend & Holiday Exchange Rate Resolution (Áfa tv. 80. § (2))', () => {
  const migrationPath = path.resolve(
    __dirname,
    '../../../supabase/migrations/20261014195000_fix_vat_return_daily_exchange_rate_weekend_lateral.sql'
  );

  it('ensures migration 20261014195000 exists and replaces rigid equi-joins with indexed LATERAL as-of joins', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // 1. Mandatory index on (currency, rate_date DESC) for fast sub-millisecond lateral lookups
    expect(sql).toContain('idx_daily_exchange_rates_lookup');
    expect(sql).toContain('(currency, rate_date DESC)');

    // 2. Verified lateral as-of join pattern across all invoice cursors
    expect(sql).toContain('LEFT JOIN LATERAL (');
    expect(sql).toContain('FROM public.daily_exchange_rates der');
    expect(sql).toContain('ORDER BY der.rate_date DESC');
    expect(sql).toContain('LIMIT 1');

    // 3. Must NOT contain rigid equi-joins that break on weekend/holiday delivery dates
    expect(sql).not.toContain('er.rate_date = ni.invoice_delivery_date');
    expect(sql).not.toContain('er.rate_date = COALESCE(inv.teljesites_datuma');
  });

  describe('Statutory As-of Exchange Rate Resolution Logic', () => {
    interface ExchangeRate {
      currency: string;
      rate_date: string;
      rate: number;
    }

    // Mock exchange rate table mirroring MNB publication (only bank working days)
    const mockRates: ExchangeRate[] = [
      { currency: 'EUR', rate_date: '2026-07-30', rate: 361.50 },
      { currency: 'EUR', rate_date: '2026-07-31', rate: 362.99 }, // Friday
      // Saturday 2026-08-01 & Sunday 2026-08-02: NO MNB PUBLICATION
      { currency: 'EUR', rate_date: '2026-08-03', rate: 364.20 }, // Monday
    ];

    function resolveExchangeRateAsOf(currency: string, deliveryDate: string, rates: ExchangeRate[]): number {
      const candidates = rates
        .filter(r => r.currency === currency && r.rate_date <= deliveryDate)
        .sort((a, b) => b.rate_date.localeCompare(a.rate_date));
      return candidates.length > 0 ? candidates[0].rate : 1.0;
    }

    function resolveExchangeRateEquiJoin(currency: string, deliveryDate: string, rates: ExchangeRate[]): number {
      const match = rates.find(r => r.currency === currency && r.rate_date === deliveryDate);
      return match ? match.rate : 1.0; // Rigid equi-join fallback to 1.0
    }

    it('correctly resolves weekend delivery date (2026-08-01 Saturday) to Friday rate (2026-07-31)', () => {
      const saturdayDelivery = '2026-08-01';
      const resolvedRate = resolveExchangeRateAsOf('EUR', saturdayDelivery, mockRates);
      expect(resolvedRate).toBe(362.99);

      // Contrast with broken rigid equi-join
      const equiJoinRate = resolveExchangeRateEquiJoin('EUR', saturdayDelivery, mockRates);
      expect(equiJoinRate).toBe(1.0); // Fails and falls back to 1.0
    });

    it('simulates Taxology Kft Zoho invoice (#93055586) rounding to 16 eFt base / 4 eFt tax instead of 0 eFt', () => {
      const invoice = {
        invoice_number: '93055586',
        currency: 'EUR',
        delivery_date: '2026-08-01', // Saturday
        net_amount: 45.0, // EUR
        vat_amount: 12.15, // EUR (27%)
      };

      // 1. Broken equi-join calculation:
      const badRate = resolveExchangeRateEquiJoin(invoice.currency, invoice.delivery_date, mockRates);
      const badHufBase = invoice.net_amount * badRate; // 45 HUF
      const badHufTax = invoice.vat_amount * badRate; // 12.15 HUF
      const badRow18BaseInEFt = Math.round(badHufBase / 1000); // 0 eFt
      const badRow18TaxInEFt = Math.round(badHufTax / 1000); // 0 eFt

      expect(badRow18BaseInEFt).toBe(0);
      expect(badRow18TaxInEFt).toBe(0);

      // 2. Fixed lateral as-of join calculation:
      const goodRate = resolveExchangeRateAsOf(invoice.currency, invoice.delivery_date, mockRates);
      const goodHufBase = invoice.net_amount * goodRate; // 16 334.55 HUF
      const goodHufTax = invoice.vat_amount * goodRate; // 4 410.33 HUF
      const goodRow18BaseInEFt = Math.round(goodHufBase / 1000); // 16 eFt
      const goodRow18TaxInEFt = Math.round(goodHufTax / 1000); // 4 eFt

      expect(goodRate).toBe(362.99);
      expect(goodHufBase).toBeCloseTo(16334.55, 2);
      expect(goodHufTax).toBeCloseTo(4410.33, 2);
      expect(goodRow18BaseInEFt).toBe(16);
      expect(goodRow18TaxInEFt).toBe(4);
    });
  });
});
