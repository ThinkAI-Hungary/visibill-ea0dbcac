import type { FixedAsset, FixedAssetComponent } from '@/types/fixed-assets';

export interface ComponentDepreciationBreakdown {
  componentId: string;
  name: string;
  componentType: string;
  activationDate: string;
  grossValue: number;
  grantFundingAmount: number;
  ownFundingAmount: number;
  grantRatioPercent: number;
  annualRate: number;
  monthlyDepreciation: number;
  monthlyGrantDepreciation: number;
  monthlyOwnDepreciation: number;
  elapsedMonths: number;
  accumulatedDepreciation: number;
  accumulatedGrantDepreciation: number;
  accumulatedOwnDepreciation: number;
  netBookValue: number;
  grantNetBookValue: number;
  ownNetBookValue: number;
}

export interface AssetComponentCalculationResult {
  hasComponents: boolean;
  totalGrossValue: number;
  totalGrantFunding: number;
  totalOwnFunding: number;
  effectiveGrantRatio: number;
  monthlyDepreciation: number;
  monthlyGrantDepreciation: number;
  monthlyOwnDepreciation: number;
  accumulatedDepreciation: number;
  accumulatedGrantDepreciation: number;
  accumulatedOwnDepreciation: number;
  netBookValue: number;
  grantNetBookValue: number;
  ownNetBookValue: number;
  componentsBreakdown: ComponentDepreciationBreakdown[];
}

/**
 * Számítja egy komponens vagy eszköz eltelt aktív hónapjait az aktiválás napja és a cél-dátum között.
 */
export function calculateElapsedMonths(activationDateStr: string, targetDateStr?: string): number {
  if (!activationDateStr) return 0;
  const start = new Date(activationDateStr);
  const end = targetDateStr ? new Date(targetDateStr) : new Date();

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;

  const yearsDiff = end.getFullYear() - start.getFullYear();
  const monthsDiff = end.getMonth() - start.getMonth();
  const daysAdjustment = end.getDate() >= start.getDate() ? 0 : -1;

  const totalMonths = yearsDiff * 12 + monthsDiff + (daysAdjustment === 0 ? 1 : 0);
  return Math.max(0, totalMonths);
}

/**
 * Kiszámítja egy tárgyi eszköz komponens-szintű ÉCS és forrásmegoszlását.
 * Ha az eszköznek nincsenek külön rögzített komponensei, az alap főkarton adataiból képez egyetlen alapkomponenst.
 */
