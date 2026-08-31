import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTransactionMatching } from './useTransactionMatching';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import * as matchingService from '@/lib/matching/matchingService';

vi.mock('@/lib/matching/matchingService', () => ({
  fetchMatchedEntityDetails: vi.fn().mockResolvedValue({ invoice: null, navInvoice: null, salary: null }),
  fetchMatchedCourierReports: vi.fn().mockResolvedValue([]),
  fetchExtraMatches: vi.fn().mockResolvedValue([]),
  fetchAvailableInvoices: vi.fn().mockResolvedValue([]),
  searchServerInvoices: vi.fn().mockResolvedValue([]),
  applyMatch: vi.fn().mockResolvedValue(undefined),
  unmatchTransaction: vi.fn().mockResolvedValue(undefined),
  verifyMatch: vi.fn().mockResolvedValue(undefined),
  markNoInvoice: vi.fn().mockResolvedValue(undefined),
  markInvoiceMissing: vi.fn().mockResolvedValue(undefined),
  revertStatus: vi.fn().mockResolvedValue(undefined),
  addExtraMatch: vi.fn().mockResolvedValue(undefined),
  removeExtraMatch: vi.fn().mockResolvedValue(undefined),
  bookTransactionDirect: vi.fn().mockResolvedValue(undefined),
  unbookTransactionDirect: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useTransactionMatching', () => {
  const mockTransaction: any = {
    id: 'tx-123',
    transaction_date: '2026-08-20',
    amount: -45000,
    currency: 'HUF',
    description: 'Office supply payment',
    matched_invoice_id: null,
    confidence_score: null,
    match_type: null,
    is_verified: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with default search and selection state', () => {
    const { result } = renderHook(
      () =>
        useTransactionMatching({
          transaction: mockTransaction,
          companyId: 'comp-1',
          isOpen: true,
        }),
      { wrapper: createWrapper() }
    );

    expect(result.current.search).toBe('');
    expect(result.current.selectedInvoiceId).toBeNull();
    expect(result.current.showManualMatch).toBe(false);
  });

  it('calls applyMatch when handleMatch is invoked', async () => {
    const onUpdate = vi.fn();
    const onClose = vi.fn();

    const { result } = renderHook(
      () =>
        useTransactionMatching({
          transaction: mockTransaction,
          companyId: 'comp-1',
          isOpen: true,
          onUpdate,
          onClose,
        }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      result.current.handleMatch('inv-999');
    });

    expect(matchingService.applyMatch).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: 'tx-123',
        invoiceId: 'inv-999',
        matchType: 'manual',
      })
    );
  });

  it('calls unmatchTransaction when handleUnmatch is invoked', async () => {
    const { result } = renderHook(
      () =>
        useTransactionMatching({
          transaction: { ...mockTransaction, matched_invoice_id: 'inv-999' },
          companyId: 'comp-1',
          isOpen: true,
        }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      result.current.handleUnmatch();
    });

    expect(matchingService.unmatchTransaction).toHaveBeenCalledWith('tx-123');
  });

  it('calls verifyMatch when handleVerify is invoked', async () => {
    const { result } = renderHook(
      () =>
        useTransactionMatching({
          transaction: { ...mockTransaction, matched_invoice_id: 'inv-999' },
          companyId: 'comp-1',
          isOpen: true,
        }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      result.current.handleVerify();
    });

    expect(matchingService.verifyMatch).toHaveBeenCalledWith('tx-123');
  });
});
