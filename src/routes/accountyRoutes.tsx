import React, { Suspense, lazy } from "react";
import { Navigate, Route } from "react-router-dom";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ProtectedAccountyRoute } from "@/pages/Accounty/ProtectedAccountyRoute";
import { ProtectedPage, RemoveInitialLoader } from "./shellComponents";
import {
  AccountyRootRedirect,
  AccountyLegacyClientRedirect,
  PayrollLegacyRedirect,
  MissingInvoicesLegacyRedirect,
} from "./redirects";

import AccountyLayout from "@/pages/Accounty/AccountyLayout";

// Lazy-loaded Accounty Shell & Layouts
const AccountyScopedLayout = lazy(() => import("@/pages/Accounty/AccountyScopedLayout"));
const NewClientPage = lazy(() => import("@/pages/Accounty/NewClientPage"));

// Client scoped pages
const ClientDetailsPage = lazy(() => import("@/pages/Accounty/ClientDetailsPage"));
const AccountingRedirectPage = lazy(() => import("@/pages/Accounty/AccountingRedirectPage"));
const ClientInvoicesPage = lazy(() => import("@/pages/Accounty/ClientInvoicesPage"));
const ClientMissingInvoicesPage = lazy(() => import("@/pages/Accounty/ClientMissingInvoicesPage"));
const ClientReportsPage = lazy(() => import("@/pages/Accounty/ClientReportsPage"));
const ClientMissingInvoicesReportPage = lazy(() => import("@/pages/Accounty/ClientMissingInvoicesReportPage"));
const ClientPortalPage = lazy(() => import("@/pages/Accounty/ClientPortalPage"));
const CegkapuSettingsPage = lazy(() => import("@/pages/Accounty/CegkapuSettingsPage"));
const RepresentationPage = lazy(() => import("@/pages/Accounty/RepresentationPage"));
const DataRetentionPage = lazy(() => import("@/pages/Accounty/DataRetentionPage"));
const CompanyStructurePage = lazy(() => import("@/pages/Accounty/CompanyStructurePage"));

// Payroll module
const PayrollDashboardPage = lazy(() => import("@/pages/Accounty/PayrollDashboardPage"));
const PayrollEmployeesPage = lazy(() => import("@/pages/Accounty/EmployeesPage"));
const PayrollEmployeeWizardPage = lazy(() => import("@/pages/Accounty/EmployeeWizardPage"));
const PayrollEmployeeDetailsPage = lazy(() => import("@/pages/Accounty/EmployeeDetailsPage"));
const PayrollCyclePage = lazy(() => import("@/pages/Accounty/PayrollCyclePage"));
const PayrollTaxParametersPage = lazy(() => import("@/pages/Accounty/TaxParametersPage"));
const PayrollFilingsPage = lazy(() => import("@/pages/Accounty/FilingsPage"));
const PayrollReportsPage = lazy(() => import("@/pages/Accounty/PayrollReportsPage"));
const CompanyPayrollSettingsPage = lazy(() => import("@/pages/Accounty/CompanyPayrollSettingsPage"));
const EmployeeImportPage = lazy(() => import("@/pages/Accounty/EmployeeImportPage"));
const JobModificationPage = lazy(() => import("@/pages/Accounty/JobModificationPage"));
const MultiJobPage = lazy(() => import("@/pages/Accounty/MultiJobPage"));
const DeclarationsOverviewPage = lazy(() => import("@/pages/Accounty/declarations/DeclarationsOverviewPage"));
const DeclarationArchivePage = lazy(() => import("@/pages/Accounty/declarations/DeclarationArchivePage"));
const FamilyDeclarationPage = lazy(() => import("@/pages/Accounty/declarations/FamilyDeclarationPage"));
const GenericDeclarationPage = lazy(() => import("@/pages/Accounty/declarations/GenericDeclarationPage"));
const DocumentCenterPage = lazy(() => import("@/pages/Accounty/documents/DocumentCenterPage"));
const PayslipGeneratorPage = lazy(() => import("@/pages/Accounty/documents/PayslipGeneratorPage"));
const TransferListPage = lazy(() => import("@/pages/Accounty/documents/TransferListPage"));
const EPayslipPortalPage = lazy(() => import("@/pages/Accounty/documents/EPayslipPortalPage"));
const OutputDocumentsPage = lazy(() => import("@/pages/Accounty/documents/OutputDocumentsPage"));
const EmployeeExitWizardPage = lazy(() => import("@/pages/Accounty/EmployeeExitWizardPage"));
const ExitDocumentsPage = lazy(() => import("@/pages/Accounty/ExitDocumentsPage"));
const Filing08EPage = lazy(() => import("@/pages/Accounty/filings/Filing08EPage"));
const Filing2608Page = lazy(() => import("@/pages/Accounty/filings/Filing2608Page"));
const GenericFilingPage = lazy(() => import("@/pages/Accounty/filings/GenericFilingPage"));
const FilingWorkflowPage = lazy(() => import("@/pages/Accounty/filings/FilingWorkflowPage"));
const SpecialJobFormsPage = lazy(() => import("@/pages/Accounty/SpecialJobFormsPage"));
const YearEndDashboardPage = lazy(() => import("@/pages/Accounty/YearEndDashboardPage"));
const PayrollAdvancedReportsPage = lazy(() => import("@/pages/Accounty/reports/PayrollAdvancedReportsPage"));
const AiAnomalyReportPage = lazy(() => import("@/pages/Accounty/reports/AiAnomalyReportPage"));
const CustomReportBuilderPage = lazy(() => import("@/pages/Accounty/reports/CustomReportBuilderPage"));

