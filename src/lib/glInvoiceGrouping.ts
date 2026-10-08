import { supabase } from '@/integrations/supabase/client';
import { GlCategorizedItem } from '@/lib/glData';

export type GlItemGroupingMode = 'by_invoice' | 'detailed';

export interface InvoiceItemMeta {
  invoiceId: string;
  invoiceNumber: string;
}

// In-memory cache for item metadata to avoid refetching on navigation / tab switches
const invoiceMetaCache = new Map<string, InvoiceItemMeta>();

/**
 * Enriches a list of GlCategorizedItems with parent invoice ID and document number
 * by batch querying invoice_items, nav_invoice_items, and acc_journal_lines.
 */
export async function enrichGlItemsWithInvoiceMeta(
  items: GlCategorizedItem[]
): Promise<GlCategorizedItem[]> {
  if (!items || items.length === 0) return items;

  const uncachedInvoiceItemIds: string[] = [];
  const uncachedNavItemIds: string[] = [];
  const uncachedAccLineIds: string[] = [];
  const uncachedInvoiceHeaderIds: string[] = [];
  const uncachedNavInvoiceHeaderIds: string[] = [];
  const uncachedJournalEntryIds: string[] = [];
  const uncachedTransactionIds: string[] = [];

  for (const item of items) {
    if (!item.item_id) continue;
    if (invoiceMetaCache.has(item.item_id)) {
      const cached = invoiceMetaCache.get(item.item_id)!;
      item.invoice_id = cached.invoiceId;
      item.invoice_number = cached.invoiceNumber;
      continue;
    }

    if (item.source_table === 'invoice_items') {
      uncachedInvoiceItemIds.push(item.item_id);
    } else if (item.source_table === 'nav_invoice_items') {
      uncachedNavItemIds.push(item.item_id);
    } else if (item.source_table === 'acc_journal_lines') {
      uncachedAccLineIds.push(item.item_id);
    } else if (
      item.source_table === 'invoices' ||
      item.source_table === 'invoices_partner' ||
      item.source_table === 'invoices_vat'
    ) {
      uncachedInvoiceHeaderIds.push(item.item_id);
    } else if (
      item.source_table === 'nav_invoices' ||
      item.source_table === 'nav_invoices_partner' ||
      item.source_table === 'nav_invoices_vat'
    ) {
      uncachedNavInvoiceHeaderIds.push(item.item_id);
    } else if (item.source_table === 'journal_entry') {
      uncachedJournalEntryIds.push(item.item_id);
    } else if (item.source_table === 'transactions') {
      uncachedTransactionIds.push(item.item_id);
    }
  }

  const chunk = <T>(arr: T[], size = 200): T[][] => {
    const res: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      res.push(arr.slice(i, i + size));
    }
    return res;
  };

  const tasks: (() => Promise<void>)[] = [];

  // 1. Invoices items
  if (uncachedInvoiceItemIds.length > 0) {
    for (const batch of chunk(uncachedInvoiceItemIds)) {
      tasks.push(async () => {
        try {
          const { data } = await supabase
            .from('invoice_items')
            .select('id, invoice_id, invoices(id, bizonylatsorszam)')
            .in('id', batch);
          if (data) {
            data.forEach((row: any) => {
              const meta: InvoiceItemMeta = {
                invoiceId: row.invoice_id,
                invoiceNumber: row.invoices?.bizonylatsorszam || '',
              };
              invoiceMetaCache.set(row.id, meta);
            });
          }
        } catch (e) {
          console.warn('Error fetching invoice_items metadata:', e);
        }
      });
    }
  }

  // 2. NAV Invoices items
  if (uncachedNavItemIds.length > 0) {
    for (const batch of chunk(uncachedNavItemIds)) {
      tasks.push(async () => {
        try {
          const { data } = await supabase
            .from('nav_invoice_items')
            .select('id, nav_invoice_id, nav_invoices(id, invoice_number)')
            .in('id', batch);
          if (data) {
            data.forEach((row: any) => {
              const meta: InvoiceItemMeta = {
                invoiceId: row.nav_invoice_id,
                invoiceNumber: row.nav_invoices?.invoice_number || '',
              };
              invoiceMetaCache.set(row.id, meta);
            });
          }
        } catch (e) {
          console.warn('Error fetching nav_invoice_items metadata:', e);
        }
      });
    }
  }

  // 3. Accounting journal lines
  if (uncachedAccLineIds.length > 0) {
    for (const batch of chunk(uncachedAccLineIds)) {
      tasks.push(async () => {
        try {
          const { data } = await supabase
            .from('acc_journal_lines')
            .select('id, header_id, acc_journal_headers(id, document_id)')
            .in('id', batch);
          if (data) {
            data.forEach((row: any) => {
              const meta: InvoiceItemMeta = {
                invoiceId: row.header_id,
                invoiceNumber: row.acc_journal_headers?.document_id || '',
              };
              invoiceMetaCache.set(row.id, meta);
            });
          }
        } catch (e) {
          console.warn('Error fetching acc_journal_lines metadata:', e);
        }
      });
    }
  }

  // 4. Invoices headers
  if (uncachedInvoiceHeaderIds.length > 0) {
    for (const batch of chunk(uncachedInvoiceHeaderIds)) {
      tasks.push(async () => {
        try {
          const { data } = await supabase
            .from('invoices')
            .select('id, bizonylatsorszam')
            .in('id', batch);
          if (data) {
            data.forEach((row: any) => {
              const meta: InvoiceItemMeta = {
                invoiceId: row.id,
                invoiceNumber: row.bizonylatsorszam || '',
              };
              invoiceMetaCache.set(row.id, meta);
            });
          }
        } catch (e) {
          console.warn('Error fetching invoices header metadata:', e);
        }
      });
    }
  }

  // 5. NAV Invoices headers
  if (uncachedNavInvoiceHeaderIds.length > 0) {
    for (const batch of chunk(uncachedNavInvoiceHeaderIds)) {
      tasks.push(async () => {
        try {
          const { data } = await supabase
            .from('nav_invoices')
            .select('id, invoice_number')
            .in('id', batch);
          if (data) {
            data.forEach((row: any) => {
              const meta: InvoiceItemMeta = {
                invoiceId: row.id,
                invoiceNumber: row.invoice_number || '',
              };
              invoiceMetaCache.set(row.id, meta);
            });
          }
        } catch (e) {
          console.warn('Error fetching nav_invoices header metadata:', e);
        }
      });
    }
  }

  // 6. XML Journal entries
  if (uncachedJournalEntryIds.length > 0) {
    for (const batch of chunk(uncachedJournalEntryIds)) {
      tasks.push(async () => {
        try {
          const { data } = await supabase
            .from('gl_journal_entries')
            .select('id, voucher_number')
            .in('id', batch);
          if (data) {
            data.forEach((row: any) => {
              const meta: InvoiceItemMeta = {
                invoiceId: row.id,
                invoiceNumber: row.voucher_number || '',
              };
              invoiceMetaCache.set(row.id, meta);
            });
          }
        } catch (e) {
          console.warn('Error fetching gl_journal_entries metadata:', e);
        }
      });
    }
  }

  // 7. Transactions with matched invoices
  if (uncachedTransactionIds.length > 0) {
    for (const batch of chunk(uncachedTransactionIds)) {
      tasks.push(async () => {
        try {
          const { data } = await supabase
            .from('transactions')
            .select('id, matched_invoice_id')
            .in('id', batch)
            .not('matched_invoice_id', 'is', null);
          if (data && data.length > 0) {
            const matchedInvIds = data.map(d => d.matched_invoice_id).filter(Boolean) as string[];
            if (matchedInvIds.length > 0) {
              const invMap = new Map<string, string>();
              const { data: invRows } = await supabase
                .from('invoices')
                .select('id, bizonylatsorszam')
                .in('id', matchedInvIds);
              invRows?.forEach(r => invMap.set(r.id, r.bizonylatsorszam || ''));

              const remainingIds = matchedInvIds.filter(id => !invMap.has(id));
              if (remainingIds.length > 0) {
                const { data: navRows } = await supabase
                  .from('nav_invoices')
                  .select('id, invoice_number')
                  .in('id', remainingIds);
                navRows?.forEach(r => invMap.set(r.id, r.invoice_number || ''));
              }

              data.forEach(tx => {
                if (tx.matched_invoice_id && invMap.has(tx.matched_invoice_id)) {
                  invoiceMetaCache.set(tx.id, {
                    invoiceId: tx.matched_invoice_id,
                    invoiceNumber: invMap.get(tx.matched_invoice_id) || '',
                  });
                }
              });
            }
          }
        } catch (e) {
          console.warn('Error fetching transaction invoice metadata:', e);
        }
      });
    }
  }

  // Execute batch tasks with a concurrency pool of max 4 concurrent requests
  // Prevents TCP socket exhaustion and ERR_INSUFFICIENT_RESOURCES in browser
  if (tasks.length > 0) {
    const CONCURRENCY_LIMIT = 4;
    let taskIndex = 0;
    const workers = Array.from(
      { length: Math.min(CONCURRENCY_LIMIT, tasks.length) },
      async () => {
        while (taskIndex < tasks.length) {
          const nextTask = tasks[taskIndex++];
          if (nextTask) {
            await nextTask();
          }
        }
      }
    );
    await Promise.all(workers);
  }

  // Assign metadata back to the items
  for (const item of items) {
    if (invoiceMetaCache.has(item.item_id)) {
      const meta = invoiceMetaCache.get(item.item_id)!;
      item.invoice_id = meta.invoiceId;
      item.invoice_number = meta.invoiceNumber;
    }

    // Fallback: extract voucher/invoice number from description if still empty
    if (!item.invoice_number && item.description) {
      const docMatch = item.description.match(/^([A-Za-z0-9\/-]{3,35})\s*[-•]/);
      if (docMatch && docMatch[1] && !docMatch[1].toLowerCase().includes('áfa')) {
        item.invoice_number = docMatch[1].trim();
      }
    }
  }

  return items;
}

