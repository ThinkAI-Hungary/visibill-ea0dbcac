import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import type {
  SubledgerItem,
  SubledgerItemMatch,
  SubledgerMode,
  SubledgerStatusFilter,
  SettleParams,
  WriteOffParams,
} from '@/types/subledger';
import { useToast } from '@/hooks/use-toast';

export const subledgerQueryKeys = {
  all: ['subledger'] as const,
  list: (
    companyId: string,
    glAccountId?: string,
    partnerId?: string,
    mode?: SubledgerMode,
    dateFrom?: string,
    dateTo?: string,
    statusFilter?: SubledgerStatusFilter
  ) =>
    [
      ...subledgerQueryKeys.all,
      'list',
      companyId,
      glAccountId || 'all',
      partnerId || 'all',
      mode || 'OPEN',
      dateFrom || 'all',
      dateTo || 'all',
      statusFilter || 'ALL_ACTIVE',
    ] as const,
  matches: (companyId: string, lineId: string) =>
    [...subledgerQueryKeys.all, 'matches', companyId, lineId] as const,
  accounts: (companyId: string) =>
    [...subledgerQueryKeys.all, 'accounts', companyId] as const,
};

/**
 * Fetch subledger journal lines (open, closed, or all)
 */
export function useSubledgerItems(
  companyId?: string,
  glAccountId?: string,
  partnerId?: string,
  mode: SubledgerMode = 'OPEN',
  dateFrom?: string,
  dateTo?: string,
  statusFilter: SubledgerStatusFilter = 'ALL_ACTIVE'
) {
  return useQuery({
    queryKey: subledgerQueryKeys.list(
      companyId || '',
      glAccountId,
      partnerId,
      mode,
      dateFrom,
      dateTo,
      statusFilter
    ),
    queryFn: async (): Promise<SubledgerItem[]> => {
      if (!companyId) return [];

      const { data, error } = await supabase.rpc('get_subledger_items', {
        p_company_id: companyId,
        p_gl_account_id: glAccountId && glAccountId !== 'all' ? glAccountId : null,
        p_partner_id: partnerId && partnerId !== 'all' ? partnerId : null,
        p_mode: mode,
        p_date_from: dateFrom || null,
        p_date_to: dateTo || null,
        p_status_filter: statusFilter,
      });

      if (error) {
        console.error('Error fetching subledger items:', error);
        throw error;
      }

      return (data || []).map((row: any) => ({
        ...row,
        amount: Number(row.amount || 0),
        gross_amount: Number(row.amount || 0),
        net_amount: Number(row.net_amount ?? row.amount ?? 0),
        vat_amount: Number(row.vat_amount ?? 0),
        foreign_amount: row.foreign_amount ? Number(row.foreign_amount) : null,
        exchange_rate: row.exchange_rate ? Number(row.exchange_rate) : null,
        settled_amount: Number(row.settled_amount || 0),
        remaining_amount: Number(row.remaining_amount || 0),
        journal_number: Number(row.journal_number || 0),
        match_count: Number(row.match_count || 0),
        settlement_number: row.settlement_number || row.document_id || '',
        all_lines: Array.isArray(row.all_lines) ? row.all_lines : [],
      }));
    },
    enabled: !!companyId,
    staleTime: 15_000,
  });
}

/**
 * Fetch accounts eligible for subledger view (partner or detail managed accounts)
 */
