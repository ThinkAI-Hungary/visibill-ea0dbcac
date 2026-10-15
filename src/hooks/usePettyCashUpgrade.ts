import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  TimelineIntegrityResult,
  GlReconciliationResult,
  FxCashRevaluationResult,
  CashPartnerMonthlyLimitResult,
} from '@/components/petty-cash/types';

export const pettyCashUpgradeQueryKeys = {
  glReconciliation: (companyId: string, year: number, dateTo?: string) =>
    ['petty-cash-gl-reconciliation', companyId, year, dateTo || 'latest'] as const,
  fxRevaluation: (companyId: string, year: number) =>
    ['petty-cash-fx-revaluation', companyId, year] as const,
  partnerLimits: (companyId: string, year: number, month: number) =>
    ['petty-cash-partner-limits', companyId, year, month] as const,
};

/**
 * Mutation to check timeline integrity before adding or deleting an entry (hard-stop & first error detector)
 */
export function useCheckTimelineIntegrity() {
  return useMutation({
    mutationFn: async (params: {
      companyId: string;
      registerId: string;
      currency: string;
      candidateDate?: string;
      candidateAmount?: number;
      excludeEntryId?: string;
    }): Promise<TimelineIntegrityResult> => {
      const { data, error } = await supabase.rpc('check_petty_cash_timeline_integrity' as any, {
        p_company_id: params.companyId,
        p_register_id: params.registerId,
        p_currency: params.currency,
        p_candidate_date: params.candidateDate || null,
        p_candidate_amount: params.candidateAmount ?? null,
        p_exclude_entry_id: params.excludeEntryId || null,
      });

      if (error) throw error;
      return data as TimelineIntegrityResult;
    },
  });
}

/**
 * Hook to query real-time GL (381/382) ↔ Petty Cash analytics reconciliation
 */
export function useGlReconciliation(companyId: string, year: number, dateTo?: string) {
  return useQuery({
    queryKey: pettyCashUpgradeQueryKeys.glReconciliation(companyId, year, dateTo),
    queryFn: async (): Promise<GlReconciliationResult> => {
      if (!companyId || !year) {
        throw new Error('Company ID és év megadása kötelező');
      }

      const { data, error } = await supabase.rpc('reconcile_petty_cash_with_gl' as any, {
        p_company_id: companyId,
        p_year: year,
        p_date_to: dateTo || new Date().toISOString().split('T')[0],
      });

      if (error) throw error;
      return data as GlReconciliationResult;
    },
    enabled: !!companyId && !!year,
    staleTime: 30_000,
  });
}

/**
 * Mutation to calculate (and optionally post) year-end MNB valuation for foreign currency registers (Sztv. 60. §)
 */
export function useFxCashRevaluation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      companyId: string;
      year: number;
      postToGl?: boolean;
    }): Promise<FxCashRevaluationResult> => {
      const { data, error } = await supabase.rpc('calculate_fx_cash_revaluation' as any, {
        p_company_id: params.companyId,
        p_year: params.year,
        p_post_to_gl: params.postToGl ?? false,
      });

      if (error) throw error;
      return data as FxCashRevaluationResult;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: pettyCashUpgradeQueryKeys.fxRevaluation(vars.companyId, vars.year),
      });
      queryClient.invalidateQueries({ queryKey: ['pettyCashSummary', vars.companyId] });
      queryClient.invalidateQueries({ queryKey: ['general-ledger', vars.companyId] });
    },
  });
}

/**
 * Hook to query monthly cash payments per partner against the 1.5M HUF threshold (Art. 114. §)
 */
export function useCashPartnerMonthlyLimits(companyId: string, year: number, month: number) {
  return useQuery({
    queryKey: pettyCashUpgradeQueryKeys.partnerLimits(companyId, year, month),
    queryFn: async (): Promise<CashPartnerMonthlyLimitResult> => {
      if (!companyId || !year || !month) {
        throw new Error('Company ID, év és hónap megadása kötelező');
      }

      const { data, error } = await supabase.rpc('get_cash_partner_monthly_limits' as any, {
        p_company_id: companyId,
        p_year: year,
        p_month: month,
      });

      if (error) throw error;
      return data as CashPartnerMonthlyLimitResult;
    },
    enabled: !!companyId && !!year && !!month,
    staleTime: 60_000,
  });
}
