import React, { createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';

import { normalizeAccountyRole, type AccountyRole } from '@/lib/permissions/capabilities';

export type { AccountyRole };

interface AccountyRoleContextType {
  role: AccountyRole;
  isLoading: boolean;
  isAdmin: boolean;
  /** iroda_admin or senior_könyvelő */
  isSenior: boolean;
}

const AccountyRoleContext = createContext<AccountyRoleContextType | undefined>(undefined);

export function useAccountyRole() {
  const ctx = useContext(AccountyRoleContext);
  if (!ctx) throw new Error('useAccountyRole must be used within AccountyRoleProvider');
  return ctx;
}

/**
 * Reads the user's Accounty role from the DB (accounty_assignments table).
 * The highest-privilege role across all assignments is used:
 *   iroda_admin > senior_könyvelő > könyvelő > asszisztens > payroll_specialist
 *   (payroll_specialist has the narrowest default access, so it ranks lowest)
 *
 * Support admin and platform management users always receive full iroda_admin access.
 */
export function AccountyRoleProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { role: companyRole } = useUserRole();

  const isSupportAdmin = companyRole === 'support_admin';

  const { data: role = 'könyvelő' as AccountyRole, isPending } = useQuery({
    queryKey: queryKeys.accountyRole(user?.id || ''),
    queryFn: async (): Promise<AccountyRole> => {
      // Check platform management / thinkai profile role first
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, is_support_admin')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (profile?.is_support_admin || profile?.role === 'thinkai' || profile?.role === 'management') {
        return 'iroda_admin';
      }

      const { data, error } = await supabase
        .from('accounty_assignments')
        .select('role')
        .eq('accountant_user_id', user!.id);

      if (error || !data || data.length === 0) return 'könyvelő';

      // Role priority: pick the highest privilege
      const ROLE_PRIORITY: Record<AccountyRole, number> = {
        'iroda_admin': 5,
        'senior_könyvelő': 4,
        'könyvelő': 3,
        'asszisztens': 2,
        'payroll_specialist': 1,
      };

      // Normalize legacy values (senior/admin → iroda_admin, junior → könyvelő); unknown values are ignored
      const roles = (data as { role: string }[])
        .map((d) => normalizeAccountyRole(d.role))
        .filter((r): r is AccountyRole => r !== null);
      if (roles.length === 0) return 'könyvelő';

      return roles.reduce((best, current) =>
        ROLE_PRIORITY[current] > ROLE_PRIORITY[best] ? current : best,
      roles[0]);
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const effectiveRole = isSupportAdmin ? 'iroda_admin' : role;
  const isAdmin = effectiveRole === 'iroda_admin';
  const isSenior = effectiveRole === 'iroda_admin' || effectiveRole === 'senior_könyvelő';

  return (
    <AccountyRoleContext.Provider value={{ role: effectiveRole, isLoading: isPending, isAdmin, isSenior }}>
      {children}
    </AccountyRoleContext.Provider>
  );
}
