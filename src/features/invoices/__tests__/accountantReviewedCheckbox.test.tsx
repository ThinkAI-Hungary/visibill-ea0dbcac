import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavInvoiceRow } from '../components/table/NavInvoiceRow';
import { SubmittedInvoiceRow } from '../components/table/SubmittedInvoiceRow';

const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ error: null }),
});
const mockFrom = vi.fn().mockReturnValue({
  update: mockUpdate,
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
  },
}));

vi.mock('@/contexts/CompanyContext', () => ({
  useCompany: () => ({
    selectedCompany: { id: 'comp-1', tax_number: '12345678' },
  }),
  useOptionalCompany: () => ({
    selectedCompany: { id: 'comp-1', tax_number: '12345678' },
  }),
}));

const mockInvalidateInvoiceData = vi.fn();

vi.mock('../context/useInvoiceContext', () => ({
  useInvoiceContext: () => ({
    activeTab: 'INBOUND',
    companyId: 'comp-1',
    selectedCompany: { id: 'comp-1', tax_number: '12345678' },
    categories: [],
    projects: [],
    writable: true,
    selectedInvoiceIds: new Set(),
    selectedSubmittedIds: new Set(),
    toggleSelectRow: vi.fn(),
    expandedRowIds: new Set(),
    setSelectedInvoice: vi.fn(),
    setImageDialogOpen: vi.fn(),
    setEditDialogOpen: vi.fn(),
    setSelectedSubmittedForItems: vi.fn(),
    setSubmittedItemsDialogOpen: vi.fn(),
    setInvoiceParam: vi.fn(),
    linkedInvoicesLoading: false,
    invalidateInvoiceData: mockInvalidateInvoiceData,
    setApprovalDialogOpen: vi.fn(),
    setSelectedInvoiceForApproval: vi.fn(),
    getPaymentMethodLabel: (val: string) => val,
    getInvoicePartnerName: () => 'Test Partner',
    activePresetId: null,
    nettingInvoiceIds: new Set(),
    navIdToCourierReportsMap: new Map(),
    lastViewedInvoiceId: null,
    setLastViewedInvoiceId: vi.fn(),
  }),
}));

describe('Accountant Reviewed (Kontírozott) Checkbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates nav_invoices when NavInvoiceRow checkbox is clicked', async () => {
    const mockInvoice: any = {
      id: 'nav-inv-1',
      invoice_number: 'NAV-2026-001',
      invoice_direction: 'INBOUND',
      invoice_issue_date: '2026-09-01',
      invoice_delivery_date: '2026-09-01',
      invoice_net_amount: 1000,
      invoice_gross_amount: 1270,
      invoice_vat_amount: 270,
      supplier_name: 'Test Supplier',
      customer_name: 'Test Customer',
      currency: 'HUF',
      payment_method: 'TRANSFER',
      paid: false,
      submitted: false,
      is_accountant_reviewed: false,
    };

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <table>
          <tbody>
            <NavInvoiceRow
              invoice={mockInvoice}
              navToSubmittedMap={new Map()}
              pageInvoiceIdToTransactionsMap={new Map()}
              onRowClick={vi.fn()}
              onToggleExclude={vi.fn()}
            />
          </tbody>
        </table>
      </QueryClientProvider>
    );

    const checkbox = screen.getByRole('checkbox', { name: /kikontírozva/i });
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toHaveAttribute('data-state', 'unchecked');

    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('nav_invoices');
      expect(mockUpdate).toHaveBeenCalledWith({ is_accountant_reviewed: true });
      expect(mockInvalidateInvoiceData).toHaveBeenCalled();
    });
  });

  it('updates invoices when SubmittedInvoiceRow checkbox is clicked', async () => {
    const mockSubmittedInvoice: any = {
      id: 'sub-inv-1',
      bizonylatsorszam: 'SUB-2026-001',
      kibocsatas_datuma: '2026-09-01',
      teljesites_datuma: '2026-09-01',
      elado_nev: 'Supplier A',
      vevo_nev: 'Customer B',
      adoalap_osszesen: 2000,
      brutto_vegosszeg: 2540,
      afa_osszeg_osszesen: 540,
      penznem: 'HUF',
      fizetesi_mod: 'Átutalás',
      is_accountant_reviewed: false,
    };

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <table>
          <tbody>
            <SubmittedInvoiceRow
              invoice={mockSubmittedInvoice}
              submittedToNavMap={new Map()}
              pageInvoiceIdToTransactionsMap={new Map()}
              onRowClick={vi.fn()}
              onToggleExclude={vi.fn()}
            />
          </tbody>
        </table>
      </QueryClientProvider>
    );

    const checkbox = screen.getByRole('checkbox', { name: /kikontírozva/i });
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toHaveAttribute('data-state', 'unchecked');

    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('invoices');
      expect(mockUpdate).toHaveBeenCalledWith({ is_accountant_reviewed: true });
      expect(mockInvalidateInvoiceData).toHaveBeenCalled();
    });
  });
});
