import { Navigate, useLocation } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { useEaisybillPermissions, URL_TO_MODULE } from '@/hooks/useEaisybillPermissions';
import { extractPageSegment, generateScopedPath } from '@/lib/navigation';
import { useCompany } from '@/contexts/CompanyContext';
import { useDateRange } from '@/contexts/DateRangeContext';

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
  const { isEmployee } = useUserRole();
  const { canAccess } = useEaisybillPermissions();
  const { selectedCompany } = useCompany();
  const { dateFromFormatted, dateToFormatted } = useDateRange();

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
