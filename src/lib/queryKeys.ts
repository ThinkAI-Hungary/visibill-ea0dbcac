/**
 * Centralized TanStack Query key factory.
 * Every query key includes company_id so cache is scoped per company.
 * Date-dependent queries also include date range in the key.
 */
export const queryKeys = {
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

  // ── Accounty ──
  accountyClients: (userId: string) =>
    ['accounty-clients', userId] as const,
  accountyMissingItems: (companyId: string) =>
    ['accounty-missing-items', companyId] as const,
  accountyAllMissingItems: (userId: string) =>
    ['accounty-all-missing-items', userId] as const,
  accountyDeadlines: (userId: string) =>
    ['accounty-deadlines', userId] as const,
  accountyTaxProfile: (companyId: string) =>
    ['accounty-tax-profile', companyId] as const,
  accountyKpis: (userId: string) =>
    ['accounty-kpis', userId] as const,
  accountyPortalTokens: (companyId: string) =>
    ['accounty-portal-tokens', companyId] as const,
  accountyCommunicationPrefs: (companyId: string) =>
    ['accounty-communication-prefs', companyId] as const,
};
