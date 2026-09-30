import { describe, it, expect } from 'vitest';

/**
 * Utility function to sort company/client items in Hungarian alphabetical order (ABC).
 */
export function sortCompaniesAlphabetically<T extends { name?: string | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'hu', { sensitivity: 'base' }));
}

describe('Company Alphabetical Sorting (Hungarian Collation)', () => {
  it('should correctly sort Hungarian company names in ABC order', () => {
    // Exact list of companies from Csejtei Gergő portfolio
    const unsortedCompanies = [
      { id: '1', name: 'DR. BELINSZKAJA GALINA' },
      { id: '2', name: 'MIHÓK ESZTER' },
      { id: '3', name: 'DR. DÓKA ADRIENN' },
      { id: '4', name: 'B. NAGY ERVIN' },
      { id: '5', name: 'Csejtei Gergő' },
      { id: '6', name: 'KÖCSE TAMÁS' },
      { id: '7', name: 'DR. PARÓCZAI CSABA GERGELY' },
      { id: '8', name: 'IMRE VIKTÓRIA' },
      { id: '9', name: 'KISS KORNÉL' },
    ];

    const sorted = sortCompaniesAlphabetically(unsortedCompanies);

    expect(sorted.map(c => c.name)).toEqual([
      'B. NAGY ERVIN',
      'Csejtei Gergő',
      'DR. BELINSZKAJA GALINA',
      'DR. DÓKA ADRIENN',
      'DR. PARÓCZAI CSABA GERGELY',
      'IMRE VIKTÓRIA',
      'KISS KORNÉL',
      'KÖCSE TAMÁS',
      'MIHÓK ESZTER',
    ]);
  });

  it('should handle Hungarian accented vowels (Á, É, Í, Ó, Ö, Ő, Ú, Ü, Ű) properly in base sensitivity', () => {
    const mixed = [
      { name: 'Ökrös Kft.' },
      { name: 'Almási Bt.' },
      { name: 'Ács és Fiai Kft.' },
      { name: 'Óváros Kft.' },
      { name: 'Bognár EV' },
      { name: 'Újhelyi Kft.' },
      { name: 'Építőipari Zrt.' },
    ];

    const sorted = sortCompaniesAlphabetically(mixed);
    // In Hungarian ABC: A/Á, B, E/É, O/Ó/Ö/Ő, U/Ú/Ü/Ű
    expect(sorted[0].name).toMatch(/^(Almási|Ács)/);
    expect(sorted[1].name).toMatch(/^(Almási|Ács)/);
    expect(sorted[2].name).toBe('Bognár EV');
    expect(sorted[3].name).toBe('Építőipari Zrt.');
  });

  it('should gracefully handle null, undefined, or empty names without throwing', () => {
    const withEmpty = [
      { id: '1', name: 'Zebra Kft.' },
      { id: '2', name: null },
      { id: '3', name: 'Alfa Kft.' },
      { id: '4', name: '' },
    ];

    const sorted = sortCompaniesAlphabetically(withEmpty);
    expect(sorted[sorted.length - 1].name).toBe('Zebra Kft.');
    expect(sorted.some(c => c.name === 'Alfa Kft.')).toBe(true);
  });
});
