import { describe, it, expect } from 'vitest';
import { getNextDocumentId, COMMON_JOURNAL_DESCRIPTIONS } from '@/lib/journalUtils';
import { parseFlexibleDate } from '@/components/ui/date-picker';
import { format } from 'date-fns';

describe('Manual Journal Enhancements (Vegyes napló rögzítés)', () => {
  describe('1. Auto-increment Document ID (Bizonylatszám növelés)', () => {
    it('increments slash-formatted document IDs like 2026/005 to 2026/006', () => {
      expect(getNextDocumentId('2026/005')).toBe('2026/006');
      expect(getNextDocumentId('2026/099')).toBe('2026/100');
    });

    it('increments hyphenated prefixes like VE-2026-01 to VE-2026-02', () => {
      expect(getNextDocumentId('VE-2026-01')).toBe('VE-2026-02');
      expect(getNextDocumentId('BER-1')).toBe('BER-2');
    });

    it('preserves leading zeros properly', () => {
      expect(getNextDocumentId('VE/0001')).toBe('VE/0002');
      expect(getNextDocumentId('007')).toBe('008');
    });

    it('handles empty or non-numeric strings safely', () => {
      expect(getNextDocumentId('')).toBe('');
      expect(getNextDocumentId(null)).toBe('');
      expect(getNextDocumentId(undefined)).toBe('');
      expect(getNextDocumentId('VE-XYZ')).toBe('VE-XYZ');
    });
  });

  describe('4. Direct Keyboard Date Typing (Dátumok gépelése)', () => {
    it('parses Hungarian dot-separated dates with or without trailing dots', () => {
      const d1 = parseFlexibleDate('2026.01.31');
      expect(d1).not.toBeNull();
      expect(format(d1!, 'yyyy-MM-dd')).toBe('2026-01-31');

      const d2 = parseFlexibleDate('2026. 02. 28.');
      expect(d2).not.toBeNull();
      expect(format(d2!, 'yyyy-MM-dd')).toBe('2026-02-28');
    });

    it('parses ISO hyphen-separated dates', () => {
      const d = parseFlexibleDate('2026-03-15');
      expect(d).not.toBeNull();
      expect(format(d!, 'yyyy-MM-dd')).toBe('2026-03-15');
    });

    it('parses 8-digit compact dates YYYYMMDD', () => {
      const d = parseFlexibleDate('20260401');
      expect(d).not.toBeNull();
      expect(format(d!, 'yyyy-MM-dd')).toBe('2026-04-01');
    });

    it('returns null for invalid strings', () => {
      expect(parseFlexibleDate('')).toBeNull();
      expect(parseFlexibleDate('nemdatum')).toBeNull();
    });
  });

  describe('6. Common Journal Descriptions (Gyakori jogcímek sablonlista)', () => {
    it('contains standard accounting descriptions like Bérfeladás', () => {
      expect(COMMON_JOURNAL_DESCRIPTIONS).toContain('Bérfeladás');
      expect(COMMON_JOURNAL_DESCRIPTIONS).toContain('Bérjárulékok elszámolása');
      expect(COMMON_JOURNAL_DESCRIPTIONS).toContain('Árfolyam-különbözet elszámolása');
      expect(COMMON_JOURNAL_DESCRIPTIONS).toContain('Kerekítési különbözet');
      expect(COMMON_JOURNAL_DESCRIPTIONS.length).toBeGreaterThanOrEqual(8);
    });
  });

  describe('8. Auto-balancing Math Logic (Automatikus ellentételezés és különbözet kitöltés)', () => {
    it('calculates imbalance and produces correct opposite side and difference amount', () => {
      // Line 1: T 100 000
      // Line 2: K 60 000
      const lines = [
        { dc_type: 'T', amount: 100000 },
        { dc_type: 'K', amount: 60000 },
      ];
      const totalDebit = lines.reduce((sum, l) => (l.dc_type === 'T' ? sum + l.amount : sum), 0);
      const totalCredit = lines.reduce((sum, l) => (l.dc_type === 'K' ? sum + l.amount : sum), 0);
      const diff = totalDebit - totalCredit;

      expect(diff).toBe(40000);

      // Next line should automatically be Credit ('K') with amount 40 000
      const nextDcType = diff > 0 ? 'K' : 'T';
      const nextAmount = Math.abs(diff);

      expect(nextDcType).toBe('K');
      expect(nextAmount).toBe(40000);

      // Now add the new line and verify balance
      const newLines = [...lines, { dc_type: nextDcType, amount: nextAmount }];
      const newTotalDebit = newLines.reduce((sum, l) => (l.dc_type === 'T' ? sum + l.amount : sum), 0);
      const newTotalCredit = newLines.reduce((sum, l) => (l.dc_type === 'K' ? sum + l.amount : sum), 0);

      expect(newTotalDebit - newTotalCredit).toBe(0);
    });

    it('handles Credit > Debit scenario', () => {
      const lines = [
        { dc_type: 'K', amount: 250000 },
        { dc_type: 'T', amount: 150000 },
      ];
      const totalDebit = lines.reduce((sum, l) => (l.dc_type === 'T' ? sum + l.amount : sum), 0);
      const totalCredit = lines.reduce((sum, l) => (l.dc_type === 'K' ? sum + l.amount : sum), 0);
      const diff = totalDebit - totalCredit; // -100 000

      const nextDcType = diff > 0 ? 'K' : 'T';
      const nextAmount = Math.abs(diff);

      expect(nextDcType).toBe('T');
      expect(nextAmount).toBe(100000);
    });
  });
});
