import { describe, it, expect } from 'vitest';
import { getJurisdictionRules } from '@/hooks/useCompanyJurisdiction';

describe('useCompanyJurisdiction / getJurisdictionRules', () => {
  describe('Hungarian Jurisdiction (HU)', () => {
    it('returns correct rules for explicit HU country code', () => {
      const rules = getJurisdictionRules('HU');
      expect(rules.countryCode).toBe('HU');
      expect(rules.isHungary).toBe(true);
      expect(rules.isCroatia).toBe(false);
      expect(rules.hasNavIntegration).toBe(true);
      expect(rules.taxNumberLabel).toBe('Adószám');
      expect(rules.taxNumberPlaceholder).toBe('12345678-1-23 vagy 12345678');
      expect(rules.defaultCurrency).toBe('HUF');
      expect(rules.vatLabel).toBe('ÁFA');
      expect(rules.countryName).toBe('Magyarország');
      expect(rules.flag).toBe('🇭🇺');
    });

    it('falls back to HU when countryCode is undefined or null', () => {
      const rulesUndefined = getJurisdictionRules(undefined);
      expect(rulesUndefined.countryCode).toBe('HU');
      expect(rulesUndefined.hasNavIntegration).toBe(true);

      const rulesNull = getJurisdictionRules(null);
      expect(rulesNull.countryCode).toBe('HU');
      expect(rulesNull.hasNavIntegration).toBe(true);
    });

    it('falls back to HU for unsupported country codes', () => {
      const rules = getJurisdictionRules('DE');
      expect(rules.countryCode).toBe('HU');
      expect(rules.isHungary).toBe(true);
      expect(rules.hasNavIntegration).toBe(true);
    });
    it('formats currency defaulting to HUF when no currency is specified', () => {
      const rules = getJurisdictionRules('HU');
      const formatted = rules.formatCurrency(1250);
      expect(formatted).toMatch(/(Ft|HUF)/);
    });

    it('formats explicit currency correctly in HU mode', () => {
      const rules = getJurisdictionRules('HU');
      const formatted = rules.formatCurrency(100, 'EUR');
      expect(formatted).toMatch(/(€|EUR)/);
    });
  });

  describe('Croatian Jurisdiction (HR)', () => {
    it('returns correct rules for HR country code', () => {
      const rules = getJurisdictionRules('HR');
      expect(rules.countryCode).toBe('HR');
      expect(rules.isHungary).toBe(false);
      expect(rules.isCroatia).toBe(true);
      expect(rules.hasNavIntegration).toBe(false); // Opció A: NAV integration completely suppressed
      expect(rules.taxNumberLabel).toBe('OIB / Porezni broj');
      expect(rules.taxNumberPlaceholder).toBe('11 számjegyű OIB (pl. 95114485977)');
      expect(rules.defaultCurrency).toBe('EUR');
      expect(rules.vatLabel).toBe('PDV');
      expect(rules.countryName).toBe('Horvátország (Hrvatska)');
      expect(rules.flag).toBe('🇭🇷');
    });

    it('handles lowercase hr string', () => {
      const rules = getJurisdictionRules('hr');
      expect(rules.countryCode).toBe('HR');
      expect(rules.isCroatia).toBe(true);
      expect(rules.hasNavIntegration).toBe(false);
    });

    it('formats currency defaulting to EUR when no currency is specified', () => {
      const rules = getJurisdictionRules('HR');
      const formatted = rules.formatCurrency(1250);
      expect(formatted).toMatch(/(€|EUR)/);
    });

    it('formats explicit currency correctly in HR mode', () => {
      const rules = getJurisdictionRules('HR');
      const formatted = rules.formatCurrency(100000, 'HUF');
      expect(formatted).toMatch(/(Ft|HUF)/);
    });
  });
});

