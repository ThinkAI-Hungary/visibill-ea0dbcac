import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useAggreg8 } from '@/hooks/useAggreg8';
import { supabase } from '@/integrations/supabase/client';

// Mock toast hook
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => {
  const mockChannel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  };

  return {
    supabase: {
      from: vi.fn(),
      functions: {
        invoke: vi.fn(),
      },
      channel: vi.fn().mockReturnValue(mockChannel),
      removeChannel: vi.fn(),
    },
  };
});

describe('useAggreg8 Hook', () => {
  let queryClient: QueryClient;
  let originalLocation: Location;

  beforeEach(() => {
    vi.clearAllMocks();
    originalLocation = window.location;
    // Allow mocking window.location.href
    delete (window as any).location;
    (window as any).location = { href: '' };

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  afterEach(() => {
    window.location = originalLocation;
    vi.restoreAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  );

  it('fetches consents and accounts for given companyId and filters out deleted ones', async () => {
    const mockConsents = [
      {
        id: 'consent-1',
        company_id: 'comp-100',
        user_id: 'user-1',
        info_sharing_consent_id: 'isc-100',
        a8_user_id: 'a8-u-100',
        bank_id: 'OTP',
        bank_name: 'OTP Bank',
        bank_logo_url: null,
        status: 'active',
        created_at: '2026-09-24T10:00:00Z',
        accounts: [
          {
            id: 'acc-1',
            account_name: 'Fő számla',
            account_number: '11773016-11111111',
            currency: 'HUF',
            balance: 500000,
          },
        ],
      },
    ];

    const orderMock = vi.fn().mockResolvedValue({ data: mockConsents, error: null });
    const neqMock = vi.fn().mockReturnValue({ order: orderMock });
    const eqMock = vi.fn().mockReturnValue({ neq: neqMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });

    vi.mocked(supabase.from).mockReturnValue({
      select: selectMock,
    } as any);

    const { result } = renderHook(() => useAggreg8('comp-100'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(supabase.from).toHaveBeenCalledWith('aggreg8_consents');
    expect(eqMock).toHaveBeenCalledWith('company_id', 'comp-100');
    expect(neqMock).toHaveBeenCalledWith('status', 'deleted');
    expect(orderMock).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(result.current.consents).toEqual(mockConsents);
  });

  it('startAddBankFlow invokes aggreg8-api init-flow ADD_BANK, opens popup, and executes callback on close', async () => {
    // Setup fetch mock for initial query
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        neq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });
    vi.mocked(supabase.from).mockReturnValue({ select: selectMock } as any);

    // Mock functions.invoke
    vi.mocked(supabase.functions.invoke).mockImplementation(async (name: string, options?: any) => {
      if (options?.body?.action === 'init-flow') {
        return {
          data: {
            success: true,
            syncUiUrl: 'https://sync.aggreg8.hu/flow/add-bank-session-123',
          },
          error: null,
        } as any;
      }
      if (options?.body?.action === 'sync-transactions') {
        return {
          data: {
            success: true,
            totalSynced: 12,
            bankName: 'OTP Bank',
            hasMore: false,
          },
          error: null,
        } as any;
      }
      return { data: null, error: null } as any;
    });

    // Mock window.open
    let popupClosed = false;
    const fakePopup = {
      get closed() {
        return popupClosed;
      },
    };
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(fakePopup as any);

    const { result } = renderHook(() => useAggreg8('comp-100'), { wrapper });

    await act(async () => {
      await result.current.startAddBankFlow();
    });

    // 1. Initial edge function call
    expect(supabase.functions.invoke).toHaveBeenCalledWith('aggreg8-api', {
      body: expect.objectContaining({
        action: 'init-flow',
        flowType: 'ADD_BANK',
        companyId: 'comp-100',
      }),
    });

    // 2. Popup opened with URL
    expect(openSpy).toHaveBeenCalledWith(
      'https://sync.aggreg8.hu/flow/add-bank-session-123',
      'aggreg8_sync_ui',
      expect.stringContaining('width=500')
    );

    // 3. User closes popup -> triggers interval callback
    popupClosed = true;

    // Wait for popup close interval to execute
    await act(async () => {
      await vi.waitFor(() => {
        expect(supabase.functions.invoke).toHaveBeenCalledWith('aggreg8-api', {
          body: expect.objectContaining({
            action: 'sync-transactions',
            companyId: 'comp-100',
          }),
        });
      }, { timeout: 3000 });
    });

    // 4. Success toast shown
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Sikeres bankcsatlakozás!',
        description: expect.stringContaining('12 db tranzakció sikeresen szinkronizálva'),
      })
    );
  });

  it('startOnDemandSync invokes aggreg8-api ON_DEMAND with infoSharingConsentId', async () => {
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        neq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });
    vi.mocked(supabase.from).mockReturnValue({ select: selectMock } as any);

    vi.mocked(supabase.functions.invoke).mockImplementation(async (name: string, options?: any) => {
      if (options?.body?.action === 'init-flow') {
        return {
          data: {
            success: true,
            syncUiUrl: 'https://sync.aggreg8.hu/flow/on-demand-session-456',
          },
          error: null,
        } as any;
      }
      return { data: { success: true, totalSynced: 0 }, error: null } as any;
    });

    const openSpy = vi.spyOn(window, 'open').mockReturnValue({ closed: false } as any);

    const { result } = renderHook(() => useAggreg8('comp-100'), { wrapper });

    await act(async () => {
      await result.current.startOnDemandSync('isc-456');
    });

    expect(supabase.functions.invoke).toHaveBeenCalledWith('aggreg8-api', {
      body: expect.objectContaining({
        action: 'init-flow',
        flowType: 'ON_DEMAND',
        companyId: 'comp-100',
        infoSharingConsentId: 'isc-456',
      }),
    });

    expect(openSpy).toHaveBeenCalledWith(
      'https://sync.aggreg8.hu/flow/on-demand-session-456',
      'aggreg8_sync_ui',
      expect.stringContaining('width=500')
    );
  });

  it('startExtendConsent invokes aggreg8-api EXTEND_CONSENT with consent id', async () => {
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        neq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });
    vi.mocked(supabase.from).mockReturnValue({ select: selectMock } as any);

    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: {
        success: true,
        syncUiUrl: 'https://sync.aggreg8.hu/flow/extend-session-789',
      },
      error: null,
    } as any);

    vi.spyOn(window, 'open').mockReturnValue({ closed: false } as any);

    const { result } = renderHook(() => useAggreg8('comp-100'), { wrapper });

    await act(async () => {
      await result.current.startExtendConsent('isc-789');
    });

    expect(supabase.functions.invoke).toHaveBeenCalledWith('aggreg8-api', {
      body: expect.objectContaining({
        action: 'init-flow',
        flowType: 'EXTEND_CONSENT',
        companyId: 'comp-100',
        infoSharingConsentId: 'isc-789',
      }),
    });
  });

  it('revokeConsent invokes aggreg8-api DELETE_INFO_SHARING_CONSENT and updates DB status to deleted', async () => {
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        neq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });

    const updateEqMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock });

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'aggreg8_consents') {
        return {
          select: selectMock,
          update: updateMock,
        } as any;
      }
      return {} as any;
    });

    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { success: true },
      error: null,
    } as any);

    const { result } = renderHook(() => useAggreg8('comp-100'), { wrapper });

    await act(async () => {
      await result.current.revokeConsent('consent-uuid-1', 'isc-999');
    });

    // 1. Calls Edge Function to delete from Aggreg8
    expect(supabase.functions.invoke).toHaveBeenCalledWith('aggreg8-api', {
      body: expect.objectContaining({
        action: 'init-flow',
        flowType: 'DELETE_INFO_SHARING_CONSENT',
        companyId: 'comp-100',
        infoSharingConsentId: 'isc-999',
      }),
    });

    // 2. Updates local database status
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'deleted',
      })
    );
    expect(updateEqMock).toHaveBeenCalledWith('id', 'consent-uuid-1');

    // 3. Success toast
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Bankkapcsolat törölve',
      })
    );
  });

  it('sanitizes technical errors into clear Hungarian messages (401, 429, 500, Bad Request)', async () => {
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        neq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });
    vi.mocked(supabase.from).mockReturnValue({ select: selectMock } as any);

    // Test 401 Unauthorized
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: { error: '401 Unauthorized: token expired' },
      error: new Error('401'),
    } as any);

    const { result } = renderHook(() => useAggreg8('comp-100'), { wrapper });

    await act(async () => {
      await result.current.startAddBankFlow();
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        description: 'A banki hitelesítés érvénytelen vagy lejárt. Kérjük, jelentkezz be újra.',
      })
    );

    // Test 429 Rate Limit
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: { error: '429 Too Many Requests' },
      error: new Error('429'),
    } as any);

    await act(async () => {
      await result.current.startAddBankFlow();
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        description: 'Túl sok szinkronizációs kérés érkezett rövid időn belül. Kérjük, várj pár percet az újabb próbálkozás előtt.',
      })
    );

    // Test 503 Server Error
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: { error: '503 Service Unavailable' },
      error: new Error('503'),
    } as any);

    await act(async () => {
      await result.current.startAddBankFlow();
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        description: 'A banki aggregátor (Aggreg8) vagy a partnerbank szolgáltatása jelenleg átmenetileg nem elérhető. Kérjük, próbáld újra később.',
      })
    );

    // Test Bad Request / User mismatch
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: { error: 'Bad Request: originatedFrom a8-ais-api user mismatch' },
      error: new Error('Bad Request'),
    } as any);

    await act(async () => {
      await result.current.startAddBankFlow();
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        description: expect.stringContaining('A banki azonosítási kérelem érvénytelen, vagy a kapcsolódó hozzájárulás felhasználója eltér'),
      })
    );
  });

  it('redirects window.location.href if popup is blocked by browser', async () => {
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        neq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });
    vi.mocked(supabase.from).mockReturnValue({ select: selectMock } as any);

    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: {
        success: true,
        syncUiUrl: 'https://sync.aggreg8.hu/flow/fallback-redirect-url',
      },
      error: null,
    } as any);

    // Mock popup blocked (window.open returns null)
    vi.spyOn(window, 'open').mockReturnValue(null);

    const { result } = renderHook(() => useAggreg8('comp-100'), { wrapper });

    await act(async () => {
      await result.current.startAddBankFlow();
    });

    expect(window.location.href).toBe('https://sync.aggreg8.hu/flow/fallback-redirect-url');
  });

  it('sets up realtime subscription for companyId on mount and removes it on unmount', () => {
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        neq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });
    vi.mocked(supabase.from).mockReturnValue({ select: selectMock } as any);

    const { unmount } = renderHook(() => useAggreg8('comp-realtime-test'), { wrapper });

    expect(supabase.channel).toHaveBeenCalledWith('aggreg8-realtime-comp-realtime-test');

    unmount();

    expect(supabase.removeChannel).toHaveBeenCalled();
  });
});
