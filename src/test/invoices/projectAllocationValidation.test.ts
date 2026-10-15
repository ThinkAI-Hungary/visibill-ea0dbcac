import { describe, it, expect } from 'vitest';
import {
  validateProjectAllocations,
  distributeEqually,
  fillRemainder,
} from '@/lib/projectAllocationValidation';

describe('projectAllocationValidation', () => {
  it('returns valid for null or empty allocations', () => {
    expect(validateProjectAllocations(null)).toEqual({
      isValid: true,
      sum: 0,
      remaining: 100,
      isUnassigned: true,
      error: null,
    });
    expect(validateProjectAllocations([])).toEqual({
      isValid: true,
      sum: 0,
      remaining: 100,
      isUnassigned: true,
      error: null,
    });
  });

  it('validates a valid 100% single allocation', () => {
    const res = validateProjectAllocations([{ project_id: 'proj-1', percentage: 100 }]);
    expect(res.isValid).toBe(true);
    expect(res.sum).toBe(100);
    expect(res.remaining).toBe(0);
    expect(res.error).toBeNull();
  });

  it('validates a valid 60/40 split', () => {
    const res = validateProjectAllocations([
      { project_id: 'proj-1', percentage: 60 },
      { project_id: 'proj-2', percentage: 40 },
    ]);
    expect(res.isValid).toBe(true);
    expect(res.sum).toBe(100);
    expect(res.remaining).toBe(0);
    expect(res.error).toBeNull();
  });

  it('rejects allocation when sum is less than 100%', () => {
    const res = validateProjectAllocations([
      { project_id: 'proj-1', percentage: 60 },
      { project_id: 'proj-2', percentage: 30 },
    ]);
    expect(res.isValid).toBe(false);
    expect(res.sum).toBe(90);
    expect(res.remaining).toBe(10);
    expect(res.error).toContain('Hiányzik még: 10%');
  });

  it('rejects allocation when sum is greater than 100%', () => {
    const res = validateProjectAllocations([
      { project_id: 'proj-1', percentage: 70 },
      { project_id: 'proj-2', percentage: 40 },
    ]);
    expect(res.isValid).toBe(false);
    expect(res.sum).toBe(110);
    expect(res.remaining).toBe(-10);
    expect(res.error).toContain('Túllépés: 10%');
  });

  it('rejects duplicate project IDs', () => {
    const res = validateProjectAllocations([
      { project_id: 'proj-1', percentage: 50 },
      { project_id: 'proj-1', percentage: 50 },
    ]);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('Ugyanaz a projekt nem szerepelhet többször');
  });

  it('rejects empty project IDs', () => {
    const res = validateProjectAllocations([
      { project_id: '', percentage: 50 },
      { project_id: 'proj-2', percentage: 50 },
    ]);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('Minden sornál kötelező kiválasztani');
  });

  it('rejects non-positive percentages', () => {
    const res = validateProjectAllocations([
      { project_id: 'proj-1', percentage: 0 },
      { project_id: 'proj-2', percentage: 100 },
    ]);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('0-nál nagyobbnak kell lennie');
  });

  it('distributeEqually generates exact 100% split for 2, 3, and 4 items', () => {
    const two = distributeEqually(['p1', 'p2']);
    expect(two).toEqual([
      { project_id: 'p1', percentage: 50 },
      { project_id: 'p2', percentage: 50 },
    ]);
    expect(validateProjectAllocations(two).isValid).toBe(true);

    const three = distributeEqually(['p1', 'p2', 'p3']);
    expect(three.reduce((acc, c) => acc + c.percentage, 0)).toBeCloseTo(100, 2);
    expect(validateProjectAllocations(three).isValid).toBe(true);

    const four = distributeEqually(['p1', 'p2', 'p3', 'p4']);
    expect(four.reduce((acc, c) => acc + c.percentage, 0)).toBe(100);
    expect(validateProjectAllocations(four).isValid).toBe(true);
  });

  it('fillRemainder sets the targeted item to remaining balance', () => {
    const initial = [
      { project_id: 'p1', percentage: 65 },
      { project_id: 'p2', percentage: 10 },
    ];
    const filled = fillRemainder(initial, 1);
    expect(filled[1].percentage).toBe(35);
    expect(validateProjectAllocations(filled).isValid).toBe(true);
  });
});
