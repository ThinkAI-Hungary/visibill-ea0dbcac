import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useInvoiceItemProjectAllocations } from '../hooks/useInvoiceItemProjectAllocations';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      or: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    })),
  },
}));

describe('useInvoiceItemProjectAllocations cache & placeholderData', () => {
  it('instantly returns cached summaries from existing query cache without fetching', async () => {
    const queryClient = new QueryClient();

    // Simulate NavInvoiceTable having already fetched summaries for inv-1 and inv-2
    queryClient.setQueryData(
      ['invoice-item-projects', 'nav', 'comp-1', 'inv-1,inv-2,inv-3'],
      {
        'inv-1': {
          invoiceId: 'inv-1',
          hasMultiProjects: true,
          totalProjectCount: 3,
          allocations: [
            { projectId: 'proj-1', percentage: 50 },
            { projectId: 'proj-2', percentage: 30 },
            { projectId: 'proj-3', percentage: 20 },
          ],
        },
        'inv-2': {
          invoiceId: 'inv-2',
          hasMultiProjects: false,
          totalProjectCount: 1,
          singleProjectId: 'proj-1',
          allocations: [{ projectId: 'proj-1', percentage: 100 }],
        },
      }
    );

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(
      () => useInvoiceItemProjectAllocations('comp-1', ['inv-1'], 'nav'),
      { wrapper }
    );

    // Should immediately have data from placeholderData / queryClient cache
    expect(result.current.data?.['inv-1']?.hasMultiProjects).toBe(true);
    expect(result.current.data?.['inv-1']?.allocations).toHaveLength(3);
  });

  it('preserves previous summary via placeholderData when adding a new invoice ID', async () => {
    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    // Initial state with inv-1 cached
    queryClient.setQueryData(['invoice-item-projects', 'nav', 'comp-1', 'inv-1'], {
      'inv-1': {
        invoiceId: 'inv-1',
        hasMultiProjects: true,
        totalProjectCount: 2,
        allocations: [
          { projectId: 'proj-1', percentage: 50 },
          { projectId: 'proj-2', percentage: 50 },
        ],
      },
    });

    let currentIds = ['inv-1'];
    const { result, rerender } = renderHook(
      () => useInvoiceItemProjectAllocations('comp-1', currentIds, 'nav'),
      { wrapper }
    );

    expect(result.current.data?.['inv-1']).toBeDefined();

    // Rerender with inv-1 and inv-2: data should NOT drop to undefined
    currentIds = ['inv-1', 'inv-2'];
    rerender();

    // Critical: data must retain inv-1 during transition (zero flicker)
    expect(result.current.data?.['inv-1']).toBeDefined();
    expect(result.current.data?.['inv-1']?.allocations).toHaveLength(2);
  });
});
