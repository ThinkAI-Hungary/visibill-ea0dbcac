import { formatVatRate, normalizeVatRatePercent, isReverseChargeVatRate } from '@/lib/utils';

export interface VatCodeItem {
  id?: string;
  company_id?: string;
  code: string;
  legacy_code?: string | null;
  label: string;
  vat_percent: number;
  direction: 'OUTBOUND' | 'INBOUND' | string;
  is_deductible?: boolean;
  is_reverse_charge?: boolean;
  is_eu?: boolean;
  target_rows?: { row: string; col: 'base' | 'tax' }[];
  sort_order?: number;
  fad_category?: string | null;
}

export interface MatchVatCodeParams {
  vatRate: string | number | null | undefined;
  direction: 'OUTBOUND' | 'INBOUND' | string;
  vatCodes: VatCodeItem[];
  isReverseCharge?: boolean | null;
  lineDescription?: string | null;
}

export interface VatCodeBadgeResult {
  code: string;
  legacyCode: string;
  displayCode: string;
  rateLabel: string;
  tooltipText: string;
  source: VatCodeAssignmentSource;
  ruleExplanation?: string;
  isManual: boolean;
  isLearned: boolean;
}

export interface VatCodeOverrideLogEntry {
  id?: string;
  company_id?: string;
  item_id?: string;
  source_table?: string;
  partner_tax_number?: string | null;
  partner_name?: string | null;
  item_description: string;
  original_vat_rate?: string | null;
  original_vat_code?: string | null;
  new_vat_code_id: string;
  new_vat_code: string;
  direction?: string | null;
  created_at?: string;
}

export type VatCodeAssignmentSource = 'manual' | 'learned_partner' | 'learned_company' | 'heuristic';

export interface ResolveVatCodeParams {
  itemVatCodeId?: string | null;
  itemVatCode?: string | null;
  isItemManual?: boolean | null;
  vatRate: string | number | null | undefined;
  direction: 'OUTBOUND' | 'INBOUND' | string;
  lineDescription?: string | null;
  partnerTaxNumber?: string | null;
  partnerName?: string | null;
  vatCodes: VatCodeItem[];
  learnedRules?: VatCodeOverrideLogEntry[];
  isReverseCharge?: boolean | null;
}

export interface ResolvedVatCodeResult {
  matchedCode: VatCodeItem;
  source: VatCodeAssignmentSource;
  ruleExplanation?: string;
}

/**
 * Matches an invoice line item to a company's configured VAT code definition.
 */
