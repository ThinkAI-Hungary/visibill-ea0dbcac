import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Subscribe to Supabase Realtime changes on salary, invoices, and transactions tables.
 * On any change, invalidate related TanStack Query keys so the UI updates immediately.
 */
export function useRealtimeInvalidation(companyId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel(`computed-status-rt-${companyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'salary', filter: `company_id=eq.${companyId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['salaries', companyId] });
          queryClient.invalidateQueries({ queryKey: ['dashboardData', companyId] });
          queryClient.invalidateQueries({ queryKey: ['dashboardAnalytics', companyId] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invoices', filter: `company_id=eq.${companyId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['submittedInvoices', companyId] });
          queryClient.invalidateQueries({ queryKey: ['dashboardData', companyId] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `company_id=eq.${companyId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['transactions', companyId] });
          queryClient.invalidateQueries({ queryKey: ['salaries', companyId] });
          queryClient.invalidateQueries({ queryKey: ['submittedInvoices', companyId] });
          queryClient.invalidateQueries({ queryKey: ['dashboardData', companyId] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'nav_invoices', filter: `company_id=eq.${companyId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['navInvoices', companyId] });
          queryClient.invalidateQueries({ queryKey: ['dashboardData', companyId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, queryClient]);
}