// TAO/KIVA module
const TaoPortfolioPage = lazy(() => import("@/pages/Accounty/Tao/TaoPortfolioPage"));
const TaoCalendarPage2 = lazy(() => import("@/pages/Accounty/Tao/TaoCalendarPage"));
const TaoTaxpayerTypesPage = lazy(() => import("@/pages/Accounty/Tao/TaoTaxpayerTypesPage"));
const ClientTaoMainPage = lazy(() => import("@/pages/Accounty/Tao/ClientTaoMainPage"));
const TaoSetupWizardPage = lazy(() => import("@/pages/Accounty/Tao/TaoSetupWizardPage"));
const TaoMasterDataPage = lazy(() => import("@/pages/Accounty/Tao/TaoMasterDataPage"));
const TaoLifecyclePage = lazy(() => import("@/pages/Accounty/Tao/TaoLifecyclePage"));
const TaoBusinessYearPage = lazy(() => import("@/pages/Accounty/Tao/TaoBusinessYearPage"));
const TaoAccountingRegimePage = lazy(() => import("@/pages/Accounty/Tao/TaoAccountingRegimePage"));
const TaoCurrencyPage = lazy(() => import("@/pages/Accounty/Tao/TaoCurrencyPage"));
const TaoYearEndWizardPage = lazy(() => import("@/pages/Accounty/Tao/TaoYearEndWizardPage"));
const KivaCalculatorPage = lazy(() => import("@/pages/Accounty/Tao/KivaCalculatorPage"));
const TaoKivaComparePage = lazy(() => import("@/pages/Accounty/Tao/TaoKivaComparePage"));

// EV module
const EvPortfolioDashboard = lazy(() => import("@/pages/Accounty/Ev/EvPortfolioDashboard"));
const EvCalendarPage = lazy(() => import("@/pages/Accounty/Ev/EvCalendarPage"));
const EvFormsOverviewPage = lazy(() => import("@/pages/Accounty/Ev/EvFormsOverviewPage"));
const EvThresholdMonitorPage = lazy(() => import("@/pages/Accounty/Ev/EvThresholdMonitorPage"));
const ClientEvMainPage = lazy(() => import("@/pages/Accounty/Ev/ClientEvMainPage"));
const EvSetupWizardPage = lazy(() => import("@/pages/Accounty/Ev/EvSetupWizardPage"));
const EvMasterDataPage = lazy(() => import("@/pages/Accounty/Ev/EvMasterDataPage"));
const EvLifecyclePage = lazy(() => import("@/pages/Accounty/Ev/EvLifecyclePage"));
const EvFlatRatePage = lazy(() => import("@/pages/Accounty/Ev/EvFlatRatePage"));
const EvEntrepreneurialBasePage = lazy(() => import("@/pages/Accounty/Ev/EvEntrepreneurialBasePage"));
const EvEntrepreneurialDividendPage = lazy(() => import("@/pages/Accounty/Ev/EvEntrepreneurialDividendPage"));
const EvDepreciationPage = lazy(() => import("@/pages/Accounty/Ev/EvDepreciationPage"));
const EvKataPage = lazy(() => import("@/pages/Accounty/Ev/EvKataPage"));
const EvComparePage = lazy(() => import("@/pages/Accounty/Ev/EvComparePage"));
const CashbookMainPage = lazy(() => import("@/pages/Accounty/Ev/CashbookMainPage"));
const CashbookLedgerView = lazy(() => import("@/pages/Accounty/Ev/CashbookLedgerView"));
const CashbookCloseWizard = lazy(() => import("@/pages/Accounty/Ev/CashbookCloseWizard"));
const EvCashbookImportNavPage = lazy(() => import("@/pages/Accounty/Ev/EvCashbookImportNavPage"));
const EvContributionsPage = lazy(() => import("@/pages/Accounty/Ev/EvContributionsPage"));
const EvHipaPage = lazy(() => import("@/pages/Accounty/Ev/EvHipaPage"));
const EvVatPage = lazy(() => import("@/pages/Accounty/Ev/EvVatPage"));
const EvChamberPage = lazy(() => import("@/pages/Accounty/Ev/EvChamberPage"));
const EvCompanyCarTaxPage = lazy(() => import("@/pages/Accounty/Ev/EvCompanyCarTaxPage"));
const EvInnovationLevyPage = lazy(() => import("@/pages/Accounty/Ev/EvInnovationLevyPage"));
const EvSzjaReturnPage = lazy(() => import("@/pages/Accounty/Ev/EvSzjaReturnPage"));
const EvContribReturnPage = lazy(() => import("@/pages/Accounty/Ev/EvContribReturnPage"));
const EvKataReturnPage = lazy(() => import("@/pages/Accounty/Ev/EvKataReturnPage"));
const EvHipaReturnPage = lazy(() => import("@/pages/Accounty/Ev/EvHipaReturnPage"));
const EvVatCarReturnPage = lazy(() => import("@/pages/Accounty/Ev/EvVatCarReturnPage"));
const EvRecordsOverviewPage = lazy(() => import("@/pages/Accounty/Ev/EvRecordsOverviewPage"));
const EvRecordDetailPage = lazy(() => import("@/pages/Accounty/Ev/EvRecordDetailPage"));
const EvIncomeReportPage = lazy(() => import("@/pages/Accounty/Ev/EvIncomeReportPage"));
const EvOptimizationPage = lazy(() => import("@/pages/Accounty/Ev/EvOptimizationPage"));
const OrgBookkeepingModePage = lazy(() => import("@/pages/Accounty/Ev/OrgBookkeepingModePage"));
const OrgCivilPage = lazy(() => import("@/pages/Accounty/Ev/OrgCivilPage"));
const OrgCondominiumPage = lazy(() => import("@/pages/Accounty/Ev/OrgCondominiumPage"));
const OrgOtherPage = lazy(() => import("@/pages/Accounty/Ev/OrgOtherPage"));
const OrgSimplifiedReportPage = lazy(() => import("@/pages/Accounty/Ev/OrgSimplifiedReportPage"));

