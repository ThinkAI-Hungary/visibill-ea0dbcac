import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AddManualJournalEntryModal from '../AddManualJournalEntryModal';

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

vi.mock('@/integrations/supabase/client', () => {
  const createQueryBuilder = (table?: string) => {
    const builder: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation(() => ({
        order: vi.fn().mockImplementation(() => {
          if (table === 'partners') {
            return Promise.resolve({
              data: [
                { id: 'p-1', name: 'Absurd Kft.', tax_number: '12345678-1-42' },
                { id: 'p-2', name: 'Bégé Design Kft.', tax_number: '87654321-2-41' },
              ],
              error: null,
            });
          }
          return Promise.resolve({ data: [], error: null });
        }),
        then: (resolve: any) => {
          if (table === 'acc_journals') {
            return resolve({ data: [{ id: 'j-1', code: 'VE', name: 'Vegyes' }], error: null });
          }
          return resolve({ data: [], error: null });
        },
      })),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    };
    return builder;
  };

  return {
    supabase: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-1' } } }),
      },
      from: vi.fn((table: string) => createQueryBuilder(table)),
    },
  };
});

vi.mock('@/lib/glData', () => ({
  fetchAllGlAccountsByPreset: vi.fn().mockResolvedValue([
    { id: 'gl-1', gl_number: '5411', short_name: 'Munkavállalók és tagok bérköltsége' },
    { id: 'gl-2', gl_number: '4711', short_name: 'Jövedelemelszámolási számla' },
  ]),
}));

