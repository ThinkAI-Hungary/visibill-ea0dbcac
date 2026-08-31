/**
 * Unified Partners Query Keys
 */
export const partnerKeys = {
  all: (companyId: string) => ['partners', companyId] as const,
  list: (companyId: string) => ['partners', companyId] as const,
  full: (companyId: string) => ['partnersFull', companyId] as const,
  detail: (partnerId: string) => ['partnerDetail', partnerId] as const,
  ranking: (companyId: string, dateFrom?: string, dateTo?: string) =>
    ['partnerRanking', companyId, dateFrom, dateTo] as const,
  invoices: (partnerId: string, companyId: string) =>
    ['partnerInvoices', partnerId, companyId] as const,
};
