/**
 * Accounty Bérszámfejtési Modul — Szabadság és távollét kalkulátor
 *
 * Mt. 116-122. § alapján:
 * - Alap-szabadság (20 nap) + életkori pótszabadság
 * - Gyermek utáni pótszabadság
 * - Fogyatékos gyermek pótszabadság
 * - Apasági szabadság (10 nap)
 * - Betegszabadság (15 nap, 70%)
 * - Szabadság-mérleg (felhasznált / fennmaradó / áthozható max 60 nap)
 */

// ── Típusok ──

export interface LeaveBalance {
  /** Éves alap-szabadság napok */
  baseLeave: number;
  /** Életkori pótszabadság */
  ageSupplement: number;
  /** Gyermek utáni pótszabadság */
  childSupplement: number;
  /** Fogyatékos gyermek pótszabadság */
  disabledChildSupplement: number;
  /** KSZ/egyéb extra szabadság */
  extraLeave: number;
  /** Teljes éves keret */
  totalAnnual: number;
  /** Előző évről áthozott */
  carriedOver: number;
  /** Felhasználható összesen */
  totalAvailable: number;
  /** Felhasznált napok */
  used: number;
  /** Fennmaradó napok */
  remaining: number;
}

export interface EmployeeLeaveInput {
  /** Életkor az adott év első napján */
  ageAtYearStart: number;
  /** Gyermekek száma (16 év alatti) */
  childrenUnder16: number;
  /** Fogyatékos gyermekek száma */
  disabledChildren: number;
  /** Előző évről áthozott napok */
  carriedOverDays: number;
  /** KSZ/egyéb extra napok */
  extraLeaveDays: number;
  /** Munkaviszony kezdő dátum (időarányosításhoz) */
  employmentStartDate?: Date;
  /** Munkaviszony befejező dátum (időarányosításhoz) */
  employmentEndDate?: Date;
  /** Számítás éve */
  year: number;
  /** Felhasznált napok (eddig) */
  usedDays: number;
}

// ── Szabadság konstansok (Mt.) ──

/** Alap éves szabadság napok */
const BASE_LEAVE_DAYS = 20;

/** Maximális áthozható napok */
const MAX_CARRY_OVER = 60;

/**
 * Életkori pótszabadság táblázat (Mt. 117. §)
 *
 * | Betöltött életév | Pótszabadság napok |
 * |---|---|
 * | 25 | +1 |
 * | 28 | +2 |
 * | 31 | +3 |
 * | 33 | +4 |
 * | 35 | +5 |
 * | 37 | +6 |
 * | 39 | +7 |
 * | 41 | +8 |
 * | 43 | +9 |
 * | 45+ | +10 |
 */
const AGE_SUPPLEMENT_TABLE: Array<[number, number]> = [
  [45, 10],
  [43, 9],
  [41, 8],
  [39, 7],
  [37, 6],
  [35, 5],
  [33, 4],
  [31, 3],
  [28, 2],
  [25, 1],
];

// ── Kalkuláció ──

/**
 * Életkori pótszabadság napok kiszámítása.
 */
export function calculateAgeSupplement(age: number): number {
  for (const [minAge, days] of AGE_SUPPLEMENT_TABLE) {
    if (age >= minAge) return days;
  }
  return 0;
}

/**
 * Gyermek utáni pótszabadság (Mt. 118. §)
 *
 * - 1 gyermek: 2 nap
 * - 2 gyermek: 4 nap
 * - 3+ gyermek: 7 nap
 *
 * A gyermek 16 éves koráig jár.
 */
export function calculateChildSupplement(childrenUnder16: number): number {
  if (childrenUnder16 <= 0) return 0;
  if (childrenUnder16 === 1) return 2;
  if (childrenUnder16 === 2) return 4;
  return 7;
}

/**
 * Fogyatékos gyermek pótszabadság (Mt. 118. §)
 *
 * - Gyermekenként 2 extra nap
 */
export function calculateDisabledChildSupplement(disabledChildren: number): number {
  return disabledChildren * 2;
}

