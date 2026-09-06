import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import InvoiceFullEditDialog from '../InvoiceFullEditDialog';

// Mock AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'test-user-123' } }),
}));

// Mock Supabase
const mockDelete = vi.fn().mockReturnThis();
const mockUpdate = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockSelect = vi.fn().mockReturnThis();
const mockOrder = vi.fn().mockReturnThis();
const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });
const mockMaybeSingle = vi.fn().mockResolvedValue({
  data: {
    image_url: 'https://example.com/invoice.pdf',
    melleklet_url: null,
    invoice_uploads_id: 'upload-uuid-123',
  },
  error: null,
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
      update: mockUpdate,
      delete: mockDelete,
      eq: mockEq,
      order: mockOrder,
      single: mockSingle,
      maybeSingle: mockMaybeSingle,
    })),
    storage: {
      from: vi.fn(() => ({
        remove: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    },
  },
}));

describe('InvoiceFullEditDialog — Számlakép törlése flow', () => {
  let queryClient: QueryClient;

  const mockInvoice = {
    id: 'inv-test-456',
    bizonylatsorszam: 'TEST-2026/001',
    kibocsatas_datuma: '2026-07-22',
    teljesites_datuma: '2026-07-22',
    elado_nev: 'ShopExpert Hungary Kft.',
    vevo_nev: 'FAKOV Kft',
    adoalap_osszesen: 10000,
    brutto_vegosszeg: 12700,
    afa_osszeg_osszesen: 2700,
    penznem: 'HUF',
    category_id: null,
    project_id: null,
    image_url: 'https://example.com/invoice.pdf',
    melleklet_url: null,
    invoice_uploads_id: 'upload-uuid-123',
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  it('renders "Számlakép törlése" button in the dialog footer and it is enabled when invoice has image/file', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <InvoiceFullEditDialog
          invoice={mockInvoice}
          categories={[]}
          projects={[]}
          open={true}
          onClose={vi.fn()}
          onSave={vi.fn()}
        />
      </QueryClientProvider>
    );

    const deleteBtn = screen.getByRole('button', { name: /Számlakép törlése/i });
    expect(deleteBtn).toBeDefined();
    expect(deleteBtn.hasAttribute('disabled')).toBe(false);
  });

  it('opens confirmation warning AlertDialog with two options when clicking "Számlakép törlése"', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <InvoiceFullEditDialog
          invoice={mockInvoice}
          categories={[]}
          projects={[]}
          open={true}
          onClose={vi.fn()}
          onSave={vi.fn()}
        />
      </QueryClientProvider>
    );

    const deleteBtn = screen.getByRole('button', { name: /Számlakép törlése/i });
    fireEvent.click(deleteBtn);

    // Confirmation dialog should be visible with both options
    expect(screen.getByText(/Válaszd ki a számlakép törlésének módját:/i)).toBeDefined();
    expect(screen.getByText(/Csak a számlasor törlése/i)).toBeDefined();
    expect(screen.getByText(/Számlasor és feltöltött fájl törlése/i)).toBeDefined();
    expect(screen.getByText(/Ez a művelet nem vonható vissza\./i)).toBeDefined();
  });

  it('deletes only invoice row when clicking "Csak a számlasor törlése"', async () => {
    const mockOnSave = vi.fn();
    const mockOnClose = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <InvoiceFullEditDialog
          invoice={mockInvoice}
          categories={[]}
          projects={[]}
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      </QueryClientProvider>
    );

    // Open warning dialog
    fireEvent.click(screen.getByRole('button', { name: /Számlakép törlése/i }));

    // Click Option 1
    const option1Btn = screen.getByText(/Csak a számlasor törlése/i).closest('button')!;
    fireEvent.click(option1Btn);

    // Verify invoice deletion call
    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalled();
    });
    expect(mockEq).toHaveBeenCalledWith('id', 'inv-test-456');
  });

  it('deletes both invoice row and upload file when clicking "Számlasor és feltöltött fájl törlése"', async () => {
    const mockOnSave = vi.fn();
    const mockOnClose = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <InvoiceFullEditDialog
          invoice={mockInvoice}
          categories={[]}
          projects={[]}
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      </QueryClientProvider>
    );

    // Open warning dialog
    fireEvent.click(screen.getByRole('button', { name: /Számlakép törlése/i }));

    // Click Option 2
    const option2Btn = screen.getByText(/Számlasor és feltöltött fájl törlése/i).closest('button')!;
    fireEvent.click(option2Btn);

    // Verify invoice deletion call
    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalled();
    });
    expect(mockEq).toHaveBeenCalledWith('id', 'inv-test-456');
  });
});
