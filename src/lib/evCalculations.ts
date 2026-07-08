// =============================================================================
// EV Modul – Számítási logika (pure functions)
// =============================================================================
// Szja tv. 50–56. §, 49/B–49/C. §, KATA tv. 7–8. § szerinti kalkulációk.
// =============================================================================

// ─── Adóévi konstansok (default 2026) ───────────────────────────────────────

export interface EvTaxParams {
  taxYear: number;
  szjaRate: number;           // 15% SZJA kulcs
  vszjaRate: number;          // 9% vállalkozói SZJA kulcs

  // Átalányadó
  atalanyKoltseghanyadGeneral: number;    // 45% (2026)
  atalanyKoltseghanyadHigh: number;       // 80%
  atalanyKoltseghanyadRetail: number;     // 90%
  atalanyBevetelHatar: number;            // 38,736,000 Ft (2026)
  atalanyKiskerHatar: number;             // 193,680,000 Ft (2026)
  atalanyAdomentesResz: number;           // Adómentes rész (2026: 1,936,800 Ft)

  // KATA
  kataHaviTetel: number;     // 50,000 Ft/hó
  kataEvesKeret: number;     // 18,000,000 Ft/év
  kataKulonadoKulcs: number; // 40%

  // Járulékok
  tbJarulekKulcs: number;    // 18.5%
  szochoKulcs: number;       // 13%
  minimalber: number;         // 322,800 Ft (2026)
  garantaltBerminimum: number; // 373,200 Ft (2026)

  // ÁFA
  afaAlanyiHatar: number;    // 20,000,000 Ft (2026)

  // HIPA sávok (sávos adózásnál)
  hipaSav12m: number;        // 50,000 Ft
  hipaSav18m: number;        // 120,000 Ft
  hipaSav25m: number;        // 170,000 Ft

  // Kamarai hozzájárulás
  kamaraiHozzajarulas: number; // 5,000 Ft/év
}

export const DEFAULT_2026_PARAMS: EvTaxParams = {
  taxYear: 2026,
  szjaRate: 0.15,
  vszjaRate: 0.09,

  atalanyKoltseghanyadGeneral: 0.45,
  atalanyKoltseghanyadHigh: 0.80,
  atalanyKoltseghanyadRetail: 0.90,
  atalanyBevetelHatar: 38_736_000,
  atalanyKiskerHatar: 193_680_000,
  atalanyAdomentesResz: 1_936_800,

  kataHaviTetel: 50_000,
  kataEvesKeret: 18_000_000,
  kataKulonadoKulcs: 0.40,

  tbJarulekKulcs: 0.185,
  szochoKulcs: 0.13,
  minimalber: 322_800,
  garantaltBerminimum: 373_200,

  afaAlanyiHatar: 20_000_000,

  hipaSav12m: 50_000,
  hipaSav18m: 120_000,
  hipaSav25m: 170_000,

  kamaraiHozzajarulas: 5_000,
};

export const DEFAULT_2025_PARAMS: EvTaxParams = {
  taxYear: 2025,
  szjaRate: 0.15,
  vszjaRate: 0.09,

  atalanyKoltseghanyadGeneral: 0.40,
  atalanyKoltseghanyadHigh: 0.80,
  atalanyKoltseghanyadRetail: 0.90,
  atalanyBevetelHatar: 36_000_000,
  atalanyKiskerHatar: 180_000_000,
  atalanyAdomentesResz: 1_600_800,

  kataHaviTetel: 50_000,
  kataEvesKeret: 18_000_000,
  kataKulonadoKulcs: 0.40,

  tbJarulekKulcs: 0.185,
  szochoKulcs: 0.13,
  minimalber: 266_800,
  garantaltBerminimum: 326_000,

  afaAlanyiHatar: 18_000_000,

  hipaSav12m: 50_000,
  hipaSav18m: 120_000,
  hipaSav25m: 170_000,

  kamaraiHozzajarulas: 5_000,
};

