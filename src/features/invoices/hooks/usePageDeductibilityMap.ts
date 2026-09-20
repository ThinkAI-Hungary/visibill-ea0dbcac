import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface InvoiceDeductibilitySummary {
  invoiceId: string;
  totalVat: number;
  deductibleVat: number;
  nonDeductibleVat: number;
  minPercentage: number;
}

interface UsePageDeductibilityMapProps {
  navInvoiceIds?: string[];
  submittedInvoiceIds?: string[];
  enabled?: boolean;
}

export function usePageDeductibilityMap({
  navInvoiceIds = [],
  submittedInvoiceIds = [],
  enabled = true,
}: UsePageDeductibilityMapProps) {
  const navIdsKey = navInvoiceIds.slice().sort().join(',');
  const subIdsKey = submittedInvoiceIds.slice().sort().join(',');

  return useQuery({
    queryKey: ['page-invoice-deductibility-map', navIdsKey, subIdsKey],
    queryFn: async (): Promise<Map<string, InvoiceDeductibilitySummary>> => {
      const map = new Map<string, InvoiceDeductibilitySummary>();

      const promises: Promise<void>[] = [];

      // 1. Fetch non-deductible items for NAV invoices
      if (navInvoiceIds.length > 0) {
        promises.push(
          (async () => {
            const { data, error } = await supabase
              .from('nav_invoice_items')
              .select('id, nav_invoice_id, vat_amount, net_amount, vat_rate, deductible_percentage')
              .in('nav_invoice_id', navInvoiceIds)
              .lt('deductible_percentage', 100);

            if (error || !data) return;

            for (const item of data) {
              const invId = item.nav_invoice_id;
              if (!invId) continue;

              let vat = item.vat_amount;
              if ((vat === null || vat === 0 || vat === undefined) && item.net_amount && item.vat_rate) {
                const num = parseFloat(item.vat_rate);
                if (!isNaN(num) && num > 0) {
                  const rate = num >= 1 ? num / 100 : num;
                  vat = Math.round(item.net_amount * rate);
                }
              }
              const itemVat = vat || 0;
              const pct = item.deductible_percentage != null ? Number(item.deductible_percentage) : 100;
              const ded = Math.round(itemVat * (pct / 100));
              const nonDed = itemVat - ded;

              const existing = map.get(invId);
              if (existing) {
                existing.totalVat += itemVat;
                existing.deductibleVat += ded;
                existing.nonDeductibleVat += nonDed;
                existing.minPercentage = Math.min(existing.minPercentage, pct);
              } else {
                map.set(invId, {
                  invoiceId: invId,
                  totalVat: itemVat,
                  deductibleVat: ded,
                  nonDeductibleVat: nonDed,
                  minPercentage: pct,
                });
              }
            }
          })()
        );
      }

      // 2. Fetch non-deductible items for submitted invoices
      if (submittedInvoiceIds.length > 0) {
        promises.push(
          (async () => {
            const { data, error } = await supabase
              .from('invoice_items')
              .select('id, invoice_id, vat_amount, net_amount, vat_rate, deductible_percentage')
              .in('invoice_id', submittedInvoiceIds)
              .lt('deductible_percentage', 100);

            if (error || !data) return;

            for (const item of data) {
              const invId = item.invoice_id;
              if (!invId) continue;

              let vat = item.vat_amount;
              if ((vat === null || vat === 0 || vat === undefined) && item.net_amount && item.vat_rate) {
                const num = parseFloat(item.vat_rate);
                if (!isNaN(num) && num > 0) {
                  const rate = num >= 1 ? num / 100 : num;
                  vat = Math.round(item.net_amount * rate);
                }
              }
              const itemVat = vat || 0;
              const pct = item.deductible_percentage != null ? Number(item.deductible_percentage) : 100;
              const ded = Math.round(itemVat * (pct / 100));
              const nonDed = itemVat - ded;

              const existing = map.get(invId);
              if (existing) {
                existing.totalVat += itemVat;
                existing.deductibleVat += ded;
                existing.nonDeductibleVat += nonDed;
                existing.minPercentage = Math.min(existing.minPercentage, pct);
              } else {
                map.set(invId, {
                  invoiceId: invId,
                  totalVat: itemVat,
                  deductibleVat: ded,
                  nonDeductibleVat: nonDed,
                  minPercentage: pct,
                });
              }
            }
          })()
        );
      }

      await Promise.all(promises);
      return map;
    },
    enabled: enabled && (navInvoiceIds.length > 0 || submittedInvoiceIds.length > 0),
    staleTime: 60_000,
  });
}
