import { describe, it, expect } from 'vitest';
import { kanbanStatusReverse } from '@/hooks/accounty/useAccountyClients';

/**
 * Tests for kanban status mapping.
 *
 * The Accounty kanban board uses Hungarian display labels (e.g. "Rendben"),
 * but stores DB values in lowercase (e.g. "aktiv").
 * kanbanStatusReverse maps DB → display. Its inverse (kanbanStatusMap) is
 * internal to the module, but we can verify the reverse mapping exhaustively.
 */

describe('kanbanStatusReverse mapping', () => {
  it('maps "aktiv" → "Rendben"', () => {
    expect(kanbanStatusReverse['aktiv']).toBe('Rendben');
  });

  it('maps "feldolgozando" → "Feldolgozandó"', () => {
    expect(kanbanStatusReverse['feldolgozando']).toBe('Feldolgozandó');
  });

  it('maps "kritikus" → "Kritikus"', () => {
    expect(kanbanStatusReverse['kritikus']).toBe('Kritikus');
  });

  it('has exactly 3 entries', () => {
    expect(Object.keys(kanbanStatusReverse)).toHaveLength(3);
  });

  it('all values are valid client statuses', () => {
    const validStatuses = ['Rendben', 'Feldolgozandó', 'Kritikus'];
    for (const value of Object.values(kanbanStatusReverse)) {
      expect(validStatuses).toContain(value);
    }
  });

  it('returns undefined for unknown DB status', () => {
    expect(kanbanStatusReverse['unknown']).toBeUndefined();
    expect(kanbanStatusReverse['']).toBeUndefined();
  });

  it('keys are all lowercase (DB convention)', () => {
    for (const key of Object.keys(kanbanStatusReverse)) {
      expect(key).toBe(key.toLowerCase());
    }
  });

  it('is a bijective mapping (no duplicate values)', () => {
    const values = Object.values(kanbanStatusReverse);
    expect(new Set(values).size).toBe(values.length);
  });
});
