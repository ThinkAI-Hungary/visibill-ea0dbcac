import { describe, it, expect } from 'vitest';
import huAccounty from '@/locales/hu/accounty.json';
import hrAccounty from '@/locales/hr/accounty.json';
import i18n from '@/lib/i18n';

function getAllKeys(obj: Record<string, any>, prefix = ''): string[] {
  return Object.keys(obj).flatMap(key => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      return getAllKeys(obj[key], fullKey);
    }
    return [fullKey];
  });
}

describe('eaisyBooks (Accounty) i18n Dictionary Parity & Quality Suite', () => {
  const huKeys = getAllKeys(huAccounty);
  const hrKeys = getAllKeys(hrAccounty);

  it('maintains 100% key parity between Hungarian and Croatian dictionaries', () => {
    const missingInHr = huKeys.filter(k => !hrKeys.includes(k));
    const missingInHu = hrKeys.filter(k => !huKeys.includes(k));

    expect(missingInHr, `Missing in Croatian accounty.json: ${missingInHr.join(', ')}`).toEqual([]);
    expect(missingInHu, `Missing in Hungarian accounty.json: ${missingInHu.join(', ')}`).toEqual([]);
    expect(huKeys.length).toBeGreaterThan(50);
  });

  it('contains non-empty translations for all Croatian keys', () => {
    for (const key of hrKeys) {
      const parts = key.split('.');
      let current: any = hrAccounty;
      for (const part of parts) {
        current = current?.[part];
      }
      expect(typeof current).toBe('string');
      expect(current.trim().length, `Empty translation for key ${key}`).toBeGreaterThan(0);
    }
  });

  it('resolves translations via i18n instance in both languages', async () => {
    await i18n.changeLanguage('hu');
    const tHu = i18n.getFixedT('hu', 'accounty');
    expect(tHu('nav.items.portfolio')).toBe('Portfólió');
    expect(tHu('portfolio.actions.new_client')).toBe('+ Új ügyfél');
    expect(tHu('status.active')).toBe('Aktív');

    await i18n.changeLanguage('hr');
    const tHr = i18n.getFixedT('hr', 'accounty');
    expect(tHr('nav.items.portfolio')).toBe('Portfelj');
    expect(tHr('portfolio.actions.new_client')).toBe('+ Novi klijent');
    expect(tHr('status.active')).toBe('Aktivan');
  });

  it('correctly handles variable interpolation (e.g. {{count}})', async () => {
    await i18n.changeLanguage('hr');
    const tHr = i18n.getFixedT('hr', 'accounty');
    expect(tHr('header.critical_clients', { count: 3 })).toBe('3 kritičnih klijenata');
    expect(tHr('nav.badges.missing_items', { count: 5 })).toBe('5 nedostaje');
  });
});
