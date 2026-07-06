import { describe, it, expect, vi } from 'vitest';
import { invalidateAccountyCache } from '@/hooks/accounty/useAccountyHelpers';

function createMockQueryClient() {
  const calls: string[][] = [];
  return {
    invalidateQueries: vi.fn(({ queryKey }: { queryKey: string[] }) => {
      calls.push(queryKey);
    }),
    getCalls: () => calls,
  };
}

describe('invalidateAccountyCache', () => {
  it('group "missing" invalidates 5 query prefixes', () => {
    const qc = createMockQueryClient();
    invalidateAccountyCache(qc as any, 'missing');

    const keys = qc.getCalls().map(k => k[0]);
    expect(keys).toContain('accounty-missing-items');
    expect(keys).toContain('accounty-all-missing-items');
    expect(keys).toContain('accounty-kpis');
    expect(keys).toContain('accounty-clients');
    expect(keys).toContain('accounty-missing-counts');
    expect(keys).toHaveLength(5);
  });

  it('group "clients" invalidates 5 query prefixes', () => {
    const qc = createMockQueryClient();
    invalidateAccountyCache(qc as any, 'clients');

    const keys = qc.getCalls().map(k => k[0]);
    expect(keys).toContain('accounty-clients');
    expect(keys).toContain('accounty-kpis');
    expect(keys).toContain('accounty-all-missing-items');
    expect(keys).toContain('accounty-company-summary');
    expect(keys).toContain('firm-accountants');
    expect(keys).toHaveLength(5);
  });

  it('group "deadlines" invalidates 3 query prefixes', () => {
    const qc = createMockQueryClient();
    invalidateAccountyCache(qc as any, 'deadlines');

    const keys = qc.getCalls().map(k => k[0]);
    expect(keys).toContain('accounty-deadlines');
    expect(keys).toContain('accounty-kpis');
    expect(keys).toContain('accounty-clients');
    expect(keys).toHaveLength(3);
  });

  it('accepts an array of groups and deduplicates keys', () => {
    const qc = createMockQueryClient();
    // 'missing' and 'deadlines' both have 'accounty-kpis' and 'accounty-clients'
    invalidateAccountyCache(qc as any, ['missing', 'deadlines']);

    const keys = qc.getCalls().map(k => k[0]);
    // Should have no duplicates
    expect(new Set(keys).size).toBe(keys.length);
    // Union: missing(5) + deadlines adds 'accounty-deadlines' → 6 unique keys
    expect(keys).toHaveLength(6);
    expect(keys).toContain('accounty-deadlines');
    expect(keys).toContain('accounty-missing-items');
    expect(keys).toContain('accounty-missing-counts');
  });

  it('calls invalidateQueries exactly once per unique key', () => {
    const qc = createMockQueryClient();
    invalidateAccountyCache(qc as any, ['missing', 'clients', 'deadlines']);

    // Count all unique keys from all 3 groups
    const expectedKeys = new Set([
      'accounty-missing-items', 'accounty-all-missing-items', 'accounty-kpis',
      'accounty-clients', 'accounty-missing-counts',
      'accounty-company-summary', 'firm-accountants',
      'accounty-deadlines',
    ]);

    expect(qc.invalidateQueries).toHaveBeenCalledTimes(expectedKeys.size);
  });
});
