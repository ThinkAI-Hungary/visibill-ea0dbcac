import { Suspense, lazy, useEffect } from "react";

// ─── Synchronous email_change hash redirect ───────────────────────────────────
// Must run before React renders anything. If Supabase lands us on the root URL
// with type=email_change in the hash (from an email confirmation link), we
// immediately hard-redirect to /auth/callback so the user sees the confirmation
// screen — even if they already have an active session.
;(function handleEmailChangeHash() {
  const hash = window.location.hash;
  const PENDING_KEY = 'visibill_pending_callback_type';

  // ── /reset-password: capture hash synchronously BEFORE Supabase clears it ──
  // Supabase SDK calls history.replaceState() during init, wiping the hash before
  // React renders. ResetPassword.tsx must read from sessionStorage instead.
  if (window.location.pathname === '/reset-password') {
    if (hash) {
      const params = new URLSearchParams(hash.replace('#', ''));
      const type = params.get('type');
      const errCode = params.get('error_code');
      const errVal = params.get('error');
      if (type === 'recovery') {
        // Valid recovery token — mark so ResetPassword knows to show the form
        sessionStorage.setItem('visibill_reset_pw_state', 'recovery');
      } else if (errCode === 'otp_expired' || (errVal === 'access_denied' && errCode)) {
        // Expired or already-used reset link
        sessionStorage.setItem('visibill_reset_pw_state', 'expired');
      }
    }
    return; // Never redirect away from /reset-password
  }

  // If already at /auth/callback: capture the TYPE synchronously into sessionStorage
  // BEFORE Supabase's async init clears the URL. Two formats to handle:
  //   1. Hash fragment:  /auth/callback#type=email_change&access_token=...  (implicit flow)
  //   2. Query params:   /auth/callback?type=email_change&token_hash=...    (newer Supabase format)
  if (window.location.pathname === '/auth/callback') {
    if (!sessionStorage.getItem(PENDING_KEY)) {
      // First check query params (token_hash format)
      const qp = new URLSearchParams(window.location.search);
      const qpType = qp.get('type');
      const qpErrCode = qp.get('error_code');
      if (qpType === 'email_change') {
        sessionStorage.setItem(PENDING_KEY, 'email_change');
      } else if (qpErrCode === 'otp_expired' || qp.get('error') === 'access_denied') {
        sessionStorage.setItem(PENDING_KEY, 'otp_expired');
      } else if (hash) {
        // Fallback: hash fragment format
        const hp = new URLSearchParams(hash.replace('#', ''));
        const hpType = hp.get('type');
        const hpErrCode = hp.get('error_code');
        if (hpType === 'email_change') {
          sessionStorage.setItem(PENDING_KEY, 'email_change');
        } else if (hpErrCode === 'otp_expired') {
          sessionStorage.setItem(PENDING_KEY, 'otp_expired');
        }
      }
    }
    return;
  }

  if (!hash) return;
  const params = new URLSearchParams(hash.replace('#', ''));

  // Successful email change confirmation
  if (params.get('type') === 'email_change') {
    sessionStorage.setItem(PENDING_KEY, 'email_change');
    window.location.replace('/auth/callback' + hash);
    return;
  }

  // Already-used token: otp_expired error on root URL = email_change
  // (password reset otp_expired lands on /reset-password, not here)
  if (params.get('error') === 'access_denied' && params.get('error_code') === 'otp_expired') {
    sessionStorage.setItem(PENDING_KEY, 'otp_expired');
    window.location.replace('/auth/callback' + hash);
    return;
  }
})();
// ─────────────────────────────────────────────────────────────────────────────

import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache, useQuery } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { useHasEaisybillAccess } from "./hooks/useHasEaisybillAccess";

import { ThemeProvider } from "./contexts/ThemeContext";
import { CompanyProvider, useCompany } from "./contexts/CompanyContext";
import { DateRangeProvider, useDateRange } from "./contexts/DateRangeContext";
import { ProtectedLayout } from "./components/ProtectedLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import { ProtectedAccountyRoute } from "./pages/Accounty/ProtectedAccountyRoute";
import { ScopedLayout } from "./components/ScopedLayout";
import { generateScopedPath, extractPageSegment } from "./lib/navigation";

