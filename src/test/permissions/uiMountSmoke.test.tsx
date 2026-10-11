/**
 * Mount smoke tests for the UI components touched by the role/capability refactor (A-247).
 * They only prove that the components still mount (no render-time crash, no missing import / hook
 * contract) with the new roles in play - behaviour is covered by the capabilities / roleDefaults tests.
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub;

vi.mock('@/integrations/supabase/client', () => {
  const chain: any = new Proxy(function () {}, {
    get: (_t, prop) => {
      if (prop === 'then') return (resolve: (v: unknown) => void) => resolve({ data: [], error: null });
      return () => chain;
    },
    apply: () => chain,
  });
  return {
    SUPABASE_URL: 'https://example.supabase.co',
    supabase: {
      from: () => chain,
      rpc: () => chain,
      functions: { invoke: () => chain },
      auth: { getSession: () => chain, getUser: () => chain, onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
      channel: () => chain,
      removeChannel: () => undefined,
    },
  };
});
const stable = vi.hoisted(() => {
  const company = { id: 'c1', name: 'Teszt Kft' };
  return {
    auth: { user: { id: 'u1', email: 'admin@example.com', user_metadata: {} }, session: null, loading: false },
    company: { companies: [company], selectedCompany: company, refreshCompanies: () => undefined },
    accounty: { role: 'iroda_admin', isAdmin: true, firmId: 'f1', isLoading: false, canWrite: true },
    toast: { toast: () => undefined },
    theme: { theme: 'light', setTheme: () => undefined },
    userRole: { role: 'owner', isOwner: true, isAdmin: true, isLoading: false },
  };
});
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => stable.auth }));
vi.mock('@/contexts/CompanyContext', () => ({ useCompany: () => stable.company }));
vi.mock('@/pages/Accounty/AccountyRoleContext', () => ({ useAccountyRole: () => stable.accounty }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => stable.toast }));
vi.mock('@/contexts/ThemeContext', () => ({ useTheme: () => stable.theme }));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => stable.userRole }));
// ProfileSettingsPage composes heavy settings sections - stub them, we only check the page shell.
vi.mock('@/components/settings/ProfileSection', () => ({ ProfileSection: () => <div /> }));
vi.mock('@/components/settings/BusinessSection', () => ({ BusinessSection: () => <div /> }));
vi.mock('@/components/settings/SystemSection', () => ({ SystemSection: () => <div /> }));
vi.mock('@/components/settings/SecuritySection', () => ({ SecuritySection: () => <div /> }));
vi.mock('@/components/settings/AccountyNotificationPreferences', () => ({ AccountyNotificationPreferences: () => <div /> }));

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('role refactor - UI mount smoke (A-247)', () => {
  it('PermissionMatrixPage mounts', async () => {
    const { default: Page } = await import('@/pages/Accounty/PermissionMatrixPage');
    const { container } = wrap(<Page />);
    expect(container).toBeTruthy();
  });

  it('AccountantManagementPage mounts', async () => {
    const { default: Page } = await import('@/pages/Accounty/AccountantManagementPage');
    const { container } = wrap(<Page />);
    expect(container).toBeTruthy();
  });

  it('TeamSettingsTab mounts and lists a payroll_specialist member', async () => {
    const { default: Tab } = await import('@/pages/Accounty/settings/TeamSettingsTab');
    const { container } = wrap(
      <Tab
        isAdmin
        currentUserId="u1"
        firmId="f1"
        teamMembers={[
          {
            id: 'm1',
            name: 'Bérszámfejtő Béla',
            email: 'bela@example.com',
            role: 'payroll_specialist',
            assignedCompanies: [],
          } as any,
        ]}
      />,
    );
    expect(container.textContent).toContain('Bérszámfejtő Béla');
  });

  it('InviteUserDialog mounts in eaisybill and eaisybooks mode', async () => {
    const { InviteUserDialog } = await import('@/components/settings/InviteUserDialog');
    for (const isAccounty of [false, true]) {
      const { unmount } = wrap(
        <InviteUserDialog
          open
          onOpenChange={() => {}}
          companyId="c1"
          companyName="Teszt Kft"
          onSuccess={() => {}}
          toast={() => {}}
          isAccounty={isAccounty}
        />,
      );
      expect(document.body.textContent).toBeTruthy();
      unmount();
    }
  });

  it('EaisybillPermissionPanel mounts', async () => {
    const { EaisybillPermissionPanel } = await import('@/components/settings/EaisybillPermissionPanel');
    const { container } = wrap(<EaisybillPermissionPanel companyId="c1" toast={() => {}} />);
    expect(container).toBeTruthy();
  });

  it('ProfileSettingsPage mounts', async () => {
    const { default: Page } = await import('@/pages/Accounty/ProfileSettingsPage');
    const { container } = wrap(<Page />);
    expect(container).toBeTruthy();
  });
});
