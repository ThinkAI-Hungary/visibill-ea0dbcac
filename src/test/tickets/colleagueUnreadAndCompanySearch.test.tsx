import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import TicketsPage from '@/pages/TicketsPage';
import * as useTicketsHook from '@/hooks/useTickets';
import * as authContext from '@/contexts/AuthContext';

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/tickets' }),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/navigation', () => ({
  useScopedBasePath: () => '/app/test-company/2026-06-01_2026-06-30',
}));

vi.mock('@/hooks/useTickets', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useTickets')>();
  return {
    ...actual,
    useTickets: vi.fn(),
    useIsSupportAdmin: vi.fn(() => ({ data: false })),
    useIsManagementRole: vi.fn(() => ({ data: false })),
    useSupportAgents: vi.fn(() => ({ data: [] })),
    useUpdateTicketAssignee: vi.fn(() => ({ mutateAsync: vi.fn() })),
    useUpdateTicketStatus: vi.fn(() => ({ mutateAsync: vi.fn() })),
    useUpdateTicketStaffResponse: vi.fn(() => ({ mutateAsync: vi.fn() })),
  };
});

describe('Colleague Unread Isolation & Company Search Filter in TicketsPage', () => {
  const mockTickets: useTicketsHook.Ticket[] = [
    {
      id: 'ticket-adam-1',
      ticket_number: 'EB-0144',
      type: 'bug',
      category: 'főkönyv',
      service: 'eaisybill',
      message: 'Főkönyvi zárási hiba',
      status: 'created',
      priority: 'high',
      company_name: 'Sümegi és Társa Kft',
      company_id: 'comp-sumegi',
      user_id: 'user-adam',
      user_name: 'Lendvai Ádám',
      user_email: 'adam@van.hu',
      created_at: '2026-09-24T10:00:00Z',
      updated_at: '2026-09-24T11:00:00Z',
      has_unread: false, // will be tested
      comment_count: 1,
    },
    {
      id: 'ticket-emese-1',
      ticket_number: 'EB-0145',
      type: 'feedback',
      category: 'áfa',
      service: 'eaisybooks',
      message: 'Áfa analitika export javaslat',
      status: 'created',
      priority: 'medium',
      company_name: 'Termometal Kft',
      company_id: 'comp-termo',
      user_id: 'user-emese',
      user_name: 'Ván Emese',
      user_email: 'emese@van.hu',
      created_at: '2026-09-24T12:00:00Z',
      updated_at: '2026-09-24T12:00:00Z',
      has_unread: false,
      comment_count: 0,
    },
  ];

  it('filters tickets accurately using the dedicated company search input', () => {
    vi.mocked(authContext.useAuth).mockReturnValue({
      user: { id: 'user-emese', email: 'emese@van.hu' } as any,
    } as any);

    vi.mocked(useTicketsHook.useTickets).mockReturnValue({
      data: mockTickets,
      isLoading: false,
      refetch: vi.fn(),
    } as any);

    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TicketsPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Both tickets are initially rendered
    expect(screen.getByText('Sümegi és Társa Kft')).toBeInTheDocument();
    expect(screen.getByText('Termometal Kft')).toBeInTheDocument();

    // Find the company search bar
    const companySearchInput = screen.getByPlaceholderText('Szűrés cégre...');
    expect(companySearchInput).toBeInTheDocument();

    // Filter by "Sümegi"
    fireEvent.change(companySearchInput, { target: { value: 'Sümegi' } });

    // Sümegi remains, Termometal is filtered out
    expect(screen.getByText('Sümegi és Társa Kft')).toBeInTheDocument();
    expect(screen.queryByText('Termometal Kft')).not.toBeInTheDocument();

    // Clear company filter
    fireEvent.change(companySearchInput, { target: { value: '' } });
    expect(screen.getByText('Sümegi és Társa Kft')).toBeInTheDocument();
    expect(screen.getByText('Termometal Kft')).toBeInTheDocument();
  });
});
