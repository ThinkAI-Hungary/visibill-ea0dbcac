/**
 * TENY M1.5 – fejlesztési tartalék monitoring: fel nem használt tartalék lejárati riasztás,
 * visszafizetési kötelezettség és késedelmi pótlék becslés, elidegenítési tilalom ellenőrzés.
 *
 * FIGYELEM – jogszabályi paraméterek: az alábbi konstansok a TENY implementációs terv (D-döntések)
 * szerinti ajánlott értékek. A kalkuláció TÁJÉKOZTATÓ becslés; a ténylegesen fizetendő összeget a
 * bevallás és az aktuális MNB alapkamat határozza meg (a kamat paraméterként felülírható).
 */

/** Társasági adó általános kulcsa (Tao tv. 19. §). */
export const CORPORATE_TAX_RATE = 0.09;

/** Késedelmi pótlék = jegybanki alapkamat + 5 százalékpont (terv szerint, Tao tv. 7. § (15) hivatkozással). */
export const PENALTY_SURCHARGE_POINTS = 5;

/** MNB alapkamat alapértéke (%), a hívó felülírhatja. Ellenőrizendő az aktuális értékkel. */
export const DEFAULT_MNB_BASE_RATE_PERCENT = 6.5;

/** A tartalékot a képzés évét követő 4. adóév végéig kell felhasználni. */
export const RESERVE_USAGE_YEARS = 4;

/** Elidegenítési / kivonási tilalom hossza az üzembe helyezés évét követően (év). Konzervatív érték: 5. */
export const ALIENATION_PROTECTION_YEARS = 5;

export type ReserveExpiryLevel = 'ok' | 'warning' | 'critical' | 'overdue';

export interface ReserveLike {
  id: string;
  creation_year: number;
  reserve_amount: number;
  remaining_amount?: number;
  expiration_date: string;
}

export interface ReserveExpiryAssessment {
  level: ReserveExpiryLevel;
  /** A képzés évéhez képest eltelt adóévek (0 = képzés éve). */
  yearIndex: number;
  /** Az utolsó felhasználási nap (ISO). */
  deadline: string;
  daysToDeadline: number;
  remaining: number;
}

const pad = (n: number) => String(n).padStart(2, '0');
const round0 = (n: number) => Math.round(n);

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toIsoDate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((parseIso(toIso).getTime() - parseIso(fromIso).getTime()) / 86_400_000);
}

/** A felhasználási határidő: a képzés évét követő 4. adóév utolsó napja (alapértelmezés). */
export function getReserveDeadline(creationYear: number): string {
  return `${creationYear + RESERVE_USAGE_YEARS}-12-31`;
}

/**
 * A fel nem használt tartalék lejárati szintje:
 * - ok: 3. adóév előtt vagy nincs fel nem használt rész
 * - warning: a képzést követő 3. adóévben (még 1+ év)
 * - critical: a képzést követő 4. (záró) adóévben
 * - overdue: a határidő lejárt, a fel nem használt rész után adóalap-növelés + pótlék
 */
export function assessReserveExpiry(reserve: ReserveLike, asOf: string): ReserveExpiryAssessment {
  const remaining = Math.max(0, reserve.remaining_amount ?? reserve.reserve_amount);
  const asOfYear = parseIso(asOf).getUTCFullYear();
  const yearIndex = asOfYear - reserve.creation_year;
  const deadline = reserve.expiration_date || getReserveDeadline(reserve.creation_year);
  const daysToDeadline = daysBetween(asOf, deadline);

  let level: ReserveExpiryLevel = 'ok';
  if (remaining > 0) {
    if (daysToDeadline < 0) level = 'overdue';
    else if (yearIndex >= RESERVE_USAGE_YEARS) level = 'critical';
    else if (yearIndex >= RESERVE_USAGE_YEARS - 1) level = 'warning';
  }
  return { level, yearIndex, deadline, daysToDeadline, remaining };
}

