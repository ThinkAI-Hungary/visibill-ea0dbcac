import { describe, it, expect } from 'vitest';
import {
  extractBaseTax,
  normalizePartnerName,
  isPartnerNameMatch,
  isGrossAmountMatch,
  isNavAndSubmittedInvoiceMatch,
  normalizeInvoiceNumber,
  evaluateNavAndSubmittedSuggestedMatch,
  isForeignSubmittedInvoice,
} from './invoiceMatchingUtils';

describe('invoiceMatchingUtils', () => {
  describe('normalizeInvoiceNumber', () => {
    it('strips spaces and converts to uppercase', () => {
      expect(normalizeInvoiceNumber(' 0057 / 26 ')).toBe('0057/26');
      expect(normalizeInvoiceNumber('inv-2026-01')).toBe('INV-2026-01');
      expect(normalizeInvoiceNumber('HP / 2026-002072')).toBe('HP/2026-002072');
      expect(normalizeInvoiceNumber('')).toBe('');
      expect(normalizeInvoiceNumber(null)).toBe('');
      expect(normalizeInvoiceNumber(undefined)).toBe('');
    });
  });

  describe('extractBaseTax', () => {
    it('extracts base 8 digits from Hungarian tax numbers', () => {
      expect(extractBaseTax('11032773-2-03')).toBe('11032773');
      expect(extractBaseTax('HU11032773')).toBe('11032773');
      expect(extractBaseTax('71221539-1-23')).toBe('71221539');
      expect(extractBaseTax('29163845-2-03')).toBe('29163845');
      expect(extractBaseTax(' 24067263-2-41 ')).toBe('24067263');
    });

    it('handles empty or foreign synthetic tax numbers', () => {
      expect(extractBaseTax('FOREIGN:anthropic')).toBe('');
      expect(extractBaseTax('')).toBe('');
      expect(extractBaseTax(null)).toBe('');
      expect(extractBaseTax(undefined)).toBe('');
    });
  });

  describe('normalizePartnerName', () => {
    it('strips legal suffixes and punctuation', () => {
      expect(normalizePartnerName('VÁN IRODA Szolgáltató Korlátolt Felelősségű Társaság')).toBe('van iroda szolgaltato');
      expect(normalizePartnerName('METAL ZONE Kft.')).toBe('metal zone');
      expect(normalizePartnerName('Durasnaz Family Group Kft.')).toBe('durasnaz family group');
      expect(normalizePartnerName('AD-LAK Holding Kft.')).toBe('ad lak holding');
      expect(normalizePartnerName('Dr. Ván Lajos e.v.')).toBe('dr van lajos');
      expect(normalizePartnerName('Alpha-Beta Trans Kft')).toBe('alpha beta trans');
    });
  });

  describe('isPartnerNameMatch', () => {
    it('matches exact and normalized company names with generic words', () => {
      expect(isPartnerNameMatch('METAL ZONE Kft', 'METAL ZONE Kft.')).toBe(true);
      expect(isPartnerNameMatch('Ván Iroda Kft.', 'VÁN IRODA Szolgáltató Kft.')).toBe(true);
      expect(isPartnerNameMatch('Durasnaz Family Group Kft.', 'Durasnaz Family Kft.')).toBe(true);
      expect(isPartnerNameMatch('Kolos Transport Kft.', 'Kolos Transport Hungary Kft.')).toBe(true);
    });

    it('rejects completely different company names', () => {
      expect(isPartnerNameMatch('Durasnaz Family Group Kft.', 'AD-LAK Holding Kft.')).toBe(false);
      expect(isPartnerNameMatch('Dr. Ván Lajos', 'Ván Iroda Kft.')).toBe(false);
      expect(isPartnerNameMatch('Sümegi és Társa Kft.', 'Kolos Transport Kft.')).toBe(false);
    });
  });

  describe('isGrossAmountMatch', () => {
    it('matches identical and slightly rounded amounts', () => {
      expect(isGrossAmountMatch(88265, 88265)).toBe(true);
      expect(isGrossAmountMatch(88265.4, 88265)).toBe(true);
      expect(isGrossAmountMatch(100000, 100004)).toBe(true); // Within 5 Ft tolerance
    });

    it('rejects significantly different amounts in same currency', () => {
      expect(isGrossAmountMatch(61595, 26135)).toBe(false);
      expect(isGrossAmountMatch(10000, 20000)).toBe(false);
    });

    it('rejects when currencies differ (e.g. HUF vs EUR)', () => {
      expect(isGrossAmountMatch(11932625, 32, 'HUF', 'EUR')).toBe(false);
      expect(isGrossAmountMatch(100, 100, 'EUR', 'USD')).toBe(false);
    });

    it('handles null/undefined amounts gracefully', () => {
      expect(isGrossAmountMatch(null, 50000)).toBe(true);
      expect(isGrossAmountMatch(50000, undefined)).toBe(true);
      expect(isGrossAmountMatch(null, null)).toBe(true);
    });
  });

  describe('isNavAndSubmittedInvoiceMatch', () => {
    it('MATCHES: Valid outbound invoice pair with same invoice number, partner tax, and amount (METAL ZONE 1975/26)', () => {
      const nav = {
        invoice_number: '1975/26',
        invoice_direction: 'OUTBOUND',
        customer_name: 'METAL ZONE Kft',
        customer_tax_number: '29163845',
        invoice_gross_amount: 88265,
        currency: 'HUF',
      };
      const sub = {
        bizonylatsorszam: '1975/26',
        invoice_direction: 'OUTBOUND',
        vevo_nev: 'METAL ZONE Kft',
        vevo_vat_id: '29163845-2-03',
        brutto_vegosszeg: 88265,
        penznem: 'HUF',
      };

      expect(isNavAndSubmittedInvoiceMatch(nav, sub)).toBe(true);
    });

    it('MATCHES: Valid inbound invoice pair with same invoice number, supplier tax, and amount', () => {
      const nav = {
        invoice_number: 'MVM-2026-99',
        invoice_direction: 'INBOUND',
        supplier_name: 'MVM Next Energiakereskedelmi Zrt.',
        supplier_tax_number: '10953768',
        invoice_gross_amount: 45200,
        currency: 'HUF',
      };
      const sub = {
        bizonylatsorszam: 'MVM-2026-99',
        invoice_direction: 'INBOUND',
        elado_nev: 'MVM Next Zrt.',
        elado_vat_id: 'HU10953768',
        brutto_vegosszeg: 45200,
        penznem: 'HUF',
      };

      expect(isNavAndSubmittedInvoiceMatch(nav, sub)).toBe(true);
    });

    it('REJECTS: False positive pair with same invoice number but different partner tax, name, and amount (0057/26 Durasnaz vs AD-LAK)', () => {
      const nav = {
        invoice_number: '0057/26',
        invoice_direction: 'OUTBOUND',
        supplier_name: 'VÁN IRODA Szolgáltató Kft.',
        supplier_tax_number: '11032773',
        customer_name: 'Durasnaz Family Group Kft.',
        customer_tax_number: '24067263',
        invoice_gross_amount: 61595,
        currency: 'HUF',
      };
      const sub = {
        bizonylatsorszam: '0057/26',
        invoice_direction: 'INBOUND',
        elado_nev: 'Dr. Ván Lajos',
        elado_vat_id: 'HU71221539',
        vevo_nev: 'AD-LAK Holding Kft.',
        vevo_vat_id: 'HU25938799',
        brutto_vegosszeg: 26135,
        penznem: 'HUF',
      };

      expect(isNavAndSubmittedInvoiceMatch(nav, sub)).toBe(false);
    });

    it('MATCHES: Same invoice number and matching partner name + amount even if tax is missing', () => {
      const nav = {
        invoice_number: '2026/001',
        invoice_direction: 'OUTBOUND',
        customer_name: 'Kovács János',
        customer_tax_number: null,
        invoice_gross_amount: 50000,
      };
      const sub = {
        bizonylatsorszam: '2026/001',
        invoice_direction: 'OUTBOUND',
        vevo_nev: 'Kovács János',
        vevo_vat_id: null,
        brutto_vegosszeg: 50000,
      };

      expect(isNavAndSubmittedInvoiceMatch(nav, sub)).toBe(true);
    });

    it('MATCHES: Explicit nav_invoice_id relation', () => {
      const nav = {
        id: 'nav-123',
        invoice_number: 'DIFF-NUM-1',
      };
      const sub = {
        bizonylatsorszam: 'DIFF-NUM-2',
        nav_invoice_id: 'nav-123',
      };

      expect(isNavAndSubmittedInvoiceMatch(nav, sub)).toBe(true);
    });

    it('REJECTS: Different invoice numbers', () => {
      const nav = {
        invoice_number: '1001/26',
      };
      const sub = {
        bizonylatsorszam: '1002/26',
      };

      expect(isNavAndSubmittedInvoiceMatch(nav, sub)).toBe(false);
    });
  });

  describe('evaluateNavAndSubmittedSuggestedMatch', () => {
    it('SUGGESTED MATCH: Truncated prefix SZJE-2026-1 vs JE-2026-1 with same tax and amount', () => {
      const nav = {
        invoice_number: 'SZJE-2026-1',
        invoice_direction: 'INBOUND',
        supplier_name: 'Szőke Józsefné e.v.',
        supplier_tax_number: '71221539-1-23',
        invoice_gross_amount: 150000,
        currency: 'HUF',
        invoice_issue_date: '2026-08-10',
      };
      const sub = {
        bizonylatsorszam: 'JE-2026-1', // OCR truncated prefix
        invoice_direction: 'INBOUND',
        elado_nev: 'Szőke Józsefné',
        elado_vat_id: '71221539',
        brutto_vegosszeg: 150000,
        penznem: 'HUF',
        kibocsatas_datuma: '2026-08-10',
      };

      const result = evaluateNavAndSubmittedSuggestedMatch(nav, sub);
      expect(result.isMatch).toBe(true);
      expect(result.isSuffixMatch).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(90);
      expect(result.reason).toContain('Partner adószám');
      expect(result.reason).toContain('Bruttó összeg');
      expect(result.reason).toContain('Sorszám részleges/suffix egyezés');
    });

    it('SUGGESTED MATCH: SZZJ-2026-5 vs J-2026-5 with name and amount match', () => {
      const nav = {
        invoice_number: 'SZZJ-2026-5',
        invoice_direction: 'INBOUND',
        supplier_name: 'Szanyi Zoltánné',
        supplier_tax_number: '11032773-2-03',
        invoice_gross_amount: 85200,
        currency: 'HUF',
        invoice_issue_date: '2026-08-12',
      };
      const sub = {
        bizonylatsorszam: 'J-2026-5',
        invoice_direction: 'INBOUND',
        elado_nev: 'Szanyi Zoltánné e.v.',
        elado_vat_id: '11032773',
        brutto_vegosszeg: 85200,
        penznem: 'HUF',
        kibocsatas_datuma: '2026-08-12',
      };

      const result = evaluateNavAndSubmittedSuggestedMatch(nav, sub);
      expect(result.isMatch).toBe(true);
      expect(result.isSuffixMatch).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(90);
    });

    it('SUGGESTED MATCH: Non-suffix but same partner, amount, and exact issue date', () => {
      const nav = {
        invoice_number: 'INV-2026-0099',
        invoice_direction: 'INBOUND',
        supplier_name: 'Alpha Trans Kft.',
        supplier_tax_number: '24067263-2-41',
        invoice_gross_amount: 45000,
        currency: 'HUF',
        invoice_issue_date: '2026-08-01',
      };
      const sub = {
        bizonylatsorszam: 'SZLA-99',
        invoice_direction: 'INBOUND',
        elado_nev: 'Alpha Trans Kft',
        elado_vat_id: '24067263',
        brutto_vegosszeg: 45000,
        penznem: 'HUF',
        kibocsatas_datuma: '2026-08-01',
      };

      const result = evaluateNavAndSubmittedSuggestedMatch(nav, sub);
      expect(result.isMatch).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(90);
    });

    it('REJECTS: Same partner and same amount but different issue dates (Trend-Art recurring invoice)', () => {
      // Replicating user's second screenshot:
      // NAV: TRNDR-2026-17, Trend-Art Media Nonprofit Kft., 32885923, 2026.08.25, 530 000 Ft
      const nav = {
        invoice_number: 'TRNDR-2026-17',
        invoice_direction: 'INBOUND',
        supplier_name: 'Trend-Art Media Nonprofit Kft.',
        supplier_tax_number: '32885923-2-41',
        invoice_gross_amount: 530000,
        currency: 'HUF',
        invoice_issue_date: '2026-08-25',
      };
      // Submitted: TRNDR-2026-15, Trend-Art Media Nonprofit Kft., 32885923, 2026.08.14, 530 000 Ft
      const sub = {
        bizonylatsorszam: 'TRNDR-2026-15',
        invoice_direction: 'INBOUND',
        elado_nev: 'Trend-Art Media Nonprofit Kft.',
        elado_vat_id: 'HU32885923',
        brutto_vegosszeg: 530000,
        penznem: 'HUF',
        kibocsatas_datuma: '2026-08-14',
      };

      const result = evaluateNavAndSubmittedSuggestedMatch(nav, sub);
      expect(result.isMatch).toBe(false);
      expect(result.score).toBe(0);
    });

    it('REJECTS: Conflicting tax numbers even with same amount', () => {
      const nav = {
        invoice_number: 'SZJE-2026-1',
        invoice_direction: 'INBOUND',
        supplier_name: 'Szőke Józsefné',
        supplier_tax_number: '71221539-1-23',
        invoice_gross_amount: 150000,
        currency: 'HUF',
      };
      const sub = {
        bizonylatsorszam: 'JE-2026-1',
        invoice_direction: 'INBOUND',
        elado_nev: 'Másik Cég Kft.',
        elado_vat_id: '99999999-2-03',
        brutto_vegosszeg: 150000,
        penznem: 'HUF',
      };

      const result = evaluateNavAndSubmittedSuggestedMatch(nav, sub);
      expect(result.isMatch).toBe(false);
      expect(result.score).toBe(0);
    });

    it('REJECTS: Conflicting amounts with same partner', () => {
      const nav = {
        invoice_number: 'SZJE-2026-1',
        invoice_direction: 'INBOUND',
        supplier_name: 'Szőke Józsefné',
        supplier_tax_number: '71221539-1-23',
        invoice_gross_amount: 150000,
        currency: 'HUF',
      };
      const sub = {
        bizonylatsorszam: 'JE-2026-1',
        invoice_direction: 'INBOUND',
        elado_nev: 'Szőke Józsefné',
        elado_vat_id: '71221539',
        brutto_vegosszeg: 280000,
        penznem: 'HUF',
      };

      const result = evaluateNavAndSubmittedSuggestedMatch(nav, sub);
      expect(result.isMatch).toBe(false);
      expect(result.score).toBe(0);
    });

    it('REJECTS: Foreign invoice against domestic NAV invoice (Mailgun vs Wagner Global)', () => {
      // Replicating the user's exact screenshot scenario:
      // NAV: THINK-2026-29, Wagner Global Services Kft., tax: 11183965, HUF 11 932 625, OUTBOUND
      const nav = {
        id: 'nav-uuid-1',
        invoice_number: 'THINK-2026-29',
        invoice_direction: 'OUTBOUND',
        customer_name: 'Wagner Global Services Kft.',
        customer_tax_number: '11183965',
        supplier_name: 'Thinkerman Kft.',
        supplier_tax_number: '32478620-2-43',
        invoice_gross_amount: 11932625,
        currency: 'HUF',
        invoice_issue_date: '2026-08-31',
      };

      // Submitted: #91413303, Mailgun Technologies, Inc. / Balazs Lederer, EUR 32.00, INBOUND
      const sub = {
        id: 'sub-uuid-1',
        bizonylatsorszam: '91413303',
        invoice_direction: 'INBOUND',
        elado_nev: 'Mailgun Technologies, Inc.',
        elado_vat_id: 'US123456',
        vevo_nev: 'Thinkerman Kft.',
        vevo_vat_id: 'HU32478620',
        brutto_vegosszeg: 32,
        penznem: 'EUR',
        kibocsatas_datuma: '2026-09-01',
        nav_status: 'not_applicable',
      };

      const result = evaluateNavAndSubmittedSuggestedMatch(nav, sub);
      expect(result.isMatch).toBe(false);
      expect(result.score).toBe(0);
    });

    it('REJECTS: Direction mismatch (OUTBOUND NAV vs INBOUND submitted with same partner)', () => {
      const nav = {
        invoice_number: 'SZ-001',
        invoice_direction: 'OUTBOUND',
        customer_name: 'Partner Kft.',
        customer_tax_number: '12345678',
        invoice_gross_amount: 100000,
        currency: 'HUF',
      };
      const sub = {
        bizonylatsorszam: 'SZ-001-EXTRA',
        invoice_direction: 'INBOUND',
        elado_nev: 'Partner Kft.',
        elado_vat_id: '12345678',
        brutto_vegosszeg: 100000,
        penznem: 'HUF',
      };

      const result = evaluateNavAndSubmittedSuggestedMatch(nav, sub);
      expect(result.isMatch).toBe(false);
      expect(result.score).toBe(0);
    });
  });

  describe('isForeignSubmittedInvoice', () => {
    it('returns true when nav_status is not_applicable', () => {
      expect(isForeignSubmittedInvoice({ nav_status: 'not_applicable' })).toBe(true);
    });

    it('returns true for foreign seller VAT prefix', () => {
      expect(isForeignSubmittedInvoice({ elado_vat_id: 'US-8492049' })).toBe(true);
      expect(isForeignSubmittedInvoice({ elado_vat_id: 'DE123456789' })).toBe(true);
      expect(isForeignSubmittedInvoice({ elado_vat_id: 'FR987654321' })).toBe(true);
    });

    it('returns true for non-HUF currency without Hungarian tax number', () => {
      expect(isForeignSubmittedInvoice({ penznem: 'EUR', elado_vat_id: null })).toBe(true);
      expect(isForeignSubmittedInvoice({ penznem: 'USD', elado_vat_id: '' })).toBe(true);
    });

    it('returns false for domestic invoices', () => {
      expect(isForeignSubmittedInvoice({ elado_vat_id: 'HU12345678' })).toBe(false);
      expect(isForeignSubmittedInvoice({ elado_vat_id: '12345678-2-42' })).toBe(false);
      expect(isForeignSubmittedInvoice({ elado_vat_id: '12345678' })).toBe(false);
      expect(isForeignSubmittedInvoice({ invoice_direction: 'OUTBOUND' })).toBe(false);
    });
  });
});
