import { describe, it, expect } from 'vitest';
import {
  calculateAgeSupplement,
  calculateChildSupplement,
  calculateDisabledChildSupplement,
  calculateLeaveBalance,
  calculateSickLeave,
  calculateLeavePayout,
  type EmployeeLeaveInput,
} from '../leaveCalculator';

describe('calculateAgeSupplement', () => {
  it('should return 0 for age < 25', () => {
    expect(calculateAgeSupplement(20)).toBe(0);
    expect(calculateAgeSupplement(24)).toBe(0);
  });

  it('should return 1 for age 25-27', () => {
    expect(calculateAgeSupplement(25)).toBe(1);
    expect(calculateAgeSupplement(27)).toBe(1);
  });

  it('should return 5 for age 35-36', () => {
    expect(calculateAgeSupplement(35)).toBe(5);
    expect(calculateAgeSupplement(36)).toBe(5);
  });

  it('should return 10 for age 45+', () => {
    expect(calculateAgeSupplement(45)).toBe(10);
    expect(calculateAgeSupplement(60)).toBe(10);
  });
});

describe('calculateChildSupplement', () => {
  it('should return 0 for no children', () => {
    expect(calculateChildSupplement(0)).toBe(0);
  });

  it('should return 2 for 1 child', () => {
    expect(calculateChildSupplement(1)).toBe(2);
  });

  it('should return 4 for 2 children', () => {
    expect(calculateChildSupplement(2)).toBe(4);
  });

  it('should return 7 for 3+ children', () => {
    expect(calculateChildSupplement(3)).toBe(7);
    expect(calculateChildSupplement(5)).toBe(7);
  });
});

describe('calculateDisabledChildSupplement', () => {
  it('should return 2 per disabled child', () => {
    expect(calculateDisabledChildSupplement(1)).toBe(2);
    expect(calculateDisabledChildSupplement(3)).toBe(6);
  });
});

describe('calculateLeaveBalance', () => {
  const baseInput: EmployeeLeaveInput = {
    ageAtYearStart: 36,
    childrenUnder16: 0,
    disabledChildren: 0,
    carriedOverDays: 0,
    extraLeaveDays: 0,
    year: 2026,
    usedDays: 0,
  };

  it('should calculate base 20 + age supplement for 36 year old', () => {
    const result = calculateLeaveBalance(baseInput);
    expect(result.baseLeave).toBe(20);
    expect(result.ageSupplement).toBe(5); // 35-36 => 5 days
    expect(result.totalAnnual).toBe(25);
    expect(result.remaining).toBe(25);
  });

  it('should include child supplement', () => {
    const result = calculateLeaveBalance({ ...baseInput, childrenUnder16: 2 });
    expect(result.childSupplement).toBe(4);
    expect(result.totalAnnual).toBe(29); // 20 + 5 + 4
  });

  it('should cap carry-over at 60 days', () => {
    const result = calculateLeaveBalance({ ...baseInput, carriedOverDays: 100 });
    expect(result.carriedOver).toBe(60);
    expect(result.totalAvailable).toBe(85); // 25 + 60
  });

  it('should subtract used days', () => {
    const result = calculateLeaveBalance({ ...baseInput, usedDays: 10 });
    expect(result.remaining).toBe(15); // 25 - 10
  });

  it('should not go below 0 remaining', () => {
    const result = calculateLeaveBalance({ ...baseInput, usedDays: 100 });
    expect(result.remaining).toBe(0);
  });

  it('should prorate for partial year employment', () => {
    const result = calculateLeaveBalance({
      ...baseInput,
      employmentStartDate: new Date(2026, 6, 1), // July 1
    });
    expect(result.totalAnnual).toBeLessThan(25); // should be ~12-13
    expect(result.totalAnnual).toBeGreaterThan(0);
  });
});

describe('calculateSickLeave', () => {
  it('should provide 15 days max', () => {
    const result = calculateSickLeave(20000, 0);
    expect(result.availableDays).toBe(15);
    expect(result.remainingDays).toBe(15);
  });

  it('should calculate daily rate at 70%', () => {
    const result = calculateSickLeave(20000, 0);
    expect(result.dailyRate).toBe(14000); // 20000 * 0.7
  });

  it('should track used sick days', () => {
    const result = calculateSickLeave(20000, 10);
    expect(result.remainingDays).toBe(5);
  });

  it('should not go below 0 remaining', () => {
    const result = calculateSickLeave(20000, 20);
    expect(result.remainingDays).toBe(0);
  });
});

describe('calculateLeavePayout', () => {
  it('should calculate payout for remaining days', () => {
    const result = calculateLeavePayout(10, 20000);
    expect(result.daysToPayOut).toBe(10);
    expect(result.payoutAmount).toBe(200000);
  });

  it('should handle 0 remaining days', () => {
    const result = calculateLeavePayout(0, 20000);
    expect(result.payoutAmount).toBe(0);
  });

  it('should handle negative (overused)', () => {
    const result = calculateLeavePayout(-5, 20000);
    expect(result.daysToPayOut).toBe(0);
    expect(result.payoutAmount).toBe(0);
  });
});
