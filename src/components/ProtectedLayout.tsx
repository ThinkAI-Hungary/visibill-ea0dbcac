import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { useAppReady } from '@/hooks/useAppReady';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { Suspense } from 'react';
import { ContentSkeleton } from '@/components/ui/content-skeleton';
import { LiveNotificationProvider } from '@/components/LiveNotificationProvider';
import { FeedbackFab } from '@/components/FeedbackFab';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import i18n from '@/lib/i18n';

// Track whether eaisyBill has mounted and initialized in the current browser session.
// Resets to false on page refresh (F5).
let hasEaisybillInitialized = false;

/**
 * ProtectedLayout — Single root gate for all protected routes.
 *
 * Cold start (first entry after refresh): renders a full-page LoadingSpinner
 * until auth + company + profile + permissions are fully stabilized.
 *
 * Warm switch (subsequent entries from eaisybooks): renders immediately (0ms delay)
 * without full-page spinner, preserving instant SPA feel with localized skeletons.
 */
export function ProtectedLayout() {
  const { isReady, user, redirectTarget } = useAppReady();
  const { isSigningOut } = useAuth();
  const { companies, isInitialLoading: companyLoading, selectedCompany, setSelectedCompany } = useCompany();
  const location = useLocation();
  const loaderRemovedRef = useRef(false);

  // Extract target company ID from scoped URL if present
  const urlCompanyId = useMemo(() => {
    const clean = location.pathname.startsWith('/hr')
      ? location.pathname.replace(/^\/hr/, '')
      : location.pathname;
    const parts = clean.split('/').filter(Boolean);
    if (parts.length >= 2 && parts[1].includes('_')) {
      return parts[0];
    }
    return null;
  }, [location.pathname]);

  // Synchronize target company behind the loading spinner before mounting ScopedLayout
  useEffect(() => {
    if (urlCompanyId && companies.length > 0) {
      if (selectedCompany?.id !== urlCompanyId) {
        const target = companies.find((c) => c.id === urlCompanyId);
        if (target) {
          setSelectedCompany(target);
        }
      }
    }
  }, [urlCompanyId, companies, selectedCompany, setSelectedCompany]);

  // Cold vs Warm initialization state:
  // - Cold (first visit after F5): initialLoading = true, shows LoadingSpinner until ready
  // - Warm (subsequent visits/switches): initialLoading = false, instant SPA switch without spinner
  const [initialLoading, setInitialLoading] = useState(() => !hasEaisybillInitialized);

  // Target company is considered ready when either:
  // 1) The URL targets a specific company and selectedCompany matches it
  // 2) There is no scoped company in the URL, but selectedCompany is already populated
  const isTargetCompanyReady = urlCompanyId ? selectedCompany?.id === urlCompanyId : !!selectedCompany;

  // Complete cold start when all data is ready, plus a short 400ms grace period for clean mount
  useEffect(() => {
    if (initialLoading && isReady && isTargetCompanyReady && !companyLoading) {
      const timer = setTimeout(() => {
        hasEaisybillInitialized = true;
        setInitialLoading(false);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [initialLoading, isReady, isTargetCompanyReady, companyLoading]);

  // Fallback safety timeout (4s) so layout is never permanently stuck in spinner
  useEffect(() => {
    if (initialLoading) {
      const fallbackTimer = setTimeout(() => {
        hasEaisybillInitialized = true;
        setInitialLoading(false);
      }, 4000);
      return () => clearTimeout(fallbackTimer);
    }
  }, [initialLoading]);

  // Remove the HTML initial-loader once we're ready and rendering actual content.
  // Only skip when redirecting to /management (outside ProtectedLayout, no manual cleanup).
  // Auth/unverified redirects manually remove the loader in their redirect blocks below.
  // Onboarding stays within ProtectedLayout, so the loader should be removed normally.
  useEffect(() => {
    if (isReady && redirectTarget !== 'management' && !loaderRemovedRef.current) {
      loaderRemovedRef.current = true;
      requestAnimationFrame(() => {
        const loader = document.getElementById('initial-loader');
        if (loader) {
          loader.classList.add('fade-out');
          setTimeout(() => loader.remove(), 220);
        }
      });
    }
  }, [isReady, redirectTarget]);

  // Cold start: render loading spinner until ready.
  // Warm switch: instant rendering without fullPage spinner.
  const shouldShowSpinner = !isReady || initialLoading;
  if (shouldShowSpinner) {
    return <LoadingSpinner fullPage={true} message="eaisyBill betöltése..." />;
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
    const isEaisybooks = returnTo && (returnTo.startsWith('/eaisybooks') || returnTo.includes('/eaisybooks'));
    const isHr = location.pathname === '/hr' || location.pathname.startsWith('/hr/') || i18n.language === 'hr';
    const baseAuth = isHr ? '/hr/auth' : '/auth';
    
    let authUrl = baseAuth;
    if (!postSignout && returnTo && returnTo !== '/' && returnTo !== '/hr') {
      authUrl = `${baseAuth}?returnTo=${encodeURIComponent(returnTo)}`;
      if (isEaisybooks) {
        authUrl += '&app=eaisybooks';
      }
    } else if (isEaisybooks) {
      authUrl = `${baseAuth}?app=eaisybooks`;
    }

    // Clean up loader if still present
    const loader = document.getElementById('initial-loader');
    if (loader) loader.remove();
    return <Navigate to={authUrl} replace />;
  }

  if (redirectTarget === 'unverified') {
    // Email not verified — send back to auth page with the confirmation screen
    const loader = document.getElementById('initial-loader');
    if (loader) loader.remove();
    const isHr = location.pathname === '/hr' || location.pathname.startsWith('/hr/') || i18n.language === 'hr';
    return <Navigate to={isHr ? "/hr/auth?unverified=true" : "/auth?unverified=true"} replace />;
  }

  // Management/ThinkAI user → skip directly to management dashboard, no sidebar flash.
  if (redirectTarget === 'management' && location.pathname !== '/management') {
    return <Navigate to="/management" replace />;
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
