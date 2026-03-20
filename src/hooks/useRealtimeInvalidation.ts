import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Subscribe to Supabase Realtime changes on core tables.
 * On any change, invalidate related TanStack Query keys so the UI updates immediately.
 */
export function useRealtimeInvalidation(companyId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!companyId) return;

    const invalidateAll = (keys: string[]) => {
      keys.forEach(key => {
        queryClient.invalidateQueries({ queryKey: [key, companyId] });
      });
    };

    const channel = supabase
      .channel(`computed-status-rt-${companyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'salary', filter: `company_id=eq.${companyId}` },
        () => {
          invalidateAll([
            'salaries', 'dashboardData', 'dashboardAnalytics',
            'analyticsRaw', 'analyticsVat',
            'pettyCashEntries',
            'uploadHistory',
          ]);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invoices', filter: `company_id=eq.${companyId}` },
        () => {
          invalidateAll([
            'submittedInvoices', 'linkedInvoices', 'invoiceTransactions',
            'dashboardData', 'kintlevo-manual',
            'invoiceStatusPayable', 'invoiceStatusMissing',
            'recentInvoices', 'uploadHistory', 'dashboardPettyCash',
          ]);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'nav_invoices', filter: `company_id=eq.${companyId}` },
        () => {
          invalidateAll([
            'navInvoices', 'kintlevo-nav',
            'dashboardData', 'dashboardAnalytics',
            'invoiceStatusPayable', 'invoiceStatusMissing',
            'analyticsRaw', 'analyticsVat',
            'projects', 'projectsList',
            'dashboardPettyCash',
          ]);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `company_id=eq.${companyId}` },
        () => {
          invalidateAll([
            'transactions', 'salaries', 'submittedInvoices',
            'dashboardData', 'dashboardAnalytics',
            'kintlevo-nav', 'kintlevo-manual',
            'invoiceStatusPayable', 'invoiceStatusMissing',
            'invoiceTransactions', 'navInvoices',
            'pettyCashEntries', 'pettyCashSettings',
            'analyticsRaw', 'analyticsVat',
            'projects', 'projectsList',
            'dashboardPettyCash',
          ]);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invoice_uploads', filter: `company_id=eq.${companyId}` },
        () => {
          invalidateAll(['uploadHistory']);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'salary_files', filter: `company_id=eq.${companyId}` },
        () => {
          invalidateAll(['uploadHistory']);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transaction_uploads', filter: `company_id=eq.${companyId}` },
        () => {
          invalidateAll(['uploadHistory']);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, queryClient]);
}