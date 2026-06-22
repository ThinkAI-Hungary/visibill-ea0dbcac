import { describe, it, expect } from 'vitest';

/**
 * These helper functions are defined inside useAccountyData.ts but not exported.
 * We replicate them here for isolated testing of their business logic.
 * If the source implementation changes, these tests should be updated accordingly.
 */

// ── computeStatus ──
function computeStatus(missingCount: number, unprocessedCount: number): 'Rendben' | 'Feldolgozandó' | 'Kritikus' {
  if (missingCount > 3 || unprocessedCount > 10) return 'Kritikus';
  if (missingCount > 0 || unprocessedCount > 0) return 'Feldolgozandó';
  return 'Rendben';
}

// ── computeProgress ──
function computeProgress(missingCount: number, totalInvoices: number): number {
  if (totalInvoices === 0 && missingCount === 0) return 100;
  if (totalInvoices === 0) return missingCount > 0 ? 30 : 100;
  const ratio = Math.max(0, 1 - (missingCount / Math.max(totalInvoices, 1)));
  return Math.round(ratio * 100);
}

// ═══════════════════════════════════════════════════════════════
// computeStatus tests
// ═══════════════════════════════════════════════════════════════

describe('computeStatus', () => {
  it('returns "Rendben" when both counts are zero', () => {
    expect(computeStatus(0, 0)).toBe('Rendben');
  });

  it('returns "Feldolgozandó" when missingCount is 1', () => {
    expect(computeStatus(1, 0)).toBe('Feldolgozandó');
  });

  it('returns "Feldolgozandó" when unprocessedCount is 1', () => {
    expect(computeStatus(0, 1)).toBe('Feldolgozandó');
  });

  it('returns "Feldolgozandó" when missingCount is exactly 3', () => {
    expect(computeStatus(3, 0)).toBe('Feldolgozandó');
  });

  it('returns "Feldolgozandó" when unprocessedCount is exactly 10', () => {
    expect(computeStatus(0, 10)).toBe('Feldolgozandó');
  });

  it('returns "Kritikus" when missingCount exceeds 3', () => {
    expect(computeStatus(4, 0)).toBe('Kritikus');
  });

  it('returns "Kritikus" when unprocessedCount exceeds 10', () => {
    expect(computeStatus(0, 11)).toBe('Kritikus');
  });

  it('returns "Kritikus" when both are at threshold boundaries', () => {
    expect(computeStatus(4, 11)).toBe('Kritikus');
  });

  it('returns "Kritikus" for extreme values', () => {
    expect(computeStatus(100, 500)).toBe('Kritikus');
  });

  it('returns "Feldolgozandó" for small non-zero values below threshold', () => {
    expect(computeStatus(2, 5)).toBe('Feldolgozandó');
  });
});

// ═══════════════════════════════════════════════════════════════
// computeProgress tests
// ═══════════════════════════════════════════════════════════════

describe('computeProgress', () => {
  it('returns 100 when both counts are zero (nothing missing, no invoices)', () => {
    expect(computeProgress(0, 0)).toBe(100);
  });

  it('returns 30 when there are missing items but no invoices', () => {
    expect(computeProgress(5, 0)).toBe(30);
  });

  it('returns 100 when missing is 0 and invoices > 0', () => {
    expect(computeProgress(0, 50)).toBe(100);
  });

  it('returns 50 when half the invoices are missing', () => {
    expect(computeProgress(50, 100)).toBe(50);
  });

  it('returns 0 when all invoices are missing', () => {
    expect(computeProgress(100, 100)).toBe(0);
  });

  it('clamps to 0 when missingCount exceeds totalInvoices', () => {
    expect(computeProgress(200, 100)).toBe(0);
  });

  it('returns 90 when 10% missing', () => {
    expect(computeProgress(10, 100)).toBe(90);
  });

  it('returns 75 when 25% missing', () => {
    expect(computeProgress(25, 100)).toBe(75);
  });

  it('handles small ratios (1 out of 1000)', () => {
    expect(computeProgress(1, 1000)).toBe(100); // rounds to 100 (99.9%)
  });

  it('handles very large missing count', () => {
    const result = computeProgress(10000, 100);
    expect(result).toBe(0);
  });
});
