/**
 * Accounty Deadline hooks — queries and mutations.
 * Split from useAccountyData.ts for maintainability.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AccountyDeadline, invalidateAccountyCache } from './useAccountyHelpers';

export function useAccountyDeadlines() {
  const { user } = useAuth();
  const userId = user?.id || '';

  return useQuery({
    queryKey: queryKeys.accountyDeadlines(userId),
    queryFn: async (): Promise<AccountyDeadline[]> => {
      const { data: myAssigns } = await supabase
        .from('accounty_assignments')
        .select('role')
        .eq('accountant_user_id', userId);
      const isAdmin = myAssigns?.some(a => a.role === 'iroda_admin');

      let query = supabase
        .from('accounty_assignments')
        .select('company_id')
        .eq('accountant_user_id', userId);
      
      if (!isAdmin) {
        query = query.eq('is_main_accountant', true);
      }
      
      const { data: assignments, error: assignErr } = await query;

      if (assignErr) throw assignErr;
      if (!assignments || assignments.length === 0) return [];

      const companyIds = assignments.map(a => a.company_id);

      const { data: deadlines, error } = await supabase
        .from('accounty_deadlines')
        .select('*')
        .in('company_id', companyIds)
        .order('due_date', { ascending: true });

      if (error) throw error;

      const { data: companies } = await supabase
        .from('companies')
        .select('id, name')
        .in('id', companyIds);

      const nameMap: Record<string, string> = {};
      (companies || []).forEach(c => { nameMap[c.id] = c.name; });

      return (deadlines || [])
        .filter(d => nameMap[d.company_id] && nameMap[d.company_id] !== 'SANDBOX')
        .map((d): AccountyDeadline => ({
        id: d.id,
        companyId: d.company_id,
        companyName: nameMap[d.company_id] || 'Ismeretlen',
        deadlineType: d.deadline_type,
        title: d.title,
        dueDate: d.due_date,
        status: d.status,
        isManualOverride: d.is_manual_override || false,
        notes: d.notes,
      }));
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}

export function useCompleteDeadline() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (deadlineId: string) => {
      const { error } = await supabase
        .from('accounty_deadlines')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: user?.id,
        })
        .eq('id', deadlineId);

      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAccountyCache(queryClient, 'deadlines');
    },
  });
}
