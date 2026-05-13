import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useDateRange } from '@/contexts/DateRangeContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';

export interface CourierReport {
  id: string;
  company_id: string;
  upload_id: string;
  report_type: 'gls' | 'mpl' | 'mixpack';
  report_number: string | null;
  package_number: string | null;
  reference_number: string | null;
  delivery_date: string | null;
  cod_amount: number | null;
  recipient_name: string | null;
  recipient_address: string | null;
  matched_transaction_id: string | null;
  matched_nav_invoice_id: string | null;
  match_status: 'unmatched' | 'partial_trx' | 'partial_nav' | 'full' | 'total';
  match_confidence: number | null;
  match_reason: string | null;
  row_type: string | null;
  raw_data: Record<string, unknown> | null;
  created_at: string;
}

export interface CourierReportFilters {
  search: string;
  matchStatus: string;
  amountMin: string;
  amountMax: string;
}

const DEFAULT_FILTERS: CourierReportFilters = {
  search: '',
  matchStatus: 'all',
  amountMin: '',
  amountMax: '',
};

export function useCourierReportData(
  reportType: 'gls' | 'mpl' | 'mixpack',
  localDateFrom?: Date | null,
  localDateTo?: Date | null,
) {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const { dateFrom: globalDateFrom, dateTo: globalDateTo } = useDateRange();
  const queryClient = useQueryClient();

  // Local overrides take priority over global date range
  const dateFrom = localDateFrom !== undefined ? localDateFrom : globalDateFrom;
  const dateTo = localDateTo !== undefined ? localDateTo : globalDateTo;

  const [sortField, setSortField] = useState<string>('delivery_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<CourierReportFilters>(DEFAULT_FILTERS);

  const dateFromStr = dateFrom ? format(dateFrom, 'yyyy-MM-dd') : '';
  const dateToStr = dateTo ? format(dateTo, 'yyyy-MM-dd') : '';

  // Main query
  const { data: queryResult, isLoading: loading, refetch } = useQuery({
    queryKey: [
      'courier-reports', selectedCompany?.id, reportType,
      dateFromStr, dateToStr,
      currentPage, pageSize,
      sortField, sortDirection,
      filters.search, filters.matchStatus,
    ],
    queryFn: async () => {
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('courier_reports')
        .select('*', { count: 'exact' })
        .eq('company_id', selectedCompany!.id)
        .eq('report_type', reportType)
        .order(sortField, { ascending: sortDirection === 'asc' })
        .order('created_at', { ascending: true });

      if (dateFromStr) query = query.gte('delivery_date', dateFromStr);
      if (dateToStr) query = query.lte('delivery_date', dateToStr);
      if (filters.matchStatus !== 'all') {
        query = query.eq('match_status', filters.matchStatus);
      }
      if (filters.search) {
        query = query.or(
          `reference_number.ilike.%${filters.search}%,package_number.ilike.%${filters.search}%,recipient_name.ilike.%${filters.search}%,recipient_address.ilike.%${filters.search}%`
        );
      }
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: (data || []) as CourierReport[], totalCount: count ?? 0 };
    },
    enabled: !!user && !!selectedCompany?.id,
    placeholderData: keepPreviousData,
    staleTime: 30_000,        // Data considered fresh for 30s
    refetchInterval: 15_000,  // Auto-refetch every 15s for live updates
  });

  const reports = queryResult?.rows ?? [];
  const totalCount = queryResult?.totalCount ?? 0;

  // Client-side amount filtering
  const filteredReports = useMemo(() => {
    let result = [...reports];
    if (filters.amountMin) {
      const min = parseFloat(filters.amountMin);
      if (!isNaN(min)) result = result.filter(r => (r.cod_amount ?? 0) >= min);
    }
    if (filters.amountMax) {
      const max = parseFloat(filters.amountMax);
      if (!isNaN(max)) result = result.filter(r => (r.cod_amount ?? 0) <= max);
    }
    // Always pin total/summary rows to the bottom
    const regularRows = result.filter(r => r.row_type !== 'total' && r.match_status !== 'total');
    const totalRows = result.filter(r => r.row_type === 'total' || r.match_status === 'total');
    return [...regularRows, ...totalRows];
  }, [reports, filters.amountMin, filters.amountMax]);

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

  const hasActiveFilters = filters.search || filters.matchStatus !== 'all' ||
    filters.amountMin || filters.amountMax;

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters.search, dateFrom, dateTo, filters.matchStatus]);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  }, []);

  // Sync / refresh
  const handleSync = useCallback(async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: ['courier-reports', selectedCompany?.id] });
      toast({ title: 'Riportok frissítve!' });
    } catch (error: any) {
      toast({ title: 'Frissítés sikertelen', variant: 'destructive' });
    }
  }, [queryClient, selectedCompany?.id]);

  // Manual re-match trigger — calls server-side matching function
  const handleRematch = useCallback(async (reportId: string) => {
    try {
      const { data, error } = await supabase.rpc('rematch_courier_report', { p_report_id: reportId });
      if (error) throw error;

      const result = data as any;
      const statusLabel = result?.status === 'full' ? 'Teljesen párosítva' :
                          result?.status === 'partial_nav' ? 'NAV számla párosítva' :
                          result?.status === 'partial_trx' ? 'Tranzakció párosítva' :
                          'Nem találtunk egyezést';
      toast({
        title: result?.status === 'unmatched' ? '⚠️ Nincs egyezés' : '✅ Párosítás kész',
        description: `${statusLabel}${result?.reason ? ` — ${result.reason}` : ''}`,
      });
      refetch();
    } catch (error: any) {
      toast({ title: 'Hiba', description: error.message, variant: 'destructive' });
    }
  }, [refetch]);

  return {
    selectedCompany,
    filteredReports,
    totalCount,
    totalPages,
    loading,
    filters,
    setFilters,
    clearFilters,
    hasActiveFilters,
    handleSort,
    sortField,
    sortDirection,
    currentPage,
    setCurrentPage,
    pageSize,
    handlePageSizeChange,
    handleSync,
    handleRematch,
    queryClient,
  };
}