// ─── Átalányadó számítás (Szja tv. 50–56. §) ──────────────────────────────

export interface FlatRateResult {
  revenue: number;
  costRatio: number;
  calculatedCosts: number;
  income: number;
  taxFreeAmount: number;
  taxableIncome: number;
  szja: number;
  effectiveRate: number;
}

export function calculateFlatRateIncome(
  revenue: number,
  costRatioCategory: 'general' | 'high_80' | 'retail_90',
  params: EvTaxParams = DEFAULT_2026_PARAMS,
): FlatRateResult {
  const ratioMap = {
    general: params.atalanyKoltseghanyadGeneral,
    high_80: params.atalanyKoltseghanyadHigh,
    retail_90: params.atalanyKoltseghanyadRetail,
  };
  const costRatio = ratioMap[costRatioCategory];
  const calculatedCosts = Math.round(revenue * costRatio);
  const income = revenue - calculatedCosts;
  const taxFreeAmount = params.atalanyAdomentesResz;
  const taxableIncome = Math.max(0, income - taxFreeAmount);
  const szja = Math.round(taxableIncome * params.szjaRate);

  return {
    revenue,
    costRatio,
    calculatedCosts,
    income,
    taxFreeAmount,
    taxableIncome,
    szja,
    effectiveRate: revenue > 0 ? szja / revenue : 0,
  };
}

// ─── Vállalkozói SZJA – adóalap (Szja tv. 49/B. §) ─────────────────────────

export interface EntrepreneurialTaxResult {
  revenue: number;
  deductibleCosts: number;
  taxBase: number;
  entrepreneurialTax: number;      // 9% VSZJA
  dividendBase: number;
  dividendSzja: number;            // 15% a kivét felett
  dividendSzocho: number;          // 13% a kivét felett
  totalTax: number;
  effectiveRate: number;
}

export function calculateEntrepreneurialTax(
  revenue: number,
  deductibleCosts: number,
  kivet: number,
  corrections: number = 0,
  params: EvTaxParams = DEFAULT_2026_PARAMS,
): EntrepreneurialTaxResult {
  const taxBase = Math.max(0, revenue - deductibleCosts + corrections);
  const entrepreneurialTax = Math.round(taxBase * params.vszjaRate);

  // A kivét utáni maradék = osztalékalap
  const afterTax = taxBase - entrepreneurialTax;
  const dividendBase = Math.max(0, afterTax - kivet);
  const dividendSzja = Math.round(dividendBase * params.szjaRate);
  const dividendSzocho = Math.round(dividendBase * params.szochoKulcs);

  const totalTax = entrepreneurialTax + dividendSzja + dividendSzocho;

  return {
    revenue,
    deductibleCosts,
    taxBase,
    entrepreneurialTax,
    dividendBase,
    dividendSzja,
    dividendSzocho,
    totalTax,
    effectiveRate: revenue > 0 ? totalTax / revenue : 0,
  };
}

// ─── KATA számítás (KATA tv. 7–8. §) ────────────────────────────────────────

export interface KataResult {
  monthlyFee: number;
  annualFee: number;
  activeMonths: number;
  annualRevenue: number;
  revenueLimit: number;
  excessRevenue: number;
  surchargeRate: number;
  surchargeAmount: number;
  totalTax: number;
  effectiveRate: number;
}

export function calculateKata(
  annualRevenue: number,
  activeMonths: number = 12,
  params: EvTaxParams = DEFAULT_2026_PARAMS,
): KataResult {
  const monthlyFee = params.kataHaviTetel;
  const annualFee = monthlyFee * activeMonths;
  const revenueLimit = params.kataEvesKeret;
  const excessRevenue = Math.max(0, annualRevenue - revenueLimit);
  const surchargeRate = params.kataKulonadoKulcs;
  const surchargeAmount = Math.round(excessRevenue * surchargeRate);
  const totalTax = annualFee + surchargeAmount;

  return {
    monthlyFee,
    annualFee,
    activeMonths,
    annualRevenue,
    revenueLimit,
    excessRevenue,
    surchargeRate,
    surchargeAmount,
    totalTax,
    effectiveRate: annualRevenue > 0 ? totalTax / annualRevenue : 0,
  };
}

