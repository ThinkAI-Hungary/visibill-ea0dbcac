import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cashReportQueryKeys,
  useCashReports,
  useActiveCashReport,
  useCreateCashReceipt,
} from '../useCashReports';
import { supabase } from '@/integrations/supabase/client';

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockIn = vi.fn();
const mockLimit = vi.fn();
const mockMaybeSingle = vi.fn();
const mockRpc = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
    })),
    rpc: (...args: any[]) => mockRpc(...args),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  );
}

describe('useCashReports Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('cashReportQueryKeys', () => {
    it('generates predictable query keys for cash reports domain', () => {
      expect(cashReportQueryKeys.all).toEqual(['cash-reports']);
      expect(cashReportQueryKeys.list('company-1', 'reg-1')).toEqual([
        'cash-reports',
        'list',
        'company-1',
        'reg-1',
      ]);
      expect(cashReportQueryKeys.detail('rep-123')).toEqual([
        'cash-reports',
        'detail',
        'rep-123',
      ]);
      expect(cashReportQueryKeys.active('company-1', 'reg-1')).toEqual([
        'cash-reports',
        'active',
        'company-1',
        'reg-1',
      ]);
      expect(cashReportQueryKeys.receipts('company-1', 'reg-1')).toEqual([
        'cash-receipts',
        'company-1',
        'reg-1',
      ]);
    });
  });

  describe('useCashReports', () => {
    it('fetches cash reports for company filtered by cash_register_id', async () => {
      const mockReports = [
        {
          id: 'rep-1',
          report_number: 'P-2026-001',
          company_id: 'c1',
          cash_register_id: 'reg-1',
          status: 'closed',
        },
      ];

      mockSelect.mockReturnValue({
        eq: mockEq.mockReturnValue({
          order: mockOrder.mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: mockReports, error: null }),
          }),
        }),
      });

      const { result } = renderHook(() => useCashReports('c1', 'reg-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(supabase.from).toHaveBeenCalledWith('cash_reports');
    });

    it('returns empty array when companyId is missing', async () => {
      const { result } = renderHook(() => useCashReports(undefined), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe('idle');
      expect(supabase.from).not.toHaveBeenCalled();
    });
  });

  describe('useCreateCashReceipt', () => {
    it('calls create_cash_receipt_with_seq RPC with formatted payload', async () => {
      mockRpc.mockResolvedValueOnce({
        data: { receipt_id: 'rec-1', receipt_number: 'BPB-2026-001' },
        error: null,
      });

      const { result } = renderHook(() => useCreateCashReceipt(), {
        wrapper: createWrapper(),
      });

      let resData: any;
      await act(async () => {
        resData = await result.current.mutateAsync({
          companyId: 'company-1',
          cashRegisterId: 'reg-1',
          receiptType: 'in',
          issuedAt: '2026-03-30',
          payerOrPayeeName: 'Teszt Vevő Kft.',
          amount: 50000,
          currency: 'HUF',
          amountInWords: 'ötvenezer forint',
          legalTitle: 'Készpénzes értékesítés',
        });
      });

      expect(mockRpc).toHaveBeenCalledWith('create_cash_receipt_with_seq', {
        p_company_id: 'company-1',
        p_cash_register_id: 'reg-1',
        p_cash_entry_id: null,
        p_receipt_type: 'in',
        p_issued_at: '2026-03-30',
        p_payer_or_payee_name: 'Teszt Vevő Kft.',
        p_payer_or_payee_address: '',
        p_amount: 50000,
        p_currency: 'HUF',
        p_amount_in_words: 'ötvenezer forint',
        p_legal_title: 'Készpénzes értékesítés',
        p_description: '',
        p_partner_id: null,
      });

      expect(resData).toEqual({
        receipt_id: 'rec-1',
        receipt_number: 'BPB-2026-001',
      });
    });
  });
});
