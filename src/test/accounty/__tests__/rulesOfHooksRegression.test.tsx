import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user', email: 'test@example.com' },
    profile: { role: 'thinkai' },
    companyId: 'test-co',
  }),
}));

vi.mock('@/hooks/accounty/useAccountyRole', () => ({
  useAccountyRole: () => ({
    role: 'admin',
    isAdmin: true,
    isSenior: true,
    isAccountant: true,
    isClient: false,
    hasMinRole: () => true,
  }),
}));

import GenericDeclarationPage from '@/pages/Accounty/declarations/GenericDeclarationPage';
import PayrollPortfolioPage from '@/pages/Accounty/PayrollPortfolioPage';

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

describe('Rules of Hooks Regression Suite', () => {
  it('GenericDeclarationPage renders safely without hook errors when config is missing', () => {
    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/eaisybooks/payroll/123/declarations/unknown-type']}>
          <Routes>
            <Route
              path="/eaisybooks/payroll/:id/declarations/:type"
              element={<GenericDeclarationPage />}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText(/Ismeretlen nyilatkozat típus/i)).toBeInTheDocument();
  });

  it('PayrollPortfolioPage renders safely and satisfies Rules of Hooks unconditionally', () => {
    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <PayrollPortfolioPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText(/Bérszámfejtés áttekintés/i)).toBeInTheDocument();
  });
});
