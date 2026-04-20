import type { DepreciationResult } from '@/types/fixed-assets';

/**
 * Lineáris, napra pontos kettős amortizáció kalkulátor.
 *
 * - Számviteli: (bekerülési - maradványérték) / hasznos_hónapok per hónap
 * - Tao: bekerülési * (tao_kulcs% / 100) / 12 per hónap
 * - Mindkettő megáll disposalDate-nél vagy ha a könyv szerinti érték eléri a minimumot
 */
export function calculateDepreciation(params: {
  acquisitionValue: number;
  residualValue: number;
  activationDate: Date;
  usefulLifeMonths: number;
  taoRatePercent: number;
  calculationDate?: Date;
  disposalDate?: Date;
}): DepreciationResult {
  const {
    acquisitionValue,
    residualValue,
    activationDate,
    usefulLifeMonths,
    taoRatePercent,
    calculationDate = new Date(),
    disposalDate,
  } = params;

  const endDate = disposalDate && disposalDate < calculationDate ? disposalDate : calculationDate;

  // Eltelt hónapok kiszámítása (napra pontosan)
  const elapsedMs = Math.max(0, endDate.getTime() - activationDate.getTime());
  const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
  const elapsedMonths = elapsedDays / 30.4375; // átlagos hónap hossz

  // ── Számviteli ÉCS (Accounting) ──
  const accountingDepreciableBase = Math.max(0, acquisitionValue - residualValue);
  const accountingMonthly = usefulLifeMonths > 0
    ? accountingDepreciableBase / usefulLifeMonths
    : 0;
  const accountingRatePercent = usefulLifeMonths > 0
    ? (12 / usefulLifeMonths) * 100
    : 0;
  const rawAccountingAccumulated = accountingMonthly * elapsedMonths;
  const accountingAccumulated = Math.min(rawAccountingAccumulated, accountingDepreciableBase);
  const accountingBookValue = Math.max(residualValue, acquisitionValue - accountingAccumulated);

  // ── Tao ÉCS (Tax) ──
  const taxMonthly = acquisitionValue * (taoRatePercent / 100) / 12;
  const rawTaxAccumulated = taxMonthly * elapsedMonths;
  const taxAccumulated = Math.min(rawTaxAccumulated, acquisitionValue);
  const taxBookValue = Math.max(0, acquisitionValue - taxAccumulated);

  return {
    accounting: {
      monthly: Math.round(accountingMonthly),
      accumulated: Math.round(accountingAccumulated),
      bookValue: Math.round(accountingBookValue),
      ratePercent: Math.round(accountingRatePercent * 100) / 100,
    },
    tax: {
      monthly: Math.round(taxMonthly),
      accumulated: Math.round(taxAccumulated),
      bookValue: Math.round(taxBookValue),
      ratePercent: taoRatePercent,
    },
  };
}
