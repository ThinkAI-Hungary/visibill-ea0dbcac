import { describe, it, expect } from 'vitest';
import { fmtBalance, fmtAmount, DenominationRow } from '@/components/petty-cash/types';
import { numberToWordsHu } from '@/lib/documents/templates/cashReceiptTemplate';

describe('Petty Cash Reports & Periodic Closing Unit Tests', () => {
  describe('Denomination Sheet Calculations', () => {
    const HUF_DENOMINATIONS = [20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5];

    function calculateDenominationTotal(rows: { denomination: number; count: number }[]): number {
      return rows.reduce((sum, r) => sum + (r.denomination * (r.count || 0)), 0);
    }

    it('calculates total correctly for standard HUF banknotes and coins', () => {
      const rows: DenominationRow[] = [
        { denomination: 20000, count: 5, subtotal: 100000 },
        { denomination: 10000, count: 3, subtotal: 30000 },
        { denomination: 5000, count: 2, subtotal: 10000 },
        { denomination: 2000, count: 10, subtotal: 20000 },
        { denomination: 1000, count: 15, subtotal: 15000 },
        { denomination: 500, count: 8, subtotal: 4000 },
        { denomination: 200, count: 12, subtotal: 2400 },
        { denomination: 100, count: 25, subtotal: 2500 },
        { denomination: 50, count: 10, subtotal: 500 },
        { denomination: 20, count: 5, subtotal: 100 },
        { denomination: 10, count: 8, subtotal: 80 },
        { denomination: 5, count: 4, subtotal: 20 },
      ];

      const expectedTotal = 100000 + 30000 + 10000 + 20000 + 15000 + 4000 + 2400 + 2500 + 500 + 100 + 80 + 20;
      expect(expectedTotal).toBe(184600);
      expect(calculateDenominationTotal(rows)).toBe(184600);
    });

    it('handles zero count rows correctly', () => {
      const rows: DenominationRow[] = HUF_DENOMINATIONS.map(d => ({
        denomination: d,
        count: 0,
        subtotal: 0,
      }));

      expect(calculateDenominationTotal(rows)).toBe(0);
    });

    it('handles EUR cents calculations without floating point distortion', () => {
      const eurRows: { denomination: number; count: number }[] = [
        { denomination: 50, count: 2 },   // 100
        { denomination: 20, count: 5 },   // 100
        { denomination: 0.5, count: 10 }, // 5.0
        { denomination: 0.2, count: 5 },  // 1.0
        { denomination: 0.05, count: 20 },// 1.0
      ];

      const total = Math.round(eurRows.reduce((sum, r) => sum + r.denomination * r.count, 0) * 100) / 100;
      expect(total).toBe(207.00);
    });
  });

  describe('Closing Difference & Protocol Logic', () => {
    function evaluateClosingDifference(bookBalance: number, actualBalance: number) {
      const diff = Math.round((actualBalance - bookBalance) * 100) / 100;
      let status: 'balanced' | 'shortage' | 'surplus';
      let suggestedAccount: string | null = null;
      let defaultAction: string | null = null;

      if (diff === 0) {
        status = 'balanced';
      } else if (diff < 0) {
        status = 'shortage';
        suggestedAccount = '3681'; // Különféle követelések / pénztárhiány
        defaultAction = 'booked_as_shortage';
      } else {
        status = 'surplus';
        suggestedAccount = '4791'; // Különféle rövid lejáratú kötelezettségek / pénztártöbblet
        defaultAction = 'booked_as_surplus';
      }

      return {
        diff,
        status,
        suggestedAccount,
        defaultAction,
        isJustificationRequired: diff !== 0,
      };
    }

    it('detects balanced closing with zero difference', () => {
      const result = evaluateClosingDifference(150000, 150000);
      expect(result.diff).toBe(0);
      expect(result.status).toBe('balanced');
      expect(result.isJustificationRequired).toBe(false);
      expect(result.suggestedAccount).toBeNull();
    });

    it('detects cash shortage when actual balance is lower than book balance', () => {
      const result = evaluateClosingDifference(150000, 148500);
      expect(result.diff).toBe(-1500);
      expect(result.status).toBe('shortage');
      expect(result.isJustificationRequired).toBe(true);
      expect(result.suggestedAccount).toBe('3681');
      expect(result.defaultAction).toBe('booked_as_shortage');
    });

    it('detects cash surplus when actual balance exceeds book balance', () => {
      const result = evaluateClosingDifference(150000, 152300);
      expect(result.diff).toBe(2300);
      expect(result.status).toBe('surplus');
      expect(result.isJustificationRequired).toBe(true);
      expect(result.suggestedAccount).toBe('4791');
      expect(result.defaultAction).toBe('booked_as_surplus');
    });

    it('validates Sztv. protocol justification rule (minimum 5 characters)', () => {
      const validateProtocol = (reason: string, diff: number) => {
        if (diff === 0) return true;
        return typeof reason === 'string' && reason.trim().length >= 5;
      };

      expect(validateProtocol('', 0)).toBe(true);
      expect(validateProtocol('', -500)).toBe(false);
      expect(validateProtocol('hiba', -500)).toBe(false);
      expect(validateProtocol('Kerekítési eltérés a visszajárókból', -500)).toBe(true);
    });
  });

  describe('Formatting Helpers', () => {
    it('formats HUF balance without decimals', () => {
      expect(fmtBalance(150000, 'HUF')).toContain('150');
      expect(fmtBalance(0, 'HUF')).toContain('0');
      expect(fmtBalance(-2500, 'HUF')).toContain('2');
    });

    it('formats EUR balance with decimals', () => {
      const formatted = fmtBalance(1234.5, 'EUR');
      expect(formatted).toContain('1');
      expect(formatted).toContain('EUR');
    });

    it('formats amount with explicit sign', () => {
      const pos = fmtAmount(5000, 'HUF');
      const neg = fmtAmount(-5000, 'HUF');
      expect(pos).toContain('+');
      expect(neg).toContain('-');
    });
  });

  describe('Hungarian Number to Words (Vouchers)', () => {
    it('converts zero to "nulla"', () => {
      expect(numberToWordsHu(0)).toBe('nulla');
    });

    it('converts single digit numbers', () => {
      expect(numberToWordsHu(1)).toBe('egy forint');
      expect(numberToWordsHu(5)).toBe('öt forint');
    });

    it('converts round thousands and hundreds', () => {
      expect(numberToWordsHu(100)).toBe('száz forint');
      expect(numberToWordsHu(1000)).toBe('ezer forint');
      expect(numberToWordsHu(2000)).toBe('kettőezer forint');
    });

    it('converts compound values', () => {
      const words = numberToWordsHu(150000);
      expect(words).toContain('száz');
      expect(words).toContain('ötven');
      expect(words).toContain('ezer');
    });
  });

  describe('GL Posting Validation Logic', () => {
    interface MockEntry {
      id: string;
      amount: number;
      gl_contra_account?: string | null;
      status: string;
    }

    function validateReportForGlPosting(entries: MockEntry[], status: string) {
      const errors: string[] = [];

      if (status !== 'closed') {
        errors.push('Csak lezárt pénztárjelentés adható fel a főkönyvbe.');
      }

      const activeEntries = entries.filter(e => e.status !== 'cancelled');
      if (activeEntries.length === 0) {
        errors.push('A pénztárjelentés nem tartalmaz könyvelhető aktív tételt.');
      }

      const missingContra = activeEntries.filter(e => !e.gl_contra_account || e.gl_contra_account.trim() === '');
      if (missingContra.length > 0) {
        errors.push(`${missingContra.length} db tételhez hiányzik az ellenszámla (pl. 311, 454, 3681).`);
      }

      return {
        valid: errors.length === 0,
        errors,
        itemsCount: activeEntries.length,
        missingContraCount: missingContra.length,
      };
    }

    it('validates closed report with all contra accounts filled', () => {
      const entries: MockEntry[] = [
        { id: '1', amount: 15000, gl_contra_account: '3111', status: 'confirmed' },
        { id: '2', amount: -4500, gl_contra_account: '4541', status: 'confirmed' },
      ];

      const res = validateReportForGlPosting(entries, 'closed');
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
      expect(res.itemsCount).toBe(2);
      expect(res.missingContraCount).toBe(0);
    });

    it('blocks posting if report is not closed', () => {
      const entries: MockEntry[] = [
        { id: '1', amount: 15000, gl_contra_account: '3111', status: 'confirmed' },
      ];

      const res = validateReportForGlPosting(entries, 'open');
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain('lezárt');
    });

    it('detects missing contra accounts and reports error count', () => {
      const entries: MockEntry[] = [
        { id: '1', amount: 15000, gl_contra_account: '3111', status: 'confirmed' },
        { id: '2', amount: -4500, gl_contra_account: '', status: 'confirmed' },
        { id: '3', amount: -2000, gl_contra_account: undefined, status: 'confirmed' },
      ];

      const res = validateReportForGlPosting(entries, 'closed');
      expect(res.valid).toBe(false);
      expect(res.missingContraCount).toBe(2);
      expect(res.errors[0]).toContain('2 db tételhez hiányzik az ellenszámla');
    });

    it('blocks GL posting if no petty cash journal exists', () => {
      const validateJournalExists = (journalId?: string | null) => {
        if (!journalId) {
          throw new Error('A céghez nem található Pénztár (P) típusú napló a kettős könyvvitelben! Kérjük, hozz létre egy pénztár naplót a Főkönyv Beállításokban a feladás előtt.');
        }
        return true;
      };

      expect(() => validateJournalExists(null)).toThrow('nem található Pénztár (P) típusú napló');
      expect(validateJournalExists('journal-123')).toBe(true);
    });
  });

  describe('Optimistic Concurrency Balance Guard', () => {
    function verifyOptimisticBalance(serverClosingBook: number, clientExpectedBook?: number | null) {
      if (clientExpectedBook !== undefined && clientExpectedBook !== null) {
        if (Math.abs(serverClosingBook - clientExpectedBook) > 0.01) {
          throw new Error(`A könyv szerinti záró egyenleg a számlálás közben megváltozott (eredeti: ${clientExpectedBook}, aktuális: ${serverClosingBook})! Kérjük, nyisd meg újra a varázslót és ellenőrizd az időközben érkezett tételeket.`);
        }
      }
      return true;
    }

    it('allows closing when server and client book balance match', () => {
      expect(verifyOptimisticBalance(150000, 150000)).toBe(true);
    });

    it('blocks closing with concurrency error when balance changed while counting', () => {
      expect(() => verifyOptimisticBalance(130000, 150000)).toThrow('számlálás közben megváltozott');
    });

    it('allows closing when no expected balance was provided (legacy/backward compatibility)', () => {
      expect(verifyOptimisticBalance(150000, null)).toBe(true);
      expect(verifyOptimisticBalance(150000, undefined)).toBe(true);
    });
  });
});
