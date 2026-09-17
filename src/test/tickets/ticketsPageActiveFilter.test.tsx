import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import TicketsPage, { ACTIVE_TICKET_STATUSES } from '@/pages/TicketsPage';
import { useTickets, useIsSupportAdmin, useSupportAgents } from '@/hooks/useTickets';

vi.mock('@/hooks/useTickets', () => ({
  useTickets: vi.fn(),
  useIsSupportAdmin: vi.fn(),
  useSupportAgents: vi.fn(),
  useUpdateTicketAssignee: vi.fn(() => ({ mutateAsync: vi.fn() })),
  useUpdateTicketStatus: vi.fn(() => ({ mutateAsync: vi.fn() })),
  resolveEffectiveTicketStatus: (status: string) => status,
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
      t: (k: string, options?: any) => {
        if (typeof options === 'string') return options;
        if (options && typeof options === 'object') {
          if (options.defaultValue) return options.defaultValue;
          if (options.count !== undefined) {
            if (k.includes('active_count')) return `Aktív jegyek (${options.count})`;
            if (k.includes('all_count')) return `Összes státusz (${options.count})`;
          }
        }
        return k;
      },
      i18n: { language: 'hu' },
    }),
  };
});

const mockTickets = [
  {
    id: 't-1',
    ticket_number: 'TCK-001',
    type: 'bug',
    service: 'eaisybill',
    message: 'Nyitott hiba jegy',
    status: 'created',
    priority: 'high',
    company_name: 'Test Kft',
    user_email: 'user1@test.com',
    user_name: 'Teszt Elek',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    assigned_to: 'admin-1',
    has_unread: false,
  },
  {
    id: 't-2',
    ticket_number: 'TCK-002',
    type: 'question',
    service: 'eaisybill',
    message: 'Folyamatban lévő kérdés',
    status: 'in_progress',
    priority: 'medium',
    company_name: 'Test Kft',
    user_email: 'user2@test.com',
    user_name: 'Kérdező Kata',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    assigned_to: 'admin-1',
    has_unread: false,
  },
  {
    id: 't-3',
    ticket_number: 'TCK-003',
    type: 'feedback',
    service: 'eaisybill',
    message: 'Már megoldott jegy',
    status: 'resolved',
    priority: 'low',
    company_name: 'Test Kft',
    user_email: 'user3@test.com',
    user_name: 'Megoldott Miki',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    assigned_to: 'admin-1',
    has_unread: false,
  },
];

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <TicketsPage embeddedInManagement={true} />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe('TicketsPage Active Status Filter (Exclude Resolved by default)', () => {
  it('defines ACTIVE_TICKET_STATUSES without resolved status', () => {
    expect(ACTIVE_TICKET_STATUSES).toEqual(['created', 'assigned', 'in_progress']);
    expect(ACTIVE_TICKET_STATUSES).not.toContain('resolved');
  });

  it('renders only active (created, in_progress) tickets by default and hides resolved tickets', async () => {
    vi.mocked(useTickets).mockReturnValue({
      data: mockTickets,
      isLoading: false,
      refetch: vi.fn(),
    } as any);
    vi.mocked(useIsSupportAdmin).mockReturnValue({ data: true } as any);
    vi.mocked(useSupportAgents).mockReturnValue({ data: [] } as any);

    renderPage();

    // Active tickets must be visible
    expect(screen.getByText(/Nyitott hiba jegy/)).toBeInTheDocument();
    expect(screen.getByText(/Folyamatban lévő kérdés/)).toBeInTheDocument();

    // Resolved ticket must NOT be visible by default
    expect(screen.queryByText(/Már megoldott jegy/)).not.toBeInTheDocument();
  });

  it('displays resolved tickets when clicking the Megoldva KPI card', async () => {
    vi.mocked(useTickets).mockReturnValue({
      data: mockTickets,
      isLoading: false,
      refetch: vi.fn(),
    } as any);
    vi.mocked(useIsSupportAdmin).mockReturnValue({ data: true } as any);
    vi.mocked(useSupportAgents).mockReturnValue({ data: [] } as any);

    renderPage();

    // Click on 'Megoldva' KPI card
    const resolvedKpi = screen.getByText('Megoldva').closest('.cursor-pointer');
    expect(resolvedKpi).not.toBeNull();
    fireEvent.click(resolvedKpi!);

    // Now resolved ticket is visible
    expect(screen.getByText(/Már megoldott jegy/)).toBeInTheDocument();

    // Active tickets are now hidden because only 'resolved' is selected
    expect(screen.queryByText(/Nyitott hiba jegy/)).not.toBeInTheDocument();
  });

  it('displays resolved ticket by default if it has an unread message', async () => {
    const ticketsWithUnreadResolved = [
      ...mockTickets.slice(0, 2),
      {
        ...mockTickets[2], // TCK-003, resolved
        has_unread: true,
      },
    ];

    vi.mocked(useTickets).mockReturnValue({
      data: ticketsWithUnreadResolved,
      isLoading: false,
      refetch: vi.fn(),
    } as any);
    vi.mocked(useIsSupportAdmin).mockReturnValue({ data: true } as any);
    vi.mocked(useSupportAgents).mockReturnValue({ data: [] } as any);

    renderPage();

    // Even though it is resolved, because has_unread is true, it MUST be visible to the user!
    expect(screen.getByText(/Már megoldott jegy/)).toBeInTheDocument();
  });

  it('displays resolved ticket when user actively searches for it', async () => {
    vi.mocked(useTickets).mockReturnValue({
      data: mockTickets,
      isLoading: false,
      refetch: vi.fn(),
    } as any);
    vi.mocked(useIsSupportAdmin).mockReturnValue({ data: true } as any);
    vi.mocked(useSupportAgents).mockReturnValue({ data: [] } as any);

    renderPage();

    const searchInput = screen.getByPlaceholderText(/Keresés/);
    fireEvent.change(searchInput, { target: { value: 'TCK-003' } });

    // Resolved ticket TCK-003 must be found when searching explicitly
    expect(screen.getByText(/Már megoldott jegy/)).toBeInTheDocument();
  });

  it('does NOT display other agents in-progress tickets by default for support admin', async () => {
    const ticketsWithOtherAgent = [
      ...mockTickets.slice(0, 2),
      {
        id: 't-other',
        ticket_number: 'TCK-999',
        type: 'bug',
        service: 'eaisybill',
        message: 'Másik kolléga jegye',
        status: 'in_progress',
        priority: 'high',
        company_name: 'Other Kft',
        user_email: 'other@test.com',
        user_name: 'Másik Felhasználó',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        assigned_to: 'other-agent-id',
        has_unread: true,
      },
    ];

    vi.mocked(useTickets).mockReturnValue({
      data: ticketsWithOtherAgent,
      isLoading: false,
      refetch: vi.fn(),
    } as any);
    vi.mocked(useIsSupportAdmin).mockReturnValue({ data: true } as any);
    vi.mocked(useSupportAgents).mockReturnValue({ data: [] } as any);

    renderPage();

    // The other agent's ticket must NOT appear in the admin's personal queue
    expect(screen.queryByText(/Másik kolléga jegye/)).not.toBeInTheDocument();
  });
});
