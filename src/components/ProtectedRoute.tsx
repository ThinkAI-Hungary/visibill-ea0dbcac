import { Navigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useUserRole } from '@/hooks/useUserRole';
import { useEaisybillPermissions, URL_TO_MODULE } from '@/hooks/useEaisybillPermissions';
import { extractPageSegment, generateScopedPath } from '@/lib/navigation';
import { useCompany } from '@/contexts/CompanyContext';
import { useDateRange } from '@/contexts/DateRangeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * ProtectedRoute — Per-route permission guard.
 *
 * By the time this renders, useAppReady() has already gated:
 *   - auth resolved
 *   - company resolved
 *   - role resolved
 *   - profile resolved
 *
 * This component blocks forbidden routes based on the user's permissions
 * (role + DB overrides from eaisybill_module_permissions).
 *
 * RULES OF HOOKS: ALL hooks must be called at the top level,
 * before any conditional early returns.
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const location = useLocation();
  const { user } = useAuth();
  const { isEmployee } = useUserRole();
  const { selectedCompany } = useCompany();
  const { dateFromFormatted, dateToFormatted } = useDateRange();

  // ALL hooks at top-level — no hook may appear after a conditional early return
  const { canAccess, isLoading: permissionsLoading } = useEaisybillPermissions();

  // Management/ThinkAI role check — reuses the same cached query as useAppReady
  const { data: profileData, isPending: profilePending } = useQuery({
    queryKey: ['profile-check', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('name, email_verified, role')
        .eq('user_id', user!.id)
        .single();
      if (error) return { status: 'error' as const, role: null };
      return { status: 'complete' as const, role: data?.role || null };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Check if this management user has an active impersonation session
  const { data: hasImpersonation } = useQuery({
    queryKey: ['active-impersonation-check', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('company_members')
        .select('id')
        .eq('user_id', user!.id)
        .eq('role', 'support_admin' as any)
        .limit(1)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user && (profileData?.role === 'management' || profileData?.role === 'thinkai'),
    staleTime: 10_000,
  });

  // ── Early returns (after all hooks) ──

  // Block rendering until we know the profile role.
  // If the query is cached (e.g. from useAppReady), isPending is false instantly.
  if (user && profilePending) {
    return null;
  }

  // Management users → redirect to /management from ANY route
  // BUT: skip redirect if the user has an active impersonation session
  const profileRole = profileData?.role;
  if ((profileRole === 'management' || profileRole === 'thinkai') && !hasImpersonation && location.pathname !== '/management') {
    return <Navigate to="/management" replace />;
  }

  const currentPage = extractPageSegment(location.pathname);
  const pageModule = URL_TO_MODULE[currentPage];

  // Module permission guard.
  // IMPORTANT: wait for permissionsLoading=false before redirecting.
  // DB overrides (e.g. shipment_matching) are fetched async. On page refresh:
  //   - selectedCompany may be restored from localStorage immediately
  //   - BUT the DB query for module permissions hasn't run yet
  //   - canAccess() returns false by default for shipment modules
  //   → without this check, the user would be kicked to dashboard on every refresh.
  if (!permissionsLoading && pageModule && !canAccess(pageModule) && selectedCompany) {
    const fallbackPage = isEmployee ? 'working-time' : '';
    const target = generateScopedPath(
      selectedCompany.id,
      dateFromFormatted,
      dateToFormatted,
      fallbackPage,
    );
    return <Navigate to={target} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
