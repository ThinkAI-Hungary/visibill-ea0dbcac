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

// ── Törzsadatokból és nyilatkozatokból szabadság bemenet feloldása ──

export interface ResolveLeaveInputParams {
  employee: { birth_date?: string | null } | null;
  dependents?: Array<{ birth_date?: string | null; is_fetus?: boolean | null; is_disabled?: boolean | null; disabled?: boolean | null }>;
  declarations?: Array<{ declaration_type: string; status: string; valid_from?: string | null; created_at?: string | null; parameters?: any }>;
  leaves?: Array<{ leave_type: string; status: string; days: number | string }>;
  primaryEmployment?: { start_date?: string | null; end_date?: string | null; weekly_hours?: number | string | null } | null;
  targetYear?: number;
}

export function resolveEmployeeLeaveInput(params: ResolveLeaveInputParams): EmployeeLeaveInput | null {
  const {
    employee,
    dependents = [],
    declarations = [],
    leaves = [],
    primaryEmployment,
    targetYear = new Date().getFullYear(),
  } = params;

  if (!employee?.birth_date) return null;

  const birthYear = new Date(employee.birth_date).getFullYear();
  const age = targetYear - birthYear;

  // Eltartott gyermekek száma (Mt. 118. §: 16. életévüket a tárgyévben vagy később betöltő gyermekek)
  const activeChildrenFromDeps = dependents.filter(d => {
    if (d.is_fetus) return false;
    if (d.birth_date) {
      const bYear = new Date(d.birth_date).getFullYear();
      return (targetYear - bYear) <= 16;
    }
    return true;
  });

  // Ha még nincsenek eltartottak az accounty_dependents-ben, ellenőrizzük az aktív családi vagy pótszabadság nyilatkozatot
  // Ha több aktív releváns nyilatkozat van, rendezzük őket valid_from DESC vagy created_at DESC szerint (legfrissebb az első)
  const relevantDeclarations = declarations
    .filter(d => 
      (d.declaration_type === 'family' || d.declaration_type === 'child_leave' || d.declaration_type === 'family_credit') && 
      d.status === 'active'
    )
    .sort((a, b) => {
      const aDate = a.valid_from || a.created_at || '';
      const bDate = b.valid_from || b.created_at || '';
      return bDate.localeCompare(aDate);
    });

  const familyDec = relevantDeclarations[0];
  const decChildren = Array.isArray((familyDec?.parameters as any)?.children)
    ? (familyDec?.parameters as any).children
    : null;
  const decChildrenCount = (familyDec?.parameters as any)?.children_count;

  let childrenUnder16 = activeChildrenFromDeps.length;
  if (childrenUnder16 === 0) {
    if (decChildren && decChildren.length > 0) {
      childrenUnder16 = decChildren.filter((c: any) => {
        if (c.is_fetus) return false;
        if (c.birth_date) {
          const bYear = new Date(c.birth_date).getFullYear();
          return (targetYear - bYear) <= 16;
        }
        return true;
      }).length;
    } else if (typeof decChildrenCount === 'number' && decChildrenCount > 0) {
      childrenUnder16 = decChildrenCount;
    }
  }

  // Fogyatékos gyermek pótszabadság (Mt. 118. § (2): gyermekenként +2 munkanap, a 16. életév betöltésének évéig az Mt. 118. § (3) szerint)
  const depsDisabledCount = dependents.filter(d => {
    if (!Boolean(d.is_disabled || d.disabled)) return false;
    if (d.birth_date) {
      const bYear = new Date(d.birth_date).getFullYear();
      return (targetYear - bYear) <= 16;
    }
    return true;
  }).length;

  const decDisabledCount = (decChildren && decChildren.length > 0)
    ? decChildren.filter((c: any) => {
        if (!Boolean(c.is_disabled || c.disabled)) return false;
        if (c.birth_date) {
          const bYear = new Date(c.birth_date).getFullYear();
          return (targetYear - bYear) <= 16;
        }
        return true;
      }).length
    : 0;

  const disabledChildren = Math.max(depsDisabledCount, decDisabledCount);

  // Megváltozott munkaképességű / fogyatékossági pótszabadság (Mt. 120. §: évi 5 munkanap)
  const hasPersonalDisability = declarations.some(d => d.declaration_type === 'personal' && d.status === 'active');
  const extraLeaveDays = hasPersonalDisability ? 5 : 0;

  // Napi munkaóra az időarányos/óraalapú nyilvántartáshoz
  const weeklyHours = primaryEmployment?.weekly_hours ? Number(primaryEmployment.weekly_hours) : 40;
  const dailyHours = weeklyHours > 0 ? weeklyHours / 5 : 8;

  const usedDays = leaves
    .filter(l => (l.leave_type === 'annual' || l.leave_type?.startsWith('additional_')) && l.status === 'approved')
    .reduce((s, l) => s + (Number(l.days) || 0), 0);

  return {
    ageAtYearStart: age,
    childrenUnder16,
    disabledChildren,
    carriedOverDays: 0,
    extraLeaveDays,
    employmentStartDate: primaryEmployment?.start_date ? new Date(primaryEmployment.start_date) : undefined,
    employmentEndDate: primaryEmployment?.end_date ? new Date(primaryEmployment.end_date) : undefined,
    dailyHours,
    year: targetYear,
    usedDays,
  };
}

