/**
 * VAT 65M-02-K Correction & Storno Invoice Resolver
 * 
 * Implements the statutory Hungarian VAT return (NAV 2665M / 65M) logic for:
 * - 65M-02: Normal domestic invoices
 * - 65M-02-K: Correction, modification, and cancellation (storno) invoices
 * 
 * Rules:
 * 1. An invoice is a correction if invoice_operation IN ('STORNO', 'MODIFY'),
 *    has original_invoice_number, invoice_type is storno/helyesbito, or negative amounts.
 * 2. On 65M-02-K:
 *    - 'E' (Original invoice): positive base & tax
 *    - 'KT' (Correction in current period):
 *       - Storno: exactly matching negative amounts (-base, -tax)
 *       - Modification: net and vat difference (+/-)
 */

export type CorrectionType = 'Normál' | 'Sztornó' | 'Helyesbítő';

export interface RawInvoiceCandidate {
  id?: string;
  invoice_number?: string | null;
  bizonylatsorszam?: string | null;
  invoice_delivery_date?: string | null;
  teljesites_datuma?: string | null;
  delivery_date?: string | null;
  invoice_issue_date?: string | null;
  kibocsatas_datuma?: string | null;
  issue_date?: string | null;
  invoice_net_amount?: number | null;
  adoalap_osszesen?: number | null;
  net?: number | null;
  net_amount?: number | null;
  invoice_vat_amount?: number | null;
  afa_osszeg_osszesen?: number | null;
  vat?: number | null;
  vat_amount?: number | null;
  invoice_operation?: string | null;
  invoice_type?: string | null;
  original_invoice_number?: string | null;
  elolegszamla_hivatkozas?: string | null;
  reference_number?: string | null;
  supplier_tax_number?: string | null;
  elado_vat_id?: string | null;
}

export interface ResolvedCorrectionDetails {
  isCorrection: boolean;
  corrType: CorrectionType;
  anykCode: '02' | '02-K';
  originalInvoiceNumber: string | null;
  originalIssueDate: string | null;
  originalFulfillmentDate: string | null;
  originalNet: number;
  originalVat: number;
  correctionNet: number;
  correctionVat: number;
  isOriginalFound: boolean;
}

/**
 * Normalizes an invoice number for comparison (removes non-alphanumeric, uppercased).
 */
