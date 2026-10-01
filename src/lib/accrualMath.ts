/**
 * accrualMath.ts
 *
 * Számviteli segédfüggvények időbeli elhatárolásokhoz (AIE / PIE) és időarányos felosztásokhoz.
 * Támogatja az exakt naparányos és a kerek hónapos felosztási módokat, valamint a számlatétel
 * szövegéből történő intelligens dátumfelismerést.
 */

export interface DateRangeExtraction {
  startDate: string; // ISO: YYYY-MM-DD
  endDate: string;   // ISO: YYYY-MM-DD
  matchedText: string;
}

export interface AccrualSplitOptions {
  amount: number;
  startDate: string | Date;
  endDate: string | Date;
  method?: 'daily' | 'monthly';
  direction?: 'INBOUND' | 'OUTBOUND';
  cutoffDate?: string | Date; // Alapértelmezett: a kezdő év dec. 31.
}

export interface AccrualSplitResult {
  totalDays: number;
  currentPeriodDays: number;
  nextPeriodDays: number;
  totalMonths: number;
  currentPeriodMonths: number;
  nextPeriodMonths: number;
  currentPeriodAmount: number;
  accrualAmount: number;
  accrualType: 'AIE' | 'PIE';
  accrualDate: string; // ISO: YYYY-MM-DD (pl. 2026-12-31)
  reversalDate: string; // ISO: YYYY-MM-DD (pl. 2027-01-01)
  suggestedDebitGl: string;
  suggestedCreditGl: string;
  hasCrossYearOverlap: boolean;
}

/**
 * Szöveges számlatétel megnevezéséből keres és von ki dátumtartományt.
 * Támogatott formátumok pl.:
 * - "2026.09.01.-2027.08.31."
 * - "2026.09.01 - 2027.08.31"
 * - "2026. 09. 01. – 2027. 08. 31."
 * - "2026-09-01 - 2027-08-31"
 * - "(Időszak: 2026.09.01.-2027.08.31.)"
 */
export function extractDateRangeFromText(text: string | null | undefined): DateRangeExtraction | null {
  if (!text || typeof text !== 'string') return null;

  // Regex 1: Magyar pontozott formátum: YYYY.MM.DD.[ -/–—]YYYY.MM.DD. (opcionális szóközökkel és pontokkal)
  const huPattern = /(\b\d{4})[.\s]+(\d{1,2})[.\s]+(\d{1,2})\.?[ ]*[-–—/][ ]*(\d{4})[.\s]+(\d{1,2})[.\s]+(\d{1,2})\.?/;
  const huMatch = text.match(huPattern);
  if (huMatch) {
    const [, y1, m1, d1, y2, m2, d2] = huMatch;
    const startStr = `${y1}-${m1.padStart(2, '0')}-${d1.padStart(2, '0')}`;
    const endStr = `${y2}-${m2.padStart(2, '0')}-${d2.padStart(2, '0')}`;
    if (isValidDateString(startStr) && isValidDateString(endStr)) {
      return {
        startDate: startStr,
        endDate: endStr,
        matchedText: huMatch[0].trim(),
      };
    }
  }

  // Regex 2: ISO kötőjeles formátum: YYYY-MM-DD[ -/–—]YYYY-MM-DD
  const isoPattern = /(\b\d{4})-(\d{2})-(\d{2})[ ]*[-–—/][ ]*(\d{4})-(\d{2})-(\d{2})/;
  const isoMatch = text.match(isoPattern);
  if (isoMatch) {
    const [, y1, m1, d1, y2, m2, d2] = isoMatch;
    const startStr = `${y1}-${m1}-${d1}`;
    const endStr = `${y2}-${m2}-${d2}`;
    if (isValidDateString(startStr) && isValidDateString(endStr)) {
      return {
        startDate: startStr,
        endDate: endStr,
        matchedText: isoMatch[0].trim(),
      };
    }
  }

  return null;
}

function isValidDateString(str: string): boolean {
  const d = new Date(str);
  return !isNaN(d.getTime());
}

function parseToUtcDate(d: string | Date): Date {
  if (d instanceof Date) {
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  }
  const parts = d.split('T')[0].split('-').map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  }
  const parsed = new Date(d);
  return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
}

