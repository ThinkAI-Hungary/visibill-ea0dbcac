import { QueryClient } from '@tanstack/react-query';

/**
 * Unified matching query keys used across the application.
 */
export const MATCHING_QUERY_KEYS = {
  invoiceKpis: (companyId?: string) => ['invoiceKpis', companyId],
  transactions: (companyId?: string) => ['transactions', companyId],
  navInvoices: (companyId?: string) => ['navInvoices', companyId],
  submittedInvoices: (companyId?: string) => ['submittedInvoices', companyId],
  linkedInvoices: (companyId?: string) => ['linkedInvoices', companyId],
  invoiceTransactions: (companyId?: string) => ['invoiceTransactions', companyId],
  pageInvoiceTransactions: () => ['page-invoice-transactions'],
  matchedTransactionsForInvoice: () => ['matched-transactions-for-invoice'],
  transactionInvoiceMatches: (companyId?: string) => ['transactionInvoiceMatches', companyId],
  filteredNavInvoices: (companyId?: string) => ['filteredNavInvoices', companyId],
  filteredSubmittedInvoices: (companyId?: string) => ['filteredSubmittedInvoices', companyId],
  salaries: (companyId?: string) => ['salaries', companyId],
  dueTransferInvoices: (companyId?: string) => ['due-transfer-invoices', companyId],
  paymentTransfersHistory: (companyId?: string) => ['payment-transfers-history', companyId],
  txKpis: (companyId?: string) => ['tx-kpis', companyId],
};

/**
 * Centrally invalidates all queries affected by a transaction or invoice matching mutation.
 * Replaces 17+ ad-hoc queryClient.invalidateQueries calls across components.
 */
export async function invalidateMatchingQueries(
  queryClient: QueryClient,
  companyId?: string
): Promise<void> {
  const keysToInvalidate = [
    MATCHING_QUERY_KEYS.invoiceKpis(companyId),
    MATCHING_QUERY_KEYS.transactions(companyId),
    MATCHING_QUERY_KEYS.navInvoices(companyId),
    MATCHING_QUERY_KEYS.submittedInvoices(companyId),
    MATCHING_QUERY_KEYS.linkedInvoices(companyId),
    MATCHING_QUERY_KEYS.invoiceTransactions(companyId),
    MATCHING_QUERY_KEYS.pageInvoiceTransactions(),
    MATCHING_QUERY_KEYS.matchedTransactionsForInvoice(),
    MATCHING_QUERY_KEYS.transactionInvoiceMatches(companyId),
    MATCHING_QUERY_KEYS.filteredNavInvoices(companyId),
    MATCHING_QUERY_KEYS.filteredSubmittedInvoices(companyId),
    MATCHING_QUERY_KEYS.salaries(companyId),
    MATCHING_QUERY_KEYS.dueTransferInvoices(companyId),
    MATCHING_QUERY_KEYS.paymentTransfersHistory(companyId),
    MATCHING_QUERY_KEYS.txKpis(companyId),
  ];

  await Promise.all(
    keysToInvalidate.map(queryKey =>
      queryClient.invalidateQueries({ queryKey })
    )
  );
}
