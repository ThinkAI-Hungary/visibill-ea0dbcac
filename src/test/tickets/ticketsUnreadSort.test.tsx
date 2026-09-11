import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import TicketsPage, { sortTicketsByUnreadAndDate } from '@/pages/TicketsPage';
import { useTickets, useIsSupportAdmin, useSupportAgents, type Ticket } from '@/hooks/useTickets';

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
  resolveEffectiveTicketStatus: (status: string) => status,
}));

vi.mock('@/components/tickets/TicketDetailView', () => ({
  TicketDetailView: ({ feedbackId }: any) => <div data-testid="detail-view">{feedbackId}</div>,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'admin-1', email: 'admin@test.com' } }),
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
      t: (k: string) => k,
      i18n: { language: 'hu' },
    }),
  };
});

const sampleTickets: Ticket[] = [
  {
    id: 't-1',
    ticket_number: 'EB-0080',
    type: 'bug',
    service: 'eaisybill',
    message: 'Régi jegy olvasatlan üzenettel',
    status: 'in_progress',
    priority: 'medium',
    page_url: null,
    company_name: 'Test Kft 1',
    company_id: 'c-1',
    user_email: 'u1@test.hu',
    user_name: 'User One',
    user_id: 'u-1',
    created_at: '2026-09-01T10:00:00.000Z',
    updated_at: '2026-09-01T10:00:00.000Z',
    attachments: null,
    comment_count: 3,
    latest_comment_at: '2026-09-10T08:00:00.000Z',
    has_unread: true,
    assigned_to: 'admin-1',
  },
  {
    id: 't-2',
    ticket_number: 'EB-0095',
    type: 'bug',
    service: 'eaisybill',
    message: 'Új jegy olvasva',
    status: 'in_progress',
    priority: 'high',
    page_url: null,
    company_name: 'Test Kft 2',
    company_id: 'c-2',
    user_email: 'u2@test.hu',
    user_name: 'User Two',
    user_id: 'u-2',
    created_at: '2026-09-11T09:00:00.000Z',
    updated_at: '2026-09-11T09:00:00.000Z',
    attachments: null,
    comment_count: 1,
    latest_comment_at: null,
    has_unread: false,
    assigned_to: 'admin-1',
  },
  {
    id: 't-3',
    ticket_number: 'EB-0090',
    type: 'question',
    service: 'eaisybill',
    message: 'Közepes korú jegy a legfrissebb olvasatlan üzenettel',
    status: 'in_progress',
    priority: 'low',
    page_url: null,
    company_name: 'Test Kft 3',
    company_id: 'c-3',
    user_email: 'u3@test.hu',
    user_name: 'User Three',
    user_id: 'u-3',
    created_at: '2026-09-05T12:00:00.000Z',
    updated_at: '2026-09-05T12:00:00.000Z',
    attachments: null,
    comment_count: 5,
    latest_comment_at: '2026-09-11T08:30:00.000Z',
    has_unread: true,
    assigned_to: 'admin-1',
  },
  {
    id: 't-4',
    ticket_number: 'EB-0070',
    type: 'question',
    service: 'eaisybill',
    message: 'Legrégebbi jegy olvasva',
    status: 'in_progress',
    priority: 'low',
    page_url: null,
    company_name: 'Test Kft 4',
    company_id: 'c-4',
    user_email: 'u4@test.hu',
    user_name: 'User Four',
    user_id: 'u-4',
    created_at: '2026-08-20T10:00:00.000Z',
    updated_at: '2026-08-20T10:00:00.000Z',
    attachments: null,
    comment_count: 0,
    latest_comment_at: null,
    has_unread: false,
    assigned_to: 'admin-1',
  },
];

describe('sortTicketsByUnreadAndDate unit function', () => {
  it('places unread tickets before read tickets, and sorts by activity/creation', () => {
    const sorted = sortTicketsByUnreadAndDate(sampleTickets);

    // First two must be the unread ones (EB-0090 with newest comment, then EB-0080)
    expect(sorted[0].ticket_number).toBe('EB-0090');
    expect(sorted[0].has_unread).toBe(true);
    expect(sorted[1].ticket_number).toBe('EB-0080');
    expect(sorted[1].has_unread).toBe(true);

    // The remaining read tickets should be sorted by created_at DESC (EB-0095, then EB-0070)
    expect(sorted[2].ticket_number).toBe('EB-0095');
    expect(sorted[2].has_unread).toBe(false);
    expect(sorted[3].ticket_number).toBe('EB-0070');
    expect(sorted[3].has_unread).toBe(false);
  });
});

describe('TicketsPage unread ticket sorting integration', () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  it('renders unread tickets at the top of the table list in TicketsPage', () => {
    vi.mocked(useTickets).mockReturnValue({
      data: sampleTickets,
      isLoading: false,
      refetch: vi.fn(),
    } as any);
    vi.mocked(useIsSupportAdmin).mockReturnValue({ data: true } as any);
    vi.mocked(useSupportAgents).mockReturnValue({ data: [] } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/management?view=tickets&subView=list']}>
          <TicketsPage embeddedInManagement={true} />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Get all rendered ticket number cells in the table
    const ticketCells = screen.getAllByText(/#EB-\d{4}/);
    const renderedNumbers = ticketCells.map(el => el.textContent?.trim());

    // The first rendered ticket numbers in the table MUST be the unread tickets (#EB-0090, #EB-0080)
    expect(renderedNumbers[0]).toBe('#EB-0090');
    expect(renderedNumbers[1]).toBe('#EB-0080');
    expect(renderedNumbers[2]).toBe('#EB-0095');
    expect(renderedNumbers[3]).toBe('#EB-0070');
  });

  it('renders unread tickets at the top of the Kezelőkonzol queue sidebar', () => {
    vi.mocked(useTickets).mockReturnValue({
      data: sampleTickets,
      isLoading: false,
      refetch: vi.fn(),
    } as any);
    vi.mocked(useIsSupportAdmin).mockReturnValue({ data: true } as any);
    vi.mocked(useSupportAgents).mockReturnValue({ data: [] } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/management?view=tickets&subView=console']}>
          <TicketsPage embeddedInManagement={true} />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Get all rendered ticket cards in the console sidebar
    const ticketCards = screen.getAllByText(/#EB-\d{4}/);
    const renderedNumbers = ticketCards.map(el => el.textContent?.trim());

    // In console sidebar, unread tickets MUST be at the top!
    expect(renderedNumbers[0]).toBe('#EB-0090');
    expect(renderedNumbers[1]).toBe('#EB-0080');
  });
});
