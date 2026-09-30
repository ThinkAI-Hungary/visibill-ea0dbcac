import { describe, it, expect } from 'vitest';
import { getFeorTitle, formatJobTitleWithFeor, FEOR_DICTIONARY } from '../feorCodes';

describe('FEOR-08 Dictionary and Formatting (EB-0230)', () => {
  it('should find official Hungarian titles for standard FEOR codes', () => {
    expect(getFeorTitle('4112')).toBe('Általános irodai adminisztrátor');
    expect(getFeorTitle('4121')).toBe('Könyvelő (számviteli ügyintéző)');
    expect(getFeorTitle('1138')).toBe('Egyszerűsített foglalkoztatott (EFO alkalmi munka)');
    expect(getFeorTitle('2132')).toBe('Alkalmazásprogramozó');
    expect(getFeorTitle('9112')).toBe('Intézményi takarító és kisegítő');
  });

  it('should handle whitespace in FEOR code lookup', () => {
    expect(getFeorTitle(' 4112 ')).toBe('Általános irodai adminisztrátor');
  });

  it('should return null for unknown or empty FEOR codes', () => {
    expect(getFeorTitle(null)).toBeNull();
    expect(getFeorTitle('')).toBeNull();
    expect(getFeorTitle('999999')).toBeNull();
  });

  it('formatJobTitleWithFeor should prioritize custom job title when present', () => {
    expect(formatJobTitleWithFeor('Vezető Könyvelő', '4121')).toBe('Vezető Könyvelő');
  });

  it('formatJobTitleWithFeor should fallback to FEOR dictionary name with code when jobTitle is null', () => {
    expect(formatJobTitleWithFeor(null, '4112')).toBe('Általános irodai adminisztrátor (FEOR 4112)');
    expect(formatJobTitleWithFeor('', '4121')).toBe('Könyvelő (számviteli ügyintéző) (FEOR 4121)');
  });

  it('formatJobTitleWithFeor should return FEOR: code when code is not in dictionary', () => {
    expect(formatJobTitleWithFeor(null, '8888')).toBe('FEOR: 8888');
  });

  it('formatJobTitleWithFeor should return dash when both are empty', () => {
    expect(formatJobTitleWithFeor(null, null)).toBe('–');
    expect(formatJobTitleWithFeor('', '')).toBe('–');
  });
});
