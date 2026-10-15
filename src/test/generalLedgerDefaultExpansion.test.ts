import { describe, it, expect } from 'vitest';
import { computeDefaultExpandedClasses } from '@/components/general-ledger/GeneralLedgerTable';

describe('computeDefaultExpandedClasses', () => {
  it('returns empty set if dbData is null, undefined, or empty', () => {
    expect(computeDefaultExpandedClasses(null).size).toBe(0);
    expect(computeDefaultExpandedClasses(undefined).size).toBe(0);
    expect(computeDefaultExpandedClasses([]).size).toBe(0);
  });

  it('ignores accounts with zero balance and zero items', () => {
    const data = [
      { gl_number: '111', total_balance: 0, item_count: 0 },
      { gl_number: '211', total_balance: 0, item_count: 0 },
      { gl_number: '511', total_balance: 0, item_count: 0 },
    ];
    const expanded = computeDefaultExpandedClasses(data);
    expect(expanded.size).toBe(0);
  });

  it('expands ancestor classes up to 4 digits for accounts with non-zero balance', () => {
    const data = [
      { gl_number: '131.', total_balance: 1852989, item_count: 1 },
      { gl_number: '3841', total_balance: 500000, item_count: 2 },
    ];
    const expanded = computeDefaultExpandedClasses(data);

    // For 131: class 1, group 13, subgroup 131
    expect(expanded.has('1')).toBe(true);
    expect(expanded.has('1.')).toBe(true);
    expect(expanded.has('13')).toBe(true);
    expect(expanded.has('13.')).toBe(true);
    expect(expanded.has('131')).toBe(true);
    expect(expanded.has('131.')).toBe(true);

    // For 3841: class 3, group 38, subgroup 384, class 3841
    expect(expanded.has('3')).toBe(true);
    expect(expanded.has('38')).toBe(true);
    expect(expanded.has('384')).toBe(true);
    expect(expanded.has('3841')).toBe(true);

    // Empty class 2 should NOT be in the set
    expect(expanded.has('2')).toBe(false);
    expect(expanded.has('2.')).toBe(false);
  });

  it('caps expansion at 4 digits for long analytical account numbers', () => {
    const data = [
      { gl_number: '45410199', total_balance: -250000, item_count: 3 },
    ];
    const expanded = computeDefaultExpandedClasses(data);

    expect(expanded.has('4')).toBe(true);
    expect(expanded.has('45')).toBe(true);
    expect(expanded.has('454')).toBe(true);
    expect(expanded.has('4541')).toBe(true);

    // 5+ digits should NOT be expanded (analytical leaves stay collapsed)
    expect(expanded.has('45410')).toBe(false);
    expect(expanded.has('454101')).toBe(false);
    expect(expanded.has('45410199')).toBe(false);
  });
});
