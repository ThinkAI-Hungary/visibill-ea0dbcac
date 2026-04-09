import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';

export type UserRole = 'owner' | 'admin' | 'member' | 'employee' | null;

/**
 * Returns the current user's role in the selected company.
 * - owner/admin: full access
 * - member: read all, CRUD own time_entries
 * - employee: only own time_entries, limited UI
 *
 * Safe to use in any component inside CompanyProvider.
 * Returns non-employee defaults while data is loading.
 */
export function useUserRole(): {
  role: UserRole;
  isLoading: boolean;
  isAdmin: boolean;
  isEmployee: boolean;
} {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();

  const companyId = selectedCompany?.id;

  const { data: role = null, isLoading } = useQuery({
    queryKey: ['user-role', user?.id, companyId],
    queryFn: async (): Promise<UserRole> => {
      const { data, error } = await supabase
        .from('company_members')
        .select('role')
        .eq('company_id', companyId!)
        .eq('user_id', user!.id)
        .maybeSingle();

      if (error || !data) return null;
      return data.role as UserRole;
    },
    enabled: !!user && !!companyId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // While loading or no company selected, default to non-employee (safe: shows everything)
  // This prevents blank pages during initial load
  const resolvedRole = !companyId ? null : role;

  return {
    role: resolvedRole,
    isLoading: isLoading && !!companyId,
    isAdmin: resolvedRole === 'owner' || resolvedRole === 'admin' || !companyId,
    isEmployee: !!companyId && resolvedRole === 'employee',
  };
}

