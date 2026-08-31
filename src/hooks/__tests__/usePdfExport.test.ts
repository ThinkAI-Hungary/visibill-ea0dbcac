import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
      }),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
  },
}));

vi.mock('@/lib/errorReporter', () => ({
  reportError: vi.fn(),
}));

describe('usePdfExport Edge Function Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call generate-pdf-export edge function with correct parameters', async () => {
    const mockInvoke = vi.mocked(supabase.functions.invoke);
    mockInvoke.mockResolvedValueOnce({
      data: { success: true, totalInvoices: 42, jobId: 'job-123' },
      error: null,
    });

    const params = {
      companyId: 'comp-123',
      dateFrom: '2026-01-01',
      dateTo: '2026-02-28',
      invoiceDirection: 'INBOUND',
      exportMode: 'posting_slips' as const,
      includePostingSlips: true,
      invoiceList: undefined,
    };

    const { data, error } = await supabase.functions.invoke('generate-pdf-export', {
      body: {
        companyId: params.companyId,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        invoiceDirection: params.invoiceDirection,
        exportMode: params.exportMode,
        includePostingSlips: params.includePostingSlips,
        invoiceList: params.invoiceList,
      },
    });

    expect(mockInvoke).toHaveBeenCalledWith('generate-pdf-export', {
      body: {
        companyId: 'comp-123',
        dateFrom: '2026-01-01',
        dateTo: '2026-02-28',
        invoiceDirection: 'INBOUND',
        exportMode: 'posting_slips',
        includePostingSlips: true,
        invoiceList: undefined,
      },
    });
    expect(error).toBeNull();
    expect(data?.totalInvoices).toBe(42);
  });

  it('should handle edge function error response without crashing JSON parser', async () => {
    const mockInvoke = vi.mocked(supabase.functions.invoke);
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: new Error('Edge function returned 502 Bad Gateway'),
    });

    const { data, error } = await supabase.functions.invoke('generate-pdf-export', {
      body: { companyId: 'comp-123', dateFrom: '2026-01-01', dateTo: '2026-02-28' },
    });

    expect(data).toBeNull();
    expect(error?.message).toContain('502 Bad Gateway');
  });

  it('should handle business error returned in data payload', async () => {
    const mockInvoke = vi.mocked(supabase.functions.invoke);
    mockInvoke.mockResolvedValueOnce({
      data: { error: 'Nincs számla a megadott feltételekkel' },
      error: null,
    });

    const { data, error } = await supabase.functions.invoke('generate-pdf-export', {
      body: { companyId: 'comp-123', dateFrom: '2026-01-01', dateTo: '2026-02-28' },
    });

    expect(error).toBeNull();
    expect(data?.error).toBe('Nincs számla a megadott feltételekkel');
  });
});
