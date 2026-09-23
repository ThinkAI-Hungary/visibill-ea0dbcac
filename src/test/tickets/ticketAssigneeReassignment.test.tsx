import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { TicketDetailView } from '@/components/tickets/TicketDetailView';
import * as useTicketsHooks from '@/hooks/useTickets';

const mockMutateUpdateAssignee = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/tickets/ticket-reassign-1' }),
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
  useUpdateTicketAssignee: vi.fn(() => ({
    mutate: (...args: any[]) => mockMutateUpdateAssignee(...args),
    mutateAsync: vi.fn(),
  })),
  useSupportAgents: vi.fn(() => ({
    data: [
      { user_id: 'agent-1', name: 'Support Agent 1', email: 'agent1@test.com' },
      { user_id: 'agent-2', name: 'Support Agent 2', email: 'agent2@test.com' },
    ],
    isLoading: false,
  })),
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

const mockAssignedTicket = {
  id: 'ticket-reassign-1',
  ticket_number: 'EB-0099',
  type: 'bug',
  service: 'eaisybill',
  message: '<p>Nem működik a számla szinkronizáció</p>',
  status: 'assigned',
  priority: 'high',
  page_url: null,
  company_name: 'Teszt Cég Kft.',
  company_id: 'c-1',
  user_email: 'user@test.com',
  user_name: 'Teszt Elek',
  user_id: 'u-1',
  created_at: '2026-08-10T10:00:00.000Z',
  updated_at: '2026-08-10T11:00:00.000Z',
  attachments: null,
  comment_count: 0,
  latest_comment_at: null,
  has_unread: false,
  assigned_to: 'agent-1',
  assigned_to_name: 'Support Agent 1',
  needs_staff_response: false,
  sla: null,
};

describe('Ticket Reassignment to Another Support Agent', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.mocked(useTicketsHooks.useTicketDetail).mockReturnValue({
      data: { ticket: mockAssignedTicket, comments: [] },
      isLoading: false,
      isError: false,
    } as any);
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TicketDetailView feedbackId="ticket-reassign-1" />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it('renders editable assignee dropdown when user is support admin', () => {
    vi.mocked(useTicketsHooks.useIsSupportAdmin).mockReturnValue({ data: true, isLoading: false } as any);
    vi.mocked(useTicketsHooks.useIsManagementRole).mockReturnValue({ data: false, isLoading: false } as any);

    renderComponent();

    // The Felelős section should be visible
    expect(screen.getByText(/detail\.prop_assignee/i)).toBeInTheDocument();
    // Select combobox should be present for admin
    const comboboxes = screen.getAllByRole('combobox');
    expect(comboboxes.length).toBeGreaterThanOrEqual(1);
  });

  it('renders editable assignee dropdown when user has management role (even if not support admin)', () => {
    vi.mocked(useTicketsHooks.useIsSupportAdmin).mockReturnValue({ data: false, isLoading: false } as any);
    vi.mocked(useTicketsHooks.useIsManagementRole).mockReturnValue({ data: true, isLoading: false } as any);

    renderComponent();

    expect(screen.getByText(/detail\.prop_assignee/i)).toBeInTheDocument();
    const comboboxes = screen.getAllByRole('combobox');
    expect(comboboxes.length).toBeGreaterThanOrEqual(1);
  });

  it('renders read-only assignee name when regular user views the ticket', () => {
    vi.mocked(useTicketsHooks.useIsSupportAdmin).mockReturnValue({ data: false, isLoading: false } as any);
    vi.mocked(useTicketsHooks.useIsManagementRole).mockReturnValue({ data: false, isLoading: false } as any);

    renderComponent();

    // Should display static assigned name without select trigger
    expect(screen.getByText('Support Agent 1')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});
