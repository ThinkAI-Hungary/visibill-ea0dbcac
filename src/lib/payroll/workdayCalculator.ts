/**
 * Hungarian Statutory Workday & Holiday Calculator
 * 
 * Implements Hungarian Labor Code (Mt. 102. § (1)) statutory public holidays
 * and calculates monthly working days and hours for Hungarian payroll.
 */

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
