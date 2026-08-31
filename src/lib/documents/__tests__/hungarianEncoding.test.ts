import { describe, it, expect } from 'vitest';
import {
  normalizeHungarianForPdf,
  formatHungarianNumber,
  formatHungarianCurrency,
  formatHungarianDate,
  sanitizeCsvCell,
} from '../encoding/hungarianEncoding';

describe('hungarianEncoding', () => {
  describe('normalizeHungarianForPdf', () => {
    it('transliterates double-acute Hungarian characters for Latin-1 Helvetica fonts', () => {
      expect(normalizeHungarianForPdf('Főkönyvi kivonat és bérjegyzék űrlap')).toBe('Fökönyvi kivonat és bérjegyzék ürlap');
      expect(normalizeHungarianForPdf('ŐRZŐ ÉS ŰRHAJÓ')).toBe('ÖRZÖ ÉS ÜRHAJÓ');
    });

    it('preserves single-acute vowels (á, é, í, ó, ö, ú, ü)', () => {
      expect(normalizeHungarianForPdf('árvíztűrő fúrótükörgép')).toBe('árvíztürö fúrótükörgép');
    });

    it('handles null and undefined gracefully', () => {
      expect(normalizeHungarianForPdf(null)).toBe('');
      expect(normalizeHungarianForPdf(undefined)).toBe('');
    });
  });

  describe('formatHungarianNumber', () => {
    it('formats numbers with space separator according to hu-HU locale', () => {
      const formatted = formatHungarianNumber(1250000);
      // Non-breaking space or standard space depending on environment
      expect(formatted.replace(/\s/g, ' ')).toBe('1 250 000');
    });

    it('handles decimals when specified', () => {
      const formatted = formatHungarianNumber(12500.55, 2);
      expect(formatted.replace(/[\s\u00a0\u202f]/g, ' ')).toBe('12 500,55');
    });
  });

  describe('formatHungarianCurrency', () => {
    it('formats amounts with currency symbol', () => {
      const formatted = formatHungarianCurrency(50000, 'HUF');
      expect(formatted.replace(/\s/g, ' ')).toBe('50 000 HUF');
    });
  });

  describe('formatHungarianDate', () => {
    it('formats valid Date instances and strings', () => {
      const formatted = formatHungarianDate('2026-08-31');
      expect(formatted).toBe('2026.08.31.');
    });
  });

  describe('sanitizeCsvCell', () => {
    it('quotes strings and escapes internal quotes', () => {
      expect(sanitizeCsvCell('Hello World')).toBe('"Hello World"');
      expect(sanitizeCsvCell('Hello "Quoted" Text')).toBe('"Hello ""Quoted"" Text"');
      expect(sanitizeCsvCell(null)).toBe('""');
    });
  });
});
