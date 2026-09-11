import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AddManualJournalEntryModal from '../AddManualJournalEntryModal';
import OpeningJournalWizardModal from '../OpeningJournalWizardModal';

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

const mockExistingOpeningEntry = {
  id: 'ny-entry-1',
  journal_id: 'j-ny',
  accounting_year: 2026,
  status: 'KEZI_PISZKOZAT',
  entry_type: 'OPENING',
  posting_date: '2026-01-01',
  document_date: '2026-01-01',
  document_id: 'NYITO-2026',
  description: 'Nyitó tételek (2026)',
  justification: 'Előző évi mérleg alapján',
  lines: [
    { id: 'l-1', gl_account_id: 'gl-3841', dc_type: 'T', amount: 500000, description: 'OTP Bank nyitó' },
    { id: 'l-2', gl_account_id: 'gl-491', dc_type: 'K', amount: 500000, description: 'Nyitómérleg ellenszámla' },
  ],
};

let mockJournalsList = [
  { id: 'j-ve', code: 'VE', name: 'Vegyes' },
  { id: 'j-ny', code: 'NY', name: 'Nyitó tételek' },
];

vi.mock('@/integrations/supabase/client', () => {
  const createQueryBuilder = (table?: string) => {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation((col: string, val: any) => {
        if (table === 'acc_journal_headers' && val === 'ny-entry-1') {
          return {
            maybeSingle: vi.fn().mockResolvedValue({ data: mockExistingOpeningEntry, error: null }),
          };
        }
        return {
          order: vi.fn().mockImplementation(() => {
            if (table === 'partners' || table === 'projects') {
              return Promise.resolve({ data: [], error: null });
            }
            return Promise.resolve({ data: [], error: null });
          }),
          then: (resolve: any) => {
            if (table === 'acc_journals') {
              return resolve({
                data: mockJournalsList,
                error: null,
              });
            }
            return resolve({ data: [], error: null });
          },
        };
      }),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    };
  };

  return {
    supabase: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-1' } } }),
      },
      from: vi.fn((table: string) => createQueryBuilder(table)),
      rpc: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
    },
  };
});

vi.mock('@/lib/glData', () => ({
  fetchAllGlAccountsByPreset: vi.fn().mockResolvedValue([
    { id: 'gl-3841', gl_number: '3841', short_name: 'OTP Bank' },
    { id: 'gl-491', gl_number: '491', short_name: 'Nyitómérleg számla' },
  ]),
}));

vi.mock('@/contexts/CompanyContext', () => ({
  useCompany: () => ({
    selectedCompany: { id: 'comp-1', name: 'VBV Vision Kft.' },
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/hooks/useActivePreset', () => ({
  useActivePreset: () => ({
    activePresetId: 'preset-1',
  }),
}));

describe('Opening Entry Editing vs New Creation & Guard Validation (EB-0065)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockJournalsList = [
      { id: 'j-ve', code: 'VE', name: 'Vegyes' },
      { id: 'j-ny', code: 'NY', name: 'Nyitó tételek' },
    ];
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  it('does NOT redirect to wizard when editing an existing opening entry (entryId is set)', async () => {
    const onOpenOpeningWizard = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <AddManualJournalEntryModal
          open={true}
          onOpenChange={onOpenChange}
          entryId="ny-entry-1"
          onOpenOpeningWizard={onOpenOpeningWizard}
        />
      </QueryClientProvider>
    );

    // Wait for the entry lines to load and render in the input fields
    await waitFor(() => {
      expect(screen.getByDisplayValue('OTP Bank nyitó')).toBeInTheDocument();
    });

    // Verify onOpenOpeningWizard was NOT called (no hijack redirect)
    expect(onOpenOpeningWizard).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();

    // Verify amount inputs are rendered for all lines
    const amountInputs = screen.getAllByDisplayValue('500000');
    expect(amountInputs.length).toBe(2);
  });

  it('redirects to wizard when NY journal is active for a NEW entry (entryId is undefined)', async () => {
    const onOpenOpeningWizard = vi.fn();
    const onOpenChange = vi.fn();

    // For this test, NY is the active journal
    mockJournalsList = [
      { id: 'j-ny', code: 'NY', name: 'Nyitó tételek' },
    ];

    render(
      <QueryClientProvider client={queryClient}>
        <AddManualJournalEntryModal
          open={true}
          onOpenChange={onOpenChange}
          onOpenOpeningWizard={onOpenOpeningWizard}
        />
      </QueryClientProvider>
    );

    // When creating a new entry in NY journal, onOpenOpeningWizard MUST be invoked
    await waitFor(() => {
      expect(onOpenOpeningWizard).toHaveBeenCalled();
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('OpeningJournalWizardModal blocks advancing when lines are empty (0 Ft)', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <OpeningJournalWizardModal
          open={true}
          onOpenChange={vi.fn()}
        />
      </QueryClientProvider>
    );

    // Step 1 is active initially. Click 'Tovább a Főkönyvhöz'
    const step1Next = screen.getByRole('button', { name: /Tovább a Főkönyvhöz/i });
    expect(step1Next).toBeInTheDocument();
    step1Next.click();

    // Now in Step 2. Verify warning indicator shows when no lines have amounts
    await waitFor(() => {
      expect(screen.getByText(/Nincsenek nyitó összegek/i)).toBeInTheDocument();
    });

    // The 'Tovább az Analitikához' button must be disabled
    const step2Next = screen.getByRole('button', { name: /Tovább az Analitikához/i });
    expect(step2Next).toBeDisabled();
  });
});
