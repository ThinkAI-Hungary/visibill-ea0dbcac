import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useMarkTicketRead } from '@/hooks/useTickets';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', email: 'user@test.com' } }),
}));

describe('useMarkTicketRead', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('upserts ticket_reads when feedbackId is provided', async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(supabase.from).mockReturnValue({
      upsert: upsertMock,
    } as any);

    const { result } = renderHook(() => useMarkTicketRead(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('ticket-123');
    });

    expect(supabase.from).toHaveBeenCalledWith('ticket_reads');
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        feedback_id: 'ticket-123',
        user_id: 'user-1',
      }),
      { onConflict: 'feedback_id,user_id' }
    );
  });

  it('silently ignores foreign key constraint error 23503 if ticket does not exist', async () => {
    const upsertMock = vi.fn().mockResolvedValue({
      error: { code: '23503', message: 'insert or update on table "ticket_reads" violates foreign key constraint' },
    });
    vi.mocked(supabase.from).mockReturnValue({
      upsert: upsertMock,
    } as any);

    const { result } = renderHook(() => useMarkTicketRead(), { wrapper });

    // Should NOT throw an error
    await act(async () => {
      await expect(result.current.mutateAsync('deleted-ticket-id')).resolves.toBeUndefined();
    });
  });

  it('re-throws other database errors', async () => {
    const upsertMock = vi.fn().mockResolvedValue({
      error: { code: '42P01', message: 'relation does not exist' },
    });
    vi.mocked(supabase.from).mockReturnValue({
      upsert: upsertMock,
    } as any);

    const { result } = renderHook(() => useMarkTicketRead(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync('ticket-123')).rejects.toMatchObject({ code: '42P01' });
    });
  });
});