export function matchItemToVatCode({
  vatRate,
  direction,
  vatCodes,
  isReverseCharge,
  lineDescription,
}: MatchVatCodeParams): VatCodeItem {
  const normDir = direction === 'OUTBOUND' ? 'OUTBOUND' : 'INBOUND';
  const dirCodes = (vatCodes || []).filter(c => c.direction === normDir);

  const isFad = isReverseCharge === true || isReverseChargeVatRate(vatRate);

  // 1. Reverse Charge (Fordított adózás: FAD, F.AFA, etc.)
  if (isFad) {
    const fadCodes = dirCodes.filter(c => c.is_reverse_charge);
    if (fadCodes.length > 0) {
      if (lineDescription) {
        const desc = lineDescription.toLowerCase();
        if (desc.includes('acél') || desc.includes('vas') || desc.includes('betonacél') || desc.includes('cső')) {
          const steelCode = fadCodes.find(c => c.code.includes('ACEL') || c.fad_category === 'steel');
          if (steelCode) return steelCode;
        }
        if (desc.includes('épít') || desc.includes('szerel') || desc.includes('kőműves') || desc.includes('burkol')) {
          const constrCode = fadCodes.find(c => c.code.includes('EPIT') || c.fad_category === 'construction');
          if (constrCode) return constrCode;
        }
        if (desc.includes('hulladék') || desc.includes('fémhulladék') || desc.includes('vaslemez')) {
          const scrapCode = fadCodes.find(c => c.code.includes('HULL') || c.fad_category === 'scrap_metal');
          if (scrapCode) return scrapCode;
        }
      }
      return fadCodes[0];
    }

    // Default reverse charge fallback
    return {
      code: normDir === 'OUTBOUND' ? 'KIM_FORD' : 'BE_FORD_27',
      legacy_code: 'FAD',
      label: normDir === 'OUTBOUND'
        ? 'Belföldi fordított értékesítés (mentes)'
        : 'FAD Építőipari / fordított adózás 27%',
      vat_percent: 0,
      direction: normDir,
      is_reverse_charge: true,
    };
  }

  const s = vatRate != null ? String(vatRate).trim() : '';
  const u = s.toUpperCase();

  // 2. Export / EU
  if (u.includes('EXP') || u.includes('EXPORT')) {
    const expCode = dirCodes.find(c => c.code.includes('EXPORT'));
    if (expCode) return expCode;
    return {
      code: 'KIM_EXPORT',
      legacy_code: 'EXP',
      label: 'Termékexport 3. országba (mentes)',
      vat_percent: 0,
      direction: normDir,
    };
  }

  if (u.includes('EU') || u.includes('KÖZÖSSÉG') || u.includes('INTRACOMMUNITY')) {
    const euCode = dirCodes.find(c => c.is_eu);
    if (euCode) return euCode;
  }

  // 3. Exempt (TAM, AAM, MENTES)
  if (['AAM', 'TAM', 'MENTES', '0', '0%', '0.00'].includes(u) || u.includes('TAM') || u.includes('AAM')) {
    const tamCode = dirCodes.find(c => !c.is_reverse_charge && (c.code.includes('TAM') || c.code.includes('0') || c.vat_percent === 0));
    if (tamCode) return tamCode;
    return {
      code: normDir === 'OUTBOUND' ? 'KIM_TAM' : 'BE_0_LEV',
      legacy_code: 'TAM',
      label: normDir === 'OUTBOUND'
        ? 'Közérdekű vagy speciális adómentes (TAM)'
        : 'Adómentes belföldi beszerzés (mentes)',
      vat_percent: 0,
      direction: normDir,
    };
  }

  // 4. Numeric percentages (27%, 18%, 5%)
  const pct = normalizeVatRatePercent(vatRate);
  if (pct !== null) {
    const matched = dirCodes.find(c => !c.is_reverse_charge && !c.is_eu && Math.round(Number(c.vat_percent)) === pct);
    if (matched) return matched;

    if (pct === 27) {
      return {
        code: normDir === 'OUTBOUND' ? 'KIM_27' : 'BE_27_LEV',
        legacy_code: '25',
        label: normDir === 'OUTBOUND' ? 'Belföldi 27% ÁFA' : 'Levonható 27% ÁFA',
        vat_percent: 27,
        direction: normDir,
      };
    }
    if (pct === 18) {
      return {
        code: normDir === 'OUTBOUND' ? 'KIM_18' : 'BE_18_LEV',
        legacy_code: '18',
        label: normDir === 'OUTBOUND' ? 'Belföldi 18% ÁFA' : 'Levonható 18% ÁFA',
        vat_percent: 18,
        direction: normDir,
      };
    }
    if (pct === 5) {
      return {
        code: normDir === 'OUTBOUND' ? 'KIM_5' : 'BE_5_LEV',
        legacy_code: '05',
        label: normDir === 'OUTBOUND' ? 'Belföldi 5% ÁFA' : 'Levonható 5% ÁFA',
        vat_percent: 5,
        direction: normDir,
      };
    }
    if (pct === 0) {
      return {
        code: normDir === 'OUTBOUND' ? 'KIM_TAM' : 'BE_0_LEV',
        legacy_code: 'TAM',
        label: normDir === 'OUTBOUND' ? 'Közérdekű vagy speciális adómentes (TAM)' : 'Adómentes belföldi beszerzés',
        vat_percent: 0,
        direction: normDir,
      };
    }
  }

  // Default fallback: 27% standard VAT
  const default27 = dirCodes.find(c => !c.is_reverse_charge && !c.is_eu && Math.round(Number(c.vat_percent)) === 27);
  if (default27) return default27;

  return {
    code: normDir === 'OUTBOUND' ? 'KIM_27' : 'BE_27_LEV',
    legacy_code: '25',
    label: normDir === 'OUTBOUND' ? 'Belföldi 27% ÁFA' : 'Levonható 27% ÁFA',
    vat_percent: 27,
    direction: normDir,
  };
}

/**
 * Resolves the appropriate VAT code using a 4-level cascade:
 * 1. Manual line item override (item has vat_code_id)
 * 2. Learned pattern for this specific partner (tax number + description match)
 * 3. Learned pattern across company (description keyword match)
 * 4. Heuristic default law matching (matchItemToVatCode)
 */
