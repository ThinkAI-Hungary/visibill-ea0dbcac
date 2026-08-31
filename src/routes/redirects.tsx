import React, { Suspense, lazy, useEffect } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useDateRange } from "@/contexts/DateRangeContext";
import { useHasEaisybillAccess } from "@/hooks/useHasEaisybillAccess";
import { supabase } from "@/integrations/supabase/client";
import { generateScopedPath } from "@/lib/navigation";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

const Index = lazy(() => import("@/pages/Index"));
const AccountyApp = lazy(() => import("@/pages/Accounty/AccountyApp"));

/**
 * RootRedirect — sends `/` to `/:companyId/:dateRange/` (scoped dashboard).
 * Uses the currently selected company and date range from context.
 */
export function RootRedirect() {
  const { selectedCompany, companies, setSelectedCompany, isInitialLoading } = useCompany();
  const { dateFromFormatted, dateToFormatted } = useDateRange();
  const { user } = useAuth();

  // Check if management user → redirect to /management
  const { data: profileRole, isLoading: roleLoading } = useQuery({
    queryKey: ['profile-role-check', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user!.id)
        .single();
      return data?.role || 'user';
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  // Check if they have eaisybill access
  const { hasAccess: hasEaisybillAccess, isLoading: accessLoading } = useHasEaisybillAccess();

  // Check for active impersonation (support_admin) before management redirect
  // NOTE: Hook must be before any conditional returns (Rules of Hooks)
  const { data: hasImpersonation, isPending: impLoading } = useQuery({
    queryKey: ['has-impersonation-root', user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from('company_members')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('role', 'support_admin' as any);
      return (count ?? 0) > 0;
    },
    enabled: !!user && (profileRole === 'management' || profileRole === 'thinkai'),
    staleTime: 30_000,
  });

  // True while we are still initializing
  const isInitializing = roleLoading || accessLoading || isInitialLoading;

  useEffect(() => {
    if (isInitializing || !selectedCompany) return;

    const switchPending = localStorage.getItem('visibill_switch_pending');
    if (switchPending === 'eaisybill') {
      localStorage.removeItem('visibill_switch_pending');
      const eaisybooksCompanyId = localStorage.getItem('eaisybooks_selected_company_id');
      const eaisybillCompanyId = localStorage.getItem('eaisybill_selected_company_id');

      if (eaisybooksCompanyId && eaisybooksCompanyId !== eaisybillCompanyId && companies.some(c => c.id === eaisybooksCompanyId)) {
        localStorage.setItem('eaisybill_selected_company_id', eaisybooksCompanyId);
        const targetCompany = companies.find(c => c.id === eaisybooksCompanyId);
        if (targetCompany && selectedCompany.id !== eaisybooksCompanyId) {
          setSelectedCompany(targetCompany);
        }
      }
    }
  }, [isInitializing, selectedCompany, companies, setSelectedCompany]);

  if (roleLoading || accessLoading) return <LoadingSpinner message="" />;

  // ThinkAI / management role → management dashboard (but NOT when impersonating)
  if (profileRole === 'management' || profileRole === 'thinkai') {
    if (impLoading) return <LoadingSpinner message="" />;
    if (!hasImpersonation) return <Navigate to="/management" replace />;
  }

  // Still loading companies — render nothing (initial-loader covers this)
  if (isInitialLoading) return null;

  // Determine the user's registration source from auth metadata
  const registrationSource = user?.user_metadata?.source as string | undefined;

  // No companies at all — decide based on registration source:
  // - eaisybooks users → /accounty (they don't need eaisybill onboarding)
  // - eaisybill users (or unknown) → show eaisybill onboarding wizard
  if (!isInitialLoading && companies.length === 0) {
    if (registrationSource === 'eaisybooks') {
      return <Navigate to="/eaisybooks" replace />;
    }
    return <Suspense fallback={<LoadingSpinner message="Betöltés..." />}><Index /></Suspense>;
  }

  if (hasEaisybillAccess === false) {
    return <Navigate to="/eaisybooks" replace />;
  }

  // Has companies but selectedCompany not yet resolved — wait
  if (!selectedCompany) return null;

  // Determine the active company to redirect to, prioritizing the eaisybooks choice if they have access to it in eaisybill
  const switchPending = localStorage.getItem('visibill_switch_pending');
  const eaisybooksCompanyId = localStorage.getItem('eaisybooks_selected_company_id');
  const eaisybillCompanyId = localStorage.getItem('eaisybill_selected_company_id');
  let activeCompany = selectedCompany;

  if (switchPending === 'eaisybill') {
    if (eaisybooksCompanyId && eaisybooksCompanyId !== eaisybillCompanyId && companies.some(c => c.id === eaisybooksCompanyId)) {
      const targetCompany = companies.find(c => c.id === eaisybooksCompanyId);
      if (targetCompany) {
        activeCompany = targetCompany;
      }
    } else if (eaisybillCompanyId && companies.some(c => c.id === eaisybillCompanyId)) {
      const targetCompany = companies.find(c => c.id === eaisybillCompanyId);
      if (targetCompany) {
        activeCompany = targetCompany;
      }
    }
  } else {
    // If not switching, default to the last viewed eaisybill company if valid
    if (eaisybillCompanyId && companies.some(c => c.id === eaisybillCompanyId)) {
      const targetCompany = companies.find(c => c.id === eaisybillCompanyId);
      if (targetCompany) {
        activeCompany = targetCompany;
      }
    }
  }

  const target = generateScopedPath(activeCompany.id, dateFromFormatted, dateToFormatted, '');
  return <Navigate to={target} replace />;
}

export function AccountyRootRedirect() {
  const { selectedCompany, eaisybooksCompanyIds, isInitialLoading } = useCompany();
  const { dateFromFormatted, dateToFormatted } = useDateRange();

  // Determine synchronously if we need to redirect
  const switchPending = localStorage.getItem('visibill_switch_pending');
  let redirectTarget: string | null = null;

  if (!isInitialLoading && eaisybooksCompanyIds && switchPending === 'eaisybooks') {
    const eaisybooksCompanyId = localStorage.getItem('eaisybooks_selected_company_id');
    const eaisybillCompanyId = localStorage.getItem('eaisybill_selected_company_id');

    if (eaisybillCompanyId && eaisybillCompanyId !== eaisybooksCompanyId && eaisybooksCompanyIds.includes(eaisybillCompanyId)) {
      redirectTarget = `/eaisybooks/${eaisybillCompanyId}/${dateFromFormatted}_${dateToFormatted}/overview`;
    } else if (eaisybooksCompanyId && eaisybooksCompanyIds.includes(eaisybooksCompanyId)) {
      redirectTarget = `/eaisybooks/${eaisybooksCompanyId}/${dateFromFormatted}_${dateToFormatted}/overview`;
    }
  }

  useEffect(() => {
    if (isInitialLoading || !eaisybooksCompanyIds) return;

    if (switchPending === 'eaisybooks') {
      localStorage.removeItem('visibill_switch_pending');
      const eaisybooksCompanyId = localStorage.getItem('eaisybooks_selected_company_id');
      const eaisybillCompanyId = localStorage.getItem('eaisybill_selected_company_id');

      if (eaisybillCompanyId && eaisybillCompanyId !== eaisybooksCompanyId && eaisybooksCompanyIds.includes(eaisybillCompanyId)) {
        localStorage.setItem('eaisybooks_selected_company_id', eaisybillCompanyId);
      }
    }
  }, [isInitialLoading, selectedCompany, eaisybooksCompanyIds, switchPending]);

  if (isInitialLoading) {
    return <LoadingSpinner message="Betöltés..." />;
  }

  if (redirectTarget) {
    return <Navigate to={redirectTarget} replace />;
  }

  return <Suspense fallback={<LoadingSpinner message="Betöltés..." />}><AccountyApp /></Suspense>;
}

/**
 * LegacyRedirect — redirects old flat paths (e.g. `/invoices`)
 * to scoped equivalents (`/:companyId/:dateRange/invoices`).
 */
export function LegacyRedirect({ page }: { page: string }) {
  const { selectedCompany } = useCompany();
  const { dateFromFormatted, dateToFormatted } = useDateRange();

  if (!selectedCompany) return null;
  const target = generateScopedPath(selectedCompany.id, dateFromFormatted, dateToFormatted, page);
  return <Navigate to={target} replace />;
}

export function PasswordRecoveryRedirect() {
  const { isPasswordRecovery, clearPasswordRecovery } = useAuth();
  const location = useLocation();

  const hashParams = new URLSearchParams(location.hash.startsWith("#") ? location.hash.slice(1) : location.hash);
  const hasRecoveryHash = hashParams.get("type") === "recovery" && (
    hashParams.has("access_token") ||
    hashParams.has("refresh_token") ||
    hashParams.has("token")
  );

  useEffect(() => {
    if (isPasswordRecovery && location.pathname === "/reset-password") {
      clearPasswordRecovery();
    }
  }, [isPasswordRecovery, clearPasswordRecovery, location.pathname]);

  if ((hasRecoveryHash || isPasswordRecovery) && location.pathname !== "/reset-password") {
    return (
      <Navigate
        replace
        to={{
          pathname: "/reset-password",
          hash: location.hash,
        }}
      />
    );
  }

  return null;
}

export function AccountyLegacyClientRedirect() {
  const params = useParams();
  const location = useLocation();
  const match = location.pathname.match(/\/client\/([^\/]+)/);
  const resolvedId = match ? match[1] : (params.id || '');
  const { dateFromFormatted, dateToFormatted } = useDateRange();
  const suffix = location.pathname.split(new RegExp(`/client/${resolvedId}`, 'i'))[1] || '';
  const page = suffix.startsWith('/') ? suffix.slice(1) : suffix;
  return <Navigate to={`/eaisybooks/${resolvedId}/${dateFromFormatted}_${dateToFormatted}/${page}${location.search}`} replace />;
}

export function PayrollLegacyRedirect() {
  const params = useParams();
  const location = useLocation();
  const match = location.pathname.match(/\/payroll\/([^\/]+)/);
  const resolvedId = match ? match[1] : (params.id || '');
  const { dateFromFormatted, dateToFormatted } = useDateRange();
  const suffix = location.pathname.split(new RegExp(`/payroll/${resolvedId}`, 'i'))[1] || '';
  const page = suffix.startsWith('/') ? suffix.slice(1) : suffix;
  return <Navigate to={`/eaisybooks/${resolvedId}/${dateFromFormatted}_${dateToFormatted}/payroll/${page}${location.search}`} replace />;
}

export function MissingInvoicesLegacyRedirect() {
  const params = useParams();
  const location = useLocation();
  const match = location.pathname.match(/\/missing-invoices\/([^\/]+)/);
  const resolvedId = match ? match[1] : (params.id || '');
  const { dateFromFormatted, dateToFormatted } = useDateRange();
  return <Navigate to={`/eaisybooks/${resolvedId}/${dateFromFormatted}_${dateToFormatted}/missing-invoices${location.search}`} replace />;
}
