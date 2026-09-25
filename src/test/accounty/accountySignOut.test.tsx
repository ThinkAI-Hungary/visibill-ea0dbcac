import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

describe('AccountySidebar SignOut URL Sanitization', () => {
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
    setCmdOpen: vi.fn(),
    theme: 'light',
    setTheme: vi.fn(),
    allClients: [],
    expandedPayroll: new Set<string>(),
    togglePayrollClient: vi.fn(),
    payrollSearch: '',
    setPayrollSearch: vi.fn(),
    showAllPayroll: false,
    setShowAllPayroll: vi.fn(),
    expandedSections: new Set(['portfolio']),
    toggleSection: vi.fn(),
    isActive: vi.fn().mockReturnValue(false),
  };

  it('navigates to clean /auth without app=eaisybooks on standard sign out', async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    const navigate = vi.fn();

    render(
      <MemoryRouter>
        <TooltipProvider>
          <AccountySidebar
            {...defaultProps}
            signOut={signOut}
            navigate={navigate}
            pathname="/eaisybooks/dashboard"
          />
        </TooltipProvider>
      </MemoryRouter>
    );

    const signOutButtons = screen.getAllByRole('button').filter(btn => 
      btn.querySelector('svg.lucide-log-out') !== null
    );
    expect(signOutButtons.length).toBeGreaterThan(0);

    fireEvent.click(signOutButtons[0]);

    await waitFor(() => {
      expect(signOut).toHaveBeenCalled();
      expect(navigate).toHaveBeenCalledWith('/auth');
      expect(navigate).not.toHaveBeenCalledWith(expect.stringContaining('app=eaisybooks'));
    });
  });

  it('navigates to clean /hr/auth when in Croatian locale', async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    const navigate = vi.fn();

    render(
      <MemoryRouter>
        <TooltipProvider>
          <AccountySidebar
            {...defaultProps}
            signOut={signOut}
            navigate={navigate}
            pathname="/hr/eaisybooks/dashboard"
          />
        </TooltipProvider>
      </MemoryRouter>
    );

    const signOutButtons = screen.getAllByRole('button').filter(btn => 
      btn.querySelector('svg.lucide-log-out') !== null
    );
    expect(signOutButtons.length).toBeGreaterThan(0);

    fireEvent.click(signOutButtons[0]);

    await waitFor(() => {
      expect(signOut).toHaveBeenCalled();
      expect(navigate).toHaveBeenCalledWith('/hr/auth');
      expect(navigate).not.toHaveBeenCalledWith(expect.stringContaining('app=eaisybooks'));
    });
  });
});