/**
 * Időarányos szabadság számítás.
 *
 * Ha a munkaviszony nem az egész évre szól, arányosítjuk:
 * totalDays × (munkában töltött hónapok / 12)
 */
function calculateProRata(
  totalDays: number,
  year: number,
  startDate?: Date,
  endDate?: Date
): number {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);

  const effectiveStart = startDate && startDate > yearStart ? startDate : yearStart;
  const effectiveEnd = endDate && endDate < yearEnd ? endDate : yearEnd;

  // Hónapok száma (kerekítés felfelé a megkezdett hónapra)
  const startMonth = effectiveStart.getMonth();
  const endMonth = effectiveEnd.getMonth();
  const months = endMonth - startMonth + 1;

  return Math.round(totalDays * (months / 12));
}

/**
 * Teljes szabadság-mérleg számítás.
 */
export function calculateLeaveBalance(input: EmployeeLeaveInput): LeaveBalance {
  const ageSupplement = calculateAgeSupplement(input.ageAtYearStart);
  const childSupplement = calculateChildSupplement(input.childrenUnder16);
  const disabledChildSupplement = calculateDisabledChildSupplement(input.disabledChildren);

  let totalAnnual = BASE_LEAVE_DAYS + ageSupplement + childSupplement + disabledChildSupplement + input.extraLeaveDays;

  // Időarányosítás ha nem egész éves a munkaviszony
  if (input.employmentStartDate || input.employmentEndDate) {
    totalAnnual = calculateProRata(
      totalAnnual,
      input.year,
      input.employmentStartDate,
      input.employmentEndDate
    );
  }

  // Áthozható max 60 nap
  const carriedOver = Math.min(input.carriedOverDays, MAX_CARRY_OVER);
  const totalAvailable = totalAnnual + carriedOver;
  const remaining = totalAvailable - input.usedDays;

  return {
    baseLeave: BASE_LEAVE_DAYS,
    ageSupplement,
    childSupplement,
    disabledChildSupplement,
    extraLeave: input.extraLeaveDays,
    totalAnnual,
    carriedOver,
    totalAvailable,
    used: input.usedDays,
    remaining: Math.max(0, remaining),
  };
}

// ── Betegszabadság ──

export interface SickLeaveResult {
  /** Betegszabadság napok az adott évben */
  availableDays: number;
  /** Felhasznált napok */
  usedDays: number;
  /** Fennmaradó napok */
  remainingDays: number;
  /** Napi díjazás (távolléti díj × 70%) */
  dailyRate: number;
}

/**
 * Betegszabadság kalkuláció (Mt. 126. §)
 *
 * - Évi 15 nap
 * - Díjazás: távolléti díj 70%-a
 * - A 15 nap felett: táppénz (OEP)
 */
export function calculateSickLeave(
  dailyAbsencePay: number,
  usedSickDays: number
): SickLeaveResult {
  const maxDays = 15;
  return {
    availableDays: maxDays,
    usedDays: usedSickDays,
    remainingDays: Math.max(0, maxDays - usedSickDays),
    dailyRate: Math.round(dailyAbsencePay * 0.70),
  };
}

// ── Szabadság-megváltás (kilépéskor, Mt. 125. §) ──

export interface LeavePayoutResult {
  /** Megváltandó napok */
  daysToPayOut: number;
  /** Napi távolléti díj */
  dailyAbsencePay: number;
  /** Megváltási összeg (bruttó) */
  payoutAmount: number;
}

/**
 * Szabadság-megváltás kalkuláció kilépéskor (Mt. 125. §)
 *
 * Csak munkaviszony megszűnésekor váltható meg.
 * Összeg: megváltandó napok × utolsó napi távolléti díj
 */
export function calculateLeavePayout(
  remainingDays: number,
  dailyAbsencePay: number
): LeavePayoutResult {
  const daysToPayOut = Math.max(0, remainingDays);
  return {
    daysToPayOut,
    dailyAbsencePay,
    payoutAmount: daysToPayOut * dailyAbsencePay,
  };
}
