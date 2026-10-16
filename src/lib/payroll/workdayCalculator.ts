/**
 * Hungarian Statutory Workday & Holiday Calculator
 * 
 * Implements Hungarian Labor Code (Mt. 102. § (1)) statutory public holidays
 * and calculates monthly working days and hours for Hungarian payroll.
 */

import { supportsLeaveAndSickPay, NON_MT_ENTREPRENEUR_TYPES } from './employmentUtils';

export interface HungarianHoliday {
  date: string; // YYYY-MM-DD
  name: string;
  isMovable: boolean;
}

/**
 * Calculates Easter Sunday for a given Gregorian year using the Meeus/Jones/Butcher algorithm.
 */
export function getEasterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

function formatDate(year: number, month: number, day: number): string {
  const m = month < 10 ? `0${month}` : `${month}`;
  const d = day < 10 ? `0${day}` : `${day}`;
  return `${year}-${m}-${d}`;
}

function addDaysToEaster(year: number, easter: { month: number; day: number }, daysToAdd: number): { month: number; day: number } {
  const d = new Date(year, easter.month - 1, easter.day + daysToAdd);
  return {
    month: d.getMonth() + 1,
    day: d.getDate(),
  };
}

/**
 * Returns all statutory public holidays in Hungary for a given year.
 */
export function getHungarianHolidays(year: number): HungarianHoliday[] {
  if (!year || isNaN(year) || year < 1900) {
    return [];
  }

  const easter = getEasterSunday(year);
  const goodFriday = addDaysToEaster(year, easter, -2);
  const easterMonday = addDaysToEaster(year, easter, 1);
  const whitMonday = addDaysToEaster(year, easter, 50);

  return [
    { date: formatDate(year, 1, 1), name: 'Újév', isMovable: false },
    { date: formatDate(year, 3, 15), name: 'Nemzeti ünnep', isMovable: false },
    { date: formatDate(year, goodFriday.month, goodFriday.day), name: 'Nagypéntek', isMovable: true },
    { date: formatDate(year, easterMonday.month, easterMonday.day), name: 'Húsvéthétfő', isMovable: true },
    { date: formatDate(year, 5, 1), name: 'A munka ünnepe', isMovable: false },
    { date: formatDate(year, whitMonday.month, whitMonday.day), name: 'Pünkösdhétfő', isMovable: true },
    { date: formatDate(year, 8, 20), name: 'Államalapítás ünnepe', isMovable: false },
    { date: formatDate(year, 10, 23), name: '1956-os forradalom', isMovable: false },
    { date: formatDate(year, 11, 1), name: 'Mindenszentek', isMovable: false },
    { date: formatDate(year, 12, 25), name: 'Karácsony 1. napja', isMovable: false },
    { date: formatDate(year, 12, 26), name: 'Karácsony 2. napja', isMovable: false },
  ];
}

/**
 * Checks if a specific day is a Hungarian statutory public holiday.
 */
export function isHungarianHoliday(year: number, month: number, day: number): { isHoliday: boolean; name?: string } {
  const dateStr = formatDate(year, month, day);
  const holidays = getHungarianHolidays(year);
  const match = holidays.find(h => h.date === dateStr);
  if (match) {
    return { isHoliday: true, name: match.name };
  }
  return { isHoliday: false };
}

/**
 * Calculates the number of statutory workdays for a given month in Hungary (1-12).
 * Excludes weekends (Saturday & Sunday) and statutory holidays falling on weekdays.
 * 
 * Example: January 2026 has 22 weekdays - 1 holiday (Jan 1 Újév) = 21 workdays.
 */
export function getStatutoryWorkDays(year: number, month: number): number {
  if (!year || !month || isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return 21; // Safe statutory fallback
  }

  const holidays = getHungarianHolidays(year);
  const holidayDateSet = new Set(holidays.map(h => h.date));

  const daysInMonth = new Date(year, month, 0).getDate();
  let workDays = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    // Note: month in JS Date constructor is 0-indexed (0 = Jan, 11 = Dec)
    const dateObj = new Date(year, month - 1, day);
    const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 6 = Saturday

    // Check if weekday (Monday=1 .. Friday=5)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      const dateStr = formatDate(year, month, day);
      if (!holidayDateSet.has(dateStr)) {
        workDays++;
      }
    }
  }

  return workDays;
}

/**
 * Calculates statutory monthly working hours for a given weekly schedule (default 40h/week).
 * (e.g. 21 workdays * 8 hours = 168 hours)
 */
