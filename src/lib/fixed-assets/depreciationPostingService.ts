import { supabase } from '@/integrations/supabase/client';
import { calculateDepreciation } from '@/hooks/useDepreciation';
import type { FixedAsset } from '@/types/fixed-assets';

export type DepreciationPeriodType = 'monthly' | 'quarterly' | 'annual' | 'custom';

export interface DepreciationCalculationItem {
  assetId: string;
  assetName: string;
  inventoryNumber: string;
  acquisitionValue: number;
  depreciableBase: number;
  usefulLifeMonths: number;
  depreciationMethod: string;
  activeMonths: number;
  periodAmount: number;
  accumulatedBefore: number;
  remainingBookValue: number;
  debitGlAccountId: string | null;
  debitGlNumber: string;
  creditGlAccountId: string | null;
  creditGlNumber: string;
  status: 'ready' | 'zero' | 'missing_gl' | 'fully_depreciated';
  reason?: string;
}

export interface DepreciationPreviewResult {
  periodType: DepreciationPeriodType;
  dateFrom: string;
  dateTo: string;
  postingDate: string;
  documentId: string;
  description: string;
  items: DepreciationCalculationItem[];
  totalAmount: number;
  eligibleCount: number;
  existingPosting: {
    exists: boolean;
    headerId?: string;
    journalNumber?: number | string | null;
    status?: string;
  } | null;
}

export interface DepreciationPostingParams {
  companyId: string;
  userId?: string;
  periodType: DepreciationPeriodType;
  dateFrom: string;
  dateTo: string;
  postingDate?: string;
  documentId: string;
  description?: string;
  currency?: string;
  selectedAssetIds?: string[];
}

export interface DepreciationPostingResult {
  success: boolean;
  message?: string;
  headerId?: string;
  journalNumber?: number | string | null;
  totalAmount?: number;
  assetCount?: number;
}

/**
 * Számviteli időszak hónap-különbség segéd (inkluzív hónapok száma)
 */
