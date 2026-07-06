import { describe, it, expect } from 'vitest';
import { computeStatus, computeProgress } from '@/hooks/accounty/useAccountyHelpers';

/**
 * Tests for the exported computeStatus and computeProgress helpers.
 * These are the REAL functions imported from the source code — not replicas.
 *
 * Business logic:
 *   computeStatus: determines client health (Rendben / Feldolgozandó / Kritikus)
 *   computeProgress: calculates a 0-100% progress bar value
 */

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

  // Edge cases
  it('returns type-safe status string (one of exactly 3 values)', () => {
    const result = computeStatus(0, 0);
    expect(['Rendben', 'Feldolgozandó', 'Kritikus']).toContain(result);
  });

  it('threshold boundary: missing=3, unprocessed=10 → "Feldolgozandó" (both at-but-not-over)', () => {
    expect(computeStatus(3, 10)).toBe('Feldolgozandó');
  });

  it('missingCount threshold is exclusive (>3, not >=3)', () => {
    expect(computeStatus(3, 0)).not.toBe('Kritikus');
    expect(computeStatus(4, 0)).toBe('Kritikus');
  });

  it('unprocessedCount threshold is exclusive (>10, not >=10)', () => {
    expect(computeStatus(0, 10)).not.toBe('Kritikus');
    expect(computeStatus(0, 11)).toBe('Kritikus');
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

  // Edge cases
  it('always returns an integer', () => {
    const result = computeProgress(33, 100);
    expect(Number.isInteger(result)).toBe(true);
  });

  it('never returns negative', () => {
    const result = computeProgress(999, 1);
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it('never returns above 100', () => {
    const result = computeProgress(0, 999999);
    expect(result).toBeLessThanOrEqual(100);
  });

  it('handles single invoice with 0 missing', () => {
    expect(computeProgress(0, 1)).toBe(100);
  });

  it('handles single invoice with 1 missing', () => {
    expect(computeProgress(1, 1)).toBe(0);
  });
});
