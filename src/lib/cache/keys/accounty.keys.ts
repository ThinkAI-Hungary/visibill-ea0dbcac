/**
 * Unified Accounty (Client Portal & Practice Management) Query Keys
 */
export const accountyKeys = {
  all: () => ['accounty'] as const,
  clients: (userId?: string, dateFrom?: string, dateTo?: string) =>
    ['accounty-clients', userId, dateFrom, dateTo] as const,
  clientDetails: (companyId: string) =>
    ['accounty-client-details', companyId] as const,
  missingItems: (companyId: string) =>
    ['accounty-missing-items', companyId] as const,
  allMissingItems: (userId?: string) =>
    ['accounty-all-missing-items', userId] as const,
  missingCounts: (companyId: string) =>
    ['accounty-missing-counts', companyId] as const,
  deadlines: (userId?: string) =>
    ['accounty-deadlines', userId] as const,
  taxProfile: (companyId: string) =>
    ['accounty-tax-profile', companyId] as const,
  kpis: (userId?: string, dateFrom?: string, dateTo?: string) =>
    ['accounty-kpis', userId, dateFrom, dateTo] as const,
  portalTokens: (companyId: string) =>
    ['accounty-portal-tokens', companyId] as const,
  communicationPrefs: (companyId: string) =>
    ['accounty-communication-prefs', companyId] as const,
  auditLog: (filters?: Record<string, unknown>) =>
    ['accounty-audit-log', filters] as const,
  gdprRequests: () =>
    ['accounty-gdpr-requests'] as const,
  templates: (category?: string) =>
    ['accounty-templates', category] as const,
  templateVersions: (templateId?: string) =>
    ['accounty-template-versions', templateId] as const,
  jobCodes: (activeOnly?: boolean) =>
    ['accounty-job-codes', activeOnly] as const,
  globalTaxParams: (year: number) =>
    ['accounty-global-tax-params', year] as const,
  legalUpdates: () =>
    ['accounty-legal-updates'] as const,
  retentionRules: (companyId: string) =>
    ['retention-rules', companyId] as const,
  dataContracts: (companyId: string) =>
    ['data-contracts', companyId] as const,
  sites: (companyId: string) =>
    ['sites', companyId] as const,
  costCenters: (companyId: string) =>
    ['cost-centers', companyId] as const,
  departments: (companyId: string) =>
    ['departments', companyId] as const,
  yearEndTasks: (companyId: string, year: number) =>
    ['year-end-tasks', companyId, year] as const,
  monthlyTrend: (userId?: string) =>
    ['accounty-monthly-trend', userId] as const,
  colleagueStats: () =>
    ['accounty-colleague-stats'] as const,
  portalStats: () =>
    ['accounty-portal-stats'] as const,
  accountants: () =>
    ['accounty-accountants'] as const,
  officeSettings: () =>
    ['office-settings'] as const,
  cegkapuSettings: (companyId: string) =>
    ['cegkapu-settings', companyId] as const,
  navRepresentations: (companyId: string) =>
    ['nav-representations', companyId] as const,
  myAssignments: (userId?: string) =>
    ['accounty-my-assignments', userId] as const,
  companySummary: (userId?: string) =>
    ['accounty-company-summary', userId] as const,
  companyInvoices: (companyId: string) =>
    ['company-invoices', companyId] as const,
  firmAccountants: () =>
    ['firm-accountants'] as const,
  firmData: (userId?: string) =>
    ['accounty-firm-data', userId] as const,
  firmMembers: (companyId: string) =>
    ['accounty-firm-members', companyId] as const,
  teamMembers: (firmId?: string) =>
    ['accounty-team-members', firmId] as const,
  messages: (companyId: string) =>
    ['accounty-messages', companyId] as const,
  modulePermissions: () =>
    ['accounty-module-permissions'] as const,
  role: (userId?: string) =>
    ['accounty-role', userId] as const,
};
