import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  calculateInvoiceProjectSummary,
  InvoiceProjectSummary,
  RawItemProjectData,
} from '@/lib/invoiceProjectSummary';

export function useInvoiceItemProjectAllocations(
  companyId: string | undefined,
  invoiceIds: string[],
  source: 'nav' | 'submitted' = 'nav'
) {
  const queryClient = useQueryClient();
  const idsKey = invoiceIds.slice().sort().join(',');

  return useQuery<Record<string, InvoiceProjectSummary>>({
    queryKey: ['invoice-item-projects', source, companyId, idsKey],
    queryFn: async () => {
      if (!companyId || invoiceIds.length === 0) return {};

      // 1. Gather all already-cached summaries across existing queries
      const cachedSummaries: Record<string, InvoiceProjectSummary> = {};
      const cachedQueries = queryClient.getQueriesData<Record<string, InvoiceProjectSummary>>({
        queryKey: ['invoice-item-projects', source, companyId],
      });
      for (const [, cacheData] of cachedQueries) {
        if (cacheData) {
          for (const id of invoiceIds) {
            if (cacheData[id] && !cachedSummaries[id]) {
              cachedSummaries[id] = cacheData[id];
            }
          }
        }
      }

      // 2. Identify missing IDs that actually need network fetching
      const missingIds = invoiceIds.filter((id) => !cachedSummaries[id]);
      if (missingIds.length === 0) {
        return cachedSummaries;
      }

      // 3. Fetch missing IDs from Supabase
      const table = source === 'submitted' ? 'invoice_items' : 'nav_invoice_items';
      const foreignKey = source === 'submitted' ? 'invoice_id' : 'nav_invoice_id';

      const { data, error } = await supabase
        .from(table as any)
        .select(`
          id,
          ${foreignKey},
          line_number,
          line_description,
          project_id,
          project_allocations,
          net_amount,
          gross_amount
        `)
        .in(foreignKey, missingIds)
        .or('project_id.not.is.null,project_allocations.not.is.null');

      if (error) {
        console.warn('Error fetching invoice item project allocations:', error);
        return cachedSummaries;
      }

      // Group items by invoiceId
      const itemsByInvoice = new Map<string, RawItemProjectData[]>();
      for (const raw of ((data as any[]) || [])) {
        const invId = raw[foreignKey];
        if (!invId) continue;
        const list = itemsByInvoice.get(invId) || [];
        list.push(raw as RawItemProjectData);
        itemsByInvoice.set(invId, list);
      }

      const summaries: Record<string, InvoiceProjectSummary> = { ...cachedSummaries };
      for (const invId of missingIds) {
        const items = itemsByInvoice.get(invId);
        if (items && items.length > 0) {
          summaries[invId] = calculateInvoiceProjectSummary(invId, items);
        }
      }

      return summaries;
    },
    placeholderData: (previousData) => {
      // Retain previous data if available
      const result: Record<string, InvoiceProjectSummary> = { ...previousData };
      // Also pull in any available cached items for the requested invoiceIds
      const cachedQueries = queryClient.getQueriesData<Record<string, InvoiceProjectSummary>>({
        queryKey: ['invoice-item-projects', source, companyId],
      });
      for (const [, cacheData] of cachedQueries) {
        if (cacheData) {
          for (const id of invoiceIds) {
            if (cacheData[id] && !result[id]) {
              result[id] = cacheData[id];
            }
          }
        }
      }
      return Object.keys(result).length > 0 ? result : undefined;
    },
    enabled: Boolean(companyId && invoiceIds.length > 0),
    staleTime: 60 * 1000,
  });
}