export interface GroupableLedgerItem {
  id: string;
  name: string;
  balance: number;
  hasChildren?: boolean;
  cid: string;
  isItem?: boolean;
  itemType?: string;
  partner?: string | null;
  date?: string | null;
  sourceTable?: string;
  originalGlId?: string | null;
  originalAmount?: number;
  originalCurrency?: string;
  isExcluded?: boolean;
  isTemporary?: boolean;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  groupedCount?: number;
  groupedItemIds?: string[];
  groupedDescriptions?: string[];
  ancestorIds?: string[];
  depth?: number;
  isRoot?: boolean;
  debitTurnover?: number;
  creditTurnover?: number;
}

/**
 * Consolidates items under the same account that belong to the same invoice
 * into a single row when groupingMode === 'by_invoice'.
 * If groupingMode === 'detailed', items are returned unchanged.
 */
export function groupLedgerItemsByInvoice<T extends GroupableLedgerItem>(
  items: T[],
  groupingMode: GlItemGroupingMode = 'by_invoice'
): T[] {
  if (!items || items.length === 0 || groupingMode === 'detailed') {
    return items;
  }

  const groups = new Map<string, T[]>();

  for (const item of items) {
    let key: string;

    // Prioritize partner + invoiceNumber so multiple journal headers/items
    // for the same invoice consolidate together reliably
    if (item.invoiceNumber && item.partner) {
      key = `doc_${item.partner}_${item.invoiceNumber}`;
    } else if (item.invoiceId) {
      key = `inv_${item.invoiceId}`;
    } else {
      key = `single_${item.id}`;
    }

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(item);
  }

  const result: T[] = [];

  groups.forEach((groupItems) => {
    if (groupItems.length === 1) {
      const item = groupItems[0];
      // Format single item name cleanly if invoice number is known and not already present
      let displayName = item.name;
      if (item.invoiceNumber && !displayName.includes(item.invoiceNumber)) {
        if (item.partner && displayName.startsWith(item.partner)) {
          const rest = displayName.slice(item.partner.length).replace(/^[\s•-]+/, '').trim();
          displayName = rest ? `${item.partner} • ${item.invoiceNumber} (${rest})` : `${item.partner} • ${item.invoiceNumber}`;
        } else {
          displayName = `${item.invoiceNumber} • ${displayName}`;
        }
      }

      result.push({
        ...item,
        name: displayName,
      });
    } else {
      // Multiple items from the SAME invoice under this account
      const first = groupItems[0];
      const totalBalance = groupItems.reduce((acc, curr) => acc + (curr.balance || 0), 0);
      const totalOriginalAmount = groupItems.reduce((acc, curr) => acc + (curr.originalAmount || 0), 0);
      const totalDebitTurnover = groupItems.reduce((acc, curr) => acc + (curr.debitTurnover || 0), 0);
      const totalCreditTurnover = groupItems.reduce((acc, curr) => acc + (curr.creditTurnover || 0), 0);

      const invNum = first.invoiceNumber || '';
      const partnerStr = first.partner ? `${first.partner} • ` : '';
      const label = invNum ? `${partnerStr}${invNum}` : `${partnerStr}Számla`;

      const allDescriptions = groupItems.map(it => it.name);

      const aggregatedItem = {
        ...first,
        id: `grouped_${first.invoiceId || first.id}`,
        cid: `${first.cid}_grouped`,
        name: label,
        balance: totalBalance,
        originalAmount: totalOriginalAmount,
        debitTurnover: totalDebitTurnover,
        creditTurnover: totalCreditTurnover,
        groupedCount: groupItems.length,
        groupedItemIds: groupItems.map(it => it.id),
        groupedDescriptions: allDescriptions,
        isTemporary: groupItems.some(it => it.isTemporary),
      } as T;

      result.push(aggregatedItem);
    }
  });

  return result;
}
