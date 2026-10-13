import { describe, it, expect } from 'vitest';
import {
  buildDisposalJournal,
  classifyAssetGlNumber,
  type AssetGlPosition,
  type BuildDisposalJournalInput,
  type DisposalAccountSet,
  type DisposalGlRef,
} from '@/lib/fixed-assets/assetDisposalPostingService';

const ref = (id: string, glNumber: string): DisposalGlRef => ({ id, glNumber, name: glNumber });

const accounts: DisposalAccountSet = {
  depreciationExpense: ref('g5711', '5711'),
  netBookValueSale: ref('g861', '861'),
  otherExpense: ref('g869', '869'),
  saleRevenue: ref('g961', '961'),
  otherRevenue: ref('g969', '969'),
  employeeReceivable: ref('g361', '361'),
  customerReceivable: ref('g311', '311'),
  bank: ref('g384', '384'),
  fallbackAccumulated: ref('g139', '139'),
};

const position = (gross: number, accumulated: number): AssetGlPosition => ({
  gross: gross > 0 ? [{ glAccountId: 'g131', glNumber: '131', amount: gross }] : [],
  accumulated: accumulated > 0 ? [{ glAccountId: 'g139', glNumber: '139', amount: accumulated }] : [],
});

function build(partial: Partial<BuildDisposalJournalInput> & Pick<BuildDisposalJournalInput, 'reasonType'>) {
  return buildDisposalJournal({
    assetName: 'Teszt gép',
    position: position(1_000_000, 400_000),
    expectedAccumulated: 400_000,
    accounts,
    ...partial,
  });
}

const sum = (lines: { dcType: 'T' | 'K'; amount: number }[], dc: 'T' | 'K') =>
  lines.filter((l) => l.dcType === dc).reduce((s, l) => s + l.amount, 0);

describe('classifyAssetGlNumber', () => {
  it('felismeri a halmozott ÉCS és a bruttó számlákat (formátum-agnosztikusan)', () => {
    expect(classifyAssetGlNumber('1391')).toBe('accumulated');
    expect(classifyAssetGlNumber('139.')).toBe('accumulated');
    expect(classifyAssetGlNumber('131')).toBe('gross');
    expect(classifyAssetGlNumber('149100')).toBe('accumulated');
    expect(classifyAssetGlNumber('1491')).toBe('accumulated');
    expect(classifyAssetGlNumber('161')).toBe('other');
    expect(classifyAssetGlNumber('5711')).toBe('other');
  });
});

