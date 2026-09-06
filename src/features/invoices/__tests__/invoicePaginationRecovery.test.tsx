import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useInvoiceFilters } from '@/hooks/useInvoiceFilters';
import { UnifiedPagination } from '@/components/ui/unified-pagination';

vi.mock('@/hooks/useActivePreset', () => ({
  useActivePreset: () => ({ activePresetId: 'test-preset-id' }),
}));

// Mock supabase client
const mockRpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: any[]) => mockRpc(...args),
  },
}));

function PaginationRecoveryTestComponent({
  activeTab = 'SUBMITTED_INBOUND',
}: {
  activeTab?: 'OUTBOUND' | 'INBOUND' | 'SUBMITTED_INBOUND' | 'SUBMITTED_OUTBOUND';
}) {
  const {
    submittedCurrentPage,
    navCurrentPage,
    submittedTotalPages,
    navTotalPages,
    submittedTotalCount,
    navTotalCount,
  } = useInvoiceFilters(
    'test-company-id',
    true, // enabled
    '2026-01-01',
    '2026-12-31',
    [],
    [],
    [],
    activeTab
  );

  return (
    <div>
      <span data-testid="submitted-page">{submittedCurrentPage}</span>
      <span data-testid="nav-page">{navCurrentPage}</span>
      <span data-testid="submitted-total-pages">{submittedTotalPages}</span>
      <span data-testid="nav-total-pages">{navTotalPages}</span>
      <span data-testid="submitted-total-count">{submittedTotalCount}</span>
      <span data-testid="nav-total-count">{navTotalCount}</span>
    </div>
  );
}

describe('Invoice Pagination Auto-Recovery', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  it('automatically falls back to page 1 when on page 2 of submitted tab and invoices are deleted (empty result)', async () => {
    // 1. First call to get_invoice_kpis returns 50 invoices remaining
    // 2. get_filtered_submitted_invoices for page 2 returns [] (0 items)
    mockRpc.mockImplementation((fnName: string, params: any) => {
      if (fnName === 'get_invoice_kpis') {
        return Promise.resolve({
          data: [{ total: 50, matched: 30, suggested: 10, unmatched: 10 }],
          error: null,
        });
      }
      if (fnName === 'get_filtered_submitted_invoices') {
        if (params?.p_page === 2) {
          return Promise.resolve({ data: [], error: null });
        }
        return Promise.resolve({
          data: [
            {
              id: 'inv-1',
              total_count: 50,
              match_status: 'matched',
            },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: [], error: null });
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/invoices?tab=SUBMITTED_INBOUND&p=2']}>
          <PaginationRecoveryTestComponent activeTab="SUBMITTED_INBOUND" />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Initial render from URL starts at page 2
    expect(screen.getByTestId('submitted-page').textContent).toBe('2');

    // Auto-recovery detects empty result on page 2 and transitions back to page 1
    await waitFor(() => {
      expect(screen.getByTestId('submitted-page').textContent).toBe('1');
    });

    // Total count correctly reflects the KPI count of 50 invoices
    await waitFor(() => {
      expect(screen.getByTestId('submitted-total-count').textContent).toBe('50');
      expect(screen.getByTestId('submitted-total-pages').textContent).toBe('1');
    });
  });

  it('automatically falls back to page 1 when on page 2 of NAV tab and invoices are empty', async () => {
    mockRpc.mockImplementation((fnName: string, params: any) => {
      if (fnName === 'get_invoice_kpis') {
        return Promise.resolve({
          data: [{ total: 40, matched: 40, suggested: 0, unmatched: 0 }],
          error: null,
        });
      }
      if (fnName === 'get_filtered_nav_invoices') {
        if (params?.p_page === 2) {
          return Promise.resolve({ data: [], error: null });
        }
        return Promise.resolve({
          data: [
            {
              id: 'nav-1',
              total_count: 40,
              match_status: 'matched',
            },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: [], error: null });
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/invoices?tab=INBOUND&p=2']}>
          <PaginationRecoveryTestComponent activeTab="INBOUND" />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByTestId('nav-page').textContent).toBe('2');

    await waitFor(() => {
      expect(screen.getByTestId('nav-page').textContent).toBe('1');
    });

    await waitFor(() => {
      expect(screen.getByTestId('nav-total-count').textContent).toBe('40');
      expect(screen.getByTestId('nav-total-pages').textContent).toBe('1');
    });
  });

  it('steps down from page 3 to page 2 when page 3 is emptied but 100 items remain on 2 pages', async () => {
    mockRpc.mockImplementation((fnName: string, params: any) => {
      if (fnName === 'get_invoice_kpis') {
        return Promise.resolve({
          data: [{ total: 100, matched: 80, suggested: 10, unmatched: 10 }],
          error: null,
        });
      }
      if (fnName === 'get_filtered_submitted_invoices') {
        if (params?.p_page === 3) {
          return Promise.resolve({ data: [], error: null });
        }
        return Promise.resolve({
          data: [
            {
              id: 'inv-51',
              total_count: 100,
              match_status: 'matched',
            },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: [], error: null });
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/invoices?tab=SUBMITTED_INBOUND&p=3']}>
          <PaginationRecoveryTestComponent activeTab="SUBMITTED_INBOUND" />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByTestId('submitted-page').textContent).toBe('3');

    await waitFor(() => {
      expect(screen.getByTestId('submitted-page').textContent).toBe('2');
    });

    await waitFor(() => {
      expect(screen.getByTestId('submitted-total-count').textContent).toBe('100');
      expect(screen.getByTestId('submitted-total-pages').textContent).toBe('2');
    });
  });

  describe('UnifiedPagination boundary behavior', () => {
    it('disables next and last buttons when currentPage >= totalPages', () => {
      const mockPageChange = vi.fn();
      render(
        <UnifiedPagination
          currentPage={2}
          totalPages={1}
          totalItems={50}
          pageSize={50}
          onPageChange={mockPageChange}
          onPageSizeChange={vi.fn()}
        />
      );

      const nextBtn = screen.getByLabelText('Következő oldal');
      const lastBtn = screen.getByLabelText('Utolsó oldal');

      expect(nextBtn).toBeDisabled();
      expect(lastBtn).toBeDisabled();
    });

    it('renders page 1 when totalPages is 1 even if currentPage is temporarily 2', () => {
      render(
        <UnifiedPagination
          currentPage={2}
          totalPages={1}
          totalItems={50}
          pageSize={50}
          onPageChange={vi.fn()}
          onPageSizeChange={vi.fn()}
        />
      );

      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.queryByText('2')).not.toBeInTheDocument();
    });
  });
});