// ─── Negyedéves TB-járulék & szocho göngyölítés (Tbj., Szocho tv.) ─────────

export type EmploymentStatus = 'foallasu' | 'mellekallasu' | 'kiegeszito';

export interface QuarterlyContributionResult {
  quarter: number;
  ytdIncome: number;
  prevQuartersBase: number;
  currentQuarterBase: number;
  insuranceMonths: number;
  minimumBaseApplied: boolean;
  minimumBaseAmount: number;
  tbAmount: number;        // 18.5%
  szochoAmount: number;    // 13%
  totalAmount: number;
  monthlyBreakdown: { month: number; tbBase: number; tb: number; szocho: number }[];
}

export function calculateQuarterlyContributions(
  quarter: number,
  ytdIncome: number,
  prevQuartersBase: number,
  insuranceMonths: number,
  employmentStatus: EmploymentStatus,
  isSkilledActivity: boolean = false,
  params: EvTaxParams = DEFAULT_2026_PARAMS,
): QuarterlyContributionResult {
  // Kiegészítő (nyugdíjas) → mentes
  if (employmentStatus === 'kiegeszito') {
    return {
      quarter, ytdIncome, prevQuartersBase, currentQuarterBase: 0,
      insuranceMonths, minimumBaseApplied: false, minimumBaseAmount: 0,
      tbAmount: 0, szochoAmount: 0, totalAmount: 0, monthlyBreakdown: [],
    };
  }

  let currentQuarterBase = Math.max(0, ytdIncome - prevQuartersBase);

  // Főfoglalkozásúnál havi minimum-alap
  const monthlyMinimum = isSkilledActivity ? params.garantaltBerminimum : params.minimalber;
  const quarterMinimum = monthlyMinimum * insuranceMonths;
  let minimumBaseApplied = false;
  let minimumBaseAmount = 0;

  if (employmentStatus === 'foallasu' && currentQuarterBase < quarterMinimum) {
    minimumBaseAmount = quarterMinimum;
    currentQuarterBase = quarterMinimum;
    minimumBaseApplied = true;
  }

  const tbAmount = Math.round(currentQuarterBase * params.tbJarulekKulcs);
  const szochoAmount = Math.round(currentQuarterBase * params.szochoKulcs);

  // Havi bontás
  const monthsInQuarter = insuranceMonths;
  const monthlyBase = monthsInQuarter > 0 ? Math.round(currentQuarterBase / monthsInQuarter) : 0;
  const monthlyBreakdown = [];
  for (let i = 0; i < monthsInQuarter; i++) {
    const startMonth = (quarter - 1) * 3 + 1;
    monthlyBreakdown.push({
      month: startMonth + i,
      tbBase: monthlyBase,
      tb: Math.round(monthlyBase * params.tbJarulekKulcs),
      szocho: Math.round(monthlyBase * params.szochoKulcs),
    });
  }

  return {
    quarter,
    ytdIncome,
    prevQuartersBase,
    currentQuarterBase,
    insuranceMonths,
    minimumBaseApplied,
    minimumBaseAmount,
    tbAmount,
    szochoAmount,
    totalAmount: tbAmount + szochoAmount,
    monthlyBreakdown,
  };
}

// ─── HIPA sávos számítás (2022. évi XLV. tv.) ──────────────────────────────

export interface HipaResult {
  revenue: number;
  assessmentMode: 'simplified' | 'general';
  taxBase: number;
  municipalityRate: number;
  taxAmount: number;
}

