import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { 
  CashReport, 
  CashReceipt, 
  DenominationSheet, 
  CashClosingProtocol, 
  PettyCashEntry,
  DenominationRow 
} from '@/components/petty-cash/types';

// Query keys for caching and invalidation
export const cashReportQueryKeys = {
  all: ['cash-reports'] as const,
  list: (companyId: string, registerId?: string) => 
    [...cashReportQueryKeys.all, 'list', companyId, registerId || 'all'] as const,
  detail: (reportId: string) => 
    [...cashReportQueryKeys.all, 'detail', reportId] as const,
  active: (companyId: string, registerId: string) => 
    [...cashReportQueryKeys.all, 'active', companyId, registerId] as const,
  receipts: (companyId: string, registerId?: string) => 
    ['cash-receipts', companyId, registerId || 'all'] as const,
};

/**
 * Fetch all cash reports for a company and optional register
 */
export function useCashReports(companyId?: string, registerId?: string) {
  return useQuery({
    queryKey: cashReportQueryKeys.list(companyId || '', registerId),
    queryFn: async (): Promise<CashReport[]> => {
      if (!companyId) return [];
      let query = supabase
        .from('cash_reports' as any)
        .select('*')
        .eq('company_id', companyId)
        .order('period_start', { ascending: false });

      if (registerId && registerId !== 'all') {
        query = query.eq('cash_register_id', registerId);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching cash reports:', error);
        throw error;
      }
      return (data || []) as unknown as CashReport[];
    },
    enabled: !!companyId,
    staleTime: 30_000,
  });
}

/**
 * Fetch the active (open or closing) cash report for a register
 */
export function useActiveCashReport(companyId?: string, registerId?: string) {
  return useQuery({
    queryKey: cashReportQueryKeys.active(companyId || '', registerId || ''),
    queryFn: async (): Promise<CashReport | null> => {
      if (!companyId || !registerId || registerId === 'all') return null;

      const { data, error } = await supabase
        .from('cash_reports' as any)
        .select('*')
        .eq('company_id', companyId)
        .eq('cash_register_id', registerId)
        .in('status', ['open', 'closing', 'reopened'])
        .order('period_start', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching active cash report:', error);
        throw error;
      }
      return (data as unknown as CashReport) || null;
    },
    enabled: !!companyId && !!registerId && registerId !== 'all',
  });
}

/**
 * Fetch full details of a specific cash report including entries, denomination sheet and protocol
 */
export function useCashReportDetails(reportId?: string) {
  return useQuery({
    queryKey: cashReportQueryKeys.detail(reportId || ''),
    queryFn: async () => {
      if (!reportId) return null;

      // 1. Report header
      const { data: report, error: reportErr } = await supabase
        .from('cash_reports' as any)
        .select('*')
        .eq('id', reportId)
        .single();
      if (reportErr) throw reportErr;

      // 2. Entries
      const { data: entries, error: entriesErr } = await supabase
        .from('petty_cash_entries')
        .select('*, partner:partners(id, name, tax_number)')
        .eq('cash_report_id', reportId)
        .order('entry_date', { ascending: true })
        .order('created_at', { ascending: true });
      if (entriesErr) throw entriesErr;

      // 3. Denomination sheet
      const { data: sheet } = await supabase
        .from('denomination_sheets' as any)
        .select('*')
        .eq('cash_report_id', reportId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      // 4. Closing protocol
      const { data: protocol } = await supabase
        .from('cash_closing_protocols' as any)
        .select('*')
        .eq('cash_report_id', reportId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        report: report as unknown as CashReport,
        entries: (entries || []) as unknown as (PettyCashEntry & { partner?: { id: string; name: string; tax_number: string } })[],
        denominationSheet: sheet as unknown as DenominationSheet | null,
        protocol: protocol as unknown as CashClosingProtocol | null,
      };
    },
    enabled: !!reportId,
  });
}

/**
 * Mutation to finalize cash report closing via PostgreSQL RPC
 */
export function useFinalizeCashReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      companyId: string;
      cashReportId: string;
      closingBalanceActual: number;
      denominationRows: DenominationRow[];
      differenceReason?: string;
      differenceAction?: string;
      notes?: string;
      expectedBookBalance?: number;
    }) => {
      const { data, error } = await supabase.rpc('finalize_cash_report_closing' as any, {
        p_company_id: params.companyId,
        p_cash_report_id: params.cashReportId,
        p_closing_balance_actual: params.closingBalanceActual,
        p_denomination_rows: params.denominationRows,
        p_difference_reason: params.differenceReason || null,
        p_difference_action: params.differenceAction || null,
        p_notes: params.notes || null,
        p_expected_book_balance: params.expectedBookBalance ?? null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: cashReportQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: ['pettyCashSummary', vars.companyId] });
      queryClient.invalidateQueries({ queryKey: ['petty-cash-entries', vars.companyId] });
    },
  });
}

/**
 * Mutation to reopen a closed cash report
 */
export function useReopenCashReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      companyId: string;
      cashReportId: string;
      reason: string;
    }) => {
      const { data, error } = await supabase.rpc('reopen_cash_report' as any, {
        p_company_id: params.companyId,
        p_cash_report_id: params.cashReportId,
        p_reason: params.reason,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cashReportQueryKeys.all });
    },
  });
}

