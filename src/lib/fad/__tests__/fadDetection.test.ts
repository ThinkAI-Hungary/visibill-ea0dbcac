import { describe, it, expect } from 'vitest';
import {
  detectFadFromInvoice,
  detectFadFromLineItems,
  computeFadStats,
} from '../fadDetection';

describe('FAD Detection (Fordított Adózás Felismerés)', () => {
  describe('detectFadFromInvoice', () => {
    it('detects FAD from explicit AI-detected reverse_charge_category', () => {
      const result = detectFadFromInvoice({
        reverse_charge_category: 'construction',
        is_reverse_charge: false,
        forditott_adozas: false,
      });

      expect(result.isReverseCharge).toBe(true);
      expect(result.category).toBe('construction');
      expect(result.confidence).toBe(0.95);
      expect(result.source).toBe('ai_detected');
    });

    it('detects FAD from NAV is_reverse_charge flag when category is not yet set', () => {
      const result = detectFadFromInvoice({
        is_reverse_charge: true,
        forditott_adozas: false,
      });

      expect(result.isReverseCharge).toBe(true);
      expect(result.category).toBeNull();
      expect(result.confidence).toBe(0.90);
      expect(result.source).toBe('nav_flag');
    });

    it('detects FAD from uploaded invoice forditott_adozas field', () => {
      const result = detectFadFromInvoice({
        forditott_adozas: true,
        is_reverse_charge: false,
      });

      expect(result.isReverseCharge).toBe(true);
      expect(result.category).toBeNull();
      expect(result.confidence).toBe(0.85);
      expect(result.source).toBe('invoice_field');
    });

    it('returns isReverseCharge false for standard invoices', () => {
      const result = detectFadFromInvoice({
        is_reverse_charge: false,
        forditott_adozas: false,
        reverse_charge_category: null,
      });

      expect(result.isReverseCharge).toBe(false);
      expect(result.category).toBeNull();
      expect(result.confidence).toBe(1.0);
    });

    it('handles empty / undefined invoice properties gracefully', () => {
      const result = detectFadFromInvoice({});

      expect(result.isReverseCharge).toBe(false);
      expect(result.category).toBeNull();
    });
  });

  describe('detectFadFromLineItems', () => {
    it('detects DOMESTIC_REVERSE_CHARGE rate in line items', () => {
      const items = [
        { vat_rate: '27%' },
        { vat_rate: 'DOMESTIC_REVERSE_CHARGE' },
      ];
      const result = detectFadFromLineItems(items);

      expect(result.isReverseCharge).toBe(true);
      expect(result.source).toBe('vat_rate');
      expect(result.confidence).toBe(0.90);
    });

    it('detects FAD shorthand rate in line items', () => {
      const items = [{ vat_rate: 'FAD' }];
      const result = detectFadFromLineItems(items);

      expect(result.isReverseCharge).toBe(true);
      expect(result.source).toBe('vat_rate');
    });

    it('returns false when no reverse charge line items exist', () => {
      const items = [{ vat_rate: '27%' }, { vat_rate: '5%' }, { vat_rate: 'TAM' }];
      const result = detectFadFromLineItems(items);

      expect(result.isReverseCharge).toBe(false);
      expect(result.confidence).toBe(1.0);
    });

    it('returns false for empty items array', () => {
      const result = detectFadFromLineItems([]);
      expect(result.isReverseCharge).toBe(false);
    });
  });

  describe('computeFadStats', () => {
    it('accurately aggregates net amounts and counts by category', () => {
      const invoices = [
        {
          reverse_charge_category: 'construction',
          adoalap_osszesen: 500000,
        },
        {
          reverse_charge_category: 'construction',
          adoalap_osszesen: 250000,
        },
        {
          reverse_charge_category: 'scrap_metal',
          invoice_net_amount: 150000,
        },
        {
          is_reverse_charge: true,
          adoalap_osszesen: 100000,
        },
        {
          is_reverse_charge: false,
          adoalap_osszesen: 999999,
        },
      ];

      const stats = computeFadStats(invoices);

      expect(stats.hasAny).toBe(true);
      expect(stats.totalCount).toBe(4);
      expect(stats.totalNetAmount).toBe(1000000); // 500k + 250k + 150k + 100k
      expect(stats.byCategory['construction']).toEqual({
        count: 2,
        netAmount: 750000,
      });
      expect(stats.byCategory['scrap_metal']).toEqual({
        count: 1,
        netAmount: 150000,
      });
      expect(stats.byCategory['unknown']).toEqual({
        count: 1,
        netAmount: 100000,
      });
    });

    it('returns empty stats when no invoices are FAD', () => {
      const stats = computeFadStats([
        { is_reverse_charge: false, adoalap_osszesen: 10000 },
      ]);

      expect(stats.hasAny).toBe(false);
      expect(stats.totalCount).toBe(0);
      expect(stats.totalNetAmount).toBe(0);
      expect(stats.byCategory).toEqual({});
    });
  });
});
