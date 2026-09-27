import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavInvoiceRow } from '../components/table/NavInvoiceRow';
import { SubmittedInvoiceRow } from '../components/table/SubmittedInvoiceRow';
import type { NavInvoice, SubmittedInvoice } from '../types';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      update: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    }),
  },
}));

vi.mock('@/contexts/CompanyContext', () => ({
  useCompany: () => ({
    selectedCompany: { id: 'comp-1', tax_number: '12345678', country_code: 'HU' },
  }),
  useOptionalCompany: () => ({
    selectedCompany: { id: 'comp-1', tax_number: '12345678', country_code: 'HU' },
  }),
}));

const mockToggleSelectRow = vi.fn();
const mockSetSelectedInvoiceIds = vi.fn();
const mockSetSelectedSubmittedIds = vi.fn();
const mockSetLastViewedInvoiceId = vi.fn();
const mockSetExpandedRowIds = vi.fn();
const mockOnRowClick = vi.fn();

let mockContextState = {
  activeTab: 'OUTBOUND',
  companyId: 'comp-1',
  selectedCompany: { id: 'comp-1', tax_number: '12345678', country_code: 'HU' },
  categories: [],
  projects: [],
  writable: true,
  selectedInvoiceIds: new Set<string>(['nav-1']),
  selectedSubmittedIds: new Set<string>(['sub-1']),
  setSelectedInvoiceIds: mockSetSelectedInvoiceIds,
  setSelectedSubmittedIds: mockSetSelectedSubmittedIds,
  setExpandedRowIds: mockSetExpandedRowIds,
  toggleSelectRow: mockToggleSelectRow,
  expandedRowIds: new Set<string>(),
  lastViewedInvoiceId: null as string | null,
  setLastViewedInvoiceId: mockSetLastViewedInvoiceId,
  setSelectedInvoice: vi.fn(),
  setImageDialogOpen: vi.fn(),
  setEditDialogOpen: vi.fn(),
  setSelectedSubmittedForItems: vi.fn(),
  setSubmittedItemsDialogOpen: vi.fn(),
  setSelectedNavInvoice: vi.fn(),
  setItemsDialogOpen: vi.fn(),
  setInvoiceParam: vi.fn(),
  linkedInvoicesLoading: false,
  linkedInvoicesMap: { byBizonylat: new Map(), byReference: new Map() },
  invalidateInvoiceData: vi.fn(),
  setApprovalDialogOpen: vi.fn(),
  setSelectedInvoiceForApproval: vi.fn(),
  setSuggestedLinkDialogOpen: vi.fn(),
  setSelectedSuggestedLinkPair: vi.fn(),
  getPaymentMethodLabel: (m: string) => m,
  getInvoicePartnerName: () => 'Test Partner',
  getPartnerTaxNumber: () => null,
  getNettingGroup: () => null,
  nettingInvoiceIds: new Set<string>(),
  navIdToCourierReportsMap: new Map(),
  handleCategoryChange: vi.fn(),
  handleProjectChange: vi.fn(),
};

vi.mock('../context/useInvoiceContext', () => ({
  useInvoiceContext: () => mockContextState,
}));

vi.mock('@/lib/companyJurisdiction', () => ({
  useCompanyJurisdiction: () => ({
    hasNavIntegration: true,
    defaultCurrency: 'HUF',
  }),
}));

const dummyNavInvoice: NavInvoice = {
  id: 'nav-2',
  company_id: 'comp-1',
  invoice_number: 'INV-2026-002',
  customer_name: 'Test Partner 2',
  supplier_name: 'Test Company',
  invoice_issue_date: '2026-08-01',
  payment_due_date: '2026-08-15',
  payment_method: 'TRANSFER',
  currency: 'HUF',
  invoice_gross_amount: 127000,
  invoice_net_amount: 100000,
  invoice_vat_amount: 27000,
  invoice_direction: 'OUTBOUND',
  matched_amount: 0,
  match_status: 'unmatched',
  is_netting_candidate: false,
} as any;

const dummySubInvoice: SubmittedInvoice = {
  id: 'sub-2',
  company_id: 'comp-1',
  bizonylatsorszam: 'SUB-2026-002',
  partner_name: 'Test Partner 2',
  kelt: '2026-08-01',
  fizetesi_hatarido: '2026-08-15',
  fizetesi_mod: 'Átutalás',
  penznem: 'HUF',
  brutto: 50000,
  netto: 39370,
  afa: 10630,
  match_status: 'unmatched',
} as any;