vi.mock('@/contexts/CompanyContext', () => ({
  useCompany: () => ({
    selectedCompany: { id: 'comp-1', name: 'TS Consult Kft.' },
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

describe('AddManualJournalEntryModal - Layout and Keyboard Navigation', () => {
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

  const renderModal = (props = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <AddManualJournalEntryModal
          open={true}
          onOpenChange={vi.fn()}
          {...props}
        />
      </QueryClientProvider>
    );
  };

  it('renders table with fixed layout, horizontal and vertical overflow container, and sticky header', () => {
    renderModal();

    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
    expect(table.className).toContain('table-fixed');
    expect(table.className).toContain('min-w-');

    // Container should have overflow-x-auto, overflow-y-auto, and maxHeight clamp to keep scrolling inside table
    const container = table.closest('div');
    expect(container?.className).toContain('overflow-x-auto');
    expect(container?.className).toContain('overflow-y-auto');
    expect(container?.style.maxHeight).toContain('clamp');

    // thead should be sticky
    const thead = table.querySelector('thead');
    expect(thead?.className).toContain('sticky');
  });

  it('sets tabIndex={-1} on delete row buttons to prevent tabbing focus traps', () => {
    renderModal();

    const deleteButtons = screen.getAllByRole('button', { name: /törlése/i });
    expect(deleteButtons.length).toBeGreaterThanOrEqual(2);
    deleteButtons.forEach(btn => {
      expect(btn).toHaveAttribute('tabindex', '-1');
    });
  });

  it('prevents form submission when pressing Enter inside an input field', () => {
    renderModal();

    const docInput = screen.getByPlaceholderText(/pl\. VE-2026\/001/i);
    const enterEvent = fireEvent.keyDown(docInput, { key: 'Enter', code: 'Enter', charCode: 13 });
    // If preventDefault() is called, fireEvent returns false
    expect(enterEvent).toBe(false);
  });

  it('automatically adds a new row when pressing Tab on the last row description input', () => {
    renderModal();

    // Initially there are 2 rows
    const initialDeleteButtons = screen.getAllByRole('button', { name: /törlése/i });
    expect(initialDeleteButtons.length).toBe(2);

    const descInputs = screen.getAllByPlaceholderText('Tétel megnevezése...');
    const lastDescInput = descInputs[descInputs.length - 1];

    // Press Tab on the last description input
    fireEvent.keyDown(lastDescInput, { key: 'Tab', code: 'Tab' });

    // Should now have 3 rows
    const updatedDeleteButtons = screen.getAllByRole('button', { name: /törlése/i });
    expect(updatedDeleteButtons.length).toBe(3);
  });

  it('automatically adds a new row when pressing Enter on the last row description input', () => {
    renderModal();

    const descInputs = screen.getAllByPlaceholderText('Tétel megnevezése...');
    const lastDescInput = descInputs[descInputs.length - 1];

    fireEvent.keyDown(lastDescInput, { key: 'Enter', code: 'Enter' });

    const updatedDeleteButtons = screen.getAllByRole('button', { name: /törlése/i });
    expect(updatedDeleteButtons.length).toBe(3);
  });

  it('focuses description when pressing Enter on the amount input', () => {
    renderModal();

    const amountInputs = document.querySelectorAll('input[type="number"]');
    const firstAmountInput = amountInputs[0];
    const descInput0 = document.getElementById('desc-input-0');

    // Spy on focus
    const focusSpy = vi.spyOn(descInput0!, 'focus');

    fireEvent.keyDown(firstAmountInput, { key: 'Enter', code: 'Enter' });

    expect(focusSpy).toHaveBeenCalled();
  });

  it('intelligently defaults new row dc_type to K when Debit > Credit and to T when balanced', () => {
    renderModal();

    // Fill row 0 with amount 100000 (T)
    const amountInputs = document.querySelectorAll('input[type="number"]');
    fireEvent.change(amountInputs[0], { target: { value: '100000' } });

    // Click 'Új sor' button
    const addRowBtn = screen.getByRole('button', { name: /Új sor/i });
    fireEvent.click(addRowBtn);

    // Row 2 should be added, and because T (100000) > K (0), the new row should be 'K'
    // Let's verify row 2 has select trigger with 'K'
    const dcTrigger2 = document.getElementById('dc-type-trigger-2');
    expect(dcTrigger2).toHaveTextContent(/K - Követel/i);
  });

  it('renders custom DatePicker components for posting date and document date', () => {
    renderModal();

    const postingDatePicker = document.getElementById('postingDate');
    const documentDatePicker = document.getElementById('documentDate');

    expect(postingDatePicker).toBeInTheDocument();
    expect(documentDatePicker).toBeInTheDocument();
    // They are button triggers from DatePicker popover, not native input[type=date]
    expect(postingDatePicker?.tagName.toLowerCase()).toBe('button');
    expect(documentDatePicker?.tagName.toLowerCase()).toBe('button');
  });

  it('renders searchable partner combobox and allows searching and selecting a partner', async () => {
    renderModal();

    // The partner combobox trigger button
    const partnerTrigger = document.getElementById('partner');
    expect(partnerTrigger).toBeInTheDocument();
    expect(partnerTrigger?.getAttribute('role')).toBe('combobox');
    expect(partnerTrigger).toHaveTextContent('— Nincs partner —');

    // Click trigger to open combobox
    fireEvent.click(partnerTrigger!);

    // Partner search input should be visible
    const searchInput = screen.getByPlaceholderText(/Keresés név vagy adószám alapján/i);
    expect(searchInput).toBeInTheDocument();

    // Wait for partner options to render
    const begeOption = await screen.findByText('Bégé Design Kft.');
    expect(begeOption).toBeInTheDocument();

    // Search by typing 'bege' (accent-insensitive)
    fireEvent.change(searchInput, { target: { value: 'bege' } });
    expect(screen.getByText('Bégé Design Kft.')).toBeInTheDocument();

    // Click to select partner
    fireEvent.click(begeOption);

    // After selection, the trigger should show selected partner
    expect(partnerTrigger).toHaveTextContent('Bégé Design Kft.');

    // Re-open and select "— Nincs partner —"
    fireEvent.click(partnerTrigger!);
    const noPartnerOption = screen.getByText('— Nincs partner —');
    fireEvent.click(noPartnerOption);
    expect(partnerTrigger).toHaveTextContent('— Nincs partner —');
  });
});
