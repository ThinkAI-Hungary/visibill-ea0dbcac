import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import TicketsPage, { matchTicketSearch } from '@/pages/TicketsPage';
import { useTickets, useIsSupportAdmin, useSupportAgents, type Ticket } from '@/hooks/useTickets';

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
      t: (k: string) => k,
      i18n: { language: 'hu' },
    }),
  };
});

const mockTickets: Ticket[] = [
  {
    id: 't-1',
    ticket_number: 'EB-0095',
    type: 'question',
    service: 'eaisybill',
    message: 'TÁRGY: E-mail Integráció / Generálás hiba',
    status: 'created',
    priority: 'high',
    company_name: 'Mauroni Events KFT.',
    company_id: 'c-1',
    user_email: 'mauroni@test.com',
    user_name: 'Mauroni Balázs',
    user_id: 'u-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    attachments: null,
    comment_count: 1,
    latest_comment_at: null,
    has_unread: false,
    assigned_to: 'admin-1',
  },
  {
    id: 't-2',
    ticket_number: 'EB-0094',
    type: 'bug',
    service: 'eaisybill',
    message: 'Ismeretlen okból nem párosítja össze a tételeket',
    status: 'in_progress',
    priority: 'medium',
    company_name: 'Sanctus Könyvelőiroda Kft.',
    company_id: 'c-2',
    user_email: 'gergo@sanctus.hu',
    user_name: 'Csejtei Gergő',
    user_id: 'u-2',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    attachments: null,
    comment_count: 2,
    latest_comment_at: null,
    has_unread: false,
    assigned_to: 'admin-1',
  },
  {
    id: 't-3',
    ticket_number: 'EB-0093',
    type: 'bug',
    service: 'eaisybill',
    message: 'Bank hibás beolvasása. Feltöltött kivonat.',
    status: 'resolved',
    priority: 'medium',
    company_name: 'VBV Vision Kft.',
    company_id: 'c-3',
    user_email: 'vbv@vision.hu',
    user_name: 'Varga Béla',
    user_id: 'u-3',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    attachments: null,
    comment_count: 0,
    latest_comment_at: null,
    has_unread: false,
    assigned_to: 'admin-1',
  },
];

describe('matchTicketSearch helper function', () => {
  const sampleTicket = mockTickets[0]; // EB-0095, Mauroni Events KFT., Mauroni Balázs, E-mail Integráció

  it('matches empty query to true', () => {
    expect(matchTicketSearch(sampleTicket, '')).toBe(true);
    expect(matchTicketSearch(sampleTicket, '   ')).toBe(true);
  });

  it('matches exact ticket number', () => {
    expect(matchTicketSearch(sampleTicket, 'EB-0095')).toBe(true);
    expect(matchTicketSearch(sampleTicket, 'eb-0095')).toBe(true);
    expect(matchTicketSearch(sampleTicket, '0095')).toBe(true);
    expect(matchTicketSearch(sampleTicket, '95')).toBe(true);
  });

  it('matches ticket number with # prefix even if ticket_number does not store #', () => {
    expect(matchTicketSearch(sampleTicket, '#EB-0095')).toBe(true);
    expect(matchTicketSearch(sampleTicket, '#0095')).toBe(true);
    expect(matchTicketSearch(sampleTicket, '#95')).toBe(true);
  });

  it('matches company name', () => {
    expect(matchTicketSearch(sampleTicket, 'Mauroni')).toBe(true);
    expect(matchTicketSearch(sampleTicket, 'mauroni events')).toBe(true);
  });

  it('matches user name and email', () => {
    expect(matchTicketSearch(sampleTicket, 'Balázs')).toBe(true);
    expect(matchTicketSearch(sampleTicket, 'mauroni@test.com')).toBe(true);
  });

  it('matches message content', () => {
    expect(matchTicketSearch(sampleTicket, 'Integráció')).toBe(true);
    expect(matchTicketSearch(sampleTicket, 'integráció')).toBe(true);
  });

  it('returns false when no field matches', () => {
    expect(matchTicketSearch(sampleTicket, 'NemLétezőSzöveg123')).toBe(false);
  });
});

describe('TicketsPage Console View Search', () => {
  function renderConsole() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return render(
      <MemoryRouter initialEntries={['/management?subView=console']}>
        <QueryClientProvider client={queryClient}>
          <TicketsPage embeddedInManagement={true} />
        </QueryClientProvider>
      </MemoryRouter>
    );
  }

  beforeEach(() => {
    vi.mocked(useTickets).mockReturnValue({
      data: mockTickets,
      isLoading: false,
      refetch: vi.fn(),
    } as any);
    vi.mocked(useIsSupportAdmin).mockReturnValue({ data: true } as any);
    vi.mocked(useSupportAgents).mockReturnValue({ data: [] } as any);
  });

  it('renders unresolved tickets in console view and filters by search input', () => {
    renderConsole();

    // EB-0095 and EB-0094 are active/unresolved; EB-0093 is resolved so excluded from console
    expect(screen.getByText('#EB-0095')).toBeInTheDocument();
    expect(screen.getByText('#EB-0094')).toBeInTheDocument();
    expect(screen.queryByText('#EB-0093')).not.toBeInTheDocument();

    // Find the console search input
    const searchInput = screen.getByPlaceholderText('Keresés...');
    expect(searchInput).toBeInTheDocument();

    // Type "#EB-0094"
    fireEvent.change(searchInput, { target: { value: '#EB-0094' } });

    // Only EB-0094 should remain visible
    expect(screen.getByText('#EB-0094')).toBeInTheDocument();
    expect(screen.queryByText('#EB-0095')).not.toBeInTheDocument();

    // Search by company name "Mauroni"
    fireEvent.change(searchInput, { target: { value: 'Mauroni' } });
    expect(screen.getByText('#EB-0095')).toBeInTheDocument();
    expect(screen.queryByText('#EB-0094')).not.toBeInTheDocument();

    // Search by user name "Csejtei"
    fireEvent.change(searchInput, { target: { value: 'Csejtei' } });
    expect(screen.getByText('#EB-0094')).toBeInTheDocument();
    expect(screen.queryByText('#EB-0095')).not.toBeInTheDocument();

    // Search with non-matching query
    fireEvent.change(searchInput, { target: { value: 'xyznotfound' } });
    expect(screen.queryByText('#EB-0094')).not.toBeInTheDocument();
    expect(screen.queryByText('#EB-0095')).not.toBeInTheDocument();
    expect(screen.getByText(/Nincs találat a\(z\) "xyznotfound" keresésre/)).toBeInTheDocument();

    // Click clear button
    const clearButton = screen.getByLabelText('Keresés törlése');
    expect(clearButton).toBeInTheDocument();
    fireEvent.click(clearButton);

    // Both unresolved tickets are restored
    expect(screen.getByText('#EB-0095')).toBeInTheDocument();
    expect(screen.getByText('#EB-0094')).toBeInTheDocument();
  });
});
