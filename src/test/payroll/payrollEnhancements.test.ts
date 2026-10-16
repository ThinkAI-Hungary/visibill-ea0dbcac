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
import { calculateProRataSalary } from '@/lib/payroll/workdayCalculator';
import { resolveEmployeeLeaveInput } from '@/lib/payroll/leaveCalculator';

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
    expect(validateBirthDate(dateStr).valid).toBe(true);
  });
});

describe('Tört havi Bérarányosítás (calculateProRataSalary)', () => {
  it('Egyéni vállalkozónál naptári napok arányában arányosít (Tbj. 41. § (3)) — Kilner Gábor eset', () => {
    // 2026. szeptember (30 napos hónap)
    // Kezdés: 2026-09-15 -> 16 aktív naptári nap
    // Havi alapbér: 373 200 Ft
    // Arányosított bér: 373 200 * (16 / 30) = 199 040 Ft
    const result = calculateProRataSalary({
      baseSalary: 373200,
      salaryType: 'monthly',
      employmentType: 'ev',
      startDate: '2026-09-15',
      cycleYear: 2026,
      cycleMonth: 9,
      workDays: 12,
      sickDays: 2, // Nem-Mt esetén nem vonhat le
      leaveDays: 3, // Nem-Mt esetén nem vehet igénybe
      overtimeHours: 10, // Nem-Mt esetén nincs Mt. szerinti túlóra
    });

    expect(result.isPartialMonth).toBe(true);
    expect(result.isEv).toBe(true);
    expect(result.isMt).toBe(false);
    expect(result.daysInMonth).toBe(30);
    expect(result.activeCalendarDays).toBe(16);
    expect(result.calculatedBase).toBe(199040);
    expect(result.calculatedOvertime).toBe(0);
    expect(result.calculatedSickLeave).toBe(0);
    expect(result.calculatedLeave).toBe(0);
  });

  it('Normál munkaviszonynál törvényes munkanapok arányában arányosít (Mt. 136. §)', () => {
    // 2026. szeptember (22 törvényes munkanap)
    // Kezdés: 2026-09-15 (12 munkanap esik szeptember 15 és 30 közé)
    // Havi alapbér: 373 200 Ft -> napi bér: 373 200 / 22 = 16 963.636 Ft
    // 12 munkanapra: 16 963.636 * 12 = 203 564 Ft
    const result = calculateProRataSalary({
      baseSalary: 373200,
      salaryType: 'monthly',
      employmentType: 'munkaviszony',
      startDate: '2026-09-15',
      cycleYear: 2026,
      cycleMonth: 9,
      workDays: 12,
      overtimeHours: 4,
    });

    expect(result.isPartialMonth).toBe(true);
    expect(result.isMt).toBe(true);
    expect(result.isEv).toBe(false);
    expect(result.statutoryWorkDays).toBe(22);
    expect(result.scheduledWorkDaysInPeriod).toBe(12);
    expect(result.calculatedBase).toBe(203564);
    expect(result.calculatedOvertime).toBeGreaterThan(0);
  });

  it('Teljes havi jogviszony esetén a teljes alapbért számolja', () => {
    const result = calculateProRataSalary({
      baseSalary: 373200,
      salaryType: 'monthly',
      employmentType: 'ev',
      startDate: '2026-01-01',
      cycleYear: 2026,
      cycleMonth: 9,
      workDays: 22,
    });

    expect(result.isPartialMonth).toBe(false);
    expect(result.calculatedBase).toBe(373200);
  });
});

describe('Szabadságkeret Kezelés Jogviszony szerint (resolveEmployeeLeaveInput)', () => {
  const dummyEmployee = {
    id: 'emp-1',
    birth_date: '1990-05-15',
    first_name: 'Gábor',
    last_name: 'Kilner',
  };

  it('Egyéni vállalkozó (EV) esetén null-t ad vissza, nincs szabadságkeret', () => {
    const leaveInput = resolveEmployeeLeaveInput({
      employee: dummyEmployee,
      primaryEmployment: {
        employment_type: 'ev',
        start_date: '2026-09-15',
      },
      targetYear: 2026,
    });

    expect(leaveInput).toBeNull();
  });

  it('Társas vállalkozó és Megbízás esetén is null-t ad vissza', () => {
    expect(resolveEmployeeLeaveInput({
      employee: dummyEmployee,
      primaryEmployment: { employment_type: 'tarsas_vallalkozo' },
      targetYear: 2026,
    })).toBeNull();

    expect(resolveEmployeeLeaveInput({
      employee: dummyEmployee,
      primaryEmployment: { employment_type: 'megbizas' },
      targetYear: 2026,
    })).toBeNull();
  });

  it('Munkaviszony esetén kiszámolja a szabadság inputot', () => {
    const leaveInput = resolveEmployeeLeaveInput({
      employee: dummyEmployee,
      primaryEmployment: {
        employment_type: 'munkaviszony',
        weekly_hours: 40,
        start_date: '2026-01-01',
      },
      targetYear: 2026,
    });

    expect(leaveInput).not.toBeNull();
    expect(leaveInput?.ageAtYearStart).toBe(36);
  });
});

