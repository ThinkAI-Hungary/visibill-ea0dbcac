import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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

  it('renders loading skeleton when isLoading is true', () => {
    vi.spyOn(useAggreg8Module, 'useAggreg8').mockReturnValue({
      consents: [],
      isLoading: true,
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

    const { container } = renderComponent({ companyId: 'comp-1', isOwner: true });
    // Should render shimmer skeletons and not the main content
    expect(container.querySelectorAll('.animate-shimmer').length).toBeGreaterThan(0);
    expect(screen.queryByText('Még nincs csatlakoztatott bankszámlád')).not.toBeInTheDocument();
  });

  it('renders error state and handles refetch when isError is true', async () => {
    const mockRefetch = vi.fn();
    vi.spyOn(useAggreg8Module, 'useAggreg8').mockReturnValue({
      consents: [],
      isLoading: false,
      isError: true,
      error: new Error('Hálózati hiba történt a banki adatok lekérésekor'),
      isFlowLoading: false,
      isAddingBank: false,
      syncingConsentId: null,
      extendingConsentId: null,
      isSyncing: false,
      refetch: mockRefetch,
      startAddBankFlow: vi.fn(),
      startOnDemandSync: vi.fn(),
      startExtendConsent: vi.fn(),
      revokeConsent: vi.fn(),
    });

    renderComponent({ companyId: 'comp-1', isOwner: true });

    expect(screen.getByText('Hiba történt a banki kapcsolatok betöltésekor')).toBeInTheDocument();
    expect(screen.getByText('Hálózati hiba történt a banki adatok lekérésekor')).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /Újrapróbálkozás/i });
    expect(retryBtn).toBeInTheDocument();
    retryBtn.click();
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('renders syncing indicator and disables action buttons when isSyncing is true', () => {
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
      isSyncing: true,
      refetch: vi.fn(),
      startAddBankFlow: vi.fn(),
      startOnDemandSync: vi.fn(),
      startExtendConsent: vi.fn(),
      revokeConsent: vi.fn(),
    });

    renderComponent({ companyId: 'comp-1', isOwner: true });

    expect(screen.getByText('Szinkronizálás folyamatban...')).toBeInTheDocument();

    const addBtn = screen.getByRole('button', { name: /Új bank csatlakoztatása/i });
    expect(addBtn).toBeDisabled();

    const syncBtn = screen.getByRole('button', { name: /Frissítés most/i });
    expect(syncBtn).toBeDisabled();
  });

  it('triggers startAddBankFlow on clicking add bank button in empty state and in header', () => {
    const mockAddBank = vi.fn();
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
      startAddBankFlow: mockAddBank,
      startOnDemandSync: vi.fn(),
      startExtendConsent: vi.fn(),
      revokeConsent: vi.fn(),
    });

    renderComponent({ companyId: 'comp-1', isOwner: true });

    const emptyStateBtn = screen.getByText('Bank csatlakoztatása most');
    emptyStateBtn.click();
    expect(mockAddBank).toHaveBeenCalledTimes(1);

    const headerBtn = screen.getByText('Új bank csatlakoztatása');
    headerBtn.click();
    expect(mockAddBank).toHaveBeenCalledTimes(2);
  });

  it('triggers startOnDemandSync with consent id on clicking "Frissítés most"', () => {
    const mockOnDemandSync = vi.fn();
    vi.spyOn(useAggreg8Module, 'useAggreg8').mockReturnValue({
      consents: [
        {
          id: 'consent-123',
          company_id: 'comp-1',
          user_id: 'user-1',
          info_sharing_consent_id: 'isc-999',
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
      startOnDemandSync: mockOnDemandSync,
      startExtendConsent: vi.fn(),
      revokeConsent: vi.fn(),
    });

    renderComponent({ companyId: 'comp-1', isOwner: true });

    const refreshBtn = screen.getByRole('button', { name: /Frissítés most/i });
    refreshBtn.click();
    expect(mockOnDemandSync).toHaveBeenCalledWith('isc-999');
  });

  it('triggers startExtendConsent with consent id on clicking "180 napos megújítás"', () => {
    const mockExtendConsent = vi.fn();
    vi.spyOn(useAggreg8Module, 'useAggreg8').mockReturnValue({
      consents: [
        {
          id: 'consent-123',
          company_id: 'comp-1',
          user_id: 'user-1',
          info_sharing_consent_id: 'isc-999',
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
      startExtendConsent: mockExtendConsent,
      revokeConsent: vi.fn(),
    });

    renderComponent({ companyId: 'comp-1', isOwner: true });

    const extendBtn = screen.getByRole('button', { name: /180 napos megújítás/i });
    extendBtn.click();
    expect(mockExtendConsent).toHaveBeenCalledWith('isc-999');
  });

  it('opens confirmation modal on clicking "Kapcsolat bontása", cancels on "Mégsem", and invokes revokeConsent on confirm', async () => {
    const mockRevokeConsent = vi.fn();
    vi.spyOn(useAggreg8Module, 'useAggreg8').mockReturnValue({
      consents: [
        {
          id: 'consent-123',
          company_id: 'comp-1',
          user_id: 'user-1',
          info_sharing_consent_id: 'isc-999',
          a8_user_id: 'a8-u-1',
          bank_id: 'K&H',
          bank_name: 'K&H Bank',
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
      revokeConsent: mockRevokeConsent,
    });

    renderComponent({ companyId: 'comp-1', isOwner: true });

    // Click "Kapcsolat bontása" on card
    const deleteBtn = screen.getByRole('button', { name: /Kapcsolat bontása/i });
    fireEvent.click(deleteBtn);

    // Dialog should now be in document
    const title = await screen.findByText('Biztosan bontani szeretnéd ezt a bankkapcsolatot?');
    expect(title).toBeInTheDocument();

    // Click "Mégsem" (Cancel)
    const cancelBtn = screen.getByRole('button', { name: /Mégsem/i });
    fireEvent.click(cancelBtn);
    expect(mockRevokeConsent).not.toHaveBeenCalled();

    // Reopen dialog and confirm
    fireEvent.click(deleteBtn);
    await screen.findByText('Biztosan bontani szeretnéd ezt a bankkapcsolatot?');
    const allDeleteButtons = screen.getAllByRole('button', { name: /Kapcsolat bontása/i });
    // The action button inside the dialog
    const confirmDeleteBtn = allDeleteButtons[allDeleteButtons.length - 1];
    fireEvent.click(confirmDeleteBtn);

    expect(mockRevokeConsent).toHaveBeenCalledWith('consent-123', 'isc-999');
  });

  it('renders correct expiration badges: expired, warning (<14 days), and healthy (>14 days)', () => {
    const now = new Date('2026-10-01T12:00:00Z');
    vi.setSystemTime(now);

    const expiredDate = '2026-09-30T00:00:00Z'; // 0 or negative days
    const warningDate = '2026-10-10T12:00:00Z'; // 9 days left
    const healthyDate = '2026-11-15T12:00:00Z'; // 45 days left

    vi.spyOn(useAggreg8Module, 'useAggreg8').mockReturnValue({
      consents: [
        {
          id: 'c-expired',
          company_id: 'comp-1',
          user_id: 'user-1',
          info_sharing_consent_id: 'isc-1',
          a8_user_id: 'a8-1',
          bank_id: 'OTP',
          bank_name: 'OTP Bank',
          bank_logo_url: null,
          active_sync_enabled: true,
          passive_sync_enabled: true,
          active_sync_expiration_date: expiredDate,
          passive_sync_expiration_date: expiredDate,
          status: 'active',
          created_at: '2026-04-01T00:00:00Z',
          updated_at: '2026-04-01T00:00:00Z',
          accounts: [],
        },
        {
          id: 'c-warning',
          company_id: 'comp-1',
          user_id: 'user-1',
          info_sharing_consent_id: 'isc-2',
          a8_user_id: 'a8-2',
          bank_id: 'ERSTE',
          bank_name: 'Erste Bank',
          bank_logo_url: null,
          active_sync_enabled: true,
          passive_sync_enabled: true,
          active_sync_expiration_date: warningDate,
          passive_sync_expiration_date: warningDate,
          status: 'active',
          created_at: '2026-04-01T00:00:00Z',
          updated_at: '2026-04-01T00:00:00Z',
          accounts: [],
        },
        {
          id: 'c-healthy',
          company_id: 'comp-1',
          user_id: 'user-1',
          info_sharing_consent_id: 'isc-3',
          a8_user_id: 'a8-3',
          bank_id: 'KH',
          bank_name: 'K&H Bank',
          bank_logo_url: null,
          active_sync_enabled: true,
          passive_sync_enabled: true,
          active_sync_expiration_date: healthyDate,
          passive_sync_expiration_date: healthyDate,
          status: 'active',
          created_at: '2026-04-01T00:00:00Z',
          updated_at: '2026-04-01T00:00:00Z',
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

    renderComponent({ companyId: 'comp-1', isOwner: true });

    expect(screen.getByText('PSD2 felhatalmazás lejárt')).toBeInTheDocument();
    expect(screen.getByText(/Még 9 nap van hátra/)).toBeInTheDocument();
    expect(screen.getByText(/Még 45 napig érvényes/)).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('renders multi-account layout when multiple accounts belong to a consent', () => {
    vi.spyOn(useAggreg8Module, 'useAggreg8').mockReturnValue({
      consents: [
        {
          id: 'consent-multi',
          company_id: 'comp-1',
          user_id: 'user-1',
          info_sharing_consent_id: 'isc-multi',
          a8_user_id: 'a8-multi',
          bank_id: 'RAIFFEISEN',
          bank_name: 'Raiffeisen Bank',
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
              consent_id: 'consent-multi',
              company_id: 'comp-1',
              a8_account_id: 'a8-acc-1',
              company_bank_account_id: null,
              account_name: 'Fő folyószámla (HUF)',
              account_number: '12011111-22222222-33333333',
              currency: 'HUF',
              balance: 1000000,
              last_ordinal_on_account: 50,
              last_synced_at: '2026-09-25T08:00:00Z',
              last_synced_count: 5,
              created_at: '2026-09-24T10:00:00Z',
              updated_at: '2026-09-25T08:00:00Z',
            },
            {
              id: 'acc-2',
              consent_id: 'consent-multi',
              company_id: 'comp-1',
              a8_account_id: 'a8-acc-2',
              company_bank_account_id: null,
              account_name: 'Deviza alszámla (EUR)',
              account_number: '12011111-44444444-55555555',
              currency: 'EUR',
              balance: 5000,
              last_ordinal_on_account: 12,
              last_synced_at: null,
              last_synced_count: 0,
              created_at: '2026-09-24T10:00:00Z',
              updated_at: '2026-09-24T10:00:00Z',
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

    expect(screen.getByText('Csatlakoztatott számlák (2)')).toBeInTheDocument();
    expect(screen.getByText('Fő folyószámla (HUF)')).toBeInTheDocument();
    expect(screen.getByText('12011111-22222222-33333333')).toBeInTheDocument();
    expect(screen.getByText('+5 tétel')).toBeInTheDocument();

    expect(screen.getByText('Deviza alszámla (EUR)')).toBeInTheDocument();
    expect(screen.getByText('12011111-44444444-55555555')).toBeInTheDocument();
    expect(screen.getByText('Még nem történt')).toBeInTheDocument();
  });
});
