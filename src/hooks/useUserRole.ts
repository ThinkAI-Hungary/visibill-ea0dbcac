import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { normalizeAccountyRole } from '@/lib/permissions/capabilities';

export type UserRole =
  | 'owner'
  | 'admin'
  | 'member'
  | 'assistant'
  | 'viewer'
  | 'employee'
  | 'support_admin'
  | 'payroll_specialist'
  | null;

interface ResolvedUserRole {
  /** Effective eaisyBill role (DB value; `member` is presented as Pénzügyi Vezető / finance_lead). */
  role: UserRole;
  /** eaisyBooks assignment role when the user reaches this company through `accounty_assignments`. */
  assignmentRole: string | null;
  /** True when there is NO `company_members` row and the role was derived from an assignment. */
  assignmentOnly: boolean;
}

/**
 * Returns the current user's role in the selected company.
 * - owner: full access (+ subscription / ownership)
 * - admin (Cégvezető): all operational modules, member management; no accounting-technical views
 * - member (Pénzügyi Vezető / finance_lead — hybrid alias, DB value stays `member`):
 *   financial controlling read-only, no settings/team management
 * - assistant (Pénzügyi Asszisztens): invoices, transactions, receivables, projects R/W —
 *   no salaries/HR/accounting books, no bank balances on the dashboard
 * - viewer (Megfigyelő): read-only access to financial data, no mutations
 * - employee: only own time_entries, limited UI
 * - payroll_specialist: assignment-derived (eaisyBooks Bérszámfejtő); no financial modules in eaisyBill
 *
 * Safe to use in any component inside CompanyProvider.
 * Returns non-employee defaults while data is loading.
 */
export function useUserRole(): {
  role: UserRole;
  isLoading: boolean;
  isAdmin: boolean;
  isMember: boolean;
  isAssistant: boolean;
  isViewer: boolean;
  isEmployee: boolean;
  /** eaisyBooks assignment role (canonical) when the company is reached via accounty_assignments. */
  assignmentRole: string | null;
  /** True when the role was derived ONLY from an accounty assignment (no company_members row). */
  isAssignmentOnly: boolean;
} {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();

  const companyId = selectedCompany?.id;

  const { data: resolved, isPending } = useQuery({
    queryKey: ['user-role', user?.id, companyId],
    queryFn: async (): Promise<ResolvedUserRole> => {
      const { data, error } = await supabase
        .from('company_members')
        .select('role')
        .eq('company_id', companyId!)
        .eq('user_id', user!.id)
        .maybeSingle();

      if (!error && data) {
        return { role: data.role as UserRole, assignmentRole: null, assignmentOnly: false };
      }

      // Fallback: check if user is an accountant assigned to this company in accounty_assignments
      const { data: assignData, error: assignError } = await supabase
        .from('accounty_assignments')
        .select('role')
        .eq('company_id', companyId!)
        .eq('accountant_user_id', user!.id)
        .maybeSingle();

      if (!assignError && assignData) {
        const assignmentRole = normalizeAccountyRole(assignData.role) ?? assignData.role;
        // payroll_specialist must NOT inherit the broad `member` view of the client's books (D-5)
        return {
          role: assignmentRole === 'payroll_specialist' ? 'payroll_specialist' : 'member',
          assignmentRole,
          assignmentOnly: true,
        };
      }

      return { role: null, assignmentRole: null, assignmentOnly: false };
    },
    enabled: !!user && !!companyId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Resolved role: null until query completes (isPending blocks rendering via ProtectedLayout)
  // This prevents blank pages during initial load
  const resolvedRole: UserRole = !companyId ? null : (resolved?.role ?? null);

  return {
    role: resolvedRole,
    isLoading: isPending && !!companyId,
    isAdmin: resolvedRole === 'owner' || resolvedRole === 'admin' || resolvedRole === 'support_admin' || !companyId,
    isMember: resolvedRole === 'member',
    isAssistant: resolvedRole === 'assistant',
    isViewer: resolvedRole === 'viewer',
    isEmployee: !!companyId && resolvedRole === 'employee',
    assignmentRole: companyId ? (resolved?.assignmentRole ?? null) : null,
    isAssignmentOnly: companyId ? (resolved?.assignmentOnly ?? false) : false,
  };
}
