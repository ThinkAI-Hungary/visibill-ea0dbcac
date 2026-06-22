import { describe, it, expect } from 'vitest';

/**
 * Tests for mapDbStatus and kanban status mapping logic from useAccountyData.ts.
 * These are non-exported utility functions, so we replicate them for unit testing.
 */

// ── mapDbStatus (replicated from useAccountyData.ts) ──

type InvoiceStatus = 'Új' | 'Kontírozásra vár' | 'Kontírozott' | 'Exportálva' | 'Problémás';

const mapDbStatus = (s: string | null): InvoiceStatus => {
  switch (s) {
    case 'feldolgozas_alatt': return 'Új';
    case 'feldolgozott': return 'Kontírozott';
    case 'kifizetve': return 'Exportálva';
    case 'keses': return 'Problémás';
    case 'torolt': return 'Problémás';
    default: return 'Kontírozásra vár';
  }
};

// ── kanbanStatusMap and reverse (replicated) ──

const kanbanStatusMap: Record<string, string> = {
  'Rendben': 'aktiv',
  'Feldolgozandó': 'feldolgozando',
  'Kritikus': 'kritikus',
};

const kanbanStatusReverse: Record<string, string> = {
  'aktiv': 'Rendben',
  'feldolgozando': 'Feldolgozandó',
  'kritikus': 'Kritikus',
};

// ═══════════════════════════════════════════════════════════════
// mapDbStatus tests
// ═══════════════════════════════════════════════════════════════

describe('mapDbStatus (Invoice status mapping)', () => {
  it('maps "feldolgozas_alatt" to "Új"', () => {
    expect(mapDbStatus('feldolgozas_alatt')).toBe('Új');
  });

  it('maps "feldolgozott" to "Kontírozott"', () => {
    expect(mapDbStatus('feldolgozott')).toBe('Kontírozott');
  });

  it('maps "kifizetve" to "Exportálva"', () => {
    expect(mapDbStatus('kifizetve')).toBe('Exportálva');
  });

  it('maps "keses" to "Problémás"', () => {
    expect(mapDbStatus('keses')).toBe('Problémás');
  });

  it('maps "torolt" to "Problémás"', () => {
    expect(mapDbStatus('torolt')).toBe('Problémás');
  });

  it('maps null to "Kontírozásra vár"', () => {
    expect(mapDbStatus(null)).toBe('Kontírozásra vár');
  });

  it('maps undefined/unknown to "Kontírozásra vár"', () => {
    expect(mapDbStatus('unknown_status')).toBe('Kontírozásra vár');
    expect(mapDbStatus('')).toBe('Kontírozásra vár');
  });

  it('is case-sensitive (uppercase does not match)', () => {
    expect(mapDbStatus('Feldolgozas_Alatt')).toBe('Kontírozásra vár');
    expect(mapDbStatus('FELDOLGOZOTT')).toBe('Kontírozásra vár');
  });

  it('all returned values are valid InvoiceStatus', () => {
    const validStatuses: InvoiceStatus[] = ['Új', 'Kontírozásra vár', 'Kontírozott', 'Exportálva', 'Problémás'];
    const testInputs = ['feldolgozas_alatt', 'feldolgozott', 'kifizetve', 'keses', 'torolt', null, 'random'];
    
    for (const input of testInputs) {
      expect(validStatuses).toContain(mapDbStatus(input));
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Kanban status mapping tests
// ═══════════════════════════════════════════════════════════════

describe('kanbanStatusMap (UI → DB)', () => {
  it('maps "Rendben" to "aktiv"', () => {
    expect(kanbanStatusMap['Rendben']).toBe('aktiv');
  });

  it('maps "Feldolgozandó" to "feldolgozando"', () => {
    expect(kanbanStatusMap['Feldolgozandó']).toBe('feldolgozando');
  });

  it('maps "Kritikus" to "kritikus"', () => {
    expect(kanbanStatusMap['Kritikus']).toBe('kritikus');
  });

  it('returns undefined for unknown keys', () => {
    expect(kanbanStatusMap['nonexistent']).toBeUndefined();
  });

  it('has exactly 3 entries', () => {
    expect(Object.keys(kanbanStatusMap)).toHaveLength(3);
  });
});

describe('kanbanStatusReverse (DB → UI)', () => {
  it('maps "aktiv" to "Rendben"', () => {
    expect(kanbanStatusReverse['aktiv']).toBe('Rendben');
  });

  it('maps "feldolgozando" to "Feldolgozandó"', () => {
    expect(kanbanStatusReverse['feldolgozando']).toBe('Feldolgozandó');
  });

  it('maps "kritikus" to "Kritikus"', () => {
    expect(kanbanStatusReverse['kritikus']).toBe('Kritikus');
  });

  it('has exactly 3 entries', () => {
    expect(Object.keys(kanbanStatusReverse)).toHaveLength(3);
  });

  it('is the inverse of kanbanStatusMap', () => {
    for (const [uiStatus, dbStatus] of Object.entries(kanbanStatusMap)) {
      expect(kanbanStatusReverse[dbStatus]).toBe(uiStatus);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Kanban status fallback logic test
// ═══════════════════════════════════════════════════════════════

describe('Kanban status fallback behavior', () => {
  // The actual mutation uses `kanbanStatusMap[status] || 'aktiv'`
  function getDbKanbanStatus(status: string): string {
    return kanbanStatusMap[status] || 'aktiv';
  }

  it('returns "aktiv" for valid "Rendben" input', () => {
    expect(getDbKanbanStatus('Rendben')).toBe('aktiv');
  });

  it('returns "aktiv" as fallback for unknown status', () => {
    expect(getDbKanbanStatus('unknown')).toBe('aktiv');
  });

  it('returns "aktiv" for empty string', () => {
    expect(getDbKanbanStatus('')).toBe('aktiv');
  });

  it('handles all 3 valid statuses', () => {
    expect(getDbKanbanStatus('Rendben')).toBe('aktiv');
    expect(getDbKanbanStatus('Feldolgozandó')).toBe('feldolgozando');
    expect(getDbKanbanStatus('Kritikus')).toBe('kritikus');
  });
});
