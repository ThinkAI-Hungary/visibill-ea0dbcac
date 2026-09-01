import React, { useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { normalizeInvoiceNumber } from '@/lib/invoiceMatchingUtils';
import { NavInvoiceTable } from './NavInvoiceTable';
import { SubmittedInvoiceTable } from './SubmittedInvoiceTable';
import { InvoiceFilterBar } from '../filters/InvoiceFilterBar';
import { buildNavToSubmittedMap, buildSubmittedToNavMap } from '../../utils/invoiceRelations';
import { useInvoiceContext } from '../../context/useInvoiceContext';
import type { TransactionRecord } from '../../types';

export function InvoiceTableContainer() {
  const {
    activeTab,
    isSubmittedTab,
    companyId,
    submittedInvoices,
    paginatedNavInvoices,
    paginatedSubmittedInvoices,
    setExpandedRowIds,
    invalidateInvoiceData,
  } = useInvoiceContext();

  const [, setSearchParams] = useSearchParams();

  // 1. Build lookup maps
  const navToSubmittedMap = useMemo(
    () => buildNavToSubmittedMap(submittedInvoices, paginatedNavInvoices),
    [submittedInvoices, paginatedNavInvoices]
  );

  const submittedToNavMap = useMemo(
    () => buildSubmittedToNavMap(submittedInvoices, paginatedNavInvoices),
    [submittedInvoices, paginatedNavInvoices]
  );

  // 2. Collect all invoice IDs displayed on the current page
  const currentPageInvoiceIds = useMemo(() => {
    const ids = new Set<string>();
    if (isSubmittedTab) {
      paginatedSubmittedInvoices.forEach(sub => {
        if (sub.id) ids.add(sub.id);
        if (sub.bizonylatsorszam) {
          const navMatches = submittedToNavMap.get(normalizeInvoiceNumber(sub.bizonylatsorszam)) || [];
          navMatches.forEach(nav => {
            if (nav.id) ids.add(nav.id);
          });
        }
      });
    } else {
      paginatedNavInvoices.forEach(nav => {
        if (nav.id) ids.add(nav.id);
        const subMatches = navToSubmittedMap.get(normalizeInvoiceNumber(nav.invoice_number)) || [];
        subMatches.forEach(sub => {
          if (sub.id) ids.add(sub.id);
        });
      });
    }
    return Array.from(ids);
  }, [isSubmittedTab, paginatedSubmittedInvoices, paginatedNavInvoices, submittedToNavMap, navToSubmittedMap]);

  const pageInvoiceIdsKey = useMemo(() => currentPageInvoiceIds.slice().sort().join(','), [currentPageInvoiceIds]);

  // 3. Batch fetch transactions for current page invoices (O(1) scalable)
  const { data: pageTransactions = [] } = useQuery({
    queryKey: ['page-invoice-transactions', companyId, pageInvoiceIdsKey],
    queryFn: async () => {
      if (!companyId || currentPageInvoiceIds.length === 0) return [];

      const txList: TransactionRecord[] = [];

      // 3.1 Direct matches in transactions table
      const { data: directTxs, error: directErr } = await supabase
        .from('transactions')
        .select(
          'id, matched_invoice_id, transaction_date, amount, description, currency, type, confidence_score, match_type, is_verified, reason'
        )
        .eq('company_id', companyId)
        .in('matched_invoice_id', currentPageInvoiceIds);

      if (!directErr && directTxs) {
        directTxs.forEach((t: any) => {
          txList.push({
            id: t.id,
            matched_invoice_id: t.matched_invoice_id,
            transaction_date: t.transaction_date,
            amount: Number(t.amount || 0),
            description: t.description,
            currency: t.currency,
            type: t.type,
            confidence_score: t.confidence_score,
            match_type: t.match_type,
            is_verified: t.is_verified,
            reason: t.reason,
          });
        });
      }

      // 3.2 Multi-match join table (transaction_invoice_matches)
      const { data: multiMatches, error: multiErr } = await supabase
        .from('transaction_invoice_matches')
        .select(
          'transaction_id, invoice_id, transactions:transaction_id (id, transaction_date, amount, description, currency, type, confidence_score, match_type, is_verified, reason, company_id)'
        )
        .in('invoice_id', currentPageInvoiceIds);

      if (!multiErr && multiMatches) {
        for (const mm of multiMatches as any[]) {
          const t = mm.transactions;
          if (t && t.company_id === companyId) {
            if (!txList.some(item => item.id === t.id && item.matched_invoice_id === mm.invoice_id)) {
              txList.push({
                id: t.id,
                matched_invoice_id: mm.invoice_id,
                transaction_date: t.transaction_date,
                amount: Number(t.amount || 0),
                description: t.description,
                currency: t.currency,
                type: t.type,
                confidence_score: t.confidence_score,
                match_type: t.match_type,
                is_verified: t.is_verified,
                reason: t.reason,
              });
            }
          }
        }
      }

      return txList;
    },
    enabled: !!companyId && currentPageInvoiceIds.length > 0,
    staleTime: 30_000,
  });

  const pageInvoiceIdToTransactionsMap = useMemo(() => {
    const map = new Map<string, TransactionRecord[]>();
    pageTransactions.forEach(tx => {
      if (tx.matched_invoice_id) {
        const arr = map.get(tx.matched_invoice_id) || [];
        arr.push(tx);
        map.set(tx.matched_invoice_id, arr);
      }
    });
    return map;
  }, [pageTransactions]);

  // 4. Handle row click (expansion + URL param sync)
  const handleRowClick = useCallback(
    (invoiceId: string, e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('button, input, select, [role="checkbox"], [role="combobox"], [data-radix-collection-item]')) {
        return;
      }
      let isExpanding = false;
      setExpandedRowIds(prev => {
        const next = new Set(prev);
        isExpanding = !next.has(invoiceId);
        if (isExpanding) next.add(invoiceId);
        else next.delete(invoiceId);
        return next;
      });

      setSearchParams(
        sp => {
          const p = new URLSearchParams(sp);
          if (isExpanding) {
            p.set('invoice', invoiceId);
            p.delete('action');
          } else {
            p.delete('invoice');
            p.delete('action');
          }
          return p;
        },
        { replace: true }
      );
    },
    [setExpandedRowIds, setSearchParams]
  );

  // 5. Handle Toggle Exclude from accounting
  const handleToggleExclude = useCallback(
    async (invoiceId: string, currentValue: boolean) => {
      const table = isSubmittedTab ? 'invoices' : 'nav_invoices';
      const newValue = !currentValue;
      const { error } = await supabase
        .from(table)
        .update({ exclude_from_accounting: newValue })
        .eq('id', invoiceId);
      if (!error) {
        invalidateInvoiceData();
      }
    },
    [isSubmittedTab, invalidateInvoiceData]
  );

  return (
    <TabsContent value={activeTab} className="space-y-4 mt-4">
      <InvoiceFilterBar />

      {isSubmittedTab ? (
        <SubmittedInvoiceTable
          submittedToNavMap={submittedToNavMap}
          pageInvoiceIdToTransactionsMap={pageInvoiceIdToTransactionsMap}
          onRowClick={handleRowClick}
          onToggleExclude={handleToggleExclude}
        />
      ) : (
        <NavInvoiceTable
          navToSubmittedMap={navToSubmittedMap}
          pageInvoiceIdToTransactionsMap={pageInvoiceIdToTransactionsMap}
          onRowClick={handleRowClick}
          onToggleExclude={handleToggleExclude}
        />
      )}
    </TabsContent>
  );
}
