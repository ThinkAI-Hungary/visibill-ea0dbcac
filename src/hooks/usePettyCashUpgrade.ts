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
      const raw = (data || {}) as any;

      const totalAnalytic = Number(raw.total_analytic_balance ?? raw.analytics_total_huf ?? 0);
      const totalGl = Number(raw.total_gl_balance ?? raw.gl_total_huf ?? 0);
      const totalDiff = Number(raw.total_difference ?? raw.discrepancy_huf ?? (totalAnalytic - totalGl));
      const isReconciled = Boolean(raw.is_fully_reconciled ?? raw.is_reconciled ?? (Math.abs(totalDiff) <= 0.01));

      const registers = (raw.registers || []).map((r: any) => {
        const cur = r.currency || (Array.isArray(r.currencies) && r.currencies[0]) || 'HUF';
        const glAcc = r.gl_account || r.gl_account_code || (cur === 'HUF' ? '381' : '382');
        const anBal = Number(r.analytic_balance ?? r.analytics_balance_huf ?? r.analytics_balance_fx ?? 0);
        const glBal = Number(r.gl_balance ?? r.gl_balance_huf ?? 0);
        const diff = Number(r.difference ?? r.diff_huf ?? (anBal - glBal));
        const isMatch = Boolean(r.is_matching ?? (Math.abs(diff) <= 0.01));

        return {
          register_id: r.register_id || '',
          register_name: r.register_name || 'Pénztár',
          currency: cur,
          currencies: Array.isArray(r.currencies) && r.currencies.length > 0 ? r.currencies : [cur],
          gl_account: glAcc,
          gl_account_code: glAcc,
          analytic_balance: anBal,
          analytics_balance_fx: Number(r.analytics_balance_fx ?? anBal),
          analytics_balance_huf: Number(r.analytics_balance_huf ?? anBal),
          gl_balance: glBal,
          gl_balance_huf: glBal,
          difference: diff,
          diff_huf: diff,
          is_matching: isMatch,
        };
      });

      const unpostedDiscrepancies = (raw.unposted_entries || []).map((e: any) => ({
        discrepancy_type: 'unposted_entry',
        date: e.entry_date || '',
        description: `${e.register_name || 'Pénztár'}: ${e.description || 'Pénztárbizonylat'}${e.receipt_number ? ` (${e.receipt_number})` : ''}`,
        amount_huf: Number(e.amount || 0),
        remedy_suggestion: 'Pénztárjelentés lezárása és feladása a főkönyvbe',
      }));

      const directGlDiscrepancies = (raw.direct_gl_entries || []).map((g: any) => ({
        discrepancy_type: 'direct_gl_posting',
        date: g.posting_date || '',
        description: `Napló #${g.journal_number ?? ''} | ${g.description || 'Közvetlen főkönyvi tétel'} (${g.gl_number || ''})`,
        amount_huf: g.dc_type === 'T' ? Number(g.amount || 0) : -Number(g.amount || 0),
        remedy_suggestion: 'Közvetlenül könyvelt főkönyvi tétel felülvizsgálata vagy stornózása',
      }));

      const itemizedDiscrepancies = raw.itemized_discrepancies || [...unpostedDiscrepancies, ...directGlDiscrepancies];

      return {
        year: Number(raw.year ?? year),
        date_to: String(raw.date_to ?? dateTo ?? ''),
        is_reconciled: isReconciled,
        is_fully_reconciled: isReconciled,
        status_message: raw.status_message || (isReconciled ? 'Minden tétel egyezik a főkönyvvel.' : 'Különbözet detektálva az Analitika és a Főkönyv között.'),
        analytics_total_huf: totalAnalytic,
        total_analytic_balance: totalAnalytic,
        gl_total_huf: totalGl,
        total_gl_balance: totalGl,
        discrepancy_huf: totalDiff,
        total_difference: totalDiff,
        registers,
        itemized_discrepancies: itemizedDiscrepancies,
        unposted_entries: raw.unposted_entries || [],
        direct_gl_entries: raw.direct_gl_entries || [],
      } as GlReconciliationResult;
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
      const raw = (data || {}) as any;
      const threshold = raw.threshold_huf ?? 1500000;
      const rawPartners = Array.isArray(raw.partners) ? raw.partners : [];
      const normalizedPartners = rawPartners.map((p: any) => {
        const total = Number(p.total_amount_huf ?? p.total_cash_huf ?? 0);
        const thresh = Number(p.monthly_threshold_huf ?? p.threshold_huf ?? threshold);
        const excess = Number(p.excess_amount_huf ?? p.excess_amount ?? Math.max(0, total - thresh));
        const penalty = Number(p.penalty_risk_huf ?? Math.round(excess * 0.2));
        const isExceeded = Boolean(p.is_exceeded || total > thresh);
        const status = isExceeded ? 'violating' : (total >= thresh * 0.8 ? 'warning' : 'safe');
        const taxNo = p.tax_number || p.partner_tax_number || null;

        return {
          ...p,
          total_amount_huf: total,
          total_cash_huf: total,
          monthly_threshold_huf: thresh,
          threshold_huf: thresh,
          excess_amount_huf: excess,
          excess_amount: excess,
          penalty_risk_huf: penalty,
          status,
          is_exceeded: isExceeded,
          tax_number: taxNo,
          partner_tax_number: taxNo,
        };
      });

      const violatingCount = raw.violating_partner_count ?? normalizedPartners.filter((p: any) => p.is_exceeded).length;
      const totalPenalty = raw.total_penalty_risk_huf ?? normalizedPartners.reduce((acc: number, p: any) => acc + (p.penalty_risk_huf || 0), 0);

      return {
        ...raw,
        threshold_huf: threshold,
        violating_partner_count: violatingCount,
        total_penalty_risk_huf: totalPenalty,
        partners: normalizedPartners,
      } as CashPartnerMonthlyLimitResult;
    },
    enabled: !!companyId && !!year && !!month,
    staleTime: 60_000,
  });
}
