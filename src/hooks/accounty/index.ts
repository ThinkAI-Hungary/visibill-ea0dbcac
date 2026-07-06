/**
 * Barrel export for all Accounty hooks.
 * This file re-exports everything from the individual hook modules
 * to maintain backwards compatibility with existing imports.
 *
 * Usage:
 *   import { useAccountyClients, useAccountyKpis } from '@/hooks/accounty';
 */

// ── Helpers & Types ──
export {
  useMyAssignedCompanyIds,
  computeStatus,
  computeProgress,
  fetchAllMissingItems,
  fetchAllMissingItemsFull,
  invalidateAccountyCache,
} from './useAccountyHelpers';

export type {
  AccountyClient,
  AccountyMissingItem,
  AccountyDeadline,
  AccountyKpis,
  AccountyTaxProfile,
  AccountyCommunicationPrefs,
  AccountyAccountant,
  AccountyCompanySummary,
} from './useAccountyHelpers';

// ── Clients ──
export {
  useAccountyClients,
  useAccountyClient,
  useAccountyKpis,
  useAccountyTaxProfile,
  useUpsertTaxProfile,
  useAccountyPortalTokens,
  useGeneratePortalToken,
  useAccountyCommunicationPrefs,
  useUpsertCommunicationPrefs,
  useUpdateKanbanStatus,
  kanbanStatusReverse,
  useAccountyAccountants,
  useUpdateClientOwner,
  useCompanyInvoices,
} from './useAccountyClients';

export type {
  InvoiceStatus,
  CompanyInvoice,
} from './useAccountyClients';

// ── Missing Items ──
export {
  useAccountyMissingItems,
  useAccountyMissingCounts,
  useAccountyAllMissingItems,
  useAccountyCompanySummary,
  useIgnoreMissingItem,
  useResolveMissingItem,
  useAddMissingItem,
} from './useAccountyMissing';

// ── Deadlines ──
export {
  useAccountyDeadlines,
  useCompleteDeadline,
} from './useAccountyDeadlines';

// ── Reports ──
export {
  useAccountyReportData,
  useAccountyFullReportData,
  useAccountyMonthlyTrend,
  useAccountyColleagueStats,
} from './useAccountyReports';

export type {
  ReportRow,
  InvoiceReportRow,
  FullReportData,
  MonthlyTrendPoint,
  ColleagueStat,
} from './useAccountyReports';

// ── Admin ──
export {
  useAccountyAuditLog,
  useLogAuditEvent,
  useAccountyPortalStats,
  useOfficeSettings,
  useUpsertOfficeSettings,
  useCegkapuSettings,
  useUpsertCegkapuSettings,
  useNavRepresentations,
  useAddNavRepresentation,
  useRevokeNavRepresentation,
} from './useAccountyAdmin';

export type {
  AuditLogEntry,
  PortalStats,
  CegkapuSettings,
  NavRepresentation,
} from './useAccountyAdmin';

// ── CRUD ──
export {
  useRetentionRules,
  useSeedRetentionRules,
  useUpdateRetentionRule,
  useAddRetentionRule,
  useDeleteRetentionRule,
  useDataContracts,
  useAddDataContract,
  useDeleteDataContract,
  useSites,
  useAddSite,
  useUpdateSite,
  useDeleteSite,
  useCostCenters,
  useAddCostCenter,
  useUpdateCostCenter,
  useDeleteCostCenter,
  useDepartments,
  useAddDepartment,
  useUpdateDepartment,
  useDeleteDepartment,
  useYearEndTasks,
  useAddYearEndTask,
  useUpdateYearEndTask,
  useDeleteYearEndTask,
  useSeedYearEndTasks,
} from './useAccountyCRUD';

export type {
  RetentionRule,
  DataContract,
  Site,
  CostCenter,
  Department,
  YearEndTask,
} from './useAccountyCRUD';

// ── Payroll ──
export {
  useEmployeeJobs,
  useAddEmployeeJob,
  useDeleteEmployeeJob,
  useAddJobModification,
  useDeclarations,
  useAddDeclaration,
  useFilings,
  useTransfers,
  useAccountyDocuments,
  useGenerateDocuments,
} from './useAccountyPayroll';

export type {
  EmployeeJob,
  Declaration,
  Filing,
  Transfer,
  AccountyDocument,
} from './useAccountyPayroll';
