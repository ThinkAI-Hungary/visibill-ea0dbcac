import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { normalizeInvoiceNumber } from '@/lib/invoiceMatchingUtils';
import { NavInvoiceTable } from './NavInvoiceTable';
import { SubmittedInvoiceTable } from './SubmittedInvoiceTable';
import { InvoiceFilterBar } from '../filters/InvoiceFilterBar';
import { buildNavToSubmittedMap, buildSubmittedToNavMap, buildNavToSuggestedSubmittedMap } from '../../utils/invoiceRelations';
import { useInvoiceContext } from '../../context/useInvoiceContext';
import { usePageDeductibilityMap, type InvoiceDeductibilitySummary } from '../../hooks/usePageDeductibilityMap';
import { toast } from '@/hooks/use-toast';
import { ExclusionReasonDialog, type ExclusionDialogInvoice } from '../ExclusionReasonDialog';
import type { TransactionRecord } from '../../types';

export function InvoiceTableContainer() {
  const queryClient = useQueryClient();
  const {
    activeTab,
    isSubmittedTab,
    companyId,
    submittedInvoices,
    paginatedNavInvoices,
    paginatedSubmittedInvoices,
    toggleRowExpanded,
    invalidateInvoiceData,
    setLastViewedInvoiceId,
  } = useInvoiceContext();

  // 1. Fetch matching NAV invoices for the submitted invoices displayed on the current page
  const pageSubmittedNumbers = useMemo(() => {
    if (!isSubmittedTab) return [];
    return Array.from(
      new Set(
        paginatedSubmittedInvoices
          .map(s => s.bizonylatsorszam)
          .filter(Boolean) as string[]
      )
    );
  }, [isSubmittedTab, paginatedSubmittedInvoices]);

  const pageSubmittedNumbersKey = useMemo(
    () => pageSubmittedNumbers.slice().sort().join(','),
    [pageSubmittedNumbers]
  );

  const { data: pageMatchedNavInvoices = [] } = useQuery({
    queryKey: ['page-matched-nav-invoices', companyId, pageSubmittedNumbersKey],
    queryFn: async () => {
      if (!companyId || pageSubmittedNumbers.length === 0) return [];
      const { data, error } = await supabase
        .from('nav_invoices')
        .select('*')
        .eq('company_id', companyId)
        .in('invoice_number', pageSubmittedNumbers);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: isSubmittedTab && pageSubmittedNumbers.length > 0,
  });

  const effectiveNavInvoices = isSubmittedTab ? pageMatchedNavInvoices : paginatedNavInvoices;

  // 2. Build lookup maps
  const navToSubmittedMap = useMemo(
    () => buildNavToSubmittedMap(submittedInvoices, paginatedNavInvoices),
    [submittedInvoices, paginatedNavInvoices]
  );

  const submittedToNavMap = useMemo(
    () => buildSubmittedToNavMap(submittedInvoices, effectiveNavInvoices),
    [submittedInvoices, effectiveNavInvoices]
  );

  const navToSuggestedSubmittedMap = useMemo(
    () => buildNavToSuggestedSubmittedMap(submittedInvoices, paginatedNavInvoices, navToSubmittedMap),
    [submittedInvoices, paginatedNavInvoices, navToSubmittedMap]
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

  // 3.3 Batch fetch deductibility for current page invoices
  const pageNavIds = useMemo(() => {
    return isSubmittedTab ? [] : paginatedNavInvoices.map(n => n.id).filter(Boolean);
  }, [isSubmittedTab, paginatedNavInvoices]);

  const pageSubIds = useMemo(() => {
    return isSubmittedTab ? paginatedSubmittedInvoices.map(s => s.id).filter(Boolean) : [];
  }, [isSubmittedTab, paginatedSubmittedInvoices]);

  const { data: pageDeductibilityMap = new Map<string, InvoiceDeductibilitySummary>() } = usePageDeductibilityMap({
    navInvoiceIds: pageNavIds,
    submittedInvoiceIds: pageSubIds,
    enabled: !!companyId,
  });

  // 4. Handle row click (instant focus + selection + expansion with URL sync)
  const handleRowClick = useCallback(
    (invoiceId: string, e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('button, input, select, [role="checkbox"], [role="combobox"], [data-radix-collection-item], a')) {
        return;
      }
      setLastViewedInvoiceId(invoiceId);
      toggleRowExpanded(invoiceId);
    },
    [setLastViewedInvoiceId, toggleRowExpanded]
  );

  // 5. Handle Toggle Exclude from accounting
  const [isExclusionDialogOpen, setIsExclusionDialogOpen] = useState(false);
  const [selectedExclusionInvoice, setSelectedExclusionInvoice] = useState<ExclusionDialogInvoice | null>(null);

  const handleOpenExclusionDialog = useCallback((invoice: any) => {
    setSelectedExclusionInvoice({
      id: invoice.id,
      invoice_number: invoice.invoice_number || invoice.bizonylatsorszam || '',
      supplier_name: invoice.supplier_name || invoice.elado_nev || null,
      gross_amount: invoice.invoice_gross_amount || invoice.brutto_vegosszeg || null,
      net_amount: invoice.invoice_net_amount || invoice.adoalap_osszesen || null,
      vat_amount: invoice.invoice_vat_amount || invoice.afa_osszeg_osszesen || null,
      currency: invoice.currency || invoice.penznem || 'HUF',
      delivery_date: invoice.invoice_delivery_date || invoice.teljesites_datuma || invoice.invoice_issue_date || null,
      is_submitted: isSubmittedTab,
      exclude_from_accounting: invoice.exclude_from_accounting,
      accounting_exclusion_type: invoice.accounting_exclusion_type,
      deferred_vat_reason: invoice.deferred_vat_reason,
    });
    setIsExclusionDialogOpen(true);
  }, [isSubmittedTab]);

  const handleToggleExclude = useCallback(
    async (invoiceId: string, currentValue: boolean) => {
      // If currently not excluded, open dialog so user can choose between Deferred VAT vs Permanent exclusion
      if (!currentValue) {
        const found = isSubmittedTab
          ? paginatedSubmittedInvoices.find(i => i.id === invoiceId)
          : paginatedNavInvoices.find(i => i.id === invoiceId);
        if (found) {
          handleOpenExclusionDialog(found);
          return;
        }
      }

      const newValue = !currentValue;

      // Optimistically update React Query cache so the UI updates instantly with zero flicker or jumping
      const updateList = (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((inv: any) =>
          inv.id === invoiceId ? { ...inv, exclude_from_accounting: newValue, accounting_exclusion_type: null } : inv
        );
      };

      if (companyId) {
        queryClient.setQueriesData({ queryKey: ['filteredNavInvoices', companyId] }, updateList);
        queryClient.setQueriesData({ queryKey: ['filteredSubmittedInvoices', companyId] }, updateList);
        queryClient.setQueriesData({ queryKey: ['submittedInvoices', companyId] }, updateList);
        queryClient.setQueriesData({ queryKey: ['page-matched-nav-invoices', companyId] }, updateList);
      }

      try {
        if (companyId) {
          const { error } = await supabase.rpc('set_invoice_accounting_exclusion', {
            p_company_id: companyId,
            p_invoice_id: invoiceId,
            p_is_submitted: isSubmittedTab,
            p_exclusion_type: null,
          });

          if (error) {
            console.error('Error in set_invoice_accounting_exclusion RPC:', error);
            // Fallback to table update if RPC returns error
            const table = isSubmittedTab ? 'invoices' : 'nav_invoices';
            const { error: fallbackError } = await supabase
              .from(table)
              .update({ exclude_from_accounting: newValue, accounting_exclusion_type: null })
              .eq('id', invoiceId);
            if (fallbackError) throw fallbackError;
          }
        }

        invalidateInvoiceData();
        queryClient.invalidateQueries({ queryKey: ['gl_balances'] });
        queryClient.invalidateQueries({ queryKey: ['gl_categorized_items'] });
        queryClient.invalidateQueries({ queryKey: ['gl_account_card'] });
        queryClient.invalidateQueries({ queryKey: ['partner_ledger_card'] });
        queryClient.invalidateQueries({ queryKey: ['acc_journal_headers'] });
      } catch (err: any) {
        console.error('Failed to toggle exclude_from_accounting:', err);
        // Rollback optimistic update
        const rollbackList = (old: any) => {
          if (!Array.isArray(old)) return old;
          return old.map((inv: any) =>
            inv.id === invoiceId ? { ...inv, exclude_from_accounting: currentValue } : inv
          );
        };
        if (companyId) {
          queryClient.setQueriesData({ queryKey: ['filteredNavInvoices', companyId] }, rollbackList);
          queryClient.setQueriesData({ queryKey: ['filteredSubmittedInvoices', companyId] }, rollbackList);
          queryClient.setQueriesData({ queryKey: ['submittedInvoices', companyId] }, rollbackList);
          queryClient.setQueriesData({ queryKey: ['page-matched-nav-invoices', companyId] }, rollbackList);
        }
        toast({
          title: 'Hiba történt a könyvelési státusz módosításakor',
          description: err?.message || 'Kérjük próbáld újra később.',
          variant: 'destructive',
        });
      }
    },
    [companyId, isSubmittedTab, invalidateInvoiceData, queryClient, paginatedSubmittedInvoices, paginatedNavInvoices, handleOpenExclusionDialog]
  );

  return (
    <TabsContent value={activeTab} className="space-y-4 mt-4">
      <InvoiceFilterBar />

      {isSubmittedTab ? (
        <SubmittedInvoiceTable
          submittedToNavMap={submittedToNavMap}
          pageInvoiceIdToTransactionsMap={pageInvoiceIdToTransactionsMap}
          pageDeductibilityMap={pageDeductibilityMap}
          onRowClick={handleRowClick}
          onToggleExclude={handleToggleExclude}
          onOpenExclusionDialog={handleOpenExclusionDialog}
        />
      ) : (
        <NavInvoiceTable
          navToSubmittedMap={navToSubmittedMap}
          navToSuggestedSubmittedMap={navToSuggestedSubmittedMap}
          pageInvoiceIdToTransactionsMap={pageInvoiceIdToTransactionsMap}
          pageDeductibilityMap={pageDeductibilityMap}
          onRowClick={handleRowClick}
          onToggleExclude={handleToggleExclude}
          onOpenExclusionDialog={handleOpenExclusionDialog}
        />
      )}

      <ExclusionReasonDialog
        open={isExclusionDialogOpen}
        onOpenChange={setIsExclusionDialogOpen}
        invoice={selectedExclusionInvoice}
        onSuccess={invalidateInvoiceData}
      />
    </TabsContent>
  );
}
