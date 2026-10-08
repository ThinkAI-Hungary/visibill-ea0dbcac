import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

export interface AutoAccountingRules {
  id?: string;
  company_id: string;

  // 1. ÁFA átvezetések
  vat_pf_payable_gl_id: string | null;
  vat_pf_payable_gl_number?: string | null;
  vat_pf_payable_name?: string | null;

  vat_pf_deductible_gl_id: string | null;
  vat_pf_deductible_gl_number?: string | null;
  vat_pf_deductible_name?: string | null;

  vat_advance_gross_gl_id: string | null;
  vat_advance_gross_gl_number?: string | null;
  vat_advance_gross_name?: string | null;

  vat_intra_year_payable_gl_id: string | null;
  vat_intra_year_payable_gl_number?: string | null;
  vat_intra_year_payable_name?: string | null;

  vat_intra_year_deductible_gl_id: string | null;
  vat_intra_year_deductible_gl_number?: string | null;
  vat_intra_year_deductible_name?: string | null;

  vat_cross_year_payable_gl_id: string | null;
  vat_cross_year_payable_gl_number?: string | null;
  vat_cross_year_payable_name?: string | null;

  vat_cross_year_deductible_gl_id: string | null;
  vat_cross_year_deductible_gl_number?: string | null;
  vat_cross_year_deductible_name?: string | null;

  // 2. Realizált árfolyam-különbözet
  fx_realized_journal_id: string | null;
  fx_realized_journal_code?: string | null;
  fx_realized_journal_name?: string | null;

  fx_realized_gain_gl_id: string | null;
  fx_realized_gain_gl_number?: string | null;
  fx_realized_gain_name?: string | null;

  fx_realized_loss_gl_id: string | null;
  fx_realized_loss_gl_number?: string | null;
  fx_realized_loss_name?: string | null;

  // 3. Nem realizált árfolyam-különbözet
  fx_unrealized_journal_id: string | null;
  fx_unrealized_journal_code?: string | null;
  fx_unrealized_journal_name?: string | null;

  fx_unrealized_gain_gl_id: string | null;
  fx_unrealized_gain_gl_number?: string | null;
  fx_unrealized_gain_name?: string | null;

  fx_unrealized_loss_gl_id: string | null;
  fx_unrealized_loss_gl_number?: string | null;
  fx_unrealized_loss_name?: string | null;

  // 4. Kerekítési különbözet
  rounding_gain_gl_id: string | null;
  rounding_gain_gl_number?: string | null;
  rounding_gain_name?: string | null;

  rounding_loss_gl_id: string | null;
  rounding_loss_gl_number?: string | null;
  rounding_loss_name?: string | null;

  rounding_max_limit_huf: number;
}

export interface AutoAccountingRulesResponse {
  is_configured: boolean;
  rules: AutoAccountingRules;
  active_preset_id?: string;
}

export interface GlAccountOption {
  id: string;
  gl_number: string;
  short_name: string;
  description?: string | null;
}

export interface JournalOption {
  id: string;
  code: string;
  name: string;
  type: string;
}

export const autoAccountingQueryKeys = {
  all: ['company-auto-accounting-rules'] as const,
  rules: (companyId: string) => ['company-auto-accounting-rules', companyId] as const,
  glAccounts: (companyId: string) => ['company-gl-accounts-lookup', companyId] as const,
  journals: (companyId: string) => ['company-journals-lookup', companyId] as const,
};

/**
 * Query hook to fetch automated accounting rules for a company
 */
export function useAutoAccountingRules(companyId?: string) {
  return useQuery({
    queryKey: autoAccountingQueryKeys.rules(companyId || ''),
    queryFn: async (): Promise<AutoAccountingRulesResponse | null> => {
      if (!companyId) return null;

      const { data, error } = await supabase.rpc('acc_get_auto_accounting_rules', {
        p_company_id: companyId,
      });

      if (error) {
        console.error('Error fetching auto accounting rules:', error);
        throw error;
      }

      return data as unknown as AutoAccountingRulesResponse;
    },
    enabled: !!companyId,
    staleTime: 60_000,
  });
}

/**
 * Query hook to fetch available GL accounts for dropdowns
 */
export function useCompanyGlAccountsLookup(companyId?: string) {
  return useQuery({
    queryKey: autoAccountingQueryKeys.glAccounts(companyId || ''),
    queryFn: async (): Promise<GlAccountOption[]> => {
      if (!companyId) return [];

      // Query active preset
      const { data: presetData } = await supabase
        .from('chart_of_accounts_presets')
        .select('id')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .maybeSingle();

      const presetId = presetData?.id;

      let query = supabase
        .from('gl_accounts')
        .select('id, gl_number, short_name, description')
        .order('gl_number', { ascending: true });

      if (presetId) {
        query = query.or(`company_id.eq.${companyId},preset_id.eq.${presetId}`);
      } else {
        query = query.or(`company_id.eq.${companyId},preset_id.not.is.null`);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching GL accounts lookup:', error);
        throw error;
      }

      return (data || []) as GlAccountOption[];
    },
    enabled: !!companyId,
    staleTime: 5 * 60_000,
  });
}

/**
 * Query hook to fetch available mixed/vegyes journals for dropdowns
 */
export function useCompanyJournalsLookup(companyId?: string) {
  return useQuery({
    queryKey: autoAccountingQueryKeys.journals(companyId || ''),
    queryFn: async (): Promise<JournalOption[]> => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from('acc_journals')
        .select('id, code, name, type')
        .eq('company_id', companyId)
        .order('code', { ascending: true });

      if (error) {
        console.error('Error fetching company journals lookup:', error);
        throw error;
      }

      return (data || []) as JournalOption[];
    },
    enabled: !!companyId,
    staleTime: 5 * 60_000,
  });
}

