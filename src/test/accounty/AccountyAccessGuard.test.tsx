import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AccountyAccessGuard } from '@/pages/Accounty/ProtectedAccountyRoute';

let mockAccessState: { hasAccess: boolean | undefined; isLoading: boolean } = {
  hasAccess: undefined,
  isLoading: true,
};

vi.mock('@/hooks/useHasEaisybillAccess', () => ({
  useHasAccountyAccess: () => mockAccessState,
}));

describe('AccountyAccessGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading indicator while access permissions are loading', () => {
    mockAccessState = { hasAccess: undefined, isLoading: true };

    render(
      <MemoryRouter initialEntries={['/eaisybooks']}>
        <AccountyAccessGuard fallbackTo="/">
          <div data-testid="protected-content">Secret Books Content</div>
        </AccountyAccessGuard>
      </MemoryRouter>
    );

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('redirects to fallbackTo (/) when user has NO accounty access', () => {
    mockAccessState = { hasAccess: false, isLoading: false };

    render(
      <MemoryRouter initialEntries={['/eaisybooks']}>
        <Routes>
          <Route
            path="/eaisybooks"
            element={
              <AccountyAccessGuard fallbackTo="/">
                <div data-testid="protected-content">Secret Books Content</div>
              </AccountyAccessGuard>
            }
          />
          <Route path="/" element={<div data-testid="eaisybill-home">Eaisybill Home</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(screen.getByTestId('eaisybill-home')).toBeInTheDocument();
  });

  it('redirects to /hr fallback when user visits /hr/eaisybooks without permissions', () => {
    mockAccessState = { hasAccess: false, isLoading: false };

    render(
      <MemoryRouter initialEntries={['/hr/eaisybooks']}>
        <Routes>
          <Route
            path="/hr/eaisybooks"
            element={
              <AccountyAccessGuard fallbackTo="/hr">
                <div data-testid="protected-content">Secret Books Content</div>
              </AccountyAccessGuard>
            }
          />
          <Route path="/hr" element={<div data-testid="hr-home">Croatian Home</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(screen.getByTestId('hr-home')).toBeInTheDocument();
  });

  it('renders children when user has accounty access', () => {
    mockAccessState = { hasAccess: true, isLoading: false };

    render(
      <MemoryRouter initialEntries={['/eaisybooks']}>
        <AccountyAccessGuard fallbackTo="/">
          <div data-testid="protected-content">Secret Books Content</div>
        </AccountyAccessGuard>
      </MemoryRouter>
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    expect(screen.getByText('Secret Books Content')).toBeInTheDocument();
  });
});
