import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useUpdateTicketAssignee } from '@/hooks/useTickets';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'admin-user', email: 'admin@test.com' } }),
}));

describe('useUpdateTicketAssignee Hook', () => {
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

  it('allows reassigning ticket from agent-1 to agent-2 when force: true', async () => {
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const selectSingleMock = vi.fn().mockResolvedValue({
      data: { assigned_to: 'agent-1', status: 'in_progress' },
      error: null,
    });

    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: selectSingleMock,
      }),
    });

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'feedback') {
        return {
          select: selectMock,
          update: updateMock,
        } as any;
      }
      return {} as any;
    });

    const { result } = renderHook(() => useUpdateTicketAssignee(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        feedbackId: 'fb-100',
        assignedTo: 'agent-2',
        force: true,
      });
    });

    expect(updateMock).toHaveBeenCalledWith({
      assigned_to: 'agent-2',
    });
  });

  it('rejects reassigning ticket from agent-1 to agent-2 when force: false with ALREADY_ASSIGNED', async () => {
    const selectSingleMock = vi.fn().mockResolvedValue({
      data: { assigned_to: 'agent-1', status: 'assigned' },
      error: null,
    });

    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: selectSingleMock,
      }),
    });

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'feedback') {
        return {
          select: selectMock,
        } as any;
      }
      return {} as any;
    });

    const { result } = renderHook(() => useUpdateTicketAssignee(), { wrapper });

    await expect(
      result.current.mutateAsync({
        feedbackId: 'fb-100',
        assignedTo: 'agent-2',
        force: false,
      })
    ).rejects.toThrow('ALREADY_ASSIGNED');
  });

  it('allows unassigning a ticket (assignedTo: null) and transitions status back to created if currently assigned', async () => {
    const updateEqMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn().mockReturnValue({
      eq: updateEqMock,
    });

    const selectSingleMock = vi.fn().mockResolvedValue({
      data: { assigned_to: 'agent-1', status: 'assigned' },
      error: null,
    });

    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: selectSingleMock,
      }),
    });

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'feedback') {
        return {
          select: selectMock,
          update: updateMock,
        } as any;
      }
      return {} as any;
    });

    const { result } = renderHook(() => useUpdateTicketAssignee(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        feedbackId: 'fb-100',
        assignedTo: null,
        force: true,
      });
    });

    expect(updateMock).toHaveBeenCalledWith({
      assigned_to: null,
      status: 'created',
    });
  });
});