export function calculateHipaSimplified(
  revenue: number,
  municipalityRate: number = 0.02,
  params: EvTaxParams = DEFAULT_2026_PARAMS,
): HipaResult {
  let taxBase: number;

  if (revenue <= 12_000_000) {
    taxBase = 2_500_000;
  } else if (revenue <= 18_000_000) {
    taxBase = 6_000_000;
  } else {
    taxBase = 8_500_000;
  }

  const taxAmount = Math.round(taxBase * municipalityRate);

  return {
    revenue,
    assessmentMode: 'simplified',
    taxBase,
    municipalityRate,
    taxAmount,
  };
}

export function calculateHipaGeneral(
  netRevenue: number,
  elab: number = 0,
  intermediaryServices: number = 0,
  materialCosts: number = 0,
  subcontractorCosts: number = 0,
  municipalityRate: number = 0.02,
): HipaResult {
  const taxBase = Math.max(0, netRevenue - elab - intermediaryServices - materialCosts - subcontractorCosts);
  const taxAmount = Math.round(taxBase * municipalityRate);

  return {
    revenue: netRevenue,
    assessmentMode: 'general',
    taxBase,
    municipalityRate,
    taxAmount,
  };
}

// ─── Értékhatár-figyelő ─────────────────────────────────────────────────────

export type ThresholdStatus = 'green' | 'yellow' | 'red';

export interface ThresholdCheck {
  name: string;
  currentValue: number;
  limit: number;
  percentage: number;
  status: ThresholdStatus;
  remaining: number;
}

export function checkThresholdStatus(
  currentValue: number,
  limit: number,
  warningRatio: number = 0.80,
): ThresholdStatus {
  const ratio = limit > 0 ? currentValue / limit : 0;
  if (ratio >= 1.0) return 'red';
  if (ratio >= warningRatio) return 'yellow';
  return 'green';
}

export function getEvThresholds(
  ytdRevenue: number,
  taxpayerForm: 'atalany' | 'vszja' | 'kata',
  isRetail: boolean = false,
  params: EvTaxParams = DEFAULT_2026_PARAMS,
): ThresholdCheck[] {
  const checks: ThresholdCheck[] = [];

  // KATA keret
  if (taxpayerForm === 'kata') {
    const limit = params.kataEvesKeret;
    const pct = limit > 0 ? (ytdRevenue / limit) * 100 : 0;
    checks.push({
      name: 'KATA bevételi keret',
      currentValue: ytdRevenue,
      limit,
      percentage: pct,
      status: checkThresholdStatus(ytdRevenue, limit),
      remaining: Math.max(0, limit - ytdRevenue),
    });
  }

  // Átalány bevételi határ
  if (taxpayerForm === 'atalany') {
    const limit = isRetail ? params.atalanyKiskerHatar : params.atalanyBevetelHatar;
    const pct = limit > 0 ? (ytdRevenue / limit) * 100 : 0;
    checks.push({
      name: isRetail ? 'Átalány kisker. határ' : 'Átalány bevételi határ',
      currentValue: ytdRevenue,
      limit,
      percentage: pct,
      status: checkThresholdStatus(ytdRevenue, limit),
      remaining: Math.max(0, limit - ytdRevenue),
    });
  }

  // ÁFA alanyi mentesség határa (mindenhol releváns)
  {
    const limit = params.afaAlanyiHatar;
    const pct = limit > 0 ? (ytdRevenue / limit) * 100 : 0;
    checks.push({
      name: 'ÁFA alanyi mentesség',
      currentValue: ytdRevenue,
      limit,
      percentage: pct,
      status: checkThresholdStatus(ytdRevenue, limit),
      remaining: Math.max(0, limit - ytdRevenue),
    });
  }

  return checks;
}

// ─── Adóforma-összehasonlítás ───────────────────────────────────────────────

export interface TaxFormComparison {
  form: 'atalany' | 'vszja' | 'kata';
  label: string;
  totalTax: number;
  effectiveRate: number;
  details: Record<string, number>;
  isBest: boolean;
}

