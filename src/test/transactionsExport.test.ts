import { describe, it, expect, vi } from 'vitest';
import { exportToFile } from '@/lib/exportUtils';

vi.mock('@/lib/exportUtils', () => ({
  exportToFile: vi.fn(),
}));

describe('Transaction Export Format', () => {
  it('includes Díj / Jutalék and Kapcsolódó számla in transaction export headers and rows', async () => {
    const headers = [
      'Dátum',
      'Leírás',
      'Összeg',
      'Pénznem',
      'Díj / Jutalék',
      'Kapcsolódó számla',
      'Típus',
      'Státusz',
      'Pontszám',
      'Indoklás',
    ];

    const mockRow = [
      '2026-09-11',
      'SimplePay Vásárlás',
      '37790',
      'HUF',
      '572',
      'VMusic00658/2026',
      'vevői tranzakció',
      'Párosított',
      '100%',
      'Heurisztikus párosítás',
    ];

    await exportToFile(headers, [mockRow], 'xlsx', 'tranzakciok');

    expect(exportToFile).toHaveBeenCalledWith(
      expect.arrayContaining(['Díj / Jutalék', 'Kapcsolódó számla']),
      expect.arrayContaining([expect.arrayContaining(['572', 'VMusic00658/2026'])]),
      'xlsx',
      'tranzakciok'
    );
  });
});
