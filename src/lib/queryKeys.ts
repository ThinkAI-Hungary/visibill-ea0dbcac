/**
 * Centralized TanStack Query key factory.
 * Every query key includes company_id so cache is scoped per company.
 * Date-dependent queries also include date range in the key.
 */
export const queryKeys = {
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
  submittedInvoices: (companyId: string, dateFrom: string, dateTo: string) =>
    ['submittedInvoices', companyId, dateFrom, dateTo] as const,
  linkedInvoices: (companyId: string, dateFrom: string, dateTo: string) =>
    ['linkedInvoices', companyId, dateFrom, dateTo] as const,
  invoiceTransactions: (companyId: string) =>
    ['invoiceTransactions', companyId] as const,
  navSyncCooldown: (companyId: string) =>
    ['navSyncCooldown', companyId] as const,
  navCredentials: (companyId: string) =>
    ['navCredentials', companyId] as const,

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

  // ── Exchange Rates Page ──
  exchangeRatesPage: (base: string) =>
    ['exchangeRatesPage', base] as const,
};
