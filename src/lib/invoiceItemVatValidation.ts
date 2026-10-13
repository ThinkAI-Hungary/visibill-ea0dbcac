import { normalizeVatRatePercent, isReverseChargeVatRate } from './utils';

export interface ItemVatValidationResult {
  /** The mathematically verified or best available VAT amount */
  vatAmount: number | null;
  /** The mathematically verified or best available Gross amount */
  grossAmount: number | null;
  /** True if the VAT or Gross amount had to be mathematically auto-corrected from stored values */
  isAutoCorrected: boolean;
  /** True specifically if stored vat_amount differed from mathematical gross - net and net * rate */
  hasOcrVatDiscrepancy: boolean;
  /** Original stored VAT amount before correction */
  originalVatAmount: number | null;
  /** The mathematically expected VAT amount */
  expectedVatAmount: number | null;
  /** Human-readable explanation of why correction happened or what discrepancy exists */
  reason?: string;
}

export interface ItemVatInput {
  net_amount?: number | null;
  vat_amount?: number | null;
  gross_amount?: number | null;
  vat_rate?: string | number | null;
  is_reverse_charge?: boolean | null;
  is_fad_steel?: boolean | null;
  vat_code?: string | null;
  line_description?: string | null;
  vtsz_code?: string | null;
}

/**
 * Validates and resolves invoice line item VAT and Gross amounts using reverse math.
 * 
 * Verifies:
 * 1. Reverse charge (FAD / Steel) line items strictly have 0 Ft VAT charged on invoice (Gross = Net).
 * 2. Gross - Net == VAT (within ±2 Ft rounding tolerance).
 * 3. Net * Rate == Gross - Net (within ±2 Ft rounding tolerance).
 * 
 * If stored vat_amount was corrupted/truncated by OCR (e.g. 386 Ft instead of 4 386 Ft on a 20 631 Ft gross line,
 * or 1 670 Ft mistakenly charged on a reverse charge steel line), automatically recovers the verified amounts.
 */
