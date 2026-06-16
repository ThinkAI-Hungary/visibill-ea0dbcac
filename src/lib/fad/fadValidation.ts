/**
 * FAD Validation — Fordított adózás validációs szabályok
 * ======================================================
 * Validates reverse charge invoices against legal requirements:
 * - Áfa tv. 142.§ personal scope check (both parties must be taxable persons)
 * - Áfa tv. 169.§ n) "fordított adózás" text must appear on invoice
 * - Category-specific amount thresholds
 * - Required fields for FAD bookkeeping
 */

import { type ReverseChargeCategory, FAD_CATEGORIES, isDomesticRC } from './fadTypes';

export type FadValidationSeverity = 'error' | 'warning' | 'info';

export interface FadValidationResult {
  code: string;
  severity: FadValidationSeverity;
  message: string;
  field?: string;
}

/**
 * Validate a reverse charge invoice for completeness and correctness.
 */
export function validateFadInvoice(invoice: {
  forditott_adozas?: boolean | null;
  is_reverse_charge?: boolean | null;
  reverse_charge_category?: string | null;
  adoalap_osszesen?: number | null;
  afa_osszeg_osszesen?: number | null;
  elado_vat_id?: string | null;
  vevo_vat_id?: string | null;
  supplier_tax_number?: string | null;
  customer_tax_number?: string | null;
  teljesites_datuma?: string | null;
  invoice_delivery_date?: string | null;
}): FadValidationResult[] {
  const results: FadValidationResult[] = [];

  const isFad = invoice.forditott_adozas === true || invoice.is_reverse_charge === true;
  if (!isFad) return results;

  // 1. Category should be identified
  if (!invoice.reverse_charge_category) {
    results.push({
      code: 'FAD_NO_CATEGORY',
      severity: 'warning',
      message: 'A fordított adózás kategóriája nincs meghatározva. A könyveléshez szükséges a pontos besorolás.',
      field: 'reverse_charge_category',
    });
  }

  // 2. VAT amount should be 0 on a FAD invoice
  const vatAmount = Number(invoice.afa_osszeg_osszesen ?? 0);
  if (vatAmount > 0) {
    results.push({
      code: 'FAD_NONZERO_VAT',
      severity: 'warning',
      message: `Fordított adózásnál a számlán nem szerepelhet ÁFA összeg (jelenleg: ${vatAmount} Ft). Ellenőrizze a számlát.`,
      field: 'afa_osszeg_osszesen',
    });
  }

  // 3. Both parties must be taxable persons (have VAT ID)
  const sellerVat = invoice.elado_vat_id || invoice.supplier_tax_number;
  const buyerVat = invoice.vevo_vat_id || invoice.customer_tax_number;

  if (!sellerVat) {
    results.push({
      code: 'FAD_MISSING_SELLER_VAT',
      severity: 'warning',
      message: 'Az eladó adószáma hiányzik. A fordított adózás alkalmazásához mindkét fél adóalany kell legyen.',
      field: 'elado_vat_id',
    });
  }

  if (!buyerVat) {
    results.push({
      code: 'FAD_MISSING_BUYER_VAT',
      severity: 'warning',
      message: 'A vevő adószáma hiányzik. A fordított adózás alkalmazásához mindkét fél adóalany kell legyen.',
      field: 'vevo_vat_id',
    });
  }

  // 4. Performance date is required for 60.§
  const perfDate = invoice.teljesites_datuma || invoice.invoice_delivery_date;
  if (!perfDate) {
    results.push({
      code: 'FAD_MISSING_PERF_DATE',
      severity: 'error',
      message: 'A teljesítés dátuma hiányzik. Az Áfa tv. 60.§ szerint ez szükséges a fizetendő adó megállapításához.',
      field: 'teljesites_datuma',
    });
  }

  // 5. Category-specific validations
  const category = invoice.reverse_charge_category as ReverseChargeCategory | null;
  if (category && isDomesticRC(category)) {
    // Domestic RC: both parties should have HU tax number
    if (sellerVat && !sellerVat.startsWith('HU') && !sellerVat.match(/^\d{8}/)) {
      results.push({
        code: 'FAD_FOREIGN_SELLER_DOMESTIC_RC',
        severity: 'info',
        message: 'Belföldi fordított adózásnál az eladónak is belföldinek kell lennie. Ellenőrizze a besorolást.',
      });
    }
  }

  return results;
}

/**
 * Get a summary severity for a set of validation results.
 */
export function getOverallSeverity(results: FadValidationResult[]): FadValidationSeverity | null {
  if (results.length === 0) return null;
  if (results.some(r => r.severity === 'error')) return 'error';
  if (results.some(r => r.severity === 'warning')) return 'warning';
  return 'info';
}
