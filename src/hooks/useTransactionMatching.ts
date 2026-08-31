import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import {
  fetchMatchedEntityDetails,
  fetchMatchedCourierReports,
  fetchExtraMatches,
  fetchAvailableInvoices,
  searchServerInvoices,
  applyMatch,
  unmatchTransaction,
  verifyMatch,
  markNoInvoice,
  markInvoiceMissing,
  revertStatus,
  addExtraMatch,
  removeExtraMatch,
  bookTransactionDirect,
  unbookTransactionDirect,
} from '@/lib/matching/matchingService';
import { invalidateMatchingQueries, MATCHING_QUERY_KEYS } from '@/lib/matching/matchingKeys';
import { filterAndSortInvoiceCandidates } from '@/lib/matching/candidateFinder';
import {
  TransactionItem,
  AvailableInvoice,
  MatchOverridePayload,
  BookTransactionGlPayload,
} from '@/lib/matching/types';

export interface UseTransactionMatchingOptions {
  transaction: TransactionItem | null;
  companyId: string;
  isOpen?: boolean;
  onUpdate?: () => void;
  onClose?: () => void;
}

export function useTransactionMatching({
  transaction,
  companyId,
  isOpen = true,
  onUpdate,
  onClose,
}: UseTransactionMatchingOptions) {
  const queryClient = useQueryClient();

  // ── UI Search & Selection State ──
  const [search, setSearch] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [showManualMatch, setShowManualMatch] = useState(false);
  const [showAddExtraMatch, setShowAddExtraMatch] = useState(false);
  const [serverSearchResults, setServerSearchResults] = useState<AvailableInvoice[]>([]);
  const [isSearchingServer, setIsSearchingServer] = useState(false);

  const transactionId = transaction?.id;
  const matchedInvoiceId = transaction?.matched_invoice_id;
  const transactionDate = transaction?.transaction_date;

  // ── 1. Matched Entity Query (Invoice / NAV / Salary) ──
  const {
    data: matchedEntity = { invoice: null, navInvoice: null, salary: null },
    isLoading: loadingMatchedEntity,
  } = useQuery({
    queryKey: ['matched-entity-details', matchedInvoiceId],
    queryFn: () => fetchMatchedEntityDetails(matchedInvoiceId!),
    enabled: isOpen && !!matchedInvoiceId,
  });

  // ── 2. Matched Courier Reports Query ──
  const {
    data: matchedCourierReports = [],
    isLoading: loadingCourierReports,
  } = useQuery({
    queryKey: ['matched-courier-reports', transactionId],
    queryFn: () => fetchMatchedCourierReports(transactionId!),
    enabled: isOpen && !!transactionId,
  });

  // ── 3. Extra Matches (Multi-match / Split) Query ──
  const {
    data: extraMatches = [],
    isLoading: loadingExtraMatches,
  } = useQuery({
    queryKey: ['transaction-extra-matches', transactionId],
    queryFn: () => fetchExtraMatches(transactionId!),
    enabled: isOpen && !!transactionId,
  });

  // ── 4. Available Invoices Candidate Query ──
  const {
    data: availableInvoices = [],
    isLoading: loadingAvailableInvoices,
  } = useQuery({
    queryKey: ['available-invoices-candidate', companyId, transactionDate],
    queryFn: () => fetchAvailableInvoices(companyId, transactionDate!),
    enabled: isOpen && !!companyId && !!transactionDate && (showManualMatch || showAddExtraMatch || !matchedInvoiceId),
  });

  // ── 5. Debounced Server Search ──
  useEffect(() => {
    if (!companyId) return;
    const query = search.trim();
    if (query.length < 2) {
      setServerSearchResults([]);
      setIsSearchingServer(false);
      return;
    }

    setIsSearchingServer(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchServerInvoices(companyId, query);
        setServerSearchResults(results);
      } catch (err) {
        console.error('Server search error:', err);
      } finally {
        setIsSearchingServer(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [search, companyId]);

  // ── 6. Candidate List with Proximity & Tolerance ──
  const candidateInvoices = useMemo(() => {
    return filterAndSortInvoiceCandidates({
      availableInvoices,
      serverSearchResults,
      search,
      transactionAmount: transaction?.amount || 0,
      transactionCurrency: transaction?.currency || 'HUF',
    });
  }, [availableInvoices, serverSearchResults, search, transaction?.amount, transaction?.currency]);

  // Reset local ephemeral states on open/close or transaction change
  useEffect(() => {
    if (isOpen && transaction) {
      setShowManualMatch(false);
      setShowAddExtraMatch(false);
      setSearch('');
      setSelectedInvoiceId(null);
    }
  }, [isOpen, transactionId]);

  // Helper to build override log payload
  const createOverridePayload = useCallback(
    (correctedInvId: string | null, matchType: string): MatchOverridePayload | undefined => {
      if (!transaction || !companyId) return undefined;

      const originalPartner =
        matchedEntity.invoice?.elado_nev ||
        matchedEntity.navInvoice?.supplier_name ||
        matchedEntity.navInvoice?.customer_name ||
        matchedEntity.salary?.név ||
        matchedEntity.salary?.munkavallalo_neve ||
        null;

      const correctedInv = correctedInvId
        ? candidateInvoices.find(inv => inv.id === correctedInvId)
        : null;

      return {
        companyId,
        transactionId: transaction.id,
        originalInvoiceId: transaction.matched_invoice_id || null,
        originalMatchType: transaction.match_type || null,
        correctedInvoiceId: correctedInvId,
        correctedMatchType: matchType,
        transactionDescription: transaction.description || '',
        transactionAmount: transaction.amount,
        originalPartnerName: originalPartner,
        correctedPartnerName: correctedInv?.elado_nev || null,
      };
    },
    [transaction, companyId, matchedEntity, candidateInvoices]
  );

  // ── Mutations ──

  // Match Mutation
  const matchMutation = useMutation({
    mutationFn: async (invoiceIdToMatch?: string) => {
      const invId = invoiceIdToMatch || selectedInvoiceId;
      if (!transaction || !invId) throw new Error('Hiányzó tranzakció vagy számla azonosító');
      const overridePayload = createOverridePayload(invId, 'manual');
      await applyMatch({
        transactionId: transaction.id,
        invoiceId: invId,
        matchType: 'manual',
        confidenceScore: 1.0,
        overridePayload,
      });
    },
    onSuccess: async () => {
      toast({ title: 'Tranzakció sikeresen párosítva!' });
      await invalidateMatchingQueries(queryClient, companyId);
      onUpdate?.();
      onClose?.();
    },
    onError: () => {
      toast({ title: 'Hiba a párosítás mentésekor', variant: 'destructive' });
    },
  });

  // Unmatch Mutation
  const unmatchMutation = useMutation({
    mutationFn: async () => {
      if (!transaction) throw new Error('Hiányzó tranzakció');
      await unmatchTransaction(transaction.id);
    },
    onSuccess: async () => {
      toast({ title: 'Párosítás megszüntetve!' });
      await invalidateMatchingQueries(queryClient, companyId);
      onUpdate?.();
      onClose?.();
    },
    onError: () => {
      toast({ title: 'Hiba a párosítás megszüntetésekor', variant: 'destructive' });
    },
  });

  // Verify Mutation
  const verifyMutation = useMutation({
    mutationFn: async () => {
      if (!transaction) throw new Error('Hiányzó tranzakció');
      await verifyMatch(transaction.id);
    },
    onSuccess: async () => {
      toast({ title: 'Tranzakció jóváhagyva!' });
      await invalidateMatchingQueries(queryClient, companyId);
      onUpdate?.();
      onClose?.();
    },
    onError: () => {
      toast({ title: 'Hiba a jóváhagyás során', variant: 'destructive' });
    },
  });

  // Mark No Invoice Mutation
  const markNoInvoiceMutation = useMutation({
    mutationFn: async () => {
      if (!transaction) throw new Error('Hiányzó tranzakció');
      await markNoInvoice(transaction.id);
    },
    onSuccess: async () => {
      toast({ title: 'Tranzakció megjelölve: Nincs hozzá számla' });
      await invalidateMatchingQueries(queryClient, companyId);
      onUpdate?.();
      onClose?.();
    },
    onError: () => {
      toast({ title: 'Hiba a jelölés mentésekor', variant: 'destructive' });
    },
  });

  // Mark Invoice Missing Mutation
  const markInvoiceMissingMutation = useMutation({
    mutationFn: async () => {
      if (!transaction) throw new Error('Hiányzó tranzakció');
      await markInvoiceMissing(transaction.id);
    },
    onSuccess: async () => {
      toast({ title: 'Tranzakció megjelölve: Számla nincs feltöltve' });
      await invalidateMatchingQueries(queryClient, companyId);
      onUpdate?.();
      onClose?.();
    },
    onError: () => {
      toast({ title: 'Hiba a jelölés mentésekor', variant: 'destructive' });
    },
  });

  // Revert Status Mutation
  const revertStatusMutation = useMutation({
    mutationFn: async () => {
      if (!transaction) throw new Error('Hiányzó tranzakció');
      await revertStatus(transaction.id);
    },
    onSuccess: async () => {
      toast({ title: 'Státusz visszavonva' });
      await invalidateMatchingQueries(queryClient, companyId);
      onUpdate?.();
      onClose?.();
    },
    onError: () => {
      toast({ title: 'Hiba a visszavonás során', variant: 'destructive' });
    },
  });

  // Add Extra Match Mutation
  const addExtraMatchMutation = useMutation({
    mutationFn: async (invoiceIdToAdd?: string) => {
      const invId = invoiceIdToAdd || selectedInvoiceId;
      if (!transaction || !invId) throw new Error('Hiányzó számla azonosító');
      const overridePayload = createOverridePayload(invId, 'manual_extra');
      await addExtraMatch({
        transactionId: transaction.id,
        invoiceId: invId,
        overridePayload,
      });
    },
    onSuccess: async () => {
      toast({ title: 'További számla sikeresen hozzáadva!' });
      await invalidateMatchingQueries(queryClient, companyId);
      setShowAddExtraMatch(false);
      setSelectedInvoiceId(null);
      setSearch('');
      queryClient.invalidateQueries({ queryKey: ['transaction-extra-matches', transactionId] });
      onUpdate?.();
    },
    onError: (error: any) => {
      if (error?.code === '23505') {
        toast({ title: 'Ez a számla már hozzá van rendelve ehhez a tranzakcióhoz', variant: 'destructive' });
      } else {
        toast({ title: 'Hiba a számla hozzáadásakor', variant: 'destructive' });
      }
    },
  });

  // Remove Extra Match Mutation
  const removeExtraMatchMutation = useMutation({
    mutationFn: async (matchId: string) => {
      await removeExtraMatch(matchId);
    },
    onSuccess: async () => {
      toast({ title: 'További számla eltávolítva' });
      await invalidateMatchingQueries(queryClient, companyId);
      queryClient.invalidateQueries({ queryKey: ['transaction-extra-matches', transactionId] });
      onUpdate?.();
    },
    onError: () => {
      toast({ title: 'Hiba az eltávolításkor', variant: 'destructive' });
    },
  });

  // Direct GL Booking Mutation
  const bookGlMutation = useMutation({
    mutationFn: async (payload: BookTransactionGlPayload) => {
      await bookTransactionDirect(payload);
    },
    onSuccess: async () => {
      toast({ title: 'Tranzakció közvetlenül kontírozva!' });
      await invalidateMatchingQueries(queryClient, companyId);
      queryClient.invalidateQueries({ queryKey: ['glBalances'] });
      queryClient.invalidateQueries({ queryKey: ['glItems'] });
      onUpdate?.();
      onClose?.();
    },
    onError: () => {
      toast({ title: 'Hiba a kontírozás mentésekor', variant: 'destructive' });
    },
  });

  // Direct GL Unbooking Mutation
  const unbookGlMutation = useMutation({
    mutationFn: async (payload: {
      transactionId: string;
      companyId: string;
      userId: string;
      presetId: string;
      originalGlAccountId?: string | null;
    }) => {
      await unbookTransactionDirect(payload);
    },
    onSuccess: async () => {
      toast({ title: 'Közvetlen kontírozás törölve!' });
      await invalidateMatchingQueries(queryClient, companyId);
      queryClient.invalidateQueries({ queryKey: ['glBalances'] });
      queryClient.invalidateQueries({ queryKey: ['glItems'] });
      onUpdate?.();
      onClose?.();
    },
    onError: () => {
      toast({ title: 'Hiba a törlés során', variant: 'destructive' });
    },
  });

  const isSaving =
    matchMutation.isPending ||
    unmatchMutation.isPending ||
    verifyMutation.isPending ||
    markNoInvoiceMutation.isPending ||
    markInvoiceMissingMutation.isPending ||
    revertStatusMutation.isPending ||
    addExtraMatchMutation.isPending ||
    removeExtraMatchMutation.isPending ||
    bookGlMutation.isPending ||
    unbookGlMutation.isPending;

  return {
    // Entities
    matchedInvoice: matchedEntity.invoice,
    matchedNavInvoice: matchedEntity.navInvoice,
    matchedSalary: matchedEntity.salary,
    matchedCourierReports,
    extraMatches,
    candidateInvoices,

    // Loading states
    loadingMatchedEntity,
    loadingCourierReports,
    loadingExtraMatches,
    loadingAvailableInvoices,
    isSearchingServer,
    isSaving,

    // Search & Select state
    search,
    setSearch,
    selectedInvoiceId,
    setSelectedInvoiceId,
    showManualMatch,
    setShowManualMatch,
    showAddExtraMatch,
    setShowAddExtraMatch,

    // Handlers
    handleMatch: (invId?: string) => matchMutation.mutate(invId),
    handleUnmatch: () => unmatchMutation.mutate(),
    handleVerify: () => verifyMutation.mutate(),
    handleMarkNoInvoice: () => markNoInvoiceMutation.mutate(),
    handleMarkInvoiceMissing: () => markInvoiceMissingMutation.mutate(),
    handleRevertStatus: () => revertStatusMutation.mutate(),
    handleAddExtraMatch: (invId?: string) => addExtraMatchMutation.mutate(invId),
    handleRemoveExtraMatch: (matchId: string) => removeExtraMatchMutation.mutate(matchId),
    handleBookGl: (payload: BookTransactionGlPayload) => bookGlMutation.mutate(payload),
    handleUnbookGl: (payload: {
      transactionId: string;
      companyId: string;
      userId: string;
      presetId: string;
      originalGlAccountId?: string | null;
    }) => unbookGlMutation.mutate(payload),
  };
}
