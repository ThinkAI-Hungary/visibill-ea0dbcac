import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportGlExcel, GLRow } from '@/lib/glExport';

describe('exportGlExcel 4-Column Format', () => {
  beforeEach(() => {
    // Mock URL and DOM download
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
  });

  it('exports Excel with 4 financial columns (Forgalom T/K, Egyenleg T/K) and triggers download', async () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const removeSpy = vi.spyOn(document.body, 'removeChild');

    const sampleRows: GLRow[] = [
      {
        id: '3',
        name: 'Követelések',
        balance: 150000,
        hasChildren: true,
        hasAccountChildren: true,
        cid: '3',
        depth: 0,
        isRoot: true,
        debitTurnover: 150000,
        creditTurnover: 0,
      },
      {
        id: '311',
        name: 'Belföldi vevők',
        balance: 150000,
        hasChildren: false,
        hasAccountChildren: false,
        cid: '311',
        depth: 1,
        isRoot: false,
        debitTurnover: 150000,
        creditTurnover: 0,
      },
      {
        id: '454',
        name: 'Belföldi szállítók',
        balance: -80000,
        hasChildren: false,
        hasAccountChildren: false,
        cid: '454',
        depth: 1,
        isRoot: false,
        debitTurnover: 0,
        creditTurnover: 80000,
      },
    ];

    const classicTotals = {
      turnoverDebit: 150000,
      turnoverCredit: 80000,
      balanceDebit: 150000,
      balanceCredit: 80000,
    };

    await exportGlExcel(
      sampleRows,
      'Test_Company',
      classicTotals,
      'teljesites',
      '2026-01-01',
      '2026-12-31',
      { excludeZeroRows: false }
    );

    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(appendSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });
});
