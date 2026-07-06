import { useMemo } from 'react';
import type { NavInvoice } from './useInvoiceData';

// ── Types ──

export interface NettingGroup {
  /** The normalized partner tax number (first 8 digits) */
  partnerTaxNumber: string;
  /** Human-readable partner name (from the first invoice found) */
  partnerName: string;
  /** Delivery month in YYYY-MM format */
  deliveryMonth: string;
  /** All INBOUND invoices in this group */
  inboundInvoices: NavInvoice[];
  /** All OUTBOUND invoices in this group */
  outboundInvoices: NavInvoice[];
  /** Sum of INBOUND gross amounts (absolute) */
  inboundTotal: number;
  /** Sum of OUTBOUND gross amounts (absolute) */
  outboundTotal: number;
  /** Net difference: outboundTotal - inboundTotal (positive = net receivable, negative = net payable) */
  netDifference: number;
  /** Currency (only same-currency groups are created) */
  currency: string;
}

// ── Helpers ──

/**
 * Normalize a Hungarian tax number to its core 8-digit form.
 * Strips "HU" prefix, dashes, spaces, and takes the first 8 digits.
 * Returns null if fewer than 8 digits remain.
 */
function normalizeTaxNumber(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/^HU/i, '').replace(/[-\s]/g, '');
  if (digits.length < 8) return null;
  return digits.substring(0, 8);
}

/**
 * Extract YYYY-MM from a date string (ISO format or YYYY-MM-DD).
 * Returns null if the date is missing or malformed.
 */
function getDeliveryMonth(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const match = dateStr.match(/^(\d{4}-\d{2})/);
  return match ? match[1] : null;
}

// ── Hook ──

/**
 * Detects invoice netting opportunities by finding partners that appear
 * in BOTH directions (INBOUND supplier + OUTBOUND customer) within
 * the same delivery month and same currency.
 *
 * This is a purely client-side heuristic — no DB changes needed.
 */
export function useNettingDetection(navInvoicesLookup: NavInvoice[]) {
  const { nettingInvoiceIds, nettingGroupsByInvoiceId, nettingGroups } = useMemo(() => {
    const ids = new Set<string>();
    const groupMap = new Map<string, NettingGroup>();
    const invoiceToGroupKey = new Map<string, string>();

    // Step 1: Build a nested map:
    // normalizedTaxNumber → currency → deliveryMonth → { inbound[], outbound[] }
    type MonthBucket = { inbound: NavInvoice[]; outbound: NavInvoice[]; partnerName: string };
    const partnerMap = new Map<string, Map<string, Map<string, MonthBucket>>>();

    for (const inv of navInvoicesLookup) {
      const direction = inv.invoice_direction;
      if (direction !== 'INBOUND' && direction !== 'OUTBOUND') continue;

      // Extract the partner tax number (the OTHER party)
      const rawTaxNumber = direction === 'INBOUND'
        ? inv.supplier_tax_number
        : inv.customer_tax_number;
      const normalizedTax = normalizeTaxNumber(rawTaxNumber);
      if (!normalizedTax) continue;

      const deliveryMonth = getDeliveryMonth(inv.invoice_delivery_date);
      if (!deliveryMonth) continue;

      const currency = (inv.currency || 'HUF').toUpperCase();

      // Get or create the partner → currency → month bucket
      if (!partnerMap.has(normalizedTax)) partnerMap.set(normalizedTax, new Map());
      const currencyMap = partnerMap.get(normalizedTax)!;
      if (!currencyMap.has(currency)) currencyMap.set(currency, new Map());
      const monthMap = currencyMap.get(currency)!;

      if (!monthMap.has(deliveryMonth)) {
        const partnerName = direction === 'INBOUND'
          ? (inv.supplier_name || normalizedTax)
          : (inv.customer_name || normalizedTax);
        monthMap.set(deliveryMonth, { inbound: [], outbound: [], partnerName });
      }

      const bucket = monthMap.get(deliveryMonth)!;
      if (direction === 'INBOUND') {
        bucket.inbound.push(inv);
      } else {
        bucket.outbound.push(inv);
      }
    }

    // Step 2: Find buckets where BOTH directions have invoices
    for (const [taxNumber, currencyMap] of partnerMap) {
      for (const [currency, monthMap] of currencyMap) {
        for (const [month, bucket] of monthMap) {
          if (bucket.inbound.length > 0 && bucket.outbound.length > 0) {
            const inboundTotal = bucket.inbound.reduce(
              (sum, inv) => sum + Math.abs(inv.invoice_gross_amount || 0), 0
            );
            const outboundTotal = bucket.outbound.reduce(
              (sum, inv) => sum + Math.abs(inv.invoice_gross_amount || 0), 0
            );

            const groupKey = `${taxNumber}__${currency}__${month}`;
            const group: NettingGroup = {
              partnerTaxNumber: taxNumber,
              partnerName: bucket.partnerName,
              deliveryMonth: month,
              inboundInvoices: bucket.inbound,
              outboundInvoices: bucket.outbound,
              inboundTotal,
              outboundTotal,
              netDifference: outboundTotal - inboundTotal,
              currency,
            };

            groupMap.set(groupKey, group);

            // Mark all invoices in this group
            for (const inv of bucket.inbound) {
              ids.add(inv.id);
              invoiceToGroupKey.set(inv.id, groupKey);
            }
            for (const inv of bucket.outbound) {
              ids.add(inv.id);
              invoiceToGroupKey.set(inv.id, groupKey);
            }
          }
        }
      }
    }

    return {
      nettingInvoiceIds: ids,
      nettingGroupsByInvoiceId: invoiceToGroupKey,
      nettingGroups: groupMap,
    };
  }, [navInvoicesLookup]);

  /**
   * Get the netting group for a specific invoice, or null if it's not
   * part of any netting group.
   */
  const getNettingGroup = (invoiceId: string): NettingGroup | null => {
    const groupKey = nettingGroupsByInvoiceId.get(invoiceId);
    if (!groupKey) return null;
    return nettingGroups.get(groupKey) || null;
  };

  return {
    /** Set of invoice IDs that are part of a netting group */
    nettingInvoiceIds,
    /** All detected netting groups */
    nettingGroups,
    /** Look up the netting group for a specific invoice */
    getNettingGroup,
  };
}
