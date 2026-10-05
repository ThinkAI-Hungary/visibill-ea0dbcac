import { describe, it, expect } from 'vitest';
import {
  calculateAgeSupplement,
  calculateChildSupplement,
  calculateDisabledChildSupplement,
  calculateLeaveBalance,
  calculateSickLeave,
  calculateLeavePayout,
  resolveEmployeeLeaveInput,
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

describe('resolveEmployeeLeaveInput (Mt. 116-122. § entitlements)', () => {
  const defaultEmployee = {
    birth_date: '1988-05-15', // 38 years old in 2026 => 6 days age supplement
  };

  it('should return null if employee or birth_date is missing', () => {
    expect(resolveEmployeeLeaveInput({ employee: null })).toBeNull();
    expect(resolveEmployeeLeaveInput({ employee: { birth_date: null } })).toBeNull();
  });

  it('should resolve age and age-based supplement automatically (Mt. 117. §)', () => {
    const input = resolveEmployeeLeaveInput({
      employee: { birth_date: '1990-01-01' }, // 36 years old in 2026
      targetYear: 2026,
    });
    expect(input).not.toBeNull();
    expect(input?.ageAtYearStart).toBe(36);
    expect(input?.childrenUnder16).toBe(0);
    expect(input?.extraLeaveDays).toBe(0);

    const balance = calculateLeaveBalance(input!);
    expect(balance.baseLeave).toBe(20);
    expect(balance.ageSupplement).toBe(5);
    expect(balance.childSupplement).toBe(0);
    expect(balance.totalAnnual).toBe(25);
  });

  it('should count children under 16 from dependents table (Mt. 118. §)', () => {
    const input = resolveEmployeeLeaveInput({
      employee: defaultEmployee,
      targetYear: 2026,
      dependents: [
        { birth_date: '2015-04-10', is_fetus: false }, // 11 years old -> valid
        { birth_date: '2018-09-20', is_fetus: false }, // 8 years old -> valid
        { birth_date: '2005-01-01', is_fetus: false }, // 21 years old -> over 16, excluded
        { birth_date: null, is_fetus: true },          // fetus -> excluded
      ],
    });

    expect(input?.childrenUnder16).toBe(2);

    const balance = calculateLeaveBalance(input!);
    expect(balance.childSupplement).toBe(4); // 2 children => 4 days
    expect(balance.totalAnnual).toBe(20 + 6 + 4); // 30 days
  });

  it('should fallback to active family declaration children array when dependents table is empty', () => {
    const input = resolveEmployeeLeaveInput({
      employee: defaultEmployee,
      targetYear: 2026,
      dependents: [],
      declarations: [
        {
          declaration_type: 'family',
          status: 'active',
          parameters: {
            children: [
              { birth_name: 'Gyermek 1', birth_date: '2016-01-01', is_fetus: false },
              { birth_name: 'Gyermek 2', birth_date: '2019-05-10', is_fetus: false },
              { birth_name: 'Gyermek 3', birth_date: '2022-11-25', is_fetus: false },
            ],
          },
        },
      ],
    });

    expect(input?.childrenUnder16).toBe(3);

    const balance = calculateLeaveBalance(input!);
    expect(balance.childSupplement).toBe(7); // 3 children => 7 days
    expect(balance.totalAnnual).toBe(20 + 6 + 7); // 33 days
  });

  it('should fallback to active family declaration children_count when children list is not provided', () => {
    const input = resolveEmployeeLeaveInput({
      employee: defaultEmployee,
      targetYear: 2026,
      dependents: [],
      declarations: [
        {
          declaration_type: 'family',
          status: 'active',
          parameters: {
            children_count: 1,
          },
        },
      ],
    });

    expect(input?.childrenUnder16).toBe(1);

    const balance = calculateLeaveBalance(input!);
    expect(balance.childSupplement).toBe(2); // 1 child => 2 days
  });

  it('should handle disabled children supplement (Mt. 118. § (2))', () => {
    const input = resolveEmployeeLeaveInput({
      employee: defaultEmployee,
      targetYear: 2026,
      dependents: [
        { birth_date: '2015-01-01', is_fetus: false, is_disabled: true },
        { birth_date: '2018-01-01', is_fetus: false, disabled: false },
      ],
    });

    expect(input?.childrenUnder16).toBe(2);
    expect(input?.disabledChildren).toBe(1);

    const balance = calculateLeaveBalance(input!);
    expect(balance.childSupplement).toBe(4);
    expect(balance.disabledChildSupplement).toBe(2); // +2 days per disabled child
    expect(balance.totalAnnual).toBe(20 + 6 + 4 + 2); // 32 days
  });

  it('should handle disabled children from active family/child_leave declaration when dependents table is empty', () => {
    const input = resolveEmployeeLeaveInput({
      employee: defaultEmployee,
      targetYear: 2026,
      dependents: [],
      declarations: [
        {
          declaration_type: 'child_leave',
          status: 'active',
          parameters: {
            children: [
              { birth_name: 'Gyermek 1', birth_date: '2016-01-01', is_fetus: false, is_disabled: true },
              { birth_name: 'Gyermek 2', birth_date: '2019-05-10', is_fetus: false, is_disabled: false },
            ],
          },
        },
      ],
    });

    expect(input?.childrenUnder16).toBe(2);
    expect(input?.disabledChildren).toBe(1);

    const balance = calculateLeaveBalance(input!);
    expect(balance.childSupplement).toBe(4); // 2 children => 4 days
    expect(balance.disabledChildSupplement).toBe(2); // 1 disabled child => +2 days
    expect(balance.totalAnnual).toBe(20 + 6 + 4 + 2); // 32 days
  });

  it('should not count disabled children over 16 years old (Mt. 118. § (3))', () => {
    const input = resolveEmployeeLeaveInput({
      employee: defaultEmployee,
      targetYear: 2026,
      dependents: [
        // Born in 2008: 2026 - 2008 = 18 > 16 -> NOT eligible
        { birth_date: '2008-05-10', is_disabled: true, is_fetus: false },
        // Born in 2010: 2026 - 2010 = 16 <= 16 -> eligible
        { birth_date: '2010-03-15', is_disabled: true, is_fetus: false },
      ],
      declarations: [],
    });

    expect(input?.childrenUnder16).toBe(1);
    expect(input?.disabledChildren).toBe(1);

    const balance = calculateLeaveBalance(input!);
    expect(balance.childSupplement).toBe(2); // 1 eligible child => 2 days
    expect(balance.disabledChildSupplement).toBe(2); // 1 eligible disabled child => +2 days
  });

  it('should prioritize the newest declaration by valid_from when multiple active declarations exist', () => {
    const input = resolveEmployeeLeaveInput({
      employee: defaultEmployee,
      targetYear: 2026,
      dependents: [],
      declarations: [
        {
          declaration_type: 'family',
          status: 'active',
          valid_from: '2025-01-01',
          parameters: {
            children: [
              { birth_name: 'Gyermek Régi', birth_date: '2020-01-01', is_fetus: false, is_disabled: false },
            ],
          },
        },
        {
          declaration_type: 'child_leave',
          status: 'active',
          valid_from: '2026-01-01',
          parameters: {
            children: [
              { birth_name: 'Gyermek Új 1', birth_date: '2020-01-01', is_fetus: false, is_disabled: true },
              { birth_name: 'Gyermek Új 2', birth_date: '2022-01-01', is_fetus: false, is_disabled: false },
            ],
          },
        },
      ],
    });

    expect(input?.childrenUnder16).toBe(2);
    expect(input?.disabledChildren).toBe(1);
  });

  it('should grant 5 extra leave days for personal disability declaration (Mt. 120. §)', () => {
    const input = resolveEmployeeLeaveInput({
      employee: defaultEmployee,
      targetYear: 2026,
      declarations: [
        { declaration_type: 'personal', status: 'active' },
      ],
    });

    expect(input?.extraLeaveDays).toBe(5);

    const balance = calculateLeaveBalance(input!);
    expect(balance.extraLeave).toBe(5);
    expect(balance.totalAnnual).toBe(20 + 6 + 5); // 31 days
  });

  it('should sum used leave days for annual and additional_* leave types', () => {
    const input = resolveEmployeeLeaveInput({
      employee: defaultEmployee,
      targetYear: 2026,
      leaves: [
        { leave_type: 'annual', status: 'approved', days: 5 },
        { leave_type: 'additional_child', status: 'approved', days: 2 },
        { leave_type: 'annual', status: 'pending', days: 3 }, // not approved -> excluded
        { leave_type: 'sick', status: 'approved', days: 4 },   // sick leave -> excluded from annual
      ],
    });

    expect(input?.usedDays).toBe(7); // 5 + 2

    const balance = calculateLeaveBalance(input!);
    expect(balance.used).toBe(7);
    expect(balance.remaining).toBe(26 - 7); // 20 + 6 = 26; 26 - 7 = 19
  });

  it('should calculate 45 days leave for vocational students (Szkt. 84. § (6))', () => {
    const input = resolveEmployeeLeaveInput({
      employee: {
        id: 'emp-vocational',
        birth_date: '2006-05-10', // 20 years old
      },
      primaryEmployment: {
        id: 'employment-vocational',
        job_code: '1131', // Szakképzési munkaszerződés
        weekly_hours: 40,
      },
      targetYear: 2026,
    });

    expect(input?.isVocationalStudent).toBe(true);

    const balance = calculateLeaveBalance(input!);
    expect(balance.baseLeave).toBe(45);
    expect(balance.totalAnnual).toBe(45);
    expect(balance.remaining).toBe(45);
    expect(balance.baseLeaveHours).toBe(45 * 8);
  });

  it('should recognize code 120 as vocational student from NAV 08 import', () => {
    const input = resolveEmployeeLeaveInput({
      employee: {
        id: 'emp-voc-120',
        birth_date: '2007-02-15',
      },
      primaryEmployment: {
        id: 'employment-voc-120',
        job_code: '120',
        weekly_hours: 40,
      },
      targetYear: 2026,
    });

    expect(input?.isVocationalStudent).toBe(true);

    const balance = calculateLeaveBalance(input!);
    expect(balance.baseLeave).toBe(45);
    expect(balance.totalAnnual).toBe(45);
  });
});


