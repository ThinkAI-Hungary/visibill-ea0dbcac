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
 * ProtectedRoute — Synchronous per-route guard.
 *
 * By the time this renders, useAppReady() has already gated:
 *   - auth resolved
 *   - company resolved
 *   - role resolved
 *   - profile resolved
 *
 * So this component only does ONE job: synchronously block forbidden
 * routes based on the user's permissions (role + DB overrides).
 * Returns <Navigate/> BEFORE the lazy chunk is even requested → zero flash, zero leak.
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const location = useLocation();
  const { user } = useAuth();
  const { isEmployee } = useUserRole();
  const { canAccess } = useEaisybillPermissions();
  const { selectedCompany } = useCompany();
  const { dateFromFormatted, dateToFormatted } = useDateRange();

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

  // Block rendering until we know the role — prevents sidebar flash for management users.
  // If the query is cached (e.g., from useAppReady), isPending is false instantly.
  if (user && profilePending) {
    return null;
  }

  // Management users → redirect to /management from ANY route (prevents accounty sidebar flash)
  const profileRole = profileData?.role;
  if ((profileRole === 'management' || profileRole === 'thinkai') && location.pathname !== '/management') {
    return <Navigate to="/management" replace />;
  }

  const currentPage = extractPageSegment(location.pathname);
  const pageModule = URL_TO_MODULE[currentPage];

  // If the page has a mapped module and the user can't access it → redirect
  if (pageModule && !canAccess(pageModule) && selectedCompany) {
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
