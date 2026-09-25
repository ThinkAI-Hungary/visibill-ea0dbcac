import { describe, it, expect } from 'vitest';
import { fmtEur, fmtVatAmount, formatThousands, type FormRow } from '@/features/vat/types';

describe('Croatian VAT (PDV) Engine & Formatting Suite', () => {
  describe('Croatian Currency & Value Formatting', () => {
    it('formats EUR amounts with 2 decimal places and euro sign', () => {
      expect(fmtEur(1234.56)).toBe('1 234,56 €');
      expect(fmtEur(0)).toBe('0,00 €');
      expect(fmtEur(5)).toBe('5,00 €');
      expect(fmtEur(1000000.89)).toBe('1 000 000,89 €');
    });

    it('handles negative EUR amounts correctly', () => {
      expect(fmtEur(-250.75)).toBe('-250,75 €');
    });

    it('handles null, undefined, or empty values with fallback dash', () => {
      expect(fmtEur(null)).toBe('—');
      expect(fmtEur(undefined)).toBe('—');
      expect(fmtEur('')).toBe('—');
    });

    it('fmtVatAmount formats in EUR for Croatia and in eFt for Hungary', () => {
      expect(fmtVatAmount(2500, true)).toBe('2 500,00 €');
      expect(fmtVatAmount(2500, false)).toBe('2 500 eFt');
    });
  });

  describe('Obrazac PDV Section Calculation Logic', () => {
    // Pure calculation simulation reflecting calculate_croatian_vat_return RPC algorithm
    interface MockPdvAccumulator {
      [row: string]: { base: number; tax: number };
    }

    function calculateMockPdvReturn(rows: MockPdvAccumulator) {
      let totalIBase = 0;
      let totalIIBase = 0;
      let totalIITax = 0;
      let totalIIIBase = 0;
      let totalIIITax = 0;

      for (const [row, data] of Object.entries(rows)) {
        if (row.startsWith('I.')) {
          totalIBase += data.base;
        } else if (row.startsWith('II.')) {
          totalIIBase += data.base;
          totalIITax += data.tax;
        } else if (row.startsWith('III.')) {
          totalIIIBase += data.base;
          totalIIITax += data.tax;
        }
      }

      totalIBase = Math.round(totalIBase * 100) / 100;
      totalIIBase = Math.round(totalIIBase * 100) / 100;
      totalIITax = Math.round(totalIITax * 100) / 100;
      totalIIIBase = Math.round(totalIIIBase * 100) / 100;
      totalIIITax = Math.round(totalIIITax * 100) / 100;

      const netDifference = Math.round((totalIITax - totalIIITax) * 100) / 100;
      const amountToPay = netDifference >= 0 ? netDifference : 0;
      const amountReclaimable = netDifference < 0 ? Math.abs(netDifference) : 0;

      return {
        totalIBase,
        totalIIBase,
        totalIITax,
        totalIIIBase,
        totalIIITax,
        netDifference,
        amountToPay,
        amountReclaimable,
      };
    }

    it('calculates net tax payable when output tax exceeds input pretporez', () => {
      const mockRows: MockPdvAccumulator = {
        'I.1': { base: 500.0, tax: 0 },
        'II.3': { base: 10000.0, tax: 2500.0 }, // 25% outbound
        'II.2': { base: 2000.0, tax: 260.0 },   // 13% outbound
        'III.3': { base: 4000.0, tax: 1000.0 }, // 25% pretporez
        'III.2': { base: 1000.0, tax: 130.0 },  // 13% pretporez
      };

      const result = calculateMockPdvReturn(mockRows);

      expect(result.totalIBase).toBe(500.0);
      expect(result.totalIIBase).toBe(12000.0);
      expect(result.totalIITax).toBe(2760.0);
      expect(result.totalIIIBase).toBe(5000.0);
      expect(result.totalIIITax).toBe(1130.0);

      // Section IV
      expect(result.netDifference).toBe(1630.0);
      expect(result.amountToPay).toBe(1630.0);
      expect(result.amountReclaimable).toBe(0);
    });

    it('calculates refund (povrat) when pretporez exceeds output tax', () => {
      const mockRows: MockPdvAccumulator = {
        'II.3': { base: 2000.0, tax: 500.0 },
        'III.3': { base: 8000.0, tax: 2000.0 },
      };

      const result = calculateMockPdvReturn(mockRows);

      expect(result.totalIITax).toBe(500.0);
      expect(result.totalIIITax).toBe(2000.0);
      expect(result.netDifference).toBe(-1500.0);
      expect(result.amountToPay).toBe(0);
      expect(result.amountReclaimable).toBe(1500.0);
    });

    it('handles domestic reverse charge (tuzemni prijenos) symmetrically on inbound', () => {
      // Inbound reverse charge adds both output tax liability (II.4) and input deduction (III.4)
      const base = 1000.0;
      const tax = 250.0;

      const mockRows: MockPdvAccumulator = {
        'II.4': { base, tax },
        'III.4': { base, tax },
      };

      const result = calculateMockPdvReturn(mockRows);

      expect(result.totalIITax).toBe(250.0);
      expect(result.totalIIITax).toBe(250.0);
      expect(result.netDifference).toBe(0);
      expect(result.amountToPay).toBe(0);
      expect(result.amountReclaimable).toBe(0);
    });
  });

  describe('FormRow Jurisdiction Tagging', () => {
    it('supports country_code field on FormRow metadata', () => {
      const hrRow: FormRow = {
        row_number: 'II.3',
        country_code: 'HR',
        section: 'payable',
        page: 'PDV-1',
        label: 'Isporuke dobara i usluga po stopi 25%',
        has_base: true,
        has_tax: true,
        is_summary: false,
        sort_order: 140,
      };

      const huRow: FormRow = {
        row_number: '07',
        country_code: 'HU',
        section: 'payable',
        page: 'A-01',
        label: '27%-os adómérték alá tartozó értékesítés',
        has_base: true,
        has_tax: true,
        is_summary: false,
        sort_order: 70,
      };

      expect(hrRow.country_code).toBe('HR');
      expect(huRow.country_code).toBe('HU');
      expect(hrRow.page).toBe('PDV-1');
      expect(huRow.page).toBe('A-01');
    });
  });
});
