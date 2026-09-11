import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ManagementDashboard } from '../ManagementDashboard';

// Mock dependencies
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'admin-1', email: 'admin@thinkai.hu' },
    loading: false,
    signOut: vi.fn(),
  }),
}));

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'dark',
    setTheme: vi.fn(),
  }),
}));

vi.mock('../api/managementApi', () => ({
  fetchManagementData: vi.fn().mockResolvedValue({
    usersCount: 1,
    companiesCount: 1,
    totalErrors: 0,
    companies: [],
    users: [],
    llmOverview: {
      totalMonthlyCostUsd: 0,
      totalMonthlyInputTokens: 0,
      totalMonthlyOutputTokens: 0,
      mostExpensiveCompany: null,
      modelBreakdown: {},
    },
    workerStatus: {
      status: 'healthy',
      activeContainers: 1,
      avgCpuPercent: 10,
      avgMemoryPercent: 20,
    },
    recentTickets: [],
    recentFiles: [],
    activeProcessingCount: 0,
  }),
}));

vi.mock('@/components/ui/FilePreviewModal', () => ({
  FilePreviewModal: () => null,
  useFilePreview: () => ({
    previewFile: null,
    openPreview: vi.fn(),
    closePreview: vi.fn(),
  }),
}));

// Mock sub-components to isolate header testing
vi.mock('../components/overview/ManagementOverview', () => ({
  ManagementOverview: () => <div data-testid="overview-content">Overview Content</div>,
}));

vi.mock('../components/ControlCenter', () => ({
  ControlCenter: ({ initialTab }: { initialTab: string }) => (
    <div data-testid="control-center-content">Control Center: {initialTab}</div>
  ),
}));

vi.mock('../components/superadmin/SuperadminPanel', () => ({
  SuperadminPanel: () => <div data-testid="superadmin-content">Superadmin Content</div>,
}));

vi.mock('@/pages/TicketsPage', () => ({
  default: () => <div data-testid="tickets-content">Tickets Content</div>,
}));

function renderDashboard(initialRoute = '/management') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <ManagementDashboard />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ManagementDashboard Consolidated Header', () => {
  it('renders a single unified header without a separate sub-bar', () => {
    renderDashboard();

    const header = screen.getByRole('banner');
    expect(header).toBeInTheDocument();

    // Brand and Badge
    expect(screen.getByText('eaisyBill')).toBeInTheDocument();
    expect(screen.getByText('Management')).toBeInTheDocument();

    // The nav tabs should be inside the single header element
    const nav = screen.getByRole('navigation', { name: 'Főnavigáció' });
    expect(header).toContainElement(nav);

    // Nav items exist inside the header
    expect(screen.getByRole('button', { name: /Áttekintés/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Control Center/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Superadmin/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hibajegyek/i })).toBeInTheDocument();

    // Actions exist inside the header
    expect(screen.getByRole('button', { name: /Téma váltás/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Kijelentkezés/i })).toBeInTheDocument();

    // Header should contain only a single max-w-7xl row container (no border-t sub-row)
    expect(header.querySelectorAll('.border-t').length).toBe(0);
  });

  it('correctly sets active state for tabs and updates on click', async () => {
    renderDashboard();

    const overviewBtn = screen.getByRole('button', { name: /Áttekintés/i });
    const controlCenterBtn = screen.getByRole('button', { name: /Control Center/i });

    // Initial is overview
    expect(overviewBtn).toHaveAttribute('aria-current', 'page');
    expect(controlCenterBtn).not.toHaveAttribute('aria-current', 'page');

    // Click Control Center
    fireEvent.click(controlCenterBtn);

    expect(controlCenterBtn).toHaveAttribute('aria-current', 'page');
    expect(overviewBtn).not.toHaveAttribute('aria-current', 'page');
  });
});
