import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import TicketsPage from '@/pages/TicketsPage';
import { TicketDetailView } from '@/components/tickets/TicketDetailView';
import { useTickets, useIsSupportAdmin, useTicketDetail, useMarkTicketRead, type Ticket } from '@/hooks/useTickets';

vi.mock('@/hooks/useTickets', () => ({
  useTickets: vi.fn(),
  useTicketDetail: vi.fn(),
  useTicketEvents: vi.fn(() => ({ data: [], isLoading: false })),
  useMarkTicketRead: vi.fn(() => ({ mutate: vi.fn() })),
  useAddComment: vi.fn(() => ({ mutate: vi.fn() })),
  useRequestTicketResolution: vi.fn(() => ({ mutate: vi.fn() })),
  useRespondTicketResolution: vi.fn(() => ({ mutate: vi.fn() })),
  useIsSupportAdmin: vi.fn(),
  useIsManagementRole: vi.fn(() => ({ data: false, isLoading: false })),
  useSupportAgents: vi.fn(() => ({ data: [] })),
  useUpdateTicketAssignee: vi.fn(() => ({ mutateAsync: vi.fn() })),
  useUpdateTicketStatus: vi.fn(() => ({ mutateAsync: vi.fn() })),
  useUpdateTicketPriority: vi.fn(() => ({ mutate: vi.fn() })),
  useUpdateTicketStaffResponse: vi.fn(() => ({ mutateAsync: vi.fn() })),
  useDeleteTicket: vi.fn(() => ({ mutateAsync: vi.fn() })),
  useUpdateTicketAttachments: vi.fn(() => ({ mutateAsync: vi.fn() })),
  useUpdateTicketCategory: vi.fn(() => ({ mutate: vi.fn() })),
  resolveEffectiveTicketStatus: (status: string) => status,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'client-user-1', email: 'teca@test.hu' } }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
  toast: vi.fn(),
}));

vi.mock('@/lib/navigation', () => ({
  useScopedBasePath: () => '/tickets',
}));

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (k: string, fallback?: any) => (typeof fallback === 'string' ? fallback : k),
      i18n: { language: 'hu' },
    }),
  };
});