function formatUtcIso(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Kiszámolja a napok számát két UTC dátum között, mindkét határnapot beleértve (+1 nap).
 */
function diffDaysInclusive(from: Date, to: Date): number {
  const msPerDay = 86400000;
  const diffMs = to.getTime() - from.getTime();
  return Math.round(diffMs / msPerDay) + 1;
}

/**
 * Kiszámítja a becsült hónapok számát két dátum között.
 */
function estimateMonthsInclusive(from: Date, to: Date): number {
  const yDiff = to.getUTCFullYear() - from.getUTCFullYear();
  const mDiff = to.getUTCMonth() - from.getUTCMonth();
  return yDiff * 12 + mDiff + 1;
}

/**
 * Fő elhatárolási kalkulátor függvény.
 * Naparányosan vagy hónaparányosan felosztja a bizonylat összegét a tárgyév és a következő év között.
 */
export function calculateAccrualSplit(options: AccrualSplitOptions): AccrualSplitResult {
  const {
    amount,
    startDate,
    endDate,
    method = 'daily',
    direction = 'INBOUND',
    cutoffDate,
  } = options;

  const start = parseToUtcDate(startDate);
  const end = parseToUtcDate(endDate);

  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();

  // Alapértelmezett fordulónap: a kezdő év dec. 31.
  const defaultCutoff = new Date(Date.UTC(startYear, 11, 31));
  const cutoff = cutoffDate ? parseToUtcDate(cutoffDate) : defaultCutoff;
  const reversal = new Date(cutoff.getTime() + 86400000); // Fordulónapot követő 1. nap (jan. 1.)

  const totalDays = Math.max(0, diffDaysInclusive(start, end));
  
  // Tárgyévi napok: start-tól a cutoff-ig (vagy ha end korábbi, end-ig)
  const currentEnd = end < cutoff ? end : cutoff;
  const currentPeriodDays = Math.max(0, diffDaysInclusive(start, currentEnd));

  // Következő évi napok: az évforduló utáni napok
  const nextPeriodDays = Math.max(0, totalDays - currentPeriodDays);

  // Hónapok számítása
  const totalMonths = Math.max(1, estimateMonthsInclusive(start, end));
  const currentPeriodMonths = Math.max(1, estimateMonthsInclusive(start, currentEnd));
  const nextPeriodMonths = Math.max(0, totalMonths - currentPeriodMonths);

  const hasCrossYearOverlap = endYear > startYear && nextPeriodDays > 0;

  let accrualAmount = 0;
  let currentPeriodAmount = amount;

  if (hasCrossYearOverlap && totalDays > 0) {
    if (method === 'daily') {
      accrualAmount = Math.round((amount * nextPeriodDays) / totalDays);
    } else {
      accrualAmount = Math.round((amount * nextPeriodMonths) / totalMonths);
    }
    // Szigorú egyezőség védelem (Falsy Zero & Zero Discrepancy):
    // currentPeriodAmount + accrualAmount mindig pontosan egyenlő az eredeti összeggel
    currentPeriodAmount = amount - accrualAmount;
  }

  // Típus és javasolt számlák:
  // INBOUND (költségszámla átnyúlása): AIE -> T 392 (Költségek aktív időbeli elhatárolása)
  // OUTBOUND (bevételi számla átnyúlása): PIE -> K 481 (Bevételek passzív időbeli elhatárolása)
  const accrualType = direction === 'INBOUND' ? 'AIE' : 'PIE';
  const suggestedDebitGl = accrualType === 'AIE' ? '392' : '';
  const suggestedCreditGl = accrualType === 'PIE' ? '481' : '';

  return {
    totalDays,
    currentPeriodDays,
    nextPeriodDays,
    totalMonths,
    currentPeriodMonths,
    nextPeriodMonths,
    currentPeriodAmount,
    accrualAmount,
    accrualType,
    accrualDate: formatUtcIso(cutoff),
    reversalDate: formatUtcIso(reversal),
    suggestedDebitGl,
    suggestedCreditGl,
    hasCrossYearOverlap,
  };
}
