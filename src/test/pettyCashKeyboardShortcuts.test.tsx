import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import EntriesTab from '@/components/petty-cash/EntriesTab';

// Mock AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-123', email: 'test@example.com' } }),
}));

// Mock CompanyContext
vi.mock('@/contexts/CompanyContext', () => ({
  useCompany: () => ({ selectedCompany: { id: 'comp-123', name: 'Test Kft' } }),
}));

// Mock DateRangeContext
vi.mock('@/contexts/DateRangeContext', () => ({
  useDateRange: () => ({
    dateFromFormatted: '2026-01-01',
    dateToFormatted: '2026-12-31',
  }),
}));

// Mock Permissions
vi.mock('@/hooks/useEaisybillPermissions', () => ({
  useEaisybillPermissions: () => ({
    canWrite: () => true,
  }),
}));

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => {
  const queryBuilder: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    update: vi.fn().mockResolvedValue({ data: null, error: null }),
    delete: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  return {
    supabase: {
      from: vi.fn(() => queryBuilder),
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    },
  };
});

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, defaultValue?: any) => {
      if (typeof defaultValue === 'string') return defaultValue;
      if (defaultValue && typeof defaultValue === 'object' && defaultValue.defaultValue) {
        return defaultValue.defaultValue;
      }
      return k;
    },
  }),
}));

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

describe('Petty Cash Keyboard Shortcuts', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <EntriesTab />
      </QueryClientProvider>
    );

  it('renders "Manuális tétel" button with [Ins] shortcut badge', () => {
    renderComponent();
    const manualBtn = screen.getByRole('button', { name: /Manuális tétel/i });
    expect(manualBtn).toBeInTheDocument();
    expect(manualBtn).toHaveTextContent('Ins');
  });

  it('opens ManualEntryDialog when Insert key is pressed on the window', () => {
    renderComponent();
    // Modal is initially closed
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Trigger Insert keydown
    fireEvent.keyDown(window, { key: 'Insert', code: 'Insert' });

    // Dialog should now be open
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('toggles between Bevétel and Kiadás using B and K keys inside the dialog', () => {
    renderComponent();
    // Open modal via Insert
    fireEvent.keyDown(window, { key: 'Insert', code: 'Insert' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // The Bevétel button and Kiadás button exist
    const incomeBtn = screen.getByRole('button', { name: /Bevétel/i });
    const expenseBtn = screen.getByRole('button', { name: /Kiadás/i });

    expect(incomeBtn).toBeInTheDocument();
    expect(expenseBtn).toBeInTheDocument();

    // Default is Bevétel (income) -> expense is false
    // Press 'k' outside free text
    fireEvent.keyDown(window, { key: 'k', code: 'KeyK' });
    // Kiadás button should now have active styling
    expect(expenseBtn.className).toContain('bg-destructive');

    // Press 'b' to switch back to Bevétel
    fireEvent.keyDown(window, { key: 'b', code: 'KeyB' });
    expect(incomeBtn.className).toContain('bg-emerald-600');
  });

  it('supports Alt+B and Alt+K even when focused inside text inputs', () => {
    renderComponent();
    fireEvent.keyDown(window, { key: 'Insert', code: 'Insert' });

    const incomeBtn = screen.getByRole('button', { name: /Bevétel/i });
    const expenseBtn = screen.getByRole('button', { name: /Kiadás/i });

    // Find the description input
    const inputs = screen.getAllByRole('textbox');
    const descInput = inputs.find((inp) => inp.getAttribute('placeholder')?.includes('Készpénzes') || true);
    expect(descInput).toBeDefined();

    if (descInput) {
      descInput.focus();

      // Bare 'k' inside text input should NOT toggle
      fireEvent.keyDown(descInput, { key: 'k', code: 'KeyK' });
      // Income should remain active
      expect(incomeBtn.className).toContain('bg-emerald-600');

      // Alt+K should toggle even from text input
      fireEvent.keyDown(descInput, { key: 'k', code: 'KeyK', altKey: true });
      expect(expenseBtn.className).toContain('bg-destructive');

      // Alt+B should toggle back to income
      fireEvent.keyDown(descInput, { key: 'b', code: 'KeyB', altKey: true });
      expect(incomeBtn.className).toContain('bg-emerald-600');
    }
  });
});