export function calculateAssetComponentsDepreciation(
  asset: FixedAsset,
  components: FixedAssetComponent[] = [],
  targetDateStr?: string
): AssetComponentCalculationResult {
  const hasComponents = components.length > 0;

  if (!hasComponents) {
    // Alapértelmezett viselkedés: egyetlen főkarton szintű számítás
    const gross = Number(asset.acquisition_value) || 0;
    // Ha van közvetlen grant_project az eszközön, de nincsenek külön komponensek
    const grantRatio = asset.grant_project?.intensity_rate || 0;
    const grantFunding = Math.round((gross * grantRatio) / 100);
    const ownFunding = gross - grantFunding;

    const usefulLifeMonths = asset.useful_life_months > 0 ? asset.useful_life_months : 60;
    const annualRate = asset.annual_depreciation_rate ?? (100 / (usefulLifeMonths / 12));
    const monthlyDep = Math.round(gross / usefulLifeMonths);
    const monthlyGrantDep = Math.round((monthlyDep * grantRatio) / 100);
    const monthlyOwnDep = monthlyDep - monthlyGrantDep;

    const elapsed = calculateElapsedMonths(asset.activation_date, targetDateStr);
    const accDep = Math.min(gross - Number(asset.residual_value || 0), monthlyDep * elapsed);
    const accGrantDep = Math.round((accDep * grantRatio) / 100);
    const accOwnDep = accDep - accGrantDep;

    const netVal = Math.max(Number(asset.residual_value || 0), gross - accDep);
    const grantNet = Math.max(0, grantFunding - accGrantDep);
    const ownNet = Math.max(0, ownFunding - accOwnDep);

    const defaultBreakdown: ComponentDepreciationBreakdown = {
      componentId: 'primary-asset',
      name: asset.name,
      componentType: 'initial',
      activationDate: asset.activation_date,
      grossValue: gross,
      grantFundingAmount: grantFunding,
      ownFundingAmount: ownFunding,
      grantRatioPercent: grantRatio,
      annualRate: Math.round(annualRate * 100) / 100,
      monthlyDepreciation: monthlyDep,
      monthlyGrantDepreciation: monthlyGrantDep,
      monthlyOwnDepreciation: monthlyOwnDep,
      elapsedMonths: elapsed,
      accumulatedDepreciation: accDep,
      accumulatedGrantDepreciation: accGrantDep,
      accumulatedOwnDepreciation: accOwnDep,
      netBookValue: netVal,
      grantNetBookValue: grantNet,
      ownNetBookValue: ownNet,
    };

    return {
      hasComponents: false,
      totalGrossValue: gross,
      totalGrantFunding: grantFunding,
      totalOwnFunding: ownFunding,
      effectiveGrantRatio: grantRatio,
      monthlyDepreciation: monthlyDep,
      monthlyGrantDepreciation: monthlyGrantDep,
      monthlyOwnDepreciation: monthlyOwnDep,
      accumulatedDepreciation: accDep,
      accumulatedGrantDepreciation: accGrantDep,
      accumulatedOwnDepreciation: accOwnDep,
      netBookValue: netVal,
      grantNetBookValue: grantNet,
      ownNetBookValue: ownNet,
      componentsBreakdown: [defaultBreakdown],
    };
  }

  // Többkomponensű kalkuláció
  let totalGross = 0;
  let totalGrant = 0;
  let totalOwn = 0;
  let totalMonthlyDep = 0;
  let totalMonthlyGrantDep = 0;
  let totalMonthlyOwnDep = 0;
  let totalAccDep = 0;
  let totalAccGrantDep = 0;
  let totalAccOwnDep = 0;

  const breakdowns: ComponentDepreciationBreakdown[] = components.map(comp => {
    const compGross = Number(comp.gross_value) || 0;
    const compGrant = Number(comp.grant_funding_amount) || 0;
    const compOwn = Number(comp.own_funding_amount) || Math.max(0, compGross - compGrant);
    const compRatio = Number(comp.grant_ratio_percent) || (compGross > 0 ? (compGrant / compGross) * 100 : 0);

    const usefulLife = (comp.useful_life_months && comp.useful_life_months > 0)
      ? comp.useful_life_months
      : (asset.useful_life_months > 0 ? asset.useful_life_months : 60);

    const annualRate = comp.depreciation_rate
      ? Number(comp.depreciation_rate)
      : (asset.annual_depreciation_rate ?? (100 / (usefulLife / 12)));

    const compMonthlyDep = Math.round(compGross / usefulLife);
    const compMonthlyGrantDep = Math.round((compMonthlyDep * compRatio) / 100);
    const compMonthlyOwnDep = compMonthlyDep - compMonthlyGrantDep;

    const elapsed = calculateElapsedMonths(comp.activation_date, targetDateStr);
    const compAccDep = Math.min(compGross, compMonthlyDep * elapsed);
    const compAccGrantDep = Math.min(compGrant, Math.round((compAccDep * compRatio) / 100));
    const compAccOwnDep = compAccDep - compAccGrantDep;

    const compNetVal = Math.max(0, compGross - compAccDep);
    const compGrantNet = Math.max(0, compGrant - compAccGrantDep);
    const compOwnNet = Math.max(0, compOwn - compAccOwnDep);

    totalGross += compGross;
    totalGrant += compGrant;
    totalOwn += compOwn;
    totalMonthlyDep += compMonthlyDep;
    totalMonthlyGrantDep += compMonthlyGrantDep;
    totalMonthlyOwnDep += compMonthlyOwnDep;
    totalAccDep += compAccDep;
    totalAccGrantDep += compAccGrantDep;
    totalAccOwnDep += compAccOwnDep;

    return {
      componentId: comp.id,
      name: comp.name,
      componentType: comp.component_type,
      activationDate: comp.activation_date,
      grossValue: compGross,
      grantFundingAmount: compGrant,
      ownFundingAmount: compOwn,
      grantRatioPercent: Math.round(compRatio * 100) / 100,
      annualRate: Math.round(annualRate * 100) / 100,
      monthlyDepreciation: compMonthlyDep,
      monthlyGrantDepreciation: compMonthlyGrantDep,
      monthlyOwnDepreciation: compMonthlyOwnDep,
      elapsedMonths: elapsed,
      accumulatedDepreciation: compAccDep,
      accumulatedGrantDepreciation: compAccGrantDep,
      accumulatedOwnDepreciation: compAccOwnDep,
      netBookValue: compNetVal,
      grantNetBookValue: compGrantNet,
      ownNetBookValue: compOwnNet,
    };
  });

  const effectiveRatio = totalGross > 0 ? Math.round((totalGrant / totalGross) * 10000) / 100 : 0;
  const netTotal = Math.max(0, totalGross - totalAccDep);
  const grantNetTotal = Math.max(0, totalGrant - totalAccGrantDep);
  const ownNetTotal = Math.max(0, totalOwn - totalAccOwnDep);

  return {
    hasComponents: true,
    totalGrossValue: totalGross,
    totalGrantFunding: totalGrant,
    totalOwnFunding: totalOwn,
    effectiveGrantRatio: effectiveRatio,
    monthlyDepreciation: totalMonthlyDep,
    monthlyGrantDepreciation: totalMonthlyGrantDep,
    monthlyOwnDepreciation: totalMonthlyOwnDep,
    accumulatedDepreciation: totalAccDep,
    accumulatedGrantDepreciation: totalAccGrantDep,
    accumulatedOwnDepreciation: totalAccOwnDep,
    netBookValue: netTotal,
    grantNetBookValue: grantNetTotal,
    ownNetBookValue: ownNetTotal,
    componentsBreakdown: breakdowns,
  };
}