export function compareTaxForms(
  revenue: number,
  deductibleCosts: number,
  kivet: number,
  costRatioCategory: 'general' | 'high_80' | 'retail_90',
  activeMonths: number = 12,
  params: EvTaxParams = DEFAULT_2026_PARAMS,
  employmentStatus: EmploymentStatus = 'foallasu',
  isSkilledActivity: boolean = false,
): TaxFormComparison[] {
  // Helper: calculate annual contributions for a given base
  const calcContributions = (incomeBase: number) => {
    if (employmentStatus === 'kiegeszito') {
      return { tbJarulekBase: 0, tbJarulek: 0, szocho: 0, minimumBaseApplied: false };
    }
    const monthlyMinimum = isSkilledActivity ? params.garantaltBerminimum : params.minimalber;
    const annualMinimum = monthlyMinimum * activeMonths;
    let base = incomeBase;
    let minimumBaseApplied = false;

    if (employmentStatus === 'foallasu' && base < annualMinimum) {
      base = annualMinimum;
      minimumBaseApplied = true;
    }

    return {
      tbJarulekBase: base,
      tbJarulek: Math.round(base * params.tbJarulekKulcs),
      szocho: Math.round(base * params.szochoKulcs),
      minimumBaseApplied,
    };
  };

  // 1. Átalány
  const flat = calculateFlatRateIncome(revenue, costRatioCategory, params);
  const flatContrib = calcContributions(flat.income);
  const flatTotal = flat.szja + flatContrib.tbJarulek + flatContrib.szocho;

  // 2. VSZJA
  const entre = calculateEntrepreneurialTax(revenue, deductibleCosts, kivet, 0, params);
  const vszjaContrib = calcContributions(kivet);
  const entreTotal = entre.totalTax + vszjaContrib.tbJarulek + vszjaContrib.szocho;

  // 3. KATA (tételes adó mindent tartalmaz)
  const kata = calculateKata(revenue, activeMonths, params);
  const kataTotal = kata.totalTax;

  const minTax = Math.min(flatTotal, entreTotal, kataTotal);

  return [
    {
      form: 'atalany',
      label: 'Átalányadó',
      totalTax: flatTotal,
      effectiveRate: revenue > 0 ? flatTotal / revenue : 0,
      details: {
        szja: flat.szja,
        revenue: flat.revenue,
        income: flat.income,
        costRatio: flat.costRatio,
        tbJarulekBase: flatContrib.tbJarulekBase,
        tbJarulek: flatContrib.tbJarulek,
        szocho: flatContrib.szocho,
        minimumBaseApplied: flatContrib.minimumBaseApplied ? 1 : 0,
      },
      isBest: flatTotal === minTax,
    },
    {
      form: 'vszja',
      label: 'Vállalkozói SZJA',
      totalTax: entreTotal,
      effectiveRate: revenue > 0 ? entreTotal / revenue : 0,
      details: {
        entrepreneurialTax: entre.entrepreneurialTax,
        dividendSzja: entre.dividendSzja,
        dividendSzocho: entre.dividendSzocho,
        taxBase: entre.taxBase,
        tbJarulekBase: vszjaContrib.tbJarulekBase,
        tbJarulek: vszjaContrib.tbJarulek,
        szocho: vszjaContrib.szocho,
        minimumBaseApplied: vszjaContrib.minimumBaseApplied ? 1 : 0,
      },
      isBest: entreTotal === minTax,
    },
    {
      form: 'kata',
      label: 'KATA',
      totalTax: kataTotal,
      effectiveRate: kata.effectiveRate,
      details: {
        annualFee: kata.annualFee,
        surcharge: kata.surchargeAmount,
        excessRevenue: kata.excessRevenue,
      },
      isBest: kataTotal === minTax,
    },
  ];
}

// ─── Formázó segédfüggvények ────────────────────────────────────────────────

export function formatHuf(amount: number): string {
  return new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 }).format(amount);
}

export function formatPercent(ratio: number, decimals: number = 1): string {
  return `${(ratio * 100).toFixed(decimals)}%`;
}

export function formatMillionHuf(amount: number): string {
  if (Math.abs(amount) >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)} M Ft`;
  }
  return formatHuf(amount);
}
