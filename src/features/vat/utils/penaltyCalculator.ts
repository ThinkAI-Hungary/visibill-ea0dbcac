/**
 * Art. (2017. évi CLI. törvény 211. §) szerinti önellenőrzési pótlék kalkulátor
 */

export interface PenaltyCalculationParams {
  /** Adókülönbözet (pozitív = az adóhatóság javára, fizetendő; negatív = adózó javára) */
  taxDifferenceHuf: number;
  /** Bevallási év (pl. 2026) */
  year?: number;
  periodYear?: number;
  /** Bevallási időszak hónapja (1-12) vagy negyedéve (1-4) */
  periodMonth?: number;
  month?: number;
  /** Bevallási gyakoriság: 'H' (havi), 'N' (negyedéves), 'E' (éves) */
  frequency?: 'H' | 'N' | 'E';
  /** Önellenőrzés benyújtásának dátuma (alapértelmezett: ma) */
  filingDate?: Date | string;
  selfRevisionDate?: Date | string;
  /** Jegybanki alapkamat évi mértéke törtként (pl. 0.065 = 6.50%) */
  baseInterestRate?: number;
  /** Önellenőrzés sorszáma adott időszakra (1 = első önellenőrzés [50% kamat], 2+ = ismételt [100% kamat]) */
  revisionOrder?: number;
  isRepeatedRevision?: boolean;
}

export interface PenaltyCalculationResult {
  /** Törvényes esedékességi határidő (pl. 2026-02-20) */
  dueDate: string;
  /** Önellenőrzés napja */
  filingDate: string;
  /** Késedelmi napok száma */
  delayDays: number;
  /** Alkalmazott alapkamat éves mértéke százalékban (pl. 6.5) */
  baseInterestRatePercent: number;
  /** Alkalmazott pótlékkulcs szorzó (0.5 az 1. önellenőrzésnél, 1.0 az ismételtnél) */
  multiplier: number;
  /** Adókülönbözet összege (HUF) */
  taxDifferenceHuf: number;
  /** Számított önellenőrzési pótlék kereken forintban (0 ha adózó javára tér el) */
  penaltyAmountHuf: number;
  /** Magyarázó szöveg a 65-ös főlaphoz */
  explanation: string;
}