export function getStatutoryWorkHours(year: number, month: number, weeklyHours: number = 40): number {
  const workDays = getStatutoryWorkDays(year, month);
  const dailyHours = (weeklyHours || 40) / 5;
  return Math.round(workDays * dailyHours * 10) / 10;
}

/**
 * Generates a full 12-month map of statutory workdays for a year.
 */
export function getMonthlyWorkDaysMap(year: number): Record<number, number> {
  const map: Record<number, number> = {};
  for (let m = 1; m <= 12; m++) {
    map[m] = getStatutoryWorkDays(year, m);
  }
  return map;
}

/**
 * Checks whether a given Date is a working day (weekday not coinciding with a holiday).
 */
export function isWorkDay(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return false;

  const dayOfWeek = d.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;

  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();

  return !isHungarianHoliday(year, month, day).isHoliday;
}

export function parseLocalDate(date: Date | string): Date {
  if (typeof date === 'string') {
    const parts = date.split('T')[0].split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      return new Date(y, m, d);
    }
    return new Date(date);
  }
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Calculates the number of statutory Hungarian workdays between two dates (inclusive).
 * Takes into account weekdays and Hungarian statutory holidays.
 */
export function getWorkDaysBetween(startDate: Date | string, endDate: Date | string): number {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return 0;

  let count = 0;
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  while (cur <= last) {
    if (isWorkDay(cur)) {
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export interface SalaryProrationInput {
  baseSalary: number;
  salaryType?: 'monthly' | 'hourly' | string | null;
  employmentType?: string | null;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  weeklyHours?: number | string | null;
  cycleYear: number;
  cycleMonth: number;
  workDays?: number | null;
  workedHours?: number | null;
  sickDays?: number | null;
  leaveDays?: number | null;
  overtimeHours?: number | null;
}

export interface SalaryProrationResult {
  isPartialMonth: boolean;
  statutoryWorkDays: number;
  scheduledWorkDaysInPeriod: number;
  daysInMonth: number;
  activeCalendarDays: number;
  dailyHours: number;
  dailyRate: number;
  hourlyRate: number;
  calculatedBase: number;
  calculatedOvertime: number;
  calculatedSickLeave: number;
  calculatedLeave: number;
  isMt: boolean;
  isEv: boolean;
}

/**
 * Számfejtési arányosítás és havi alapbér / pótlékok kalkulátora.
 * 
 * Kezeli:
 * 1. Törthónapokat (hóközi belépés és kilépés)
 * 2. Egyéni vállalkozók (EV) naptári napos arányosítását (Tbj. 41. § (3))
 * 3. Munkaviszony (Mt. 136. §) munkanap-arányosítását és hiányzásait
 * 4. Órabéres elszámolást
 * 5. Mt. vs. Nem-Mt. jogosultságokat (szabadság, betegszabadság, túlóra kizárása EV-nél)
 */
export function calculateProRataSalary(input: SalaryProrationInput): SalaryProrationResult {
  const baseSalary = Number(input.baseSalary || 0);
  const isHourly = input.salaryType === 'hourly';
  const weeklyHours = Number(input.weeklyHours || 40);
  const dailyHours = weeklyHours > 0 ? weeklyHours / 5 : 8;
  const isMt = supportsLeaveAndSickPay(input.employmentType);
  const normalizedType = (input.employmentType || '').toLowerCase().trim();
  const isEv = normalizedType === 'ev' || 
               normalizedType === 'ev_mellekfogl' || 
               normalizedType === 'egyeni_vallalkozo' ||
               NON_MT_ENTREPRENEUR_TYPES.has(normalizedType);

  const year = input.cycleYear;
  const month = input.cycleMonth;
  const statutoryWorkDays = getStatutoryWorkDays(year, month);
  const daysInMonth = new Date(year, month, 0).getDate();

  // Időszaki határok
  const cycleStart = new Date(year, month - 1, 1);
  const cycleEnd = new Date(year, month - 1, daysInMonth);

  const empStart = input.startDate ? parseLocalDate(input.startDate) : cycleStart;
  const empEnd = input.endDate ? parseLocalDate(input.endDate) : cycleEnd;

  const effectiveStart = empStart > cycleStart ? empStart : cycleStart;
  const effectiveEnd = empEnd < cycleEnd ? empEnd : cycleEnd;

  let activeCalendarDays = 0;
  if (effectiveStart <= effectiveEnd) {
    activeCalendarDays = Math.round((effectiveEnd.getTime() - effectiveStart.getTime()) / 86400000) + 1;
  }

  const isPartialMonth = effectiveStart > cycleStart || effectiveEnd < cycleEnd;
  const scheduledWorkDaysInPeriod = isPartialMonth
    ? getWorkDaysBetween(effectiveStart, effectiveEnd)
    : statutoryWorkDays;

  // Órabéres dolgozó
  if (isHourly) {
    const hourlyRate = baseSalary;
    const dailyRate = hourlyRate * dailyHours;
    const actualWorkedHours = (input.workedHours !== undefined && input.workedHours !== null && Number(input.workedHours) > 0)
      ? Number(input.workedHours)
      : (input.workDays !== undefined && input.workDays !== null ? Number(input.workDays) : scheduledWorkDaysInPeriod) * dailyHours;

    const calculatedBase = Math.round(actualWorkedHours * hourlyRate);
    const calculatedOvertime = isMt ? Math.round(hourlyRate * Number(input.overtimeHours || 0) * 1.5) : 0;
    const calculatedSickLeave = isMt ? Math.round(hourlyRate * Number(input.sickDays || 0) * dailyHours * 0.70) : 0;
    const calculatedLeave = isMt ? Math.round(hourlyRate * Number(input.leaveDays || 0) * dailyHours) : 0;

    return {
      isPartialMonth,
      statutoryWorkDays,
      scheduledWorkDaysInPeriod,
      daysInMonth,
      activeCalendarDays,
      dailyHours,
      dailyRate,
      hourlyRate,
      calculatedBase,
      calculatedOvertime,
      calculatedSickLeave,
      calculatedLeave,
      isMt,
      isEv,
    };
  }

  // Havibéres dolgozó
  const dailyRate = statutoryWorkDays > 0 ? (baseSalary / statutoryWorkDays) : 0;
  const hourlyRate = (dailyHours * statutoryWorkDays) > 0 ? (baseSalary / (dailyHours * statutoryWorkDays)) : 0;

  let calculatedBase = baseSalary;
  const effectiveSickDays = isMt ? Number(input.sickDays || 0) : 0;

  if (isPartialMonth) {
    if (isEv) {
      // EV: Tbj. 41. § (3) szerint a naptári biztosítási napok arányában arányosít
      const dayRatio = daysInMonth > 0 ? (activeCalendarDays / daysInMonth) : 1;
      calculatedBase = Math.round(baseSalary * dayRatio);
    } else {
      // Munkaviszony / Mt. 136. §: a hónapra eső törvényes munkanapok arányában arányosít
      const effectiveWorkedDays = input.workDays !== undefined && input.workDays !== null
        ? Number(input.workDays)
        : scheduledWorkDaysInPeriod;
      calculatedBase = Math.round(dailyRate * Math.max(0, effectiveWorkedDays - effectiveSickDays));
    }
  } else {
    // Teljes havi jogviszony
    const effectiveWorkDays = input.workDays !== undefined && input.workDays !== null
      ? Number(input.workDays)
      : statutoryWorkDays;

    if (effectiveWorkDays < statutoryWorkDays) {
      // Igazolatlan vagy fizetés nélküli távollét miatti csökkentés
      const absentDays = statutoryWorkDays - effectiveWorkDays;
      const baseReduction = Math.round(dailyRate * (absentDays + effectiveSickDays));
      calculatedBase = Math.max(0, baseSalary - baseReduction);
    } else {
      const baseReduction = Math.round(dailyRate * effectiveSickDays);
      calculatedBase = Math.max(0, baseSalary - baseReduction);
    }
  }

  const calculatedOvertime = isMt ? Math.round(hourlyRate * Number(input.overtimeHours || 0) * 1.5) : 0;
  const calculatedSickLeave = isMt ? Math.round(dailyRate * effectiveSickDays * 0.70) : 0;
  const calculatedLeave = 0; // Havi bérnél a fizetett szabadság benne van az alapbérben

  return {
    isPartialMonth,
    statutoryWorkDays,
    scheduledWorkDaysInPeriod,
    daysInMonth,
    activeCalendarDays,
    dailyHours,
    dailyRate,
    hourlyRate,
    calculatedBase,
    calculatedOvertime,
    calculatedSickLeave,
    calculatedLeave,
    isMt,
    isEv,
  };
}