function renderInTable(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <table>
        <tbody>{ui}</tbody>
      </table>
    </QueryClientProvider>
  );
}

describe('Invoices Multiselect & Row Click Behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('NavInvoiceRow: clicking the checkbox calls toggleSelectRow and does NOT overwrite selection with single id', () => {
    renderInTable(
      <NavInvoiceRow
        invoice={dummyNavInvoice}
        navToSubmittedMap={new Map()}
        navToSuggestedSubmittedMap={new Map()}
        pageInvoiceIdToTransactionsMap={new Map()}
        onRowClick={mockOnRowClick}
        onToggleExclude={vi.fn()}
      />
    );

    const checkbox = screen.getByRole('checkbox', { name: /INV-2026-002 kijelölése/i });
    fireEvent.click(checkbox);

    expect(mockToggleSelectRow).toHaveBeenCalledWith('nav-2', false);
    // CRITICAL: It MUST NOT wipe out existing selections by calling setSelectedInvoiceIds(new Set(['nav-2']))
    expect(mockSetSelectedInvoiceIds).not.toHaveBeenCalled();
    // And onRowClick must not be triggered by clicking the checkbox
    expect(mockOnRowClick).not.toHaveBeenCalled();
  });

  it('NavInvoiceRow: Shift+clicking the checkbox passes shiftKey=true to toggleSelectRow', () => {
    renderInTable(
      <NavInvoiceRow
        invoice={dummyNavInvoice}
        navToSubmittedMap={new Map()}
        navToSuggestedSubmittedMap={new Map()}
        pageInvoiceIdToTransactionsMap={new Map()}
        onRowClick={mockOnRowClick}
        onToggleExclude={vi.fn()}
      />
    );

    const checkbox = screen.getByRole('checkbox', { name: /INV-2026-002 kijelölése/i });
    fireEvent.click(checkbox, { shiftKey: true });

    expect(mockToggleSelectRow).toHaveBeenCalledWith('nav-2', true);
    expect(mockSetSelectedInvoiceIds).not.toHaveBeenCalled();
  });

  it('NavInvoiceRow: normal row click focuses the row without wiping out existing multiselections', () => {
    renderInTable(
      <NavInvoiceRow
        invoice={dummyNavInvoice}
        navToSubmittedMap={new Map()}
        navToSuggestedSubmittedMap={new Map()}
        pageInvoiceIdToTransactionsMap={new Map()}
        onRowClick={mockOnRowClick}
        onToggleExclude={vi.fn()}
      />
    );

    const row = screen.getByRole('row');
    fireEvent.click(row);

    expect(mockSetLastViewedInvoiceId).toHaveBeenCalledWith('nav-2');
    expect(mockOnRowClick).toHaveBeenCalledWith('nav-2', expect.anything());
    // Normal row click should NOT wipe out selection
    expect(mockSetSelectedInvoiceIds).not.toHaveBeenCalled();
  });

  it('NavInvoiceRow: Ctrl/Cmd click on row toggles selection', () => {
    renderInTable(
      <NavInvoiceRow
        invoice={dummyNavInvoice}
        navToSubmittedMap={new Map()}
        navToSuggestedSubmittedMap={new Map()}
        pageInvoiceIdToTransactionsMap={new Map()}
        onRowClick={mockOnRowClick}
        onToggleExclude={vi.fn()}
      />
    );

    const row = screen.getByRole('row');
    fireEvent.click(row, { ctrlKey: true });

    expect(mockToggleSelectRow).toHaveBeenCalledWith('nav-2', false);
  });

  it('SubmittedInvoiceRow: clicking the checkbox calls toggleSelectRow and does not overwrite selection', () => {
    renderInTable(
      <SubmittedInvoiceRow
        invoice={dummySubInvoice}
        submittedToNavMap={new Map()}
        pageInvoiceIdToTransactionsMap={new Map()}
        onRowClick={mockOnRowClick}
        onToggleExclude={vi.fn()}
      />
    );

    const checkbox = screen.getByRole('checkbox', { name: /SUB-2026-002 kijelölése/i });
    fireEvent.click(checkbox);

    expect(mockToggleSelectRow).toHaveBeenCalledWith('sub-2', false);
    expect(mockSetSelectedSubmittedIds).not.toHaveBeenCalled();
    expect(mockOnRowClick).not.toHaveBeenCalled();
  });
});
