import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export type LeaveType = 'vacation' | 'sick' | 'personal' | 'other';
export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface LeaveRequest {
  id: string;
  company_id: string;
  user_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  status: LeaveStatus;
  note: string | null;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  employee_name?: string;
}

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  vacation: 'Szabadság',
  sick: 'Betegszabadság',
  personal: 'Személyes',
  other: 'Egyéb',
};

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  pending: 'Függőben',
  approved: 'Jóváhagyva',
  rejected: 'Elutasítva',
};

export function useLeaveRequests() {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();
  const companyId = selectedCompany?.id;

  const { data: leaveRequests = [], isLoading } = useQuery({
    queryKey: ['leave-requests', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('company_id', companyId!)
        .order('start_date', { ascending: false });

      if (error) throw error;

      // Fetch employee names
      const userIds = [...new Set((data || []).map((r) => r.user_id))];
      const nameMap: Record<string, string> = {};

      if (userIds.length > 0) {
        // Try employee_rates first
        const { data: employees } = await supabase
          .from('employee_rates')
          .select('user_id, employee_name')
          .eq('company_id', companyId!)
          .in('user_id', userIds);

        (employees || []).forEach((e) => {
          if (e.user_id) nameMap[e.user_id] = e.employee_name;
        });

        // Fallback to profiles for admins/owners not in employee_rates
        const missingIds = userIds.filter((id) => !nameMap[id]);
        if (missingIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, name')
            .in('user_id', missingIds);

          (profiles || []).forEach((p) => {
            if (p.user_id && p.name) nameMap[p.user_id] = p.name;
          });
        }
      }

      return (data || []).map((r) => ({
        ...r,
        employee_name: nameMap[r.user_id] || 'Ismeretlen',
      })) as LeaveRequest[];
    },
    enabled: !!user && !!companyId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['leave-requests', companyId] });
  };

  const createMutation = useMutation({
    mutationFn: async (req: {
      leave_type: LeaveType;
      start_date: string;
      end_date: string;
      note?: string;
    }) => {
      if (!user || !companyId) throw new Error('No user/company');
      const { error } = await supabase.from('leave_requests').insert({
        company_id: companyId,
        user_id: user.id,
        leave_type: req.leave_type,
        start_date: req.start_date,
        end_date: req.end_date,
        note: req.note || null,
        status: 'pending',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Beküldve', description: 'Távolléti kérelem beküldve.' });
      invalidate();
    },
    onError: (err: Error) => {
      toast({
        variant: 'destructive',
        title: 'Hiba',
        description: err.message || 'Nem sikerült beküldeni.',
      });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      admin_note,
    }: {
      id: string;
      status: 'approved' | 'rejected';
      admin_note?: string;
    }) => {
      const { error } = await supabase
        .from('leave_requests')
        .update({
          status,
          admin_note: admin_note || null,
          reviewed_by: user!.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast({
        title: vars.status === 'approved' ? 'Jóváhagyva' : 'Elutasítva',
        description: `Távolléti kérelem ${vars.status === 'approved' ? 'jóváhagyva' : 'elutasítva'}.`,
      });
      invalidate();
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: 'Hiba',
        description: 'Nem sikerült feldolgozni.',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('leave_requests')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Törölve', description: 'Kérelem törölve.' });
      invalidate();
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: 'Hiba',
        description: 'Nem sikerült törölni.',
      });
    },
  });

  // Helpers
  const myRequests = leaveRequests.filter((r) => r.user_id === user?.id);
  const pendingRequests = leaveRequests.filter((r) => r.status === 'pending');

  return {
    leaveRequests,
    myRequests,
    pendingRequests,
    isLoading,
    createMutation,
    reviewMutation,
    deleteMutation,
  };
}