import { LoadingSpinner } from "./components/ui/loading-spinner";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { IdleWarningModal } from "./components/IdleWarningModal";
import { Toaster } from "./components/ui/toaster";
import { supabase } from "./integrations/supabase/client";

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
const ProfitAndLoss = lazy(() => import("./pages/ProfitAndLoss"));
const BalanceSheet = lazy(() => import("./pages/BalanceSheet"));
const AnnualReportPage = lazy(() => import("./pages/AnnualReportPage"));
const ManagementDashboard = lazy(() => import("./pages/ManagementDashboard"));
const AccountyApp = lazy(() => import("./pages/Accounty/AccountyApp"));
const AccountyLayout = lazy(() => import("./pages/Accounty/AccountyLayout"));
const NewClientPage = lazy(() => import("./pages/Accounty/NewClientPage"));
const MissingInvoicesPage = lazy(() => import("./pages/Accounty/MissingInvoicesPage"));
const ReportsPage = lazy(() => import("./pages/Accounty/ReportsPage"));
const MissingInvoicesReportPage = lazy(() => import("./pages/Accounty/MissingInvoicesReportPage"));
const ClientDetailsPage = lazy(() => import("./pages/Accounty/ClientDetailsPage"));
const ClientMissingInvoicesPage = lazy(() => import("./pages/Accounty/ClientMissingInvoicesPage"));
const ClientReportsPage = lazy(() => import("./pages/Accounty/ClientReportsPage"));
const ClientMissingInvoicesReportPage = lazy(() => import("./pages/Accounty/ClientMissingInvoicesReportPage"));
const TaxCalendarPage = lazy(() => import("./pages/Accounty/TaxCalendarPage"));
const ClientInvoicesPage = lazy(() => import("./pages/Accounty/ClientInvoicesPage"));
const ClientPortalPage = lazy(() => import("./pages/Accounty/ClientPortalPage"));
const SettingsPage = lazy(() => import("./pages/Accounty/SettingsPage"));
const HelpPage = lazy(() => import("./pages/Accounty/HelpPage"));
const ApprovalQueuePage = lazy(() => import("./pages/Accounty/ApprovalQueuePage"));
const PayrollDashboardPage = lazy(() => import("./pages/Accounty/PayrollDashboardPage"));
const PayrollEmployeesPage = lazy(() => import("./pages/Accounty/EmployeesPage"));
const PayrollEmployeeWizardPage = lazy(() => import("./pages/Accounty/EmployeeWizardPage"));
const PayrollCyclePage = lazy(() => import("./pages/Accounty/PayrollCyclePage"));
const PayrollEmployeeDetailsPage = lazy(() => import("./pages/Accounty/EmployeeDetailsPage"));
const PayrollTaxParametersPage = lazy(() => import("./pages/Accounty/TaxParametersPage"));
const PayrollFilingsPage = lazy(() => import("./pages/Accounty/FilingsPage"));
const PayrollReportsPage = lazy(() => import("./pages/Accounty/PayrollReportsPage"));

// Admin modules
const AuditLogPage = lazy(() => import("./pages/Accounty/AuditLogPage"));
const GdprPage = lazy(() => import("./pages/Accounty/GdprPage"));
const TemplatesPage = lazy(() => import("./pages/Accounty/TemplatesPage"));
const JobCodesPage = lazy(() => import("./pages/Accounty/JobCodesPage"));
const AdminTaxParametersPage = lazy(() => import("./pages/Accounty/AdminTaxParametersPage"));
const LegalUpdatesPage = lazy(() => import("./pages/Accounty/LegalUpdatesPage"));
const PermissionMatrixPage = lazy(() => import("./pages/Accounty/PermissionMatrixPage"));
const AccountantManagementPage = lazy(() => import("./pages/Accounty/AccountantManagementPage"));
const AccountyOnboardingPage = lazy(() => import("./pages/Accounty/OnboardingPage"));
const AiAssistantPage = lazy(() => import("./pages/Accounty/AiAssistantPage"));
const ProfileSettingsPage = lazy(() => import("./pages/Accounty/ProfileSettingsPage"));

