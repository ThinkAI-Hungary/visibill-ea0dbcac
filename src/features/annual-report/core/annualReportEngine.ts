import { formatHungarianNumber } from '@/lib/documents/encoding/hungarianEncoding';
import type {
  AnnualReport,
  ValidationResult,
  SalaryMetrics,
  AssetMovementSummary,
  EquityRowItem,
  FinancialMetrics,
} from '../types';

/**
 * Számviteli és pénzügyi mutatószámok kalkulációja a befagyasztott mérleg és eredménykimutatás alapján.
 */
export function calculateFinancialMetrics(
  frozenBsData: any[] | null | undefined,
  frozenPnlData: any[] | null | undefined,
  fallbackNetIncome?: number
): FinancialMetrics {
  const bs = frozenBsData || [];
  const pnl = frozenPnlData || [];

  const totalAssetsRow = bs.find((r: any) => r.section === 'assets' && r.type === 'total');
  const totalLiabRow = bs.find((r: any) => r.section === 'liabilities' && r.type === 'total');
  const equityRow = bs.find((r: any) => r.section === 'liabilities' && (r.row_code === 'D' || (r.name || '').toLowerCase().includes('saját tőke')));
  const currentAssetsRow = bs.find((r: any) => r.section === 'assets' && (r.row_code === 'B' || (r.name || '').toLowerCase().includes('forgóeszközök')));
  const shortTermLiabRow = bs.find((r: any) => r.section === 'liabilities' && (r.row_code === 'F' || (r.name || '').toLowerCase().includes('rövid lejáratú')));

  const totalAssets = Number(totalAssetsRow?.current_balance || 0);
  const totalLiabilities = Number(totalLiabRow?.current_balance || 0);
  const equityTotal = Number(equityRow?.current_balance || 0);
  const equityPrior = Number(equityRow?.prior_year_balance || 0);
  const currentAssets = Number(currentAssetsRow?.current_balance || 0);
  const shortTermLiab = Number(shortTermLiabRow?.current_balance || 0);

  const netIncomeFromPnl = pnl
    .filter((r: any) => r.type === 'roman')
    .reduce((acc: number, r: any) => acc + (Number(r.balance || 0) * Number(r.multiplier || 1)), 0);

  const netIncome = pnl.length > 0 ? netIncomeFromPnl : (fallbackNetIncome ?? 0);

  const roe = equityTotal > 0 ? ((netIncome / equityTotal) * 100).toFixed(1) : '0.0';
  const liquidity = shortTermLiab > 0 ? (currentAssets / shortTermLiab).toFixed(2) : 'N/A';
  const equityChange: 'növekedett' | 'csökkent' = equityTotal >= equityPrior ? 'növekedett' : 'csökkent';
  const liquidityEval =
    liquidity !== 'N/A' && Number(liquidity) >= 1.3
      ? 'biztonsággal fedezik'
      : liquidity !== 'N/A' && Number(liquidity) >= 1.0
      ? 'éppen fedezik'
      : 'nem fedezik';

  return {
    totalAssets,
    totalLiabilities,
    equityTotal,
    equityPrior,
    equityChange,
    roe,
    liquidity,
    liquidityEval,
    netIncome,
  };
}

/**
 * Bér- és létszámadatok összesítése
 */
export function calculateSalaryMetrics(salaryData: any[] | null | undefined): SalaryMetrics | null {
  if (!salaryData || salaryData.length === 0) return null;
  const employees = new Set(
    salaryData.filter((s: any) => s.munkavallalo_neve).map((s: any) => s.munkavallalo_neve)
  );
  const totalWages = salaryData
    .filter((s: any) => s.tipus === 'bér')
    .reduce((a: number, s: any) => a + Number(s.összeg || 0), 0);
  const totalContrib = salaryData
    .filter((s: any) => s.tipus === 'járulék')
    .reduce((a: number, s: any) => a + Number(s.összeg || 0), 0);
  return {
    headcount: employees.size,
    totalWages,
    totalContrib,
    total: totalWages + totalContrib,
  };
}

/**
 * Tárgyi eszköz mozgások összesítése
 */
export function calculateAssetMovement(fixedAssets: any[] | null | undefined): AssetMovementSummary | null {
  if (!fixedAssets || fixedAssets.length === 0) return null;
  const active = fixedAssets.filter((a: any) => a.status === 'active');
  const disposed = fixedAssets.filter((a: any) => a.status === 'disposed' || a.status === 'sold');
  const totalAcquisition = fixedAssets.reduce((a: number, f: any) => a + Number(f.acquisition_value || 0), 0);
  const activeAcquisition = active.reduce((a: number, f: any) => a + Number(f.acquisition_value || 0), 0);
  return {
    total: fixedAssets.length,
    active: active.length,
    disposed: disposed.length,
    totalAcquisition,
    activeAcquisition,
  };
}

