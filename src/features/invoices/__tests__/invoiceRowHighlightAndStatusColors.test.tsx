import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavInvoiceRow } from '../components/table/NavInvoiceRow';
import { SubmittedInvoiceRow } from '../components/table/SubmittedInvoiceRow';
import type { NavInvoice, SubmittedInvoice } from '../../types';

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

const mockSetLastViewedInvoiceId = vi.fn();
const mockToggleSelectRow = vi.fn();
const mockOnRowClick = vi.fn();

let mockContextState = {
  activeTab: 'OUTBOUND',
  companyId: 'comp-1',
  selectedCompany: { id: 'comp-1', tax_number: '12345678' },
  categories: [],
  projects: [],
  writable: true,
  selectedInvoiceIds: new Set<string>(),
  selectedNavIds: new Set<string>(),
  selectedSubmittedIds: new Set<string>(),
  toggleSelectRow: mockToggleSelectRow,
  expandedRowIds: new Set<string>(),
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
  getPaymentMethodLabel: (val: string) => val,
  getInvoicePartnerName: () => 'Test Partner',
  getPartnerTaxNumber: () => null,
  getNettingGroup: () => null,
  nettingInvoiceIds: new Set<string>(),
  navIdToCourierReportsMap: new Map(),
  setSuggestedLinkDialogOpen: vi.fn(),
  setSelectedSuggestedLinkPair: vi.fn(),
  lastViewedInvoiceId: null as string | null,
  setLastViewedInvoiceId: mockSetLastViewedInvoiceId,
  handleCategoryChange: vi.fn(),
  handleProjectChange: vi.fn(),
};

vi.mock('../context/useInvoiceContext', () => ({
  useInvoiceContext: () => mockContextState,
}));

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

describe('Invoice Table Row Status Colors & Focus Highlighting', () => {
  const unmatchedNavInvoice: NavInvoice = {
    id: 'nav-unmatched-1',
    company_id: 'comp-1',
    invoice_number: 'INV-UNMATCHED-1',
    invoice_issue_date: '2026-08-01',
    payment_method: 'TRANSFER',
    currency: 'HUF',
    invoice_gross_amount: 100000,
    invoice_net_amount: 78740,
    invoice_vat_amount: 21260,
    created_at: '2026-08-01',
  } as any;

  const paidNavInvoice: NavInvoice = {
    id: 'nav-paid-1',
    company_id: 'comp-1',
    invoice_number: 'INV-PAID-1',
    invoice_issue_date: '2026-08-01',
    payment_method: 'TRANSFER',
    currency: 'HUF',
    invoice_gross_amount: 100000,
    paid: true,
    match_status: 'matched',
    created_at: '2026-08-01',
  } as any;

  it('keeps red unmatched background when row is focused (lastViewedInvoiceId)', () => {
    mockContextState.lastViewedInvoiceId = 'nav-unmatched-1';
    mockContextState.selectedInvoiceIds = new Set();

    renderInTable(
      <NavInvoiceRow
        invoice={unmatchedNavInvoice}
        navToSubmittedMap={new Map()}
        navToSuggestedSubmittedMap={new Map()}
        pageInvoiceIdToTransactionsMap={new Map()}
        onRowClick={mockOnRowClick}
        onToggleExclude={vi.fn()}
      />
    );

    const row = screen.getByRole('row');
    // Must keep unmatched background
    expect(row.className).toContain('bg-[var(--row-unmatched-bg)]');
    // Must have focus border and ring
    expect(row.className).toContain('border-l-primary');
    expect(row.className).toContain('ring-2');
    // Must NOT have solid background overriding the status
    expect(row.className).not.toContain('bg-primary/15');
    expect(row.className).not.toContain('dark:bg-primary/25');
  });

  it('keeps red unmatched background when row is selected via checkbox', () => {
    mockContextState.lastViewedInvoiceId = null;
    mockContextState.selectedInvoiceIds = new Set(['nav-unmatched-1']);

    renderInTable(
      <NavInvoiceRow
        invoice={unmatchedNavInvoice}
        navToSubmittedMap={new Map()}
        navToSuggestedSubmittedMap={new Map()}
        pageInvoiceIdToTransactionsMap={new Map()}
        onRowClick={mockOnRowClick}
        onToggleExclude={vi.fn()}
      />
    );

    const row = screen.getByRole('row');
    // Must keep unmatched background
    expect(row.className).toContain('bg-[var(--row-unmatched-bg)]');
    // Must have selection indicator border and ring
    expect(row.className).toContain('border-l-primary/60');
    expect(row.className).toContain('ring-1');
    // Must NOT strip unmatched background
    expect(row.className).not.toContain('bg-primary/10');
  });

  it('preserves matched green background when paid invoice is focused', () => {
    mockContextState.lastViewedInvoiceId = 'nav-paid-1';
    mockContextState.selectedNavIds = new Set();

    const txMap = new Map();
    txMap.set('nav-paid-1', [{ id: 'tx-123' }]);

    renderInTable(
      <NavInvoiceRow
        invoice={paidNavInvoice}
        navToSubmittedMap={new Map()}
        navToSuggestedSubmittedMap={new Map()}
        pageInvoiceIdToTransactionsMap={txMap}
        onRowClick={mockOnRowClick}
        onToggleExclude={vi.fn()}
      />
    );

    const row = screen.getByRole('row');
    expect(row.className).toContain('bg-[var(--row-matched-bg)]');
    expect(row.className).toContain('border-l-primary');
    expect(row.className).not.toContain('bg-primary/15');
  });

  it('calls setLastViewedInvoiceId when user clicks the row', () => {
    mockContextState.lastViewedInvoiceId = null;
    mockSetLastViewedInvoiceId.mockClear();
    mockOnRowClick.mockClear();

    renderInTable(
      <NavInvoiceRow
        invoice={unmatchedNavInvoice}
        navToSubmittedMap={new Map()}
        navToSuggestedSubmittedMap={new Map()}
        pageInvoiceIdToTransactionsMap={new Map()}
        onRowClick={mockOnRowClick}
        onToggleExclude={vi.fn()}
      />
    );

    const row = screen.getByRole('row');
    fireEvent.click(row);

    expect(mockSetLastViewedInvoiceId).toHaveBeenCalledWith('nav-unmatched-1');
    expect(mockOnRowClick).toHaveBeenCalledWith('nav-unmatched-1', expect.anything());
  });

  it('preserves matching status colors on SubmittedInvoiceRow when focused or selected', () => {
    const unmatchedSubInvoice: SubmittedInvoice = {
      id: 'sub-unmatched-1',
      company_id: 'comp-1',
      bizonylatsorszam: 'SUB-001',
      kelt: '2026-08-01',
      fizetesi_mod: 'Átutalás',
      penznem: 'HUF',
      brutto: 50000,
      netto: 39370,
      afa: 10630,
      match_status: 'unmatched',
    } as any;

    mockContextState.lastViewedInvoiceId = 'sub-unmatched-1';
    mockContextState.selectedSubmittedIds = new Set();

    renderInTable(
      <SubmittedInvoiceRow
        invoice={unmatchedSubInvoice}
        submittedToNavMap={new Map()}
        pageInvoiceIdToTransactionsMap={new Map()}
        onRowClick={mockOnRowClick}
        onToggleExclude={vi.fn()}
      />
    );

    const row = screen.getByRole('row');
    expect(row.className).toContain('bg-[var(--row-unmatched-bg)]');
    expect(row.className).toContain('border-l-primary');
    expect(row.className).not.toContain('bg-primary/15');
  });
});