export function validateAndResolveItemVat(item: ItemVatInput): ItemVatValidationResult {
  const net = item.net_amount != null && !isNaN(Number(item.net_amount)) ? Number(item.net_amount) : null;
  const storedVat = item.vat_amount != null && !isNaN(Number(item.vat_amount)) ? Number(item.vat_amount) : null;
  const gross = item.gross_amount != null && !isNaN(Number(item.gross_amount)) ? Number(item.gross_amount) : null;
  const ratePct = normalizeVatRatePercent(item.vat_rate);
  const isExplicitRc = isReverseChargeVatRate(item.vat_rate);

  const desc = (item.line_description || '').toLowerCase();
  const isSteelOrScrap =
    item.is_fad_steel === true ||
    (item.vtsz_code != null && String(item.vtsz_code).startsWith('7214')) ||
    desc.includes('acél') ||
    desc.includes('köracél') ||
    desc.includes('koracél') ||
    desc.includes('betonacél') ||
    desc.includes('vaslemez') ||
    desc.includes('fémhulladék') ||
    desc.includes('7214');

  const isFadVatCode = item.vat_code != null && item.vat_code.toUpperCase().includes('FAD');

  // Check if item is domestic reverse charge (FAD)
  // Steel products (köracél, betonacél, etc.) under Áfa tv. 142. § are mandatory reverse charge.
  const isFad =
    item.is_fad_steel === true ||
    isFadVatCode ||
    isExplicitRc ||
    isSteelOrScrap ||
    (item.is_reverse_charge === true && (!ratePct || ratePct === 0));

  // 1. Reverse charge line items (FAD / Steel / Scrap)
  if (isFad) {
    const resolvedNet = net ?? (gross !== null ? gross : null);
    const resolvedGross = resolvedNet;

    if (storedVat !== null && storedVat > 0) {
      return {
        vatAmount: 0,
        grossAmount: resolvedGross,
        isAutoCorrected: true,
        hasOcrVatDiscrepancy: true,
        originalVatAmount: storedVat,
        expectedVatAmount: 0,
        reason: `Fordított adózású tétel (FAD / Acél): A számlán felszámított ÁFA 0 Ft (Bruttó = Nettó = ${(resolvedNet ?? 0).toLocaleString('hu-HU')} Ft)`,
      };
    }

    const hasGrossDiscrepancy = gross !== null && resolvedNet !== null && Math.abs(gross - resolvedNet) > 2;

    return {
      vatAmount: 0,
      grossAmount: resolvedGross,
      isAutoCorrected: hasGrossDiscrepancy,
      hasOcrVatDiscrepancy: hasGrossDiscrepancy,
      originalVatAmount: storedVat,
      expectedVatAmount: 0,
      reason: 'Fordított adózás (FAD): ÁFA 0 Ft',
    };
  }

  // 2. Both Net and Gross are present and valid (Standard / Normal VAT)
  if (net !== null && gross !== null && gross >= net) {
    const grossMinusNet = Math.round(gross - net);

    if (ratePct !== null && ratePct > 0) {
      const rateExpectedVat = Math.round(net * (ratePct / 100));

      // Does Gross - Net match Net * Rate (within ±2 Ft rounding)?
      if (Math.abs(grossMinusNet - rateExpectedVat) <= 2) {
        // Mathematically proven correct VAT is grossMinusNet
        if (storedVat !== null && Math.abs(storedVat - grossMinusNet) > 2) {
          // Stored VAT is corrupted (e.g. dropped leading digit like 386 vs 4386)
          return {
            vatAmount: grossMinusNet,
            grossAmount: gross,
            isAutoCorrected: true,
            hasOcrVatDiscrepancy: true,
            originalVatAmount: storedVat,
            expectedVatAmount: grossMinusNet,
            reason: `OCR áfa hiba javítva: Tárolt ${storedVat.toLocaleString('hu-HU')} Ft helyett Bruttó - Nettó = ${grossMinusNet.toLocaleString('hu-HU')} Ft (${ratePct}%)`,
          };
        }

        // Stored VAT missing or 0
        if (storedVat === null || storedVat === 0) {
          return {
            vatAmount: grossMinusNet,
            grossAmount: gross,
            isAutoCorrected: true,
            hasOcrVatDiscrepancy: false,
            originalVatAmount: storedVat,
            expectedVatAmount: grossMinusNet,
            reason: `Hiányzó áfa kiszámítva (Bruttó - Nettó = ${grossMinusNet.toLocaleString('hu-HU')} Ft, ${ratePct}%)`,
          };
        }
      } else {
        // Gross - Net differs from Net * Rate (e.g. rounding or mixed rate item)
        if (storedVat !== null && Math.abs(storedVat - grossMinusNet) <= 2) {
          return {
            vatAmount: storedVat,
            grossAmount: gross,
            isAutoCorrected: false,
            hasOcrVatDiscrepancy: false,
            originalVatAmount: storedVat,
            expectedVatAmount: storedVat,
          };
        }
      }
    } else if (ratePct === 0) {
      // Exempt: VAT should be 0
      return {
        vatAmount: 0,
        grossAmount: gross,
        isAutoCorrected: storedVat != null && storedVat > 0,
        hasOcrVatDiscrepancy: false,
        originalVatAmount: storedVat,
        expectedVatAmount: 0,
        reason: 'Adómentes tétel: ÁFA 0 Ft',
      };
    } else {
      // No explicit rate percentage, but gross and net are available
      if (storedVat !== null && Math.abs(storedVat - grossMinusNet) > 2) {
        return {
          vatAmount: grossMinusNet,
          grossAmount: gross,
          isAutoCorrected: true,
          hasOcrVatDiscrepancy: true,
          originalVatAmount: storedVat,
          expectedVatAmount: grossMinusNet,
          reason: `Tárolt áfa (${storedVat.toLocaleString('hu-HU')} Ft) helyett Bruttó - Nettó = ${grossMinusNet.toLocaleString('hu-HU')} Ft`,
        };
      }
    }

    return {
      vatAmount: storedVat ?? grossMinusNet,
      grossAmount: gross,
      isAutoCorrected: false,
      hasOcrVatDiscrepancy: false,
      originalVatAmount: storedVat,
      expectedVatAmount: storedVat ?? grossMinusNet,
    };
  }

  // 3. Gross missing or 0, but Net and Rate are available (e.g. NAV utility invoices like MVM)
  if (net !== null && net > 0 && (gross === null || gross === 0)) {
    if (ratePct !== null && ratePct > 0) {
      const calculatedVat = Math.round(net * (ratePct / 100));
      const calculatedGross = net + calculatedVat;

      if (storedVat === null || storedVat === 0) {
        return {
          vatAmount: calculatedVat,
          grossAmount: calculatedGross,
          isAutoCorrected: true,
          hasOcrVatDiscrepancy: false,
          originalVatAmount: storedVat,
          expectedVatAmount: calculatedVat,
          reason: `Áfa és bruttó kiszámítva nettó és kulcs alapján (${ratePct}%)`,
        };
      }

      if (Math.abs(storedVat - calculatedVat) > 2) {
        return {
          vatAmount: calculatedVat,
          grossAmount: calculatedGross,
          isAutoCorrected: true,
          hasOcrVatDiscrepancy: true,
          originalVatAmount: storedVat,
          expectedVatAmount: calculatedVat,
          reason: `OCR áfa eltérés: Tárolt ${storedVat.toLocaleString('hu-HU')} Ft helyett ${ratePct}% alapján ${calculatedVat.toLocaleString('hu-HU')} Ft`,
        };
      }

      return {
        vatAmount: storedVat,
        grossAmount: net + storedVat,
        isAutoCorrected: true,
        hasOcrVatDiscrepancy: false,
        originalVatAmount: storedVat,
        expectedVatAmount: storedVat,
      };
    }
  }

  // 4. Fallback to existing values or basic combinations
  const resolvedVat = storedVat ?? (gross !== null && net !== null ? gross - net : null);
  const resolvedGross = gross ?? (net !== null && resolvedVat !== null ? net + resolvedVat : net ?? null);

  return {
    vatAmount: resolvedVat,
    grossAmount: resolvedGross,
    isAutoCorrected: false,
    hasOcrVatDiscrepancy: false,
    originalVatAmount: storedVat,
    expectedVatAmount: resolvedVat,
  };
}
