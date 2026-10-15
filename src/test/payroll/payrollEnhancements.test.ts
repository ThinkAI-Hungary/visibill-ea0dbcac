import { describe, it, expect } from 'vitest';
import {
  isMtEmployment,
  supportsLeaveAndSickPay,
  getNonMtNotice,
} from '@/lib/payroll/employmentUtils';
import {
  calculateHourlyBaseRate,
  calculateNightShiftPremiumFromHours,
} from '@/lib/payroll/premiumCalculator';
import { validateBirthDate } from '@/lib/payroll/validators';

describe('Bérszámfejtés Jogviszony és Szabadság Kezelés (employmentUtils)', () => {
  it('helyesen azonosítja a munkaviszonyos (Mt.) foglalkoztatási formákat', () => {
    expect(isMtEmployment('munkaviszony')).toBe(true);
    expect(isMtEmployment('reszmunkaido')).toBe(true);
    expect(isMtEmployment('hatarozott')).toBe(true);
    expect(isMtEmployment('tavmunka')).toBe(true);
    expect(isMtEmployment('szakkepzes')).toBe(true);
  });

  it('helyesen azonosítja a nem-Mt. jogviszonyokat (EV, Társas vállalkozó, Megbízás)', () => {
    expect(isMtEmployment('ev')).toBe(false);
    expect(isMtEmployment('ev_mellekfogl')).toBe(false);
    expect(isMtEmployment('egyeni_vallalkozo')).toBe(false);
    expect(isMtEmployment('tarsas_vallalkozo')).toBe(false);
    expect(isMtEmployment('megbizas')).toBe(false);
    expect(isMtEmployment('valasztott_tisztsegviselo')).toBe(false);
  });

  it('supportsLeaveAndSickPay kizárólag Mt. munkaviszony esetén igaz', () => {
    expect(supportsLeaveAndSickPay('munkaviszony')).toBe(true);
    expect(supportsLeaveAndSickPay('reszmunkaido')).toBe(true);
    expect(supportsLeaveAndSickPay('ev')).toBe(false);
    expect(supportsLeaveAndSickPay('megbizas')).toBe(false);
    expect(supportsLeaveAndSickPay('tarsas_vallalkozo')).toBe(false);
  });

  it('getNonMtNotice megfelelő jogi tájékoztató szöveget ad', () => {
    const evNotice = getNonMtNotice('ev');
    expect(evNotice).toContain('Egyéni vállalkozó');
    expect(evNotice).toContain('nem értelmezett az Mt.');

    const megbizasNotice = getNonMtNotice('megbizas');
    expect(megbizasNotice).toContain('Megbízási');
    expect(megbizasNotice).toContain('Ptk.');

    expect(getNonMtNotice('munkaviszony')).toBeNull();
  });
});

describe('Bérszámfejtés Éjszakai Pótlék Számítás (Mt. 142. §)', () => {
  it('törvényes 174 órás osztóval számolja az egyórára eső alapbért heti 40 órára (Mt. 136. § (3) b))', () => {
    // 348 000 Ft havi bérnél heti 40 órára az órabér: 348000 / 174 = 2000 Ft/óra
    const hourlyRate = calculateHourlyBaseRate(348000, 40);
    expect(hourlyRate).toBe(2000);
  });

  it('részmunkaidőnél az arányosított osztót alkalmazza (pl. 20 órára 87 órás osztó)', () => {
    // 174000 Ft havi bér heti 20 órára: 174000 / (174 * 0.5) = 174000 / 87 = 2000 Ft/óra
    const hourlyRate = calculateHourlyBaseRate(174000, 20);
    expect(hourlyRate).toBe(2000);
  });

  it('pontosan számolja a 15%-os éjszakai pótlékot ledolgozott órák alapján', () => {
    // Alapbér: 348 000 Ft (2000 Ft/óra alapbér)
    // 10 óra éjszakai munka -> 10 * 2000 * 0.15 = 3000 Ft pótlék
    const res = calculateNightShiftPremiumFromHours(10, 348000, 40);
    expect(res.amount).toBe(3000);
    expect(res.hourlyRate).toBe(2000);
    expect(res.hours).toBe(10);
  });

  it('törtórákra (pl. 7.5 óra) és kerekítésre is helyesen működik', () => {
    // 348 000 Ft alapbér (2000 Ft/óra)
    // 7.5 óra éjszakai munka -> 7.5 * 2000 * 0.15 = 2250 Ft
    const res = calculateNightShiftPremiumFromHours(7.5, 348000, 40);
    expect(res.amount).toBe(2250);
    expect(res.hourlyRate).toBe(2000);
    expect(res.hours).toBe(7.5);
  });

  it('0 óra vagy érvénytelen input esetén 0 Ft-ot ad vissza', () => {
    expect(calculateNightShiftPremiumFromHours(0, 348000, 40).amount).toBe(0);
    expect(calculateNightShiftPremiumFromHours(-5, 348000, 40).amount).toBe(0);
    expect(calculateNightShiftPremiumFromHours(10, 0, 40).amount).toBe(0);
  });
});

describe('Bérszámfejtés Születési Dátum Validáció (Mt. 34. §)', () => {
  it('elfogadja a felnőtt munkavállaló érvényes születési dátumát', () => {
    expect(validateBirthDate('1985-06-15').valid).toBe(true);
    expect(validateBirthDate('1970-01-01').valid).toBe(true);
    expect(validateBirthDate('2000-12-31').valid).toBe(true);
  });

  it('elfogadja az üres vagy kitöltetlen születési dátumot (opcionális mező)', () => {
    expect(validateBirthDate('').valid).toBe(true);
    expect(validateBirthDate(null).valid).toBe(true);
    expect(validateBirthDate(undefined).valid).toBe(true);
  });

  it('elutasítja a jövőbeli születési dátumot', () => {
    const futureYear = new Date().getFullYear() + 1;
    const result = validateBirthDate(`${futureYear}-01-01`);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('A születési dátum nem lehet a jövőben');
  });

  it('elutasítja az érvénytelen dátumformátumot', () => {
    const result = validateBirthDate('nem-datum');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Érvénytelen születési dátum');
  });

  it('elutasítja a 15 év alatti életkort az Mt. 34. § alapján', () => {
    const today = new Date();
    // 10 éves gyerek születési dátuma
    const tenYearsAgo = new Date(today.getFullYear() - 10, today.getMonth(), today.getDate());
    const dateStr = tenYearsAgo.toISOString().split('T')[0];
    const result = validateBirthDate(dateStr);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Mt. 34. §');
    expect(result.error).toContain('15. életévét');
  });

  it('elfogadja a 15. életévét betöltött munkavállalót (iskolai szünetes diák)', () => {
    const today = new Date();
    // Pontosan 15 évvel ezelőtt született
    const fifteenYearsAgo = new Date(today.getFullYear() - 15, today.getMonth(), today.getDate() - 1);
    const dateStr = fifteenYearsAgo.toISOString().split('T')[0];
    const result = validateBirthDate(dateStr);
    expect(result.valid).toBe(true);
  });

  it('elfogadja a 16. életévét betöltött munkavállalót (általános munkavállalási kor)', () => {
    const today = new Date();
    const sixteenYearsAgo = new Date(today.getFullYear() - 16, today.getMonth(), today.getDate());
    const dateStr = sixteenYearsAgo.toISOString().split('T')[0];
    const result = validateBirthDate(dateStr);
    expect(result.valid).toBe(true);
  });
});
