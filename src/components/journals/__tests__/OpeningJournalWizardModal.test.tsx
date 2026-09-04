import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import OpeningJournalWizardModal from '../OpeningJournalWizardModal';

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
  ]),
}));

// Mock supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'journal-ny', code: 'NY', name: 'Nyitó Napló' },
              error: null,
            }),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'hdr-1' }, error: null }),
        }),
      }),
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
      expect(screen.getByText('CSV / JSON Import')).toBeInTheDocument();
      expect(screen.getByText('Sor hozzáadása')).toBeInTheDocument();
      expect(screen.getByText(/491 Nyitómérleg Eltérés/i)).toBeInTheDocument();
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
      expect(screen.getByText('CSV / JSON Import')).toBeInTheDocument();
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
      expect(screen.getByText('CSV / JSON Import')).toBeInTheDocument();
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
});
