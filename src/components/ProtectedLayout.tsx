import { useEffect, useRef } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { useAppReady } from '@/hooks/useAppReady';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { Suspense } from 'react';
import { ContentSkeleton } from '@/components/ui/content-skeleton';

/**
 * ProtectedLayout — Full-Stop Loading Guard + Sign-Out Overlay.
 *
 * Renders NOTHING until auth + company + role are all resolved.
 * The index.html #initial-loader stays visible during this time.
 *
 * If the user has no companies (fresh onboarding), the sidebar is
 * skipped entirely to avoid a flash before the onboarding modal.
 *
 * When signing out, a full-screen overlay covers the layout
 * so the user sees a clean "Kijelentkezés..." screen.
 */
export function ProtectedLayout() {
  const { isReady, user } = useAppReady();
  const { isSigningOut } = useAuth();
  const { companies, isInitialLoading: companyLoading } = useCompany();
  const navigate = useNavigate();
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

  // Redirect to /auth if not logged in — use replace to clear history
  useEffect(() => {
    if (isReady && !user && !isSigningOut) {
      const loader = document.getElementById('initial-loader');
      if (loader) loader.remove();
      navigate('/auth', { replace: true });
    }
  }, [isReady, user, isSigningOut, navigate]);

  // Full-Stop: render NOTHING until ready
  if (!isReady) {
    return null;
  }

  // Not logged in — redirect is happening
  if (!user && !isSigningOut) {
    return null;
  }

  // Fresh user with no companies: skip sidebar entirely to avoid
  // the visual flash (sidebar → darken → onboarding modal).
  // Render the Outlet directly so EmptyStateDashboard goes full-screen.
  const hasNoCompanies = !companyLoading && companies.length === 0;

  return (
    <>
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

      {/* Sign-Out Overlay */}
      {isSigningOut && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 rounded-full border-4 border-primary border-r-transparent animate-spin" />
            <p className="text-sm font-medium text-muted-foreground animate-pulse">
              Kijelentkezés...
            </p>
          </div>
        </div>
      )}
    </>
  );
}

