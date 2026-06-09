import { Suspense, lazy, useEffect } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

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
const AccountyOnboardingPage = lazy(() => import("./pages/Accounty/OnboardingPage"));
const AiAssistantPage = lazy(() => import("./pages/Accounty/AiAssistantPage"));
const ProfileSettingsPage = lazy(() => import("./pages/Accounty/ProfileSettingsPage"));

// Portfolio pages
const AlertsCenterPage = lazy(() => import("./pages/Accounty/AlertsCenterPage"));
const NavDeadlinesPage = lazy(() => import("./pages/Accounty/NavDeadlinesPage"));
const PayrollPortfolioPage = lazy(() => import("./pages/Accounty/PayrollPortfolioPage"));
const VatReturnPage = lazy(() => import("./pages/VatReturnPage"));
const TicketsPage = lazy(() => import("./pages/TicketsPage"));

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

  if (roleLoading) return null;
  if (profileRole === 'management') {
    return <Navigate to="/management" replace />;
  }

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
                        <Suspense fallback={<LoadingSpinner message="Betöltés..." />}>
                          <RemoveInitialLoader />
                          <AccountyLayout />
                        </Suspense>
                      </ProtectedPage>
                    }>
                      <Route index element={<AccountyApp />} />
                      <Route path="client/:id" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><ClientDetailsPage /></Suspense>} />
                      <Route path="missing-invoices" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><MissingInvoicesPage /></Suspense>} />
                      <Route path="missing-invoices/:id" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><ClientMissingInvoicesPage /></Suspense>} />
                      <Route path="client/:id/reports" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><ClientReportsPage /></Suspense>} />
                      <Route path="client/:id/reports/missing-invoices" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><ClientMissingInvoicesReportPage /></Suspense>} />
                      <Route path="client/:id/invoices" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><ClientInvoicesPage /></Suspense>} />
                      <Route path="reports" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><ReportsPage /></Suspense>} />
                      <Route path="reports/missing-invoices" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><MissingInvoicesReportPage /></Suspense>} />
                      <Route path="tax-calendar" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><TaxCalendarPage /></Suspense>} />
                      <Route path="settings" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><SettingsPage /></Suspense>} />
                      <Route path="help" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><HelpPage /></Suspense>} />
                      <Route path="tickets/:ticketId?" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><TicketsPage /></Suspense>} />
                      <Route path="approval-queue" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><ApprovalQueuePage /></Suspense>} />
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
                      <Route path="new-client" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><NewClientPage /></Suspense>} />
                      {/* Admin modules */}
                      <Route path="admin/audit" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><AuditLogPage /></Suspense>} />
                      <Route path="admin/gdpr" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><GdprPage /></Suspense>} />
                      <Route path="admin/templates" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><TemplatesPage /></Suspense>} />
                      <Route path="admin/job-codes" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><JobCodesPage /></Suspense>} />
                      <Route path="admin/tax-parameters" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><AdminTaxParametersPage /></Suspense>} />
                      <Route path="admin/legal-updates" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><LegalUpdatesPage /></Suspense>} />
                      {/* Portfolio pages */}
                      <Route path="alerts" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><AlertsCenterPage /></Suspense>} />
                      <Route path="nav-deadlines" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><NavDeadlinesPage /></Suspense>} />
                      <Route path="payroll-portfolio" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><PayrollPortfolioPage /></Suspense>} />
                      <Route path="onboarding" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><AccountyOnboardingPage /></Suspense>} />
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

                      {/* Root → scoped dashboard */}
                      <Route path="/" element={<RootRedirect />} />
                    </Route>

                    <Route path="*" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><NotFound /></Suspense>} />
                  </Routes>
                </BrowserRouter>
              </TooltipProvider>

          </DateRangeProvider>
        </CompanyProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
