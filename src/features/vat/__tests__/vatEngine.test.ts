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

    it('validates an undashed 11-digit continuous tax number', () => {
      const res = validateHungarianTaxNumber('12345676241');
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

    it('accurately calculates 4 statutory categories: goodsOut (02), goodsIn (11-16), servicesOut (91-92), servicesIn (18)', () => {
      const euInvoices = [
        // 1. Termékértékesítés -> 02. sor
        {
          id: 'inv-out-goods',
          invoice_number: 'EXP-001',
          invoice_direction: 'OUTBOUND',
          partner_name: 'German Client GmbH',
          partner_tax_number: 'DE123456789',
          invoice_net_amount: 2500,
          currency: 'EUR',
          defaultIsService: false,
        },
        // 2. Szolgáltatásnyújtás -> 91-92. sor
        {
          id: 'inv-out-svc',
          invoice_number: 'SVC-001',
          invoice_direction: 'OUTBOUND',
          partner_name: 'Austrian Partner AG',
          partner_tax_number: 'ATU99999999',
          invoice_net_amount: 1000,
          currency: 'EUR',
          defaultIsService: true,
        },
        // 3. Termékbeszerzés -> 11-16. sor
        {
          id: 'inv-in-goods',
          invoice_number: 'IMP-001',
          invoice_direction: 'INBOUND',
          partner_name: 'Polish Supplier Sp.',
          partner_tax_number: 'PL1234567890',
          invoice_net_amount: 500,
          currency: 'EUR',
          defaultIsService: false,
        },
        // 4. Szolgáltatás igénybevétele (Google Ireland) -> 18. sor
        {
          id: 'inv-in-google',
          invoice_number: 'GCP-001',
          invoice_direction: 'INBOUND',
          partner_name: 'Google Ireland Limited',
          partner_tax_number: 'IE6388047V',
          invoice_net_amount: 300,
          currency: 'EUR',
          defaultIsService: true,
        },
      ];

      const rates = { EUR: 400 };
      // 2500 EUR * 400 = 1 000 000 HUF = 1000 eFt goodsOut (02. sor)
      // 1000 EUR * 400 = 400 000 HUF = 400 eFt servicesOut (91-92. sor)
      // 500 EUR * 400 = 200 000 HUF = 200 eFt goodsIn (11-16. sor)
      // 300 EUR * 400 = 120 000 HUF = 120 eFt servicesIn (18. sor)

      const result = calculateA60Aggregations(
        euInvoices,
        {},
        {
          goodsOut: 1000,
          goodsIn: 200,
          servicesOut: 400,
          servicesIn: 120,
        },
        0,
        rates
      );

      expect(result.goodsOutSum).toBe(1000);
      expect(result.expectedGoodsOut).toBe(1000);
      expect(result.goodsOutMismatch).toBe(false);

      expect(result.goodsInSum).toBe(200);
      expect(result.expectedGoodsIn).toBe(200);
      expect(result.goodsInMismatch).toBe(false);

      expect(result.servicesOutSum).toBe(400);
      expect(result.expectedServicesOut).toBe(400);
      expect(result.servicesOutMismatch).toBe(false);

      expect(result.servicesInSum).toBe(120);
      expect(result.expectedServicesIn).toBe(120);
      expect(result.servicesInMismatch).toBe(false);

      expect(result.taxErrors).toHaveLength(0);
      expect(result.isValid).toBe(true);
      expect(result.itemsList).toHaveLength(4);

      // Verify categories
      expect(result.itemsList.find((i) => i.id === 'inv-out-goods')?.category).toBe('goods_out');
      expect(result.itemsList.find((i) => i.id === 'inv-out-svc')?.category).toBe('services_out');
      expect(result.itemsList.find((i) => i.id === 'inv-in-goods')?.category).toBe('goods_in');
      expect(result.itemsList.find((i) => i.id === 'inv-in-google')?.category).toBe('services_in');
    });

    it('correctly categorizes Digital Charging Solutions as EU product acquisition (goods_in) and Google as EU service (services_in) matching declarations', () => {
      const euInvoices = [
        {
          id: 'b738d8b1-eca6-45eb-b6f3-cfb395efa163',
          invoice_number: 'DHU00037003',
          invoice_direction: 'INBOUND' as const,
          partner_name: 'Digital Charging Solutions GmbH',
          partner_tax_number: 'DE312237805',
          country_code: 'DE',
          invoice_delivery_date: '2026-07-31',
          invoice_net_amount: 12699,
          currency: 'HUF',
          defaultIsService: false,
          source_table: 'invoices' as const,
        },
        {
          id: 'inv-google',
          invoice_number: '5646683756',
          invoice_direction: 'INBOUND' as const,
          partner_name: 'Google Cloud EMEA Limited',
          partner_tax_number: 'IE3668997OH',
          country_code: 'IE',
          invoice_delivery_date: '2026-07-31',
          invoice_net_amount: 86.23,
          currency: 'EUR',
          defaultIsService: true,
          source_table: 'invoices' as const,
        },
      ];

      const rates = { EUR: 395.5 };
      // Digital Charging: 12699 HUF / 1000 = 13 eFt goods_in
      // Google: 86.23 EUR * 395.5 = 34103.965 HUF = 34 eFt services_in
      const result = calculateA60Aggregations(
        euInvoices,
        {},
        {
          goodsOut: 0,
          goodsIn: 13,
          servicesOut: 0,
          servicesIn: 34,
        },
        0,
        rates
      );

      expect(result.goodsInSum).toBe(13);
      expect(result.expectedGoodsIn).toBe(13);
      expect(result.goodsInMismatch).toBe(false);

      expect(result.servicesInSum).toBe(34);
      expect(result.expectedServicesIn).toBe(34);
      expect(result.servicesInMismatch).toBe(false);

      expect(result.taxErrors).toHaveLength(0);
      expect(result.isValid).toBe(true);

      const dcItem = result.itemsList.find((i) => i.id === 'b738d8b1-eca6-45eb-b6f3-cfb395efa163');
      expect(dcItem).toBeDefined();
      expect(dcItem?.category).toBe('goods_in');
      expect(dcItem?.partner_tax_number).toBe('DE312237805');
      expect(dcItem?.amountEft).toBe(13);
    });

    it('handles full-year multi-vendor community service aggregation with rounded matching', () => {
      const annualEuInvoices = [
        {
          id: 'inv-1',
          invoice_number: '5474596523',
          invoice_direction: 'INBOUND' as const,
          partner_name: 'Google Cloud EMEA Limited',
          partner_tax_number: 'IE3668997OH',
          country_code: 'IE',
          invoice_delivery_date: '2026-01-31',
          invoice_net_amount: 48.6,
          currency: 'EUR',
          defaultIsService: true,
          source_table: 'invoices' as const,
        },
        {
          id: 'inv-2',
          invoice_number: '3FTSDM4M0003',
          invoice_direction: 'INBOUND' as const,
          partner_name: 'Anthropic, PBC',
          partner_tax_number: 'IE4276970QH',
          country_code: 'IE',
          invoice_delivery_date: '2026-05-24',
          invoice_net_amount: 18,
          currency: 'EUR',
          defaultIsService: true,
          source_table: 'invoices' as const,
        },
        {
          id: 'inv-3',
          invoice_number: '93093189',
          invoice_direction: 'INBOUND' as const,
          partner_name: 'Zoho Corporation B.V.',
          partner_tax_number: 'NL855264263B01',
          country_code: 'NL',
          invoice_delivery_date: '2026-09-01',
          invoice_net_amount: 45,
          currency: 'EUR',
          defaultIsService: true,
          source_table: 'invoices' as const,
        },
      ];

      const rates = { EUR: 400 };
      // Per-invoice eFt rounding:
      // inv-1: 48.6 * 400 = 19,440 HUF -> 19 eFt
      // inv-2: 18 * 400 = 7,200 HUF -> 7 eFt
      // inv-3: 45 * 400 = 18,000 HUF -> 18 eFt
      // Total = 19 + 7 + 18 = 44 eFt
      const expectedServicesInEft = 44;

      const result = calculateA60Aggregations(
        annualEuInvoices,
        {},
        {
          goodsOut: 0,
          goodsIn: 0,
          servicesOut: 0,
          servicesIn: expectedServicesInEft,
        },
        0,
        rates
      );

      expect(result.servicesInSum).toBe(expectedServicesInEft);
      expect(result.expectedServicesIn).toBe(expectedServicesInEft);
      expect(result.servicesInMismatch).toBe(false);
      expect(result.isValid).toBe(true);
      expect(result.itemsList).toHaveLength(3);
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
