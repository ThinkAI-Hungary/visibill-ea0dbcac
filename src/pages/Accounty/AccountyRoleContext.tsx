import React, { createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';

export type AccountyRole = 'iroda_admin' | 'senior_könyvelő' | 'könyvelő' | 'asszisztens';

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
 *   iroda_admin > senior_könyvelő > könyvelő > asszisztens
 *
 * Backwards-compatible: the old 'admin' | 'könyvelő' type is mapped to the new roles.
 */
export function AccountyRoleProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const { data: role = 'könyvelő' as AccountyRole, isPending } = useQuery({
    queryKey: queryKeys.accountyRole(user?.id || ''),
    queryFn: async (): Promise<AccountyRole> => {
      const { data, error } = await supabase
        .from('accounty_assignments')
        .select('role')
        .eq('accountant_user_id', user!.id);

      if (error || !data || data.length === 0) return 'könyvelő';

      // Role priority: pick the highest privilege
      const ROLE_PRIORITY: Record<string, number> = {
        'iroda_admin': 4,
        'senior_könyvelő': 3,
        'könyvelő': 2,
        'asszisztens': 1,
        // Legacy mappings (in case the migration hasn't run yet)
        'senior': 4,
        'admin': 4,
        'junior': 2,
      };

      const roles = (data as any[]).map((d: any) => d.role as string);
      const bestRole = roles.reduce((best, current) => {
        const bestPrio = ROLE_PRIORITY[best] ?? 0;
        const currentPrio = ROLE_PRIORITY[current] ?? 0;
        return currentPrio > bestPrio ? current : best;
      }, roles[0]);

      // Map legacy values
      if (bestRole === 'senior' || bestRole === 'admin') return 'iroda_admin';
      if (bestRole === 'junior') return 'könyvelő';

      return bestRole as AccountyRole;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const isAdmin = role === 'iroda_admin';
  const isSenior = role === 'iroda_admin' || role === 'senior_könyvelő';

  return (
    <AccountyRoleContext.Provider value={{ role, isLoading: isPending, isAdmin, isSenior }}>
      {children}
    </AccountyRoleContext.Provider>
  );
}
