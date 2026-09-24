import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Aggreg8BankConnections } from '@/components/banking/Aggreg8BankConnections';
import * as useAggreg8Module from '@/hooks/useAggreg8';

describe('Aggreg8BankConnections Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const renderComponent = (props: { companyId: string; isOwner?: boolean }) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <Aggreg8BankConnections {...props} />
      </QueryClientProvider>
    );
  };

  it('renders empty state when there are no connected banks', () => {
    vi.spyOn(useAggreg8Module, 'useAggreg8').mockReturnValue({
      consents: [],
      isLoading: false,
      isError: false,
      error: null,
      isFlowLoading: false,
      isAddingBank: false,
      syncingConsentId: null,
      extendingConsentId: null,
      isSyncing: false,
      refetch: vi.fn(),
      startAddBankFlow: vi.fn(),
      startOnDemandSync: vi.fn(),
      startExtendConsent: vi.fn(),
      revokeConsent: vi.fn(),
    });

    renderComponent({ companyId: 'comp-1', isOwner: true });

    expect(screen.getByText('Automatikus banki szinkronizáció')).toBeInTheDocument();
    expect(screen.getByText('Még nincs csatlakoztatott bankszámlád')).toBeInTheDocument();
    expect(screen.getByText('Bank csatlakoztatása most')).toBeInTheDocument();
  });

  it('renders "Aggreg8.io integráció" when bank_name is missing or generic', () => {
    vi.spyOn(useAggreg8Module, 'useAggreg8').mockReturnValue({
      consents: [
        {
          id: 'consent-1',
          company_id: 'comp-1',
          user_id: 'user-1',
          info_sharing_consent_id: 'isc-1',
          a8_user_id: 'a8-u-1',
          bank_id: 'PENDING_SYNC',
          bank_name: 'Aggreg8 Bank',
          bank_logo_url: null,
          active_sync_enabled: true,
          passive_sync_enabled: true,
          active_sync_expiration_date: '2026-12-31T00:00:00Z',
          passive_sync_expiration_date: '2026-12-31T00:00:00Z',
          status: 'active',
          created_at: '2026-09-24T10:00:00Z',
          updated_at: '2026-09-24T10:00:00Z',
          accounts: [
            {
              id: 'acc-1',
              consent_id: 'consent-1',
              company_id: 'comp-1',
              a8_account_id: 'a8-acc-1',
              company_bank_account_id: null,
              account_name: 'Fő folyószámla',
              account_number: '11773016-12345678-00000000',
              currency: 'HUF',
              balance: 1500000,
              last_ordinal_on_account: 120,
              last_synced_at: '2026-09-24T11:00:00Z',
              last_synced_count: 14,
              created_at: '2026-09-24T10:00:00Z',
              updated_at: '2026-09-24T11:00:00Z',
            },
          ],
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
      isFlowLoading: false,
      isAddingBank: false,
      syncingConsentId: null,
      extendingConsentId: null,
      isSyncing: false,
      refetch: vi.fn(),
      startAddBankFlow: vi.fn(),
      startOnDemandSync: vi.fn(),
      startExtendConsent: vi.fn(),
      revokeConsent: vi.fn(),
    });

    renderComponent({ companyId: 'comp-1', isOwner: true });

    // Should display 'Aggreg8.io integráció' instead of 'Aggreg8 Bank'
    expect(screen.getByText('Aggreg8.io integráció')).toBeInTheDocument();
    expect(screen.queryByText('Aggreg8 Bank')).not.toBeInTheDocument();

    // Should display the account details and the +14 tétel badge
    expect(screen.getByText('Fő folyószámla')).toBeInTheDocument();
    expect(screen.getByText('11773016-12345678-00000000')).toBeInTheDocument();
    expect(screen.getByText('+14 tétel')).toBeInTheDocument();
  });

  it('does not display item count badge when last_synced_count is 0 or null', () => {
    vi.spyOn(useAggreg8Module, 'useAggreg8').mockReturnValue({
      consents: [
        {
          id: 'consent-1',
          company_id: 'comp-1',
          user_id: 'user-1',
          info_sharing_consent_id: 'isc-1',
          a8_user_id: 'a8-u-1',
          bank_id: 'OTP',
          bank_name: 'OTP Bank',
          bank_logo_url: null,
          active_sync_enabled: true,
          passive_sync_enabled: true,
          active_sync_expiration_date: '2026-12-31T00:00:00Z',
          passive_sync_expiration_date: '2026-12-31T00:00:00Z',
          status: 'active',
          created_at: '2026-09-24T10:00:00Z',
          updated_at: '2026-09-24T10:00:00Z',
          accounts: [
            {
              id: 'acc-1',
              consent_id: 'consent-1',
              company_id: 'comp-1',
              a8_account_id: 'a8-acc-1',
              company_bank_account_id: null,
              account_name: 'OTP Számla',
              account_number: '11773016-00000000',
              currency: 'HUF',
              balance: 50000,
              last_ordinal_on_account: 10,
              last_synced_at: '2026-09-24T11:00:00Z',
              last_synced_count: 0,
              created_at: '2026-09-24T10:00:00Z',
              updated_at: '2026-09-24T11:00:00Z',
            },
          ],
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
      isFlowLoading: false,
      isAddingBank: false,
      syncingConsentId: null,
      extendingConsentId: null,
      isSyncing: false,
      refetch: vi.fn(),
      startAddBankFlow: vi.fn(),
      startOnDemandSync: vi.fn(),
      startExtendConsent: vi.fn(),
      revokeConsent: vi.fn(),
    });

    renderComponent({ companyId: 'comp-1', isOwner: true });

    expect(screen.getByText('OTP Bank')).toBeInTheDocument();
    expect(screen.queryByText(/tétel/)).not.toBeInTheDocument();
  });

  it('hides owner action buttons and shows security alert when isOwner is false', () => {
    vi.spyOn(useAggreg8Module, 'useAggreg8').mockReturnValue({
      consents: [
        {
          id: 'consent-1',
          company_id: 'comp-1',
          user_id: 'user-1',
          info_sharing_consent_id: 'isc-1',
          a8_user_id: 'a8-u-1',
          bank_id: 'ERSTE',
          bank_name: 'Erste Bank',
          bank_logo_url: null,
          active_sync_enabled: true,
          passive_sync_enabled: true,
          active_sync_expiration_date: '2026-12-31T00:00:00Z',
          passive_sync_expiration_date: '2026-12-31T00:00:00Z',
          status: 'active',
          created_at: '2026-09-24T10:00:00Z',
          updated_at: '2026-09-24T10:00:00Z',
          accounts: [],
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
      isFlowLoading: false,
      isAddingBank: false,
      syncingConsentId: null,
      extendingConsentId: null,
      isSyncing: false,
      refetch: vi.fn(),
      startAddBankFlow: vi.fn(),
      startOnDemandSync: vi.fn(),
      startExtendConsent: vi.fn(),
      revokeConsent: vi.fn(),
    });

    renderComponent({ companyId: 'comp-1', isOwner: false });

    expect(screen.queryByText('Frissítés most')).not.toBeInTheDocument();
    expect(screen.queryByText('180 napos megújítás')).not.toBeInTheDocument();
    expect(screen.queryByText('Kapcsolat bontása')).not.toBeInTheDocument();
    expect(screen.getByText('Csak a cég tulajdonosa kezelheti a banki integrációt.')).toBeInTheDocument();
  });
});
