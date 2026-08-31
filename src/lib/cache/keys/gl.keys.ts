/**
 * Unified General Ledger & Accounting Query Keys
 */
export const glKeys = {
  all: (companyId: string) => ['gl', companyId] as const,
  accounts: (presetId?: string) => ['glAccounts', presetId] as const,
  balances: (presetId?: string, companyId?: string) =>
    ['glBalances', presetId, companyId] as const,
  items: (presetId?: string, companyId?: string) =>
    ['glItems', presetId, companyId] as const,
  journalEntries: (companyId: string, dateFrom?: string, dateTo?: string) =>
    ['glJournalEntries', companyId, dateFrom, dateTo] as const,
  journals: (companyId: string) =>
    ['journals', companyId] as const,
  journalStats: (companyId: string) =>
    ['journal-stats', companyId] as const,
  activePreset: (companyId: string) =>
    ['activePreset', companyId] as const,
  coaPresets: (companyId?: string) =>
    ['coaPresets', companyId] as const,
  auditImports: (companyId: string) =>
    ['auditImports', companyId] as const,
  vatReturn: (companyId: string, year?: number, period?: string) =>
    ['vat-return', companyId, year, period] as const,
  fixedAssets: (companyId: string) =>
    ['fixedAssets', companyId] as const,
  fixedAssetDetail: (assetId: string) =>
    ['fixedAssetDetail', assetId] as const,
};
