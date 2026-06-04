/**
 * Accounty Bérszámfejtési Modul — Bérpótlék és túlóra kalkulátor
 *
 * Mt. 139-145. § alapján:
 * - Műszakpótlék (30%)
 * - Éjszakai pótlék (30%)
 * - Vasárnapi pótlék (50%)
 * - Munkaszüneti pótlék (100%)
 * - Túlóra pótlék (50% / 100%)
 * - Készenlét (20% / 40%)
 * - Túlóra-keret figyelő (Mt. 250 / KSZ 400 óra)
 */

// ── Típusok ──

export interface PremiumRates {
  /** Műszakpótlék (14-22h) */
  shift: number;
  /** Éjszakai pótlék (22-06h) */
  night: number;
  /** Vasárnapi pótlék */
  sunday: number;
  /** Munkaszüneti pótlék */
  holiday: number;
  /** Túlóra pótlék (munkanapon) */
  overtimeWeekday: number;
  /** Túlóra pótlék (pihenőnapon) */
  overtimeRest: number;
  /** Készenlét (munkahelyen) */
  standbyOnSite: number;
  /** Készenlét (otthon) */
  standbyHome: number;
}

export interface PremiumInput {
  /** Alap órabér (alapbér / havi munkaórák) */
  hourlyRate: number;
  /** Műszak-órák (14-22h között) */
  shiftHours: number;
  /** Éjszakai órák (22-06h között) */
  nightHours: number;
  /** Vasárnapi munkavégzés órák */
  sundayHours: number;
  /** Munkaszüneti napi munkavégzés órák */
  holidayHours: number;
  /** Túlóra óra (munkanapon) */
  overtimeWeekdayHours: number;
  /** Túlóra óra (pihenőnapon) */
  overtimeRestHours: number;
  /** Készenlét órák (helyszínen) */
  standbyOnSiteHours: number;
  /** Készenlét órák (otthon) */
  standbyHomeHours: number;
  /** Egyedi KSZ pótlékok */
  customPremiums: Array<{ name: string; hours: number; ratePct: number }>;
}

export interface PremiumResult {
  /** Minden pótlék részletezve */
  items: PremiumItem[];
  /** Összes pótlék összeg */
  totalAmount: number;
}

export interface PremiumItem {
  type: string;
  name: string;
  hours: number;
  ratePct: number;
  hourlyRate: number;
  amount: number;
}

// ── Alapértelmezett pótlék mértékek (Mt.) ──

export const DEFAULT_PREMIUM_RATES: PremiumRates = {
  shift: 0.30,         // Mt. 141. §
  night: 0.30,         // Mt. 142. §
  sunday: 0.50,        // Mt. 140. §
  holiday: 1.00,       // Mt. 140. §
  overtimeWeekday: 0.50, // Mt. 143. §
  overtimeRest: 1.00,   // Mt. 143. § (pihenőnapon)
  standbyOnSite: 0.40,  // Mt. 144. §
  standbyHome: 0.20,    // Mt. 144. §
};

// ── Kalkuláció ──

/**
 * Bérpótlékok számítása.
 */
