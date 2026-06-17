import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAccountyRole, AccountyRole } from './AccountyRoleContext';

interface ProtectedAccountyRouteProps {
  children: React.ReactNode;
  /**
   * Minimum role(s) required to access this route.
   * If multiple roles are provided, ANY of them grants access.
   * Example: requiredRoles={['iroda_admin']} — only iroda_admin can access.
   * Example: requiredRoles={['iroda_admin', 'senior_könyvelő']} — both can access.
   */
  requiredRoles?: AccountyRole[];
  /** Where to redirect if the user doesn't have the required role. Defaults to '/accounty'. */
  redirectTo?: string;
  /** If true, show nothing instead of redirecting (useful for conditional UI blocks). */
  hideOnly?: boolean;
}

/**
 * ProtectedAccountyRoute — guards Accounty routes based on the user's
 * role from accounty_assignments (via AccountyRoleContext).
 *
 * Usage in routes:
 *   <Route path="admin/audit" element={
 *     <ProtectedAccountyRoute requiredRoles={['iroda_admin']}>
 *       <AuditLogPage />
 *     </ProtectedAccountyRoute>
 *   } />
 *
 * Usage for inline conditional blocks:
 *   <ProtectedAccountyRoute requiredRoles={['iroda_admin']} hideOnly>
 *     <AdminPanel />
 *   </ProtectedAccountyRoute>
 */
export function ProtectedAccountyRoute({
  children,
  requiredRoles,
  redirectTo = '/accounty',
  hideOnly = false,
}: ProtectedAccountyRouteProps) {
  const { role, isLoading } = useAccountyRole();

  // While loading, show nothing (prevents flash of redirect)
  if (isLoading) return null;

  // If no specific roles required, allow access
  if (!requiredRoles || requiredRoles.length === 0) {
    return <>{children}</>;
  }

  // Check if the user's role is in the allowed list
  const hasAccess = requiredRoles.includes(role);

  if (!hasAccess) {
    if (hideOnly) return null;
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}

/**
 * Helper: checks if a role has at least the given minimum privilege level.
 * iroda_admin > senior_könyvelő > könyvelő > asszisztens
 */
const ROLE_HIERARCHY: Record<AccountyRole, number> = {
  'iroda_admin': 4,
  'senior_könyvelő': 3,
  'könyvelő': 2,
  'asszisztens': 1,
};

export function hasMinimumRole(userRole: AccountyRole, minimumRole: AccountyRole): boolean {
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[minimumRole] ?? 0);
}
