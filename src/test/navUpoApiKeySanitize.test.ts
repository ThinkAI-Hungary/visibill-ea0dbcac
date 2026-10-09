import { describe, it, expect } from 'vitest';

describe('NAV ÜPO M2M API Key Sanitization & Hyphen Tolerance', () => {
  const sanitize = (raw: string) => raw.replace(/[-\s]/g, '').trim();

  it('accepts raw 40-character continuous API key', () => {
    const raw = 'U3VjYLldpTostHdsoNKLyAxBGX6hqa6i1tdpJmrF';
    const clean = sanitize(raw);
    expect(clean.length).toBe(40);
    expect(clean.slice(0, 10)).toBe('U3VjYLldpT');
    expect(clean.slice(10, 20)).toBe('ostHdsoNKL');
    expect(clean.slice(20, 30)).toBe('yAxBGX6hqa');
    expect(clean.slice(30, 40)).toBe('6i1tdpJmrF');
  });

  it('accepts 43-character API key formatted with 3 hyphens from NAV ÜPO', () => {
    const rawWithHyphens = 'U3VjYLldpT-ostHdsoNKL-yAxBGX6hqa-6i1tdpJmrF';
    const clean = sanitize(rawWithHyphens);
    expect(clean.length).toBe(40);
    expect(clean.slice(0, 10)).toBe('U3VjYLldpT');
    expect(clean.slice(10, 20)).toBe('ostHdsoNKL');
    expect(clean.slice(20, 30)).toBe('yAxBGX6hqa');
    expect(clean.slice(30, 40)).toBe('6i1tdpJmrF');
  });

  it('handles accidental leading/trailing spaces and internal dashes', () => {
    const messy = '  U3VjYLldpT - ostHdsoNKL - yAxBGX6hqa - 6i1tdpJmrF \n';
    const clean = sanitize(messy);
    expect(clean.length).toBe(40);
    expect(clean).toBe('U3VjYLldpTostHdsoNKLyAxBGX6hqa6i1tdpJmrF');
  });

  it('rejects keys that do not produce exactly 40 clean characters', () => {
    expect(sanitize('U3VjYLldpT-ostHdsoNKL-short').length).not.toBe(40);
    expect(sanitize('toolongkeytoolongkeytoolongkeytoolongkeytoolong').length).not.toBe(40);
  });
});
