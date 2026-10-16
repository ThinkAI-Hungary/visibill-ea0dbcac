import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSubledgerItems } from '@/hooks/useSubledger';
import { supabase } from '@/integrations/supabase/client';

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

describe('Subledger Line Partner Coalescing (Ticket EB-0279)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('correctly maps line-level partners in multi-partner vouchers like opening entries', async () => {
    // Multi-partner journal entry NYITO-2026:
    // Header partner: Ván Iroda Kft. (7cf3a258...)
    // Line 1: Partner Ván Iroda Kft. (7cf3a258...)
    // Line 2: Partner Ván Barna (78cb227d...)
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          line_id: 'line-seq-9',
          header_id: 'hdr-nyito',
          posting_date: '2026-01-01',
          document_date: '2026-01-01',
          due_date: '2026-01-15',
          document_id: 'NYITO-2026',
          settlement_number: 'NYITO-2026',
          partner_id: '7cf3a258-1c32-4e48-8756-ddd275251501',
          partner_name: 'Ván Iroda Kft.',
          gl_account_id: 'gl-311',
          gl_number: '311',
          gl_short_name: 'Vevők',
          dc_type: 'D',
          amount: '7663539.00',
          foreign_amount: null,
          currency: 'HUF',
          settled_amount: '0.00',
          remaining_amount: '7663539.00',
          is_settled: false,
          match_count: 0,
          description: 'VBV-2026-1',
          status: 'KONYVELT',
          journal_code: 'NYI',
          journal_number: 1,
          import_key: null,
          net_amount: '7663539.00',
          vat_amount: '0.00',
          all_lines: [],
        },
        {
          line_id: 'line-seq-45',
          header_id: 'hdr-nyito',
          posting_date: '2026-01-01',
          document_date: '2026-01-01',
          due_date: '2026-01-15',
          document_id: 'NYITO-2026',
          settlement_number: 'NYITO-2026',
          partner_id: '78cb227d-0bc6-4253-b778-44d62279a8f1',
          partner_name: 'Ván Barna',
          gl_account_id: 'gl-311',
          gl_number: '311',
          gl_short_name: 'Vevők',
          dc_type: 'D',
          amount: '3409500.00',
          foreign_amount: null,
          currency: 'HUF',
          settled_amount: '0.00',
          remaining_amount: '3409500.00',
          is_settled: false,
          match_count: 0,
          description: 'VBV-2025-42',
          status: 'KONYVELT',
          journal_code: 'NYI',
          journal_number: 1,
          import_key: null,
          net_amount: '3409500.00',
          vat_amount: '0.00',
          all_lines: [],
        },
      ],
      error: null,
    });

    const { result } = renderHook(
      () => useSubledgerItems('5364d0be-e92a-4b94-9704-f457cf71f140', 'gl-311', null, 'OPEN'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRpc).toHaveBeenCalledWith('get_subledger_items', {
      p_company_id: '5364d0be-e92a-4b94-9704-f457cf71f140',
      p_gl_account_id: 'gl-311',
      p_partner_id: null,
      p_mode: 'OPEN',
      p_date_from: null,
      p_date_to: null,
      p_status_filter: 'ALL_ACTIVE',
    });

    const items = result.current.data;
    expect(items).toHaveLength(2);

    // Line 1: Ván Iroda Kft.
    expect(items?.[0].partner_id).toBe('7cf3a258-1c32-4e48-8756-ddd275251501');
    expect(items?.[0].partner_name).toBe('Ván Iroda Kft.');
    expect(items?.[0].amount).toBe(7663539);

    // Line 2: Ván Barna (Crucial fix: line partner preserved rather than overwritten by header)
    expect(items?.[1].partner_id).toBe('78cb227d-0bc6-4253-b778-44d62279a8f1');
    expect(items?.[1].partner_name).toBe('Ván Barna');
    expect(items?.[1].amount).toBe(3409500);
  });

  it('filters by partner_id when a specific partner is selected', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          line_id: 'line-seq-45',
          header_id: 'hdr-nyito',
          posting_date: '2026-01-01',
          document_date: '2026-01-01',
          due_date: '2026-01-15',
          document_id: 'NYITO-2026',
          settlement_number: 'NYITO-2026',
          partner_id: '78cb227d-0bc6-4253-b778-44d62279a8f1',
          partner_name: 'Ván Barna',
          gl_account_id: 'gl-311',
          gl_number: '311',
          gl_short_name: 'Vevők',
          dc_type: 'D',
          amount: '3409500.00',
          foreign_amount: null,
          currency: 'HUF',
          settled_amount: '0.00',
          remaining_amount: '3409500.00',
          is_settled: false,
          match_count: 0,
          description: 'VBV-2025-42',
          status: 'KONYVELT',
          journal_code: 'NYI',
          journal_number: 1,
          import_key: null,
          net_amount: '3409500.00',
          vat_amount: '0.00',
          all_lines: [],
        },
      ],
      error: null,
    });

    const { result } = renderHook(
      () => useSubledgerItems(
        '5364d0be-e92a-4b94-9704-f457cf71f140',
        'gl-311',
        '78cb227d-0bc6-4253-b778-44d62279a8f1',
        'OPEN'
      ),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRpc).toHaveBeenCalledWith('get_subledger_items', {
      p_company_id: '5364d0be-e92a-4b94-9704-f457cf71f140',
      p_gl_account_id: 'gl-311',
      p_partner_id: '78cb227d-0bc6-4253-b778-44d62279a8f1',
      p_mode: 'OPEN',
      p_date_from: null,
      p_date_to: null,
      p_status_filter: 'ALL_ACTIVE',
    });

    const items = result.current.data;
    expect(items).toHaveLength(1);
    expect(items?.[0].partner_name).toBe('Ván Barna');
  });
});
