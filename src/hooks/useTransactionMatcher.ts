import { useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format, subDays, addDays } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';

// ── Types ──

export interface AvailableTransaction {
  id: string;
  transaction_date: string;
  amount: number;
  description: string | null;
  currency: string | null;
  type: string | null;
  matched_invoice_id: string | null;
  confidence_score: number | null;
  match_type: string | null;
  is_verified: boolean | null;
}

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

// ── Hook ──

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

  const invalidateAllMatches = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['invoiceKpis', companyId] });
    queryClient.invalidateQueries({ queryKey: ['transactions', companyId] });
    queryClient.invalidateQueries({ queryKey: ['navInvoices', companyId] });
    queryClient.invalidateQueries({ queryKey: ['submittedInvoices', companyId] });
    queryClient.invalidateQueries({ queryKey: ['linkedInvoices', companyId] });
    queryClient.invalidateQueries({ queryKey: ['invoiceTransactions', companyId] });
    queryClient.invalidateQueries({ queryKey: ['transactionInvoiceMatches', companyId] });
    queryClient.invalidateQueries({ queryKey: ['filteredNavInvoices', companyId] });
    queryClient.invalidateQueries({ queryKey: ['filteredSubmittedInvoices', companyId] });
    queryClient.invalidateQueries({ queryKey: ['salaries', companyId] });
    queryClient.invalidateQueries({ queryKey: ['due-transfer-invoices', companyId] });
    queryClient.invalidateQueries({ queryKey: ['payment-transfers-history', companyId] });
  }, [queryClient, companyId]);

  // ── Approximate FX rates for frontend filtering ──
  const approxRates: Record<string, number> = { EUR: 395, USD: 370, GBP: 470, CHF: 420 };
  const toHuf = useCallback((amount: number, currency?: string) => {
    const ccy = (currency || 'HUF').toUpperCase();
    if (ccy !== 'HUF' && approxRates[ccy]) return amount * approxRates[ccy];
    return amount;
  }, []);

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
      setAvailableTransactions(
        (data || []).filter(tx => !tx.matched_invoice_id)
      );
    } catch (error) {
      reportError({ type: 'db_query', component: 'useTransactionMatcher', action: 'error', message: 'Error fetching transactions:', error: error });
      toast({ title: 'Hiba a tranzakciók betöltésekor', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [companyId, invoiceDate]);

  // ── Filtered + sorted transactions ──
  const filteredTransactions = useMemo(() => {
    const invAmt = Math.abs(invoiceAmount || 0);
    let list = [...availableTransactions];

    if (!search) {
      // No search: filter by amount tolerance
      if (invAmt > 0) {
        list = list.filter(tx => {
          const txHuf = Math.abs(toHuf(tx.amount || 0, tx.currency));
          const invHuf = Math.abs(toHuf(invAmt, invoiceCurrency));
          const diff = Math.abs(txHuf - invHuf);
          const isCrossCurrency = (tx.currency || 'HUF').toUpperCase() !== (invoiceCurrency || 'HUF').toUpperCase();
          const tolerance = isCrossCurrency ? 0.50 : 0.30;
          return diff / invHuf <= tolerance;
        });
      }
    } else {
      // Searching: match text, no amount filter
      const searchLower = search.toLowerCase();
      const searchNormalized = search.replace(',', '.');

      list = availableTransactions.filter(tx => {
        if (tx.description?.toLowerCase().includes(searchLower)) return true;
        if (tx.type?.toLowerCase().includes(searchLower)) return true;

        // Amount match
        if (tx.amount != null) {
          const amt = Math.abs(tx.amount);
          const amtStr = amt.toString();
          const amtFixed2 = amt.toFixed(2);
          const amtInt = Math.round(amt).toString();
          if (amtStr.includes(searchNormalized) || amtFixed2.includes(searchNormalized) || amtInt.includes(searchNormalized)) return true;
          if (amtStr.includes(search) || amtFixed2.includes(search)) return true;
        }

        // Date match
        if (tx.transaction_date?.includes(search)) return true;

        return false;
      });
    }

    // Sort by proximity to invoice amount
    const invHuf = Math.abs(toHuf(invAmt, invoiceCurrency));
    list.sort((a, b) => {
      const aHuf = Math.abs(toHuf(a.amount || 0, a.currency));
      const bHuf = Math.abs(toHuf(b.amount || 0, b.currency));
      const diffA = Math.abs(aHuf - invHuf);
      const diffB = Math.abs(bHuf - invHuf);
      return diffA - diffB;
    });

    return list;
  }, [availableTransactions, search, invoiceAmount, invoiceCurrency, toHuf]);

  // ── Open search panel ──
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
  const handleMatch = useCallback(async (transactionId?: string) => {
    const txId = transactionId || selectedTransactionId;
    if (!txId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          matched_invoice_id: invoiceId,
          is_verified: true,
          match_type: 'manual',
          confidence_score: 1.0,
        })
        .eq('id', txId);

      if (error) throw error;

      toast({ title: 'Tranzakció sikeresen párosítva!' });
      invalidateAllMatches();
      closeSearch();
      onUpdate?.();
    } catch (error) {
      reportError({ type: 'db_query', component: 'useTransactionMatcher', action: 'error', message: 'Error matching transaction:', error: error });
      toast({ title: 'Hiba a párosítás mentésekor', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [invoiceId, selectedTransactionId, onUpdate, closeSearch]);

  // ── Unmatch: remove transaction ↔ invoice link ──
  const handleUnmatch = useCallback(async (transactionId: string) => {
    setSaving(true);
    try {
      // 1. Clear match on transactions table
      const { error } = await supabase
        .from('transactions')
        .update({
          matched_invoice_id: null,
          is_verified: false,
          match_type: null,
        })
        .eq('id', transactionId);

      if (error) throw error;

      // 2. Clear transaction_id on related invoices and salary records
      await supabase
        .from('invoices')
        .update({ transaction_id: null, fizetve: false })
        .eq('transaction_id', transactionId);

      await supabase
        .from('nav_invoices')
        .update({ transaction_id: null, paid: false })
        .eq('transaction_id', transactionId);

      await supabase
        .from('salary')
        .update({ transaction_id: null, statusz: 'Nyitott' })
        .eq('transaction_id', transactionId);

      // 3. Delete from join table (transaction_invoice_matches)
      await supabase
        .from('transaction_invoice_matches')
        .delete()
        .eq('transaction_id', transactionId);

      toast({ title: 'Párosítás megszüntetve!' });
      invalidateAllMatches();
      onUpdate?.();
    } catch (error) {
      reportError({ type: 'db_query', component: 'useTransactionMatcher', action: 'error', message: 'Error unmatching transaction:', error: error });
      toast({ title: 'Hiba a párosítás megszüntetésekor', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [onUpdate]);

  // ── Verify: confirm a suggested match ──
  const handleVerify = useCallback(async (transactionId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ is_verified: true })
        .eq('id', transactionId);

      if (error) throw error;

      toast({ title: 'Párosítás jóváhagyva!' });
      invalidateAllMatches();
      onUpdate?.();
    } catch (error) {
      reportError({ type: 'db_query', component: 'useTransactionMatcher', action: 'error', message: 'Error verifying match:', error: error });
      toast({ title: 'Hiba a jóváhagyás során', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [onUpdate]);

  // ── Mark no invoice (transaction has no related invoice at all) ──
  const handleMarkNoInvoice = useCallback(async (transactionId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          match_type: 'no_invoice',
          matched_invoice_id: null,
          is_verified: false,
        })
        .eq('id', transactionId);

      if (error) throw error;

      toast({ title: 'Tranzakció megjelölve: Nincs hozzá számla' });
      invalidateAllMatches();
      onUpdate?.();
    } catch (error) {
      reportError({ type: 'db_query', component: 'useTransactionMatcher', action: 'error', message: 'Error marking no invoice:', error: error });
      toast({ title: 'Hiba a jelölés mentésekor', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [onUpdate]);

  // ── Mark invoice missing (invoice exists but not uploaded yet) ──
  const handleMarkInvoiceMissing = useCallback(async (transactionId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          match_type: 'invoice_missing',
          matched_invoice_id: null,
          is_verified: false,
        })
        .eq('id', transactionId);

      if (error) throw error;

      toast({ title: 'Tranzakció megjelölve: Számla nincs feltöltve' });
      invalidateAllMatches();
      onUpdate?.();
    } catch (error) {
      reportError({ type: 'db_query', component: 'useTransactionMatcher', action: 'error', message: 'Error marking invoice missing:', error: error });
      toast({ title: 'Hiba a jelölés mentésekor', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [onUpdate]);

  // ── Revert special status back to unmatched ──
  const handleRevertStatus = useCallback(async (transactionId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ match_type: null })
        .eq('id', transactionId);

      if (error) throw error;

      toast({ title: 'Státusz visszavonva' });
      invalidateAllMatches();
      onUpdate?.();
    } catch (error) {
      reportError({ type: 'db_query', component: 'useTransactionMatcher', action: 'error', message: 'Error reverting status:', error: error });
      toast({ title: 'Hiba a visszavonás során', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [onUpdate]);

  return {
    // State
    availableTransactions,
    filteredTransactions,
    loading,
    saving,
    search,
    setSearch,
    selectedTransactionId,
    setSelectedTransactionId,
    showSearch,

    // Actions
    openSearch,
    closeSearch,
    fetchAvailableTransactions,
    handleMatch,
    handleUnmatch,
    handleVerify,
    handleMarkNoInvoice,
    handleMarkInvoiceMissing,
    handleRevertStatus,

    // Helpers
    toHuf,
  };
}

import { reportError } from '@/lib/errorReporter';