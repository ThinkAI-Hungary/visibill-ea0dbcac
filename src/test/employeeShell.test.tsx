import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';

const mockRole = { isEmployee: false };

vi.mock('@/hooks/useUserRole', () => ({
  useUserRole: () => ({ isEmployee: mockRole.isEmployee, role: mockRole.isEmployee ? 'employee' : 'owner' }),
}));
vi.mock('@/hooks/usePdfExportNotifications', () => ({ usePdfExportNotifications: () => undefined }));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'worker@example.com', user_metadata: { name: 'Teszt Elek' } }, signOut: vi.fn() }),
}));
vi.mock('@/contexts/CompanyContext', () => ({
  useCompany: () => ({ selectedCompany: { id: 'c1', name: 'Teszt Kft.' } }),
}));
vi.mock('@/contexts/ThemeContext', () => ({ useTheme: () => ({ theme: 'light', setTheme: vi.fn() }) }));
vi.mock('@/components/LanguageSwitcher', () => ({ LanguageSwitcher: () => <div data-testid="language-switcher" /> }));
vi.mock('@/components/GlobalDatePicker', () => ({ GlobalDatePicker: () => <div data-testid="global-date-picker" /> }));
vi.mock('@/components/AppSidebar', () => ({ AppSidebar: () => <aside data-testid="app-sidebar" /> }));

describe('AppLayout - employee shell (RBAC Csomag C)', () => {
  beforeEach(() => {
    mockRole.isEmployee = false;
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });
  });

  it('employee: no sidebar and no date picker, only the minimal header with company name and user menu', () => {
    mockRole.isEmployee = true;
    render(
      <MemoryRouter>
        <AppLayout>
          <div data-testid="page-content">Munkaidő</div>
        </AppLayout>
      </MemoryRouter>,
    );

    expect(screen.queryByTestId('app-sidebar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('global-date-picker')).not.toBeInTheDocument();
    expect(screen.getByTestId('employee-shell')).toBeInTheDocument();
    expect(screen.getByTestId('employee-header-company')).toHaveTextContent('Teszt Kft.');
    expect(screen.getByTestId('employee-user-menu')).toBeInTheDocument();
    expect(screen.getByTestId('page-content')).toBeInTheDocument();
  });

  it('non-employee roles keep the regular sidebar layout', () => {
    render(
      <MemoryRouter>
        <AppLayout>
          <div data-testid="page-content">Számlák</div>
        </AppLayout>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('app-sidebar')).toBeInTheDocument();
    expect(screen.queryByTestId('employee-shell')).not.toBeInTheDocument();
  });
});