// Portfolio pages
const AlertsCenterPage = lazy(() => import("./pages/Accounty/AlertsCenterPage"));
const NavDeadlinesPage = lazy(() => import("./pages/Accounty/NavDeadlinesPage"));
const PayrollPortfolioPage = lazy(() => import("./pages/Accounty/PayrollPortfolioPage"));
const CegkapuSettingsPage = lazy(() => import("./pages/Accounty/CegkapuSettingsPage"));
const RepresentationPage = lazy(() => import("./pages/Accounty/RepresentationPage"));
const DataRetentionPage = lazy(() => import("./pages/Accounty/DataRetentionPage"));
const CompanyStructurePage = lazy(() => import("./pages/Accounty/CompanyStructurePage"));
const EmployeeImportPage = lazy(() => import("./pages/Accounty/EmployeeImportPage"));
const JobModificationPage = lazy(() => import("./pages/Accounty/JobModificationPage"));
const MultiJobPage = lazy(() => import("./pages/Accounty/MultiJobPage"));
const DeclarationsOverviewPage = lazy(() => import("./pages/Accounty/declarations/DeclarationsOverviewPage"));
const FamilyDeclarationPage = lazy(() => import("./pages/Accounty/declarations/FamilyDeclarationPage"));
const GenericDeclarationPage = lazy(() => import("./pages/Accounty/declarations/GenericDeclarationPage"));
const DocumentCenterPage = lazy(() => import("./pages/Accounty/documents/DocumentCenterPage"));
const PayslipGeneratorPage = lazy(() => import("./pages/Accounty/documents/PayslipGeneratorPage"));
const EmployeeExitWizardPage = lazy(() => import("./pages/Accounty/EmployeeExitWizardPage"));
const PayrollAdvancedReportsPage = lazy(() => import("./pages/Accounty/reports/PayrollAdvancedReportsPage"));
const OfficeSettingsPage = lazy(() => import("./pages/Accounty/admin/OfficeSettingsPage"));
const CompanyPayrollSettingsPage = lazy(() => import("./pages/Accounty/CompanyPayrollSettingsPage"));
const SpecialJobFormsPage = lazy(() => import("./pages/Accounty/SpecialJobFormsPage"));
const Filing08EPage = lazy(() => import("./pages/Accounty/filings/Filing08EPage"));
const Filing2608Page = lazy(() => import("./pages/Accounty/filings/Filing2608Page"));
const GenericFilingPage = lazy(() => import("./pages/Accounty/filings/GenericFilingPage"));
const FilingWorkflowPage = lazy(() => import("./pages/Accounty/filings/FilingWorkflowPage"));
const TransferListPage = lazy(() => import("./pages/Accounty/documents/TransferListPage"));
const EPayslipPortalPage = lazy(() => import("./pages/Accounty/documents/EPayslipPortalPage"));
const OutputDocumentsPage = lazy(() => import("./pages/Accounty/documents/OutputDocumentsPage"));
const ExitDocumentsPage = lazy(() => import("./pages/Accounty/ExitDocumentsPage"));
const YearEndDashboardPage = lazy(() => import("./pages/Accounty/YearEndDashboardPage"));
const AiAnomalyReportPage = lazy(() => import("./pages/Accounty/reports/AiAnomalyReportPage"));
const PrivacyPolicyPage = lazy(() => import("./pages/Accounty/PrivacyPolicyPage"));
const CustomReportBuilderPage = lazy(() => import("./pages/Accounty/reports/CustomReportBuilderPage"));
const DeclarationArchivePage = lazy(() => import("./pages/Accounty/declarations/DeclarationArchivePage"));
const VatReturnPage = lazy(() => import("./pages/VatReturnPage"));
const TicketsPage = lazy(() => import("./pages/TicketsPage"));
const ShipmentImportPage = lazy(() => import("./pages/ShipmentImportPage"));
const ShipmentMatchingDashboard = lazy(() => import("./pages/ShipmentMatchingDashboard"));
const EscalationListPage = lazy(() => import("./pages/EscalationListPage"));

// TAO/KIVA module
const TaoPortfolioPage = lazy(() => import("./pages/Accounty/Tao/TaoPortfolioPage"));
const TaoCalendarPage2 = lazy(() => import("./pages/Accounty/Tao/TaoCalendarPage"));
const TaoTaxpayerTypesPage = lazy(() => import("./pages/Accounty/Tao/TaoTaxpayerTypesPage"));
const ClientTaoMainPage = lazy(() => import("./pages/Accounty/Tao/ClientTaoMainPage"));
const TaoSetupWizardPage = lazy(() => import("./pages/Accounty/Tao/TaoSetupWizardPage"));
const TaoMasterDataPage = lazy(() => import("./pages/Accounty/Tao/TaoMasterDataPage"));
const TaoLifecyclePage = lazy(() => import("./pages/Accounty/Tao/TaoLifecyclePage"));
const TaoBusinessYearPage = lazy(() => import("./pages/Accounty/Tao/TaoBusinessYearPage"));
const TaoAccountingRegimePage = lazy(() => import("./pages/Accounty/Tao/TaoAccountingRegimePage"));
const TaoCurrencyPage = lazy(() => import("./pages/Accounty/Tao/TaoCurrencyPage"));
const TaoYearEndWizardPage = lazy(() => import("./pages/Accounty/Tao/TaoYearEndWizardPage"));
const KivaCalculatorPage = lazy(() => import("./pages/Accounty/Tao/KivaCalculatorPage"));
const TaoKivaComparePage = lazy(() => import("./pages/Accounty/Tao/TaoKivaComparePage"));

