import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useDateRange } from '@/contexts/DateRangeContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { exportToFile } from '@/lib/exportUtils';
import { computeMatchStatus } from '@/hooks/useComputedStatus';

export interface Transaction {
  id: string;
  transaction_date: string;
  description: string | null;
  amount: number;
  currency: string | null;
  type: string | null;
  matched_invoice_id: string | null;
  confidence_score: number | null;
  is_verified: boolean | null;
  match_type: string | null;
  reason: string | null;
  created_at: string | null;
  company_id: string | null;
}

export interface TransactionFilters {
  search: string;
  amountMin: string;
  amountMax: string;
  currency: string;
  type: string;
  matchStatus: string;
}

const DEFAULT_FILTERS: TransactionFilters = {
  search: '',
  amountMin: '',
  amountMax: '',
  currency: 'all',
  type: 'all',
  matchStatus: 'all',
};

export function useTransactionData() {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const { dateFrom, dateTo } = useDateRange();
  const queryClient = useQueryClient();

  const [syncing, setSyncing] = useState(false);
  const [sortField, setSortField] = useState<string>('transaction_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<TransactionFilters>(DEFAULT_FILTERS);

  // Date strings from context
  const dateFromStr = dateFrom ? format(dateFrom, 'yyyy-MM-dd') : '';
  const dateToStr = dateTo ? format(dateTo, 'yyyy-MM-dd') : '';

  const serverFilters = useMemo(() => ({
    currency: filters.currency,
    type: filters.type,
    search: filters.search,
  }), [filters.currency, filters.type, filters.search]);

  // Filter options (currencies + types)
  const { data: filterOptions } = useQuery({
    queryKey: queryKeys.transactionFilterOptions(selectedCompany?.id || ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('currency, type')
        .eq('company_id', selectedCompany!.id)
        .limit(500);
      if (error) throw error;
      const currencies = [...new Set((data || []).map(t => t.currency).filter(Boolean))] as string[];
      const types = [...new Set((data || []).map(t => t.type).filter(Boolean))] as string[];
      return { currencies, types };
    },
    enabled: !!user && !!selectedCompany?.id,
    staleTime: 10 * 60 * 1000,
  });

  const uniqueCurrencies = filterOptions?.currencies || [];
  const uniqueTypes = filterOptions?.types || [];

  // Main query
  const { data: queryResult, isLoading: loading } = useQuery({
    queryKey: [
      ...queryKeys.transactions(
        selectedCompany?.id || '',
        dateFromStr, dateToStr,
        currentPage, pageSize,
        serverFilters
      ),
      sortField, sortDirection,
    ],
    queryFn: async () => {
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('transactions')
        .select('*', { count: 'exact' })
        .eq('company_id', selectedCompany!.id)
        .order(sortField, { ascending: sortDirection === 'asc' });

      if (dateFromStr) query = query.gte('transaction_date', dateFromStr);
      if (dateToStr) query = query.lte('transaction_date', dateToStr);
      if (filters.currency !== 'all') query = query.eq('currency', filters.currency);
      if (filters.type !== 'all') query = query.eq('type', filters.type);
      if (filters.search) {
        query = query.or(`description.ilike.%${filters.search}%,type.ilike.%${filters.search}%`);
      }
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: (data || []) as Transaction[], totalCount: count ?? 0 };
    },
    enabled: !!user && !!selectedCompany?.id && !!dateFromStr && !!dateToStr,
  });

  const transactions = queryResult?.rows ?? [];
  const totalCount = queryResult?.totalCount ?? 0;

  // Client-side post-filters
  const filteredTransactions = useMemo(() => {
    let result = [...transactions];
    if (filters.amountMin) {
      const min = parseFloat(filters.amountMin);
      if (!isNaN(min)) result = result.filter(t => Math.abs(t.amount) >= min);
    }
    if (filters.amountMax) {
      const max = parseFloat(filters.amountMax);
      if (!isNaN(max)) result = result.filter(t => Math.abs(t.amount) <= max);
    }
    if (filters.matchStatus !== 'all') {
      result = result.filter(t => computeMatchStatus(t) === filters.matchStatus);
    }
    return result;
  }, [transactions, filters.amountMin, filters.amountMax, filters.matchStatus]);

  const totalPages = Math.ceil(totalCount / pageSize);

  // Sort handler
  const handleSort = useCallback((field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  }, [sortField]);

  // Clear filters
  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setCurrentPage(1);
  }, []);

  const hasActiveFilters = filters.search ||
    filters.amountMin || filters.amountMax || filters.currency !== 'all' ||
    filters.type !== 'all' || filters.matchStatus !== 'all';

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters.search, dateFrom, dateTo, filters.currency, filters.type, filters.matchStatus]);

  // Sync
  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['transactions', selectedCompany?.id || ''] });
      await queryClient.invalidateQueries({ queryKey: queryKeys.transactionFilterOptions(selectedCompany?.id || '') });
      toast.success('Tranzakciók frissítve!');
    } catch (error: any) {
      console.error('Sync error:', error);
      toast.error('Frissítés sikertelen', {
        description: error.message || 'Hiba történt a frissítés során'
      });
    } finally {
      setSyncing(false);
    }
  }, [queryClient, selectedCompany?.id]);

  // Export
  const handleExport = useCallback(async (exportFormat: 'csv' | 'xlsx') => {
    const headers = ['Dátum', 'Leírás', 'Összeg', 'Pénznem', 'Típus', 'Státusz', 'Pontszám', 'Indoklás'];
    const exportData = filteredTransactions.map(transaction => {
      const matchStatus = computeMatchStatus(transaction);
      const statusText = matchStatus === 'matched' ? 'Párosított'
        : matchStatus === 'suggested' ? 'Javasolt' : 'Párosítatlan';
      return [
        transaction.transaction_date || '',
        transaction.description || '',
        transaction.amount?.toString() || '0',
        transaction.currency || 'HUF',
        transaction.type || '',
        statusText,
        transaction.confidence_score ? Math.round(transaction.confidence_score * 100).toString() + '%' : '',
        transaction.reason || ''
      ];
    });
    await exportToFile(headers, exportData, exportFormat, 'tranzakciok');
  }, [filteredTransactions]);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  }, []);

  return {
    // Auth & Company
    user,
    selectedCompany,
    // Data
    filteredTransactions,
    totalCount,
    totalPages,
    loading,
    // Filters
    filters,
    setFilters,
    clearFilters,
    hasActiveFilters,
    uniqueCurrencies,
    uniqueTypes,
    // Sorting
    sortField,
    handleSort,
    // Pagination
    currentPage,
    setCurrentPage,
    pageSize,
    handlePageSizeChange,
    // Actions
    syncing,
    handleSync,
    handleExport,
    // Query client for invalidation
    queryClient,
  };
}