function toSafeDate(d?: Date | string | null): Date {
  if (!d) return new Date();
  const parsed = d instanceof Date ? d : new Date(d);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

function formatDateString(d: Date): string {
  try {
    return d.toISOString().slice(0, 10);
  } catch {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
}

/**
 * Kiszámítja az ÁFA bevallás eredeti törvényes benyújtási határidejét (tárgyidőszakot követő hó 20.)
 */
export function getVatStatutoryDueDate(year?: number, periodMonth?: number, frequency: 'H' | 'N' | 'E' = 'H'): Date {
  const safeYear = Number(year) || new Date().getFullYear();
  const safeMonth = Number(periodMonth) || (new Date().getMonth() + 1);

  let dueYear = safeYear;
  let dueMonth = safeMonth + 1; // 1-indexed

  if (frequency === 'N') {
    // Negyedéves: Q1 -> ápr 20, Q2 -> júl 20, Q3 -> okt 20, Q4 -> köv év jan 20
    dueMonth = safeMonth * 3 + 1;
  } else if (frequency === 'E') {
    // Éves: köv év február 25. vagy 20.
    dueYear = safeYear + 1;
    dueMonth = 2;
  }

  if (dueMonth > 12) {
    dueYear += Math.floor((dueMonth - 1) / 12);
    dueMonth = ((dueMonth - 1) % 12) + 1;
  }

  // 20-a (hónap 20. napja) UTC délben (12:00:00), hogy semmilyen időzóna-konverzió ne tolja el a naptári napot
  const d = new Date(Date.UTC(dueYear, dueMonth - 1, 20, 12, 0, 0));

  // Ha a határidő hétvégére esik, a következő munkanap a határidő
  const dayOfWeek = d.getUTCDay();
  if (dayOfWeek === 6) {
    d.setUTCDate(d.getUTCDate() + 2); // Szombat -> Hétfő
  } else if (dayOfWeek === 0) {
    d.setUTCDate(d.getUTCDate() + 1); // Vasárnap -> Hétfő
  }

  return d;
}

export const calculateStatutoryDueDate = getVatStatutoryDueDate;

/**
 * Kiszámítja az önellenőrzési pótlékot
 */
export function calculateSelfRevisionPenalty(params: PenaltyCalculationParams): PenaltyCalculationResult {
  const taxDifferenceHuf = Number(params.taxDifferenceHuf) || 0;
  const actualYear = params.year ?? params.periodYear ?? new Date().getFullYear();
  const actualMonth = params.periodMonth ?? params.month ?? (new Date().getMonth() + 1);
  const actualFrequency = params.frequency || 'H';
  const filingDate = toSafeDate(params.filingDate ?? params.selfRevisionDate);
  const baseInterestRate = params.baseInterestRate ?? 0.065;
  const revisionOrder = params.revisionOrder ?? (params.isRepeatedRevision ? 2 : 1);

  const dueDate = getVatStatutoryDueDate(actualYear, actualMonth, actualFrequency);

  // Normalizáljuk mindkét dátumot UTC nap kezdőpontra (00:00:00), hogy az óra-eltérések ne torzítsák a napok számát
  const dueUtcMidnight = Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
  const filingUtcMidnight = Date.UTC(filingDate.getUTCFullYear(), filingDate.getUTCMonth(), filingDate.getUTCDate());

  const diffTime = filingUtcMidnight - dueUtcMidnight;
  const delayDays = Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24)));

  // Szorzó: Első önellenőrzés esetén a jegybanki alapkamat 50%-a (0.5), ismételt esetén 100%-a (1.0)
  const multiplier = revisionOrder <= 1 ? 0.5 : 1.0;
  const rateFraction = baseInterestRate * multiplier;

  // Ha a pótlólagos adókülönbözet nem pozitív (az adózó javára mutat eltérést), nincs pótlék
  let penaltyAmountHuf = 0;
  let explanation = '';

  const dueDateStr = formatDateString(dueDate);
  const filingDateStr = formatDateString(filingDate);

  if (taxDifferenceHuf <= 0) {
    penaltyAmountHuf = 0;
    explanation = 'Az önellenőrzés az adózó javára mutat eltérést vagy egyező (Art. alapján 0 Ft pótlék).';
  } else if (delayDays === 0) {
    penaltyAmountHuf = 0;
    explanation = 'Határidőn belüli benyújtás / javítás (0 nap késedelem, 0 Ft pótlék).';
  } else {
    // Képlet: adókülönbözet * (késedelem napjai / 365) * (alapkamat * szorzó)
    const exactPenalty = taxDifferenceHuf * (delayDays / 365) * rateFraction;
    penaltyAmountHuf = Math.round(exactPenalty);
    
    // Art. minimum korlát: ha a pótlék < 1000 Ft, a törvény nem írja elő a megfizetését (Art. 211. §)
    explanation = `${delayDays} nap késedelem (${dueDateStr} óta), ${(baseInterestRate * 100).toFixed(2)}% alapkamat ${multiplier === 0.5 ? '50%-ával' : '100%-ával'}.`;
  }

  return {
    dueDate: dueDateStr,
    filingDate: filingDateStr,
    delayDays,
    baseInterestRatePercent: +(baseInterestRate * 100).toFixed(2),
    multiplier,
    taxDifferenceHuf,
    penaltyAmountHuf,
    explanation,
  };
}

export function formatHuf(amount: number): string {
  return `${new Intl.NumberFormat('hu-HU').format(Math.round(amount))} Ft`;
}
