/**
 * FAD Detection — NAV adatokból automatikus fordított adózás felismerés
 * =====================================================================
 * Detects reverse charge status from NAV invoice data (is_reverse_charge flag,
 * vat_rate containing DOMESTIC_REVERSE_CHARGE, and line item analysis).
 */

import { type ReverseChargeCategory, isDomesticRC } from './fadTypes';

export interface FadDetectionResult {
  isReverseCharge: boolean;
  category: ReverseChargeCategory | null;
  confidence: number;       // 0.0 - 1.0
  source: 'nav_flag' | 'vat_rate' | 'invoice_field' | 'ai_detected' | 'manual';
}

/**
 * Detect FAD status from NAV invoice data.
 * Works with both nav_invoices and invoices table shapes.
 */
export function detectFadFromInvoice(invoice: {
  is_reverse_charge?: boolean | null;
  forditott_adozas?: boolean | null;
  reverse_charge_category?: string | null;
}): FadDetectionResult {
  // 1. Explicit reverse_charge_category from AI
  if (invoice.reverse_charge_category) {
    return {
      isReverseCharge: true,
      category: invoice.reverse_charge_category as ReverseChargeCategory,
      confidence: 0.95,
      source: 'ai_detected',
    };
  }

  // 2. NAV flag (nav_invoices.is_reverse_charge)
  if (invoice.is_reverse_charge === true) {
    return {
      isReverseCharge: true,
      category: null, // Category needs to be determined
      confidence: 0.90,
      source: 'nav_flag',
    };
  }

  // 3. Invoice flag (invoices.forditott_adozas)
  if (invoice.forditott_adozas === true) {
    return {
      isReverseCharge: true,
      category: null,
      confidence: 0.85,
      source: 'invoice_field',
    };
  }

  return {
    isReverseCharge: false,
    category: null,
    confidence: 1.0,
    source: 'nav_flag',
  };
}

/**
 * Detect FAD from NAV invoice line items' vat_rate.
 * If any line has DOMESTIC_REVERSE_CHARGE vat_rate, the invoice is FAD.
 */
export function detectFadFromLineItems(items: Array<{
  vat_rate?: string | null;
}>): FadDetectionResult {
  const rcItem = items.find(
    (item) => item.vat_rate === 'DOMESTIC_REVERSE_CHARGE' || item.vat_rate === 'FAD'
  );

  if (rcItem) {
    return {
      isReverseCharge: true,
      category: null,
      confidence: 0.90,
      source: 'vat_rate',
    };
  }

  return {
    isReverseCharge: false,
    category: null,
    confidence: 1.0,
    source: 'vat_rate',
  };
}

/**
 * Aggregate FAD statistics for a set of invoices.
 */
export function computeFadStats(invoices: Array<{
  is_reverse_charge?: boolean | null;
  forditott_adozas?: boolean | null;
  reverse_charge_category?: string | null;
  adoalap_osszesen?: number | null;
  invoice_net_amount?: number | null;
  brutto_vegosszeg?: number | null;
  invoice_gross_amount?: number | null;
}>) {
  let totalCount = 0;
  let totalNetAmount = 0;
  const byCategory: Record<string, { count: number; netAmount: number }> = {};

  for (const inv of invoices) {
    const detection = detectFadFromInvoice(inv);
    if (!detection.isReverseCharge) continue;

    totalCount++;
    const net = Number(inv.adoalap_osszesen || inv.invoice_net_amount || 0);
    totalNetAmount += net;

    const cat = detection.category || 'unknown';
    if (!byCategory[cat]) {
      byCategory[cat] = { count: 0, netAmount: 0 };
    }
    byCategory[cat].count++;
    byCategory[cat].netAmount += net;
  }

  return {
    totalCount,
    totalNetAmount,
    byCategory,
    hasAny: totalCount > 0,
  };
}
