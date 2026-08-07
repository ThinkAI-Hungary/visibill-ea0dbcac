import type { DepreciationResult } from '@/types/fixed-assets';

/**
 * Lineáris, degresszív, progresszív, teljesítményarányos, abszolút, szorzószámos és azonnali ÉCS kalkulátor.
 *
 * - Számviteli: a kiválasztott módszer alapján (linear, degressive_syd, degressive_declining, progressive, performance, absolute, multiplier, immediate)
 * - Tao: bekerülési * (tao_kulcs% / 100) / 12 per hónap (mindig lineáris)
 * - Mindkettő megáll disposalDate-nél vagy ha eléri a maradványértéket
 */
export function calculateDepreciation(params: {
  acquisitionValue: number;
  residualValue: number;
  activationDate: Date;
  usefulLifeMonths: number;
  taoRatePercent: number;
  calculationDate?: Date;
  disposalDate?: Date;
  depreciationMethod?: string;
  performanceUnit?: string | null;
  totalPlannedPerformance?: number | null;
  depreciationSchedule?: number[] | null;
  performanceLogs?: Array<{ date: string | Date; amount: number }> | null;
}): DepreciationResult {
  const {
    acquisitionValue,
    residualValue,
    activationDate,
    usefulLifeMonths,
    taoRatePercent,
    calculationDate = new Date(),
    disposalDate,
    depreciationMethod = 'linear',
    totalPlannedPerformance,
    depreciationSchedule,
    performanceLogs,
  } = params;

  const endDate = disposalDate && disposalDate < calculationDate ? disposalDate : calculationDate;

  // Eltelt hónapok kiszámítása (naptári alapú, napra pontos törtrésszel)
  const startYear = activationDate.getFullYear();
  const startMonth = activationDate.getMonth();
  const startDay = activationDate.getDate();

  const endYear = endDate.getFullYear();
  const endMonth = endDate.getMonth();
  const endDay = endDate.getDate();

  const daysInEndMonth = new Date(endYear, endMonth + 1, 0).getDate();
  const dayDifference = endDay - startDay;
  const elapsedMonths = Math.max(0, (endYear - startYear) * 12 + (endMonth - startMonth) + dayDifference / daysInEndMonth);
  const elapsedYears = elapsedMonths / 12;

  const accountingDepreciableBase = Math.max(0, acquisitionValue - residualValue);
  let accountingAccumulated = 0;
  let accountingMonthly = 0;
  let accountingRatePercent = usefulLifeMonths > 0 ? (12 / usefulLifeMonths) * 100 : 0;

  // ── Számviteli ÉCS számítások ──
  if (endDate >= activationDate && accountingDepreciableBase > 0) {
    if (depreciationMethod === 'linear') {
      accountingMonthly = usefulLifeMonths > 0 ? accountingDepreciableBase / usefulLifeMonths : 0;
      accountingAccumulated = accountingMonthly * elapsedMonths;
    } 
    else if (depreciationMethod === 'degressive_syd') {
      const nYears = Math.ceil(usefulLifeMonths / 12) || 1;
      const S = (nYears * (nYears + 1)) / 2;
      
      let sumDep = 0;
      const currentYear = Math.floor(elapsedYears) + 1;
      
      for (let y = 1; y <= nYears; y++) {
        const yearlyDep = accountingDepreciableBase * (nYears - y + 1) / S;
        if (y < currentYear) {
          sumDep += yearlyDep;
        } else if (y === currentYear) {
          const frac = elapsedYears - (y - 1);
          sumDep += yearlyDep * frac;
          accountingMonthly = yearlyDep / 12;
        }
      }
      accountingAccumulated = sumDep;
      accountingRatePercent = S > 0 ? ((nYears / S) * 100) : 0;
    } 
    else if (depreciationMethod === 'degressive_declining') {
      // Declining Balance: 200% declining balance rate
      const nYears = usefulLifeMonths / 12 || 1;
      const annualRate = (2 / nYears);
      const monthlyRate = annualRate / 12;
      
      let currentAccumulated = 0;
      const fullMonths = Math.floor(elapsedMonths);
      for (let m = 0; m < fullMonths; m++) {
        const remainingDepreciable = Math.max(0, accountingDepreciableBase - currentAccumulated);
        const monthlyDep = Math.min(remainingDepreciable, (acquisitionValue - currentAccumulated) * monthlyRate);
        currentAccumulated += monthlyDep;
      }
      const remainingFrac = elapsedMonths - fullMonths;
      if (remainingFrac > 0) {
        const remainingDepreciable = Math.max(0, accountingDepreciableBase - currentAccumulated);
        const monthlyDep = Math.min(remainingDepreciable, (acquisitionValue - currentAccumulated) * monthlyRate * remainingFrac);
        currentAccumulated += monthlyDep;
      }
      
      accountingAccumulated = currentAccumulated;
      accountingMonthly = (acquisitionValue - accountingAccumulated) * monthlyRate;
      accountingRatePercent = annualRate * 100;
    }
    else if (depreciationMethod === 'progressive') {
      const nYears = Math.ceil(usefulLifeMonths / 12) || 1;
      const S = (nYears * (nYears + 1)) / 2;
      
      let sumDep = 0;
      const currentYear = Math.floor(elapsedYears) + 1;
      
      for (let y = 1; y <= nYears; y++) {
        const yearlyDep = accountingDepreciableBase * y / S;
        if (y < currentYear) {
          sumDep += yearlyDep;
        } else if (y === currentYear) {
          const frac = elapsedYears - (y - 1);
          sumDep += yearlyDep * frac;
          accountingMonthly = yearlyDep / 12;
        }
      }
      accountingAccumulated = sumDep;
      accountingRatePercent = S > 0 ? ((1 / S) * 100) : 0;
    }
    else if (depreciationMethod === 'performance') {
      const totalPlanned = Number(totalPlannedPerformance) || 1;
      const relevantLogs = performanceLogs || [];
      const totalActual = relevantLogs
        .filter(log => new Date(log.date) <= endDate)
        .reduce((sum, log) => sum + Number(log.amount), 0);
        
      accountingAccumulated = accountingDepreciableBase * (totalActual / totalPlanned);
      accountingMonthly = elapsedMonths > 0 ? accountingAccumulated / elapsedMonths : 0;
      accountingRatePercent = totalPlanned > 0 ? (totalActual / totalPlanned) * 100 : 0;
    }
    else if (depreciationMethod === 'absolute') {
      const schedule = depreciationSchedule || [];
      let sumDep = 0;
      const currentYear = Math.floor(elapsedYears) + 1;
      
      for (let y = 1; y <= schedule.length; y++) {
        const yearlyDep = Number(schedule[y - 1]) || 0;
        if (y < currentYear) {
          sumDep += yearlyDep;
        } else if (y === currentYear) {
          const frac = elapsedYears - (y - 1);
          sumDep += yearlyDep * frac;
          accountingMonthly = yearlyDep / 12;
        }
      }
      accountingAccumulated = sumDep;
      accountingRatePercent = acquisitionValue > 0 ? (accountingAccumulated / acquisitionValue) * 100 : 0;
    }
    else if (depreciationMethod === 'multiplier') {
      const schedule = depreciationSchedule || [];
      const nYears = Math.ceil(usefulLifeMonths / 12) || 1;
      const linearYearly = accountingDepreciableBase / nYears;
      
      let sumDep = 0;
      const currentYear = Math.floor(elapsedYears) + 1;
      
      for (let y = 1; y <= nYears; y++) {
        const multiplier = Number(schedule[y - 1] ?? 1);
        const yearlyDep = linearYearly * multiplier;
        if (y < currentYear) {
          sumDep += yearlyDep;
        } else if (y === currentYear) {
          const frac = elapsedYears - (y - 1);
          sumDep += yearlyDep * frac;
          accountingMonthly = yearlyDep / 12;
        }
      }
      accountingAccumulated = sumDep;
      accountingRatePercent = usefulLifeMonths > 0 ? (12 / usefulLifeMonths) * 100 : 0;
    }
    else if (depreciationMethod === 'immediate') {
      accountingAccumulated = accountingDepreciableBase;
      accountingMonthly = 0;
      accountingRatePercent = 100;
    }
  }

  // Korlátozás az amortizálandó alapra
  accountingAccumulated = Math.min(accountingAccumulated, accountingDepreciableBase);
  const accountingBookValue = Math.max(residualValue, acquisitionValue - accountingAccumulated);

  // ── Tao ÉCS (Tax) — Mindig lineáris, a bekerülési érték alapján ──
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