/**
 * Saját tőke (D sorok) kinyerése a mérlegből
 */
export function extractEquityRows(frozenBsData: any[] | null | undefined): EquityRowItem[] {
  if (!frozenBsData) return [];
  return (frozenBsData as any[]).filter(
    (r: any) => r.section === 'liabilities' && (r.row_code || '').startsWith('D') && r.type !== 'total'
  );
}

/**
 * Veszteségelhatárolás (Tax Loss Carryforward) számítása
 */
export function calculateTaxLossCarryforward(
  allReports: Array<{ id: string; fiscal_year: number; net_income: number }> | null | undefined,
  selectedYear: number,
  currentNetIncome: number,
  notesSections: any[] | null | undefined
) {
  const priorLossReports = (allReports || [])
    .filter((r) => r.fiscal_year < selectedYear && (r.net_income || 0) < 0)
    .sort((a, b) => a.fiscal_year - b.fiscal_year);

  const accumulatedPriorLosses = priorLossReports.reduce(
    (sum, r) => sum + Math.abs(r.net_income || 0),
    0
  );

  const maxLossOffset = currentNetIncome > 0 ? Math.round(currentNetIncome * 0.5) : 0;

  const entry = ((notesSections as any[]) || []).find((s: any) => s.section_key === 'tax_loss_applied');
  const appliedLossOffset = entry ? Number(entry.text) || 0 : 0;

  return {
    priorLossReports,
    accumulatedPriorLosses,
    maxLossOffset,
    appliedLossOffset,
  };
}

/**
 * Szöveges sablonok változóinak dinamikus feloldása
 */