// Portfolio / Admin pages
const MissingInvoicesPage = lazy(() => import("@/pages/Accounty/MissingInvoicesPage"));
const MissingInvoicesReportPage = lazy(() => import("@/pages/Accounty/MissingInvoicesReportPage"));
const ReportsPage = lazy(() => import("@/pages/Accounty/ReportsPage"));
const TaxCalendarPage = lazy(() => import("@/pages/Accounty/TaxCalendarPage"));
const SettingsPage = lazy(() => import("@/pages/Accounty/SettingsPage"));
const PrivacyPolicyPage = lazy(() => import("@/pages/Accounty/PrivacyPolicyPage"));
const HelpPage = lazy(() => import("@/pages/Accounty/HelpPage"));
const TicketsPage = lazy(() => import("@/pages/TicketsPage"));
const ApprovalQueuePage = lazy(() => import("@/pages/Accounty/ApprovalQueuePage"));
const AuditLogPage = lazy(() => import("@/pages/Accounty/AuditLogPage"));
const GdprPage = lazy(() => import("@/pages/Accounty/GdprPage"));
const TemplatesPage = lazy(() => import("@/pages/Accounty/TemplatesPage"));
const JobCodesPage = lazy(() => import("@/pages/Accounty/JobCodesPage"));
const AdminTaxParametersPage = lazy(() => import("@/pages/Accounty/AdminTaxParametersPage"));
const LegalUpdatesPage = lazy(() => import("@/pages/Accounty/LegalUpdatesPage"));
const OfficeSettingsPage = lazy(() => import("@/pages/Accounty/admin/OfficeSettingsPage"));
const PermissionMatrixPage = lazy(() => import("@/pages/Accounty/PermissionMatrixPage"));
const AccountantManagementPage = lazy(() => import("@/pages/Accounty/AccountantManagementPage"));
const AlertsCenterPage = lazy(() => import("@/pages/Accounty/AlertsCenterPage"));
const NavDeadlinesPage = lazy(() => import("@/pages/Accounty/NavDeadlinesPage"));
const AccountyOnboardingPage = lazy(() => import("@/pages/Accounty/OnboardingPage"));
const AiAssistantPage = lazy(() => import("@/pages/Accounty/AiAssistantPage"));
const ProfileSettingsPage = lazy(() => import("@/pages/Accounty/ProfileSettingsPage"));
const PromptsPage = lazy(() => import("@/pages/Accounty/PromptsPage"));

function AccountyPageSkeleton() {
  return (
    <div className="w-full space-y-6 animate-pulse p-2">
      <div className="flex items-center justify-between gap-4">
        <div className="h-8 w-48 bg-muted/60 rounded-lg" />
        <div className="h-8 w-32 bg-muted/40 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="h-24 bg-card border border-border/50 rounded-xl p-4 space-y-2">
          <div className="h-4 w-20 bg-muted/60 rounded" />
          <div className="h-7 w-16 bg-muted/80 rounded" />
        </div>
        <div className="h-24 bg-card border border-border/50 rounded-xl p-4 space-y-2">
          <div className="h-4 w-24 bg-muted/60 rounded" />
          <div className="h-7 w-16 bg-muted/80 rounded" />
        </div>
        <div className="h-24 bg-card border border-border/50 rounded-xl p-4 space-y-2">
          <div className="h-4 w-20 bg-muted/60 rounded" />
          <div className="h-7 w-16 bg-muted/80 rounded" />
        </div>
        <div className="h-24 bg-card border border-border/50 rounded-xl p-4 space-y-2">
          <div className="h-4 w-28 bg-muted/60 rounded" />
          <div className="h-7 w-16 bg-muted/80 rounded" />
        </div>
      </div>
      <div className="h-64 bg-card border border-border/50 rounded-xl p-4 space-y-3">
        <div className="h-8 w-full bg-muted/40 rounded" />
        <div className="h-10 w-full bg-muted/20 rounded" />
        <div className="h-10 w-full bg-muted/30 rounded" />
        <div className="h-10 w-full bg-muted/20 rounded" />
      </div>
    </div>
  );
}

