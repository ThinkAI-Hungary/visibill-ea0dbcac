import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import TicketsPage from '@/pages/TicketsPage';
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
      t: (k: string, fallback?: string) => fallback || k,
      i18n: { language: 'hu' },
    }),
  };
});

describe('TicketsPage Sticky Submenu Header', () => {
  it('renders the admin subtabs header as sticky with backdrop blur and border', () => {
    vi.mocked(useTickets).mockReturnValue({
      data: [],
      isLoading: false,
      refetch: vi.fn(),
    } as any);
    vi.mocked(useIsSupportAdmin).mockReturnValue({ data: true } as any);
    vi.mocked(useSupportAgents).mockReturnValue({ data: [] } as any);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <TicketsPage embeddedInManagement={true} />
        </QueryClientProvider>
      </MemoryRouter>
    );

    const listTabButton = screen.getByRole('button', { name: /Jegyek Listája/i });
    expect(listTabButton).toBeInTheDocument();

    // The parent tabs header container must be sticky
    const tabsContainer = listTabButton.closest('div.flex-col') || listTabButton.closest('div.sticky');
    expect(tabsContainer).not.toBeNull();
    expect(tabsContainer?.className).toContain('sticky');
    expect(tabsContainer?.className).toContain('top-0');
    expect(tabsContainer?.className).toContain('z-30');
    expect(tabsContainer?.className).toContain('backdrop-blur');
  });
});
