import { QueryClient } from '@tanstack/react-query';
import { invoiceKeys } from './keys/invoices.keys';
import { transactionKeys } from './keys/transactions.keys';
import { partnerKeys } from './keys/partners.keys';
import { payrollKeys } from './keys/payroll.keys';
import { glKeys } from './keys/gl.keys';
import { accountyKeys } from './keys/accounty.keys';

/**
 * Coordinate invoice domain cache invalidations.
 * Atomically invalidates invoice lists, twin views, and related KPIs.
 */
export async function invalidateInvoiceQueries(
  queryClient: QueryClient,
  companyId: string,
  options?: { invoiceId?: string; exact?: boolean }
) {
  const promises: Promise<void>[] = [
    queryClient.invalidateQueries({ queryKey: invoiceKeys.all(companyId) }),
    queryClient.invalidateQueries({ queryKey: ['navInvoices', companyId] }),
    queryClient.invalidateQueries({ queryKey: ['submittedInvoices', companyId] }),
    queryClient.invalidateQueries({ queryKey: ['filteredNavInvoices', companyId] }),
    queryClient.invalidateQueries({ queryKey: ['filteredSubmittedInvoices', companyId] }),
    queryClient.invalidateQueries({ queryKey: ['linkedInvoices', companyId] }),
    queryClient.invalidateQueries({ queryKey: ['invoiceTransactions', companyId] }),
    queryClient.invalidateQueries({ queryKey: ['page-invoice-transactions', companyId] }),
    queryClient.invalidateQueries({ queryKey: ['due-transfer-invoices', companyId] }),
    queryClient.invalidateQueries({ queryKey: ['invoice_uploads_with_invoices', companyId] }),
    queryClient.invalidateQueries({ queryKey: ['recentInvoices', companyId] }),
    queryClient.invalidateQueries({ queryKey: ['dashboardData', companyId] }),
    queryClient.invalidateQueries({ queryKey: ['dashboardAnalytics', companyId] }),
  ];

  if (options?.invoiceId) {
    promises.push(
      queryClient.invalidateQueries({ queryKey: invoiceKeys.invoiceNotes(options.invoiceId) }),
      queryClient.invalidateQueries({ queryKey: ['invoiceItems', 'submitted', options.invoiceId] }),
      queryClient.invalidateQueries({ queryKey: ['invoiceItems', 'nav', options.invoiceId] })
    );
  }

  await Promise.allSettled(promises);
}

/**
 * Coordinate bank transaction domain cache invalidations.
 */
export async function invalidateTransactionQueries(
  queryClient: QueryClient,
  companyId: string,
  options?: { transactionId?: string }
) {
  const promises: Promise<void>[] = [
    queryClient.invalidateQueries({ queryKey: transactionKeys.all(companyId) }),
    queryClient.invalidateQueries({ queryKey: transactionKeys.kpis(companyId) }),
    queryClient.invalidateQueries({ queryKey: transactionKeys.filterOptions(companyId) }),
    queryClient.invalidateQueries({ queryKey: transactionKeys.paymentTransfersHistory(companyId) }),
    queryClient.invalidateQueries({ queryKey: ['available-transactions', companyId] }),
    queryClient.invalidateQueries({ queryKey: ['available-invoices-for-matching', companyId] }),
    queryClient.invalidateQueries({ queryKey: ['dashboardData', companyId] }),
  ];

  if (options?.transactionId) {
    promises.push(
      queryClient.invalidateQueries({ queryKey: transactionKeys.matchedCourierReports(options.transactionId) }),
      queryClient.invalidateQueries({ queryKey: transactionKeys.transactionExtraMatches(options.transactionId) }),
      queryClient.invalidateQueries({ queryKey: transactionKeys.transactionNotes(options.transactionId) })
    );
  }

  await Promise.allSettled(promises);
}

/**
 * Coordinate partner domain cache invalidations.
 */
