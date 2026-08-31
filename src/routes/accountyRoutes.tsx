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

// Lazy-loaded Accounty Shell & Layouts
const AccountyLayout = lazy(() => import("@/pages/Accounty/AccountyLayout"));
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
            <Suspense fallback={<LoadingSpinner message="eaisybooks betöltése..." />}>
              <AccountyLayout />
            </Suspense>
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
            <Suspense fallback={<LoadingSpinner message="Betöltés..." />}>
              <AccountyScopedLayout />
            </Suspense>
          }
        >
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><ClientDetailsPage /></Suspense>} />
          <Route path="profile" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><ClientDetailsPage /></Suspense>} />
          <Route path="accounting" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><AccountingRedirectPage /></Suspense>} />
          <Route path="settings" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><ClientDetailsPage /></Suspense>} />

          {/* Client-Centric Payroll Routes */}
          <Route path="payroll" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><PayrollDashboardPage /></Suspense>} />
          <Route path="payroll/employees" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><PayrollEmployeesPage /></Suspense>} />
          <Route path="payroll/employees/new" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><PayrollEmployeeWizardPage /></Suspense>} />
          <Route path="payroll/employees/:empId" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><PayrollEmployeeDetailsPage /></Suspense>} />
          <Route path="payroll/cycle/new" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><PayrollCyclePage /></Suspense>} />
          <Route path="payroll/cycle/:cycleId" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><PayrollCyclePage /></Suspense>} />
          <Route path="payroll/filings" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><PayrollFilingsPage /></Suspense>} />
          <Route path="payroll/reports" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><PayrollReportsPage /></Suspense>} />
          <Route path="payroll/portal" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><ClientPortalPage /></Suspense>} />
          <Route path="payroll/tax-params" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><PayrollTaxParametersPage /></Suspense>} />
          <Route path="payroll/settings" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><CompanyPayrollSettingsPage /></Suspense>} />

          {/* Employee extensions */}
          <Route path="payroll/employees/import" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><EmployeeImportPage /></Suspense>} />
          <Route path="payroll/employees/:empId/modification" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><JobModificationPage /></Suspense>} />
          <Route path="payroll/employees/:empId/multi-job" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><MultiJobPage /></Suspense>} />
          {/* Declarations */}
          <Route path="payroll/declarations" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><DeclarationsOverviewPage /></Suspense>} />
          <Route path="payroll/declarations/archive" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><DeclarationArchivePage /></Suspense>} />
          <Route path="payroll/declarations/family" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><FamilyDeclarationPage /></Suspense>} />
          <Route path="payroll/declarations/:type" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><GenericDeclarationPage /></Suspense>} />
          {/* Documents */}
          <Route path="payroll/documents" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><DocumentCenterPage /></Suspense>} />
          <Route path="payroll/documents/payslips" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><PayslipGeneratorPage /></Suspense>} />
          <Route path="payroll/documents/transfer" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><TransferListPage /></Suspense>} />
          <Route path="payroll/documents/e-payslip" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><EPayslipPortalPage /></Suspense>} />
          <Route path="payroll/documents/all" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><OutputDocumentsPage /></Suspense>} />
          <Route path="payroll/documents/:docType" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><OutputDocumentsPage /></Suspense>} />
          {/* Exit */}
          <Route path="payroll/employees/:empId/exit" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><EmployeeExitWizardPage /></Suspense>} />
          <Route path="payroll/employees/:empId/exit-docs" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><ExitDocumentsPage /></Suspense>} />
          {/* Filings */}
          <Route path="payroll/filings/08e" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><Filing08EPage /></Suspense>} />
          <Route path="payroll/filings/2608" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><Filing2608Page /></Suspense>} />
          <Route path="payroll/filings/all" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><GenericFilingPage /></Suspense>} />
          <Route path="payroll/filings/:filingType" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><GenericFilingPage /></Suspense>} />
          <Route path="payroll/filings/:filingId/workflow" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><FilingWorkflowPage /></Suspense>} />
          {/* Special job forms */}
          <Route path="payroll/employees/:empId/special" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><SpecialJobFormsPage /></Suspense>} />
          <Route path="payroll/employees/:empId/special/:jobType" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><SpecialJobFormsPage /></Suspense>} />
          {/* Year End & Advanced Reports */}
          <Route path="payroll/year-end" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><YearEndDashboardPage /></Suspense>} />
          <Route path="payroll/advanced-reports" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><PayrollAdvancedReportsPage /></Suspense>} />
          <Route path="payroll/advanced-reports/anomaly" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><AiAnomalyReportPage /></Suspense>} />
          <Route path="payroll/advanced-reports/custom" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><CustomReportBuilderPage /></Suspense>} />

          {/* Invoices, reports and missing invoices */}
          <Route path="missing-invoices" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><ClientMissingInvoicesPage /></Suspense>} />
          <Route path="reports" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><ClientReportsPage /></Suspense>} />
          <Route path="reports/missing-invoices" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><ClientMissingInvoicesReportPage /></Suspense>} />
          <Route path="invoices" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><ClientInvoicesPage /></Suspense>} />

          {/* Settings and others */}
          <Route path="cegkapu" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><CegkapuSettingsPage /></Suspense>} />
          <Route path="representation" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><RepresentationPage /></Suspense>} />
          <Route path="data-retention" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><DataRetentionPage /></Suspense>} />
          <Route path="structure" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><CompanyStructurePage /></Suspense>} />

          {/* TAO client-level */}
          <Route path="tao" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><ClientTaoMainPage /></Suspense>} />
          <Route path="tao/setup" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><TaoSetupWizardPage /></Suspense>} />
          <Route path="tao/master-data" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><TaoMasterDataPage /></Suspense>} />
          <Route path="tao/lifecycle" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><TaoLifecyclePage /></Suspense>} />
          <Route path="tao/business-year" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><TaoBusinessYearPage /></Suspense>} />
          <Route path="tao/accounting-regime" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><TaoAccountingRegimePage /></Suspense>} />
          <Route path="tao/currency" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><TaoCurrencyPage /></Suspense>} />
          <Route path="tao/year-end/:year" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><TaoYearEndWizardPage /></Suspense>} />
          <Route path="tao/kiva" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><KivaCalculatorPage /></Suspense>} />
          <Route path="tao/compare" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><TaoKivaComparePage /></Suspense>} />

          {/* EV client-level */}
          <Route path="ev" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><ClientEvMainPage /></Suspense>} />
          <Route path="ev/setup" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><EvSetupWizardPage /></Suspense>} />
          <Route path="ev/master-data" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><EvMasterDataPage /></Suspense>} />
          <Route path="ev/lifecycle" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><EvLifecyclePage /></Suspense>} />
          <Route path="ev/flat-rate" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><EvFlatRatePage /></Suspense>} />
          <Route path="ev/entrepreneurial/base" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><EvEntrepreneurialBasePage /></Suspense>} />
          <Route path="ev/entrepreneurial/dividend" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><EvEntrepreneurialDividendPage /></Suspense>} />
          <Route path="ev/cashbook" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><CashbookMainPage /></Suspense>} />
          <Route path="ev/cashbook/ledger" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><CashbookLedgerView /></Suspense>} />
          <Route path="ev/cashbook/close" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><CashbookCloseWizard /></Suspense>} />
          <Route path="ev/cashbook/import-nav" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><EvCashbookImportNavPage /></Suspense>} />
          <Route path="ev/depreciation" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><EvDepreciationPage /></Suspense>} />
          <Route path="ev/kata" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><EvKataPage /></Suspense>} />
          <Route path="ev/thresholds" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><EvThresholdMonitorPage /></Suspense>} />
          <Route path="ev/compare" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><EvComparePage /></Suspense>} />
          <Route path="ev/contributions" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><EvContributionsPage /></Suspense>} />
          <Route path="ev/hipa" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><EvHipaPage /></Suspense>} />
          <Route path="ev/vat" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><EvVatPage /></Suspense>} />
          <Route path="ev/chamber" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><EvChamberPage /></Suspense>} />
          <Route path="ev/car-tax" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><EvCompanyCarTaxPage /></Suspense>} />
          <Route path="ev/innovation" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><EvInnovationLevyPage /></Suspense>} />
          <Route path="ev/returns" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><EvSzjaReturnPage /></Suspense>} />
          <Route path="ev/returns/contrib" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><EvContribReturnPage /></Suspense>} />
          <Route path="ev/returns/kata" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><EvKataReturnPage /></Suspense>} />
          <Route path="ev/returns/hipa" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><EvHipaReturnPage /></Suspense>} />
          <Route path="ev/returns/vat-car" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><EvVatCarReturnPage /></Suspense>} />
          <Route path="ev/records" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><EvRecordsOverviewPage /></Suspense>} />
          <Route path="ev/records/:recordType" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><EvRecordDetailPage /></Suspense>} />
          <Route path="ev/income-report" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><EvIncomeReportPage /></Suspense>} />
          <Route path="ev/optimization" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><EvOptimizationPage /></Suspense>} />
          <Route path="ev/org/bookkeeping" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><OrgBookkeepingModePage /></Suspense>} />
          <Route path="ev/org/civil" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><OrgCivilPage /></Suspense>} />
          <Route path="ev/org/condominium" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><OrgCondominiumPage /></Suspense>} />
          <Route path="ev/org/other" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><OrgOtherPage /></Suspense>} />
          <Route path="ev/org/simplified-report" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><OrgSimplifiedReportPage /></Suspense>} />
        </Route>

        {/* Portfolio & Admin level routes */}
        <Route path="missing-invoices" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><MissingInvoicesPage /></Suspense>} />
        <Route path="missing-invoices/:id" element={<MissingInvoicesLegacyRedirect />} />
        <Route path="reports" element={<ProtectedAccountyRoute requiredRoles={['iroda_admin', 'senior_könyvelő']}><Suspense fallback={<LoadingSpinner message="Betöltés..." />}><ReportsPage /></Suspense></ProtectedAccountyRoute>} />
        <Route path="reports/missing-invoices" element={<ProtectedAccountyRoute requiredRoles={['iroda_admin', 'senior_könyvelő']}><Suspense fallback={<LoadingSpinner message="Betöltés..." />}><MissingInvoicesReportPage /></Suspense></ProtectedAccountyRoute>} />
        <Route path="reports/ai-anomaly" element={<ProtectedAccountyRoute requiredRoles={['iroda_admin', 'senior_könyvelő']}><Suspense fallback={<LoadingSpinner message="Betöltés..." />}><AiAnomalyReportPage /></Suspense></ProtectedAccountyRoute>} />
        <Route path="tax-calendar" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><TaxCalendarPage /></Suspense>} />
        <Route path="settings" element={<ProtectedAccountyRoute requiredRoles={['iroda_admin', 'senior_könyvelő']}><Suspense fallback={<LoadingSpinner message="Betöltés..." />}><SettingsPage /></Suspense></ProtectedAccountyRoute>} />
        <Route path="privacy-policy" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><PrivacyPolicyPage /></Suspense>} />
        <Route path="help" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><HelpPage /></Suspense>} />
        <Route path="tickets/:ticketId?" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><TicketsPage /></Suspense>} />
        <Route path="approval-queue" element={<ProtectedAccountyRoute requiredRoles={['iroda_admin', 'senior_könyvelő']}><Suspense fallback={<LoadingSpinner message="Betöltés..." />}><ApprovalQueuePage /></Suspense></ProtectedAccountyRoute>} />

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
        <Route path="payroll-portfolio" element={<Navigate to="/eaisybooks?tab=payroll" replace />} />
        <Route path="onboarding" element={<ProtectedAccountyRoute requiredRoles={['iroda_admin']}><Suspense fallback={<LoadingSpinner message="Betöltés..." />}><AccountyOnboardingPage /></Suspense></ProtectedAccountyRoute>} />
        <Route path="ai-assistant" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><AiAssistantPage /></Suspense>} />
        <Route path="profile/settings" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><ProfileSettingsPage /></Suspense>} />
        {/* TAO/KIVA module */}
        <Route path="tao" element={<Navigate to="/eaisybooks?tab=tao" replace />} />
        <Route path="tao/calendar" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><TaoCalendarPage2 /></Suspense>} />
        <Route path="tao/taxpayer-types" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><TaoTaxpayerTypesPage /></Suspense>} />
        {/* EV / Egyszeres könyvvitel module — portfolio */}
        <Route path="ev" element={<Navigate to="/eaisybooks?tab=ev" replace />} />
        <Route path="ev/calendar" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><EvCalendarPage /></Suspense>} />
        <Route path="ev/forms" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><EvFormsOverviewPage /></Suspense>} />
        <Route path="ev/thresholds" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><EvThresholdMonitorPage /></Suspense>} />
      </Route>
    </>
  );
}
