/**
 * Accounty Bérszámfejtési Modul — Szabadság és távollét kalkulátor
 *
 * Mt. 116-122. § alapján:
 * - Alap-szabadság (20 nap) + életkori pótszabadság
 * - Gyermek utáni pótszabadság
 * - Fogyatékos gyermek pótszabadság
 * - Apasági szabadság (10 nap)
 * - Szülői szabadság
 * - Tanulmányi szabadság
 * - Egyéb rendkívüli szabadság (pl. haláleset)
 * - Szabadság-mérleg óraalapú nyilvántartása is
 */

// ── Típusok ──

export interface LeaveBalance {
  baseLeave: number;
  ageSupplement: number;
  childSupplement: number;
  disabledChildSupplement: number;
  extraLeave: number;
  totalAnnual: number;
  carriedOver: number;
  totalAvailable: number;
  used: number;
  remaining: number;

  // ── Részletes bontás (napokban) ──
  paternityLeave: number;
  parentalLeave: number;
  studyLeave: number;
  extraordinaryLeave: number;

  // ── Óraalapú átszámítások ──
  baseLeaveHours: number;
  ageSupplementHours: number;
  childSupplementHours: number;
  disabledChildSupplementHours: number;
  extraLeaveHours: number;
  totalAnnualHours: number;
  carriedOverHours: number;
  totalAvailableHours: number;
  usedHours: number;
  remainingHours: number;
}

export interface EmployeeLeaveInput {
  ageAtYearStart: number;
  childrenUnder16: number;
  disabledChildren: number;
  carriedOverDays: number;
  extraLeaveDays: number;
  paternityDays?: number;
  parentalDays?: number;
  studyDays?: number;
  extraordinaryDays?: number;
  employmentStartDate?: Date;
  employmentEndDate?: Date;
  year: number;
  usedDays: number;
  
  // Napi munkaóra az óra alapú számításhoz (alapértelmezetten 8)
  dailyHours?: number;
}

// ── Szabadság konstansok (Mt.) ──

const BASE_LEAVE_DAYS = 20;
const MAX_CARRY_OVER = 60;

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

// ── Életkori pótszabadság ──

export function calculateAgeSupplement(age: number): number {
  for (const [minAge, days] of AGE_SUPPLEMENT_TABLE) {
    if (age >= minAge) return days;
  }
  return 0;
}

// ── Gyermek utáni pótszabadság ──

export function calculateChildSupplement(childrenUnder16: number): number {
  if (childrenUnder16 <= 0) return 0;
  if (childrenUnder16 === 1) return 2;
  if (childrenUnder16 === 2) return 4;
  return 7;
}

// ── Fogyatékos gyermek pótszabadság ──

export function calculateDisabledChildSupplement(disabledChildren: number): number {
  return disabledChildren * 2;
}

// ── Időarányos szabadság számítás ──

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

  const startMonth = effectiveStart.getMonth();
  const endMonth = effectiveEnd.getMonth();
  const months = endMonth - startMonth + 1;

  return Math.round(totalDays * (months / 12));
}

// ── Fő szabadság-mérleg számítás ──

export function calculateLeaveBalance(input: EmployeeLeaveInput): LeaveBalance {
  const ageSupplement = calculateAgeSupplement(input.ageAtYearStart);
  const childSupplement = calculateChildSupplement(input.childrenUnder16);
  const disabledChildSupplement = calculateDisabledChildSupplement(input.disabledChildren);
  const dailyHours = input.dailyHours || 8;

  let totalAnnual = BASE_LEAVE_DAYS + ageSupplement + childSupplement + disabledChildSupplement + input.extraLeaveDays;

  // Időarányosítás
  if (input.employmentStartDate || input.employmentEndDate) {
    totalAnnual = calculateProRata(
      totalAnnual,
      input.year,
      input.employmentStartDate,
      input.employmentEndDate
    );
  }

  const carriedOver = Math.min(input.carriedOverDays, MAX_CARRY_OVER);
  const totalAvailable = totalAnnual + carriedOver;
  const remaining = totalAvailable - input.usedDays;

  const paternityLeave = input.paternityDays || 0;
  const parentalLeave = input.parentalDays || 0;
  const studyLeave = input.studyDays || 0;
  const extraordinaryLeave = input.extraordinaryDays || 0;

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

    // Részletes
    paternityLeave,
    parentalLeave,
    studyLeave,
    extraordinaryLeave,

    // Óraalapú átszámítások
    baseLeaveHours: BASE_LEAVE_DAYS * dailyHours,
    ageSupplementHours: ageSupplement * dailyHours,
    childSupplementHours: childSupplement * dailyHours,
    disabledChildSupplementHours: disabledChildSupplement * dailyHours,
    extraLeaveHours: input.extraLeaveDays * dailyHours,
    totalAnnualHours: totalAnnual * dailyHours,
    carriedOverHours: carriedOver * dailyHours,
    totalAvailableHours: totalAvailable * dailyHours,
    usedHours: input.usedDays * dailyHours,
    remainingHours: Math.max(0, remaining) * dailyHours,
  };
}

// ── Betegszabadság ──

export interface SickLeaveResult {
  availableDays: number;
  usedDays: number;
  remainingDays: number;
  dailyRate: number;
  availableHours: number;
  usedHours: number;
  remainingHours: number;
}

export function calculateSickLeave(
  dailyAbsencePay: number,
  usedSickDays: number,
  dailyHours: number = 8
): SickLeaveResult {
  const maxDays = 15;
  return {
    availableDays: maxDays,
    usedDays: usedSickDays,
    remainingDays: Math.max(0, maxDays - usedSickDays),
    dailyRate: Math.round(dailyAbsencePay * 0.70),
    
    // Óra alapú sick leave
    availableHours: maxDays * dailyHours,
    usedHours: usedSickDays * dailyHours,
    remainingHours: Math.max(0, maxDays - usedSickDays) * dailyHours,
  };
}

// ── Szabadság-megváltás ──

export interface LeavePayoutResult {
  daysToPayOut: number;
  dailyAbsencePay: number;
  payoutAmount: number;
}

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
