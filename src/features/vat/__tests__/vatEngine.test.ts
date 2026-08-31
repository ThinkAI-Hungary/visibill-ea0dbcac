import { describe, it, expect } from 'vitest';
import {
  validateHungarianTaxNumber,
  runXmlValidation,
  calculateVatBalances,
  calculateA60Aggregations,
  calculateDeadlineCountdown,
  findSuspiciousReverseChargeInvoices,
} from '../core/vatEngine';

describe('VatEngine', () => {
  describe('validateHungarianTaxNumber', () => {
    it('validates a correct 8-digit tax number with valid CDV', () => {
      // 12345676 -> 1*9 + 2*7 + 3*3 + 4*1 + 5*9 + 6*7 + 7*3 + 6*1 = 9+14+9+4+45+42+21+6 = 150 (sum%10 === 0)
      const res = validateHungarianTaxNumber('12345676');
      expect(res.isValid).toBe(true);
      expect(res.status).toBe('active');
    });

    it('validates an 11-digit tax number with VAT code 2 (standard)', () => {
      const res = validateHungarianTaxNumber('12345676-2-41');
      expect(res.isValid).toBe(true);
      expect(res.vatCode).toBe('2');
      expect(res.status).toBe('active');
    });

    it('identifies VAT code 1 as exempt', () => {
      const res = validateHungarianTaxNumber('12345676-1-41');
      expect(res.isValid).toBe(true);
      expect(res.vatCode).toBe('1');
      expect(res.status).toBe('exempt');
      expect(res.severity).toBe('warning');
    });

    it('flags invalid CDV checksum', () => {
      const res = validateHungarianTaxNumber('12345677-2-41');
      expect(res.isValid).toBe(false);
      expect(res.status).toBe('invalid');
      expect(res.reason).toContain('NAV CDV ellenőrzőösszeg hiba');
    });

    it('handles foreign partners starting with FOREIGN: or TEST-', () => {
      const res = validateHungarianTaxNumber('FOREIGN:DE123456789');
      expect(res.isValid).toBe(true);
      expect(res.isForeign).toBe(true);
      expect(res.status).toBe('active');
    });
  });

  describe('runXmlValidation', () => {
    it('returns pass results for valid xml, matching sums, and valid tax number', () => {
      const xml = '<?xml version="1.0"?><nyomtatvany><fejlec></fejlec></nyomtatvany>';
      const checks = runXmlValidation(xml, '12345676-2-41', 500, 500);

      expect(checks).toHaveLength(3);
      expect(checks[0].status).toBe('success');
      expect(checks[1].status).toBe('success');
      expect(checks[2].status).toBe('success');
    });

    it('detects M-sheet sum mismatch', () => {
      const xml = '<?xml version="1.0"?><nyomtatvany></nyomtatvany>';
      const checks = runXmlValidation(xml, '12345676-2-41', 500, 400);

      expect(checks[2].status).toBe('error');
      expect(checks[2].message).toContain('Összegzési eltérés');
    });
  });

  describe('calculateVatBalances', () => {
    it('calculates payable net balance when payable exceeds deductible and carryforward', () => {
      const res = calculateVatBalances(1000, 400, 100);
      expect(res.net83).toBe(500);
      expect(res.toPay84).toBe(500);
      expect(res.reclaimable85).toBe(0);
      expect(res.carryforward86).toBe(0);
    });

    it('calculates reclaimable/carryforward when deductible exceeds payable', () => {
      const res = calculateVatBalances(300, 700, 0);
      expect(res.net83).toBe(-400);
      expect(res.toPay84).toBe(0);
      expect(res.reclaimable85).toBe(400);
      expect(res.carryforward86).toBe(400);
    });
  });

  describe('calculateA60Aggregations', () => {
    it('aggregates goods and services, validating matching declarations', () => {
      const euInvoices = [
        {
          id: 'inv-1',
          invoice_number: 'SZ-001',
          invoice_direction: 'OUTBOUND',
          partner_tax_number: 'DE123456789',
          invoice_net_amount: 1000,
          currency: 'EUR',
          defaultIsService: false,
        },
        {
          id: 'inv-2',
          invoice_number: 'SZ-002',
          invoice_direction: 'OUTBOUND',
          partner_tax_number: 'ATU12345678',
          invoice_net_amount: 500,
          currency: 'EUR',
          defaultIsService: true,
        },
      ];

      const rates = { EUR: 400 };
      // 1000 EUR * 400 = 400,000 HUF = 400 eFt goods
      // 500 EUR * 400 = 200,000 HUF = 200 eFt services
      const result = calculateA60Aggregations(euInvoices, {}, 400, 200, rates);

      expect(result.goodsSum).toBe(400);
      expect(result.servicesSum).toBe(200);
      expect(result.goodsMismatch).toBe(false);
      expect(result.servicesMismatch).toBe(false);
      expect(result.taxErrors).toHaveLength(0);
      expect(result.isValid).toBe(true);
    });
  });

  describe('calculateDeadlineCountdown', () => {
    it('calculates monthly deadline as 20th of the following month', () => {
      const fixedDate = new Date(2026, 4, 10); // May 10, 2026
      const info = calculateDeadlineCountdown(2026, 4, 'H', fixedDate); // April return -> May 20 deadline
      expect(info.daysLeft).toBe(10);
      expect(info.dateFormatted).toContain('2026');
    });
  });

  describe('findSuspiciousReverseChargeInvoices', () => {
    it('flags partner with construction keywords charging VAT', () => {
      const mLines = [
        {
          id: '1',
          partner_name: 'Építőmester Kft.',
          partner_tax_number: '12345676-2-41',
          invoice_count: 1,
          base_amount_rounded: 1000,
          tax_amount_rounded: 270,
          tax_5_amount: 0,
          tax_18_amount: 0,
          tax_27_amount: 270000,
          invoice_details: [
            { invoice_number: 'EP-01', net: 1000000, vat: 270000, vat_rate: '0.27' },
          ],
        },
      ];

      const suspicious = findSuspiciousReverseChargeInvoices(mLines);
      expect(suspicious).toHaveLength(1);
      expect(suspicious[0].partnerName).toBe('Építőmester Kft.');
    });
  });
});
