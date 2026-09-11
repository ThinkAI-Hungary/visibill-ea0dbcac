import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import JournalsPage from '@/pages/JournalsPage';

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'usr-123' } } }),
    },
    rpc: (...args: any[]) => mockRpc(...args),
    from: (...args: any[]) => mockFrom(...args),
  },
}));

vi.mock('@/contexts/CompanyContext', () => ({
  useCompany: () => ({
    selectedCompany: { id: 'comp-1', name: 'VBV Vision Kft.' },
  }),
}));

vi.mock('@/contexts/DateRangeContext', () => ({
  useDateRange: () => ({
    dateRange: { from: new Date('2026-01-01'), to: new Date('2026-12-31') },
  }),
}));

vi.mock('@/hooks/useActivePreset', () => ({
  useActivePreset: () => ({
    activePresetId: 'preset-1',
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('JournalsPage - Unpost and Storno Workflow', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: Infinity },
      },
    });
    vi.clearAllMocks();

    mockRpc.mockResolvedValue({ data: true, error: null });

    mockFrom.mockImplementation((table: string) => {
      const builder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        then: (resolve: any) => {
          if (table === 'acc_journals') {
            return resolve({
              data: [
                { id: 'j-v', code: 'V', name: 'Vevő napló' },
                { id: 'j-ve', code: 'VE', name: 'Vegyes napló' },
              ],
              error: null,
            });
          }
          if (table === 'acc_journal_headers') {
            return resolve({
              data: [
                {
                  id: 'hdr-open-1',
                  journal_id: 'j-v',
                  journal_number: 9,
                  status: 'KONYVELT',
                  entry_type: 'NORMAL',
                  posting_date: '2026-08-28',
                  document_date: '2026-08-28',
                  document_id: 'VBV-2026-27',
                  description: 'GANZ DANUBIUS - Forgalmi engedély',
                  currency: 'HUF',
                  journal: { code: 'V', name: 'Vevő napló' },
                  partner: { id: 'p-1', name: 'GANZ DANUBIUS' },
                  lines: [
                    { id: 'l-1', dc_type: 'T', amount: 6000, gl_account: { gl_number: '311' } },
                    { id: 'l-2', dc_type: 'K', amount: 6000, gl_account: { gl_number: '9649' } },
                  ],
                },
              ],
              error: null,
            });
          }
          if (table === 'acc_accounting_periods') {
            // Open periods
            return resolve({ data: [], error: null });
          }
          if (table === 'vat_returns') {
            // No finalized VAT
            return resolve({ data: [], error: null });
          }
          if (table === 'daily_exchange_rates') {
            return resolve({ data: [], error: null });
          }
          return resolve({ data: [], error: null });
        },
      };
      return builder;
    });
  });

  it('renders open period entry in journal view and triggers unpost RPC on direct edit', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <JournalsPage />
      </QueryClientProvider>
    );

    // Wait for journals list to load, then click the "V" journal tab
    await waitFor(() => {
      expect(screen.getByText('Vevő napló')).toBeInTheDocument();
    });

    const vTab = screen.getByText('Vevő napló').closest('button');
    expect(vTab).toBeInTheDocument();
    fireEvent.click(vTab!);

    // Wait for the entry to load in Vevő napló
    await waitFor(() => {
      expect(screen.getByText('VBV-2026-27')).toBeInTheDocument();
    });

    // Click Javítás / Helyesbítés button
    const editBtn = screen.getByLabelText('Javítás vagy helyesbítés');
    expect(editBtn).toBeInTheDocument();
    fireEvent.click(editBtn);

    // Dialog opens with "Könyvelt tétel javítása"
    await waitFor(() => {
      expect(screen.getByText('Könyvelt tétel javítása')).toBeInTheDocument();
      expect(screen.getByText('Közvetlen visszanyitás és javítás')).toBeInTheDocument();
      expect(screen.getByText('Ajánlott')).toBeInTheDocument();
    });

    // Click "Visszanyitás és szerkesztés"
    const unpostBtn = screen.getByRole('button', { name: /Visszanyitás és szerkesztés/i });
    fireEvent.click(unpostBtn);

    // Verify RPC call
    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('acc_unpost_journal_entry', {
        p_header_id: 'hdr-open-1',
        p_user_id: 'usr-123',
        p_reason: 'Tétel visszanyitva közvetlen javításra',
      });
    });
  });

  it('enforces storno when period is locked by accounting period closing', async () => {
    // Return closed period for 2026-08
    mockFrom.mockImplementation((table: string) => {
      const builder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        then: (resolve: any) => {
          if (table === 'acc_journals') {
            return resolve({
              data: [{ id: 'j-v', code: 'V', name: 'Vevő napló' }],
              error: null,
            });
          }
          if (table === 'acc_accounting_periods') {
            return resolve({
              data: [{ year: 2026, month: 8, is_closed: true }],
              error: null,
            });
          }
          if (table === 'acc_journal_headers') {
            return resolve({
              data: [
                {
                  id: 'hdr-closed-1',
                  journal_id: 'j-v',
                  journal_number: 9,
                  status: 'KONYVELT',
                  entry_type: 'NORMAL',
                  posting_date: '2026-08-28',
                  document_date: '2026-08-28',
                  document_id: 'VBV-2026-27',
                  description: 'GANZ DANUBIUS - Forgalmi engedély',
                  currency: 'HUF',
                  journal: { code: 'V', name: 'Vevő napló' },
                  partner: { id: 'p-1', name: 'GANZ DANUBIUS' },
                  lines: [],
                },
              ],
              error: null,
            });
          }
          return resolve({ data: [], error: null });
        },
      };
      return builder;
    });

    render(
      <QueryClientProvider client={queryClient}>
        <JournalsPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Vevő napló')).toBeInTheDocument();
    });

    const vTab = screen.getByText('Vevő napló').closest('button');
    fireEvent.click(vTab!);

    await waitFor(() => {
      expect(screen.getByText('VBV-2026-27')).toBeInTheDocument();
    });

    const editBtn = screen.getByLabelText('Javítás vagy helyesbítés');
    fireEvent.click(editBtn);

    // Dialog opens showing locked period warning
    await waitFor(() => {
      expect(screen.getByText('Bizonylat helyesbítése (Lezárt időszak)')).toBeInTheDocument();
      expect(screen.getByText(/Lezárt számviteli időszak \(2026\/8\. hó\)/)).toBeInTheDocument();
    });

    // Provide reason and click "Helyesbítés indítása sztornóval"
    const input = screen.getByPlaceholderText(/Hibás főkönyvi szám/i);
    fireEvent.change(input, { target: { value: 'Audit javítás' } });

    const stornoSubmitBtn = screen.getByRole('button', { name: /Helyesbítés indítása sztornóval/i });
    expect(stornoSubmitBtn).not.toBeDisabled();
    fireEvent.click(stornoSubmitBtn);

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('acc_storno_journal_entry', {
        p_header_id: 'hdr-closed-1',
        p_user_id: 'usr-123',
        p_reason: 'Audit javítás',
        p_create_correction: true,
      });
    });
  });

  it('protects unposted draft with assigned journal_number from deletion', async () => {
    // Return an unposted draft with journal_number 9
    mockFrom.mockImplementation((table: string) => {
      const builder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        then: (resolve: any) => {
          if (table === 'acc_journals') {
            return resolve({
              data: [{ id: 'j-v', code: 'V', name: 'Vevő napló' }],
              error: null,
            });
          }
          if (table === 'acc_journal_headers') {
            return resolve({
              data: [
                {
                  id: 'hdr-unposted-draft-1',
                  journal_id: 'j-v',
                  journal_number: 9,
                  status: 'KEZI_PISZKOZAT',
                  entry_type: 'NORMAL',
                  posting_date: '2026-08-28',
                  document_date: '2026-08-28',
                  document_id: 'VBV-2026-27',
                  description: 'GANZ DANUBIUS - Javítás',
                  currency: 'HUF',
                  journal: { code: 'V', name: 'Vevő napló' },
                  partner: { id: 'p-1', name: 'GANZ DANUBIUS' },
                  lines: [],
                },
              ],
              error: null,
            });
          }
          return resolve({ data: [], error: null });
        },
      };
      return builder;
    });

    render(
      <QueryClientProvider client={queryClient}>
        <JournalsPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Vevő napló')).toBeInTheDocument();
    });

    const vTab = screen.getByText('Vevő napló').closest('button');
    fireEvent.click(vTab!);

    await waitFor(() => {
      expect(screen.getByText('VBV-2026-27')).toBeInTheDocument();
    });

    // The draft has an edit and post button, but NO "Piszkozat törlése" button because it has journal_number = 9
    expect(screen.queryByLabelText('Piszkozat törlése')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Bizonylat végleges könyvelése')).toBeInTheDocument();
    expect(screen.getByLabelText('Bizonylat szerkesztése')).toBeInTheDocument();
  });
});