function getMonthDifferenceInclusive(startYear: number, startMonth: number, endYear: number, endMonth: number): number {
  return (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
}

/**
 * Kiszámítja egyetlen eszköz adott időszakra eső terv szerinti értékcsökkenését.
 */
export function calculateAssetPeriodDepreciation(
  asset: FixedAsset,
  dateFromStr: string,
  dateToStr: string
): {
  amount: number;
  activeMonths: number;
  accumulatedBefore: number;
  remainingBookValue: number;
  reason?: string;
} {
  const acquisitionValue = Number(asset.acquisition_value) || 0;
  const residualValue = Number(asset.residual_value) || 0;
  const depreciableBase = Math.max(0, acquisitionValue - residualValue);

  if (depreciableBase <= 0 || !asset.activation_date) {
    return {
      amount: 0,
      activeMonths: 0,
      accumulatedBefore: 0,
      remainingBookValue: acquisitionValue,
      reason: 'Nincs amortizálható alap vagy aktiválási dátum',
    };
  }

  const actDate = new Date(asset.activation_date);
  const fromDate = new Date(dateFromStr);
  const toDate = new Date(dateToStr);

  // Ha az aktiválás későbbi, mint a vizsgált időszak vége: 0
  if (actDate > toDate) {
    return {
      amount: 0,
      activeMonths: 0,
      accumulatedBefore: 0,
      remainingBookValue: acquisitionValue,
      reason: 'Az eszköz aktiválása az időszak vége utáni',
    };
  }

  // Ha az eszköz korábban selejtezve/kivezetve lett: 0
  if (asset.disposal_date) {
    const dispDate = new Date(asset.disposal_date);
    if (dispDate < fromDate) {
      return {
        amount: 0,
        activeMonths: 0,
        accumulatedBefore: depreciableBase,
        remainingBookValue: residualValue,
        reason: 'Az eszköz az időszak kezdete előtt kivezetésre került',
      };
    }
  }

  // Azonnali leírás (kisértékű eszköz 200.000 Ft alatt)
  if (asset.depreciation_method === 'immediate') {
    // Ha az aktiválás dátuma az időszakba esik:
    if (actDate >= fromDate && actDate <= toDate) {
      return {
        amount: depreciableBase,
        activeMonths: 1,
        accumulatedBefore: 0,
        remainingBookValue: residualValue,
      };
    } else {
      // Már leíródott korábban
      return {
        amount: 0,
        activeMonths: 0,
        accumulatedBefore: depreciableBase,
        remainingBookValue: residualValue,
        reason: 'Azonnali leírással korábban már elszámolva',
      };
    }
  }

  // Hónaphatárok meghatározása
  const actYear = actDate.getFullYear();
  const actMonth = actDate.getMonth() + 1; // 1-12

  const fromYear = fromDate.getFullYear();
  const fromMonth = fromDate.getMonth() + 1;

  const toYear = toDate.getFullYear();
  const toMonth = toDate.getMonth() + 1;

  // Az időszakra eső kezdő hónap: max(fromDate hónapja, aktiválás hónapja)
  let startPeriodYear = fromYear;
  let startPeriodMonth = fromMonth;
  if (actYear > fromYear || (actYear === fromYear && actMonth > fromMonth)) {
    startPeriodYear = actYear;
    startPeriodMonth = actMonth;
  }

  // Időszakra eső záró hónap: min(toDate hónapja, kivezetés hónapja)
  let endPeriodYear = toYear;
  let endPeriodMonth = toMonth;
  if (asset.disposal_date) {
    const dispDate = new Date(asset.disposal_date);
    const dispYear = dispDate.getFullYear();
    const dispMonth = dispDate.getMonth() + 1;
    if (dispYear < toYear || (dispYear === toYear && dispMonth < toMonth)) {
      endPeriodYear = dispYear;
      endPeriodMonth = dispMonth;
    }
  }

  // Ha a kezdő hónap későbbi mint a záró hónap: 0
  const activeMonths = getMonthDifferenceInclusive(startPeriodYear, startPeriodMonth, endPeriodYear, endPeriodMonth);
  if (activeMonths <= 0) {
    return {
      amount: 0,
      activeMonths: 0,
      accumulatedBefore: 0,
      remainingBookValue: acquisitionValue,
      reason: 'Nem esik aktív hónap a kijelölt időszakra',
    };
  }

  // 1. Lineáris leírás (Sztv. szerinti standard):
  if (asset.depreciation_method === 'linear' || !asset.depreciation_method) {
    const usefulLifeMonths = Math.max(1, Number(asset.useful_life_months) || 36);
    const monthlyRate = depreciableBase / usefulLifeMonths;
    const roundedMonthly = Math.round(monthlyRate);

    // Hány hónap telt el az aktiválástól az időszak kezdetéig?
    const priorMonths = Math.max(0, (startPeriodYear - actYear) * 12 + (startPeriodMonth - actMonth));
    const accumulatedBefore = Math.min(depreciableBase, priorMonths * roundedMonthly);
    const remainingBase = Math.max(0, depreciableBase - accumulatedBefore);

    if (remainingBase <= 0) {
      return {
        amount: 0,
        activeMonths,
        accumulatedBefore: depreciableBase,
        remainingBookValue: residualValue,
        reason: 'Az eszköz már teljesen leíródott',
      };
    }

    const rawPeriodAmount = activeMonths * roundedMonthly;
    const periodAmount = Math.min(remainingBase, rawPeriodAmount);
    const remainingBookValue = Math.max(residualValue, acquisitionValue - accumulatedBefore - periodAmount);

    return {
      amount: periodAmount,
      activeMonths,
      accumulatedBefore,
      remainingBookValue,
    };
  }

  // 2. Egyéb leírási módszerek (degresszív, progresszív, stb.)
  // useDepreciation calculateDepreciation-jét használjuk időpontbeli állapot különbségként
  const atEnd = calculateDepreciation({
    acquisitionValue,
    residualValue,
    activationDate: actDate,
    usefulLifeMonths: asset.useful_life_months,
    taoRatePercent: asset.tao_rate_override ?? 20,
    depreciationMethod: asset.depreciation_method,
    depreciationSchedule: asset.depreciation_schedule,
    performanceUnit: asset.performance_unit,
    totalPlannedPerformance: asset.total_planned_performance,
    disposalDate: asset.disposal_date ? new Date(asset.disposal_date) : undefined,
    calculationDate: new Date(endPeriodYear, endPeriodMonth, 0), // hónap utolsó napja
  });

  const atStart = calculateDepreciation({
    acquisitionValue,
    residualValue,
    activationDate: actDate,
    usefulLifeMonths: asset.useful_life_months,
    taoRatePercent: asset.tao_rate_override ?? 20,
    depreciationMethod: asset.depreciation_method,
    depreciationSchedule: asset.depreciation_schedule,
    performanceUnit: asset.performance_unit,
    totalPlannedPerformance: asset.total_planned_performance,
    disposalDate: asset.disposal_date ? new Date(asset.disposal_date) : undefined,
    calculationDate: new Date(startPeriodYear, startPeriodMonth - 1, 1), // kezdő hónap első napja
  });

  const accumulatedBefore = atStart.accounting.accumulated;
  const periodAmount = Math.max(0, atEnd.accounting.accumulated - accumulatedBefore);
  const remainingBookValue = atEnd.accounting.bookValue;

  return {
    amount: periodAmount,
    activeMonths,
    accumulatedBefore,
    remainingBookValue,
    reason: periodAmount === 0 ? 'Már teljesen leíródott' : undefined,
  };
}

/**
 * Feloldja a cég aktív számlatükör presetjének azonosítóját a chart_of_accounts_presets táblából.
 */
export async function resolveActivePresetId(companyId: string): Promise<string | null> {
  const { data: presets } = await supabase
    .from('chart_of_accounts_presets')
    .select('id, company_id, is_active, type');

  const activeCustom = presets?.find(p => p.company_id === companyId && p.is_active);
  if (activeCustom) return activeCustom.id;

  const anyCompanyPreset = presets?.find(p => p.company_id === companyId);
  if (anyCompanyPreset) return anyCompanyPreset.id;

  const genericPreset = presets?.find(p => p.type === 'generic');
  return genericPreset?.id || null;
}

/**
 * Lekérdezi a cég számlatükrét, és feloldja:
 * 1. A költség számlát (T 571 / 5711)
 * 2. Az egyes eszközökhöz tartozó halmozott értékcsökkenés számlákat (K 139xx, 149xx, 129xx, 119xx)
 */
export async function resolveGlAccountsForCompany(companyId: string) {
  const activePresetId = await resolveActivePresetId(companyId);

  let query = supabase.from('gl_accounts').select('id, gl_number, short_name, description');
  if (activePresetId && companyId) {
    query = query.or(`preset_id.eq.${activePresetId},company_id.eq.${companyId}`);
  } else if (activePresetId) {
    query = query.eq('preset_id', activePresetId);
  } else if (companyId) {
    query = query.eq('company_id', companyId);
  }

  const { data: glAccounts = [] } = await query.limit(3000);
  const accounts = glAccounts || [];

  // 1. Költség számla (T 5711 vagy 571)
  let debitExpenseAccount = accounts.find((a: any) => a.gl_number.startsWith('5711'));
  if (!debitExpenseAccount) {
    debitExpenseAccount = accounts.find((a: any) => a.gl_number.startsWith('571'));
  }
  if (!debitExpenseAccount) {
    debitExpenseAccount = accounts.find((a: any) =>
      a.gl_number.startsWith('5') &&
      ((a.short_name && a.short_name.toLowerCase().includes('értékcsökken')) ||
       (a.description && a.description.toLowerCase().includes('értékcsökken')) ||
       (a.short_name && a.short_name.toLowerCase().includes('ertekcsokken')))
    );
  }

  const isEcsAccount = (a: any) => {
    const name = (a.short_name || '').toLowerCase();
    const desc = (a.description || '').toLowerCase();
    return name.includes('értékcsökken') || name.includes('ertekcsokken') ||
           desc.includes('értékcsökken') || desc.includes('ertekcsokken');
  };

  // Segédfüggvény egy adott eszköz halmozott ÉCS számlájának (K) feloldására
  const resolveCreditAccountForAsset = (assetGlNumber?: string | null) => {
    const cleanGl = (assetGlNumber || '').replace(/[^0-9]/g, '');

    // Ha az eszköz számlaszáma ismert (pl. 1341, 131, 143):
    if (cleanGl.length >= 2) {
      const classPrefix = cleanGl[0]; // pl. '1'
      const groupPrefix = cleanGl[1]; // pl. '3'

      // 1. Speciális párosítás: pl. 1341 -> 13941, 131 -> 1319
      const cand1 = `${cleanGl}9`;
      const match1 = accounts.find((a: any) => a.gl_number.replace(/[^0-9]/g, '') === cand1 && isEcsAccount(a));
      if (match1) return match1;

      if (cleanGl.length >= 3) {
        const candidateNum = `${classPrefix}${groupPrefix}9${cleanGl.slice(2)}`;
        const exactMatch = accounts.find((a: any) => a.gl_number.replace(/[^0-9]/g, '') === candidateNum);
        if (exactMatch) return exactMatch;
      }

      // 2. Csoport szintű ÉCS számla: 13 -> 1399/139, 14 -> 1499/149
      const expectedGroup = `${classPrefix}${groupPrefix}`;
      const groupEcs = accounts.find((a: any) => a.gl_number.startsWith(expectedGroup) && isEcsAccount(a));
      if (groupEcs) return groupEcs;
    }

    // 3. Általános Műszaki vagy Irodai/Egyéb ÉCS számla (pl. 1399, 13941, 1499, 1493)
    const ecs139 = accounts.find((a: any) => a.gl_number.startsWith('139') && isEcsAccount(a));
    if (ecs139) return ecs139;

    const ecs149 = accounts.find((a: any) => a.gl_number.startsWith('149') && isEcsAccount(a));
    if (ecs149) return ecs149;

    const anyClass1Ecs = accounts.find((a: any) => a.gl_number.startsWith('1') && isEcsAccount(a));
    if (anyClass1Ecs) return anyClass1Ecs;

    // 4. Fallback ha a névben nem szerepel az értékcsökkenés szó
    const match139 = accounts.find((a: any) => a.gl_number.startsWith('139'));
    if (match139) return match139;

    return accounts.find((a: any) => a.gl_number.startsWith('149') || a.gl_number.startsWith('129')) || null;
  };

  return {
    accounts,
    debitExpenseAccount: debitExpenseAccount || null,
    resolveCreditAccountForAsset,
  };
}

/**
 * Ellenőrzi, hogy létezik-e már könyvelési tétel az adott bizonylatszámmal.
 */
export async function checkExistingDepreciationPosting(companyId: string, documentId: string) {
  const { data: existingHeader, error } = await supabase
    .from('acc_journal_headers')
    .select('id, journal_number, status, posting_date')
    .eq('company_id', companyId)
    .eq('document_id', documentId)
    .neq('status', 'SZTORNOZOTT')
    .maybeSingle();

  if (error || !existingHeader) {
    return { exists: false };
  }

  return {
    exists: true,
    headerId: existingHeader.id,
    journalNumber: existingHeader.journal_number,
    status: existingHeader.status,
  };
}

/**
 * Előnézet generálása az időszaki ÉCS feladáshoz.
 */
export async function previewDepreciationRun(params: {
  companyId: string;
  periodType: DepreciationPeriodType;
  dateFrom: string;
  dateTo: string;
  postingDate?: string;
  documentId?: string;
  selectedAssetIds?: string[];
}): Promise<DepreciationPreviewResult> {
  const { companyId, periodType, dateFrom, dateTo, selectedAssetIds } = params;

  const postingDate = params.postingDate || dateTo;

  // Alapértelmezett bizonylatszám képzése, ha nincs megadva
  let documentId = params.documentId;
  if (!documentId) {
    const year = dateTo.slice(0, 4);
    const month = dateTo.slice(5, 7);
    if (periodType === 'monthly') {
      documentId = `ECS-${year}-${month}`;
    } else if (periodType === 'quarterly') {
      const q = Math.ceil(parseInt(month, 10) / 3);
      documentId = `ECS-${year}-Q${q}`;
    } else if (periodType === 'annual') {
      documentId = `ECS-${year}-EVES`;
    } else {
      documentId = `ECS-${dateFrom.replace(/-/g, '')}_${dateTo.replace(/-/g, '')}`;
    }
  }

  // 1. Eszközök lekérése a kapcsolódó számlatükör információkkal
  let query = supabase
    .from('fixed_assets')
    .select(`
      *,
      gl_account:gl_accounts(id, gl_number, short_name)
    `)
    .eq('company_id', companyId)
    .eq('status', 'active');

  if (selectedAssetIds && selectedAssetIds.length > 0) {
    query = query.in('id', selectedAssetIds);
  }

  const { data: assets = [], error: assetErr } = await query;
  if (assetErr) throw assetErr;

  // 2. Főkönyvi számlák feloldása
  const { debitExpenseAccount, resolveCreditAccountForAsset } = await resolveGlAccountsForCompany(companyId);

  // 3. Meglévő feladás ellenőrzése
  const existingPosting = await checkExistingDepreciationPosting(companyId, documentId);

  // 4. ÉCS számítás eszközönként
  const items: DepreciationCalculationItem[] = [];
  let totalAmount = 0;
  let eligibleCount = 0;

  for (const asset of (assets as unknown as FixedAsset[])) {
    const calc = calculateAssetPeriodDepreciation(asset, dateFrom, dateTo);

    const assetGlNumber = asset.gl_account?.gl_number;
    const creditAccount = resolveCreditAccountForAsset(assetGlNumber);

    let status: DepreciationCalculationItem['status'] = 'ready';
    let reason = calc.reason;

    if (!debitExpenseAccount || !creditAccount) {
      status = 'missing_gl';
      reason = !debitExpenseAccount
        ? 'Hiányzó 571-es költségszámla a számlatükörben'
        : 'Nem található megfelelő 139/149-es halmozott ÉCS számla';
    } else if (calc.amount <= 0) {
      status = calc.remainingBookValue <= (Number(asset.residual_value) || 0)
        ? 'fully_depreciated'
        : 'zero';
    } else {
      totalAmount += calc.amount;
      eligibleCount++;
    }

    items.push({
      assetId: asset.id,
      assetName: asset.name,
      inventoryNumber: asset.inventory_number,
      acquisitionValue: Number(asset.acquisition_value) || 0,
      depreciableBase: Math.max(0, (Number(asset.acquisition_value) || 0) - (Number(asset.residual_value) || 0)),
      usefulLifeMonths: Number(asset.useful_life_months) || 0,
      depreciationMethod: asset.depreciation_method || 'linear',
      activeMonths: calc.activeMonths,
      periodAmount: calc.amount,
      accumulatedBefore: calc.accumulatedBefore,
      remainingBookValue: calc.remainingBookValue,
      debitGlAccountId: debitExpenseAccount?.id || null,
      debitGlNumber: debitExpenseAccount?.gl_number || '5711',
      creditGlAccountId: creditAccount?.id || null,
      creditGlNumber: creditAccount?.gl_number || '139',
      status,
      reason,
    });
  }

  // Időszak szöveges leírása
  const description = `Terv szerinti ÉCS elszámolás: ${dateFrom} – ${dateTo} (${documentId})`;

  return {
    periodType,
    dateFrom,
    dateTo,
    postingDate,
    documentId,
    description,
    items,
    totalAmount,
    eligibleCount,
    existingPosting,
  };
}

/**
 * Elvégzi az időszaki ÉCS lekönyvelését a Vegyes naplóba, és regisztrálja a könyvelési eseményeket.
 */
export async function postDepreciationRunToLedger(
  params: DepreciationPostingParams
): Promise<DepreciationPostingResult> {
  try {
    const { companyId, userId, periodType, dateFrom, dateTo, selectedAssetIds } = params;

    // 1. Újraszámoljuk az előnézetet a konzisztencia és hitelesség garantálása érdekében
    const preview = await previewDepreciationRun({
      companyId,
      periodType,
      dateFrom,
      dateTo,
      postingDate: params.postingDate,
      documentId: params.documentId,
      selectedAssetIds,
    });

    if (preview.totalAmount <= 0 || preview.eligibleCount === 0) {
      return {
        success: false,
        message: 'Nincs elszámolható értékcsökkenési tétel a megadott időszakra.',
      };
    }

    // 2. Ellenőrizzük a duplikációt
    if (preview.existingPosting?.exists) {
      return {
        success: false,
        message: `Ezzel a bizonylatszámmal (${preview.documentId}) már létezik lekönyvelt tétel a Vegyes naplóban!`,
      };
    }

    // 3. Értékcsökkenés feladása tranzakcionális SECURITY DEFINER RPC-n keresztül
    const eligibleItems = preview.items.filter(it => it.status === 'ready' && it.periodAmount > 0);
    if (eligibleItems.length === 0) {
      return {
        success: false,
        message: 'A számlatükör hiányosságai vagy 0 összeg miatt nem található könyvelhető tétel.',
      };
    }

    const itemsPayload = eligibleItems.map(item => ({
      asset_id: item.assetId,
      asset_name: item.assetName,
      inventory_number: item.inventoryNumber,
      acquisition_value: item.acquisitionValue,
      period_amount: item.periodAmount,
      accumulated_before: item.accumulatedBefore,
      remaining_book_value: item.remainingBookValue,
      active_months: item.activeMonths,
      debit_gl_account_id: item.debitGlAccountId,
      credit_gl_account_id: item.creditGlAccountId,
    }));

    const { data, error } = await supabase.rpc('post_depreciation_run_to_gl', {
      p_company_id: companyId,
      p_period_type: preview.periodType,
      p_date_from: preview.dateFrom,
      p_date_to: preview.dateTo,
      p_posting_date: preview.postingDate,
      p_document_id: preview.documentId,
      p_description: preview.description,
      p_currency: params.currency || 'HUF',
      p_items: itemsPayload as any,
    });

    if (error) {
      return {
        success: false,
        message: `Értékcsökkenés könyvelési hiba: ${error.message}`,
      };
    }

    const res = data as any;
    return {
      success: res?.success ?? true,
      headerId: res?.header_id,
      journalNumber: res?.journal_number,
      totalAmount: res?.total_amount ?? preview.totalAmount,
      assetCount: res?.asset_count ?? preview.eligibleCount,
      message: res?.message || `Sikeres könyvelés! Bizonylatszám: ${preview.documentId}${res?.journal_number ? ` (Napló sorszám: ${res.journal_number})` : ''}`,
    };
  } catch (err: any) {
    console.error('postDepreciationRunToLedger error:', err);
    return {
      success: false,
      message: err?.message || 'Ismeretlen hiba történt az ÉCS elszámolás könyvelése során.',
    };
  }
}
