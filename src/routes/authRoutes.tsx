import React, { Suspense, lazy } from "react";
import { Route } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ProtectedPage, RemoveInitialLoader } from "./shellComponents";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const Auth = lazy(() => import("@/pages/Auth"));
const AuthCallback = lazy(() => import("@/pages/AuthCallback"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const EmployeeRegister = lazy(() => import("@/pages/EmployeeRegister"));
const ClientPortalPage = lazy(() => import("@/pages/Accounty/ClientPortalPage"));
const ManagementDashboard = lazy(() => import("@/pages/ManagementDashboard"));
const NotFound = lazy(() => import("@/pages/NotFound"));

/**
 * ManagementRoute — Strict role-based guard for the /management path.
 * Renders NotFound (404) for any user whose profile role is not 'management' or 'thinkai'.
 */
export function ManagementRoute() {
  const { user } = useAuth();

  const { data: profileData, isPending } = useQuery({
    queryKey: ['profile-check', user?.id],
    queryFn: async () => {
      if (!user) return { role: null };
      const { data, error } = await supabase
        .from('profiles')
        .select('name, email_verified, role')
        .eq('user_id', user.id)
        .single();
      if (error) return { role: null };
      return { role: data?.role || null };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  if (isPending) {
    return <LoadingSpinner message="Jogosultság ellenőrzése..." />;
  }

  const role = profileData?.role;
  const isAuthorized = role === 'management' || role === 'thinkai';

  if (!isAuthorized) {
    return (
      <Suspense fallback={<LoadingSpinner message="Betöltés..." />}>
        <NotFound />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<LoadingSpinner message="Betöltés..." />}>
      <ManagementDashboard />
    </Suspense>
  );
}

export function renderAuthRoutes() {
  return (
    <>
      {/* Auth routes – no sidebar, own Suspense for lazy chunks */}
      <Route
        path="/auth"
        element={
          <Suspense fallback={<LoadingSpinner message="Betöltés..." />}>
            <RemoveInitialLoader />
            <Auth />
          </Suspense>
        }
      />
      <Route
        path="/auth/callback"
        element={
          <Suspense fallback={<LoadingSpinner message="Bejelentkezés..." />}>
            <RemoveInitialLoader />
            <AuthCallback />
          </Suspense>
        }
      />
      <Route
        path="/reset-password"
        element={
          <Suspense fallback={<LoadingSpinner message="Betöltés..." />}>
            <RemoveInitialLoader />
            <ResetPassword />
          </Suspense>
        }
      />
      <Route
        path="/register/:token"
        element={
          <Suspense fallback={<LoadingSpinner message="Betöltés..." />}>
            <RemoveInitialLoader />
            <EmployeeRegister />
          </Suspense>
        }
      />

      {/* Management dashboard – standalone, guarded by role check */}
      <Route
        path="/management"
        element={
          <ProtectedPage>
            <RemoveInitialLoader />
            <ManagementRoute />
          </ProtectedPage>
        }
      />

      {/* Client Portal – standalone, no auth (magic link) */}
      <Route
        path="/portal/:token"
        element={
          <Suspense fallback={<LoadingSpinner message="Betöltés..." />}>
            <RemoveInitialLoader />
            <ClientPortalPage />
          </Suspense>
        }
      />
    </>
  );
}