export function calculatePremiums(
  input: PremiumInput,
  rates: PremiumRates = DEFAULT_PREMIUM_RATES
): PremiumResult {
  const items: PremiumItem[] = [];
  const { hourlyRate } = input;

  // Műszakpótlék
  if (input.shiftHours > 0) {
    items.push({
      type: 'shift',
      name: 'Műszakpótlék (30%)',
      hours: input.shiftHours,
      ratePct: rates.shift * 100,
      hourlyRate: Math.round(hourlyRate * rates.shift),
      amount: Math.round(hourlyRate * rates.shift * input.shiftHours),
    });
  }

  // Éjszakai pótlék
  if (input.nightHours > 0) {
    items.push({
      type: 'night',
      name: 'Éjszakai pótlék (30%)',
      hours: input.nightHours,
      ratePct: rates.night * 100,
      hourlyRate: Math.round(hourlyRate * rates.night),
      amount: Math.round(hourlyRate * rates.night * input.nightHours),
    });
  }

  // Vasárnapi pótlék
  if (input.sundayHours > 0) {
    items.push({
      type: 'sunday',
      name: 'Vasárnapi pótlék (50%)',
      hours: input.sundayHours,
      ratePct: rates.sunday * 100,
      hourlyRate: Math.round(hourlyRate * rates.sunday),
      amount: Math.round(hourlyRate * rates.sunday * input.sundayHours),
    });
  }

  // Munkaszüneti pótlék
  if (input.holidayHours > 0) {
    items.push({
      type: 'holiday',
      name: 'Munkaszüneti pótlék (100%)',
      hours: input.holidayHours,
      ratePct: rates.holiday * 100,
      hourlyRate: Math.round(hourlyRate * rates.holiday),
      amount: Math.round(hourlyRate * rates.holiday * input.holidayHours),
    });
  }

  // Túlóra (munkanapon)
  if (input.overtimeWeekdayHours > 0) {
    items.push({
      type: 'overtime_weekday',
      name: 'Túlóra munkanapon (50%)',
      hours: input.overtimeWeekdayHours,
      ratePct: rates.overtimeWeekday * 100,
      hourlyRate: Math.round(hourlyRate * rates.overtimeWeekday),
      amount: Math.round(hourlyRate * rates.overtimeWeekday * input.overtimeWeekdayHours),
    });
  }

  // Túlóra (pihenőnapon)
  if (input.overtimeRestHours > 0) {
    items.push({
      type: 'overtime_rest',
      name: 'Túlóra pihenőnapon (100%)',
      hours: input.overtimeRestHours,
      ratePct: rates.overtimeRest * 100,
      hourlyRate: Math.round(hourlyRate * rates.overtimeRest),
      amount: Math.round(hourlyRate * rates.overtimeRest * input.overtimeRestHours),
    });
  }

  // Készenlét (helyszínen)
  if (input.standbyOnSiteHours > 0) {
    items.push({
      type: 'standby_onsite',
      name: 'Készenlét helyszínen (40%)',
      hours: input.standbyOnSiteHours,
      ratePct: rates.standbyOnSite * 100,
      hourlyRate: Math.round(hourlyRate * rates.standbyOnSite),
      amount: Math.round(hourlyRate * rates.standbyOnSite * input.standbyOnSiteHours),
    });
  }

  // Készenlét (otthon)
  if (input.standbyHomeHours > 0) {
    items.push({
      type: 'standby_home',
      name: 'Készenlét otthon (20%)',
      hours: input.standbyHomeHours,
      ratePct: rates.standbyHome * 100,
      hourlyRate: Math.round(hourlyRate * rates.standbyHome),
      amount: Math.round(hourlyRate * rates.standbyHome * input.standbyHomeHours),
    });
  }

  // Egyedi KSZ pótlékok
  for (const custom of input.customPremiums) {
    if (custom.hours > 0) {
      const rateFraction = custom.ratePct / 100;
      items.push({
        type: 'custom',
        name: custom.name,
        hours: custom.hours,
        ratePct: custom.ratePct,
        hourlyRate: Math.round(hourlyRate * rateFraction),
        amount: Math.round(hourlyRate * rateFraction * custom.hours),
      });
    }
  }

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

  return { items, totalAmount };
}

// ── Túlóra-keret figyelő ──

export interface OvertimeTrackerResult {
  /** Éves limit (Mt. 250 vagy KSZ 400) */
  annualLimit: number;
  /** Eddig felhasznált túlóra */
  usedHours: number;
  /** Fennmaradó keret */
  remainingHours: number;
  /** Kihasználtság % */
  usagePct: number;
  /** Figyelmeztetési szint */
  warningLevel: 'ok' | 'warning' | 'critical' | 'exceeded';
}

/**
 * Túlóra-keret figyelő.
 *
 * Mt. 109. §: Évi 250 óra (vagy KSZ alapján max. 400 óra).
 * - >75%: warning (sárga)
 * - >90%: critical (narancs)
 * - >100%: exceeded (piros)
 */
export function trackOvertime(
  usedHours: number,
  annualLimit: number = 250
): OvertimeTrackerResult {
  const remainingHours = Math.max(0, annualLimit - usedHours);
  const usagePct = (usedHours / annualLimit) * 100;

  let warningLevel: OvertimeTrackerResult['warningLevel'];
  if (usagePct > 100) {
    warningLevel = 'exceeded';
  } else if (usagePct > 90) {
    warningLevel = 'critical';
  } else if (usagePct > 75) {
    warningLevel = 'warning';
  } else {
    warningLevel = 'ok';
  }

  return {
    annualLimit,
    usedHours,
    remainingHours,
    usagePct: Math.round(usagePct * 10) / 10,
    warningLevel,
  };
}

// ── Órabér kalkulátor ──

/**
 * Havi alapbér → órabér konverzió.
 *
 * Általános havi munkaórák: heti órák × 4.348 (átlagos heti szorzó)
 */
export function monthlyToHourly(
  monthlySalary: number,
  weeklyHours: number = 40
): number {
  const monthlyHours = weeklyHours * 4.348; // 52 hét / 12 hónap ≈ 4.348
  return Math.round((monthlySalary / monthlyHours) * 100) / 100;
}
