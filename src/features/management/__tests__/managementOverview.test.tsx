import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ManagementOverview } from '../components/overview/ManagementOverview';
import { OverviewData } from '../api/types';

// Mock dependencies
vi.mock('../api/managementApi', () => ({
  fetchManagementData: vi.fn(),
}));

vi.mock('@/hooks/useTickets', () => ({
  useTickets: vi.fn(),
  useIsSupportAdmin: () => ({ data: true, isLoading: false }),
  useIsManagementRole: () => ({ data: true, isLoading: false }),
}));

import { fetchManagementData } from '../api/managementApi';
import { useTickets } from '@/hooks/useTickets';

const mockOverview: OverviewData = {
  usersCount: 42,
  companiesCount: 15,
  totalErrors: 3,
  mostErrorCompany: { id: 'c1', name: 'Test Corp', errorCount: 2 },
  mostErrorUser: { id: 'u1', name: 'Test User', email: 'test@example.com', errorCount: 1 },
  companies: [
    {
      id: 'c1',
      name: 'Test Corp',
      tax_number: '12345678-1-42',
      created_at: '2026-01-01T00:00:00Z',
      members: [{ name: 'Test User', role: 'CEO' }],
      monthlyCostUsd: 12.34,
      invoiceCount: 100,
      navInvoiceCount: 80,
      transactionCount: 50,
      payrollCount: 10,
      hasEaisyBooks: true,
    },
  ],
  users: [
    {
      id: 'u1',
      user_id: 'u1',
      name: 'Test User',
      email: 'test@example.com',
      created_at: '2026-01-01T00:00:00Z',
      companies: [{ id: 'c1', name: 'Test Corp', role: 'CEO' }],
    },
  ],
  llmOverview: {
    totalMonthlyCostUsd: 25.5,
    totalMonthlyInputTokens: 150000,
    totalMonthlyOutputTokens: 50000,
    mostExpensiveCompany: {
      id: 'c1',
      name: 'Test Corp',
      totalCostUsd: 45.67,
      monthlyCostUsd: 12.34,
      project: 'PROD',
    },
  },
};

