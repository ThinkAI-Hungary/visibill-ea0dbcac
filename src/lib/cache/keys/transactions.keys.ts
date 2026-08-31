/**
 * Unified Transactions Query Keys
 * Coordinates all bank transactions, matching states, KPIs, and courier reports.
 */
export const transactionKeys = {
  all: (companyId: string) => ['transactions', companyId] as const,
  list: (
    companyId: string,
    dateFrom?: string,
    dateTo?: string,
    page?: number,
    pageSize?: number,
    serverFilters?: Record<string, string>
  ) =>
    ['transactions', companyId, dateFrom, dateTo, page, pageSize, serverFilters] as const,
  filterOptions: (companyId: string) =>
    ['transactionFilterOptions', companyId] as const,
  kpis: (companyId: string) =>
    ['tx-kpis', companyId] as const,
  paymentTransfersHistory: (companyId: string) =>
    ['payment-transfers-history', companyId] as const,
  availableForMatching: (companyId: string, invoiceDate?: string) =>
    ['available-transactions', companyId, invoiceDate] as const,
  availableInvoicesForMatching: (companyId: string, transactionDate?: string) =>
    ['available-invoices-for-matching', companyId, transactionDate] as const,
  matchedCourierReports: (transactionId: string) =>
    ['matchedCourierReports', transactionId] as const,
  matchedNavInvoice: (invoiceId: string) =>
    ['matchedNavInvoice', invoiceId] as const,
  matchedSalary: (salaryId: string) =>
    ['matchedSalary', salaryId] as const,
  transactionExtraMatches: (transactionId: string) =>
    ['transaction_extra_matches', transactionId] as const,
  transactionNotes: (transactionId?: string) =>
    ['transaction-notes', transactionId] as const,
};
