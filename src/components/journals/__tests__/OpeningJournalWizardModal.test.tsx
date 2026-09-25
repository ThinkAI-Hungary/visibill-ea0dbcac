import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import OpeningJournalWizardModal, { isForeignCurrencyAccount, findMnbRateForDate } from '../OpeningJournalWizardModal';

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

// Mock company context
vi.mock('@/contexts/CompanyContext', () => ({
  useCompany: () => ({
    selectedCompany: { id: 'comp-123', name: 'Test Cég Kft.' },
  }),
}));

// Mock active preset
vi.mock('@/hooks/useActivePreset', () => ({
  useActivePreset: () => ({
    activePresetId: 'preset-123',
    isLoading: false,
  }),
}));

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Mock glData
vi.mock('@/lib/glData', () => ({
  fetchAllGlAccountsByPreset: vi.fn().mockResolvedValue([
    { id: 'gl-1', gl_number: '111', short_name: 'Ingatlanok' },
    { id: 'gl-2', gl_number: '311', short_name: 'Vevők' },
    { id: 'gl-3', gl_number: '454', short_name: 'Szállítók' },
    { id: 'gl-4', gl_number: '491', short_name: 'Nyitómérleg technikai számla' },
    { id: 'gl-5', gl_number: '3861', short_name: 'EUR Devizabetétszámla' },
  ]),
}));

let mockExistingOpeningEntry: any = null;

// Mock supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockImplementation((table: string) => {
      const builder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 'hdr-1' }, error: null }),
          }),
        }),
        maybeSingle: vi.fn().mockImplementation(() => {
          if (table === 'acc_journals') {
            return Promise.resolve({ data: { id: 'journal-ny', code: 'NY', name: 'Nyitó Napló' }, error: null });
          }
          if (table === 'acc_journal_headers') {
            return Promise.resolve({ data: mockExistingOpeningEntry, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        }),
      };
      return builder;
    }),
    rpc: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
    },
  },
}));

