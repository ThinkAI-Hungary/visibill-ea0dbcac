import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ManualInvoiceCreateDialog } from '../ManualInvoiceCreateDialog';

const mockToast = vi.fn();
const mockInvalidateQueries = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn((table: string) => ({
      insert: vi.fn((...args: any[]) => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: 'new-invoice-id-123' },
            error: null,
          }),
        })),
        ...mockInsert(...args),
      })),
      update: vi.fn((...args: any[]) => ({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        ...mockUpdate(...args),
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
        })),
      })),
    })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: { path: 'path/file.pdf' }, error: null }),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://example.com/file.pdf' } })),
      })),
    },
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: (...args: any[]) => mockToast(...args),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'test-user-123' } }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
  useQuery: () => ({ data: [], isLoading: false }),
}));

describe('ManualInvoiceCreateDialog', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    companyId: 'company-uuid-1',
    categories: [
      { id: 'cat-1', name: 'IT és szoftver' },
      { id: 'cat-2', name: 'Irodaszer' },
    ],
    projects: [
      { id: 'proj-1', name: 'Webshop v2' },
    ],
    initialDirection: 'INBOUND' as const,
    onSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog with header, tabs, and form inputs', () => {
    render(<ManualInvoiceCreateDialog {...defaultProps} />);

    expect(screen.getByText('Új számla rögzítése')).toBeInTheDocument();
    expect(screen.getByText('Számla adatok')).toBeInTheDocument();
    expect(screen.getByText('Számlatételek')).toBeInTheDocument();
    expect(screen.getByLabelText(/Bizonylatsorszám/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Eladó neve/i)).toBeInTheDocument();
    expect(screen.getByText('Számla rögzítése')).toBeInTheDocument();
  });

  it('switches between Számla adatok and Számlatételek tabs', () => {
    render(<ManualInvoiceCreateDialog {...defaultProps} />);

    const itemsTab = screen.getByRole('tab', { name: /Számlatételek/i });
    fireEvent.keyDown(itemsTab, { key: 'Enter', code: 'Enter' });

    expect(screen.getByText(/Nincsenek rögzített számlatételek/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Új tétel hozzáadása/i })).toBeInTheDocument();
  });

  it('adds a line item and updates the line item count badge', async () => {
    render(<ManualInvoiceCreateDialog {...defaultProps} />);

    const itemsTab = screen.getByRole('tab', { name: /Számlatételek/i });
    fireEvent.keyDown(itemsTab, { key: 'Enter', code: 'Enter' });

    const addBtn = screen.getByRole('button', { name: /Új tétel hozzáadása/i });
    fireEvent.click(addBtn);

    expect(screen.getByPlaceholderText('Tétel megnevezése')).toBeInTheDocument();
    // Badge and row index show "1"
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1);
  });

  it('validates required fields and shows toast when invoice number is empty', async () => {
    render(<ManualInvoiceCreateDialog {...defaultProps} />);

    const submitBtn = screen.getByRole('button', { name: 'Számla rögzítése' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Hiányzó adat',
          variant: 'destructive',
        })
      );
    });
  });

  it('successfully creates an invoice when valid data is entered', async () => {
    render(<ManualInvoiceCreateDialog {...defaultProps} />);

    // Fill bizonylatsorszam
    const numInput = screen.getByLabelText(/Bizonylatsorszám/i);
    fireEvent.change(numInput, { target: { value: 'TEST-INV-2026-001' } });

    // Fill partner
    const eladoInput = screen.getByLabelText(/Eladó neve/i);
    fireEvent.change(eladoInput, { target: { value: 'Acme Test Kft.' } });

    // Click submit
    const submitBtn = screen.getByRole('button', { name: 'Számla rögzítése' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Számla sikeresen rögzítve',
        })
      );
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['invoices'] });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['submittedInvoices'] });
      expect(defaultProps.onSuccess).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });
});
