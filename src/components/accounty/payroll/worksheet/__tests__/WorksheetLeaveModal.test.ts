import { describe, it, expect } from 'vitest';
import { calculateWorkingDays, hasLeaveOverlap } from '../WorksheetLeaveModal';

describe('calculateWorkingDays', () => {
  it('should return 0 for empty or invalid inputs', () => {
    expect(calculateWorkingDays('', '')).toBe(0);
    expect(calculateWorkingDays('invalid', 'dates')).toBe(0);
    expect(calculateWorkingDays('2026-10-10', '2026-10-05')).toBe(0); // start > end
  });

  it('should count weekdays correctly within a single week (Mon-Fri)', () => {
    // 2026-10-05 is Monday, 2026-10-09 is Friday
    const days = calculateWorkingDays('2026-10-05', '2026-10-09');
    expect(days).toBe(5);
  });

  it('should skip weekend days (Saturday & Sunday)', () => {
    // 2026-10-09 is Friday, 2026-10-12 is Monday (Fri, Sat, Sun, Mon)
    const days = calculateWorkingDays('2026-10-09', '2026-10-12');
    expect(days).toBe(2); // Friday and Monday only
  });

  it('should return 0 if range is only Saturday and Sunday', () => {
    // 2026-10-10 is Saturday, 2026-10-11 is Sunday
    const days = calculateWorkingDays('2026-10-10', '2026-10-11');
    expect(days).toBe(0);
  });

  it('should count 1 day if start and end is the same working day', () => {
    // 2026-10-05 is Monday
    expect(calculateWorkingDays('2026-10-05', '2026-10-05')).toBe(1);
    // 2026-10-10 is Saturday
    expect(calculateWorkingDays('2026-10-10', '2026-10-10')).toBe(0);
  });
});

describe('hasLeaveOverlap', () => {
  const existingLeaves = [
    { id: '1', start_date: '2026-10-05', end_date: '2026-10-09' },
    { id: '2', start_date: '2026-10-20', end_date: '2026-10-22' },
  ];

  it('should return false when there are no existing leaves', () => {
    expect(hasLeaveOverlap('2026-10-05', '2026-10-09', []).hasOverlap).toBe(false);
  });

  it('should return false when new range is completely before existing leaves', () => {
    // 2026-10-01 to 2026-10-04 is before 2026-10-05
    const res = hasLeaveOverlap('2026-10-01', '2026-10-04', existingLeaves);
    expect(res.hasOverlap).toBe(false);
  });

  it('should return false when new range is in between existing leaves', () => {
    // 2026-10-12 to 2026-10-16 is between 2026-10-09 and 2026-10-20
    const res = hasLeaveOverlap('2026-10-12', '2026-10-16', existingLeaves);
    expect(res.hasOverlap).toBe(false);
  });

  it('should return true when new range overlaps partially at the start', () => {
    // 2026-10-01 to 2026-10-06 overlaps with 2026-10-05..2026-10-09
    const res = hasLeaveOverlap('2026-10-01', '2026-10-06', existingLeaves);
    expect(res.hasOverlap).toBe(true);
    expect(res.overlappingLeave?.id).toBe('1');
  });

  it('should return true when new range overlaps partially at the end', () => {
    // 2026-10-08 to 2026-10-12 overlaps with 2026-10-05..2026-10-09
    const res = hasLeaveOverlap('2026-10-08', '2026-10-12', existingLeaves);
    expect(res.hasOverlap).toBe(true);
    expect(res.overlappingLeave?.id).toBe('1');
  });

  it('should return true when new range is an exact duplicate', () => {
    const res = hasLeaveOverlap('2026-10-05', '2026-10-09', existingLeaves);
    expect(res.hasOverlap).toBe(true);
    expect(res.overlappingLeave?.id).toBe('1');
  });

  it('should return true when new range is completely inside existing range', () => {
    // 2026-10-06 to 2026-10-07 is inside 2026-10-05..2026-10-09
    const res = hasLeaveOverlap('2026-10-06', '2026-10-07', existingLeaves);
    expect(res.hasOverlap).toBe(true);
    expect(res.overlappingLeave?.id).toBe('1');
  });

  it('should return true when new range completely engulfs existing range', () => {
    // 2026-10-01 to 2026-10-15 engulfs 2026-10-05..2026-10-09
    const res = hasLeaveOverlap('2026-10-01', '2026-10-15', existingLeaves);
    expect(res.hasOverlap).toBe(true);
    expect(res.overlappingLeave?.id).toBe('1');
  });

  it('should detect overlap on the second leave', () => {
    // 2026-10-21 to 2026-10-25 overlaps with 2026-10-20..2026-10-22
    const res = hasLeaveOverlap('2026-10-21', '2026-10-25', existingLeaves);
    expect(res.hasOverlap).toBe(true);
    expect(res.overlappingLeave?.id).toBe('2');
  });
});
