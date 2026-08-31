import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ManagementRoute } from '../authRoutes';

// Mock dependencies
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('@/pages/ManagementDashboard', () => ({
  default: () => <div data-testid="management-dashboard">Management Dashboard Loaded</div>,
}));

vi.mock('@/pages/NotFound', () => ({
  default: () => <div data-testid="not-found-page">404 - Az oldal nem található</div>,
}));

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

describe('ManagementRoute Guard', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/management']}>
          {ui}
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('renders LoadingSpinner when profile check is pending', () => {
    (useAuth as any).mockReturnValue({
      user: { id: 'user-123', email: 'test@example.com' },
    });

    // Mock supabase query never resolving immediately
    (supabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockReturnValue(new Promise(() => {})),
        }),
      }),
    });

    renderWithProviders(<ManagementRoute />);
    expect(screen.getByText(/Jogosultság ellenőrzése/i)).toBeInTheDocument();
  });

  it('renders NotFound (404) for standard user with non-management role', async () => {
    (useAuth as any).mockReturnValue({
      user: { id: 'user-123', email: 'normal@example.com' },
    });

    (supabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { role: 'user' },
            error: null,
          }),
        }),
      }),
    });

    renderWithProviders(<ManagementRoute />);
    const notFound = await screen.findByTestId('not-found-page');
    expect(notFound).toBeInTheDocument();
    expect(screen.queryByTestId('management-dashboard')).not.toBeInTheDocument();
  });

  it('renders NotFound (404) for admin role', async () => {
    (useAuth as any).mockReturnValue({
      user: { id: 'user-admin', email: 'admin@company.com' },
    });

    (supabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { role: 'admin' },
            error: null,
          }),
        }),
      }),
    });

    renderWithProviders(<ManagementRoute />);
    const notFound = await screen.findByTestId('not-found-page');
    expect(notFound).toBeInTheDocument();
    expect(screen.queryByTestId('management-dashboard')).not.toBeInTheDocument();
  });

  it('renders ManagementDashboard when role is management', async () => {
    (useAuth as any).mockReturnValue({
      user: { id: 'user-mgmt', email: 'mgmt@thinkai.hu' },
    });

    (supabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { role: 'management' },
            error: null,
          }),
        }),
      }),
    });

    renderWithProviders(<ManagementRoute />);
    const dashboard = await screen.findByTestId('management-dashboard');
    expect(dashboard).toBeInTheDocument();
    expect(screen.queryByTestId('not-found-page')).not.toBeInTheDocument();
  });

  it('renders ManagementDashboard when role is thinkai', async () => {
    (useAuth as any).mockReturnValue({
      user: { id: 'user-thinkai', email: 'super@thinkai.hu' },
    });

    (supabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { role: 'thinkai' },
            error: null,
          }),
        }),
      }),
    });

    renderWithProviders(<ManagementRoute />);
    const dashboard = await screen.findByTestId('management-dashboard');
    expect(dashboard).toBeInTheDocument();
    expect(screen.queryByTestId('not-found-page')).not.toBeInTheDocument();
  });
});
