import type { DepreciationResult } from '@/types/fixed-assets';

function toLocalDate(d: Date | string): Date {
  if (d instanceof Date) return d;
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)) {
    const [y, m, day] = d.slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, day);
  }
  return new Date(d);
}

/**
 * Lineáris, degresszív, progresszív, teljesítményarányos, abszolút, szorzószámos és azonnali ÉCS kalkulátor.
 *
 * - Számviteli: a kiválasztott módszer alapján (linear, degressive_syd, degressive_declining, progressive, performance, absolute, multiplier, immediate)
 * - Tao: bekerülési (vagy eltérő tax_depreciation_base) * (tao_kulcs% / 100) / 12 per hónap (mindig lineáris)
 * - Pályázatos (Grant): ha grantDepreciationBase > 0, önálló 3. ág a támogatott alap és kulcs szerint
 * - Átvett nyitó karton: ha lastDepreciationDate adott, a jövőbeli ÉCS szigorúan a következő naptári hónaptól indul,
 *   a nyitó halmozott ÉCS-t hozzáadva és a nyitó nettó értéket csökkentve.
 */
export function calculateDepreciation(params: {
  acquisitionValue: number;
  residualValue: number;
  activationDate: Date | string;
  usefulLifeMonths: number;
  taoRatePercent: number;
  developmentReserveAmount?: number;
  calculationDate?: Date | string;
  disposalDate?: Date | string;
  depreciationMethod?: string;
  performanceUnit?: string | null;
  totalPlannedPerformance?: number | null;
  depreciationSchedule?: number[] | null;
  performanceLogs?: Array<{ date: string | Date; amount: number }> | null;
  taxDepreciationBase?: number | null;
  grantDepreciationBase?: number | null;
  grantDepreciationRate?: number | null;
  grantDepreciationMethod?: string | null;
  openingAccumulatedDepreciation?: number | null;
  openingTaxDepreciation?: number | null;
  lastDepreciationDate?: Date | string | null;
  depreciationRatePercent?: number | null;
}): DepreciationResult {
  const {
    acquisitionValue,
    residualValue,
    usefulLifeMonths,
    taoRatePercent,
    developmentReserveAmount,
    depreciationMethod = 'linear',
    totalPlannedPerformance,
    depreciationSchedule,
    performanceLogs,
    taxDepreciationBase,
    grantDepreciationBase,
    grantDepreciationRate,
    openingAccumulatedDepreciation,
    openingTaxDepreciation,
    lastDepreciationDate,
    depreciationRatePercent,
  } = params;

  const activationDate = toLocalDate(params.activationDate);
  const calculationDate = params.calculationDate ? toLocalDate(params.calculationDate) : new Date();
  const disposalDate = params.disposalDate ? toLocalDate(params.disposalDate) : undefined;

  const endDate = disposalDate && disposalDate < calculationDate ? disposalDate : calculationDate;

  // Átvett nyitó karton adatok ellenőrzése
  const lastDepDate = lastDepreciationDate ? toLocalDate(lastDepreciationDate) : null;
  const hasHistoricalDepreciation = Boolean(lastDepDate && !isNaN(lastDepDate.getTime()));
  const openingAcc = Math.max(0, Number(openingAccumulatedDepreciation) || 0);
  const openingTax = Math.max(0, Number(openingTaxDepreciation) || 0);

  // Eltelt idő kiszámítása alapesetben (aktiválás dátumától)
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

  // Átvett karton esetén: a jövőbeli amortizáció szigorúan a záró dátumot követő naptári hónaptól indul
  let postElapsedMonths = 0;
  if (hasHistoricalDepreciation && lastDepDate) {
    const nextMonthStart = new Date(lastDepDate.getFullYear(), lastDepDate.getMonth() + 1, 1);
    if (endDate >= nextMonthStart) {
      const postStartYear = nextMonthStart.getFullYear();
      const postStartMonth = nextMonthStart.getMonth();
      const postEndYear = endDate.getFullYear();
      const postEndMonth = endDate.getMonth();
      const postEndDay = endDate.getDate();
      const daysInPostEndMonth = new Date(postEndYear, postEndMonth + 1, 0).getDate();

      if (postEndDay === daysInPostEndMonth) {
        postElapsedMonths = Math.max(0, (postEndYear - postStartYear) * 12 + (postEndMonth - postStartMonth) + 1);
      } else {
        postElapsedMonths = Math.max(
          0,
          (postEndYear - postStartYear) * 12 + (postEndMonth - postStartMonth) + Math.max(0, postEndDay - 1) / daysInPostEndMonth
        );
      }
    }
  }

  const accountingDepreciableBase = Math.max(0, acquisitionValue - residualValue);
  let accountingAccumulated = 0;
  let accountingMonthly = 0;

  // Leírási kulcs: ha explicit depreciationRatePercent adott, az érvényesül, egyébként hasznos élettartamból számított
  let accountingRatePercent = (depreciationRatePercent && depreciationRatePercent > 0)
    ? depreciationRatePercent
    : (usefulLifeMonths > 0 ? (12 / usefulLifeMonths) * 100 : 0);

  // ── Számviteli ÉCS számítások ──
  if (endDate >= activationDate && accountingDepreciableBase > 0) {
    if (depreciationMethod === 'linear') {
      accountingMonthly = (accountingRatePercent > 0)
        ? (accountingDepreciableBase * (accountingRatePercent / 100)) / 12
        : (usefulLifeMonths > 0 ? accountingDepreciableBase / usefulLifeMonths : 0);

      if (hasHistoricalDepreciation) {
        const maxAdditional = Math.max(0, accountingDepreciableBase - openingAcc);
        const additionalAccumulated = Math.min(maxAdditional, accountingMonthly * postElapsedMonths);
        accountingAccumulated = openingAcc + additionalAccumulated;
      } else {
        accountingAccumulated = accountingMonthly * elapsedMonths;
      }
    } 
    else if (depreciationMethod === 'degressive_syd' || depreciationMethod === 'sum_of_years_digits') {
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
    else if (depreciationMethod === 'degressive_declining' || depreciationMethod === 'declining_balance') {
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
        .filter(log => toLocalDate(log.date) <= endDate)
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

  // ── Tao ÉCS (Tax) — Mindig lineáris, az eltérő adóalapból és fejlesztési tartalékkal csökkentve (Tao. tv. 7. § (15)) ──
  const devReserveDeduction = Math.max(0, developmentReserveAmount || 0);
  const baseForTax = (taxDepreciationBase !== undefined && taxDepreciationBase !== null && !isNaN(Number(taxDepreciationBase)))
    ? Number(taxDepreciationBase)
    : acquisitionValue;
  const taxBase = Math.max(0, baseForTax - devReserveDeduction);
  const taxMonthly = taxBase > 0 ? (taxBase * (taoRatePercent / 100)) / 12 : 0;

  let taxAccumulated = 0;
  if (hasHistoricalDepreciation) {
    const maxAdditionalTax = Math.max(0, taxBase - openingTax);
    const additionalTax = Math.min(maxAdditionalTax, taxMonthly * postElapsedMonths);
    taxAccumulated = Math.min(taxBase, openingTax + additionalTax);
  } else {
    const rawTaxAccumulated = taxMonthly * elapsedMonths;
    taxAccumulated = Math.min(rawTaxAccumulated, taxBase);
  }
  const taxBookValue = Math.max(0, taxBase - taxAccumulated);

  // ── Pályázatos / Támogatási ÉCS (Grant) — 3. ág, ha grantDepreciationBase > 0 ──
  let grantResult: DepreciationResult['grant'] = undefined;
  const grantBase = Number(grantDepreciationBase) || 0;
  if (grantBase > 0) {
    const grantRate = Number(grantDepreciationRate) || (usefulLifeMonths > 0 ? (12 / usefulLifeMonths) * 100 : 0);
    const grantMonthly = (grantBase * (grantRate / 100)) / 12;
    const effectiveMonths = hasHistoricalDepreciation ? postElapsedMonths : elapsedMonths;
    const rawGrantAccumulated = grantMonthly * effectiveMonths;
    const grantAccumulated = Math.min(grantBase, rawGrantAccumulated);
    const grantBookValue = Math.max(0, grantBase - grantAccumulated);

    grantResult = {
      monthly: Math.round(grantMonthly),
      accumulated: Math.round(grantAccumulated),
      bookValue: Math.round(grantBookValue),
      ratePercent: Math.round(grantRate * 100) / 100,
      grantBase: Math.round(grantBase),
    };
  }

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
      taxBase: Math.round(taxBase),
      developmentReserveDeduction: Math.round(devReserveDeduction),
    },
    grant: grantResult,
  };
}

/**
 * Egy adott adóévre (naptári évre) vonatkozó számviteli, Tao és Pályázatos ÉCS kiszámítása.
 * Figyelembe veszi a fejlesztési tartalék miatti adóalap-csökkentést (Tao. tv. 7. § (15)).
 */
export function calculateAnnualDepreciation(params: {
  acquisitionValue: number;
  residualValue: number;
  activationDate: Date | string;
  usefulLifeMonths: number;
  taoRatePercent: number;
  developmentReserveAmount?: number;
  year: number;
  disposalDate?: Date | string;
  depreciationMethod?: string;
  totalPlannedPerformance?: number | null;
  depreciationSchedule?: number[] | null;
  performanceLogs?: Array<{ date: string | Date; amount: number }> | null;
  taxDepreciationBase?: number | null;
  grantDepreciationBase?: number | null;
  grantDepreciationRate?: number | null;
  grantDepreciationMethod?: string | null;
  openingAccumulatedDepreciation?: number | null;
  openingTaxDepreciation?: number | null;
  lastDepreciationDate?: Date | string | null;
  depreciationRatePercent?: number | null;
}): { accounting: number; tax: number; grant?: number } {
  const actDate = toLocalDate(params.activationDate);
  const dispDate = params.disposalDate ? toLocalDate(params.disposalDate) : undefined;

  const startOfYear = new Date(params.year, 0, 1);
  const endOfYear = new Date(params.year + 1, 0, 1);

  if (actDate >= endOfYear || (dispDate && dispDate <= startOfYear)) {
    return { accounting: 0, tax: 0 };
  }

  const atEnd = calculateDepreciation({
    ...params,
    activationDate: actDate,
    disposalDate: dispDate,
    calculationDate: endOfYear,
  });

  const atStart = actDate >= startOfYear
    ? { accounting: { accumulated: 0 }, tax: { accumulated: 0 }, grant: atEnd.grant ? { accumulated: 0 } : undefined }
    : calculateDepreciation({
        ...params,
        activationDate: actDate,
        disposalDate: dispDate,
        calculationDate: startOfYear,
      });

  return {
    accounting: Math.max(0, atEnd.accounting.accumulated - (atStart.accounting?.accumulated || 0)),
    tax: Math.max(0, atEnd.tax.accumulated - (atStart.tax?.accumulated || 0)),
    grant: atEnd.grant
      ? Math.max(0, atEnd.grant.accumulated - (atStart.grant?.accumulated ?? 0))
      : undefined,
  };
}

