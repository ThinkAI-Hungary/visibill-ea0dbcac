import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AddGlAccountModal } from '../AddGlAccountModal';

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

const mockInsert = vi.fn().mockImplementation(() => ({
  select: vi.fn().mockImplementation(() => ({
    single: vi.fn().mockResolvedValue({
      data: { id: 'new-acc-1', gl_number: '4712', short_name: 'Fizikai dolgozók bére' },
      error: null,
    }),
  })),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn((table: string) => ({
      insert: mockInsert,
    })),
  },
}));

vi.mock('@/lib/glData', () => ({
  fetchAllGlAccountsByPreset: vi.fn().mockResolvedValue([
    { id: 'gl-471', gl_number: '471', short_name: 'Jövedelemelszámolási számla' },
    { id: 'gl-4711', gl_number: '4711', short_name: 'Szellemi bér' },
  ]),
}));

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

describe('AddGlAccountModal', () => {
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
        <AddGlAccountModal
          open={true}
          onOpenChange={vi.fn()}
          presetId="preset-123"
          presetName="Jó számlatükör"
          companyId="comp-1"
          {...props}
        />
      </QueryClientProvider>
    );
  };

  it('renders modal with preset name and input fields', () => {
    renderModal();

    expect(screen.getByText(/Új Főkönyvi Szám \/ Alábontás Felvitele/i)).toBeInTheDocument();
    expect(screen.getByText('Jó számlatükör')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/pl\. 4712/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/pl\. Jövedelemelszámolási/i)).toBeInTheDocument();
  });

  it('detects parent account when typing sub-account number (e.g. 4712 under 471)', async () => {
    renderModal();

    const glNumberInput = screen.getByPlaceholderText(/pl\. 4712/i);
    fireEvent.change(glNumberInput, { target: { value: '4712' } });

    await waitFor(() => {
      expect(screen.getByText(/Alábontás a következő gyűjtőhöz/i)).toBeInTheDocument();
      expect(screen.getByText(/471 — Jövedelemelszámolási számla/i)).toBeInTheDocument();
    });
  });

  it('displays duplicate warning if account already exists', async () => {
    renderModal();

    const glNumberInput = screen.getByPlaceholderText(/pl\. 4712/i);
    fireEvent.change(glNumberInput, { target: { value: '4711' } });

    await waitFor(() => {
      expect(screen.getByText(/már szerepel ebben a számlatükörben/i)).toBeInTheDocument();
    });
  });

  it('submits new account and fires success toast', async () => {
    const onOpenChange = vi.fn();
    const onSuccess = vi.fn();

    renderModal({ onOpenChange, onSuccess });

    const glNumberInput = screen.getByPlaceholderText(/pl\. 4712/i);
    const shortNameInput = screen.getByPlaceholderText(/pl\. Jövedelemelszámolási/i);

    fireEvent.change(glNumberInput, { target: { value: '4712' } });
    fireEvent.change(shortNameInput, { target: { value: 'Fizikai dolgozók munkabére' } });

    await waitFor(() => {
      expect(screen.getByText(/Alábontás a következő gyűjtőhöz/i)).toBeInTheDocument();
    });

    const submitBtn = screen.getByRole('button', { name: /Hozzáadás/i });
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          preset_id: 'preset-123',
          gl_number: '4712',
          short_name: 'Fizikai dolgozók munkabére',
          parent_id: 'gl-471',
        })
      );
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Főkönyvi szám létrehozva',
        })
      );
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
