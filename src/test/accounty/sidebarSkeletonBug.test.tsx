import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import AccountySidebar from '@/components/accounty/layout/AccountySidebar';
import { TooltipProvider } from '@/components/ui/tooltip';

vi.mock('@/hooks/accounty', () => ({
  useAccountyTaxProfile: vi.fn(() => ({ data: null })),
}));

vi.mock('@/hooks/useEvData', () => ({
  useEvClientSettings: vi.fn(() => ({ data: null })),
}));

vi.mock('@/contexts/DateRangeContext', () => ({
  useDateRange: () => ({
    dateFromFormatted: '2026-01-01',
    dateToFormatted: '2026-12-31',
  }),
}));

vi.mock('@/components/AppModeSwitcher', () => ({
  default: () => <div data-testid="app-mode-switcher" />,
}));

describe('AccountySidebar Skeleton Stuck Bug (Prove-It)', () => {
  const companyId = 'ecf31039-b539-4e04-bbea-70ea48c701bb';
  const cycleId = 'e67d4f9a-a351-404f-aa2d-58560e9d4675';

  const defaultProps = {
    isCollapsed: false,
    toggleSidebarCollapse: vi.fn(),
    sidebarOpen: true,
    setSidebarOpen: vi.fn(),
    hasEaisybillAccess: true,
    kpis: {},
    unreadTicketCount: 0,
    canAccess: () => true,
    user: { email: 'test@example.com' },
    signOut: vi.fn().mockResolvedValue(undefined),
    setCmdOpen: vi.fn(),
    theme: 'light',
    setTheme: vi.fn(),
    allClients: [{ companyId, name: 'Think Ai Kft' }],
    expandedPayroll: new Set<string>(),
    togglePayrollClient: vi.fn(),
    payrollSearch: '',
    setPayrollSearch: vi.fn(),
    showAllPayroll: false,
    setShowAllPayroll: vi.fn(),
    expandedSections: new Set(['portfolio']),
    toggleSection: vi.fn(),
    isActive: vi.fn().mockReturnValue(false),
    navigate: vi.fn(),
  };

  it('should NOT get stuck in AccountyNavSkeleton when navigating to payroll cycle via legacy route redirect', async () => {
    const { rerender } = render(
      <MemoryRouter>
        <TooltipProvider>
          <AccountySidebar
            {...defaultProps}
            pathname={`/eaisybooks/${companyId}/2026-01-01_2026-12-31/payroll`}
          />
        </TooltipProvider>
      </MemoryRouter>
    );

    // Initial state on client payroll page: client menu should be rendered
    expect(screen.getByText('Vissza a portfólióhoz')).toBeInTheDocument();
    expect(screen.getByText('Bérszámfejtés')).toBeInTheDocument();

    // Step 2: User triggers cycle creation/opening, navigating through legacy route:
    rerender(
      <MemoryRouter>
        <TooltipProvider>
          <AccountySidebar
            {...defaultProps}
            pathname={`/eaisybooks/payroll/${companyId}/cycle/new`}
          />
        </TooltipProvider>
      </MemoryRouter>
    );

    // Step 3: Redirect lands immediately on canonical client cycle route:
    rerender(
      <MemoryRouter>
        <TooltipProvider>
          <AccountySidebar
            {...defaultProps}
            pathname={`/eaisybooks/${companyId}/2026-01-01_2026-12-31/payroll/cycle/${cycleId}`}
          />
        </TooltipProvider>
      </MemoryRouter>
    );

    // The client menu MUST be rendered, and NOT stuck in skeleton!
    expect(screen.getByText('Vissza a portfólióhoz')).toBeInTheDocument();
    expect(screen.getByText('Bérszámfejtés')).toBeInTheDocument();
  });
});