/**
 * Mutation hook to save/upsert automated accounting rules
 */
export function useSaveAutoAccountingRules() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation(['accounting', 'common']);

  return useMutation({
    mutationFn: async (rules: AutoAccountingRules) => {
      const payload = {
        company_id: rules.company_id,
        vat_pf_payable_gl_id: rules.vat_pf_payable_gl_id || null,
        vat_pf_deductible_gl_id: rules.vat_pf_deductible_gl_id || null,
        vat_advance_gross_gl_id: rules.vat_advance_gross_gl_id || null,
        vat_intra_year_payable_gl_id: rules.vat_intra_year_payable_gl_id || null,
        vat_intra_year_deductible_gl_id: rules.vat_intra_year_deductible_gl_id || null,
        vat_cross_year_payable_gl_id: rules.vat_cross_year_payable_gl_id || null,
        vat_cross_year_deductible_gl_id: rules.vat_cross_year_deductible_gl_id || null,
        fx_realized_journal_id: rules.fx_realized_journal_id || null,
        fx_realized_gain_gl_id: rules.fx_realized_gain_gl_id || null,
        fx_realized_loss_gl_id: rules.fx_realized_loss_gl_id || null,
        fx_unrealized_journal_id: rules.fx_unrealized_journal_id || null,
        fx_unrealized_gain_gl_id: rules.fx_unrealized_gain_gl_id || null,
        fx_unrealized_loss_gl_id: rules.fx_unrealized_loss_gl_id || null,
        rounding_gain_gl_id: rules.rounding_gain_gl_id || null,
        rounding_loss_gl_id: rules.rounding_loss_gl_id || null,
        rounding_max_limit_huf: Number(rules.rounding_max_limit_huf) || 10.0,
        updated_at: new Date().toISOString(),
      };

      // Primary: call the SECURITY DEFINER RPC with authorization check
      const { data: rpcData, error: rpcError } = await supabase.rpc('acc_save_auto_accounting_rules', {
        p_company_id: rules.company_id,
        p_rules: payload,
      });

      if (!rpcError) {
        return rpcData;
      }

      // Secondary fallback: table upsert with RLS policies
      const { data, error } = await supabase
        .from('company_auto_accounting_rules')
        .upsert(payload, { onConflict: 'company_id' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      toast({
        title: t('accounting:auto_rules.save_success_title', 'Szabályok sikeresen mentve'),
        description: t('accounting:auto_rules.save_success_desc', 'Az automatikus könyvelési és átvezetési szabályok érvénybe léptek.'),
      });
      queryClient.invalidateQueries({ queryKey: autoAccountingQueryKeys.rules(variables.company_id) });
    },
    onError: (err: any) => {
      toast({
        title: t('accounting:auto_rules.save_error_title', 'Hiba a mentés során'),
        description: err.message || t('common:unknown_error', 'Nem sikerült elmenteni a szabályokat.'),
        variant: 'destructive',
      });
    },
  });
}

/**
 * Mutation hook to copy rules from another company
 */
export function useCopyAutoAccountingRules() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation(['accounting', 'common']);

  return useMutation({
    mutationFn: async ({
      sourceCompanyId,
      targetCompanyId,
    }: {
      sourceCompanyId: string;
      targetCompanyId: string;
    }) => {
      const { data, error } = await supabase.rpc('acc_copy_auto_accounting_rules', {
        p_source_company_id: sourceCompanyId,
        p_target_company_id: targetCompanyId,
      });

      if (error) throw error;
      return data as {
        success: boolean;
        matched_count: number;
        smart_matched_count?: number;
        smart_matched?: string[];
        unmatched: string[];
      };
    },
    onSuccess: (data, variables) => {
      const unmatchedCount = data.unmatched?.length || 0;
      const smartCount = data.smart_matched_count || data.smart_matched?.length || 0;

      if (unmatchedCount > 0) {
        toast({
          title: t('accounting:auto_rules.copy_partial_title', 'Szabályok átvéve figyelmeztetéssel'),
          description: t(
            'accounting:auto_rules.copy_partial_desc',
            '{{matched}} számla hozzárendelve{{smartInfo}}. {{unmatched}} számlaszám nem található a cél cég számlatükrében.',
            {
              matched: data.matched_count,
              smartInfo: smartCount > 0 ? ` (ebből ${smartCount} intelligens számlatükör-illesztéssel)` : '',
              unmatched: unmatchedCount,
            }
          ),
          variant: 'default',
        });
      } else {
        toast({
          title: t('accounting:auto_rules.copy_success_title', 'Szabályok sikeresen átvéve!'),
          description: t(
            'accounting:auto_rules.copy_success_desc',
            'Minden automatikus könyvelési szabály sikeresen átmásolva ({{matched}} tétel{{smartInfo}}).',
            {
              matched: data.matched_count,
              smartInfo: smartCount > 0 ? `, ebből ${smartCount} hierarchikus prefix illesztéssel` : '',
            }
          ),
        });
      }
      queryClient.invalidateQueries({ queryKey: autoAccountingQueryKeys.rules(variables.targetCompanyId) });
    },
    onError: (err: any) => {
      toast({
        title: t('accounting:auto_rules.copy_error_title', 'Hiba az átvétel során'),
        description: err.message || t('common:unknown_error', 'Nem sikerült átvenni a szabályokat.'),
        variant: 'destructive',
      });
    },
  });
}
