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
      const { count } = await supabase
        .from('company_members')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user!.id);
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
