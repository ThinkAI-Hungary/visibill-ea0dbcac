import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import {
  ProtectedAccountyRoute,
  AccountyModuleLayout,
  hasMinimumRole,
} from '@/pages/Accounty/ProtectedAccountyRoute';
import { Outlet } from 'react-router-dom';

const state = vi.hoisted(() => ({
  role: 'payroll_specialist' as string,
  allowed: new Set<string>(),
  roleLoading: false,
  permsLoading: false,
}));

vi.mock('@/pages/Accounty/AccountyRoleContext', () => ({
  useAccountyRole: () => ({ role: state.role, isLoading: state.roleLoading }),
}));

vi.mock('@/hooks/useAccountyPermissions', () => ({
  useAccountyPermissions: () => ({
    canAccess: (m: string) => state.allowed.has(m),
    isLoading: state.permsLoading,
  }),
}));

vi.mock('@/hooks/useHasEaisybillAccess', () => ({
  useHasAccountyAccess: () => ({ hasAccess: true, isLoading: false }),
}));

function renderModuleRoute(module: 'payroll' | 'client_bookkeeping') {
  return render(
    <MemoryRouter initialEntries={['/eaisybooks/x']}>
      <Routes>
        <Route path="/eaisybooks" element={<div data-testid="home">home</div>} />
        <Route element={<AccountyModuleLayout module={module} />}>
          <Route path="/eaisybooks/x" element={<div data-testid="secret">secret</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedAccountyRoute — module gating (D-5)', () => {
  beforeEach(() => {
    state.role = 'payroll_specialist';
    state.allowed = new Set();
    state.roleLoading = false;
    state.permsLoading = false;
  });

  it('redirects a Bérszámfejtő away from client_bookkeeping (no ledger/invoice access by default)', () => {
    state.allowed = new Set(['payroll']);
    renderModuleRoute('client_bookkeeping');
    expect(screen.queryByTestId('secret')).not.toBeInTheDocument();
    expect(screen.getByTestId('home')).toBeInTheDocument();
  });

  it('lets a Bérszámfejtő into the payroll module', () => {
    state.allowed = new Set(['payroll']);
    renderModuleRoute('payroll');
    expect(screen.getByTestId('secret')).toBeInTheDocument();
  });

  it('honours an admin override: a Bérszámfejtő granted client_bookkeeping gets in (hybrid D-5)', () => {
    state.allowed = new Set(['payroll', 'client_bookkeeping']);
    renderModuleRoute('client_bookkeeping');
    expect(screen.getByTestId('secret')).toBeInTheDocument();
  });

  it('renders nothing while permissions are still loading (no redirect flash)', () => {
    state.permsLoading = true;
    renderModuleRoute('payroll');
    expect(screen.queryByTestId('secret')).not.toBeInTheDocument();
    expect(screen.queryByTestId('home')).not.toBeInTheDocument();
  });

  it('combines requiredRoles and requiredModule (both must pass)', () => {
    state.role = 'könyvelő';
    state.allowed = new Set(['payroll']);
    render(
      <MemoryRouter initialEntries={['/eaisybooks/x']}>
        <Routes>
          <Route path="/eaisybooks" element={<div data-testid="home">home</div>} />
          <Route
            path="/eaisybooks/x"
            element={
              <ProtectedAccountyRoute requiredRoles={['iroda_admin']} requiredModule="payroll">
                <Outlet />
                <div data-testid="secret">secret</div>
              </ProtectedAccountyRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('secret')).not.toBeInTheDocument();
    expect(screen.getByTestId('home')).toBeInTheDocument();
  });
});

describe('hasMinimumRole with payroll_specialist', () => {
  it('payroll_specialist ranks below asszisztens and never satisfies a classic minimum', () => {
    expect(hasMinimumRole('payroll_specialist', 'asszisztens')).toBe(false);
    expect(hasMinimumRole('asszisztens', 'payroll_specialist')).toBe(true);
    expect(hasMinimumRole('iroda_admin', 'payroll_specialist')).toBe(true);
  });
});
