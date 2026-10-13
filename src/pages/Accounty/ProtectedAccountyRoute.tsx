import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAccountyRole, AccountyRole } from './AccountyRoleContext';
import { useHasAccountyAccess } from '@/hooks/useHasEaisybillAccess';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAccountyPermissions, type AccountyModule } from '@/hooks/useAccountyPermissions';

interface ProtectedAccountyRouteProps {
  children: React.ReactNode;
  /**
   * Minimum role(s) required to access this route.
   * If multiple roles are provided, ANY of them grants access.
   * Example: requiredRoles={['iroda_admin']} — only iroda_admin can access.
   * Example: requiredRoles={['iroda_admin', 'senior_könyvelő']} — both can access.
   */
  requiredRoles?: AccountyRole[];
  /**
   * Permission-matrix module required to access this route. Evaluated with
   * `useAccountyPermissions().canAccess` — i.e. role defaults AND per-user DB
   * overrides (so a configured Bérszámfejtő / Asszisztens is honoured).
   * Can be combined with `requiredRoles` (both must pass).
   */
  requiredModule?: AccountyModule;
  /** Where to redirect if the user doesn't have the required role. Defaults to '/eaisybooks'. */
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
  requiredModule,
  redirectTo = '/eaisybooks',
  hideOnly = false,
}: ProtectedAccountyRouteProps) {
  const { role, isLoading } = useAccountyRole();
  const { canAccess, isLoading: permissionsLoading } = useAccountyPermissions();

  // While loading, show nothing (prevents flash of redirect)
  if (isLoading || (requiredModule && permissionsLoading)) return null;

  const roleAllowed = !requiredRoles || requiredRoles.length === 0 || requiredRoles.includes(role);
  const moduleAllowed = !requiredModule || canAccess(requiredModule);

  if (!roleAllowed || !moduleAllowed) {
    if (hideOnly) return null;
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}

/**
 * AccountyModuleLayout — pathless layout route that module-gates a whole group
 * of child routes (role defaults + per-user DB overrides, see `requiredModule`).
 *
 *   <Route element={<AccountyModuleLayout module="payroll" />}>
 *     <Route path="payroll" ... />
 *   </Route>
 */
export function AccountyModuleLayout({
  module,
  redirectTo,
}: {
  module: AccountyModule;
  redirectTo?: string;
}) {
  return (
    <ProtectedAccountyRoute requiredModule={module} redirectTo={redirectTo}>
      <Outlet />
    </ProtectedAccountyRoute>
  );
}

/**
 * Helper: checks if a role has at least the given minimum privilege level.
 * iroda_admin > senior_könyvelő > könyvelő > asszisztens.
 * payroll_specialist is a parallel, narrowest-scope role and ranks below asszisztens.
 */
const ROLE_HIERARCHY: Record<AccountyRole, number> = {
  'iroda_admin': 4,
  'senior_könyvelő': 3,
  'könyvelő': 2,
  'asszisztens': 1,
  'payroll_specialist': 0.5,
};

export function hasMinimumRole(userRole: AccountyRole, minimumRole: AccountyRole): boolean {
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[minimumRole] ?? 0);
}

interface AccountyAccessGuardProps {
  children: React.ReactNode;
  fallbackTo?: string;
}

/**
 * AccountyAccessGuard — module-level route guard for all eaisyBooks routes.
 * If the user does not have permission to access the eaisyBooks module (neither profile flag,
 * accounty assignments, nor platform management role), they are automatically redirected
 * to fallbackTo (defaulting to eaisyBill '/' or '/hr').
 */
export function AccountyAccessGuard({
  children,
  fallbackTo = '/',
}: AccountyAccessGuardProps) {
  const { hasAccess, isLoading } = useHasAccountyAccess();

  // While checking, render nothing or spinner (prevents flash of redirect or eaisybooks UI)
  if (isLoading) {
    return <LoadingSpinner message="" />;
  }

  // If user has no eaisybooks access, redirect them to eaisyBill
  if (hasAccess === false) {
    return <Navigate to={fallbackTo} replace />;
  }

  return <>{children}</>;
}

