import { describe, it, expect, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  invoiceKeys,
  transactionKeys,
  partnerKeys,
  payrollKeys,
  glKeys,
  accountyKeys,
  invalidateInvoiceQueries,
  invalidateTransactionQueries,
  invalidatePartnerQueries,
  invalidatePayrollQueries,
  invalidateGlQueries,
  invalidateAccountyQueries,
} from './index';

describe('Domain Query Keys Registry', () => {
  const companyId = 'company-test-123';

  it('generates consistent invoice keys', () => {
    expect(invoiceKeys.all(companyId)).toEqual(['invoices', companyId]);
    expect(invoiceKeys.navInvoices(companyId, '2026-01-01', '2026-01-31')).toEqual([
      'navInvoices',
      companyId,
      '2026-01-01',
      '2026-01-31',
    ]);
    expect(invoiceKeys.pageInvoiceTransactions(companyId, 'id1,id2')).toEqual([
      'page-invoice-transactions',
      companyId,
      'id1,id2',
    ]);
  });

  it('generates consistent transaction keys', () => {
    expect(transactionKeys.all(companyId)).toEqual(['transactions', companyId]);
    expect(transactionKeys.kpis(companyId)).toEqual(['tx-kpis', companyId]);
    expect(transactionKeys.matchedCourierReports('tx-999')).toEqual([
      'matchedCourierReports',
      'tx-999',
    ]);
  });

  it('generates consistent partner keys', () => {
    expect(partnerKeys.all(companyId)).toEqual(['partners', companyId]);
    expect(partnerKeys.ranking(companyId, '2026-01-01', '2026-12-31')).toEqual([
      'partnerRanking',
      companyId,
      '2026-01-01',
      '2026-12-31',
    ]);
    expect(partnerKeys.invoices('partner-1', companyId)).toEqual([
      'partnerInvoices',
      'partner-1',
      companyId,
    ]);
  });

  it('generates consistent payroll keys', () => {
    expect(payrollKeys.all(companyId)).toEqual(['payroll', companyId]);
    expect(payrollKeys.allEmployments(companyId)).toEqual([
      'payroll',
      'all-employments',
      companyId,
    ]);
    expect(payrollKeys.employeeJobs(companyId, 'emp-1')).toEqual([
      'employee-jobs',
      companyId,
      'emp-1',
    ]);
  });

  it('generates consistent GL keys', () => {
    expect(glKeys.all(companyId)).toEqual(['gl', companyId]);
    expect(glKeys.accounts('preset-abc')).toEqual(['glAccounts', 'preset-abc']);
    expect(glKeys.journalEntries(companyId)).toEqual([
      'glJournalEntries',
      companyId,
      undefined,
      undefined,
    ]);
  });

  it('generates consistent Accounty keys', () => {
    expect(accountyKeys.all()).toEqual(['accounty']);
    expect(accountyKeys.clients('user-1')).toEqual([
      'accounty-clients',
      'user-1',
      undefined,
      undefined,
    ]);
    expect(accountyKeys.missingItems(companyId)).toEqual([
      'accounty-missing-items',
      companyId,
    ]);
  });
});

describe('Domain Invalidation Dispatchers', () => {
  const companyId = 'company-test-123';

  function createMockQueryClient() {
    return {
      invalidateQueries: vi.fn().mockResolvedValue(undefined),
    } as unknown as QueryClient;
  }

  it('invalidateInvoiceQueries invalidates all related invoice queries atomically', async () => {
    const qc = createMockQueryClient();
    await invalidateInvoiceQueries(qc, companyId, { invoiceId: 'inv-123' });

    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['invoices', companyId] });
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['navInvoices', companyId] });
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['submittedInvoices', companyId] });
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['invoice-notes', 'inv-123'] });
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['invoiceItems', 'submitted', 'inv-123'] });
  });

  it('invalidateTransactionQueries invalidates transaction queries and specific item keys', async () => {
    const qc = createMockQueryClient();
    await invalidateTransactionQueries(qc, companyId, { transactionId: 'tx-456' });

    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['transactions', companyId] });
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['tx-kpis', companyId] });
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['matchedCourierReports', 'tx-456'] });
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['transaction_extra_matches', 'tx-456'] });
  });

  it('invalidatePartnerQueries invalidates partner lists and ranking', async () => {
    const qc = createMockQueryClient();
    await invalidatePartnerQueries(qc, companyId, 'partner-789');

    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['partners', companyId] });
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['partnerRanking', companyId] });
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['partnerDetail', 'partner-789'] });
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['partnerInvoices', 'partner-789', companyId] });
  });

  it('invalidatePayrollQueries invalidates payroll and employment queries', async () => {
    const qc = createMockQueryClient();
    await invalidatePayrollQueries(qc, companyId);

    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['payroll', companyId] });
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['salaries', companyId] });
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['payroll', 'employees', companyId] });
  });

  it('invalidateGlQueries invalidates GL accounts, journals, and balances', async () => {
    const qc = createMockQueryClient();
    await invalidateGlQueries(qc, companyId, 'preset-xyz');

    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['gl', companyId] });
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['journals', companyId] });
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['glAccounts', 'preset-xyz'] });
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['glBalances', 'preset-xyz'] });
  });

  it('invalidateAccountyQueries invalidates practice management keys', async () => {
    const qc = createMockQueryClient();
    await invalidateAccountyQueries(qc, { companyId });

    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['accounty'] });
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['accounty-clients'] });
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['accounty-missing-items', companyId] });
  });
});
