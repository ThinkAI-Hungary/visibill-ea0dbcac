import { Suspense, lazy, useEffect } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { SubscriptionProvider } from "./contexts/SubscriptionContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { CompanyProvider, useCompany } from "./contexts/CompanyContext";
import { DateRangeProvider, useDateRange } from "./contexts/DateRangeContext";
import { ProtectedLayout } from "./components/ProtectedLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import { ScopedLayout } from "./components/ScopedLayout";
import { generateScopedPath, extractPageSegment } from "./lib/navigation";

import { LoadingSpinner } from "./components/ui/loading-spinner";
import { IdleWarningModal } from "./components/IdleWarningModal";
import { Toaster } from "./components/ui/toaster";

// Route-level code splitting – each page loads as a separate chunk
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const ManualUpload = lazy(() => import("./pages/ManualUpload"));
const InvoicesPage = lazy(() => import("./pages/InvoicesPage"));
const Integrations = lazy(() => import("./pages/Integrations"));
const Settings = lazy(() => import("./pages/Settings"));
const Projects = lazy(() => import("./pages/Projects"));
const Pricing = lazy(() => import("./pages/Pricing"));
const ExchangeRates = lazy(() => import("./pages/ExchangeRates"));
const SalariesPage = lazy(() => import("./pages/SalariesPage"));
const Analytics = lazy(() => import("./pages/Analytics"));
const PartnersPage = lazy(() => import("./pages/PartnersPage"));
const TransactionsPage = lazy(() => import("./pages/TransactionsPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const KintlevoPage = lazy(() => import("./pages/KintlevoPage"));
const EmployeeRegister = lazy(() => import("./pages/EmployeeRegister"));
const PettyCashPage = lazy(() => import("./pages/PettyCashPage"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const GeneralLedgerPage = lazy(() => import("./pages/GeneralLedgerPage"));
const WorkingTimePage = lazy(() => import("./pages/WorkingTimePage"));
const FixedAssetsPage = lazy(() => import("./pages/FixedAssetsPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 min — stable data won't refetch on every mount
      gcTime: 10 * 60 * 1000,   // 10 min garbage collection
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function ProtectedPage({ children }: { children: React.ReactNode }) {
  const { signOut, sessionGuard } = useAuth();

  return (
    <ProtectedRoute>
      {children}
      <IdleWarningModal
        open={sessionGuard.showWarning}
        secondsLeft={sessionGuard.secondsLeft}
        onStay={sessionGuard.stayActive}
        onLogout={() => signOut()}
      />
    </ProtectedRoute>
  );
}

/**
 * RootRedirect — sends `/` to `/:companyId/:dateRange/` (scoped dashboard).
 * Uses the currently selected company and date range from context.
 */
function RootRedirect() {
  const { selectedCompany, companies, isInitialLoading } = useCompany();
  const { dateFromFormatted, dateToFormatted } = useDateRange();

  // Still loading companies — render nothing (initial-loader covers this)
  if (isInitialLoading) return null;

  // No companies at all — render Index directly (shows EmptyStateDashboard onboarding wizard)
  if (!isInitialLoading && companies.length === 0) {
    return <Suspense fallback={<LoadingSpinner message="Betöltés..." />}><Index /></Suspense>;
  }

  // Has companies but selectedCompany not yet resolved — wait
  if (!selectedCompany) return null;

  const target = generateScopedPath(selectedCompany.id, dateFromFormatted, dateToFormatted, '');
  return <Navigate to={target} replace />;
}

/**
 * LegacyRedirect — redirects old flat paths (e.g. `/invoices`)
 * to scoped equivalents (`/:companyId/:dateRange/invoices`).
 */
function LegacyRedirect({ page }: { page: string }) {
  const { selectedCompany } = useCompany();
  const { dateFromFormatted, dateToFormatted } = useDateRange();

  if (!selectedCompany) return null;
  const target = generateScopedPath(selectedCompany.id, dateFromFormatted, dateToFormatted, page);
  return <Navigate to={target} replace />;
}

/** Removes the static HTML loader when a non-protected route mounts */
function RemoveInitialLoader() {
  useEffect(() => {
    const loader = document.getElementById('initial-loader');
    if (loader) {
      loader.classList.add('fade-out');
      setTimeout(() => loader.remove(), 220);
    }
  }, []);
  return null;
}

function PasswordRecoveryRedirect() {
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <CompanyProvider>
          <DateRangeProvider>
            <SubscriptionProvider>
              <TooltipProvider>

                <Toaster />
                <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                    <PasswordRecoveryRedirect />
                    <Routes>
                    {/* Auth routes – no sidebar, own Suspense for lazy chunks */}
                    <Route path="/auth" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><RemoveInitialLoader /><Auth /></Suspense>} />
                    <Route path="/auth/callback" element={<Suspense fallback={<LoadingSpinner message="Bejelentkezés..." />}><RemoveInitialLoader /><AuthCallback /></Suspense>} />
                    <Route path="/reset-password" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><RemoveInitialLoader /><ResetPassword /></Suspense>} />
                    <Route path="/register/:token" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><RemoveInitialLoader /><EmployeeRegister /></Suspense>} />

                    {/* Protected routes with persistent sidebar */}
                    <Route element={<ProtectedLayout />}>
                      {/* Categories — unscoped fallback (ProtectedRoute redirect for new users) */}
                      <Route path="/categories" element={
                        <ProtectedPage><Onboarding /></ProtectedPage>
                      } />

                      {/* ═══ Scoped Routes — /:companyId/:dateRange/* ═══ */}
                      <Route path="/:companyId/:dateRange" element={<ScopedLayout />}>
                        <Route index element={<ProtectedPage><Index /></ProtectedPage>} />
                        <Route path="categories" element={<ProtectedPage><Onboarding /></ProtectedPage>} />
                        <Route path="invoices/:tab?" element={<ProtectedPage><InvoicesPage /></ProtectedPage>} />
                        <Route path="upload/:tab?" element={<ProtectedPage><ManualUpload /></ProtectedPage>} />
                        <Route path="integrations" element={<ProtectedPage><Integrations /></ProtectedPage>} />
                        <Route path="settings/:tab?" element={<ProtectedPage><Settings /></ProtectedPage>} />
                        <Route path="projects" element={<ProtectedPage><Projects /></ProtectedPage>} />
                        <Route path="partners" element={<ProtectedPage><PartnersPage /></ProtectedPage>} />
                        <Route path="transactions/:tab?" element={<ProtectedPage><TransactionsPage /></ProtectedPage>} />
                        <Route path="general-ledger/:tab?" element={<ProtectedPage><GeneralLedgerPage /></ProtectedPage>} />
                        <Route path="kintlevo/:tab?" element={<ProtectedPage><KintlevoPage /></ProtectedPage>} />
                        <Route path="petty-cash/:tab?" element={<ProtectedPage><PettyCashPage /></ProtectedPage>} />
                        <Route path="teny/:tab?" element={<ProtectedPage><FixedAssetsPage /></ProtectedPage>} />
                        <Route path="pricing" element={<ProtectedPage><Pricing /></ProtectedPage>} />
                        <Route path="exchange-rates" element={<ProtectedPage><ExchangeRates /></ProtectedPage>} />
                        <Route path="salaries/:tab?" element={<ProtectedPage><SalariesPage /></ProtectedPage>} />
                        <Route path="working-time/:tab?" element={<ProtectedPage><WorkingTimePage /></ProtectedPage>} />
                        <Route path="analytics/:tab?" element={<ProtectedPage><Analytics /></ProtectedPage>} />
                      </Route>

                      {/* ═══ Legacy Redirects — old flat paths → scoped ═══ */}
                      <Route path="/invoices" element={<LegacyRedirect page="invoices" />} />
                      <Route path="/upload" element={<LegacyRedirect page="upload" />} />
                      <Route path="/integrations" element={<LegacyRedirect page="integrations" />} />
                      <Route path="/settings" element={<LegacyRedirect page="settings" />} />
                      <Route path="/projects" element={<LegacyRedirect page="projects" />} />
                      <Route path="/partners" element={<LegacyRedirect page="partners" />} />
                      <Route path="/transactions" element={<LegacyRedirect page="transactions" />} />
                      <Route path="/general-ledger" element={<LegacyRedirect page="general-ledger" />} />
                      <Route path="/kintlevo" element={<LegacyRedirect page="kintlevo" />} />
                      <Route path="/petty-cash" element={<LegacyRedirect page="petty-cash" />} />
                      <Route path="/teny" element={<LegacyRedirect page="teny" />} />
                      <Route path="/pricing" element={<LegacyRedirect page="pricing" />} />
                      <Route path="/exchange-rates" element={<LegacyRedirect page="exchange-rates" />} />
                      <Route path="/salaries" element={<LegacyRedirect page="salaries" />} />
                      <Route path="/working-time" element={<LegacyRedirect page="working-time" />} />
                      <Route path="/analytics" element={<LegacyRedirect page="analytics" />} />
                      <Route path="/onboarding" element={<LegacyRedirect page="categories" />} />

                      {/* Root → scoped dashboard */}
                      <Route path="/" element={<RootRedirect />} />
                    </Route>

                    <Route path="*" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><NotFound /></Suspense>} />
                  </Routes>
                </BrowserRouter>
              </TooltipProvider>
            </SubscriptionProvider>
          </DateRangeProvider>
        </CompanyProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
