/**
 * FAD Booking Engine — Áfa tv. 60. § időpont-motor
 * =================================================
 * Meghatározza a fordított adózásból eredő fizetendő áfa
 * megállapításának időpontját az Áfa tv. 60. § szerint.
 *
 * Fordított adózásnál a vevő állapítja meg és fizeti az áfát.
 * A fizetendő adó időpontja: a teljesítés napja.
 * Az adókulcs a számla nettó összegére vetítve.
 */

import { type ReverseChargeCategory, isDomesticRC } from './fadTypes';

/** Standard VAT rates for Hungary */
const STANDARD_VAT_RATE = 0.27;

export interface ReverseChargeEntry {
  /** Source invoice/line item ID */
  sourceId: string;
  /** Whether this is a NAV or uploaded invoice */
  sourceTable: 'nav_invoices' | 'invoices';
  /** FAD category */
  category: ReverseChargeCategory | null;
  /** Net amount (adóalap) */
  netAmount: number;
  /** Applied VAT rate (0.27, 0.05, etc.) */
  vatRate: number;
  /** Calculated VAT amount (netAmount × vatRate) */
  vatAmount: number;
  /** Date when VAT obligation arises (teljesítés dátuma) */
  vatDate: string;  // ISO date
  /** Currency */
  currency: string;
}

/**
 * Calculate the reverse charge VAT entries for an invoice.
 *
 * Rules:
 * - Domestic RC (142.§): VAT rate from the applicable category (usually 27%)
 * - EU service import: VAT rate 27%
 * - Third country service: VAT rate 27%
 * - The VAT date is the teljesítés dátuma (performance date)
 */
export function calculateReverseChargeVat(params: {
  sourceId: string;
  sourceTable: 'nav_invoices' | 'invoices';
  category: ReverseChargeCategory | null;
  netAmount: number;
  vatRate?: number;
  performanceDate: string;   // teljesítés dátuma
  issueDate: string;         // kibocsátás dátuma
  currency?: string;
}): ReverseChargeEntry {
  const {
    sourceId,
    sourceTable,
    category,
    netAmount,
    performanceDate,
    issueDate,
    currency = 'HUF',
  } = params;

  // Áfa tv. 60. §: fizetendő adó megállapítása a teljesítés napján
  const vatDate = performanceDate || issueDate;

  // Default to 27% for all FAD categories in Hungary
  const rate = params.vatRate ?? STANDARD_VAT_RATE;
  const vatAmount = Math.round(netAmount * rate);

  return {
    sourceId,
    sourceTable,
    category,
    netAmount,
    vatRate: rate,
    vatAmount,
    vatDate,
    currency,
  };
}

/**
 * Calculate total FAD VAT obligations for a period.
 * Used for ÁFA bevallás (VAT return) integration.
 */
export function summarizeFadForPeriod(entries: ReverseChargeEntry[]) {
  let totalNetAmount = 0;
  let totalVatAmount = 0;
  const byCategory: Record<string, {
    netAmount: number;
    vatAmount: number;
    count: number;
  }> = {};

  for (const entry of entries) {
    totalNetAmount += entry.netAmount;
    totalVatAmount += entry.vatAmount;

    const cat = entry.category || 'unknown';
    if (!byCategory[cat]) {
      byCategory[cat] = { netAmount: 0, vatAmount: 0, count: 0 };
    }
    byCategory[cat].netAmount += entry.netAmount;
    byCategory[cat].vatAmount += entry.vatAmount;
    byCategory[cat].count++;
  }

  return {
    totalNetAmount,
    totalVatAmount,
    entryCount: entries.length,
    byCategory,
  };
}
