import { describe, it, expect } from 'vitest';
import {
  validateFadInvoice,
  getOverallSeverity,
} from '../fadValidation';

describe('FAD Validation (Fordított Adózás Szabályellenőrzés)', () => {
  describe('validateFadInvoice', () => {
    it('returns empty results if invoice is not reverse charge', () => {
      const results = validateFadInvoice({
        forditott_adozas: false,
        is_reverse_charge: false,
      });

      expect(results).toEqual([]);
    });

    it('flags warning when reverse_charge_category is missing', () => {
      const results = validateFadInvoice({
        is_reverse_charge: true,
        elado_vat_id: '12345678-2-41',
        vevo_vat_id: '87654321-2-42',
        teljesites_datuma: '2026-03-01',
        afa_osszeg_osszesen: 0,
      });

      expect(results.some(r => r.code === 'FAD_NO_CATEGORY')).toBe(true);
      expect(getOverallSeverity(results)).toBe('warning');
    });

    it('flags warning when VAT amount is greater than 0 on a FAD invoice', () => {
      const results = validateFadInvoice({
        forditott_adozas: true,
        reverse_charge_category: 'construction',
        elado_vat_id: '12345678-2-41',
        vevo_vat_id: '87654321-2-42',
        teljesites_datuma: '2026-03-01',
        afa_osszeg_osszesen: 27000,
      });

      const vatWarning = results.find(r => r.code === 'FAD_NONZERO_VAT');
      expect(vatWarning).toBeDefined();
      expect(vatWarning?.severity).toBe('warning');
      expect(vatWarning?.message).toContain('27000 Ft');
    });

    it('flags warnings when seller or buyer VAT ID is missing', () => {
      const results = validateFadInvoice({
        is_reverse_charge: true,
        reverse_charge_category: 'scrap_metal',
        teljesites_datuma: '2026-03-01',
        afa_osszeg_osszesen: 0,
      });

      expect(results.some(r => r.code === 'FAD_MISSING_SELLER_VAT')).toBe(true);
      expect(results.some(r => r.code === 'FAD_MISSING_BUYER_VAT')).toBe(true);
    });

    it('flags error when performance date is missing', () => {
      const results = validateFadInvoice({
        is_reverse_charge: true,
        reverse_charge_category: 'steel',
        elado_vat_id: '12345678-2-41',
        vevo_vat_id: '87654321-2-42',
        afa_osszeg_osszesen: 0,
      });

      const perfDateError = results.find(r => r.code === 'FAD_MISSING_PERF_DATE');
      expect(perfDateError).toBeDefined();
      expect(perfDateError?.severity).toBe('error');
      expect(getOverallSeverity(results)).toBe('error');
    });

    it('passes cleanly for valid domestic FAD invoice', () => {
      const results = validateFadInvoice({
        is_reverse_charge: true,
        reverse_charge_category: 'construction',
        elado_vat_id: '12345678-2-41',
        vevo_vat_id: '87654321-2-42',
        teljesites_datuma: '2026-03-01',
        afa_osszeg_osszesen: 0,
      });

      expect(results).toHaveLength(0);
      expect(getOverallSeverity(results)).toBeNull();
    });

    it('flags info when foreign seller is used for domestic reverse charge', () => {
      const results = validateFadInvoice({
        is_reverse_charge: true,
        reverse_charge_category: 'construction',
        elado_vat_id: 'DE123456789',
        vevo_vat_id: '87654321-2-42',
        teljesites_datuma: '2026-03-01',
        afa_osszeg_osszesen: 0,
      });

      expect(results.some(r => r.code === 'FAD_FOREIGN_SELLER_DOMESTIC_RC')).toBe(true);
      expect(getOverallSeverity(results)).toBe('info');
    });
  });

  describe('getOverallSeverity', () => {
    it('returns null for empty array', () => {
      expect(getOverallSeverity([])).toBeNull();
    });

    it('returns error when at least one error exists', () => {
      expect(
        getOverallSeverity([
          { code: 'W1', severity: 'warning', message: 'warn' },
          { code: 'E1', severity: 'error', message: 'err' },
        ])
      ).toBe('error');
    });

    it('returns warning when no errors but warning exists', () => {
      expect(
        getOverallSeverity([
          { code: 'I1', severity: 'info', message: 'inf' },
          { code: 'W1', severity: 'warning', message: 'warn' },
        ])
      ).toBe('warning');
    });

    it('returns info when only info items exist', () => {
      expect(
        getOverallSeverity([{ code: 'I1', severity: 'info', message: 'inf' }])
      ).toBe('info');
    });
  });
});
