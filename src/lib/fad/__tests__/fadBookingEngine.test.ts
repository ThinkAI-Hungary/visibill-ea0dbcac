import { describe, it, expect } from 'vitest';
import {
  calculateReverseChargeVat,
  summarizeFadForPeriod,
  type ReverseChargeEntry,
} from '../fadBookingEngine';

describe('FAD Booking Engine (Áfa tv. 60. § Időpont- és ÁFA-számító motor)', () => {
  describe('calculateReverseChargeVat', () => {
    it('calculates 27% VAT obligation based on performance date by default', () => {
      const entry = calculateReverseChargeVat({
        sourceId: 'inv-100',
        sourceTable: 'nav_invoices',
        category: 'construction',
        netAmount: 1000000,
        performanceDate: '2026-03-15',
        issueDate: '2026-03-20',
      });

      expect(entry.sourceId).toBe('inv-100');
      expect(entry.sourceTable).toBe('nav_invoices');
      expect(entry.category).toBe('construction');
      expect(entry.netAmount).toBe(1000000);
      expect(entry.vatRate).toBe(0.27);
      expect(entry.vatAmount).toBe(270000);
      expect(entry.vatDate).toBe('2026-03-15');
      expect(entry.currency).toBe('HUF');
    });

    it('falls back to issue date if performance date is empty', () => {
      const entry = calculateReverseChargeVat({
        sourceId: 'inv-101',
        sourceTable: 'invoices',
        category: 'scrap_metal',
        netAmount: 350000,
        performanceDate: '',
        issueDate: '2026-04-01',
        currency: 'EUR',
      });

      expect(entry.vatDate).toBe('2026-04-01');
      expect(entry.currency).toBe('EUR');
      expect(entry.vatAmount).toBe(94500); // 350,000 * 0.27
    });

    it('supports custom VAT rates and rounds properly', () => {
      const entry = calculateReverseChargeVat({
        sourceId: 'inv-102',
        sourceTable: 'nav_invoices',
        category: 'labor_hire',
        netAmount: 12345,
        vatRate: 0.05,
        performanceDate: '2026-05-10',
        issueDate: '2026-05-10',
      });

      expect(entry.vatRate).toBe(0.05);
      expect(entry.vatAmount).toBe(617); // Math.round(12345 * 0.05 = 617.25)
    });
  });

  describe('summarizeFadForPeriod', () => {
    it('summarizes multiple FAD entries across categories', () => {
      const entries: ReverseChargeEntry[] = [
        {
          sourceId: '1',
          sourceTable: 'nav_invoices',
          category: 'construction',
          netAmount: 1000000,
          vatRate: 0.27,
          vatAmount: 270000,
          vatDate: '2026-01-10',
          currency: 'HUF',
        },
        {
          sourceId: '2',
          sourceTable: 'nav_invoices',
          category: 'construction',
          netAmount: 500000,
          vatRate: 0.27,
          vatAmount: 135000,
          vatDate: '2026-01-15',
          currency: 'HUF',
        },
        {
          sourceId: '3',
          sourceTable: 'invoices',
          category: 'steel',
          netAmount: 800000,
          vatRate: 0.27,
          vatAmount: 216000,
          vatDate: '2026-01-20',
          currency: 'HUF',
        },
        {
          sourceId: '4',
          sourceTable: 'nav_invoices',
          category: null,
          netAmount: 200000,
          vatRate: 0.27,
          vatAmount: 54000,
          vatDate: '2026-01-25',
          currency: 'HUF',
        },
      ];

      const summary = summarizeFadForPeriod(entries);

      expect(summary.entryCount).toBe(4);
      expect(summary.totalNetAmount).toBe(2500000);
      expect(summary.totalVatAmount).toBe(675000);
      expect(summary.byCategory['construction']).toEqual({
        count: 2,
        netAmount: 1500000,
        vatAmount: 405000,
      });
      expect(summary.byCategory['steel']).toEqual({
        count: 1,
        netAmount: 800000,
        vatAmount: 216000,
      });
      expect(summary.byCategory['unknown']).toEqual({
        count: 1,
        netAmount: 200000,
        vatAmount: 54000,
      });
    });

    it('handles empty entries array', () => {
      const summary = summarizeFadForPeriod([]);

      expect(summary.entryCount).toBe(0);
      expect(summary.totalNetAmount).toBe(0);
      expect(summary.totalVatAmount).toBe(0);
      expect(summary.byCategory).toEqual({});
    });
  });
});
