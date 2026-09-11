import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TicketDetailView } from '@/components/tickets/TicketDetailView';
import * as useTicketsHooks from '@/hooks/useTickets';
import * as authContext from '@/contexts/AuthContext';
import fs from 'fs';

const ticketData = JSON.parse(fs.readFileSync('scratch/ticket_eb0076.json', 'utf-8'))[0];
const commentsData = JSON.parse(fs.readFileSync('scratch/comments_eb0076.json', 'utf-8'));

vi.mock('@/lib/navigation', () => ({
  useScopedBasePath: vi.fn(() => '/test-company/2026-01-01_2026-12-31'),
}));

vi.mock('@/contexts/CompanyContext', () => ({
  useCompany: vi.fn(() => ({ selectedCompany: { id: 'c132676d-85c5-4e2a-bde1-d966766bb94f' } })),
}));

vi.mock('@/hooks/useTickets', async () => {
  const actual = await vi.importActual('@/hooks/useTickets');
  return {
    ...actual,
    useTicketDetail: vi.fn(),
    useAddComment: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
    useUpdateTicketStatus: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
    useMarkTicketRead: vi.fn(() => ({ mutate: vi.fn() })),
    useIsSupportAdmin: vi.fn(() => ({ data: false, isLoading: false })),
    useIsManagementRole: vi.fn(() => ({ data: false })),
    useTicketEvents: vi.fn(() => ({ data: [], isLoading: false })),
    useUpdateTicketPriority: vi.fn(() => ({ mutate: vi.fn() })),
    useUpdateTicketAssignee: vi.fn(() => ({ mutate: vi.fn() })),
    useSupportAgents: vi.fn(() => ({ data: [] })),
    useDeleteTicket: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
    useUpdateTicketAttachments: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
    useRequestTicketResolution: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

describe('Reproduce Ticket #EB-0076 render freeze', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.mocked(authContext.useAuth).mockReturnValue({
      user: { id: '5c160828-ae2a-4b47-a8fc-f31dfea68b85', email: 'marco@mauroni.com' },
    } as any);
  });

  it('renders ticket #EB-0076 without freezing or throwing', () => {
    vi.mocked(useTicketsHooks.useTicketDetail).mockReturnValue({
      data: {
        ticket: ticketData,
        comments: commentsData,
      },
      isLoading: false,
      isError: false,
    } as any);

    const t0 = performance.now();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/tickets/6df997a3-21d8-408a-93e2-00cf73208865']}>
          <TicketDetailView feedbackId="6df997a3-21d8-408a-93e2-00cf73208865" />
        </MemoryRouter>
      </QueryClientProvider>
    );
    const duration = performance.now() - t0;
    console.log(`Render duration: ${duration.toFixed(2)}ms`);

    expect(screen.getByText('EB-0076')).toBeInTheDocument();
  });
});