describe('buildDisposalJournal', () => {
  it('selejtezés: T 1x9 + T 869 (NBV) = K 1x, kiegyensúlyozott, pótlólagos ÉCS nélkül', () => {
    const r = build({ reasonType: 'scrapping' });
    expect(r.errors).toEqual([]);
    expect(r.breakdown).toMatchObject({ gross: 1_000_000, accumulatedPosted: 400_000, topUp: 0, netBookValue: 600_000 });
    expect(r.lines.map((l) => `${l.dcType} ${l.glNumber} ${l.amount}`)).toEqual([
      'T 139 400000',
      'T 869 600000',
      'K 131 1000000',
    ]);
    expect(r.totalDebit).toBe(r.totalCredit);
  });

  it('értékesítés: NBV a 861-re, bevétel T 311 / K 961, ÁFA-figyelmeztetés', () => {
    const r = build({
      reasonType: 'sale',
      saleNetAmount: 700_000,
      saleCounter: 'customer',
      bookSaleRevenue: true,
    });
    expect(r.errors).toEqual([]);
    expect(r.lines.some((l) => l.glNumber === '861' && l.dcType === 'T' && l.amount === 600_000)).toBe(true);
    expect(r.lines.some((l) => l.glNumber === '311' && l.dcType === 'T' && l.amount === 700_000)).toBe(true);
    expect(r.lines.some((l) => l.glNumber === '961' && l.dcType === 'K' && l.amount === 700_000)).toBe(true);
    expect(r.totalDebit).toBe(1_700_000);
    expect(r.totalCredit).toBe(1_700_000);
    expect(r.warnings.join(' ')).toContain('ÁFA');
  });

  it('értékesítés bankszámlával: T 384 / K 961', () => {
    const r = build({ reasonType: 'sale', saleNetAmount: 100_000, saleCounter: 'bank', bookSaleRevenue: true });
    expect(r.lines.some((l) => l.glNumber === '384' && l.dcType === 'T' && l.amount === 100_000)).toBe(true);
  });

  it('értékesítés bevétel nélkül: nincs 311/961 sor, de figyelmeztet a külön könyvelésre', () => {
    const r = build({ reasonType: 'sale', saleNetAmount: 700_000, bookSaleRevenue: false });
    expect(r.lines.some((l) => l.glNumber === '961')).toBe(false);
    expect(r.warnings.some((w) => w.includes('külön'))).toBe(true);
    expect(r.totalDebit).toBe(r.totalCredit);
  });

  it('pótlólagos ÉCS: ha a terv szerinti több a főkönyvinél, T 5711 / K 1x9 előzi meg a kivezetést', () => {
    const r = build({ reasonType: 'scrapping', expectedAccumulated: 450_000 });
    expect(r.errors).toEqual([]);
    expect(r.breakdown).toMatchObject({ topUp: 50_000, accumulatedTotal: 450_000, netBookValue: 550_000 });
    expect(r.lines[0]).toMatchObject({ glNumber: '5711', dcType: 'T', amount: 50_000 });
    expect(r.lines[1]).toMatchObject({ glNumber: '139', dcType: 'K', amount: 50_000 });
    // a halmozott ÉCS kivezetése már a feltöltött teljes összeg
    expect(r.lines.find((l) => l.glNumber === '139' && l.dcType === 'T')?.amount).toBe(450_000);
    expect(r.totalDebit).toBe(r.totalCredit);
  });

  it('a pótlólagos ÉCS legfeljebb a bruttó értékig mehet (teljesen leírt eszköz: nincs NBV sor)', () => {
    const r = build({ reasonType: 'scrapping', position: position(1_000_000, 1_000_000), expectedAccumulated: 1_200_000 });
    expect(r.breakdown).toMatchObject({ topUp: 0, netBookValue: 0 });
    expect(r.lines.some((l) => l.glNumber === '869')).toBe(false);
    expect(r.lines.map((l) => `${l.dcType} ${l.glNumber} ${l.amount}`)).toEqual(['T 139 1000000', 'K 131 1000000']);
  });

  it('leltárhiány: T 869 NBV + kártérítés T 361 / K 969', () => {
    const r = build({ reasonType: 'inventory_shortage', compensationAmount: 200_000 });
    expect(r.errors).toEqual([]);
    expect(r.lines.some((l) => l.glNumber === '869' && l.amount === 600_000)).toBe(true);
    expect(r.lines.some((l) => l.glNumber === '361' && l.dcType === 'T' && l.amount === 200_000)).toBe(true);
    expect(r.lines.some((l) => l.glNumber === '969' && l.dcType === 'K' && l.amount === 200_000)).toBe(true);
    expect(r.totalDebit).toBe(r.totalCredit);
  });

  it('leltárhiány: a nettó értéket meghaladó kártérítés figyelmeztetést ad', () => {
    const r = build({ reasonType: 'inventory_shortage', compensationAmount: 900_000 });
    expect(r.warnings.some((w) => w.includes('meghaladja'))).toBe(true);
  });

  it('térítés nélküli átadás: NBV T 869, ÁFA-figyelmeztetés', () => {
    const r = build({ reasonType: 'donation' });
    expect(r.lines.some((l) => l.glNumber === '869' && l.amount === 600_000)).toBe(true);
    expect(r.warnings.some((w) => w.includes('ÁFA'))).toBe(true);
  });

  it('több bruttó / ÉCS számla esetén számlánként vezet ki, és a pótlólagos ÉCS a legnagyobb ÉCS számlára kerül', () => {
    const r = build({
      reasonType: 'scrapping',
      position: {
        gross: [
          { glAccountId: 'a', glNumber: '131', amount: 600_000 },
          { glAccountId: 'b', glNumber: '132', amount: 400_000 },
        ],
        accumulated: [
          { glAccountId: 'x', glNumber: '139', amount: 100_000 },
          { glAccountId: 'y', glNumber: '149', amount: 300_000 },
        ],
      },
      expectedAccumulated: 450_000,
    });
    expect(r.errors).toEqual([]);
    const tAccum = r.lines.filter((l) => l.dcType === 'T' && /^1[34]9$/.test(l.glNumber));
    expect(tAccum.find((l) => l.glNumber === '149')?.amount).toBe(350_000); // 300k + 50k pótlás
    expect(tAccum.find((l) => l.glNumber === '139')?.amount).toBe(100_000);
    expect(r.lines.filter((l) => l.dcType === 'K' && (l.glNumber === '131' || l.glNumber === '132'))).toHaveLength(2);
    expect(r.totalDebit).toBe(r.totalCredit);
  });

  it('hiányzó ÉCS számla esetén tartalék számlát használ (a 139)', () => {
    const r = build({ reasonType: 'scrapping', position: position(1_000_000, 0), expectedAccumulated: 100_000 });
    expect(r.errors).toEqual([]);
    expect(r.lines.some((l) => l.glNumber === '139' && l.dcType === 'K' && l.amount === 100_000)).toBe(true);
    expect(r.lines.some((l) => l.glNumber === '139' && l.dcType === 'T' && l.amount === 100_000)).toBe(true);
  });

  it('hiba: nincs bruttó érték a főkönyvben → nincs könyvelhető sor', () => {
    const r = build({ reasonType: 'scrapping', position: position(0, 0) });
    expect(r.lines).toEqual([]);
    expect(r.errors[0]).toContain('nincs a főkönyvben');
  });

  it('hiba: a halmozott ÉCS meghaladja a bruttó értéket', () => {
    const r = build({ reasonType: 'scrapping', position: position(500_000, 600_000) });
    expect(r.lines).toEqual([]);
    expect(r.errors[0]).toContain('meghaladja');
  });

  it('hiba: hiányzó 861 / 869 számla jelezve van', () => {
    const noSale = build({ reasonType: 'sale', accounts: { ...accounts, netBookValueSale: null } });
    expect(noSale.errors.some((e) => e.includes('861'))).toBe(true);
    const noOther = build({ reasonType: 'scrapping', accounts: { ...accounts, otherExpense: null } });
    expect(noOther.errors.some((e) => e.includes('869'))).toBe(true);
  });

  it('minden jogcímnél kiegyensúlyozott és pozitív tételsorokat ad', () => {
    for (const reasonType of ['sale', 'scrapping', 'inventory_shortage', 'donation'] as const) {
      const r = build({
        reasonType,
        expectedAccumulated: 437_500,
        saleNetAmount: 650_000,
        bookSaleRevenue: true,
        saleCounter: 'customer',
        compensationAmount: 100_000,
      });
      expect(r.errors, reasonType).toEqual([]);
      expect(r.lines.every((l) => l.amount > 0), reasonType).toBe(true);
      expect(r.totalDebit, reasonType).toBe(r.totalCredit);
      expect(sum(r.lines, 'T'), reasonType).toBe(sum(r.lines, 'K'));
    }
  });
});
