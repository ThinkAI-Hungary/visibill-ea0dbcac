import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import TicketsPage from '@/pages/TicketsPage';
import { useTickets, useIsSupportAdmin, useSupportAgents, type Ticket } from '@/hooks/useTickets';
import { postManagementData } from '@/features/management/api/managementApi';

vi.mock('@/features/management/api/managementApi', () => ({
  fetchManagementData: vi.fn(),
  postManagementData: vi.fn().mockResolvedValue({ success: true, remindersSent: 1 }),
}));

const mockUpdateStaffResponse = vi.fn().mockResolvedValue({});

vi.mock('@/hooks/useTickets', () => ({
  useTickets: vi.fn(),
  useTicketDetail: vi.fn(() => ({ data: { ticket: null, comments: [] }, isLoading: false })),
  useTicketEvents: vi.fn(() => ({ data: [], isLoading: false })),
  useMarkTicketRead: vi.fn(() => ({ mutate: vi.fn() })),
  useAddComment: vi.fn(() => ({ mutate: vi.fn() })),
  useRequestTicketResolution: vi.fn(() => ({ mutate: vi.fn() })),
  useRespondTicketResolution: vi.fn(() => ({ mutate: vi.fn() })),
  useIsSupportAdmin: vi.fn(),
  useSupportAgents: vi.fn(),
  useUpdateTicketAssignee: vi.fn(() => ({ mutateAsync: vi.fn() })),
  useUpdateTicketStatus: vi.fn(() => ({ mutateAsync: vi.fn() })),
  useUpdateTicketPriority: vi.fn(() => ({ mutate: vi.fn() })),
  useUpdateTicketStaffResponse: vi.fn(() => ({ mutateAsync: mockUpdateStaffResponse })),
  resolveEffectiveTicketStatus: (status: string) => status,
}));

vi.mock('@/components/tickets/TicketDetailView', () => ({
  TicketDetailView: ({ feedbackId }: any) => <div data-testid="detail-view">{feedbackId}</div>,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'admin-1', email: 'admin@test.com' } }),
}));

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/lib/navigation', () => ({
  useScopedBasePath: () => '/app/test-company/2026-06-01_2026-06-30',
}));

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (k: string, defaultVal?: any) => (typeof defaultVal === 'string' ? defaultVal : k),
      i18n: { language: 'hu' },
    }),
  };
});

const mockOverdueTickets: Ticket[] = [
  {
    id: 'ticket-overdue-1',
    ticket_number: 'EB-0100',
    type: 'bug',
    service: 'eaisybill',
    message: 'Segítség, elakadtam a számla feltöltéssel!',
    status: 'assigned',
    priority: 'high',
    page_url: null,
    company_name: 'Overdue Kft',
    company_id: 'c-100',
    user_email: 'client@overdue.hu',
    user_name: 'Overdue Client',
    user_id: 'u-100',
    created_at: '2026-09-18T10:00:00.000Z',
    updated_at: '2026-09-18T10:00:00.000Z',
    attachments: null,
    comment_count: 0,
    latest_comment_at: null,
    has_unread: false,
    assigned_to: 'admin-1',
    assigned_to_name: 'Admin One',
    sla: {
      isOverdue48h: true,
      hoursWaiting: 72,
      lastCustomerMessageAt: '2026-09-18T10:00:00.000Z',
      targetParty: 'assignee',
      severity: 'breached_48h',
      formattedWaitTime: '3 nap',
    },
  },
  {
    id: 'ticket-normal-2',
    ticket_number: 'EB-0101',
    type: 'question',
    service: 'eaisybill',
    message: 'Egyszerű friss kérdés',
    status: 'assigned',
    priority: 'low',
    page_url: null,
    company_name: 'Normal Kft',
    company_id: 'c-101',
    user_email: 'client@normal.hu',
    user_name: 'Normal Client',
    user_id: 'u-101',
    created_at: '2026-09-21T10:00:00.000Z',
    updated_at: '2026-09-21T10:00:00.000Z',
    attachments: null,
    comment_count: 0,
    latest_comment_at: null,
    has_unread: false,
    assigned_to: 'admin-1',
    assigned_to_name: 'Admin One',
    sla: {
      isOverdue48h: false,
      hoursWaiting: 2,
      lastCustomerMessageAt: '2026-09-21T10:00:00.000Z',
      targetParty: 'assignee',
      severity: 'normal',
      formattedWaitTime: '2ó',
    },
  },
];

describe('Ticket 48h SLA Reminder Integration in TicketsPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.mocked(useTickets).mockReturnValue({
      data: mockOverdueTickets,
      isLoading: false,
      refetch: vi.fn(),
    } as any);
    vi.mocked(useIsSupportAdmin).mockReturnValue({ data: true } as any);
    vi.mocked(useSupportAgents).mockReturnValue({
      data: [{ user_id: 'admin-1', name: 'Admin One', is_support_admin: true }],
    } as any);
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TicketsPage embeddedInManagement={true} />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it('renders the 48h+ overdue KPI card and shows 1 overdue ticket', () => {
    renderComponent();
    expect(screen.getByText('48h+ válaszra vár')).toBeInTheDocument();
    // Overdue count is 1
    const countElement = screen.getByText('1');
    expect(countElement).toBeInTheDocument();
  });

  it('renders SLA badge on the overdue ticket in the table', () => {
    renderComponent();
    expect(screen.getByText(/48h\+ \(3 nap\)/i)).toBeInTheDocument();
  });

  it('filters table to only overdue tickets when clicking the 48h+ KPI card', async () => {
    renderComponent();
    // Both tickets initially visible
    expect(screen.getByText('#EB-0100')).toBeInTheDocument();
    expect(screen.getByText('#EB-0101')).toBeInTheDocument();

    // Click on 48h+ KPI card
    const overdueCard = screen.getByText('48h+ válaszra vár').closest('.cursor-pointer');
    expect(overdueCard).toBeTruthy();
    fireEvent.click(overdueCard!);

    // Now only the overdue ticket remains visible
    expect(screen.getByText('#EB-0100')).toBeInTheDocument();
    expect(screen.queryByText('#EB-0101')).not.toBeInTheDocument();

    // Active filter banner is displayed
    expect(
      screen.getByText(/Szűrés aktív: Csak a 48 órája megválaszolatlan, teendőt igénylő hibajegyek jelennek meg/i)
    ).toBeInTheDocument();

    // Clicking clear filter restores all tickets
    const clearBtn = screen.getByText('Szűrő törlése');
    fireEvent.click(clearBtn);
    expect(screen.getByText('#EB-0101')).toBeInTheDocument();
  });

  it('triggers send-ticket-reminders action when clicking Emlékeztetők küldése button', async () => {
    renderComponent();
    const sendButton = screen.getByRole('button', { name: /Emlékeztetők küldése \(1\)/i });
    expect(sendButton).toBeInTheDocument();

    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(postManagementData).toHaveBeenCalledWith('send-ticket-reminders', {});
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Emlékeztetők kiküldve',
        })
      );
    });
  });

  it('calls updateStaffResponse when clicking quick mark no response button', async () => {
    renderComponent();
    const quickMarkButton = screen.getByRole('button', { name: /Nem igényel választ/i });
    expect(quickMarkButton).toBeInTheDocument();

    fireEvent.click(quickMarkButton);

    await waitFor(() => {
      expect(mockUpdateStaffResponse).toHaveBeenCalledWith({
        feedbackId: 'ticket-overdue-1',
        needsStaffResponse: false,
      });
    });
  });
});
