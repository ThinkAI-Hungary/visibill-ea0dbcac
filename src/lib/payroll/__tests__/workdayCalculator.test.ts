import { describe, it, expect } from 'vitest';
import {
  getEasterSunday,
  getHungarianHolidays,
  getStatutoryWorkDays,
  getStatutoryWorkHours,
  getMonthlyWorkDaysMap,
  isHungarianHoliday,
  isWorkDay,
} from '../workdayCalculator';

describe('workdayCalculator', () => {
  describe('getEasterSunday', () => {
    it('calculates Easter Sunday correctly for known years', () => {
      // 2025: April 20
      expect(getEasterSunday(2025)).toEqual({ month: 4, day: 20 });
      // 2026: April 5
      expect(getEasterSunday(2026)).toEqual({ month: 4, day: 5 });
      // 2027: March 28
      expect(getEasterSunday(2027)).toEqual({ month: 3, day: 28 });
    });
  });

  describe('getHungarianHolidays', () => {
    it('includes all statutory holidays for 2026', () => {
      const holidays = getHungarianHolidays(2026);
      const dates = holidays.map(h => h.date);

      // Fixed holidays
      expect(dates).toContain('2026-01-01'); // Újév
      expect(dates).toContain('2026-03-15'); // Nemzeti ünnep
      expect(dates).toContain('2026-05-01'); // A munka ünnepe
      expect(dates).toContain('2026-08-20'); // Államalapítás
      expect(dates).toContain('2026-10-23'); // 1956-os forradalom
      expect(dates).toContain('2026-11-01'); // Mindenszentek
      expect(dates).toContain('2026-12-25'); // Karácsony 1
      expect(dates).toContain('2026-12-26'); // Karácsony 2

      // Movable holidays for Easter 2026 (April 5)
      expect(dates).toContain('2026-04-03'); // Nagypéntek (Easter - 2)
      expect(dates).toContain('2026-04-06'); // Húsvéthétfő (Easter + 1)
      expect(dates).toContain('2026-05-25'); // Pünkösdhétfő (Easter + 50)
    });
  });

  describe('isHungarianHoliday', () => {
    it('correctly identifies holidays and regular days', () => {
      expect(isHungarianHoliday(2026, 1, 1).isHoliday).toBe(true);
      expect(isHungarianHoliday(2026, 1, 1).name).toBe('Újév');

      expect(isHungarianHoliday(2026, 1, 2).isHoliday).toBe(false);
      expect(isHungarianHoliday(2026, 4, 3).isHoliday).toBe(true); // Nagypéntek
      expect(isHungarianHoliday(2026, 4, 6).isHoliday).toBe(true); // Húsvéthétfő
    });
  });

  describe('getStatutoryWorkDays', () => {
    it('calculates 21 statutory workdays for January 2026 (resolving user issue EB-0148)', () => {
      // 2026 Jan: 31 days, 22 weekdays (Mon-Fri) minus Jan 1 (Újév) = 21 statutory workdays
      const workDays = getStatutoryWorkDays(2026, 1);
      expect(workDays).toBe(21);
    });

    it('calculates expected workdays for other months in 2026', () => {
      // Feb 2026: 28 days, 4 full weeks = 20 workdays
      expect(getStatutoryWorkDays(2026, 2)).toBe(20);

      // Mar 2026: 31 days, 22 weekdays, Mar 15 is Sunday -> 22 workdays
      expect(getStatutoryWorkDays(2026, 3)).toBe(22);

      // Apr 2026: 30 days, 22 weekdays, Good Friday (Apr 3) & Easter Monday (Apr 6) -> 20 workdays
      expect(getStatutoryWorkDays(2026, 4)).toBe(20);

      // May 2026: 31 days, 21 weekdays, May 1 (Fri) & Whit Monday (May 25) -> 19 workdays
      expect(getStatutoryWorkDays(2026, 5)).toBe(19);

      // Aug 2026: 31 days, 21 weekdays, Aug 20 (Thu) -> 20 workdays
      expect(getStatutoryWorkDays(2026, 8)).toBe(20);

      // Oct 2026: 31 days, 22 weekdays, Oct 23 (Fri) -> 21 workdays
      expect(getStatutoryWorkDays(2026, 10)).toBe(21);

      // Nov 2026: 30 days, 21 weekdays, Nov 1 is Sunday -> 21 workdays
      expect(getStatutoryWorkDays(2026, 11)).toBe(21);

      // Dec 2026: 31 days, 23 weekdays, Dec 25 (Fri) is holiday, Dec 26 is Sat -> 22 workdays
      expect(getStatutoryWorkDays(2026, 12)).toBe(22);
    });

    it('falls back safely for invalid inputs', () => {
      expect(getStatutoryWorkDays(0, 0)).toBe(21);
      expect(getStatutoryWorkDays(NaN, 1)).toBe(21);
    });
  });

  describe('getStatutoryWorkHours', () => {
    it('calculates correct statutory hours for 40-hour week in Jan 2026', () => {
      // 21 days * 8 hours = 168 hours
      expect(getStatutoryWorkHours(2026, 1, 40)).toBe(168);
    });

    it('calculates correct statutory hours for 20-hour part-time in Jan 2026', () => {
      // 21 days * 4 hours = 84 hours
      expect(getStatutoryWorkHours(2026, 1, 20)).toBe(84);
    });
  });

  describe('getMonthlyWorkDaysMap', () => {
    it('returns a complete 12-month map summing to 253 workdays for 2026', () => {
      const map = getMonthlyWorkDaysMap(2026);
      expect(Object.keys(map)).toHaveLength(12);
      expect(map[1]).toBe(21);
      expect(map[5]).toBe(19);

      const totalWorkDays = Object.values(map).reduce((sum, d) => sum + d, 0);
      expect(totalWorkDays).toBe(253);
    });
  });

  describe('isWorkDay', () => {
    it('returns true for normal weekdays and false for weekends and holidays', () => {
      // Jan 1 2026 (Thursday) is Újév -> false
      expect(isWorkDay(new Date(2026, 0, 1))).toBe(false);

      // Jan 2 2026 (Friday) is weekday -> true
      expect(isWorkDay(new Date(2026, 0, 2))).toBe(true);

      // Jan 3 2026 (Saturday) -> false
      expect(isWorkDay(new Date(2026, 0, 3))).toBe(false);

      // Jan 4 2026 (Sunday) -> false
      expect(isWorkDay(new Date(2026, 0, 4))).toBe(false);

      // Jan 5 2026 (Monday) -> true
      expect(isWorkDay(new Date(2026, 0, 5))).toBe(true);
    });
  });
});