import { reportError } from '@/lib/errorReporter';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 min — stable data won't refetch on every mount
      gcTime: 10 * 60 * 1000,   // 10 min garbage collection
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Log every final query failure (after retries exhausted)
      reportError({
        type: 'db_query',
        component: String(query.queryKey?.[0] || 'UnknownQuery'),
        action: 'query_error',
        message: error instanceof Error ? error.message : String(error),
        error,
        context: { queryKey: query.queryKey },
      });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      // Log every mutation failure
      reportError({
        type: 'db_query',
        component: String(mutation.options.mutationKey?.[0] || 'UnknownMutation'),
        action: 'mutation_error',
        message: error instanceof Error ? error.message : String(error),
        error,
        context: { mutationKey: mutation.options.mutationKey },
      });
    },
  }),
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

  if (roleLoading || accessLoading) return <LoadingSpinner message="" />;

  // ThinkAI / management role → management dashboard (takes priority)
  if (profileRole === 'management' || profileRole === 'thinkai') {
    return <Navigate to="/management" replace />;
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
      return <Navigate to="/accounty" replace />;
    }
    return <Suspense fallback={<LoadingSpinner message="Betöltés..." />}><Index /></Suspense>;
  }

  if (hasEaisybillAccess === false) {
    return <Navigate to="/accounty" replace />;
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

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Reset scroll of main content containers ONLY — NOT the sidebar nav.
    // AppSidebar's scrollable SidebarGroup has [data-sidebar-nav] which is excluded here.
    // Without this, the sidebar would jump to top every time the user clicks a menu item
    // that was scrolled into view on small-resolution screens.
    const scrollContainers = document.querySelectorAll("main, .overflow-y-auto, .overflow-auto");
    scrollContainers.forEach((el) => {
      // Skip sidebar navigation containers (marked with data-sidebar-nav)
      if (
        el.hasAttribute('data-sidebar-nav') ||
        el.closest('[data-sidebar-nav]')
      ) {
        return;
      }
      if (
        el.tagName === 'MAIN' ||
        el.classList.contains('p-6') ||
        el.classList.contains('p-8') ||
        el.classList.contains('flex-1')
      ) {
        (el as HTMLElement).scrollTop = 0;
      }
    });
  }, [pathname]);

  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <CompanyProvider>
          <DateRangeProvider>

              <TooltipProvider>

                <Toaster />
                <ErrorBoundary>
                <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                    <ScrollToTop />
                    <PasswordRecoveryRedirect />
                    <Routes>
                    {/* Auth routes – no sidebar, own Suspense for lazy chunks */}
                    <Route path="/auth" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><RemoveInitialLoader /><Auth /></Suspense>} />
                    <Route path="/auth/callback" element={<Suspense fallback={<LoadingSpinner message="Bejelentkezés..." />}><RemoveInitialLoader /><AuthCallback /></Suspense>} />
                    <Route path="/reset-password" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><RemoveInitialLoader /><ResetPassword /></Suspense>} />
                    <Route path="/register/:token" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><RemoveInitialLoader /><EmployeeRegister /></Suspense>} />

                    {/* Management dashboard – standalone, no sidebar/company context needed */}
                    <Route path="/management" element={
                      <ProtectedPage>
                        <Suspense fallback={<LoadingSpinner message="Betöltés..." />}>
                          <RemoveInitialLoader />
                          <ManagementDashboard />
                        </Suspense>
                      </ProtectedPage>
                    } />

                    {/* Client Portal – standalone, no auth (magic link) */}
                    <Route path="/portal/:token" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><RemoveInitialLoader /><ClientPortalPage /></Suspense>} />

                    {/* Accounty New Client Wizard (No Layout) */}
                    <Route path="/accounty/new-client" element={
                      <ProtectedPage>
                        <Suspense fallback={<LoadingSpinner message="Betöltés..." />}>
                          <RemoveInitialLoader />
                          <NewClientPage />
                        </Suspense>
                      </ProtectedPage>
                    } />

                    {/* Accounty frontend – standalone layout */}
                    <Route path="/accounty" element={
                      <ProtectedPage>
                          <RemoveInitialLoader />
                          <Suspense fallback={<LoadingSpinner message="eaisybooks betöltése..." />}>
                            <AccountyLayout />
                          </Suspense>
                      </ProtectedPage>
                    }>
                      <Route index element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><AccountyApp /></Suspense>} />
                      <Route path="client/:id" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><ClientDetailsPage /></Suspense>} />
                      <Route path="missing-invoices" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><MissingInvoicesPage /></Suspense>} />
                      <Route path="missing-invoices/:id" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><ClientMissingInvoicesPage /></Suspense>} />
                      <Route path="client/:id/reports" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><ClientReportsPage /></Suspense>} />
                      <Route path="client/:id/reports/missing-invoices" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><ClientMissingInvoicesReportPage /></Suspense>} />
                      <Route path="client/:id/invoices" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><ClientInvoicesPage /></Suspense>} />
                      <Route path="reports" element={<ProtectedAccountyRoute requiredRoles={['iroda_admin', 'senior_könyvelő']}><Suspense fallback={<LoadingSpinner message="Betöltés..." />}><ReportsPage /></Suspense></ProtectedAccountyRoute>} />
                      <Route path="reports/missing-invoices" element={<ProtectedAccountyRoute requiredRoles={['iroda_admin', 'senior_könyvelő']}><Suspense fallback={<LoadingSpinner message="Betöltés..." />}><MissingInvoicesReportPage /></Suspense></ProtectedAccountyRoute>} />
                      <Route path="reports/ai-anomaly" element={<ProtectedAccountyRoute requiredRoles={['iroda_admin', 'senior_könyvelő']}><Suspense fallback={<LoadingSpinner message="Betöltés..." />}><AiAnomalyReportPage /></Suspense></ProtectedAccountyRoute>} />
                      <Route path="tax-calendar" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><TaxCalendarPage /></Suspense>} />
                      <Route path="settings" element={<ProtectedAccountyRoute requiredRoles={['iroda_admin', 'senior_könyvelő']}><Suspense fallback={<LoadingSpinner message="Betöltés..." />}><SettingsPage /></Suspense></ProtectedAccountyRoute>} />
                      <Route path="privacy-policy" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><PrivacyPolicyPage /></Suspense>} />
                      <Route path="help" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><HelpPage /></Suspense>} />
                      <Route path="tickets/:ticketId?" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><TicketsPage /></Suspense>} />
                      <Route path="approval-queue" element={<ProtectedAccountyRoute requiredRoles={['iroda_admin', 'senior_könyvelő']}><Suspense fallback={<LoadingSpinner message="Betöltés..." />}><ApprovalQueuePage /></Suspense></ProtectedAccountyRoute>} />
                      <Route path="payroll/:id" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><PayrollDashboardPage /></Suspense>} />
                      <Route path="payroll/:id/employees" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><PayrollEmployeesPage /></Suspense>} />
                      <Route path="payroll/:id/employees/new" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><PayrollEmployeeWizardPage /></Suspense>} />
                      <Route path="payroll/:id/employees/:empId" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><PayrollEmployeeDetailsPage /></Suspense>} />
                      <Route path="payroll/:id/cycle/new" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><PayrollCyclePage /></Suspense>} />
                      <Route path="payroll/:id/cycle/:cycleId" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><PayrollCyclePage /></Suspense>} />
                      <Route path="payroll/:id/filings" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><PayrollFilingsPage /></Suspense>} />
                      <Route path="payroll/:id/reports" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><PayrollReportsPage /></Suspense>} />
                      <Route path="payroll/:id/portal" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><ClientPortalPage /></Suspense>} />
                      <Route path="payroll/:id/tax-params" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><PayrollTaxParametersPage /></Suspense>} />
                      <Route path="payroll/:id/settings" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><CompanyPayrollSettingsPage /></Suspense>} />
                      {/* Client-level settings (WP1) */}
                      <Route path="client/:id/cegkapu" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><CegkapuSettingsPage /></Suspense>} />
                      <Route path="client/:id/representation" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><RepresentationPage /></Suspense>} />
                      <Route path="client/:id/data-retention" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><DataRetentionPage /></Suspense>} />
                      <Route path="client/:id/structure" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><CompanyStructurePage /></Suspense>} />
                      {/* Employee extensions (WP2) */}
                      <Route path="payroll/:id/employees/import" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><EmployeeImportPage /></Suspense>} />
                      <Route path="payroll/:id/employees/:empId/modification" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><JobModificationPage /></Suspense>} />
                      <Route path="payroll/:id/employees/:empId/multi-job" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><MultiJobPage /></Suspense>} />
                      {/* Declarations (WP3) */}
                      <Route path="payroll/:id/declarations" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><DeclarationsOverviewPage /></Suspense>} />
                      <Route path="payroll/:id/declarations/archive" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><DeclarationArchivePage /></Suspense>} />
                      <Route path="payroll/:id/declarations/family" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><FamilyDeclarationPage /></Suspense>} />
                      <Route path="payroll/:id/declarations/:type" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><GenericDeclarationPage /></Suspense>} />
                      {/* Documents (WP5) */}
                      <Route path="payroll/:id/documents" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><DocumentCenterPage /></Suspense>} />
                      <Route path="payroll/:id/documents/payslips" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><PayslipGeneratorPage /></Suspense>} />
                      <Route path="payroll/:id/documents/transfer" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><TransferListPage /></Suspense>} />
                      <Route path="payroll/:id/documents/e-payslip" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><EPayslipPortalPage /></Suspense>} />
                      <Route path="payroll/:id/documents/all" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><OutputDocumentsPage /></Suspense>} />
                      <Route path="payroll/:id/documents/:docType" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><OutputDocumentsPage /></Suspense>} />
                      {/* Exit (WP6) */}
                      <Route path="payroll/:id/employees/:empId/exit" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><EmployeeExitWizardPage /></Suspense>} />
                      <Route path="payroll/:id/employees/:empId/exit-docs" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><ExitDocumentsPage /></Suspense>} />
                      {/* Filings */}
                      <Route path="payroll/:id/filings/08e" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><Filing08EPage /></Suspense>} />
                      <Route path="payroll/:id/filings/2608" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><Filing2608Page /></Suspense>} />
                      <Route path="payroll/:id/filings/all" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><GenericFilingPage /></Suspense>} />
                      <Route path="payroll/:id/filings/:filingType" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><GenericFilingPage /></Suspense>} />
                      <Route path="payroll/:id/filings/:filingId/workflow" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><FilingWorkflowPage /></Suspense>} />
                      {/* Special job forms */}
                      <Route path="payroll/:id/employees/:empId/special" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><SpecialJobFormsPage /></Suspense>} />
                      <Route path="payroll/:id/employees/:empId/special/:jobType" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><SpecialJobFormsPage /></Suspense>} />
                      {/* Year End & Advanced Reports */}
                      <Route path="payroll/:id/year-end" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><YearEndDashboardPage /></Suspense>} />
                      <Route path="payroll/:id/advanced-reports" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><PayrollAdvancedReportsPage /></Suspense>} />
                      <Route path="payroll/:id/advanced-reports/anomaly" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><AiAnomalyReportPage /></Suspense>} />
                      <Route path="payroll/:id/advanced-reports/custom" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><CustomReportBuilderPage /></Suspense>} />
                      <Route path="new-client" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><NewClientPage /></Suspense>} />
                      {/* Admin modules — iroda_admin only */}
                      <Route path="admin/audit" element={<ProtectedAccountyRoute requiredRoles={['iroda_admin']}><Suspense fallback={<LoadingSpinner message="Betöltés..." />}><AuditLogPage /></Suspense></ProtectedAccountyRoute>} />
                      <Route path="admin/gdpr" element={<ProtectedAccountyRoute requiredRoles={['iroda_admin']}><Suspense fallback={<LoadingSpinner message="Betöltés..." />}><GdprPage /></Suspense></ProtectedAccountyRoute>} />
                      <Route path="admin/templates" element={<ProtectedAccountyRoute requiredRoles={['iroda_admin']}><Suspense fallback={<LoadingSpinner message="Betöltés..." />}><TemplatesPage /></Suspense></ProtectedAccountyRoute>} />
                      <Route path="admin/job-codes" element={<ProtectedAccountyRoute requiredRoles={['iroda_admin']}><Suspense fallback={<LoadingSpinner message="Betöltés..." />}><JobCodesPage /></Suspense></ProtectedAccountyRoute>} />
                      <Route path="admin/tax-parameters" element={<ProtectedAccountyRoute requiredRoles={['iroda_admin']}><Suspense fallback={<LoadingSpinner message="Betöltés..." />}><AdminTaxParametersPage /></Suspense></ProtectedAccountyRoute>} />
                      <Route path="admin/legal-updates" element={<ProtectedAccountyRoute requiredRoles={['iroda_admin']}><Suspense fallback={<LoadingSpinner message="Betöltés..." />}><LegalUpdatesPage /></Suspense></ProtectedAccountyRoute>} />
                      <Route path="admin/office-settings" element={<ProtectedAccountyRoute requiredRoles={['iroda_admin']}><Suspense fallback={<LoadingSpinner message="Betöltés..." />}><OfficeSettingsPage /></Suspense></ProtectedAccountyRoute>} />
                      <Route path="admin/permissions" element={<ProtectedAccountyRoute requiredRoles={['iroda_admin']}><Suspense fallback={<LoadingSpinner message="Betöltés..." />}><PermissionMatrixPage /></Suspense></ProtectedAccountyRoute>} />
                      <Route path="admin/accountants" element={<ProtectedAccountyRoute requiredRoles={['iroda_admin']}><Suspense fallback={<LoadingSpinner message="Betöltés..." />}><AccountantManagementPage /></Suspense></ProtectedAccountyRoute>} />
                      {/* Portfolio pages */}
                      <Route path="alerts" element={<ProtectedAccountyRoute requiredRoles={['iroda_admin', 'senior_könyvelő']}><Suspense fallback={<LoadingSpinner message="Betöltés..." />}><AlertsCenterPage /></Suspense></ProtectedAccountyRoute>} />
                      <Route path="nav-deadlines" element={<ProtectedAccountyRoute requiredRoles={['iroda_admin', 'senior_könyvelő']}><Suspense fallback={<LoadingSpinner message="Betöltés..." />}><NavDeadlinesPage /></Suspense></ProtectedAccountyRoute>} />
                      <Route path="payroll-portfolio" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><PayrollPortfolioPage /></Suspense>} />
                      <Route path="onboarding" element={<ProtectedAccountyRoute requiredRoles={['iroda_admin']}><Suspense fallback={<LoadingSpinner message="Betöltés..." />}><AccountyOnboardingPage /></Suspense></ProtectedAccountyRoute>} />
                      <Route path="ai-assistant" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><AiAssistantPage /></Suspense>} />
                      <Route path="profile/settings" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><ProfileSettingsPage /></Suspense>} />
                      {/* TAO/KIVA module */}
                      <Route path="tao" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><TaoPortfolioPage /></Suspense>} />
                      <Route path="tao/calendar" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><TaoCalendarPage2 /></Suspense>} />
                      <Route path="tao/taxpayer-types" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><TaoTaxpayerTypesPage /></Suspense>} />
                      <Route path="client/:id/tao" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><ClientTaoMainPage /></Suspense>} />
                      <Route path="client/:id/tao/setup" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><TaoSetupWizardPage /></Suspense>} />
                      <Route path="client/:id/tao/master-data" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><TaoMasterDataPage /></Suspense>} />
                      <Route path="client/:id/tao/lifecycle" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><TaoLifecyclePage /></Suspense>} />
                      <Route path="client/:id/tao/business-year" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><TaoBusinessYearPage /></Suspense>} />
                      <Route path="client/:id/tao/accounting-regime" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><TaoAccountingRegimePage /></Suspense>} />
                      <Route path="client/:id/tao/currency" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><TaoCurrencyPage /></Suspense>} />
                      <Route path="client/:id/tao/year-end/:year" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><TaoYearEndWizardPage /></Suspense>} />
                      <Route path="client/:id/tao/kiva" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><KivaCalculatorPage /></Suspense>} />
                      <Route path="client/:id/tao/compare" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><TaoKivaComparePage /></Suspense>} />
                    </Route>

                    {/* Protected routes with persistent sidebar */}
                    <Route element={<ProtectedLayout />}>
                      {/* Categories — unscoped fallback (ProtectedRoute redirect for new users) */}
                      <Route path="/categories" element={
                        <ProtectedPage><Onboarding /></ProtectedPage>
                      } />

                      {/* Standalone tickets route — context-free, directly linkable */}
                      <Route path="/tickets/:ticketId?" element={<ProtectedPage><TicketsPage /></ProtectedPage>} />

                      {/* ═══ Scoped Routes — /:companyId/:dateRange/* ═══ */}
                      <Route path="/:companyId/:dateRange" element={<ScopedLayout />}>
                        <Route index element={<ProtectedPage><Index /></ProtectedPage>} />
                        <Route path="categories" element={<ProtectedPage><Onboarding /></ProtectedPage>} />
                        <Route path="invoices/:tab?" element={<ProtectedPage><InvoicesPage /></ProtectedPage>} />
                        <Route path="upload/:tab?" element={<ProtectedPage><ManualUpload /></ProtectedPage>} />
                        <Route path="tickets/:ticketId?" element={<ProtectedPage><TicketsPage /></ProtectedPage>} />
                        <Route path="integrations" element={<ProtectedPage><Integrations /></ProtectedPage>} />
                        <Route path="settings/:tab?" element={<ProtectedPage><Settings /></ProtectedPage>} />
                        <Route path="projects" element={<ProtectedPage><Projects /></ProtectedPage>} />
                        <Route path="partners" element={<ProtectedPage><PartnersPage /></ProtectedPage>} />
                        <Route path="transactions/:tab?" element={<ProtectedPage><TransactionsPage /></ProtectedPage>} />
                        <Route path="general-ledger/:tab?" element={<ProtectedPage><GeneralLedgerPage /></ProtectedPage>} />
                        <Route path="profit-and-loss/:tab?" element={<ProtectedPage><ProfitAndLoss /></ProtectedPage>} />
                        <Route path="balance-sheet/:tab?" element={<ProtectedPage><BalanceSheet /></ProtectedPage>} />
                        <Route path="annual-report" element={<ProtectedPage><AnnualReportPage /></ProtectedPage>} />
                        <Route path="vat-return/:tab?" element={<ProtectedPage><VatReturnPage /></ProtectedPage>} />
                        <Route path="kintlevo/:tab?" element={<ProtectedPage><KintlevoPage /></ProtectedPage>} />
                        <Route path="petty-cash/:tab?" element={<ProtectedPage><PettyCashPage /></ProtectedPage>} />
                        <Route path="teny/:tab?" element={<ProtectedPage><FixedAssetsPage /></ProtectedPage>} />

                        <Route path="exchange-rates" element={<ProtectedPage><ExchangeRates /></ProtectedPage>} />
                        <Route path="salaries/:tab?" element={<ProtectedPage><SalariesPage /></ProtectedPage>} />
                        <Route path="working-time/:tab?" element={<ProtectedPage><WorkingTimePage /></ProtectedPage>} />
                        <Route path="analytics/:tab?" element={<ProtectedPage><Analytics /></ProtectedPage>} />
                        <Route path="shipments" element={<ProtectedPage><ShipmentMatchingDashboard /></ProtectedPage>} />
                        <Route path="shipments/import" element={<ProtectedPage><ShipmentImportPage /></ProtectedPage>} />
                        <Route path="shipments/escalated" element={<ProtectedPage><EscalationListPage /></ProtectedPage>} />
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
                      <Route path="/profit-and-loss" element={<LegacyRedirect page="profit-and-loss" />} />
                      <Route path="/balance-sheet" element={<LegacyRedirect page="balance-sheet" />} />
                      <Route path="/kintlevo" element={<LegacyRedirect page="kintlevo" />} />
                      <Route path="/petty-cash" element={<LegacyRedirect page="petty-cash" />} />
                      <Route path="/teny" element={<LegacyRedirect page="teny" />} />

                      <Route path="/exchange-rates" element={<LegacyRedirect page="exchange-rates" />} />
                      <Route path="/salaries" element={<LegacyRedirect page="salaries" />} />
                      <Route path="/working-time" element={<LegacyRedirect page="working-time" />} />
                      <Route path="/analytics" element={<LegacyRedirect page="analytics" />} />
                      <Route path="/tickets" element={<LegacyRedirect page="tickets" />} />
                      <Route path="/onboarding" element={<LegacyRedirect page="categories" />} />
                      <Route path="/shipments" element={<LegacyRedirect page="shipments" />} />
                      <Route path="/shipments/import" element={<LegacyRedirect page="shipments/import" />} />
                      <Route path="/shipments/escalated" element={<LegacyRedirect page="shipments/escalated" />} />
                      {/* Legacy matching routes → redirect to consolidated /shipments */}
                      <Route path="/shipment-matching" element={<LegacyRedirect page="shipments" />} />
                      <Route path="/shipment-matching/escalated" element={<LegacyRedirect page="shipments/escalated" />} />

                      {/* Root → scoped dashboard */}
                      <Route path="/" element={<RootRedirect />} />
                    </Route>

                    <Route path="*" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><NotFound /></Suspense>} />
                  </Routes>
                </BrowserRouter>
                </ErrorBoundary>
              </TooltipProvider>

          </DateRangeProvider>
        </CompanyProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