export function normalizeInvoiceNumber(num?: string | null): string {
  if (!num) return '';
  return String(num).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/**
 * Determines whether a given invoice is a correction/storno invoice.
 */
export function detectCorrectionType(inv: RawInvoiceCandidate): {
  isCorrection: boolean;
  corrType: CorrectionType;
  candidateOriginalNumber: string | null;
} {
  const op = String(inv.invoice_operation || '').toUpperCase();
  const type = String(inv.invoice_type || '').toLowerCase();
  const rawOriginalNum =
    inv.original_invoice_number ||
    inv.reference_number ||
    inv.elolegszamla_hivatkozas ||
    null;

  const net = Number(inv.invoice_net_amount ?? inv.adoalap_osszesen ?? inv.net ?? inv.net_amount ?? 0);
  const vat = Number(inv.invoice_vat_amount ?? inv.afa_osszeg_osszesen ?? inv.vat ?? inv.vat_amount ?? 0);

  // 1. Explicit modification / helyesbítő
  if (
    op === 'MODIFY' ||
    type === 'helyesbito_szamla' ||
    type === 'helyesbito' ||
    type === 'modification'
  ) {
    return {
      isCorrection: true,
      corrType: 'Helyesbítő',
      candidateOriginalNumber: rawOriginalNum,
    };
  }

  // 2. Explicit storno / cancellation
  if (
    op === 'STORNO' ||
    type === 'sztorno_szamla' ||
    type === 'storno'
  ) {
    return {
      isCorrection: true,
      corrType: 'Sztornó',
      candidateOriginalNumber: rawOriginalNum,
    };
  }

  // 3. Has original invoice reference without explicit operation
  if (rawOriginalNum && rawOriginalNum.trim() !== '') {
    return {
      isCorrection: true,
      corrType: net < 0 ? 'Sztornó' : 'Helyesbítő',
      candidateOriginalNumber: rawOriginalNum,
    };
  }

  // 4. Pure negative amount fallback
  if (net < 0 || vat < 0) {
    return {
      isCorrection: true,
      corrType: 'Sztornó',
      candidateOriginalNumber: rawOriginalNum,
    };
  }

  return {
    isCorrection: false,
    corrType: 'Normál',
    candidateOriginalNumber: null,
  };
}

/**
 * Resolves the 65M-02-K pair (Original invoice and Correction item)
 * using a search across existing company invoices.
 */
export function resolveCorrectionDetails(
  inv: RawInvoiceCandidate,
  allAvailableInvoices: RawInvoiceCandidate[] = []
): ResolvedCorrectionDetails {
  const detection = detectCorrectionType(inv);
  const currentNet = Math.round(Number(inv.invoice_net_amount ?? inv.adoalap_osszesen ?? inv.net ?? inv.net_amount ?? 0));
  const currentVat = Math.round(Number(inv.invoice_vat_amount ?? inv.afa_osszeg_osszesen ?? inv.vat ?? inv.vat_amount ?? 0));

  if (!detection.isCorrection) {
    return {
      isCorrection: false,
      corrType: 'Normál',
      anykCode: '02',
      originalInvoiceNumber: null,
      originalIssueDate: null,
      originalFulfillmentDate: null,
      originalNet: 0,
      originalVat: 0,
      correctionNet: currentNet,
      correctionVat: currentVat,
      isOriginalFound: false,
    };
  }

  const candidateOrig = detection.candidateOriginalNumber?.trim() || null;
  const normalizedCandidate = normalizeInvoiceNumber(candidateOrig);

  // Search in available invoices
  let foundOriginal: RawInvoiceCandidate | null = null;
  if (normalizedCandidate && allAvailableInvoices.length > 0) {
    foundOriginal =
      allAvailableInvoices.find((cand) => {
        const cNum = cand.invoice_number || cand.bizonylatsorszam;
        return normalizeInvoiceNumber(cNum) === normalizedCandidate;
      }) || null;
  }

  const currentFulfillment =
    inv.invoice_delivery_date || inv.teljesites_datuma || inv.delivery_date || inv.invoice_issue_date || inv.kibocsatas_datuma || inv.issue_date || null;
  const currentIssue = inv.invoice_issue_date || inv.kibocsatas_datuma || inv.issue_date || null;

  if (foundOriginal) {
    const origNet = Math.abs(Math.round(Number(foundOriginal.invoice_net_amount ?? foundOriginal.adoalap_osszesen ?? foundOriginal.net ?? foundOriginal.net_amount ?? 0)));
    const origVat = Math.abs(Math.round(Number(foundOriginal.invoice_vat_amount ?? foundOriginal.afa_osszeg_osszesen ?? foundOriginal.vat ?? foundOriginal.vat_amount ?? 0)));
    const origIssue = foundOriginal.invoice_issue_date || foundOriginal.kibocsatas_datuma || foundOriginal.issue_date || null;
    const origFulfillment = foundOriginal.invoice_delivery_date || foundOriginal.teljesites_datuma || foundOriginal.delivery_date || null;

    let corrNet = currentNet;
    let corrVat = currentVat;

    if (detection.corrType === 'Sztornó') {
      // In storno, NAV expects the exact original amounts with negative sign
      corrNet = -origNet;
      corrVat = -origVat;
    }

    return {
      isCorrection: true,
      corrType: detection.corrType,
      anykCode: '02-K',
      originalInvoiceNumber: foundOriginal.invoice_number || foundOriginal.bizonylatsorszam || candidateOrig,
      originalIssueDate: origIssue ? String(origIssue).substring(0, 10) : null,
      originalFulfillmentDate: origFulfillment ? String(origFulfillment).substring(0, 10) : null,
      originalNet: origNet,
      originalVat: origVat,
      correctionNet: corrNet,
      correctionVat: corrVat,
      isOriginalFound: true,
    };
  }

  // Fallback if original invoice is not found in database (e.g. prior year / paper archive)
  let fallbackOrigNet = Math.abs(currentNet);
  let fallbackOrigVat = Math.abs(currentVat);
  let corrNet = currentNet;
  let corrVat = currentVat;

  if (detection.corrType === 'Sztornó') {
    corrNet = -fallbackOrigNet;
    corrVat = -fallbackOrigVat;
  }

  return {
    isCorrection: true,
    corrType: detection.corrType,
    anykCode: '02-K',
    originalInvoiceNumber: candidateOrig || 'KORÁBBI SZÁMLA',
    originalIssueDate: currentIssue ? String(currentIssue).substring(0, 10) : null,
    originalFulfillmentDate: currentFulfillment ? String(currentFulfillment).substring(0, 10) : null,
    originalNet: fallbackOrigNet,
    originalVat: fallbackOrigVat,
    correctionNet: corrNet,
    correctionVat: corrVat,
    isOriginalFound: false,
  };
}
