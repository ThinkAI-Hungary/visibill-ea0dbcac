import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

export interface SzamlazzSyncResultItem {
  invoiceNumber: string;
  success: boolean;
  url?: string;
  error?: string;
}

export interface SzamlazzSyncResponse {
  success: boolean;
  totalPending: number;
  processed: number;
  downloaded: number;
  notFound: number;
  errors: number;
  remaining: number;
  results: SzamlazzSyncResultItem[];
  error?: string;
}

export interface SzamlazzStatus {
  hasAgentKey: boolean;
  totalOutbound: number;
  withImageCount: number;
  pendingCount: number;
}

/**
 * useSzamlazzStatus
 * Checks whether the company has a configured Számlázz.hu agent key
 * and calculates how many outbound invoices are missing PDF images.
 */
export function useSzamlazzStatus(companyId?: string | null) {
  return useQuery<SzamlazzStatus>({
    queryKey: ['szamlazz-status', companyId],
    queryFn: async (): Promise<SzamlazzStatus> => {
      if (!companyId) {
        return { hasAgentKey: false, totalOutbound: 0, withImageCount: 0, pendingCount: 0 };
      }

      // 1. Check agent key
      const { data: keyData, error: keyErr } = await supabase.rpc('get_szamlazz_agent_key', {
        p_company_id: companyId,
      });
      const hasAgentKey = Boolean(keyData && (keyData as string).trim().length >= 10 && !keyErr);

      // 2. Count outbound invoices in nav_invoices
      const { data: navOutbound, error: navErr } = await supabase
        .from('nav_invoices')
        .select('invoice_number')
        .eq('company_id', companyId)
        .eq('invoice_direction', 'OUTBOUND');

      if (navErr || !navOutbound) {
        return { hasAgentKey, totalOutbound: 0, withImageCount: 0, pendingCount: 0 };
      }

      const totalOutbound = navOutbound.length;
      if (totalOutbound === 0) {
        return { hasAgentKey, totalOutbound: 0, withImageCount: 0, pendingCount: 0 };
      }

      // 3. Count matching invoices that already have an image
      const { data: existingInvoices } = await supabase
        .from('invoices')
        .select('bizonylatsorszam')
        .eq('company_id', companyId)
        .eq('invoice_direction', 'OUTBOUND')
        .not('melleklet_url', 'is', null);

      const existingSet = new Set(
        (existingInvoices || []).map((i) => (i.bizonylatsorszam || '').trim().toLowerCase())
      );

      const withImageCount = navOutbound.filter((nav) =>
        existingSet.has((nav.invoice_number || '').trim().toLowerCase())
      ).length;

      const pendingCount = Math.max(0, totalOutbound - withImageCount);

      return {
        hasAgentKey,
        totalOutbound,
        withImageCount,
        pendingCount,
      };
    },
    enabled: Boolean(companyId),
    staleTime: 30000,
  });
}

/**
 * useSyncSzamlazzOutbound
 * Mutation to sync outbound invoices from Számlázz.hu
 */
export function useSyncSzamlazzOutbound(companyId?: string | null) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation(['invoices', 'common']);

  return useMutation<
    SzamlazzSyncResponse,
    Error,
    { invoiceNumbers?: string[]; limit?: number }
  >({
    mutationFn: async ({ invoiceNumbers, limit = 10 }) => {
      if (!companyId) {
        throw new Error('Company ID is required for Számlázz.hu sync.');
      }

      const { data, error } = await supabase.functions.invoke<SzamlazzSyncResponse>(
        'sync-szamlazz-outbound-invoices',
        {
          body: {
            companyId,
            invoiceNumbers,
            limit,
          },
        }
      );

      if (error) {
        throw new Error(error.message || 'Hiba történt a Számlázz.hu szinkronizáció során.');
      }

      if (!data || data.success === false) {
        throw new Error(data?.error || 'Nem sikerült letölteni a számlaképeket a Számlázz.hu-ból.');
      }

      return data;
    },
    onSuccess: (data) => {
      if (companyId) {
        queryClient.invalidateQueries({ queryKey: ['szamlazz-status', companyId] });
        queryClient.invalidateQueries({ queryKey: queryKeys.accountyCompanyInvoices(companyId) });
        queryClient.invalidateQueries({ queryKey: ['company-invoices', companyId] });
        queryClient.invalidateQueries({ queryKey: ['nav-invoices'] });
        queryClient.invalidateQueries({ queryKey: ['submittedInvoices'] });
        queryClient.invalidateQueries({ queryKey: ['gl-categorized-items'] });
      }
    },
    onError: (err) => {
      toast({
        title: t('common:error', 'Hiba történt'),
        description: err.message,
        variant: 'destructive',
      });
    },
  });
}
