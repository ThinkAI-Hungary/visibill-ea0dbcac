import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  subledgerQueryKeys,
  useSubledgerAccounts,
  useSubledgerItems,
  useSettleOpenItems,
  useAutoSettleSubledgerItems,
} from '../useSubledger';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast }),
  toast: vi.fn(),
}));

const mockRpc = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: any[]) => mockRpc(...args),
    from: vi.fn(),
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

describe('useSubledger Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('subledgerQueryKeys', () => {
    it('produces predictable query keys for cache targeting', () => {
      expect(subledgerQueryKeys.all).toEqual(['subledger']);
      expect(subledgerQueryKeys.accounts('c1')).toEqual(['subledger', 'accounts', 'c1']);
      expect(subledgerQueryKeys.matches('c1', 'line-1')).toEqual(['subledger', 'matches', 'c1', 'line-1']);
      expect(subledgerQueryKeys.list('c1', 'acc-1', 'part-1', 'OPEN')).toEqual([
        'subledger',
        'list',
        'c1',
        'acc-1',
        'part-1',
        'OPEN',
        'all',
        'all',
        'ALL_ACTIVE',
      ]);
    });
  });

  describe('useSubledgerAccounts', () => {
    it('queries gl_accounts with valid columns (excluding non-existent name column) and filters out group accounts', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockOr = vi.fn().mockReturnThis();
      const mockOrder = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockResolvedValue({
        data: [
          { id: '1', gl_number: '311', short_name: 'Vevők', account_type: 'detail', subledger_type: 'partner' },
          { id: '2', gl_number: '31', short_name: 'Követelések', account_type: 'group', subledger_type: 'none' },
          { id: '3', gl_number: '454', short_name: 'Szállítók', account_type: 'detail', subledger_type: 'partner' },
        ],
        error: null,
      });

      const mockFrom = vi.fn().mockReturnValue({
        select: mockSelect,
        or: mockOr,
        order: mockOrder,
        eq: mockEq,
      });

      (supabase.from as any) = mockFrom;

      const { result } = renderHook(
        () => useSubledgerAccounts('company-123'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockFrom).toHaveBeenCalledWith('gl_accounts');
      expect(mockSelect).toHaveBeenCalledWith(
        'id, gl_number, short_name, subledger_type, is_open_item_managed, account_type'
      );
      // Ensure 'name' is NOT selected as a standalone column
      expect(mockSelect.mock.calls[0][0].split(',').map((s: string) => s.trim())).not.toContain('name');

      // Group accounts filtered out
      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].gl_number).toBe('311');
      expect(result.current.data?.[1].gl_number).toBe('454');
    });
  });

  describe('useSubledgerItems', () => {
    it('fetches and normalizes subledger items via get_subledger_items RPC', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [
          {
            id: 'item-1',
            amount: '150000.5',
            settled_amount: '50000',
            remaining_amount: '100000.5',
            document_id: 'DOC-123',
          },
        ],
        error: null,
      });

      const { result } = renderHook(
        () => useSubledgerItems('company-123', 'acc-1', 'part-1', 'OPEN'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockRpc).toHaveBeenCalledWith('get_subledger_items', {
        p_company_id: 'company-123',
        p_gl_account_id: 'acc-1',
        p_partner_id: 'part-1',
        p_mode: 'OPEN',
        p_date_from: null,
        p_date_to: null,
        p_status_filter: 'ALL_ACTIVE',
      });

      const items = result.current.data;
      expect(items).toHaveLength(1);
      expect(items?.[0].amount).toBe(150000.5);
      expect(items?.[0].settled_amount).toBe(50000);
      expect(items?.[0].remaining_amount).toBe(100000.5);
      expect(items?.[0].settlement_number).toBe('DOC-123');
    });

    it('returns empty array and does not query when companyId is missing', async () => {
      const { result } = renderHook(() => useSubledgerItems(undefined), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe('idle');
      expect(mockRpc).not.toHaveBeenCalled();
    });
  });

  describe('useSettleOpenItems', () => {
    it('calls settle_open_items RPC and triggers success notification', async () => {
      mockRpc.mockResolvedValueOnce({ data: { success: true }, error: null });

      const { result } = renderHook(() => useSettleOpenItems(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          companyId: 'company-123',
          invoiceLineId: 'inv-line-1',
          settlingLineId: 'bank-line-1',
          amountHuf: 50000,
          notes: 'Test settlement',
        });
      });

      expect(mockRpc).toHaveBeenCalledWith('settle_open_items', {
        p_company_id: 'company-123',
        p_invoice_line_id: 'inv-line-1',
        p_settling_line_id: 'bank-line-1',
        p_amount_huf: 50000,
        p_amount_foreign: null,
        p_match_type: 'MANUAL',
        p_notes: 'Test settlement',
      });

      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Sikeres rendezés' })
      );
    });
  });

  describe('useAutoSettleSubledgerItems', () => {
    it('shows matched count and total amount in toast when items are paired', async () => {
      mockRpc.mockResolvedValueOnce({
        data: { matched_count: 3, total_amount: 125000 },
        error: null,
      });

      const { result } = renderHook(() => useAutoSettleSubledgerItems(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({ companyId: 'company-123' });
      });

      expect(mockRpc).toHaveBeenCalledWith('auto_settle_subledger_items', {
        p_company_id: 'company-123',
        p_gl_account_id: null,
      });

      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Automatikus párosítás befejeződött',
          description: expect.stringContaining('3 tételpár sikeresen összerendezve'),
        })
      );
    });
  });
});
