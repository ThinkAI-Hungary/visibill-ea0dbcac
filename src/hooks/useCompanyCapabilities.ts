import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import {
  resolveCapabilities,
  type CompanyCapabilities,
} from '@/lib/permissions/capabilities';

/**
 * Central capability hook (D-2) — replaces scattered `role === 'admin'` checks.
 *
 * Capabilities are derived from the user's role in the selected company:
 *  - real `company_members` row → eaisyBill matrix (`member` is shown as Pénzügyi Vezető)
 *  - assignment-only external accountant → eaisyBooks matrix (close / XML export: senior + iroda_admin)
 *  - O1 fallback: if no accountant is assigned, company leadership (owner/admin/member) acts as bookkeeper.
 *    If an accountant is assigned, ledger write and closing are delegated to the accountant.
 */
export function useCompanyCapabilities(): CompanyCapabilities & {
  isLoading: boolean;
  hasAssignedBookkeeper: boolean;
} {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const { role, assignmentRole, isAssignmentOnly, isLoading: roleLoading } = useUserRole();

  const { data: hasAssignedBookkeeper = false, isLoading: bkLoading } = useQuery({
    queryKey: ['company-has-assigned-bookkeeper', companyId],
    queryFn: async (): Promise<boolean> => {
      if (!companyId) return false;
      const { data, error } = await supabase.rpc('company_has_assigned_bookkeeper', {
        p_company_id: companyId,
      });
      if (error) {
        // Fallback: check accounty_assignments table directly
        const { count } = await supabase
          .from('accounty_assignments')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .in('role', ['iroda_admin', 'senior_könyvelő', 'könyvelő', 'asszisztens']);
        return (count ?? 0) > 0;
      }
      return !!data;
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  const capabilities = useMemo(
    () =>
      resolveCapabilities({
        memberRole: isAssignmentOnly ? null : role,
        assignmentRole,
        hasAssignedBookkeeper,
      }),
    [role, assignmentRole, isAssignmentOnly, hasAssignedBookkeeper],
  );

  return { ...capabilities, hasAssignedBookkeeper, isLoading: roleLoading || bkLoading };
}