describe('ManagementOverview Progressive Rendering', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });
    vi.clearAllMocks();
  });

  const renderComponent = (props: Partial<React.ComponentProps<typeof ManagementOverview>> = {}) => {
    const defaultProps = {
      overview: mockOverview,
      overviewLoading: false,
      onOpenCompany: vi.fn(),
      onOpenWorker: vi.fn(),
      onOpenTickets: vi.fn(),
      onOpenErrors: vi.fn(),
      onOpenFilePreview: vi.fn(),
      ...props,
    };

    const utils = render(
      <QueryClientProvider client={queryClient}>
        <ManagementOverview {...defaultProps} />
      </QueryClientProvider>
    );

    return { ...utils, props: defaultProps };
  };

  it('renders OverviewSkeleton only when overview is loading and no data is present', () => {
    (fetchManagementData as any).mockReturnValue(new Promise(() => {}));
    (useTickets as any).mockReturnValue({ data: undefined, isLoading: true });

    const { container } = renderComponent({ overview: undefined, overviewLoading: true });
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    expect(screen.queryByText('Felhasználók')).not.toBeInTheDocument();
  });

  it('renders main dashboard progressively when overview is available, even if secondary queries are still pending', () => {
    // Secondary queries unresolved (never resolving promise)
    (fetchManagementData as any).mockReturnValue(new Promise(() => {}));
    (useTickets as any).mockReturnValue({ data: undefined, isLoading: true });

    renderComponent({ overview: mockOverview, overviewLoading: false });

    // Top stat cards must be visible immediately
    expect(screen.getByText('Felhasználók')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Regisztrált cégek')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getAllByText('$25.5000').length).toBeGreaterThanOrEqual(1);

    // LLM Pénzügyi Áttekintés header should be rendered
    expect(screen.getByText('LLM Pénzügyi Áttekintés')).toBeInTheDocument();
  });

  it('allows clicking the most expensive company card to navigate', () => {
    (fetchManagementData as any).mockReturnValue(new Promise(() => {}));
    (useTickets as any).mockReturnValue({ data: undefined, isLoading: true });

    const onOpenCompany = vi.fn();
    renderComponent({ overview: mockOverview, overviewLoading: false, onOpenCompany });

    expect(screen.getByText('Legdrágább cég (összesen)')).toBeInTheDocument();
    expect(screen.getByText(/Össz: \$45\.6700 · Havi: \$12\.3400/)).toBeInTheDocument();

    const expensiveCard = screen.getAllByText('Test Corp')[0];
    fireEvent.click(expensiveCard);
    expect(onOpenCompany).toHaveBeenCalledWith('c1');
  });

  it('renders resolved secondary data in sub-cards when available', async () => {
    (fetchManagementData as any).mockImplementation((action: string) => {
      if (action === 'worker-status') {
        return Promise.resolve({
          containers: [{ name: 'worker-1', is_healthy: true, cpu_usage: 10, ram_usage: 20 }],
          queues: [{ visible_messages: 5 }],
          summary: { healthy_containers: 1, total_containers: 1, total_errors_24h: 0 },
        });
      }
      if (action === 'files') {
        return Promise.resolve({
          files: [
            { id: 'f1', file_name: 'test_invoice.pdf', processing_status: 'done', file_url: 'https://example.com/test.pdf' },
          ],
        });
      }
      return Promise.resolve({});
    });

    (useTickets as any).mockReturnValue({
      data: [
        { id: 't1', status: 'created', assigned_to: null },
        { id: 't2', status: 'resolved' },
      ],
      isLoading: false,
    });

    renderComponent({ overview: mockOverview, overviewLoading: false });

    // Verify tickets count rendered
    const ones = await screen.findAllByText('1');
    expect(ones.length).toBeGreaterThanOrEqual(2); // 1 unassigned and 1 resolved
    expect(await screen.findByText('test_invoice.pdf')).toBeInTheDocument();
  });

  it('renders active processing and queue counts correctly in Worker Status card', async () => {
    (fetchManagementData as any).mockImplementation((action: string) => {
      if (action === 'worker-status') {
        return Promise.resolve({
          containers: [{ name: 'worker-1', is_healthy: true, cpu_usage: 10, ram_usage: 20 }],
          queues: [{ queue_length: 4 }],
          active_processing: [{ id: 'job-1' }, { id: 'job-2' }],
          summary: {
            healthy_containers: 1,
            total_containers: 1,
            total_processing: 2,
            total_queue_pending: 4,
            total_errors_24h: 0,
          },
        });
      }
      return Promise.resolve({});
    });

    const onOpenWorker = vi.fn();
    renderComponent({ overview: mockOverview, overviewLoading: false, onOpenWorker });

    // Should display active + queue counts
    expect(await screen.findByText('2 aktív (+4 sorban)')).toBeInTheDocument();

    const processingBox = screen.getByText('Feldolgozás alatt').closest('div');
    expect(processingBox).not.toBeNull();
    fireEvent.click(processingBox!);
    expect(onOpenWorker).toHaveBeenCalled();
  });

  it('renders 0 elem when no jobs are active or pending', async () => {
    (fetchManagementData as any).mockImplementation((action: string) => {
      if (action === 'worker-status') {
        return Promise.resolve({
          containers: [{ name: 'worker-1', is_healthy: true, cpu_usage: 10, ram_usage: 20 }],
          queues: [],
          active_processing: [],
          summary: {
            healthy_containers: 1,
            total_containers: 1,
            total_processing: 0,
            total_queue_pending: 0,
            total_errors_24h: 0,
          },
        });
      }
      return Promise.resolve({});
    });

    renderComponent({ overview: mockOverview, overviewLoading: false });

    expect(await screen.findByText('0 elem')).toBeInTheDocument();
  });
});
