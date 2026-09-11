import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TicketNotFoundView } from '@/components/tickets/TicketNotFoundView';
import { TicketDetailView } from '@/components/tickets/TicketDetailView';
import TicketsPage from '@/pages/TicketsPage';
import * as useTicketsHooks from '@/hooks/useTickets';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/hooks/useTickets', () => ({
  useTicketDetail: vi.fn(),
  useTicketEvents: vi.fn(() => ({ data: [], isLoading: false })),
  useAddComment: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useRequestTicketResolution: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useUpdateTicketStatus: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useMarkTicketRead: vi.fn(() => ({ mutate: vi.fn() })),
  useIsSupportAdmin: vi.fn(() => ({ data: false, isLoading: false })),
  useUpdateTicketPriority: vi.fn(() => ({ mutate: vi.fn() })),
  useUpdateTicketAssignee: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn() })),
  useSupportAgents: vi.fn(() => ({ data: [], isLoading: false })),
  useUpdateTicketAttachments: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useRespondTicketResolution: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useIsManagementRole: vi.fn(() => ({ data: false })),
  useDeleteTicket: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useTickets: vi.fn(() => ({ data: [], isLoading: false, refetch: vi.fn() })),
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
      t: (k: string, fallback?: string) => fallback || k,
      i18n: { language: 'hu' },
    }),
  };
});

describe('Ticket 404 / Not Found Handling', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  describe('TicketNotFoundView Component', () => {
    it('renders the 404 badge, heading, description and back button', () => {
      const onBack = vi.fn();
      render(<TicketNotFoundView onBack={onBack} />);

      expect(screen.getByText('404 • Nem található')).toBeInTheDocument();
      expect(screen.getByText('A hibajegy nem található')).toBeInTheDocument();
      expect(
        screen.getByText(
          'A keresett hibajegy nem létezik, időközben törlésre került, vagy nincs megfelelő jogosultsága a megtekintéséhez.'
        )
      ).toBeInTheDocument();

      const backBtn = screen.getByRole('button', { name: /Vissza a hibajegyekhez/i });
      expect(backBtn).toBeInTheDocument();
      fireEvent.click(backBtn);
      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('triggers onBack when clicking the top back arrow button', () => {
      const onBack = vi.fn();
      render(<TicketNotFoundView onBack={onBack} />);

      const topBackBtn = screen.getByRole('button', { name: 'Vissza' });
      fireEvent.click(topBackBtn);
      expect(onBack).toHaveBeenCalled();
    });
  });

  describe('TicketDetailView with Deleted / Non-existent Ticket', () => {
    it('renders skeleton loader while ticket is actively loading', () => {
      vi.mocked(useTicketsHooks.useTicketDetail).mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
      } as any);

      const { container } = render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <TicketDetailView feedbackId="loading-ticket-id" />
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Skeleton elements should be present
      expect(container.querySelector('.animate-shimmer')).toBeInTheDocument();
      expect(screen.queryByText('A hibajegy nem található')).not.toBeInTheDocument();
    });

    it('renders TicketNotFoundView instead of skeleton loader when ticket query finishes with no ticket', () => {
      vi.mocked(useTicketsHooks.useTicketDetail).mockReturnValue({
        data: null,
        isLoading: false,
        isError: false,
      } as any);

      const onBack = vi.fn();
      const { container } = render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <TicketDetailView feedbackId="deleted-ticket-id" onBack={onBack} />
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Skeletons must NOT be rendered
      expect(container.querySelector('.animate-shimmer')).not.toBeInTheDocument();

      // 404 view should be displayed
      expect(screen.getByText('A hibajegy nem található')).toBeInTheDocument();
      expect(screen.getByText('404 • Nem található')).toBeInTheDocument();

      const backBtn = screen.getByRole('button', { name: /Vissza a hibajegyekhez/i });
      fireEvent.click(backBtn);
      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('renders TicketNotFoundView when query returns error', () => {
      vi.mocked(useTicketsHooks.useTicketDetail).mockReturnValue({
        data: null,
        isLoading: false,
        isError: true,
      } as any);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <TicketDetailView feedbackId="error-ticket-id" />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.getByText('A hibajegy nem található')).toBeInTheDocument();
    });

    it('does not call markRead when ticket does not exist (deleted or 404)', () => {
      const markReadMock = vi.fn();
      vi.mocked(useTicketsHooks.useMarkTicketRead).mockReturnValue({ mutate: markReadMock } as any);
      vi.mocked(useTicketsHooks.useTicketDetail).mockReturnValue({
        data: null,
        isLoading: false,
        isError: false,
      } as any);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <TicketDetailView feedbackId="deleted-ticket-id" />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(markReadMock).not.toHaveBeenCalled();
    });

    it('does not call markRead while ticket is still loading', () => {
      const markReadMock = vi.fn();
      vi.mocked(useTicketsHooks.useMarkTicketRead).mockReturnValue({ mutate: markReadMock } as any);
      vi.mocked(useTicketsHooks.useTicketDetail).mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
      } as any);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <TicketDetailView feedbackId="loading-ticket-id" />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(markReadMock).not.toHaveBeenCalled();
    });

    it('calls markRead when ticket exists and finishes loading', () => {
      const markReadMock = vi.fn();
      vi.mocked(useTicketsHooks.useMarkTicketRead).mockReturnValue({ mutate: markReadMock } as any);
      vi.mocked(useTicketsHooks.useTicketDetail).mockReturnValue({
        data: {
          ticket: { id: 'valid-ticket-id', status: 'in_progress' } as any,
          comments: [],
        },
        isLoading: false,
        isError: false,
      } as any);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <TicketDetailView feedbackId="valid-ticket-id" />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(markReadMock).toHaveBeenCalledWith('valid-ticket-id');
    });
  });

  describe('TicketsPage Route Integration', () => {
    it('renders 404 view on standalone route with missing ticket and navigates to tickets list on back', () => {
      vi.mocked(useTicketsHooks.useTicketDetail).mockReturnValue({
        data: null,
        isLoading: false,
        isError: false,
      } as any);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/app/test-company/2026-06-01_2026-06-30/tickets/deleted-ticket-123']}>
            <Routes>
              <Route
                path="/app/test-company/2026-06-01_2026-06-30/tickets/:ticketId"
                element={<TicketsPage />}
              />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.getByText('A hibajegy nem található')).toBeInTheDocument();

      const backBtn = screen.getByRole('button', { name: /Vissza a hibajegyekhez/i });
      fireEvent.click(backBtn);

      expect(mockNavigate).toHaveBeenCalledWith('/app/test-company/2026-06-01_2026-06-30/tickets');
    });
  });
});