export function useSubledgerAccounts(companyId?: string, presetId?: string) {
  return useQuery({
    queryKey: [...subledgerQueryKeys.all, 'accounts', companyId || '', presetId || 'all'] as const,
    queryFn: async () => {
      if (!companyId) return [];

      let query = supabase
        .from('gl_accounts')
        .select('id, gl_number, short_name, name, subledger_type, is_open_item_managed, account_type')
        .or('is_open_item_managed.eq.true,subledger_type.in.(partner,detail)')
        .order('gl_number', { ascending: true });

      if (presetId) {
        query = query.eq('preset_id', presetId);
      } else {
        query = query.eq('company_id', companyId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching subledger accounts:', error);
        throw error;
      }

      // Requirement EB-0255: Only genuine detail posting accounts can be matched in open items (exclude group accounts)
      return (data || []).filter(
        (acc) => (acc as any).account_type !== 'group'
      );
    },
    enabled: !!companyId,
    staleTime: 60_000,
  });
}

/**
 * Fetch match details for a specific journal line
 */
export function useSubledgerItemMatches(companyId?: string, lineId?: string) {
  return useQuery({
    queryKey: subledgerQueryKeys.matches(companyId || '', lineId || ''),
    queryFn: async (): Promise<SubledgerItemMatch[]> => {
      if (!companyId || !lineId) return [];

      const { data, error } = await supabase.rpc('get_subledger_item_matches', {
        p_company_id: companyId,
        p_line_id: lineId,
      });

      if (error) {
        console.error('Error fetching item matches:', error);
        throw error;
      }

      return (data || []).map((row: any) => ({
        ...row,
        settled_amount_huf: Number(row.settled_amount_huf || 0),
        settled_amount_foreign: row.settled_amount_foreign ? Number(row.settled_amount_foreign) : null,
        other_amount: Number(row.other_amount || 0),
      }));
    },
    enabled: !!companyId && !!lineId,
  });
}

/**
 * Mutation to pair / settle open items
 */
export function useSettleOpenItems() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation(['accounting', 'common']);

  return useMutation({
    mutationFn: async (params: SettleParams) => {
      const { data, error } = await supabase.rpc('settle_open_items', {
        p_company_id: params.companyId,
        p_invoice_line_id: params.invoiceLineId,
        p_settling_line_id: params.settlingLineId,
        p_amount_huf: params.amountHuf,
        p_amount_foreign: params.amountForeign || null,
        p_match_type: params.matchType || 'MANUAL',
        p_notes: params.notes || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: t('accounting:subledger.toasts.settle_success_title', 'Sikeres rendezés'),
        description: t('accounting:subledger.toasts.settle_success_desc', 'A kiválasztott tételek sikeresen össze lettek párosítva.'),
      });
      queryClient.invalidateQueries({ queryKey: subledgerQueryKeys.all });
    },
    onError: (err: any) => {
      toast({
        title: t('accounting:subledger.toasts.settle_error_title', 'Hiba a rendezés során'),
        description: err.message || t('common:unknown_error', 'Nem sikerült a tételek párosítása.'),
        variant: 'destructive',
      });
    },
  });
}

/**
 * Mutation for 1-click automatic settlement
 */