export function renderAccountyRoutes() {
  return (
    <>
      {/* Legacy redirects from /accounty to /eaisybooks */}
      <Route path="/accounty" element={<Navigate to="/eaisybooks" replace />} />
      <Route
        path="/accounty/*"
        element={<Navigate to={window.location.pathname.replace(/^\/accounty/, '/eaisybooks') + window.location.search} replace />}
      />

      {/* Accounty New Client Wizard (No Layout) */}
      <Route
        path="/eaisybooks/new-client"
        element={
          <ProtectedPage>
            <Suspense fallback={<LoadingSpinner message="Betöltés..." />}>
              <RemoveInitialLoader />
              <NewClientPage />
            </Suspense>
          </ProtectedPage>
        }
      />

      {/* Accounty frontend – standalone layout */}
      <Route
        path="/eaisybooks"
        element={
          <ProtectedPage>
            <RemoveInitialLoader />
            <AccountyLayout />
          </ProtectedPage>
        }
      >
        <Route index element={<AccountyRootRedirect />} />

        {/* Legacy redirects & fallbacks */}
        <Route path="client/:id" element={<AccountyLegacyClientRedirect />} />
        <Route path="client/:id/*" element={<AccountyLegacyClientRedirect />} />
        <Route path="payroll/:id" element={<PayrollLegacyRedirect />} />
        <Route path="payroll/:id/*" element={<PayrollLegacyRedirect />} />
        <Route path="missing-invoices/:id" element={<MissingInvoicesLegacyRedirect />} />
        <Route path="missing-invoices/:id/*" element={<MissingInvoicesLegacyRedirect />} />
        <Route path="client/:id/ev" element={<AccountyLegacyClientRedirect />} />
        <Route path="client/:id/ev/*" element={<AccountyLegacyClientRedirect />} />
        <Route path="client/:id/tao" element={<AccountyLegacyClientRedirect />} />
        <Route path="client/:id/tao/*" element={<AccountyLegacyClientRedirect />} />
        <Route path="client/:id/payroll" element={<AccountyLegacyClientRedirect />} />
        <Route path="client/:id/payroll/*" element={<AccountyLegacyClientRedirect />} />
        <Route path="client/:id/invoices" element={<AccountyLegacyClientRedirect />} />
        <Route path="client/:id/invoices/*" element={<AccountyLegacyClientRedirect />} />
        <Route path="client/:id/missing-invoices" element={<AccountyLegacyClientRedirect />} />
        <Route path="client/:id/missing-invoices/*" element={<AccountyLegacyClientRedirect />} />
        <Route path="client/:id/reports" element={<AccountyLegacyClientRedirect />} />
        <Route path="client/:id/reports/*" element={<AccountyLegacyClientRedirect />} />
        <Route path="client/:id/settings" element={<AccountyLegacyClientRedirect />} />
        <Route path="client/:id/settings/*" element={<AccountyLegacyClientRedirect />} />
        <Route path="client/:id/overview" element={<AccountyLegacyClientRedirect />} />
        <Route path="client/:id/overview/*" element={<AccountyLegacyClientRedirect />} />
        <Route path="client/:id/profile" element={<AccountyLegacyClientRedirect />} />
        <Route path="client/:id/profile/*" element={<AccountyLegacyClientRedirect />} />
        <Route path="client/:id/accounting" element={<AccountyLegacyClientRedirect />} />
        <Route path="client/:id/accounting/*" element={<AccountyLegacyClientRedirect />} />

        {/* Client scoped routes */}
        <Route
          path=":companyId/:dateRange"
          element={
            <Suspense fallback={<AccountyPageSkeleton />}>
              <AccountyScopedLayout />
            </Suspense>
          }
        >
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<Suspense fallback={<AccountyPageSkeleton />}><ClientDetailsPage /></Suspense>} />
          <Route path="profile" element={<Suspense fallback={<AccountyPageSkeleton />}><ClientDetailsPage /></Suspense>} />
          <Route path="accounting" element={<Suspense fallback={<AccountyPageSkeleton />}><AccountingRedirectPage /></Suspense>} />
          <Route path="settings" element={<Suspense fallback={<AccountyPageSkeleton />}><ClientDetailsPage /></Suspense>} />

          {/* Client-Centric Payroll Routes */}
          <Route path="payroll" element={<Suspense fallback={<AccountyPageSkeleton />}><PayrollDashboardPage /></Suspense>} />
          <Route path="payroll/employees" element={<Suspense fallback={<AccountyPageSkeleton />}><PayrollEmployeesPage /></Suspense>} />
          <Route path="payroll/employees/new" element={<Suspense fallback={<AccountyPageSkeleton />}><PayrollEmployeeWizardPage /></Suspense>} />
          <Route path="payroll/employees/:empId" element={<Suspense fallback={<AccountyPageSkeleton />}><PayrollEmployeeDetailsPage /></Suspense>} />
          <Route path="payroll/cycle/new" element={<Suspense fallback={<AccountyPageSkeleton />}><PayrollCyclePage /></Suspense>} />
          <Route path="payroll/cycle/:cycleId" element={<Suspense fallback={<AccountyPageSkeleton />}><PayrollCyclePage /></Suspense>} />
          <Route path="payroll/filings" element={<Suspense fallback={<AccountyPageSkeleton />}><PayrollFilingsPage /></Suspense>} />
          <Route path="payroll/reports" element={<Suspense fallback={<AccountyPageSkeleton />}><PayrollReportsPage /></Suspense>} />
          <Route path="payroll/portal" element={<Suspense fallback={<AccountyPageSkeleton />}><ClientPortalPage /></Suspense>} />
          <Route path="payroll/tax-params" element={<Suspense fallback={<AccountyPageSkeleton />}><PayrollTaxParametersPage /></Suspense>} />
          <Route path="payroll/settings" element={<Suspense fallback={<AccountyPageSkeleton />}><CompanyPayrollSettingsPage /></Suspense>} />

          {/* Employee extensions */}
          <Route path="payroll/employees/import" element={<Suspense fallback={<AccountyPageSkeleton />}><EmployeeImportPage /></Suspense>} />
          <Route path="payroll/employees/:empId/modification" element={<Suspense fallback={<AccountyPageSkeleton />}><JobModificationPage /></Suspense>} />
          <Route path="payroll/employees/:empId/multi-job" element={<Suspense fallback={<AccountyPageSkeleton />}><MultiJobPage /></Suspense>} />
          {/* Declarations */}
          <Route path="payroll/declarations" element={<Suspense fallback={<AccountyPageSkeleton />}><DeclarationsOverviewPage /></Suspense>} />
          <Route path="payroll/declarations/archive" element={<Suspense fallback={<AccountyPageSkeleton />}><DeclarationArchivePage /></Suspense>} />
          <Route path="payroll/declarations/family" element={<Suspense fallback={<AccountyPageSkeleton />}><FamilyDeclarationPage /></Suspense>} />
          <Route path="payroll/declarations/:type" element={<Suspense fallback={<AccountyPageSkeleton />}><GenericDeclarationPage /></Suspense>} />
          {/* Documents */}
          <Route path="payroll/documents" element={<Suspense fallback={<AccountyPageSkeleton />}><DocumentCenterPage /></Suspense>} />
          <Route path="payroll/documents/payslips" element={<Suspense fallback={<AccountyPageSkeleton />}><PayslipGeneratorPage /></Suspense>} />
          <Route path="payroll/documents/transfer" element={<Suspense fallback={<AccountyPageSkeleton />}><TransferListPage /></Suspense>} />
          <Route path="payroll/documents/e-payslip" element={<Suspense fallback={<AccountyPageSkeleton />}><EPayslipPortalPage /></Suspense>} />
          <Route path="payroll/documents/all" element={<Suspense fallback={<AccountyPageSkeleton />}><OutputDocumentsPage /></Suspense>} />
          <Route path="payroll/documents/:docType" element={<Suspense fallback={<AccountyPageSkeleton />}><OutputDocumentsPage /></Suspense>} />
          {/* Exit */}
          <Route path="payroll/employees/:empId/exit" element={<Suspense fallback={<AccountyPageSkeleton />}><EmployeeExitWizardPage /></Suspense>} />
          <Route path="payroll/employees/:empId/exit-docs" element={<Suspense fallback={<AccountyPageSkeleton />}><ExitDocumentsPage /></Suspense>} />
          {/* Filings */}
          <Route path="payroll/filings/08e" element={<Suspense fallback={<AccountyPageSkeleton />}><Filing08EPage /></Suspense>} />
          <Route path="payroll/filings/2608" element={<Suspense fallback={<AccountyPageSkeleton />}><Filing2608Page /></Suspense>} />
          <Route path="payroll/filings/all" element={<Suspense fallback={<AccountyPageSkeleton />}><GenericFilingPage /></Suspense>} />
          <Route path="payroll/filings/:filingType" element={<Suspense fallback={<AccountyPageSkeleton />}><GenericFilingPage /></Suspense>} />
          <Route path="payroll/filings/:filingId/workflow" element={<Suspense fallback={<AccountyPageSkeleton />}><FilingWorkflowPage /></Suspense>} />
          {/* Special job forms */}
          <Route path="payroll/employees/:empId/special" element={<Suspense fallback={<AccountyPageSkeleton />}><SpecialJobFormsPage /></Suspense>} />
          <Route path="payroll/employees/:empId/special/:jobType" element={<Suspense fallback={<AccountyPageSkeleton />}><SpecialJobFormsPage /></Suspense>} />
          {/* Year End & Advanced Reports */}
          <Route path="payroll/year-end" element={<Suspense fallback={<AccountyPageSkeleton />}><YearEndDashboardPage /></Suspense>} />
          <Route path="payroll/advanced-reports" element={<Suspense fallback={<AccountyPageSkeleton />}><PayrollAdvancedReportsPage /></Suspense>} />
          <Route path="payroll/advanced-reports/anomaly" element={<Suspense fallback={<AccountyPageSkeleton />}><AiAnomalyReportPage /></Suspense>} />
          <Route path="payroll/advanced-reports/custom" element={<Suspense fallback={<AccountyPageSkeleton />}><CustomReportBuilderPage /></Suspense>} />

          {/* Invoices, reports and missing invoices */}
          <Route path="missing-invoices" element={<Suspense fallback={<AccountyPageSkeleton />}><ClientMissingInvoicesPage /></Suspense>} />
          <Route path="reports" element={<Suspense fallback={<AccountyPageSkeleton />}><ClientReportsPage /></Suspense>} />
          <Route path="reports/missing-invoices" element={<Suspense fallback={<AccountyPageSkeleton />}><ClientMissingInvoicesReportPage /></Suspense>} />
          <Route path="invoices" element={<Suspense fallback={<AccountyPageSkeleton />}><ClientInvoicesPage /></Suspense>} />

          {/* Settings and others */}
          <Route path="prompts" element={<Suspense fallback={<AccountyPageSkeleton />}><PromptsPage /></Suspense>} />
          <Route path="cegkapu" element={<Suspense fallback={<AccountyPageSkeleton />}><CegkapuSettingsPage /></Suspense>} />
          <Route path="representation" element={<Suspense fallback={<AccountyPageSkeleton />}><RepresentationPage /></Suspense>} />
          <Route path="data-retention" element={<Suspense fallback={<AccountyPageSkeleton />}><DataRetentionPage /></Suspense>} />
          <Route path="structure" element={<Suspense fallback={<AccountyPageSkeleton />}><CompanyStructurePage /></Suspense>} />

          {/* TAO client-level */}
          <Route path="tao" element={<Suspense fallback={<AccountyPageSkeleton />}><ClientTaoMainPage /></Suspense>} />
          <Route path="tao/setup" element={<Suspense fallback={<AccountyPageSkeleton />}><TaoSetupWizardPage /></Suspense>} />
          <Route path="tao/master-data" element={<Suspense fallback={<AccountyPageSkeleton />}><TaoMasterDataPage /></Suspense>} />
          <Route path="tao/lifecycle" element={<Suspense fallback={<AccountyPageSkeleton />}><TaoLifecyclePage /></Suspense>} />
          <Route path="tao/business-year" element={<Suspense fallback={<AccountyPageSkeleton />}><TaoBusinessYearPage /></Suspense>} />
          <Route path="tao/accounting-regime" element={<Suspense fallback={<AccountyPageSkeleton />}><TaoAccountingRegimePage /></Suspense>} />
          <Route path="tao/currency" element={<Suspense fallback={<AccountyPageSkeleton />}><TaoCurrencyPage /></Suspense>} />
          <Route path="tao/year-end/:year" element={<Suspense fallback={<AccountyPageSkeleton />}><TaoYearEndWizardPage /></Suspense>} />
          <Route path="tao/kiva" element={<Suspense fallback={<AccountyPageSkeleton />}><KivaCalculatorPage /></Suspense>} />
          <Route path="tao/compare" element={<Suspense fallback={<AccountyPageSkeleton />}><TaoKivaComparePage /></Suspense>} />

          {/* EV client-level */}
          <Route path="ev" element={<Suspense fallback={<AccountyPageSkeleton />}><ClientEvMainPage /></Suspense>} />
          <Route path="ev/setup" element={<Suspense fallback={<AccountyPageSkeleton />}><EvSetupWizardPage /></Suspense>} />
          <Route path="ev/master-data" element={<Suspense fallback={<AccountyPageSkeleton />}><EvMasterDataPage /></Suspense>} />
          <Route path="ev/lifecycle" element={<Suspense fallback={<AccountyPageSkeleton />}><EvLifecyclePage /></Suspense>} />
          <Route path="ev/flat-rate" element={<Suspense fallback={<AccountyPageSkeleton />}><EvFlatRatePage /></Suspense>} />
          <Route path="ev/entrepreneurial/base" element={<Suspense fallback={<AccountyPageSkeleton />}><EvEntrepreneurialBasePage /></Suspense>} />
          <Route path="ev/entrepreneurial/dividend" element={<Suspense fallback={<AccountyPageSkeleton />}><EvEntrepreneurialDividendPage /></Suspense>} />
          <Route path="ev/cashbook" element={<Suspense fallback={<AccountyPageSkeleton />}><CashbookMainPage /></Suspense>} />
          <Route path="ev/cashbook/ledger" element={<Suspense fallback={<AccountyPageSkeleton />}><CashbookLedgerView /></Suspense>} />
          <Route path="ev/cashbook/close" element={<Suspense fallback={<AccountyPageSkeleton />}><CashbookCloseWizard /></Suspense>} />
          <Route path="ev/cashbook/import-nav" element={<Suspense fallback={<AccountyPageSkeleton />}><EvCashbookImportNavPage /></Suspense>} />
          <Route path="ev/depreciation" element={<Suspense fallback={<AccountyPageSkeleton />}><EvDepreciationPage /></Suspense>} />
          <Route path="ev/kata" element={<Suspense fallback={<AccountyPageSkeleton />}><EvKataPage /></Suspense>} />
          <Route path="ev/thresholds" element={<Suspense fallback={<AccountyPageSkeleton />}><EvThresholdMonitorPage /></Suspense>} />
          <Route path="ev/compare" element={<Suspense fallback={<AccountyPageSkeleton />}><EvComparePage /></Suspense>} />
          <Route path="ev/contributions" element={<Suspense fallback={<AccountyPageSkeleton />}><EvContributionsPage /></Suspense>} />
          <Route path="ev/hipa" element={<Suspense fallback={<AccountyPageSkeleton />}><EvHipaPage /></Suspense>} />
          <Route path="ev/vat" element={<Suspense fallback={<AccountyPageSkeleton />}><EvVatPage /></Suspense>} />
          <Route path="ev/chamber" element={<Suspense fallback={<AccountyPageSkeleton />}><EvChamberPage /></Suspense>} />
          <Route path="ev/car-tax" element={<Suspense fallback={<AccountyPageSkeleton />}><EvCompanyCarTaxPage /></Suspense>} />
          <Route path="ev/innovation" element={<Suspense fallback={<AccountyPageSkeleton />}><EvInnovationLevyPage /></Suspense>} />
          <Route path="ev/returns" element={<Suspense fallback={<AccountyPageSkeleton />}><EvSzjaReturnPage /></Suspense>} />
          <Route path="ev/returns/contrib" element={<Suspense fallback={<AccountyPageSkeleton />}><EvContribReturnPage /></Suspense>} />
          <Route path="ev/returns/kata" element={<Suspense fallback={<AccountyPageSkeleton />}><EvKataReturnPage /></Suspense>} />
          <Route path="ev/returns/hipa" element={<Suspense fallback={<AccountyPageSkeleton />}><EvHipaReturnPage /></Suspense>} />
          <Route path="ev/returns/vat-car" element={<Suspense fallback={<AccountyPageSkeleton />}><EvVatCarReturnPage /></Suspense>} />
          <Route path="ev/records" element={<Suspense fallback={<AccountyPageSkeleton />}><EvRecordsOverviewPage /></Suspense>} />
          <Route path="ev/records/:recordType" element={<Suspense fallback={<AccountyPageSkeleton />}><EvRecordDetailPage /></Suspense>} />
          <Route path="ev/income-report" element={<Suspense fallback={<AccountyPageSkeleton />}><EvIncomeReportPage /></Suspense>} />
          <Route path="ev/optimization" element={<Suspense fallback={<AccountyPageSkeleton />}><EvOptimizationPage /></Suspense>} />
          <Route path="ev/org/bookkeeping" element={<Suspense fallback={<AccountyPageSkeleton />}><OrgBookkeepingModePage /></Suspense>} />
          <Route path="ev/org/civil" element={<Suspense fallback={<AccountyPageSkeleton />}><OrgCivilPage /></Suspense>} />
          <Route path="ev/org/condominium" element={<Suspense fallback={<AccountyPageSkeleton />}><OrgCondominiumPage /></Suspense>} />
          <Route path="ev/org/other" element={<Suspense fallback={<AccountyPageSkeleton />}><OrgOtherPage /></Suspense>} />
          <Route path="ev/org/simplified-report" element={<Suspense fallback={<AccountyPageSkeleton />}><OrgSimplifiedReportPage /></Suspense>} />
        </Route>

        {/* Portfolio & Admin level routes */}
        <Route path="missing-invoices" element={<Suspense fallback={<AccountyPageSkeleton />}><MissingInvoicesPage /></Suspense>} />
        <Route path="missing-invoices/:id" element={<MissingInvoicesLegacyRedirect />} />
        <Route path="reports" element={<ProtectedAccountyRoute requiredRoles={['iroda_admin', 'senior_könyvelő']}><Suspense fallback={<AccountyPageSkeleton />}><ReportsPage /></Suspense></ProtectedAccountyRoute>} />
        <Route path="reports/missing-invoices" element={<ProtectedAccountyRoute requiredRoles={['iroda_admin', 'senior_könyvelő']}><Suspense fallback={<AccountyPageSkeleton />}><MissingInvoicesReportPage /></Suspense></ProtectedAccountyRoute>} />
        <Route path="reports/ai-anomaly" element={<ProtectedAccountyRoute requiredRoles={['iroda_admin', 'senior_könyvelő']}><Suspense fallback={<AccountyPageSkeleton />}><AiAnomalyReportPage /></Suspense></ProtectedAccountyRoute>} />
        <Route path="tax-calendar" element={<Suspense fallback={<AccountyPageSkeleton />}><TaxCalendarPage /></Suspense>} />
        <Route path="settings" element={<ProtectedAccountyRoute requiredRoles={['iroda_admin', 'senior_könyvelő']}><Suspense fallback={<AccountyPageSkeleton />}><SettingsPage /></Suspense></ProtectedAccountyRoute>} />
        <Route path="privacy-policy" element={<Suspense fallback={<AccountyPageSkeleton />}><PrivacyPolicyPage /></Suspense>} />
        <Route path="help" element={<Suspense fallback={<AccountyPageSkeleton />}><HelpPage /></Suspense>} />
        <Route path="tickets/:ticketId?" element={<Suspense fallback={<AccountyPageSkeleton />}><TicketsPage /></Suspense>} />
        <Route path="approval-queue" element={<ProtectedAccountyRoute requiredRoles={['iroda_admin', 'senior_könyvelő']}><Suspense fallback={<AccountyPageSkeleton />}><ApprovalQueuePage /></Suspense></ProtectedAccountyRoute>} />

        <Route path="new-client" element={<Suspense fallback={<AccountyPageSkeleton />}><NewClientPage /></Suspense>} />
        {/* Admin modules — iroda_admin only */}
        <Route path="admin/audit" element={<ProtectedAccountyRoute requiredRoles={['iroda_admin']}><Suspense fallback={<AccountyPageSkeleton />}><AuditLogPage /></Suspense></ProtectedAccountyRoute>} />
        <Route path="admin/gdpr" element={<ProtectedAccountyRoute requiredRoles={['iroda_admin']}><Suspense fallback={<AccountyPageSkeleton />}><GdprPage /></Suspense></ProtectedAccountyRoute>} />
        <Route path="admin/templates" element={<ProtectedAccountyRoute requiredRoles={['iroda_admin']}><Suspense fallback={<AccountyPageSkeleton />}><TemplatesPage /></Suspense></ProtectedAccountyRoute>} />
        <Route path="admin/job-codes" element={<ProtectedAccountyRoute requiredRoles={['iroda_admin']}><Suspense fallback={<AccountyPageSkeleton />}><JobCodesPage /></Suspense></ProtectedAccountyRoute>} />
        <Route path="admin/tax-parameters" element={<ProtectedAccountyRoute requiredRoles={['iroda_admin']}><Suspense fallback={<AccountyPageSkeleton />}><AdminTaxParametersPage /></Suspense></ProtectedAccountyRoute>} />
        <Route path="admin/legal-updates" element={<ProtectedAccountyRoute requiredRoles={['iroda_admin']}><Suspense fallback={<AccountyPageSkeleton />}><LegalUpdatesPage /></Suspense></ProtectedAccountyRoute>} />
        <Route path="admin/office-settings" element={<ProtectedAccountyRoute requiredRoles={['iroda_admin']}><Suspense fallback={<AccountyPageSkeleton />}><OfficeSettingsPage /></Suspense></ProtectedAccountyRoute>} />
        <Route path="admin/permissions" element={<ProtectedAccountyRoute requiredRoles={['iroda_admin']}><Suspense fallback={<AccountyPageSkeleton />}><PermissionMatrixPage /></Suspense></ProtectedAccountyRoute>} />
        <Route path="admin/accountants" element={<ProtectedAccountyRoute requiredRoles={['iroda_admin']}><Suspense fallback={<AccountyPageSkeleton />}><AccountantManagementPage /></Suspense></ProtectedAccountyRoute>} />
        {/* Portfolio pages */}
        <Route path="alerts" element={<ProtectedAccountyRoute requiredRoles={['iroda_admin', 'senior_könyvelő']}><Suspense fallback={<AccountyPageSkeleton />}><AlertsCenterPage /></Suspense></ProtectedAccountyRoute>} />
        <Route path="nav-deadlines" element={<ProtectedAccountyRoute requiredRoles={['iroda_admin', 'senior_könyvelő']}><Suspense fallback={<AccountyPageSkeleton />}><NavDeadlinesPage /></Suspense></ProtectedAccountyRoute>} />
        <Route path="payroll-portfolio" element={<Navigate to="/eaisybooks?tab=payroll" replace />} />
        <Route path="onboarding" element={<ProtectedAccountyRoute requiredRoles={['iroda_admin']}><Suspense fallback={<AccountyPageSkeleton />}><AccountyOnboardingPage /></Suspense></ProtectedAccountyRoute>} />
        <Route path="ai-assistant" element={<Suspense fallback={<AccountyPageSkeleton />}><AiAssistantPage /></Suspense>} />
        <Route path="ai" element={<Navigate to="/eaisybooks/ai-assistant" replace />} />
        <Route path="profile/settings" element={<Suspense fallback={<AccountyPageSkeleton />}><ProfileSettingsPage /></Suspense>} />
        {/* TAO/KIVA module */}
        <Route path="tao" element={<Navigate to="/eaisybooks?tab=tao" replace />} />
        <Route path="tao/calendar" element={<Suspense fallback={<AccountyPageSkeleton />}><TaoCalendarPage2 /></Suspense>} />
        <Route path="tao/taxpayer-types" element={<Suspense fallback={<AccountyPageSkeleton />}><TaoTaxpayerTypesPage /></Suspense>} />
        {/* EV / Egyszeres könyvvitel module — portfolio */}
        <Route path="ev" element={<Navigate to="/eaisybooks?tab=ev" replace />} />
        <Route path="ev/calendar" element={<Suspense fallback={<AccountyPageSkeleton />}><EvCalendarPage /></Suspense>} />
        <Route path="ev/forms" element={<Suspense fallback={<AccountyPageSkeleton />}><EvFormsOverviewPage /></Suspense>} />
        <Route path="ev/thresholds" element={<Suspense fallback={<AccountyPageSkeleton />}><EvThresholdMonitorPage /></Suspense>} />
      </Route>
    </>
  );
}
