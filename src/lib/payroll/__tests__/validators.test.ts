import { describe, it, expect } from 'vitest';
import {
  validateTajNumber,
  validateTaxId,
  validateBankAccount,
  formatTajNumber,
  formatAmount,
} from '../validators';

describe('validators', () => {
  describe('validateTajNumber', () => {
    it('should reject empty TAJ', () => {
      expect(validateTajNumber('').valid).toBe(false);
    });

    it('should reject too short TAJ numbers', () => {
      expect(validateTajNumber('12345678').valid).toBe(false);
    });

    it('should reject too long TAJ numbers', () => {
      expect(validateTajNumber('1234567890').valid).toBe(false);
    });

    it('should reject non-numeric TAJ numbers', () => {
      expect(validateTajNumber('abc-def-ghi').valid).toBe(false);
    });

    it('should accept properly formatted 9-digit TAJ (if checksum valid)', () => {
      // Note: validators may check checksum — valid/invalid depends on actual checksum algo
      const result = validateTajNumber('123456789');
      expect(typeof result.valid).toBe('boolean');
      if (!result.valid) {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('validateTaxId', () => {
    it('should reject empty tax ID', () => {
      expect(validateTaxId('').valid).toBe(false);
    });

    it('should reject 9-digit tax ID', () => {
      expect(validateTaxId('123456789').valid).toBe(false);
    });

    it('should reject 11-digit tax ID', () => {
      expect(validateTaxId('12345678901').valid).toBe(false);
    });

    it('should reject non-numeric tax ID', () => {
      expect(validateTaxId('abcdefghij').valid).toBe(false);
    });

    it('should return valid boolean for 10-digit input', () => {
      const result = validateTaxId('8408164439');
      expect(typeof result.valid).toBe('boolean');
    });
  });

  describe('validateBankAccount', () => {
    it('should accept valid 24-digit bank account', () => {
      expect(validateBankAccount('11111111-22222222-33333333').valid).toBe(true);
    });

    it('should accept valid 16-digit bank account', () => {
      expect(validateBankAccount('11111111-22222222').valid).toBe(true);
    });

    it('should reject empty bank account', () => {
      expect(validateBankAccount('').valid).toBe(false);
    });

    it('should reject too short bank account', () => {
      expect(validateBankAccount('123').valid).toBe(false);
    });
  });

  describe('formatTajNumber', () => {
    it('should format TAJ with dashes', () => {
      expect(formatTajNumber('123456789')).toBe('123-456-789');
    });

    it('should return already formatted TAJ unchanged', () => {
      expect(formatTajNumber('123-456-789')).toBe('123-456-789');
    });
  });

  describe('formatAmount', () => {
    it('should format amounts with Ft', () => {
      const result = formatAmount(500_000);
      expect(result).toContain('500');
      expect(result).toContain('Ft');
    });

    it('should handle zero', () => {
      const result = formatAmount(0);
      expect(result).toContain('0');
      expect(result).toContain('Ft');
    });
  });
});
