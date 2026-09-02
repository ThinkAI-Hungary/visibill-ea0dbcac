import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Subscribes to Supabase Realtime changes on accounty_missing_items
 * and automatically invalidates relevant queries when data changes.
 *
 * This means when a colleague resolves a missing item or a new one is
 * detected, the dashboard KPIs and client list update automatically
 * without manual refresh.
 *
 * Should be called once in the AccountyLayout or AccountyApp.
 */
export function useAccountyRealtime() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('accounty-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'accounty_missing_items',
        },
        () => {
          // Invalidate all related queries — React Query will refetch
          // only those that are currently mounted/observed
          queryClient.invalidateQueries({ queryKey: ['accounty-kpis'] });
          queryClient.invalidateQueries({ queryKey: ['accounty-clients'] });
          queryClient.invalidateQueries({ queryKey: ['accounty-all-missing-items'] });
          queryClient.invalidateQueries({ queryKey: ['accounty-company-summary'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'accounty_deadlines',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['accounty-deadlines'] });
          queryClient.invalidateQueries({ queryKey: ['accounty-kpis'] });
          queryClient.invalidateQueries({ queryKey: ['accounty-clients'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'invoices',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['company-invoices'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);
}
