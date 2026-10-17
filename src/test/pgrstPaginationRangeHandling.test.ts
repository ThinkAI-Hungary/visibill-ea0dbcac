import { describe, it, expect, vi } from 'vitest';
import { isPgrstRangeError } from '@/lib/supabaseErrors';

describe('PGRST103 Out-of-Range Pagination Handling', () => {
  it('correctly identifies PGRST103 error objects from PostgREST', () => {
    const errorObj = {
      code: 'PGRST103',
      details: 'An offset of 50 was requested, but there are only 0 rows.',
      hint: null,
      message: 'Requested range not satisfiable',
    };
    expect(isPgrstRangeError(errorObj)).toBe(true);
  });

  it('identifies HTTP 416 status code as range error', () => {
    expect(isPgrstRangeError({ status: 416, message: 'Range error' })).toBe(true);
    expect(isPgrstRangeError({ statusCode: 416, message: 'Range error' })).toBe(true);
  });

  it('identifies Error instances containing satisfiable text', () => {
    const err = new Error('Requested range not satisfiable');
    expect(isPgrstRangeError(err)).toBe(true);
  });

  it('returns false for standard database errors or validation errors', () => {
    expect(isPgrstRangeError(null)).toBe(false);
    expect(isPgrstRangeError(undefined)).toBe(false);
    expect(isPgrstRangeError({ code: 'PGRST116', message: 'The result contains 0 rows' })).toBe(false);
    expect(isPgrstRangeError({ code: '23505', message: 'duplicate key value violates unique constraint' })).toBe(false);
    expect(isPgrstRangeError(new Error('Network timeout'))).toBe(false);
  });

  it('clamps currentPage correctly when totalCount drops below current page offset', () => {
    const clampPage = (currentPage: number, totalCount: number, pageSize: number) => {
      const totalPages = Math.ceil(totalCount / pageSize);
      if (totalCount > 0 && currentPage > totalPages) {
        return Math.max(1, totalPages);
      }
      if (totalCount === 0 && currentPage > 1) {
        return 1;
      }
      return currentPage;
    };

    // User is on page 2 (pageSize=50), but there are 0 rows after filter/deletion
    expect(clampPage(2, 0, 50)).toBe(1);

    // User is on page 5 (pageSize=50, offset 200), but now totalCount is 75 (totalPages = 2)
    expect(clampPage(5, 75, 50)).toBe(2);

    // User is on page 1, totalCount is 0 -> stays 1
    expect(clampPage(1, 0, 50)).toBe(1);

    // User is on page 2, totalCount is 100 -> stays 2
    expect(clampPage(2, 100, 50)).toBe(2);
  });
});