export async function invalidatePartnerQueries(
  queryClient: QueryClient,
  companyId: string,
  partnerId?: string
) {
  const promises: Promise<void>[] = [
    queryClient.invalidateQueries({ queryKey: partnerKeys.all(companyId) }),
    queryClient.invalidateQueries({ queryKey: partnerKeys.full(companyId) }),
    queryClient.invalidateQueries({ queryKey: ['partnerRanking', companyId] }),
  ];

  if (partnerId) {
    promises.push(
      queryClient.invalidateQueries({ queryKey: partnerKeys.detail(partnerId) }),
      queryClient.invalidateQueries({ queryKey: partnerKeys.invoices(partnerId, companyId) })
    );
  }

  await Promise.allSettled(promises);
}

/**
 * Coordinate payroll domain cache invalidations.
 */
export async function invalidatePayrollQueries(
  queryClient: QueryClient,
  companyId: string
) {
  await Promise.allSettled([
    queryClient.invalidateQueries({ queryKey: payrollKeys.all(companyId) }),
    queryClient.invalidateQueries({ queryKey: ['salaries', companyId] }),
    queryClient.invalidateQueries({ queryKey: ['payroll', 'employees', companyId] }),
    queryClient.invalidateQueries({ queryKey: ['payroll', 'all-employments', companyId] }),
    queryClient.invalidateQueries({ queryKey: ['declarations', companyId] }),
    queryClient.invalidateQueries({ queryKey: ['filings', companyId] }),
    queryClient.invalidateQueries({ queryKey: ['transfers', companyId] }),
    queryClient.invalidateQueries({ queryKey: ['leave-requests', companyId] }),
    queryClient.invalidateQueries({ queryKey: ['timeEntries', companyId] }),
  ]);
}

/**
 * Coordinate General Ledger domain cache invalidations.
 */
export async function invalidateGlQueries(
  queryClient: QueryClient,
  companyId: string,
  presetId?: string
) {
  const promises: Promise<void>[] = [
    queryClient.invalidateQueries({ queryKey: glKeys.all(companyId) }),
    queryClient.invalidateQueries({ queryKey: ['glJournalEntries', companyId] }),
    queryClient.invalidateQueries({ queryKey: ['journals', companyId] }),
    queryClient.invalidateQueries({ queryKey: ['journal-stats', companyId] }),
    queryClient.invalidateQueries({ queryKey: ['fixedAssets', companyId] }),
    queryClient.invalidateQueries({ queryKey: ['vat-return', companyId] }),
  ];

  if (presetId) {
    promises.push(
      queryClient.invalidateQueries({ queryKey: glKeys.accounts(presetId) }),
      queryClient.invalidateQueries({ queryKey: ['glBalances', presetId] }),
      queryClient.invalidateQueries({ queryKey: ['glItems', presetId] })
    );
  }

  await Promise.allSettled(promises);
}

/**
 * Coordinate Accounty domain cache invalidations.
 */
export async function invalidateAccountyQueries(
  queryClient: QueryClient,
  context?: { userId?: string; companyId?: string }
) {
  const promises: Promise<void>[] = [
    queryClient.invalidateQueries({ queryKey: accountyKeys.all() }),
    queryClient.invalidateQueries({ queryKey: ['accounty-clients'] }),
    queryClient.invalidateQueries({ queryKey: ['accounty-kpis'] }),
    queryClient.invalidateQueries({ queryKey: ['accounty-deadlines'] }),
    queryClient.invalidateQueries({ queryKey: ['accounty-all-missing-items'] }),
  ];

  if (context?.companyId) {
    promises.push(
      queryClient.invalidateQueries({ queryKey: accountyKeys.missingItems(context.companyId) }),
      queryClient.invalidateQueries({ queryKey: accountyKeys.missingCounts(context.companyId) }),
      queryClient.invalidateQueries({ queryKey: accountyKeys.clientDetails(context.companyId) })
    );
  }

  await Promise.allSettled(promises);
}
