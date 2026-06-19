import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

/**
 * Checks whether the current user has eaisybill access
 * (i.e., at least one row in `company_members`).
 *
 * Used in:
 *  - Auth.tsx (post-login routing)
 *  - AccountyLayout.tsx (show/hide eaisybill link)
 *  - AppSidebar.tsx (show/hide eaisybooks link)
 *  - App.tsx / RootRedirect (redirect to /accounty)
 *
 * Returns { hasAccess: boolean | undefined, isLoading: boolean }
 */
export function useHasEaisybillAccess() {
  const { user } = useAuth();

  const { data: hasAccess, isPending } = useQuery({
    queryKey: ['has-eaisybill-access', user?.id],
    queryFn: async () => {
      // First check if admin has disabled eaisybill access for this user
      const { data: profile } = await supabase
        .from('profiles')
        .select('eaisybill_access')
        .eq('user_id', user!.id)
        .single();
      if (profile && profile.eaisybill_access === false) return false;

      // Check company_members
      const { count: memberCount } = await supabase
        .from('company_members')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user!.id);
      if ((memberCount ?? 0) > 0) return true;

      // Also check accounty_assignments (accountants have eaisybill access to assigned companies)
      const { count: assignmentCount } = await supabase
        .from('accounty_assignments' as any)
        .select('id', { count: 'exact', head: true })
        .eq('accountant_user_id', user!.id);
      return (assignmentCount ?? 0) > 0;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  return {
    hasAccess,
    isLoading: isPending && !!user,
  };
}

/**
 * Checks whether the current user has eaisybooks (Accounty) access
 * (i.e., at least one row in `accounty_assignments`).
 *
 * Used in AppSidebar.tsx to conditionally show the eaisybooks link.
 */
export function useHasAccountyAccess() {
  const { user } = useAuth();

  const { data: hasAccess, isPending } = useQuery({
    queryKey: ['has-accounty-access', user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from('accounty_assignments' as any)
        .select('id', { count: 'exact', head: true })
        .eq('accountant_user_id', user!.id);
      return (count ?? 0) > 0;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  return {
    hasAccess,
    isLoading: isPending && !!user,
  };
}