export function useAutoSettleSubledgerItems() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation(['accounting', 'common']);

  return useMutation({
    mutationFn: async ({ companyId, glAccountId }: { companyId: string; glAccountId?: string }) => {
      const { data, error } = await supabase.rpc('auto_settle_subledger_items', {
        p_company_id: companyId,
        p_gl_account_id: glAccountId && glAccountId !== 'all' ? glAccountId : null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      const count = data?.matched_count || 0;
      const total = data?.total_amount || 0;
      if (count > 0) {
        toast({
          title: t('accounting:subledger.toasts.auto_settle_success_title', 'Automatikus párosítás befejeződött'),
          description: t('accounting:subledger.toasts.auto_settle_success_desc', { count, amount: Math.round(total).toLocaleString('hu-HU'), defaultValue: `${count} tételpár sikeresen összerendezve ${Math.round(total).toLocaleString('hu-HU')} Ft értékben.` }),
        });
      } else {
        toast({
          title: t('accounting:subledger.toasts.auto_settle_empty_title', 'Nincs új párosítható tétel'),
          description: t('accounting:subledger.toasts.auto_settle_empty_desc', 'Nem található azonos hivatkozású vagy összegű rendezetlen tétel a folyószámlán.'),
        });
      }
      queryClient.invalidateQueries({ queryKey: subledgerQueryKeys.all });
    },
    onError: (err: any) => {
      toast({
        title: t('accounting:subledger.toasts.auto_settle_error_title', 'Hiba az automatikus párosítás során'),
        description: err.message || t('common:unknown_error', 'A művelet megszakadt.'),
        variant: 'destructive',
      });
    },
  });
}

/**
 * Mutation for batch posting draft items to KONYVELT
 */
export function useBatchPostSubledgerItems() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation(['accounting', 'common']);

  return useMutation({
    mutationFn: async ({ companyId, headerIds }: { companyId: string; headerIds: string[] }) => {
      const { data, error } = await supabase.rpc('batch_post_subledger_items', {
        p_company_id: companyId,
        p_header_ids: headerIds,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (count: number) => {
      toast({
        title: t('accounting:subledger.toasts.batch_post_success_title', 'Tételek sikeresen lekönyvelve'),
        description: t('accounting:subledger.toasts.batch_post_success_desc', { count, defaultValue: `${count} bizonylat státusza végleges könyveltre (KÖNYVELT) módosult.` }),
      });
      queryClient.invalidateQueries({ queryKey: subledgerQueryKeys.all });
    },
    onError: (err: any) => {
      toast({
        title: t('accounting:subledger.toasts.batch_post_error_title', 'Hiba a könyvelés során'),
        description: err.message || t('common:unknown_error', 'Nem sikerült a tételek lekönyvelése.'),
        variant: 'destructive',
      });
    },
  });
}

/**
 * Mutation to unlink / unsettle a match
 */
export function useUnsettleOpenItems() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation(['accounting', 'common']);

  return useMutation({
    mutationFn: async ({ companyId, matchId }: { companyId: string; matchId: string }) => {
      const { data, error } = await supabase.rpc('unsettle_open_items', {
        p_company_id: companyId,
        p_match_id: matchId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: t('accounting:subledger.toasts.unsettle_success_title', 'Rendezés felbontva'),
        description: t('accounting:subledger.toasts.unsettle_success_desc', 'A tétel párosítása sikeresen meg lett szüntetve, visszakerült a nyitott tételek közé.'),
      });
      queryClient.invalidateQueries({ queryKey: subledgerQueryKeys.all });
    },
    onError: (err: any) => {
      toast({
        title: t('accounting:subledger.toasts.unsettle_error_title', 'Hiba a felbontás során'),
        description: err.message || t('common:unknown_error', 'Nem sikerült a kapcsolat megszüntetése.'),
        variant: 'destructive',
      });
    },
  });
}

/**
 * Mutation to write off rounding or FX differences
 */
export function useWriteOffSubledgerDifference() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation(['accounting', 'common']);

  return useMutation({
    mutationFn: async (params: WriteOffParams) => {
      const { data, error } = await supabase.rpc('write_off_subledger_difference', {
        p_company_id: params.companyId,
        p_line_id: params.lineId,
        p_type: params.type,
        p_amount_huf: params.amountHuf,
        p_target_gl_id: params.targetGlId || null,
        p_description: params.description || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      const isRounding = variables.type === 'ROUNDING';
      toast({
        title: isRounding
          ? t('accounting:subledger.toasts.write_off_rounding_title', 'Kerekítés sikeresen leírva')
          : t('accounting:subledger.toasts.write_off_fx_title', 'Árfolyamkülönbözet sikeresen leírva'),
        description: t('accounting:subledger.toasts.write_off_desc', 'A vegyes bizonylat automatikusan le lett könyvelve és a tétel le lett zárva.'),
      });
      queryClient.invalidateQueries({ queryKey: subledgerQueryKeys.all });
    },
    onError: (err: any) => {
      toast({
        title: t('accounting:subledger.toasts.write_off_error_title', 'Hiba a leírás során'),
        description: err.message || t('common:unknown_error', 'Nem sikerült a különbözet automatikus leírása.'),
        variant: 'destructive',
      });
    },
  });
}

/**
 * Mutation to unpost an already posted subledger journal entry (re-opens into KEZI_PISZKOZAT for modification)
 */
export function useUnpostSubledgerEntry() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation(['accounting', 'common']);

  return useMutation({
    mutationFn: async ({ headerId, reason }: { headerId: string; reason?: string }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error(t('common:errors.login_required', 'Bejelentkezés szükséges a módosításhoz.'));

      const { error } = await supabase.rpc('acc_unpost_journal_entry', {
        p_header_id: headerId,
        p_user_id: user.id,
        p_reason: reason || 'Folyószámláról visszanyitva közvetlen módosításra',
      });
      if (error) throw error;
      return headerId;
    },
    onSuccess: () => {
      toast({
        title: t('accounting:subledger.toasts.unpost_success_title', 'Bizonylat visszanyitva piszkozattá'),
        description: t('accounting:subledger.toasts.unpost_success_desc', 'A tétel sikeresen visszanyitva szerkesztésre.'),
      });
      queryClient.invalidateQueries({ queryKey: subledgerQueryKeys.all });
    },
    onError: (err: any) => {
      toast({
        title: t('accounting:subledger.toasts.unpost_error_title', 'Hiba a bizonylat visszanyitásakor'),
        description: err.message || t('common:unknown_error', 'Nem sikerült a tétel visszanyitása.'),
        variant: 'destructive',
      });
    },
  });
}

