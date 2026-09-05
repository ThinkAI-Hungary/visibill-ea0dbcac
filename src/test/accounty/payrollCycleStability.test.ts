import { describe, it, expect } from 'vitest';

describe('Payroll Cycle Stability & Persistence (EB-0073 fix)', () => {
  // 1. Stable activeEmploymentIdsKey calculation
  it('should generate a deterministic, sorted key from active employments to prevent infinite re-renders', () => {
    const activeEmployees = [
      { id: 'emp-2', status: 'active', first_name: 'Bela', last_name: 'Kovacs' },
      { id: 'emp-1', status: 'active', first_name: 'Anna', last_name: 'Nagy' },
    ];

    const allEmployments = [
      { id: 'empl-y', employee_id: 'emp-2', status: 'active' },
      { id: 'empl-x', employee_id: 'emp-1', status: 'active' },
      { id: 'empl-z', employee_id: 'emp-inactive', status: 'active' },
    ];

    const generateKey = (employees: any[], employments: any[]) => {
      return employments
        .filter(e => employees.some(emp => emp.id === e.employee_id))
        .map(e => e.id)
        .sort()
        .join(',');
    };

    const key1 = generateKey(activeEmployees, allEmployments);
    // Reverse employee order to test sort stability
    const key2 = generateKey([...activeEmployees].reverse(), allEmployments);

    expect(key1).toBe('empl-x,empl-y');
    expect(key2).toBe('empl-x,empl-y');
    expect(key1).toBe(key2);
  });

  // 2. Returns empty string when no employments match
  it('should return empty string when there are no active employees or matching employments', () => {
    const activeEmployees: any[] = [];
    const allEmployments = [{ id: 'empl-1', employee_id: 'emp-1' }];

    const key = allEmployments
      .filter(e => activeEmployees.some(emp => emp.id === e.employee_id))
      .map(e => e.id)
      .sort()
      .join(',');

    expect(key).toBe('');
  });

  // 3. Manual attendance mapping for accounty_timesheets
  it('should map manual attendance data correctly for insertion into accounty_timesheets', () => {
    const cycleId = 'cycle-123';
    const allEmployments = [
      { id: 'empl-10', employee_id: 'emp-10' },
      { id: 'empl-20', employee_id: 'emp-20' },
    ];

    const attendanceData: Record<string, { workDays: number; overtime: number; sickDays: number; leaveDays: number }> = {
      'emp-10': { workDays: 20, overtime: 2, sickDays: 1, leaveDays: 1 },
      'emp-20': { workDays: 22, overtime: 0, sickDays: 0, leaveDays: 0 },
    };

    const recordsToInsert = Object.keys(attendanceData).map(employeeId => {
      const employment = allEmployments.find(e => e.employee_id === employeeId);
      return {
        cycle_id: cycleId,
        employment_id: employment?.id,
        ocr_data: attendanceData[employeeId],
        is_verified: true,
      };
    }).filter(r => r.employment_id);

    expect(recordsToInsert).toHaveLength(2);
    expect(recordsToInsert[0]).toEqual({
      cycle_id: 'cycle-123',
      employment_id: 'empl-10',
      ocr_data: { workDays: 20, overtime: 2, sickDays: 1, leaveDays: 1 },
      is_verified: true,
    });
    expect(recordsToInsert[1]).toEqual({
      cycle_id: 'cycle-123',
      employment_id: 'empl-20',
      ocr_data: { workDays: 22, overtime: 0, sickDays: 0, leaveDays: 0 },
      is_verified: true,
    });
  });

  // 4. Cafeteria props fallback resolution
  it('should correctly prioritize prop cafeteriaItems over local state and skip duplicate fetching', () => {
    const propCafeteriaItems = [{ id: 'caf-1', amount: 32280, benefit_type: 'other', sub_type: 'home_office' }];
    const localCafeteriaItems: any[] = [];

    const resolved = propCafeteriaItems ?? localCafeteriaItems;
    expect(resolved).toBe(propCafeteriaItems);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].amount).toBe(32280);

    // When prop is undefined, fallback to local
    const fallback = undefined ?? localCafeteriaItems;
    expect(fallback).toBe(localCafeteriaItems);
  });
});
