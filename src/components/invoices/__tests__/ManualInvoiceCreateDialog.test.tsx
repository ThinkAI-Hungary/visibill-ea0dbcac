import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ManualInvoiceCreateDialog } from '../ManualInvoiceCreateDialog';

const mockToast = vi.fn();
const mockInvalidateQueries = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();
const mockStorageRemove = vi.fn().mockResolvedValue({ data: null, error: null });

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
        remove: vi.fn((...args: any[]) => mockStorageRemove(...args)),
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
    render(<ManualInvoiceCreateDialog {...defaultProps} companyName="ThinkAI Hungary Kft." />);

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
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          bizonylatsorszam: 'TEST-INV-2026-001',
          elado_nev: 'Acme Test Kft.',
          vevo_nev: 'ThinkAI Hungary Kft.',
          company_id: 'company-uuid-1',
        })
      );
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['invoices'] });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['submittedInvoices'] });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['general_ledger'] });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['glBalances'] });
      expect(defaultProps.onSuccess).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it('guarantees neither elado_nev nor vevo_nev is null on insert even when companyName is empty', async () => {
    render(<ManualInvoiceCreateDialog {...defaultProps} companyName="" />);

    const numInput = screen.getByLabelText(/Bizonylatsorszám/i);
    fireEvent.change(numInput, { target: { value: 'TEST-INV-FALLBACK' } });

    const eladoInput = screen.getByLabelText(/Eladó neve/i);
    fireEvent.change(eladoInput, { target: { value: 'Supplier Partner' } });

    const submitBtn = screen.getByRole('button', { name: 'Számla rögzítése' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          elado_nev: 'Supplier Partner',
          vevo_nev: 'Saját cég',
        })
      );
    });
  });

  it('automatically calculates header totals from line items when saving', async () => {
    render(<ManualInvoiceCreateDialog {...defaultProps} companyName="ThinkAI Hungary Kft." />);

    const numInput = screen.getByLabelText(/Bizonylatsorszám/i);
    fireEvent.change(numInput, { target: { value: 'INV-WITH-ITEMS' } });

    const eladoInput = screen.getByLabelText(/Eladó neve/i);
    fireEvent.change(eladoInput, { target: { value: 'Vendor Corp' } });

    // Switch to items tab and add an item
    const itemsTab = screen.getByRole('tab', { name: /Számlatételek/i });
    fireEvent.keyDown(itemsTab, { key: 'Enter', code: 'Enter' });

    const addBtn = screen.getByRole('button', { name: /Új tétel hozzáadása/i });
    fireEvent.click(addBtn);

    // Set unit price = 1000, quantity = 2 -> net 2000, 27% vat = 540, gross = 2540
    const priceInput = screen.getByPlaceholderText('0.00');
    fireEvent.change(priceInput, { target: { value: '1000' } });

    const submitBtn = screen.getByRole('button', { name: 'Számla rögzítése' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          adoalap_osszesen: 1000,
          afa_osszeg_osszesen: 270,
          brutto_vegosszeg: 1270,
          fizetendo_osszeg: 1270,
        })
      );
    });
  });

  it('marks invoice as fizetve: true when Kifizetett számla checkbox is checked', async () => {
    render(<ManualInvoiceCreateDialog {...defaultProps} companyName="ThinkAI Hungary Kft." />);

    const numInput = screen.getByLabelText(/Bizonylatsorszám/i);
    fireEvent.change(numInput, { target: { value: 'INV-ALREADY-PAID' } });

    const eladoInput = screen.getByLabelText(/Eladó neve/i);
    fireEvent.change(eladoInput, { target: { value: 'Paid Supplier' } });

    // Check "Kifizetett számla"
    const paidCheckbox = screen.getByRole('checkbox', { name: /Kifizetett számla/i });
    fireEvent.click(paidCheckbox);

    const submitBtn = screen.getByRole('button', { name: 'Számla rögzítése' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          bizonylatsorszam: 'INV-ALREADY-PAID',
          fizetve: true,
          is_manual_payment: true,
        })
      );
    });
  });

  it('cleans up uploaded file from storage if invoice insertion fails', async () => {
    // Make supabase insert fail
    mockInsert.mockImplementationOnce(() => {
      throw new Error('Database insert failed');
    });

    render(<ManualInvoiceCreateDialog {...defaultProps} companyName="ThinkAI Hungary Kft." />);

    const numInput = screen.getByLabelText(/Bizonylatsorszám/i);
    fireEvent.change(numInput, { target: { value: 'INV-STORAGE-CLEANUP' } });

    const eladoInput = screen.getByLabelText(/Eladó neve/i);
    fireEvent.change(eladoInput, { target: { value: 'Any Partner' } });

    // Simulate file drop
    const dropzone = screen.getByTestId('dropzone-input');
    const file = new File(['dummy-content'], 'test-invoice.pdf', { type: 'application/pdf' });
    fireEvent.change(dropzone, { target: { files: [file] } });

    const submitBtn = screen.getByRole('button', { name: 'Számla rögzítése' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockStorageRemove).toHaveBeenCalledWith([expect.stringContaining('test-invoice.pdf')]);
    });
  });

  it('locks buyer input for INBOUND invoices and does not allow autocomplete/search on it', () => {
    render(<ManualInvoiceCreateDialog {...defaultProps} initialDirection="INBOUND" companyName="ThinkAI Hungary Kft." />);

    const buyerInput = document.getElementById('create-vevo') as HTMLInputElement;
    expect(buyerInput).toBeInTheDocument();
    expect(buyerInput).toBeDisabled();
    expect(buyerInput.value).toBe('ThinkAI Hungary Kft.');

    // Seller input should be enabled autocomplete
    const sellerInput = document.getElementById('create-elado') as HTMLInputElement;
    expect(sellerInput).toBeInTheDocument();
    expect(sellerInput).not.toBeDisabled();
  });

  it('locks seller input for OUTBOUND invoices and does not allow autocomplete/search on it', () => {
    render(<ManualInvoiceCreateDialog {...defaultProps} initialDirection="OUTBOUND" companyName="ThinkAI Hungary Kft." />);

    const sellerInput = document.getElementById('create-elado') as HTMLInputElement;
    expect(sellerInput).toBeInTheDocument();
    expect(sellerInput).toBeDisabled();
    expect(sellerInput.value).toBe('ThinkAI Hungary Kft.');

    // Buyer input should be enabled autocomplete
    const buyerInput = document.getElementById('create-vevo') as HTMLInputElement;
    expect(buyerInput).toBeInTheDocument();
    expect(buyerInput).not.toBeDisabled();
  });

  it('renders simplified Kifizetett számla checkbox without explanatory subtext', () => {
    render(<ManualInvoiceCreateDialog {...defaultProps} companyName="ThinkAI Hungary Kft." />);

    expect(screen.getByRole('checkbox', { name: /Kifizetett számla/i })).toBeInTheDocument();
    expect(screen.queryByText(/Jelöld be, ha a számla már ki lett fizetve/i)).not.toBeInTheDocument();
  });
});

