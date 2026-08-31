/**
 * Centralized TanStack Query key factory.
 * Re-exports domain-specific keys and coordinated invalidation dispatchers from @/lib/cache.
 * Every query key includes company_id so cache is scoped per company.
 * Date-dependent queries also include date range in the key.
 */

export * from './cache';

import {
  invoiceKeys,
  transactionKeys,
  partnerKeys,
  payrollKeys,
  glKeys,
  accountyKeys,
} from './cache';

export const queryKeys = {
  // ── Domain Specific Sub-Factories ──
  invoiceDomain: invoiceKeys,
  transactionDomain: transactionKeys,
  partnerDomain: partnerKeys,
  payrollDomain: payrollKeys,
  glDomain: glKeys,
  accountyDomain: accountyKeys,

  // ── Companies ──
  companies: (userId: string) =>
    ['companies', userId] as const,

  // ── Transactions ──
  transactions: (
    companyId: string,
    dateFrom?: string,
    dateTo?: string,
    page?: number,
    pageSize?: number,
    serverFilters?: Record<string, string>
  ) =>
    ['transactions', companyId, dateFrom, dateTo, page, pageSize, serverFilters] as const,
  transactionFilterOptions: (companyId: string) =>
    ['transactionFilterOptions', companyId] as const,

  // ── Invoices ──
  navInvoices: (companyId: string, dateFrom: string, dateTo: string) =>
    ['navInvoices', companyId, dateFrom, dateTo] as const,
  filteredNavInvoices: (companyId: string, ...rest: unknown[]) =>
    ['filteredNavInvoices', companyId, ...rest] as const,
  submittedInvoices: (companyId: string, dateFrom: string, dateTo: string) =>
    ['submittedInvoices', companyId, dateFrom, dateTo] as const,
  filteredSubmittedInvoices: (companyId: string, ...rest: unknown[]) =>
    ['filteredSubmittedInvoices', companyId, ...rest] as const,
  linkedInvoices: (companyId: string, dateFrom: string, dateTo: string) =>
    ['linkedInvoices', companyId, dateFrom, dateTo] as const,
  invoiceTransactions: (companyId: string, dateFrom?: string, dateTo?: string) =>
    ['invoiceTransactions', companyId, dateFrom, dateTo] as const,
  navSyncCooldown: (companyId: string) =>
    ['navSyncCooldown', companyId] as const,
  navCredentials: (companyId: string) =>
    ['navCredentials', companyId] as const,
  courierReportsForInvoices: (companyId: string) =>
    ['courierReportsForInvoices', companyId] as const,

  // ── Salaries ──
  salaries: (companyId: string, dateFrom: string, dateTo: string) =>
    ['salaries', companyId, dateFrom, dateTo] as const,

  // ── Dashboard (Index) ──
  dashboardData: (companyId: string, dateFrom: string, dateTo: string) =>
    ['dashboardData', companyId, dateFrom, dateTo] as const,
  dashboardAnalytics: (companyId: string, dateFrom: string, dateTo: string) =>
    ['dashboardAnalytics', companyId, dateFrom, dateTo] as const,
  profile: (userId: string) =>
    ['profile', userId] as const,
  tourStatus: (userId: string, companyId: string) =>
    ['tourStatus', userId, companyId] as const,
  exchangeRates: () =>
    ['exchangeRates'] as const,

  // ── Petty Cash ──
  pettyCashSettings: (companyId: string) =>
    ['pettyCashSettings', companyId] as const,
  pettyCashEntries: (companyId: string) =>
    ['pettyCashEntries', companyId] as const,
  pettyCashRegisters: (companyId: string) =>
    ['pettyCashRegisters', companyId] as const,
  pettyCashOpeningBalances: (registerId: string) =>
    ['pettyCashOpeningBalances', registerId] as const,
  pettyCashRoutingRules: (companyId: string) =>
    ['pettyCashRoutingRules', companyId] as const,
  pettyCashSummary: (companyId: string) =>
    ['pettyCashSummary', companyId] as const,

  // ── Partners ──
  partners: (companyId: string) =>
    ['partners', companyId] as const,
  partnersFull: (companyId: string) =>
    ['partnersFull', companyId] as const,

  // ── Projects ──
  projects: (companyId: string) =>
    ['projects', companyId] as const,
  projectsList: (companyId: string) =>
    ['projectsList', companyId] as const,

  // ── Categories ──
  categories: (companyId: string) =>
    ['categories', companyId] as const,

  // ── Settings ──
  settingsToken: (companyId: string) =>
    ['settingsToken', companyId] as const,
  settingsMembers: (companyId: string) =>
    ['settingsMembers', companyId] as const,
  settingsProfile: (userId: string) =>
    ['settingsProfile', userId] as const,
  settingsCompany: (companyId: string) =>
    ['settingsCompany', companyId] as const,

  // ── Integrations ──
  integrations: (companyId: string) =>
    ['integrations', companyId] as const,
  emailSettings: (companyId: string) =>
    ['emailSettings', companyId] as const,
  emailAccounts: (companyId: string) =>
    ['emailAccounts', companyId] as const,

  // ── Analytics ──
  analyticsRaw: (companyId: string, dateFrom: string, dateTo: string) =>
    ['analyticsRaw', companyId, dateFrom, dateTo] as const,
  analyticsVat: (companyId: string, dateFrom: string, dateTo: string) =>
    ['analyticsVat', companyId, dateFrom, dateTo] as const,

  // ── Recent Invoices (Dashboard) ──
  recentInvoices: (companyId: string) =>
    ['recentInvoices', companyId] as const,

  // ── Dashboard Petty Cash ──
  dashboardPettyCash: (companyId: string) =>
    ['dashboardPettyCash', companyId] as const,

  // ── FX Differences ──
  fxDifferences: (companyId: string, dateFrom: string, dateTo: string) =>
    ['fxDifferences', companyId, dateFrom, dateTo] as const,
  fxSettings: (companyId: string) =>
    ['fxSettings', companyId] as const,

  // ── Upload History ──
  uploadHistory: (companyId: string, activeTab: string, dateFrom: string, dateTo: string) =>
    ['uploadHistory', companyId, activeTab, dateFrom, dateTo] as const,

  // ── Exchange Rates Page ──
  exchangeRatesPage: (base: string) =>
    ['exchangeRatesPage', base] as const,

  // ── Kintlevő ──
  kintlevoNav: (companyId: string) =>
    ['kintlevo-nav', companyId] as const,
  kintlevoManual: (companyId: string) =>
    ['kintlevo-manual', companyId] as const,
  dunningSends: (companyId: string) =>
    ['dunning-sends', companyId] as const,

  // ── Integrations ──
  syncLogs: (companyId: string) =>
    ['syncLogs', companyId] as const,

  // ── Working Time ──
  timeEntries: (companyId: string, date?: string) =>
    ['timeEntries', companyId, date] as const,
  employeeRates: (companyId: string) =>
    ['employeeRates', companyId] as const,
  companySettings: (companyId: string) =>
    ['companySettings', companyId] as const,
  projectLaborCosts: (companyId: string) =>
    ['projectLaborCosts', companyId] as const,
  projectList: (companyId: string) =>
    ['projectList', companyId] as const,

  accountyClients: (userId: string, dateFrom?: string, dateTo?: string) =>
    ['accounty-clients', userId, dateFrom, dateTo] as const,
  accountyMissingItems: (companyId: string) =>
    ['accounty-missing-items', companyId] as const,
  accountyAllMissingItems: (userId: string) =>
    ['accounty-all-missing-items', userId] as const,
  accountyDeadlines: (userId: string) =>
    ['accounty-deadlines', userId] as const,
  accountyTaxProfile: (companyId: string) =>
    ['accounty-tax-profile', companyId] as const,
  accountyKpis: (userId: string, dateFrom?: string, dateTo?: string) =>
    ['accounty-kpis', userId, dateFrom, dateTo] as const,
  accountyPortalTokens: (companyId: string) =>
    ['accounty-portal-tokens', companyId] as const,
  accountyCommunicationPrefs: (companyId: string) =>
    ['accounty-communication-prefs', companyId] as const,

  // ── Accounty Admin ──
  accountyAuditLog: (filters?: Record<string, unknown>) =>
    ['accounty-audit-log', filters] as const,
  accountyGdprRequests: () =>
    ['accounty-gdpr-requests'] as const,
  accountyTemplates: (category?: string) =>
    ['accounty-templates', category] as const,
  accountyTemplateVersions: (templateId?: string) =>
    ['accounty-template-versions', templateId] as const,
  accountyJobCodes: (activeOnly?: boolean) =>
    ['accounty-job-codes', activeOnly] as const,
  accountyGlobalTaxParams: (year: number) =>
    ['accounty-global-tax-params', year] as const,
  accountyLegalUpdates: () =>
    ['accounty-legal-updates'] as const,

  // ── Accounty CRUD ──
  accountyRetentionRules: (companyId: string) =>
    ['retention-rules', companyId] as const,
  accountyDataContracts: (companyId: string) =>
    ['data-contracts', companyId] as const,
  accountySites: (companyId: string) =>
    ['sites', companyId] as const,
  accountyCostCenters: (companyId: string) =>
    ['cost-centers', companyId] as const,
  accountyDepartments: (companyId: string) =>
    ['departments', companyId] as const,
  accountyYearEndTasks: (companyId: string, year: number) =>
    ['year-end-tasks', companyId, year] as const,

  // ── Accounty Payroll ──
  accountyEmployeeJobs: (companyId: string, employeeId: string) =>
    ['employee-jobs', companyId, employeeId] as const,
  accountyDeclarations: (companyId: string) =>
    ['declarations', companyId] as const,
  accountyFilings: (companyId: string, filingType: string) =>
    ['filings', companyId, filingType] as const,
  accountyTransfers: (companyId: string, period?: string) =>
    ['transfers', companyId, period] as const,
  accountyDocuments: (companyId: string, docType?: string) =>
    ['accounty-documents', companyId, docType] as const,

  // ── Accounty Reports ──
  accountyReportInvoices: () =>
    ['accounty-report-invoices'] as const,
  accountyMonthlyTrend: (userId: string) =>
    ['accounty-monthly-trend', userId] as const,
  accountyColleagueStats: () =>
    ['accounty-colleague-stats'] as const,

  // ── Accounty Misc ──
  accountyPortalStats: () =>
    ['accounty-portal-stats'] as const,
  accountyAccountants: () =>
    ['accounty-accountants'] as const,
  accountyOfficeSettings: () =>
    ['office-settings'] as const,
  accountyCegkapuSettings: (companyId: string) =>
    ['cegkapu-settings', companyId] as const,
  accountyNavRepresentations: (companyId: string) =>
    ['nav-representations', companyId] as const,
  accountyMyAssignments: (userId: string) =>
    ['accounty-my-assignments', userId] as const,
  accountyCompanySummary: (userId: string) =>
    ['accounty-company-summary', userId] as const,
  accountyCompanyInvoices: (companyId: string) =>
    ['company-invoices', companyId] as const,
  accountyFirmAccountants: () =>
    ['firm-accountants'] as const,
  accountyMissingCounts: (companyId: string) =>
    ['accounty-missing-counts', companyId] as const,
  accountyPayrollEmployments: (employeeId: string) =>
    ['payroll', 'employments', employeeId] as const,
  accountyPayrollEmployees: () =>
    ['payroll', 'employees'] as const,

  // ── Accounty Settings/Profile ──
  accountyFirmData: (userId: string) =>
    ['accounty-firm-data', userId] as const,
  accountyFirmMembers: (companyId: string) =>
    ['accounty-firm-members', companyId] as const,
  accountyFirmName: (userId: string) =>
    ['accounty-firm-name', userId] as const,
  accountyTeamMembers: (firmId?: string) =>
    ['accounty-team-members', firmId] as const,
  accountyMessages: (companyId: string) =>
    ['accounty-messages', companyId] as const,
  accountyModulePermissions: () =>
    ['accounty-module-permissions'] as const,
  accountyRole: (userId: string) =>
    ['accounty-role', userId] as const,
};
