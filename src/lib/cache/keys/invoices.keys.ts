/**
 * Unified Invoices Query Keys
 * All keys include companyId for multi-tenant isolation.
 */
export const invoiceKeys = {
  all: (companyId: string) => ['invoices', companyId] as const,
  navInvoices: (companyId: string, dateFrom?: string, dateTo?: string) =>
    ['navInvoices', companyId, dateFrom, dateTo] as const,
  filteredNavInvoices: (companyId: string, ...rest: unknown[]) =>
    ['filteredNavInvoices', companyId, ...rest] as const,
  submittedInvoices: (companyId: string, dateFrom?: string, dateTo?: string) =>
    ['submittedInvoices', companyId, dateFrom, dateTo] as const,
  filteredSubmittedInvoices: (companyId: string, ...rest: unknown[]) =>
    ['filteredSubmittedInvoices', companyId, ...rest] as const,
  linkedInvoices: (companyId: string, dateFrom?: string, dateTo?: string) =>
    ['linkedInvoices', companyId, dateFrom, dateTo] as const,
  invoiceTransactions: (companyId: string, dateFrom?: string, dateTo?: string) =>
    ['invoiceTransactions', companyId, dateFrom, dateTo] as const,
  pageInvoiceTransactions: (companyId: string, pageInvoiceIdsKey: string) =>
    ['page-invoice-transactions', companyId, pageInvoiceIdsKey] as const,
  invoiceItems: (source?: string, invoiceId?: string) =>
    ['invoiceItems', source, invoiceId] as const,
  invoiceNotes: (invoiceId?: string) =>
    ['invoice-notes', invoiceId] as const,
  allInvoiceNotes: () =>
    ['invoice-notes'] as const,
  dueTransferInvoices: (companyId: string) =>
    ['due-transfer-invoices', companyId] as const,
  courierReportsForInvoices: (companyId: string) =>
    ['courierReportsForInvoices', companyId] as const,
  navSyncCooldown: (companyId: string) =>
    ['navSyncCooldown', companyId] as const,
  navCredentials: (companyId: string) =>
    ['navCredentials', companyId] as const,
  recentInvoices: (companyId: string) =>
    ['recentInvoices', companyId] as const,
  fixedAssetsForInvoice: (invoiceId?: string, source?: string) =>
    ['fixedAssetsForInvoice', invoiceId, source] as const,
  invoiceUploadsWithInvoices: (companyId: string) =>
    ['invoice_uploads_with_invoices', companyId] as const,
};
