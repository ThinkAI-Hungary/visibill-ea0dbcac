import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';

export type UserRole = 'owner' | 'admin' | 'member' | 'viewer' | 'employee' | null;

/**
 * Returns the current user's role in the selected company.
 * - owner/admin: full access (all modules, settings, member management)
 * - member: read all financial data, CRUD own time_entries, no settings
 * - viewer: read-only access to financial data, no mutations
 * - employee: only own time_entries, limited UI
 *
 * Safe to use in any component inside CompanyProvider.
 * Returns non-employee defaults while data is loading.
 */
export function useUserRole(): {
  role: UserRole;
  isLoading: boolean;
  isAdmin: boolean;
  isMember: boolean;
  isViewer: boolean;
  isEmployee: boolean;
} {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();

  const companyId = selectedCompany?.id;

  const { data: role = null, isPending } = useQuery({
    queryKey: ['user-role', user?.id, companyId],
    queryFn: async (): Promise<UserRole> => {
      const { data, error } = await supabase
        .from('company_members')
        .select('role')
        .eq('company_id', companyId!)
        .eq('user_id', user!.id)
        .maybeSingle();

      if (!error && data) return data.role as UserRole;

      // Fallback: check if user is an accountant assigned to this company in accounty_assignments
      const { data: assignData, error: assignError } = await supabase
        .from('accounty_assignments')
        .select('role')
        .eq('company_id', companyId!)
        .eq('accountant_user_id', user!.id)
        .maybeSingle();

      if (!assignError && assignData) {
        return 'member';
      }

      return null;
    },
    enabled: !!user && !!companyId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Resolved role: null until query completes (isPending blocks rendering via ProtectedLayout)
  // This prevents blank pages during initial load
  const resolvedRole = !companyId ? null : role;

  return {
    role: resolvedRole,
    isLoading: isPending && !!companyId,
    isAdmin: resolvedRole === 'owner' || resolvedRole === 'admin' || !companyId,
    isMember: resolvedRole === 'member',
    isViewer: resolvedRole === 'viewer',
    isEmployee: !!companyId && resolvedRole === 'employee',
  };
}