describe('OpeningJournalWizardModal Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    mockExistingOpeningEntry = null;
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  const renderModal = (props: Partial<React.ComponentProps<typeof OpeningJournalWizardModal>> = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <OpeningJournalWizardModal
          open={true}
          onOpenChange={vi.fn()}
          {...props}
        />
      </QueryClientProvider>
    );
  };

  it('renders Step 1 with Alapadatok and modern stepper indicators', () => {
    renderModal();

    expect(screen.getByText('Nyitó tételek rögzítése & Varázsló')).toBeInTheDocument();
    expect(screen.getByText('Sztv. 491')).toBeInTheDocument();
    expect(screen.getByText('Alapadatok')).toBeInTheDocument();
    expect(screen.getByText('Főkönyv & 491')).toBeInTheDocument();
    expect(screen.getByText('Analitika')).toBeInTheDocument();
    expect(screen.getByText('Rendező')).toBeInTheDocument();

    expect(screen.getByText('Könyvelési Adóév')).toBeInTheDocument();
    expect(screen.getByText('Nyitás Dátuma (Sztv. kötelező)')).toBeInTheDocument();
    expect(screen.getByText('Bizonylatszám')).toBeInTheDocument();
  });

  it('navigates to Step 2 when clicking "Tovább a Főkönyvhöz"', async () => {
    renderModal();

    const nextButton = screen.getByText(/Tovább a Főkönyvhöz/i);
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('Sor hozzáadása')).toBeInTheDocument();
      expect(screen.getByText(/491 Nyitó\s*mérleg/i)).toBeInTheDocument();
    });
  });

  it('renders NumberInput for row amount inputs in Step 2', async () => {
    renderModal();

    // Move to step 2
    fireEvent.click(screen.getByText(/Tovább a Főkönyvhöz/i));

    await waitFor(() => {
      // Amount inputs with id amount-input-0, amount-input-1
      const amountInput0 = document.getElementById('amount-input-0');
      expect(amountInput0).toBeInTheDocument();
      expect(amountInput0).toHaveAttribute('type', 'number');
    });
  });

  it('allows adding and removing lines in Step 2', async () => {
    renderModal();

    // Move to step 2
    fireEvent.click(screen.getByText(/Tovább a Főkönyvhöz/i));

    await waitFor(() => {
      expect(screen.getByText('Sor hozzáadása')).toBeInTheDocument();
    });

    const addLineBtn = screen.getByText('Sor hozzáadása');
    fireEvent.click(addLineBtn);

    // Initial 2 lines + 1 added = 3 lines
    await waitFor(() => {
      const amountInput2 = document.getElementById('amount-input-2');
      expect(amountInput2).toBeInTheDocument();
    });
  });

  it('allows clicking previous step on the modernized stepper to navigate back', async () => {
    renderModal();

    // Step 1 -> Step 2
    fireEvent.click(screen.getByText(/Tovább a Főkönyvhöz/i));

    await waitFor(() => {
      expect(screen.getByText('Sor hozzáadása')).toBeInTheDocument();
    });

    // Step 1 button in stepper is now passed, so it should be clickable
    const step1Btn = screen.getByRole('button', { name: /Alapadatok/i });
    fireEvent.click(step1Btn);

    await waitFor(() => {
      expect(screen.getByText('Könyvelési Adóév')).toBeInTheDocument();
    });
  });

  it('calls onOpenChange(false) when clicking Bezárás', async () => {
    const onOpenChange = vi.fn();
    renderModal({ onOpenChange });

    const closeBtn = screen.getByRole('button', { name: 'Bezárás' });
    fireEvent.click(closeBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('resets to Step 1 when modal is closed and reopened', async () => {
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <OpeningJournalWizardModal
          open={true}
          onOpenChange={vi.fn()}
        />
      </QueryClientProvider>
    );

    // Step 1 -> Step 2
    fireEvent.click(screen.getByText(/Tovább a Főkönyvhöz/i));
    await waitFor(() => {
      expect(screen.getByText('Sor hozzáadása')).toBeInTheDocument();
    });

    // Close modal (open=false)
    rerender(
      <QueryClientProvider client={queryClient}>
        <OpeningJournalWizardModal
          open={false}
          onOpenChange={vi.fn()}
        />
      </QueryClientProvider>
    );

    // Reopen modal (open=true)
    rerender(
      <QueryClientProvider client={queryClient}>
        <OpeningJournalWizardModal
          open={true}
          onOpenChange={vi.fn()}
        />
      </QueryClientProvider>
    );

    // Should be reset to Step 1!
    await waitFor(() => {
      expect(screen.getByText('Könyvelési Adóév')).toBeInTheDocument();
      expect(screen.getByText(/Tovább a Főkönyvhöz/i)).toBeInTheDocument();
    });
  });

  describe('Foreign Currency Opening Support (Devizás Nyitó)', () => {
    it('correctly identifies foreign currency accounts via isForeignCurrencyAccount', () => {
      // 386* Devizabetét
      expect(isForeignCurrencyAccount('3861', 'EUR Bankszámla')).toBe(true);
      expect(isForeignCurrencyAccount('386.10', 'Devizabetét')).toBe(true);

      // 382* Valutapénztár
      expect(isForeignCurrencyAccount('3821', 'EUR Valutapénztár')).toBe(true);

      // 316* Külföldi vevők / 317*
      expect(isForeignCurrencyAccount('316', 'Külföldi vevők')).toBe(true);
      expect(isForeignCurrencyAccount('3171', 'Devizás követelések')).toBe(true);

      // 4542* Külföldi szállítók / 455*
      expect(isForeignCurrencyAccount('4542', 'Külföldi szállítók')).toBe(true);
      expect(isForeignCurrencyAccount('4551', 'Devizás kötelezettségek')).toBe(true);

      // Name based detection
      expect(isForeignCurrencyAccount('3849', 'Egyedi deviza számla')).toBe(true);

      // Direct database is_multicurrency flag and currency
      expect(isForeignCurrencyAccount('3899', 'Egyéb', true, null)).toBe(true);
      expect(isForeignCurrencyAccount('3899', 'Egyéb', false, 'EUR')).toBe(true);
      expect(isForeignCurrencyAccount('3899', 'Egyéb', false, 'HUF')).toBe(false);

      // Standard HUF accounts
      expect(isForeignCurrencyAccount('111', 'Ingatlanok')).toBe(false);
      expect(isForeignCurrencyAccount('311', 'Belföldi vevők')).toBe(false);
      expect(isForeignCurrencyAccount('454', 'Belföldi szállítók')).toBe(false);
      expect(isForeignCurrencyAccount('491', 'Nyitómérleg technikai')).toBe(false);
    });

    it('toggles foreign currency mode on a row and auto-calculates HUF amount from foreign_amount and exchange_rate', async () => {
      renderModal();

      // Navigate to Step 2
      fireEvent.click(screen.getByText(/Tovább a Főkönyvhöz/i));

      await waitFor(() => {
        expect(screen.getByText(/Sor hozzáadása/i)).toBeInTheDocument();
      });

      // Toggle foreign mode on row 0
      const foreignToggle0 = document.getElementById('foreign-toggle-0');
      expect(foreignToggle0).toBeInTheDocument();
      fireEvent.click(foreignToggle0!);

      // foreign amount and rate inputs should now appear
      await waitFor(() => {
        expect(document.getElementById('foreign-amount-input-0')).toBeInTheDocument();
        expect(document.getElementById('exchange-rate-input-0')).toBeInTheDocument();
      });

      const fAmountInput = document.getElementById('foreign-amount-input-0') as HTMLInputElement;
      const rateInput = document.getElementById('exchange-rate-input-0') as HTMLInputElement;
      const amountInput = document.getElementById('amount-input-0') as HTMLInputElement;

      // Enter foreign amount 1000 EUR
      fireEvent.change(fAmountInput, { target: { value: '1000' } });

      // Enter exchange rate 405.5
      fireEvent.change(rateInput, { target: { value: '405.5' } });

      // Amount should auto-calculate: 1000 * 405.5 = 405500
      await waitFor(() => {
        expect(amountInput.value).toBe('405500');
      });
    });

    describe('One-Click MNB Closing Rate Fetch (Blind Spot 2)', () => {
      const mockRates = [
        { currency: 'EUR', rate_date: '2026-01-02', rate: 410.2 },
        { currency: 'EUR', rate_date: '2025-12-31', rate: 408.5 },
        { currency: 'USD', rate_date: '2025-12-31', rate: 380.0 },
        { currency: 'CHF', rate_date: '2025-12-15', rate: 430.0 },
      ];

      it('finds exact matching MNB rate for target date', () => {
        const res = findMnbRateForDate(mockRates, 'EUR', '2025-12-31');
        expect(res).not.toBeNull();
        expect(res?.rate).toBe(408.5);
        expect(res?.date).toBe('2025-12-31');
        expect(res?.isExact).toBe(true);
      });

      it('finds last available business day rate when opening date is a holiday (e.g. Jan 1)', () => {
        const res = findMnbRateForDate(mockRates, 'EUR', '2026-01-01');
        expect(res).not.toBeNull();
        expect(res?.rate).toBe(408.5);
        expect(res?.date).toBe('2025-12-31');
        expect(res?.isExact).toBe(false);
      });

      it('returns rate 1 for HUF currency', () => {
        const res = findMnbRateForDate(mockRates, 'HUF', '2026-01-01');
        expect(res).toEqual({ rate: 1, date: '2026-01-01', isExact: true });
      });

      it('returns fallback rate when target date precedes all table records', () => {
        const res = findMnbRateForDate(mockRates, 'CHF', '2025-01-01');
        expect(res).not.toBeNull();
        expect(res?.rate).toBe(430.0);
        expect(res?.isExact).toBe(false);
      });

      it('returns null when currency has no rates in table', () => {
        const res = findMnbRateForDate(mockRates, 'GBP', '2026-01-01');
        expect(res).toBeNull();
      });

      it('renders row-level and bulk MNB fetch buttons when foreign currency mode is active', async () => {
        renderModal();

        // Navigate to Step 2
        fireEvent.click(screen.getByText(/Tovább a Főkönyvhöz/i));

        await waitFor(() => {
          expect(screen.getByText(/Sor hozzáadása/i)).toBeInTheDocument();
        });

        // Toggle foreign mode on row 0
        const foreignToggle0 = document.getElementById('foreign-toggle-0');
        fireEvent.click(foreignToggle0!);

        // Row MNB button and bulk button should now be rendered
        await waitFor(() => {
          expect(document.getElementById('fetch-mnb-btn-0')).toBeInTheDocument();
          expect(document.getElementById('fetch-all-mnb-rates-btn')).toBeInTheDocument();
        });

        // Clicking row MNB button works without error
        const fetchMnbBtn = document.getElementById('fetch-mnb-btn-0')!;
        fireEvent.click(fetchMnbBtn);

        // Clicking bulk MNB button works without error
        const fetchAllMnbBtn = document.getElementById('fetch-all-mnb-rates-btn')!;
        fireEvent.click(fetchAllMnbBtn);
      });
    });

    describe('Chart of Accounts Import at Opening', () => {
      it('renders "Számlatükör importálása" button in Step 1 quick import banner', () => {
        renderModal();
        const coaBtn = screen.getByRole('button', { name: /Számlatükör importálása/i });
        expect(coaBtn).toBeInTheDocument();
      });

      it('opens UploadChartOfAccountsModal when clicking "Számlatükör importálása"', async () => {
        renderModal();
        const coaBtn = screen.getByRole('button', { name: /Számlatükör importálása/i });
        fireEvent.click(coaBtn);

        await waitFor(() => {
          expect(screen.getAllByText(/Számlatükör importálása/i).length).toBeGreaterThanOrEqual(2);
        });
      });

      it('renders "Számlatükör importálása" button in Step 2 toolbar', async () => {
        renderModal();

        // Navigate to Step 2
        fireEvent.click(screen.getByText(/Tovább a Főkönyvhöz/i));

        await waitFor(() => {
          expect(screen.getByText(/Sor hozzáadása/i)).toBeInTheDocument();
        });

        const coaBtns = screen.getAllByRole('button', { name: /Számlatükör importálása/i });
        expect(coaBtns.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe('Existing Opening Entry Guard & Edit Button', () => {
      it('disables "Tovább a Főkönyvhöz" button and displays "Nyitó tétel módosítása" when opening exists', async () => {
        mockExistingOpeningEntry = {
          id: 'existing-hdr-123',
          document_id: 'NYITO-2026',
          posting_date: '2026-01-01',
          status: 'KONYVELT',
        };

        renderModal();

        await waitFor(() => {
          expect(screen.getByText(/Már létezik nyitó bizonylat erre az üzleti évre/i)).toBeInTheDocument();
        });

        const nextBtn = screen.getByRole('button', { name: /Tovább a Főkönyvhöz/i });
        expect(nextBtn).toBeDisabled();

        const modifyBtns = screen.getAllByRole('button', { name: /Nyitó tétel módosítása/i });
        expect(modifyBtns.length).toBeGreaterThanOrEqual(1);
      });

      it('calls unpost RPC and onEditExistingEntry when clicking "Nyitó tétel módosítása"', async () => {
        mockExistingOpeningEntry = {
          id: 'existing-hdr-123',
          document_id: 'NYITO-2026',
          posting_date: '2026-01-01',
          status: 'KONYVELT',
        };

        const onEditExistingEntry = vi.fn();
        const onOpenChange = vi.fn();
        renderModal({ onEditExistingEntry, onOpenChange });

        await waitFor(() => {
          expect(screen.getByText(/Már létezik nyitó bizonylat erre az üzleti évre/i)).toBeInTheDocument();
        });

        const modifyBtn = screen.getAllByRole('button', { name: /Nyitó tétel módosítása/i })[0];
        fireEvent.click(modifyBtn);

        await waitFor(() => {
          expect(onEditExistingEntry).toHaveBeenCalledWith('existing-hdr-123');
          expect(onOpenChange).toHaveBeenCalledWith(false);
        });
      });
    });
  });
});