export function resolveVatCodeWithLearning({
  itemVatCodeId,
  itemVatCode,
  isItemManual,
  vatRate,
  direction,
  lineDescription,
  partnerTaxNumber,
  partnerName,
  vatCodes,
  learnedRules = [],
  isReverseCharge,
}: ResolveVatCodeParams): ResolvedVatCodeResult {
  const normDir = direction === 'OUTBOUND' ? 'OUTBOUND' : 'INBOUND';
  const dirCodes = (vatCodes || []).filter(c => c.direction === normDir);

  // 1. Manual item override
  if (itemVatCodeId || itemVatCode) {
    const directCode = vatCodes.find(
      c => (itemVatCodeId && c.id === itemVatCodeId) || (itemVatCode && c.code === itemVatCode)
    );
    if (directCode) {
      return {
        matchedCode: directCode,
        source: 'manual',
        ruleExplanation: 'Kézzel rögzített egyedi áfakód ezen a számlán',
      };
    }
  }

  // Helper for normalizing text
  const normalize = (t: string | null | undefined) =>
    (t || '')
      .toLowerCase()
      .replace(/[\s\-_,./\\()]+/g, ' ')
      .trim();

  const itemNorm = normalize(lineDescription);
  const cleanTax8 = partnerTaxNumber ? partnerTaxNumber.replace(/[^0-9]/g, '').slice(0, 8) : '';

  // 2. Learned pattern from specific partner
  if (cleanTax8 && itemNorm && learnedRules.length > 0) {
    const partnerRule = learnedRules.find(r => {
      const rTax8 = r.partner_tax_number ? r.partner_tax_number.replace(/[^0-9]/g, '').slice(0, 8) : '';
      if (rTax8 !== cleanTax8) return false;
      const rDescNorm = normalize(r.item_description);
      return rDescNorm === itemNorm || itemNorm.includes(rDescNorm) || rDescNorm.includes(itemNorm);
    });

    if (partnerRule) {
      const learnedCode = vatCodes.find(
        c => (c.id && c.id === partnerRule.new_vat_code_id) || c.code === partnerRule.new_vat_code
      );
      if (learnedCode) {
        return {
          matchedCode: learnedCode,
          source: 'learned_partner',
          ruleExplanation: `Gépi tanulás: a(z) ${partnerRule.partner_name || partnerName || 'partner'} korábbi hasonló tételeinél ezt állítottad be`,
        };
      }
    }
  }

  // 3. Learned pattern across company by item description
  if (itemNorm && learnedRules.length > 0) {
    const companyRule = learnedRules.find(r => {
      const rDescNorm = normalize(r.item_description);
      return rDescNorm === itemNorm || (itemNorm.length >= 6 && rDescNorm.includes(itemNorm)) || (rDescNorm.length >= 6 && itemNorm.includes(rDescNorm));
    });

    if (companyRule) {
      const learnedCode = vatCodes.find(
        c => (c.id && c.id === companyRule.new_vat_code_id) || c.code === companyRule.new_vat_code
      );
      if (learnedCode) {
        return {
          matchedCode: learnedCode,
          source: 'learned_company',
          ruleExplanation: `Gépi tanulás: korábbi hasonló tételnél ("${companyRule.item_description}") ezt állítottad be`,
        };
      }
    }
  }

  // 4. Default Heuristic fallback
  const fallbackCode = matchItemToVatCode({
    vatRate,
    direction: normDir,
    vatCodes,
    isReverseCharge,
    lineDescription,
  });

  return {
    matchedCode: fallbackCode,
    source: 'heuristic',
  };
}

/**
 * Calculates the display code, formatted rate, and tooltip text for line items based on company display mode.
 */
export function getVatCodeBadgeData(
  matchedCode: VatCodeItem,
  displayMode: 'legacy' | 'nav',
  rawVatRate: string | number | null | undefined,
  source: VatCodeAssignmentSource = 'heuristic',
  ruleExplanation?: string
): VatCodeBadgeResult {
  const code = matchedCode.code;
  const legacyCode = matchedCode.legacy_code || code;
  const displayCode = displayMode === 'nav' ? code : legacyCode;
  const rateLabel = formatVatRate(rawVatRate);
  
  let tooltipText = matchedCode.label || code;
  if (source === 'learned_partner' || source === 'learned_company') {
    tooltipText = `${tooltipText}\n✨ ${ruleExplanation || 'Gépi tanulás által felajánlva'}`;
  } else if (source === 'manual') {
    tooltipText = `${tooltipText}\n✏️ Kézzel rögzített áfakód`;
  }

  const isManual = source === 'manual';
  const isLearned = source === 'learned_partner' || source === 'learned_company';

  return {
    code,
    legacyCode,
    displayCode,
    rateLabel,
    tooltipText,
    source,
    ruleExplanation,
    isManual,
    isLearned,
  };
}
