import { Navigate, useLocation } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { extractPageSegment, generateScopedPath } from '@/lib/navigation';
import { useCompany } from '@/contexts/CompanyContext';
import { useDateRange } from '@/contexts/DateRangeContext';

/** Page segments that employee-role users are allowed to visit */
const EMPLOYEE_ALLOWED_PAGES = ['/working-time'];

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
 * routes for employees (return <Navigate/> BEFORE the lazy chunk is
 * even requested → zero flash, zero leak).
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const location = useLocation();
  const { isEmployee } = useUserRole();
  const { selectedCompany } = useCompany();
  const { dateFromFormatted, dateToFormatted } = useDateRange();

  if (isEmployee) {
    const currentPage = extractPageSegment(location.pathname);
    const isAllowed = EMPLOYEE_ALLOWED_PAGES.some(
      (page) => currentPage === page || currentPage.startsWith(page + '/'),
    );
    if (!isAllowed && selectedCompany) {
      const target = generateScopedPath(
        selectedCompany.id,
        dateFromFormatted,
        dateToFormatted,
        'working-time',
      );
      return <Navigate to={target} replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
