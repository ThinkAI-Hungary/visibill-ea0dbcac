import { describe, it, expect } from 'vitest';
import {
  extractBaseTax,
  normalizePartnerName,
  isPartnerNameMatch,
  isGrossAmountMatch,
  isNavAndSubmittedInvoiceMatch,
  normalizeInvoiceNumber,
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
});
