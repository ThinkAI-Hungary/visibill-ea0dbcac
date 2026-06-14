import { useEffect, useRef } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { useAppReady } from '@/hooks/useAppReady';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { Suspense } from 'react';
import { ContentSkeleton } from '@/components/ui/content-skeleton';
import { LiveNotificationProvider } from '@/components/LiveNotificationProvider';
import { FeedbackFab } from '@/components/FeedbackFab';

/**
 * ProtectedLayout — Single root gate for all protected routes.
 *
 * Renders NOTHING until auth + company + role + profile are all resolved.
 * The index.html #initial-loader stays visible during this time.
 *
 * All redirects (auth, onboarding) happen synchronously here via <Navigate/>
 * — no useEffect-based redirects, so no flash of forbidden content.
 */
export function ProtectedLayout() {
  const { isReady, user, redirectTarget } = useAppReady();
  const { isSigningOut } = useAuth();
  const { companies, isInitialLoading: companyLoading } = useCompany();
  const location = useLocation();
  const loaderRemovedRef = useRef(false);

  // Remove the HTML initial-loader once we're ready and rendering
  useEffect(() => {
    if (isReady && !loaderRemovedRef.current) {
      loaderRemovedRef.current = true;
      requestAnimationFrame(() => {
        const loader = document.getElementById('initial-loader');
        if (loader) {
          loader.classList.add('fade-out');
          setTimeout(() => loader.remove(), 220);
        }
      });
    }
  }, [isReady]);

  // Full-Stop: render NOTHING until ready
  if (!isReady) {
    return null;
  }

  // Synchronous redirects — happen before any lazy chunk is mounted.
  if (redirectTarget === 'auth' && !isSigningOut) {
    // After an explicit sign-out we want the user to land on the bare /auth
    // page — never restore the previously-scoped URL. The flag is set by
    // AuthContext.signOut() and consumed once on the redirect.
    let postSignout = false;
    try {
      postSignout = sessionStorage.getItem('visibill_post_signout_redirect') === '1';
      if (postSignout) sessionStorage.removeItem('visibill_post_signout_redirect');
    } catch {}

    const returnTo = location.pathname + location.search;
    const authUrl =
      !postSignout && returnTo && returnTo !== '/'
        ? `/auth?returnTo=${encodeURIComponent(returnTo)}`
        : '/auth';
    // Clean up loader if still present
    const loader = document.getElementById('initial-loader');
    if (loader) loader.remove();
    return <Navigate to={authUrl} replace />;
  }

  if (redirectTarget === 'unverified') {
    // Email not verified — send back to auth page with the confirmation screen
    const loader = document.getElementById('initial-loader');
    if (loader) loader.remove();
    return <Navigate to="/auth?unverified=true" replace />;
  }

  if (redirectTarget === 'onboarding' && location.pathname !== '/categories') {
    return <Navigate to="/categories" replace />;
  }

  // Sign-out in progress — keep DOM mounted with overlay
  if (!user && !isSigningOut) {
    return null;
  }

  // Sign-out in progress — render ONLY the overlay, nothing behind it.
  // Without this, the empty dashboard layout flashes behind the 95%-opacity overlay
  // because user/companies are already cleared but isSigningOut is still true.
  if (isSigningOut) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background backdrop-blur-sm animate-in fade-in duration-200">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-4 border-primary border-r-transparent animate-spin" />
          <p className="text-sm font-medium text-muted-foreground animate-pulse">
            Kijelentkezés...
          </p>
        </div>
      </div>
    );
  }

  // Fresh user with no companies: skip sidebar entirely to avoid
  // the visual flash (sidebar → darken → onboarding modal).
  const hasNoCompanies = !companyLoading && companies.length === 0;

  return (
    <>
      <LiveNotificationProvider />
      {hasNoCompanies ? (
        <div className="h-screen w-full overflow-auto bg-background">
          <Suspense fallback={<ContentSkeleton />}>
            <Outlet />
          </Suspense>
        </div>
      ) : (
        <AppLayout>
          <Outlet />
        </AppLayout>
      )}

      {/* Floating Feedback Button — always visible on all protected pages */}
      <FeedbackFab />
    </>
  );
}
