import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { TicketDetailView } from '@/components/tickets/TicketDetailView';
import * as useTicketsHooks from '@/hooks/useTickets';

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/tickets/ticket-overdue-1' }),
  };
});

vi.mock('@/hooks/useTickets', () => ({
  useTicketDetail: vi.fn(),
  useTicketEvents: vi.fn(() => ({ data: [], isLoading: false })),
  useAddComment: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useRequestTicketResolution: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useUpdateTicketStatus: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useMarkTicketRead: vi.fn(() => ({ mutate: vi.fn() })),
  useIsSupportAdmin: vi.fn(),
  useIsManagementRole: vi.fn(),
  useUpdateTicketPriority: vi.fn(() => ({ mutate: vi.fn() })),
  useUpdateTicketAssignee: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn() })),
  useSupportAgents: vi.fn(() => ({ data: [], isLoading: false })),
  useUpdateTicketAttachments: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useRespondTicketResolution: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useDeleteTicket: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useTickets: vi.fn(() => ({ data: [], isLoading: false, refetch: vi.fn() })),
  useUpdateTicketStaffResponse: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  resolveEffectiveTicketStatus: (status: string) => status,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u-1', email: 'user@test.com' } }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/navigation', () => ({
  useScopedBasePath: () => '/app/test-company/2026-06-01_2026-06-30',
}));

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (k: string, options?: any) => (typeof options === 'string' ? options : options?.defaultValue || k),
      i18n: { language: 'hu' },
    }),
  };
});

const mockOverdueTicket = {
  id: 'ticket-overdue-1',
  ticket_number: 'EB-0001',
  type: 'bug',
  service: 'eaisybill',
  message: '<p>Hogy tudok belenyúlni a munkanapokba manuálisan?</p>',
  status: 'in_progress',
  priority: 'medium',
  page_url: null,
  company_name: 'Kellet Kft.',
  company_id: 'c-1',
  user_email: 'bettina@kellet.hu',
  user_name: 'Magyar Bettina',
  user_id: 'u-1',
  created_at: '2026-07-29T14:00:00.000Z',
  updated_at: '2026-07-29T14:00:00.000Z',
  attachments: null,
  comment_count: 0,
  latest_comment_at: null,
  has_unread: false,
  assigned_to: 'admin-1',
  assigned_to_name: 'Admin One',
  needs_staff_response: true,
  sla: {
    isOverdue48h: true,
    hoursWaiting: 1347,
    lastCustomerMessageAt: '2026-07-29T14:00:00.000Z',
    targetParty: 'assignee' as const,
    severity: 'breached_48h' as const,
    formattedWaitTime: '56 nap',
  },
};

describe('TicketDetailView SLA & Warning Visibility by Role', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.mocked(useTicketsHooks.useTicketDetail).mockReturnValue({
      data: { ticket: mockOverdueTicket, comments: [] },
      isLoading: false,
      isError: false,
    } as any);
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TicketDetailView feedbackId="ticket-overdue-1" />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it('HIDES SLA warning banner and SLA badge for regular users', () => {
    vi.mocked(useTicketsHooks.useIsSupportAdmin).mockReturnValue({ data: false, isLoading: false } as any);
    vi.mocked(useTicketsHooks.useIsManagementRole).mockReturnValue({ data: false, isLoading: false } as any);

    renderComponent();

    // Ticket info and message should be visible
    expect(screen.getByText('EB-0001')).toBeInTheDocument();
    expect(screen.getByText(/Hogy tudok belenyúlni a munkanapokba manuálisan/i)).toBeInTheDocument();

    // 1. SLA Figyelmeztetés Warning Banner should NOT be visible
    expect(screen.queryByText(/SLA Figyelmeztetés: 48 órája megválaszolatlan megkeresés!/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/A hibajegy felelőseként az ügyfél utolsó üzenete óta/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/1347 órája várakozik/i)).not.toBeInTheDocument();

    // 2. SLA badge in header should NOT be visible
    expect(screen.queryByText(/48h\+ válaszra vár/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/56 nap/i)).not.toBeInTheDocument();

    // 3. "Nem igényel választ" button / badge should NOT be visible
    expect(screen.queryByText('Nem igényel választ')).not.toBeInTheDocument();
  });

  it('SHOWS SLA warning banner and SLA badge for support admin', () => {
    vi.mocked(useTicketsHooks.useIsSupportAdmin).mockReturnValue({ data: true, isLoading: false } as any);
    vi.mocked(useTicketsHooks.useIsManagementRole).mockReturnValue({ data: false, isLoading: false } as any);

    renderComponent();

    // 1. SLA Figyelmeztetés Warning Banner is visible for support admin
    expect(screen.getByText(/SLA Figyelmeztetés: 48 órája megválaszolatlan megkeresés!/i)).toBeInTheDocument();
    expect(screen.getByText(/1347 órája várakozik/i)).toBeInTheDocument();
    expect(screen.getByText(/A hibajegy felelőseként az ügyfél utolsó üzenete óta/i)).toBeInTheDocument();

    // 2. SLA badge in header is visible
    expect(screen.getByText(/48h\+ válaszra vár \(56 nap\)/i)).toBeInTheDocument();

    // 3. Quick action buttons inside banner and header
    expect(screen.getByText('Válasz írása')).toBeInTheDocument();
  });

  it('SHOWS SLA warning banner and SLA badge for management role users', () => {
    vi.mocked(useTicketsHooks.useIsSupportAdmin).mockReturnValue({ data: false, isLoading: false } as any);
    vi.mocked(useTicketsHooks.useIsManagementRole).mockReturnValue({ data: true, isLoading: false } as any);

    renderComponent();

    // Visible for management role user even if is_support_admin is false
    expect(screen.getByText(/SLA Figyelmeztetés: 48 órája megválaszolatlan megkeresés!/i)).toBeInTheDocument();
    expect(screen.getByText(/48h\+ válaszra vár \(56 nap\)/i)).toBeInTheDocument();
  });
});