/**
 * Mutation to create a sequential cash receipt (BPB / KPB)
 */
export function useCreateCashReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      companyId: string;
      cashRegisterId: string;
      cashEntryId?: string | null;
      receiptType: 'in' | 'out';
      issuedAt: string;
      payerOrPayeeName: string;
      payerOrPayeeAddress?: string;
      amount: number;
      currency: string;
      amountInWords: string;
      legalTitle?: string;
      description?: string;
      partnerId?: string | null;
    }) => {
      const { data, error } = await supabase.rpc('create_cash_receipt_with_seq' as any, {
        p_company_id: params.companyId,
        p_cash_register_id: params.cashRegisterId,
        p_cash_entry_id: params.cashEntryId || null,
        p_receipt_type: params.receiptType,
        p_issued_at: params.issuedAt,
        p_payer_or_payee_name: params.payerOrPayeeName,
        p_payer_or_payee_address: params.payerOrPayeeAddress || '',
        p_amount: params.amount,
        p_currency: params.currency,
        p_amount_in_words: params.amountInWords,
        p_legal_title: params.legalTitle || '',
        p_description: params.description || '',
        p_partner_id: params.partnerId || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: cashReportQueryKeys.receipts(vars.companyId) });
      queryClient.invalidateQueries({ queryKey: ['petty-cash-entries', vars.companyId] });
    },
  });
}

/**
 * Fetch or auto-create an open cash report for a register if one does not exist
 */
export function useEnsureOpenCashReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      companyId: string;
      cashRegisterId: string;
      periodStart: string;
      periodEnd: string;
      openingBalance?: number;
      currency?: string;
    }) => {
      // 1. Check if there's already an open report
      const { data: existing } = await supabase
        .from('cash_reports' as any)
        .select('*')
        .eq('company_id', params.companyId)
        .eq('cash_register_id', params.cashRegisterId)
        .in('status', ['open', 'closing', 'reopened'])
        .maybeSingle();

      if (existing) {
        return existing as unknown as CashReport;
      }

      // 2. Determine opening balance from previous closed report if not explicitly provided
      let openBal = params.openingBalance ?? 0;
      if (openBal === 0) {
        const { data: lastClosed } = await supabase
          .from('cash_reports' as any)
          .select('closing_balance_actual, closing_balance_book')
          .eq('company_id', params.companyId)
          .eq('cash_register_id', params.cashRegisterId)
          .in('status', ['closed', 'posted'])
          .order('period_end', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastClosed) {
          openBal = (lastClosed as any).closing_balance_actual ?? (lastClosed as any).closing_balance_book ?? 0;
        }
      }

      // 3. Insert new open report
      const { data: newReport, error } = await supabase
        .from('cash_reports' as any)
        .insert({
          company_id: params.companyId,
          cash_register_id: params.cashRegisterId,
          period_start: params.periodStart,
          period_end: params.periodEnd,
          opening_balance: openBal,
          currency: params.currency || 'HUF',
          status: 'open',
        })
        .select()
        .single();

      if (error) throw error;

      // Link any existing unassigned entries in this period to the new report
      await supabase
        .from('petty_cash_entries')
        .update({ cash_report_id: newReport.id })
        .eq('company_id', params.companyId)
        .eq('register_id', params.cashRegisterId)
        .eq('currency', params.currency || 'HUF')
        .gte('entry_date', params.periodStart)
        .lte('entry_date', params.periodEnd)
        .is('cash_report_id', null)
        .neq('status', 'cancelled');

      return newReport as unknown as CashReport;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: cashReportQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: cashReportQueryKeys.active(vars.companyId, vars.cashRegisterId) });
    },
  });
}

/**
 * Validate cash report before GL posting (FR-66 checklist)
 */
export function useValidateCashReportForPosting() {
  return useMutation({
    mutationFn: async (params: { companyId: string; cashReportId: string }) => {
      const { data, error } = await supabase.rpc('validate_cash_report_for_posting' as any, {
        p_company_id: params.companyId,
        p_cash_report_id: params.cashReportId,
      });
      if (error) throw error;
      return data as {
        valid: boolean;
        errors: string[];
        report_number?: string;
        items_count: number;
        missing_contra_count: number;
        closing_balance: number;
      };
    },
  });
}

/**
 * Post closed cash report to General Ledger (381 T/K entries)
 */
export function usePostCashReportToGl() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { companyId: string; cashReportId: string }) => {
      const { data, error } = await supabase.rpc('post_cash_report_to_gl' as any, {
        p_company_id: params.companyId,
        p_cash_report_id: params.cashReportId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cashReportQueryKeys.all });
    },
  });
}

/**
 * Unpost cash report from General Ledger
 */
export function useUnpostCashReportFromGl() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { companyId: string; cashReportId: string }) => {
      const { data, error } = await supabase.rpc('unpost_cash_report_from_gl' as any, {
        p_company_id: params.companyId,
        p_cash_report_id: params.cashReportId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cashReportQueryKeys.all });
    },
  });
}
