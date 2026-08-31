import { describe, it, expect } from 'vitest';
import {
  toHuf,
  isSameCurrency,
  filterAndSortInvoiceCandidates,
  filterAndSortTransactionCandidates,
} from './candidateFinder';
import { AvailableInvoice, AvailableTransaction } from './types';

describe('candidateFinder', () => {
  describe('toHuf & isSameCurrency', () => {
    it('converts EUR to HUF using approx FX rate', () => {
      expect(toHuf(100, 'EUR')).toBe(39500);
    });

    it('returns HUF unmodified', () => {
      expect(toHuf(50000, 'HUF')).toBe(50000);
      expect(toHuf(50000, null)).toBe(50000);
    });

    it('correctly compares same and different currencies', () => {
      expect(isSameCurrency('EUR', 'eur')).toBe(true);
      expect(isSameCurrency('HUF', null)).toBe(true);
      expect(isSameCurrency('HUF', 'EUR')).toBe(false);
    });
  });

  describe('filterAndSortInvoiceCandidates', () => {
    const mockInvoices: AvailableInvoice[] = Array.from({ length: 20 }, (_, i) => ({
      id: `inv-${i + 1}`,
      bizonylatsorszam: `SZL-2026-${100 + i}`,
      brutto_vegosszeg: (i + 1) * 10000,
      elado_nev: `Partner ${i + 1}`,
      penznem: i % 2 === 0 ? 'HUF' : 'EUR',
      kibocsatas_datuma: '2026-08-01',
      already_paid: 0,
      remaining: (i + 1) * 10000,
    }));

    it('filters within 30% tolerance for same currency and returns at least minShowCount items', () => {
      const result = filterAndSortInvoiceCandidates({
        availableInvoices: mockInvoices,
        transactionAmount: 50000,
        transactionCurrency: 'HUF',
        minShowCount: 10,
      });

      expect(result.length).toBeGreaterThanOrEqual(10);
      // The closest invoice to 50000 HUF same currency should be prioritized
      expect(result[0].penznem).toBe('HUF');
    });

    it('searches by invoice number and vendor name', () => {
      const result = filterAndSortInvoiceCandidates({
        availableInvoices: mockInvoices,
        search: 'SZL-2026-105',
        transactionAmount: 50000,
        transactionCurrency: 'HUF',
      });

      expect(result.length).toBe(1);
      expect(result[0].bizonylatsorszam).toBe('SZL-2026-105');
    });

    it('searches by amount substring', () => {
      const result = filterAndSortInvoiceCandidates({
        availableInvoices: mockInvoices,
        search: '60000',
        transactionAmount: 60000,
        transactionCurrency: 'HUF',
      });

      expect(result.some(inv => inv.brutto_vegosszeg === 60000)).toBe(true);
    });
  });

  describe('filterAndSortTransactionCandidates', () => {
    const mockTransactions: AvailableTransaction[] = Array.from({ length: 10 }, (_, i) => ({
      id: `tx-${i + 1}`,
      transaction_date: '2026-08-15',
      amount: -1 * (i + 1) * 5000,
      description: `Bank transfer payment to Partner ${i + 1}`,
      currency: 'HUF',
      type: 'transfer',
      matched_invoice_id: null,
      confidence_score: null,
      match_type: null,
      is_verified: null,
    }));

    it('filters transactions within amount tolerance', () => {
      const result = filterAndSortTransactionCandidates({
        availableTransactions: mockTransactions,
        invoiceAmount: 10000,
        invoiceCurrency: 'HUF',
      });

      // 10000 HUF with 30% tolerance matches 7000 - 13000 -> tx-2 (10000)
      expect(result.length).toBeGreaterThan(0);
      expect(Math.abs(result[0].amount)).toBe(10000);
    });

    it('searches by description query', () => {
      const result = filterAndSortTransactionCandidates({
        availableTransactions: mockTransactions,
        search: 'Partner 3',
      });

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('tx-3');
    });
  });
});
