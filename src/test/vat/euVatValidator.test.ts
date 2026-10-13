import { describe, it, expect } from 'vitest';
import {
  validateEuVatNumber,
  cleanEuVatNumber,
  EU_VAT_RULES,
  FAKE_TAX_NUMBER_KEYWORDS,
} from '@/lib/vat/euVatValidator';
import { calculateA60Aggregations } from '@/features/vat/core/vatEngine';

describe('EU VAT Validator (euVatValidator.ts)', () => {
  describe('cleanEuVatNumber', () => {
    it('removes spaces, dashes, dots, slashes and capitalizes', () => {
      expect(cleanEuVatNumber(' sk-2020 123.456/ ')).toBe('SK2020123456');
      expect(cleanEuVatNumber('de 123-456-789')).toBe('DE123456789');
      expect(cleanEuVatNumber(null)).toBe('');
      expect(cleanEuVatNumber(undefined)).toBe('');
    });
  });

  describe('Fake / Dummy tax numbers detection', () => {
    it('strictly rejects fake and placeholder words', () => {
      const fakes = [
        'SKINVALID',
        'SK-INVALID',
        'DE-FAKE',
        'ATTEST',
        'FRNINCS',
        'ROEMPTY',
        'SK0000000000',
        'ITXXXXXXXXXXX',
      ];

      for (const fake of fakes) {
        const res = validateEuVatNumber(fake);
        expect(res.isValid).toBe(false);
        expect(res.errorMessage).toBeDefined();
      }
    });
  });

  describe('EU 27 Member States Validation', () => {
    it('validates Austrian (AT) VAT numbers', () => {
      expect(validateEuVatNumber('ATU12345678').isValid).toBe(true);
      expect(validateEuVatNumber('AT12345678').isValid).toBe(false); // Missing 'U'
    });

    it('validates German (DE) VAT numbers', () => {
      expect(validateEuVatNumber('DE123456789').isValid).toBe(true);
      expect(validateEuVatNumber('DE12345678').isValid).toBe(false); // Only 8 digits
    });

    it('validates Slovakian (SK) VAT numbers', () => {
      expect(validateEuVatNumber('SK2020123456').isValid).toBe(true);
      expect(validateEuVatNumber('SK202012345').isValid).toBe(false); // Only 9 digits
      expect(validateEuVatNumber('SKINVALID').isValid).toBe(false); // Fake word & non-digit
    });

    it('validates Polish (PL) VAT numbers', () => {
      expect(validateEuVatNumber('PL1234567890').isValid).toBe(true);
      expect(validateEuVatNumber('PL123456789').isValid).toBe(false);
    });

    it('validates Romanian (RO) VAT numbers', () => {
      expect(validateEuVatNumber('RO12345678').isValid).toBe(true);
      expect(validateEuVatNumber('RO1').isValid).toBe(false); // Too short
    });

    it('validates Greek (EL and GR) VAT numbers', () => {
      expect(validateEuVatNumber('EL123456789').isValid).toBe(true);
      expect(validateEuVatNumber('GR123456789').isValid).toBe(true);
    });

    it('rejects unknown country prefix', () => {
      const res = validateEuVatNumber('XX12345678');
      expect(res.isValid).toBe(false);
      expect(res.errorMessage).toContain('Ismeretlen EU tagállami kód');
    });

    it('rejects empty or null tax number', () => {
      expect(validateEuVatNumber('').isValid).toBe(false);
      expect(validateEuVatNumber(null).isValid).toBe(false);
    });
  });

  describe('Integration with calculateA60Aggregations', () => {
    it('flags SKINVALID invoice with isValidFormat=false and records error in taxErrors', () => {
      const result = calculateA60Aggregations(
        [
          {
            id: 'inv-1',
            invoice_number: 'EU-2026-003',
            invoice_direction: 'OUTBOUND',
            partner_name: 'Slovakian Partners s.r.o.',
            partner_tax_number: 'SK-INVALID',
            country_code: 'SK',
            invoice_delivery_date: '2026-07-05',
            invoice_net_amount: 1500000,
            currency: 'HUF',
            isEu: true,
            amountEft: 1500,
            category: 'goods_out',
            isService: false,
            hasTaxNumber: true,
            isValidFormat: false,
          },
        ],
        {},
        { goodsOut: 1500, goodsIn: 0, servicesOut: 0, servicesIn: 0 }
      );

      expect(result.isValid).toBe(false);
      expect(result.itemsList[0].isValidFormat).toBe(false);
      expect(result.itemsList[0].formatError).toBeDefined();
      expect(result.taxErrors.length).toBeGreaterThan(0);
      expect(result.taxErrors[0]).toContain('EU-2026-003');
    });

    it('marks valid SK2020123456 invoice as valid format without taxErrors', () => {
      const result = calculateA60Aggregations(
        [
          {
            id: 'inv-2',
            invoice_number: 'EU-2026-004',
            invoice_direction: 'OUTBOUND',
            partner_name: 'Slovakian Partners s.r.o.',
            partner_tax_number: 'SK2020123456',
            country_code: 'SK',
            invoice_delivery_date: '2026-07-05',
            invoice_net_amount: 1500000,
            currency: 'HUF',
            isEu: true,
            amountEft: 1500,
            category: 'goods_out',
            isService: false,
            hasTaxNumber: true,
            isValidFormat: true,
          },
        ],
        {},
        { goodsOut: 1500, goodsIn: 0, servicesOut: 0, servicesIn: 0 }
      );

      expect(result.isValid).toBe(true);
      expect(result.itemsList[0].isValidFormat).toBe(true);
      expect(result.itemsList[0].formatError).toBeUndefined();
      expect(result.taxErrors.length).toBe(0);
    });
  });
});
