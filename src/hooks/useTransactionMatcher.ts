import { useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format, subDays, addDays } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { reportError } from '@/lib/errorReporter';
import {
  applyMatch,
  unmatchTransaction,
  verifyMatch,
  markNoInvoice,
  markInvoiceMissing,
  revertStatus,
} from '@/lib/matching/matchingService';
import { invalidateMatchingQueries } from '@/lib/matching/matchingKeys';
import {
  toHuf,
  filterAndSortTransactionCandidates,
} from '@/lib/matching/candidateFinder';
import { AvailableTransaction } from '@/lib/matching/types';

export type { AvailableTransaction };

export interface UseTransactionMatcherParams {
  /** The invoice ID to match transactions to */
  invoiceId: string;
  /** Invoice gross amount (for proximity sorting) */
  invoiceAmount: number;
  /** Invoice currency */
  invoiceCurrency: string;
  /** Invoice issue date (for ±180 day window) */
  invoiceDate: string;
  /** Company ID */
  companyId: string;
  /** Called after successful match/unmatch/verify operations */
  onUpdate?: () => void;
}

export function useTransactionMatcher({
  invoiceId,
  invoiceAmount,
  invoiceCurrency,
  invoiceDate,
  companyId,
  onUpdate,
}: UseTransactionMatcherParams) {
  const queryClient = useQueryClient();
  const [availableTransactions, setAvailableTransactions] = useState<AvailableTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);

  const invalidateAll = useCallback(async () => {
    await invalidateMatchingQueries(queryClient, companyId);
  }, [queryClient, companyId]);

  // ── Fetch available (unmatched) transactions ──
  const fetchAvailableTransactions = useCallback(async () => {
    if (!companyId || !invoiceDate) return;

    setLoading(true);
    try {
      const refDate = new Date(invoiceDate);
      const dateFrom = format(subDays(refDate, 180), 'yyyy-MM-dd');
      const dateTo = format(addDays(refDate, 180), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('transactions')
        .select('id, transaction_date, amount, description, currency, type, matched_invoice_id, confidence_score, match_type, is_verified')
        .eq('company_id', companyId)
        .gte('transaction_date', dateFrom)
        .lte('transaction_date', dateTo)
        .order('transaction_date', { ascending: false })
        .limit(500);

      if (error) throw error;

      // Only show unmatched transactions (no matched_invoice_id)
      setAvailableTransactions((data || []).filter(tx => !tx.matched_invoice_id));
    } catch (error) {
      reportError({
        type: 'db_query',
        component: 'useTransactionMatcher',
        action: 'error',
        message: 'Error fetching transactions:',
        error,
      });
      toast({ title: 'Hiba a tranzakciók betöltésekor', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [companyId, invoiceDate]);

  // ── Filtered + sorted transactions using matching core candidate finder ──
  const filteredTransactions = useMemo(() => {
    return filterAndSortTransactionCandidates({
      availableTransactions,
      search,
      invoiceAmount,
      invoiceCurrency,
    });
  }, [availableTransactions, search, invoiceAmount, invoiceCurrency]);

  const openSearch = useCallback(() => {
    setShowSearch(true);
    setSearch('');
    setSelectedTransactionId(null);
    fetchAvailableTransactions();
  }, [fetchAvailableTransactions]);

  const closeSearch = useCallback(() => {
    setShowSearch(false);
    setSearch('');
    setSelectedTransactionId(null);
  }, []);

  // ── Match: assign transaction to this invoice ──
  const handleMatch = useCallback(
    async (transactionId?: string) => {
      const txId = transactionId || selectedTransactionId;
      if (!txId) return;

      setSaving(true);
      try {
        await applyMatch({
          transactionId: txId,
          invoiceId,
          matchType: 'manual',
          confidenceScore: 1.0,
        });

        toast({ title: 'Tranzakció sikeresen párosítva!' });
        await invalidateAll();
        closeSearch();
        onUpdate?.();
      } catch (error) {
        reportError({
          type: 'db_query',
          component: 'useTransactionMatcher',
          action: 'error',
          message: 'Error matching transaction:',
          error,
        });
        toast({ title: 'Hiba a párosítás mentésekor', variant: 'destructive' });
      } finally {
        setSaving(false);
      }
    },
    [invoiceId, selectedTransactionId, onUpdate, closeSearch, invalidateAll]
  );

  // ── Unmatch: remove transaction ↔ invoice link ──
  const handleUnmatch = useCallback(
    async (transactionId: string) => {
      setSaving(true);
      try {
        await unmatchTransaction(transactionId);
        toast({ title: 'Párosítás megszüntetve!' });
        await invalidateAll();
        onUpdate?.();
      } catch (error) {
        reportError({
          type: 'db_query',
          component: 'useTransactionMatcher',
          action: 'error',
          message: 'Error unmatching transaction:',
          error,
        });
        toast({ title: 'Hiba a párosítás megszüntetésekor', variant: 'destructive' });
      } finally {
        setSaving(false);
      }
    },
    [onUpdate, invalidateAll]
  );

  // ── Verify: confirm a suggested match ──
  const handleVerify = useCallback(
    async (transactionId: string) => {
      setSaving(true);
      try {
        await verifyMatch(transactionId);
        toast({ title: 'Párosítás jóváhagyva!' });
        await invalidateAll();
        onUpdate?.();
      } catch (error) {
        reportError({
          type: 'db_query',
          component: 'useTransactionMatcher',
          action: 'error',
          message: 'Error verifying match:',
          error,
        });
        toast({ title: 'Hiba a jóváhagyás során', variant: 'destructive' });
      } finally {
        setSaving(false);
      }
    },
    [onUpdate, invalidateAll]
  );

  // ── Mark no invoice ──
  const handleMarkNoInvoice = useCallback(
    async (transactionId: string) => {
      setSaving(true);
      try {
        await markNoInvoice(transactionId);
        toast({ title: 'Tranzakció megjelölve: Nincs hozzá számla' });
        await invalidateAll();
        onUpdate?.();
      } catch (error) {
        reportError({
          type: 'db_query',
          component: 'useTransactionMatcher',
          action: 'error',
          message: 'Error marking no invoice:',
          error,
        });
        toast({ title: 'Hiba a jelölés mentésekor', variant: 'destructive' });
      } finally {
        setSaving(false);
      }
    },
    [onUpdate, invalidateAll]
  );

  // ── Mark invoice missing ──
  const handleMarkInvoiceMissing = useCallback(
    async (transactionId: string) => {
      setSaving(true);
      try {
        await markInvoiceMissing(transactionId);
        toast({ title: 'Tranzakció megjelölve: Számla nincs feltöltve' });
        await invalidateAll();
        onUpdate?.();
      } catch (error) {
        reportError({
          type: 'db_query',
          component: 'useTransactionMatcher',
          action: 'error',
          message: 'Error marking invoice missing:',
          error,
        });
        toast({ title: 'Hiba a jelölés mentésekor', variant: 'destructive' });
      } finally {
        setSaving(false);
      }
    },
    [onUpdate, invalidateAll]
  );

  // ── Revert special status back to unmatched ──
  const handleRevertStatus = useCallback(
    async (transactionId: string) => {
      setSaving(true);
      try {
        await revertStatus(transactionId);
        toast({ title: 'Státusz visszavonva' });
        await invalidateAll();
        onUpdate?.();
      } catch (error) {
        reportError({
          type: 'db_query',
          component: 'useTransactionMatcher',
          action: 'error',
          message: 'Error reverting status:',
          error,
        });
        toast({ title: 'Hiba a visszavonás során', variant: 'destructive' });
      } finally {
        setSaving(false);
      }
    },
    [onUpdate, invalidateAll]
  );

  return {
    availableTransactions,
    filteredTransactions,
    loading,
    saving,
    search,
    setSearch,
    selectedTransactionId,
    setSelectedTransactionId,
    showSearch,
    openSearch,
    closeSearch,
    fetchAvailableTransactions,
    handleMatch,
    handleUnmatch,
    handleVerify,
    handleMarkNoInvoice,
    handleMarkInvoiceMissing,
    handleRevertStatus,
    toHuf,
  };
}