describe('Follow-up Round Ticket Alerts for Partners (Teca Issue Fix)', () => {
  const mockTickets: Ticket[] = [
    {
      id: 'ticket-round-2',
      ticket_number: 'EB-0235',
      type: 'bug',
      service: 'eaisybill',
      message: '2. körös megválaszolt ticket',
      status: 'in_progress',
      priority: 'high',
      page_url: null,
      company_name: 'Mandala Fogadó Kft',
      company_id: 'c-1',
      user_email: 'teca@test.hu',
      user_name: 'Ruzsa Teréz',
      user_id: 'client-user-1',
      created_at: '2026-10-01T08:00:00.000Z',
      updated_at: '2026-10-05T09:00:00.000Z',
      attachments: null,
      comment_count: 4,
      latest_comment_at: '2026-10-05T09:00:00.000Z',
      has_unread: true,
      last_activity_at: '2026-10-05T09:00:00.000Z',
      last_commenter_is_staff: true,
      last_commenter_name: 'Papp Roland',
      has_staff_response: true,
      assigned_to: 'admin-1',
    },
    {
      id: 'ticket-read-staff-replied',
      ticket_number: 'EB-0236',
      type: 'question',
      service: 'eaisybill',
      message: 'Elolvasott ticket, amire a support válaszolt',
      status: 'in_progress',
      priority: 'medium',
      page_url: null,
      company_name: 'Mandala Fogadó Kft',
      company_id: 'c-1',
      user_email: 'teca@test.hu',
      user_name: 'Ruzsa Teréz',
      user_id: 'client-user-1',
      created_at: '2026-10-02T10:00:00.000Z',
      updated_at: '2026-10-04T12:00:00.000Z',
      attachments: null,
      comment_count: 2,
      latest_comment_at: '2026-10-04T12:00:00.000Z',
      has_unread: false,
      last_activity_at: '2026-10-04T12:00:00.000Z',
      last_commenter_is_staff: true,
      last_commenter_name: 'ThinkAI Support',
      has_staff_response: true,
      assigned_to: 'admin-1',
    },
    {
      id: 'ticket-waiting-for-support',
      ticket_number: 'EB-0242',
      type: 'feedback',
      service: 'eaisybill',
      message: 'Ügyfél visszaküldte, support válaszra vár',
      status: 'in_progress',
      priority: 'low',
      page_url: null,
      company_name: 'Bogád-Hús Kft',
      company_id: 'c-2',
      user_email: 'teca@test.hu',
      user_name: 'Ruzsa Teréz',
      user_id: 'client-user-1',
      created_at: '2026-10-03T11:00:00.000Z',
      updated_at: '2026-10-05T05:30:00.000Z',
      attachments: null,
      comment_count: 3,
      latest_comment_at: '2026-10-05T05:30:00.000Z',
      has_unread: false,
      last_activity_at: '2026-10-05T05:30:00.000Z',
      last_commenter_is_staff: false,
      last_commenter_name: 'Ruzsa Teréz',
      has_staff_response: true,
      assigned_to: 'admin-1',
    },
  ];

  it('renders "Új válasz érkezett" badge in TicketsPage table for unread follow-up staff reply', () => {
    vi.mocked(useIsSupportAdmin).mockReturnValue({ data: false, isLoading: false } as any);
    vi.mocked(useTickets).mockReturnValue({
      data: mockTickets,
      isLoading: false,
    } as any);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TicketsPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Ticket #EB-0235 has unread staff response -> must show "Új válasz érkezett"
    expect(screen.getByText('Új válasz érkezett')).toBeInTheDocument();
    // Non-actionable indicators ("Support válaszolt" and "Válaszra vár") are removed for cleaner client view
    expect(screen.queryByText('Support válaszolt')).not.toBeInTheDocument();
    expect(screen.queryByText('Válaszra vár')).not.toBeInTheDocument();
  });

  it('renders "A support csapat válaszolt a hibajegyre" banner in TicketDetailView for client user', () => {
    vi.mocked(useIsSupportAdmin).mockReturnValue({ data: false, isLoading: false } as any);
    vi.mocked(useTicketDetail).mockReturnValue({
      data: {
        ticket: mockTickets[0],
        comments: [
          {
            id: 'c-1',
            feedback_id: 'ticket-round-2',
            user_id: 'admin-1',
            user_name: 'Papp Roland',
            user_email: 'roland@thinkai.hu',
            is_admin: true,
            message: 'Megvizsgáltuk és javítottuk a beállítást.',
            attachments: null,
            created_at: '2026-10-05T09:00:00.000Z',
          },
        ],
      },
      isLoading: false,
    } as any);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TicketDetailView feedbackId="ticket-round-2" />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Must render the client-facing staff response alert banner
    expect(screen.getByText('A support csapat válaszolt a hibajegyre')).toBeInTheDocument();
    expect(screen.getAllByText(/Papp Roland/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Válasz megtekintése')).toBeInTheDocument();
  });

  it('re-triggers markRead when new comment or activity arrives while TicketDetailView is open', () => {
    const mockMarkRead = vi.fn();
    vi.mocked(useMarkTicketRead).mockReturnValue({ mutate: mockMarkRead } as any);

    vi.mocked(useIsSupportAdmin).mockReturnValue({ data: true, isLoading: false } as any);
    const initialDetail = {
      ticket: { ...mockTickets[0], id: 'ticket-round-2', last_activity_at: '2026-10-05T09:00:00.000Z' },
      comments: [
        {
          id: 'c-1',
          feedback_id: 'ticket-round-2',
          user_id: 'admin-1',
          user_name: 'Papp Roland',
          message: 'Első válasz',
          created_at: '2026-10-05T09:00:00.000Z',
        },
      ],
    };

    vi.mocked(useTicketDetail).mockReturnValue({
      data: initialDetail,
      isLoading: false,
    } as any);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TicketDetailView feedbackId="ticket-round-2" />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(mockMarkRead).toHaveBeenCalledWith('ticket-round-2');
    mockMarkRead.mockClear();

    // Now simulate incoming second comment via realtime (last_activity_at and comments length change)
    const updatedDetail = {
      ticket: { ...mockTickets[0], id: 'ticket-round-2', last_activity_at: '2026-10-09T16:33:00.000Z' },
      comments: [
        initialDetail.comments[0],
        {
          id: 'c-2',
          feedback_id: 'ticket-round-2',
          user_id: 'client-user-1',
          user_name: 'Schwarczinger János',
          message: 'teszt2 új ügyfél válasz',
          created_at: '2026-10-09T16:33:00.000Z',
        },
      ],
    };

    vi.mocked(useTicketDetail).mockReturnValue({
      data: updatedDetail,
      isLoading: false,
    } as any);

    rerender(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TicketDetailView feedbackId="ticket-round-2" />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // markRead MUST be re-triggered for the new comment
    expect(mockMarkRead).toHaveBeenCalledWith('ticket-round-2');
  });
});
