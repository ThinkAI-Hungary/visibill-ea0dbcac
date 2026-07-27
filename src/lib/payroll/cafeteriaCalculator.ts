/**
 * Cafeteria / SZÉP kártya kalkulátor
 *
 * 2026. évi cafeteria szabályok:
 * - SZÉP kártya 3 zseb: szálláshely, vendéglátás, szabadidő
 * - Éves korlát: 450.000 Ft / zseb (összesen 1.350.000 Ft)
 * - Közteher: 28% (SZJA 15% + SZOCHO 13%)
 * - Rekreáció: éves korlát 75.000 Ft (adómentes)
 * - Magáncélú telefon: 20% adóköteles
 */

export interface SzepCardLimits {
  accommodationYearly: number;  // Szálláshely
  hospitalityYearly: number;    // Vendéglátás
  leisureYearly: number;        // Szabadidő
  recreationYearly: number;     // Rekreáció
  taxRate: number;              // Közteher (28%)
}

export const DEFAULT_2026_SZEP_LIMITS: SzepCardLimits = {
  accommodationYearly: 450_000,
  hospitalityYearly: 450_000,
  leisureYearly: 450_000,
  recreationYearly: 120_000,
  taxRate: 0.28,
};

export interface CafeteriaAllocation {
  employeeId: string;
  employeeName: string;
  accommodation: number;    // Havi szálláshely
  hospitality: number;      // Havi vendéglátás
  leisure: number;          // Havi szabadidő
  recreation: number;       // Havi rekreáció
  privatePhone: number;     // Magáncélú telefon összeg
}

export interface CafeteriaTaxResult {
  totalBenefit: number;         // Össz. juttatás
  szepTotal: number;            // SZÉP kártya összesen
  szepTax: number;              // SZÉP kártya közteher
  recreationTotal: number;      // Rekreáció összesen
  recreationTax: number;        // Rekreáció adó (0 ha limit alatt)
  phoneTaxable: number;         // Telefon adóköteles rész (20%)
  phoneTax: number;             // Telefon adója
  totalTax: number;             // Össz. közteher
  totalCostToEmployer: number;  // Teljes munkáltatói költség

  // Limit figyelmeztetések
  warnings: CafeteriaWarning[];
}

export interface CafeteriaWarning {
  type: 'over_limit' | 'approaching_limit';
  pocket: string;
  used: number;
  limit: number;
  message: string;
}

export interface YtdUsage {
  accommodationYtd: number;
  hospitalityYtd: number;
  leisureYtd: number;
  recreationYtd: number;
}

function calculatePocketTax(monthly: number, ytd: number, yearlyLimit: number, taxRate: number): number {
  const remainingLimit = Math.max(0, yearlyLimit - ytd);
  const lowPart = Math.min(monthly, remainingLimit);
  const highPart = Math.max(0, monthly - remainingLimit);
  return Math.round(lowPart * taxRate) + Math.round(highPart * 1.18 * taxRate);
}

/**
 * Calculate cafeteria tax for a monthly allocation
 */
export function calculateCafeteriaTax(
  allocation: CafeteriaAllocation,
  ytd: YtdUsage,
  limits: SzepCardLimits = DEFAULT_2026_SZEP_LIMITS
): CafeteriaTaxResult {
  const warnings: CafeteriaWarning[] = [];

  // Pockets limit and warning checks
  const pockets = [
    { name: 'Szálláshely', monthly: allocation.accommodation, ytd: ytd.accommodationYtd, limit: limits.accommodationYearly },
    { name: 'Vendéglátás', monthly: allocation.hospitality, ytd: ytd.hospitalityYtd, limit: limits.hospitalityYearly },
    { name: 'Szabadidő', monthly: allocation.leisure, ytd: ytd.leisureYtd, limit: limits.leisureYearly },
    { name: 'Rekreáció', monthly: allocation.recreation, ytd: ytd.recreationYtd, limit: limits.recreationYearly },
  ];

  for (const pocket of pockets) {
    const newTotal = pocket.ytd + pocket.monthly;
    if (newTotal > pocket.limit) {
      warnings.push({
        type: 'over_limit',
        pocket: pocket.name,
        used: newTotal,
        limit: pocket.limit,
        message: `${pocket.name}: ${newTotal.toLocaleString('hu-HU')} Ft / ${pocket.limit.toLocaleString('hu-HU')} Ft — TÚLLÉPÉS!`,
      });
    } else if (newTotal > pocket.limit * 0.85) {
      warnings.push({
        type: 'approaching_limit',
        pocket: pocket.name,
        used: newTotal,
        limit: pocket.limit,
        message: `${pocket.name}: ${newTotal.toLocaleString('hu-HU')} Ft / ${pocket.limit.toLocaleString('hu-HU')} Ft — hamarosan eléri a limitet`,
      });
    }
  }

  // Calculate taxes for each pocket
  const accommodationTax = calculatePocketTax(allocation.accommodation, ytd.accommodationYtd, limits.accommodationYearly, limits.taxRate);
  const hospitalityTax = calculatePocketTax(allocation.hospitality, ytd.hospitalityYtd, limits.hospitalityYearly, limits.taxRate);
  const leisureTax = calculatePocketTax(allocation.leisure, ytd.leisureYtd, limits.leisureYearly, limits.taxRate);
  
  const szepTotal = allocation.accommodation + allocation.hospitality + allocation.leisure;
  const szepTax = accommodationTax + hospitalityTax + leisureTax;

  // Rekreáció
  const recreationTotal = allocation.recreation;
  const recreationTax = calculatePocketTax(recreationTotal, ytd.recreationYtd, limits.recreationYearly, limits.taxRate);

  // Magáncélú telefon (20% adóköteles)
  const phoneTaxable = Math.round(allocation.privatePhone * 0.2);
  const phoneTax = Math.round(phoneTaxable * limits.taxRate);

  const totalBenefit = szepTotal + recreationTotal + allocation.privatePhone;
  const totalTax = szepTax + recreationTax + phoneTax;

  return {
    totalBenefit,
    szepTotal,
    szepTax,
    recreationTotal,
    recreationTax,
    phoneTaxable,
    phoneTax,
    totalTax,
    totalCostToEmployer: totalBenefit + totalTax,
    warnings,
  };
}

/**
 * Format cafeteria summary for display
 */
export function formatCafeteriaSummary(result: CafeteriaTaxResult): string {
  const lines = [
    `SZÉP kártya: ${result.szepTotal.toLocaleString('hu-HU')} Ft (adó: ${result.szepTax.toLocaleString('hu-HU')} Ft)`,
  ];
  if (result.recreationTotal > 0) {
    lines.push(`Rekreáció: ${result.recreationTotal.toLocaleString('hu-HU')} Ft (adó: ${result.recreationTax.toLocaleString('hu-HU')} Ft)`);
  }
  if (result.phoneTaxable > 0) {
    lines.push(`Telefon (adóköteles): ${result.phoneTaxable.toLocaleString('hu-HU')} Ft (adó: ${result.phoneTax.toLocaleString('hu-HU')} Ft)`);
  }
  lines.push(`Összesen: ${result.totalBenefit.toLocaleString('hu-HU')} Ft + ${result.totalTax.toLocaleString('hu-HU')} Ft közteher = ${result.totalCostToEmployer.toLocaleString('hu-HU')} Ft`);
  return lines.join('\n');
}