export function replaceTemplateVariables(
  text: string,
  options: {
    companyName?: string;
    companyAddress?: string;
    companyTaxNumber?: string;
    fiscalYear: number;
    representativeName?: string | null;
    representativeRole?: string | null;
    financialMetrics: FinancialMetrics;
    dividendAmount?: number;
    retainedEarnings?: number;
    assetMovement?: AssetMovementSummary | null;
    equityRows?: EquityRowItem[] | null;
    salaryMetrics?: SalaryMetrics | null;
  }
): string {
  const toHtml = (txt: string) => {
    if (!txt) return '';
    if (txt.includes('<p>') || txt.includes('<div>') || txt.includes('<br>')) return txt;
    return txt
      .split('\n')
      .map((line) => `<p>${line || '&nbsp;'}</p>`)
      .join('');
  };

  const fmtK = (v: number) => formatHungarianNumber(Math.round(v / 1000));
  const fmtF = (v: number) => formatHungarianNumber(v);

  const assetTable = options.assetMovement
    ? `
      <div class="my-3 overflow-x-auto">
        <table class="w-full text-[11px] border-collapse border border-border">
          <thead>
            <tr class="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold border-b border-border">
              <th class="p-2 text-left border-r border-border">Mutató</th>
              <th class="p-2 text-right">Érték</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr><td class="p-2 border-r border-border font-medium">Összes eszköz</td><td class="p-2 text-right">${options.assetMovement.total} db</td></tr>
            <tr><td class="p-2 border-r border-border font-medium">Aktív eszközök</td><td class="p-2 text-right">${options.assetMovement.active} db</td></tr>
            <tr><td class="p-2 border-r border-border font-medium">Kivezetett eszközök</td><td class="p-2 text-right">${options.assetMovement.disposed} db</td></tr>
            <tr class="bg-muted/40 font-bold"><td class="p-2 border-r border-border">Bruttó érték összesen</td><td class="p-2 text-right">${fmtF(options.assetMovement.totalAcquisition)} Ft</td></tr>
            <tr><td class="p-2 border-r border-border font-medium">Aktív eszközök bruttó értéke</td><td class="p-2 text-right">${fmtF(options.assetMovement.activeAcquisition)} Ft</td></tr>
          </tbody>
        </table>
      </div>
    `
    : `<p class="text-xs text-muted-foreground italic my-2">Tárgyi eszköz adatok nem érhetők el.</p>`;

  const equityTable =
    options.equityRows && options.equityRows.length > 0
      ? `
      <div class="my-3 overflow-x-auto">
        <table class="w-full text-[11px] border-collapse border border-border">
          <thead>
            <tr class="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold border-b border-border">
              <th class="p-2 text-left border-r border-border">Sor</th>
              <th class="p-2 text-left border-r border-border">Megnevezés</th>
              <th class="p-2 text-right border-r border-border">Előző év</th>
              <th class="p-2 text-right">Tárgyév</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            ${options.equityRows
              .map(
                (r) => `
              <tr>
                <td class="p-2 border-r border-border font-mono text-[10px]">${r.row_code || ''}</td>
                <td class="p-2 border-r border-border">${r.name || ''}</td>
                <td class="p-2 border-r border-border text-right font-mono">${fmtK(Number(r.prior_year_balance) || 0)} E Ft</td>
                <td class="p-2 text-right font-mono">${fmtK(Number(r.current_balance) || 0)} E Ft</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `
      : `<p class="text-xs text-muted-foreground italic my-2">Saját tőke adatok nem érhetők el.</p>`;

  const salaryTable = options.salaryMetrics
    ? `
      <div class="my-3 overflow-x-auto">
        <table class="w-full text-[11px] border-collapse border border-border">
          <thead>
            <tr class="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold border-b border-border">
              <th class="p-2 text-left border-r border-border">Mutató</th>
              <th class="p-2 text-right">Érték</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr><td class="p-2 border-r border-border font-medium">Átlagos statisztikai létszám</td><td class="p-2 text-right">${options.salaryMetrics.headcount} fő</td></tr>
            <tr><td class="p-2 border-r border-border font-medium">Bérköltség</td><td class="p-2 text-right">${fmtF(options.salaryMetrics.totalWages)} Ft</td></tr>
            <tr><td class="p-2 border-r border-border font-medium">Bérjárulékok</td><td class="p-2 text-right">${fmtF(options.salaryMetrics.totalContrib)} Ft</td></tr>
            <tr class="bg-muted/40 font-bold"><td class="p-2 border-r border-border">Összes személyi jellegű ráfordítás</td><td class="p-2 text-right">${fmtF(options.salaryMetrics.total)} Ft</td></tr>
          </tbody>
        </table>
      </div>
    `
    : `<p class="text-xs text-muted-foreground italic my-2">Foglalkoztatotti adatok nem érhetők el.</p>`;

  const vars: Record<string, string> = {
    '[Cégnév]': options.companyName || '___',
    '[Székhely]': options.companyAddress || '___',
    '[Adószám]': options.companyTaxNumber || '___',
    '[Tárgyév]': String(options.fiscalYear),
    '[Tárgyév+1]': String(options.fiscalYear + 1),
    '[Képviselő neve]': options.representativeName || '___',
    '[Képviselő beosztása]': options.representativeRole || 'ügyvezető',
    '[Saját tőke]': formatHungarianNumber(Math.round(options.financialMetrics.equityTotal / 1000)),
    '[Saját tőke változás]': options.financialMetrics.equityChange,
    '[Mérlegfőösszeg]': formatHungarianNumber(Math.round(options.financialMetrics.totalAssets / 1000)),
    '[ROE]': options.financialMetrics.roe,
    '[Likviditás]': options.financialMetrics.liquidity,
    '[Likviditás értékelés]': options.financialMetrics.liquidityEval,
    '[Adózott eredmény]': formatHungarianNumber(Math.round(options.financialMetrics.netIncome / 1000)),
    '[Osztalék]': formatHungarianNumber(Math.round((options.dividendAmount || 0) / 1000)),
    '[Eredménytartalék]': formatHungarianNumber(Math.round((options.retainedEarnings || 0) / 1000)),
    '[AUTOMATIKUS TÁBLÁZAT - TENY MODULBÓL]': assetTable,
    '[AUTOMATIKUS TÁBLÁZAT - MÉRLEG D. SOROKBÓL]': equityTable,
    '[AUTOMATIKUS TÁBLÁZAT - FOGLALKOZTATOTTI ADATOK]': salaryTable,
  };

  let result = toHtml(text);
  for (const [key, val] of Object.entries(vars)) {
    result = result.split(key).join(val);
  }
  return result;
}

/**
 * Lépések kitöltöttségének ellenőrzése
 */
export function isStepCompleted(
  stepId: number,
  report: AnnualReport | null | undefined,
  validationResults: ValidationResult[]
): boolean {
  if (!report) return false;
  switch (stepId) {
    case 1:
      return !!report.representative_name;
    case 2:
      return !!report.frozen_at;
    case 3:
      return !!report.validated_at && validationResults.every((r) => r.passed || r.severity !== 'error');
    case 4:
      return ((report.notes_sections as any[]) || []).length > 0;
    case 5:
      return report.net_income <= 0 || report.dividend_amount > 0 || report.dividend_resolution_number !== null;
    case 6:
      return report.status === 'finalized';
    default:
      return false;
  }
}
