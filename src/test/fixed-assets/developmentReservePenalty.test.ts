import { describe, it, expect } from 'vitest';
import {
  ALIENATION_PROTECTION_YEARS,
  CORPORATE_TAX_RATE,
  assessReserveExpiry,
  checkAlienationRestriction,
  daysBetween,
  estimateUnusedReservePenalty,
  getReserveDeadline,
} from '@/lib/fixed-assets/developmentReservePenaltyCalculator';

const reserve = (creation_year: number, reserve_amount: number, remaining_amount?: number) => ({
  id: `r-${creation_year}`,
  creation_year,
  reserve_amount,
  remaining_amount,
  expiration_date: getReserveDeadline(creation_year),
});

describe('getReserveDeadline / daysBetween', () => {
  it('a határidő a képzés évét követő 4. adóév utolsó napja', () => {
    expect(getReserveDeadline(2022)).toBe('2026-12-31');
  });
  it('napok különbsége szökőévvel is pontos', () => {
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2);
    expect(daysBetween('2026-10-13', '2026-12-31')).toBe(79);
    expect(daysBetween('2026-12-31', '2026-10-13')).toBe(-79);
  });
});

describe('assessReserveExpiry', () => {
  it('képzés éve és a 2. adóév: nincs riasztás', () => {
    expect(assessReserveExpiry(reserve(2026, 1_000_000), '2026-10-13').level).toBe('ok');
    expect(assessReserveExpiry(reserve(2024, 1_000_000), '2026-10-13').level).toBe('ok');
  });
  it('a 3. adóévben figyelmeztet (warning)', () => {
    const r = assessReserveExpiry(reserve(2023, 1_000_000), '2026-10-13');
    expect(r.level).toBe('warning');
    expect(r.yearIndex).toBe(3);
  });
  it('a 4. (záró) adóévben kritikus, a hátralévő napokkal', () => {
    const r = assessReserveExpiry(reserve(2022, 10_000_000), '2026-10-13');
    expect(r.level).toBe('critical');
    expect(r.deadline).toBe('2026-12-31');
    expect(r.daysToDeadline).toBe(79);
    expect(r.remaining).toBe(10_000_000);
  });
  it('a határidő után lejárt (overdue)', () => {
    expect(assessReserveExpiry(reserve(2022, 10_000_000), '2027-01-02').level).toBe('overdue');
  });
  it('teljesen felhasznált tartalék sosem riaszt', () => {
    expect(assessReserveExpiry(reserve(2022, 10_000_000, 0), '2027-08-31').level).toBe('ok');
  });
  it('részben felhasznált tartaléknál a fel nem használt rész a mérvadó', () => {
    const r = assessReserveExpiry(reserve(2022, 10_000_000, 2_500_000), '2026-10-13');
    expect(r.level).toBe('critical');
    expect(r.remaining).toBe(2_500_000);
  });
});

describe('estimateUnusedReservePenalty', () => {
  it('9% adó és késedelmi pótlék: 10 M Ft fel nem használt, 2027-08-31-ig', () => {
    // esedékesség: 2027-05-31 → 92 késedelmi nap; kulcs: 6,5 + 5 = 11,5% / év
    const e = estimateUnusedReservePenalty({ remaining: 10_000_000, deadline: '2026-12-31', asOf: '2027-08-31' });
    expect(e.taxBaseIncrease).toBe(10_000_000);
    expect(e.corporateTax).toBe(900_000);
    expect(e.taxDueDate).toBe('2027-05-31');
    expect(e.lateDays).toBe(92);
    expect(e.annualRatePercent).toBeCloseTo(11.5, 10);
    // 900 000 × 0,115 × 92 / 365 = 26 087,67
    expect(e.penalty).toBe(26_088);
    expect(e.total).toBe(926_088);
  });
  it('az esedékesség előtt nincs pótlék', () => {
    const e = estimateUnusedReservePenalty({ remaining: 5_000_000, deadline: '2026-12-31', asOf: '2027-05-31' });
    expect(e.lateDays).toBe(0);
    expect(e.penalty).toBe(0);
    expect(e.corporateTax).toBe(Math.round(5_000_000 * CORPORATE_TAX_RATE));
  });
  it('az alapkamat felülírható', () => {
    const e = estimateUnusedReservePenalty({ remaining: 1_000_000, deadline: '2026-12-31', asOf: '2028-05-31', mnbBaseRatePercent: 10 });
    expect(e.annualRatePercent).toBe(15);
    expect(e.lateDays).toBe(366);
    expect(e.penalty).toBe(Math.round(90_000 * 0.15 * (366 / 365)));
  });
  it('negatív vagy nulla fel nem használt összeg nem ad kötelezettséget', () => {
    const e = estimateUnusedReservePenalty({ remaining: -100, deadline: '2026-12-31', asOf: '2027-12-31' });
    expect(e.corporateTax).toBe(0);
    expect(e.penalty).toBe(0);
    expect(e.total).toBe(0);
  });
});

describe('checkAlienationRestriction', () => {
  it('tartalék nélküli eszköznél nincs korlát', () => {
    const c = checkAlienationRestriction({ activationDate: '2024-03-01', disposalDate: '2026-06-30', developmentReserveAmount: 0 });
    expect(c.restricted).toBe(false);
    expect(c.protectedUntil).toBeNull();
  });
  it('védett időszakon belüli kivezetés: visszafizetési kötelezettség becslés', () => {
    const c = checkAlienationRestriction({ activationDate: '2024-03-01', disposalDate: '2027-06-30', developmentReserveAmount: 3_000_000 });
    expect(c.restricted).toBe(true);
    expect(c.protectedUntil).toBe(`${2024 + ALIENATION_PROTECTION_YEARS}-12-31`);
    expect(c.estimatedTax).toBe(270_000);
    expect(c.estimatedPenalty).toBe(0);
  });
  it('a védett időszak lejárta után szabad a kivezetés', () => {
    const c = checkAlienationRestriction({ activationDate: '2024-03-01', disposalDate: '2030-01-02', developmentReserveAmount: 3_000_000 });
    expect(c.restricted).toBe(false);
    expect(c.estimatedTax).toBe(0);
  });
  it('a védett időszak utolsó napján még korlátozott', () => {
    expect(
      checkAlienationRestriction({ activationDate: '2024-03-01', disposalDate: '2029-12-31', developmentReserveAmount: 1 }).restricted,
    ).toBe(true);
  });
  it('aktiválási dátum hiányában nem állapít meg korlátot', () => {
    expect(checkAlienationRestriction({ activationDate: null, disposalDate: '2026-01-01', developmentReserveAmount: 1_000_000 }).restricted).toBe(false);
  });
});
