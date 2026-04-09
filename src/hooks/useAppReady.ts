import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useUserRole } from '@/hooks/useUserRole';

/**
 * useAppReady — Full-Stop Loading Guard.
 *
 * Combines auth, company, and role loading into a single boolean.
 * Until `isReady === true`, React should render NOTHING —
 * the index.html CSS loader covers everything.
 *
 * The sequence is:
 *   1. Auth: Supabase session restore
 *   2. Company: fetch user's companies + restore selectedCompany
 *   3. Role: fetch user's role in selectedCompany
 *
 * Only when ALL three are done does `isReady` become true.
 * If the user is not logged in, `isReady` becomes true immediately
 * (so we can redirect to /auth without delay).
 */
export function useAppReady() {
  const { user, loading: authLoading } = useAuth();
  const { isInitialLoading: companyLoading } = useCompany();
  const { isLoading: roleLoading } = useUserRole();

  // Auth is still loading → not ready
  if (authLoading) {
    return { isReady: false, user: null, selectedCompany: null };
  }

  // User is not logged in → ready (so ProtectedLayout can redirect)
  if (!user) {
    return { isReady: true, user: null, selectedCompany: null };
  }

  // User exists but company initial load or role still loading → not ready
  if (companyLoading || roleLoading) {
    return { isReady: false, user, selectedCompany: null };
  }

  // Everything resolved
  return { isReady: true, user, selectedCompany: null };
}