export interface PenaltyEstimate {
  /** Adóalap-növelés (a fel nem használt tartalék). */
  taxBaseIncrease: number;
  /** Visszafizetendő társasági adó (9%). */
  corporateTax: number;
  /** Az adó esedékessége (a határidő évét követő év május 31.). */
  taxDueDate: string;
  /** Késedelmes napok az `asOf`-ig. */
  lateDays: number;
  /** Éves pótlékkulcs (%). */
  annualRatePercent: number;
  /** Késedelmi pótlék becslés. */
  penalty: number;
  total: number;
}

/**
 * Fel nem használt tartalék visszafizetési kötelezettsége és késedelmi pótlék becslése.
 * A pótlék naponta az éves kulcs 1/365-öd része az esedékesség napját követő naptól `asOf`-ig.
 */
export function estimateUnusedReservePenalty(params: {
  remaining: number;
  deadline: string;
  asOf: string;
  mnbBaseRatePercent?: number;
}): PenaltyEstimate {
  const taxBaseIncrease = Math.max(0, params.remaining);
  const corporateTax = round0(taxBaseIncrease * CORPORATE_TAX_RATE);
  const deadlineYear = parseIso(params.deadline).getUTCFullYear();
  const taxDueDate = `${deadlineYear + 1}-05-31`;
  const lateDays = Math.max(0, daysBetween(taxDueDate, params.asOf));
  const annualRatePercent = (params.mnbBaseRatePercent ?? DEFAULT_MNB_BASE_RATE_PERCENT) + PENALTY_SURCHARGE_POINTS;
  const penalty = round0(corporateTax * (annualRatePercent / 100) * (lateDays / 365));
  return {
    taxBaseIncrease,
    corporateTax,
    taxDueDate,
    lateDays,
    annualRatePercent,
    penalty,
    total: corporateTax + penalty,
  };
}

export interface AlienationCheck {
  restricted: boolean;
  /** A védett időszak utolsó napja (ISO), ha van tartalék-felhasználás. */
  protectedUntil: string | null;
  /** A tartalékból finanszírozott összeg, amely a visszafizetési kötelezettség alapja lehet. */
  reserveAmount: number;
  estimatedTax: number;
  estimatedPenalty: number;
}

/**
 * Elidegenítési / üzemeltetésből kivonási tilalom: ha az eszköz fejlesztési tartalékból (is) készült,
 * és a kivezetés a védett időszakon belül történik, a tartalék visszafizetési kötelezettségét
 * (adóalap-növelés + késedelmi pótlék) jelezni kell.
 */
export function checkAlienationRestriction(params: {
  activationDate: string | null | undefined;
  disposalDate: string;
  developmentReserveAmount: number | null | undefined;
  /** A pótlék-becslés „ma” dátuma; alapértelmezés: a kivezetés napja. */
  asOf?: string;
  mnbBaseRatePercent?: number;
}): AlienationCheck {
  const reserveAmount = Math.max(0, Number(params.developmentReserveAmount) || 0);
  if (reserveAmount <= 0 || !params.activationDate) {
    return { restricted: false, protectedUntil: null, reserveAmount, estimatedTax: 0, estimatedPenalty: 0 };
  }

  const activationYear = parseIso(params.activationDate).getUTCFullYear();
  const protectedUntil = `${activationYear + ALIENATION_PROTECTION_YEARS}-12-31`;
  const restricted = params.disposalDate <= protectedUntil;
  if (!restricted) {
    return { restricted: false, protectedUntil, reserveAmount, estimatedTax: 0, estimatedPenalty: 0 };
  }

  const estimate = estimateUnusedReservePenalty({
    remaining: reserveAmount,
    // A visszafizetés a kivezetés adóévére esedékes: a határidő a kivezetés éve utolsó napja.
    deadline: `${parseIso(params.disposalDate).getUTCFullYear()}-12-31`,
    asOf: params.asOf ?? params.disposalDate,
    mnbBaseRatePercent: params.mnbBaseRatePercent,
  });

  return {
    restricted: true,
    protectedUntil,
    reserveAmount,
    estimatedTax: estimate.corporateTax,
    estimatedPenalty: estimate.penalty,
  };
}
