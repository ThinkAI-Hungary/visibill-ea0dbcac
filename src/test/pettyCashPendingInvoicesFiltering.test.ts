import { describe, it, expect } from 'vitest';
import { isPendingPettyCashInvoice, isCashPaymentMethod } from '@/lib/pettyCashUtils';

describe('Petty Cash Pending Invoices Filtering (Prove-It)', () => {
  describe('isCashPaymentMethod', () => {
    it('returns true for cash payment terms in various formats', () => {
      expect(isCashPaymentMethod('Készpénz')).toBe(true);
      expect(isCashPaymentMethod('keszpenz')).toBe(true);
      expect(isCashPaymentMethod('Cash')).toBe(true);
      expect(isCashPaymentMethod('KP')).toBe(true);
      expect(isCashPaymentMethod('készpénzfizetés')).toBe(true);
      expect(isCashPaymentMethod('Házipénztár')).toBe(true);
    });

    it('returns false for non-cash payment methods', () => {
      expect(isCashPaymentMethod('Bankkártya')).toBe(false);
      expect(isCashPaymentMethod('bankkartya')).toBe(false);
      expect(isCashPaymentMethod('Átutalás')).toBe(false);
      expect(isCashPaymentMethod('transfer')).toBe(false);
      expect(isCashPaymentMethod('Utánvét')).toBe(false);
      expect(isCashPaymentMethod(null)).toBe(false);
      expect(isCashPaymentMethod(undefined)).toBe(false);
      expect(isCashPaymentMethod('')).toBe(false);
    });
  });

  describe('isPendingPettyCashInvoice', () => {
    it('REJECTS bank card simplified invoice (e.g. Magyar Posta card receipt)', () => {
      const postaCardInvoice = {
        id: 'posta-1',
        invoice_type: 'egyszerusitett_szla',
        fizetesi_mod: 'bankkártya',
        elado_nev: 'Magyar Posta Zrt.',
        brutto_vegosszeg: 5790,
      };

      expect(isPendingPettyCashInvoice(postaCardInvoice)).toBe(false);
    });

    it('REJECTS wire transfer simplified invoice', () => {
      const transferInvoice = {
        id: 'trans-1',
        invoice_type: 'egyszerusitett_szla',
        fizetesi_mod: 'Átutalás',
        elado_nev: 'Beszállító Kft.',
        brutto_vegosszeg: 12000,
      };

      expect(isPendingPettyCashInvoice(transferInvoice)).toBe(false);
    });

    it('ACCEPTS cash simplified invoice', () => {
      const cashInvoice = {
        id: 'cash-1',
        invoice_type: 'egyszerusitett_szla',
        fizetesi_mod: 'Készpénz',
        elado_nev: 'Magyar Posta Zrt.',
        brutto_vegosszeg: 1500,
      };

      expect(isPendingPettyCashInvoice(cashInvoice)).toBe(true);
    });

    it('ALWAYS ACCEPTS penztarbizonylat (cash voucher)', () => {
      const voucher = {
        id: 'pb-1',
        invoice_type: 'penztarbizonylat',
        fizetesi_mod: null,
      };

      expect(isPendingPettyCashInvoice(voucher)).toBe(true);
    });

    it('ALWAYS ACCEPTS penztargep_zaras (cash register closure)', () => {
      const closure = {
        id: 'pz-1',
        invoice_type: 'penztargep_zaras',
        fizetesi_mod: undefined,
      };

      expect(isPendingPettyCashInvoice(closure)).toBe(true);
    });
  });
});
