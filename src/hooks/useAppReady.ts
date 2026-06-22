import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';

export type RedirectTarget = 'auth' | 'unverified' | 'onboarding' | 'management' | 'working-time' | null;

/**
 * useAppReady — Single source of truth for app readiness.
 *
 * Combines auth, company, role, AND profile resolution into one gate.
 * Until `isReady === true`, the ProtectedLayout renders NOTHING —
 * the index.html CSS loader covers everything.
 *
 * Also exposes `redirectTarget` so ProtectedLayout can synchronously
 * <Navigate/> instead of mounting routes that will then redirect.
 */
export function useAppReady() {
  const { user, loading: authLoading } = useAuth();
  const { selectedCompany, companies, isInitialLoading: companyLoading } = useCompany();
  const { role, isLoading: roleLoading, isEmployee } = useUserRole();

  // Profile check — owned by useAppReady (single root gate, no duplication in ProtectedRoute).
  const { data: profileData, isPending: profilePending } = useQuery({
    queryKey: ['profile-check', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('name, email_verified, role')
        .eq('user_id', user!.id)
        .single();

      if (error && (error as any).code === 'PGRST116') return { status: 'no-profile' as const, role: null };
      if (error) throw error;
      if (!data?.name) return { status: 'incomplete' as const, role: data?.role || null };
      // [DISABLED] Email verification check — kept for future re-enablement
      // if (data?.email_verified === false) return { status: 'unverified' as const, role: data?.role || null };
      return { status: 'complete' as const, role: data?.role || null };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const profileStatus = profileData?.status;
  const profileRole = profileData?.role;

  // Auth still loading → not ready.
  if (authLoading) {
    return { isReady: false, user: null, redirectTarget: null as RedirectTarget };
  }

  // Not logged in → ready (so ProtectedLayout can redirect to /auth).
  if (!user) {
    return { isReady: true, user: null, redirectTarget: 'auth' as RedirectTarget };
  }

  // Wait for company AND profile resolution.
  if (companyLoading || profilePending) {
    return { isReady: false, user, redirectTarget: null as RedirectTarget };
  }

  // Management/ThinkAI role → redirect to /management immediately, before any layout renders.
  if (profileRole === 'management' || profileRole === 'thinkai') {
    return { isReady: true, user, redirectTarget: 'management' as RedirectTarget };
  }

  // [DISABLED] Email not verified redirect — kept for future re-enablement
  // if (profileStatus === 'unverified') {
  //   return { isReady: true, user, redirectTarget: 'unverified' as RedirectTarget };
  // }

  // Profile incomplete → onboarding.
  if (profileStatus === 'no-profile' || profileStatus === 'incomplete') {
    return { isReady: true, user, redirectTarget: 'onboarding' as RedirectTarget };
  }

  // User has companies → wait until a concrete selected company exists.
  // This prevents the shell from rendering one frame in a "no company"
  // state before CompanyContext restores/syncs the active company.
  if (companies.length > 0 && !selectedCompany) {
    return { isReady: false, user, redirectTarget: null as RedirectTarget };
  }

  // User has companies → wait for role to resolve too.
  if (companies.length > 0 && roleLoading) {
    return { isReady: false, user, redirectTarget: null as RedirectTarget };
  }

  // Employee role + has company → only working-time is allowed.
  // Redirect responsibility stays at ProtectedRoute level (per-route check).
  // We expose the role here only for awareness; routing decision is per-page.

  return { isReady: true, user, redirectTarget: null as RedirectTarget };
}

