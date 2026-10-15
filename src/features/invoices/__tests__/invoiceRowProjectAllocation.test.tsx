import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavInvoiceRow } from '../components/table/NavInvoiceRow';
import type { NavInvoice } from '../types';
import type { InvoiceProjectSummary } from '../../../lib/invoiceProjectSummary';

vi.mock('@/contexts/CompanyContext', () => ({
  useCompany: () => ({
    selectedCompany: { id: 'comp-1', tax_number: '12345678', country_code: 'HU' },
  }),
  useOptionalCompany: () => ({
    selectedCompany: { id: 'comp-1', tax_number: '12345678', country_code: 'HU' },
  }),
}));

const mockProjects = [
  { id: 'proj-1', name: 'ART FLÓRA', color: '#10b981' },
  { id: 'proj-2', name: 'CSOBI Kft.', color: '#3b82f6' },
  { id: 'proj-3', name: 'Kelevill FZ Kft.', color: '#f59e0b' },
];

const mockContextState = {
  activeTab: 'OUTBOUND',
  companyId: 'comp-1',
  categories: [],
  projects: mockProjects,
  writable: true,
  selectedInvoiceIds: new Set<string>(),
  toggleSelectRow: vi.fn(),
  expandedRowIds: new Set<string>(),
  toggleRowExpanded: vi.fn(),
  setSelectedInvoice: vi.fn(),
  setImageDialogOpen: vi.fn(),
  setEditDialogOpen: vi.fn(),
  setSelectedNavInvoice: vi.fn(),
  setItemsDialogOpen: vi.fn(),
  setInvoiceParam: vi.fn(),
  linkedInvoicesLoading: false,
  linkedInvoicesMap: { byBizonylat: new Map(), byReference: new Map() },
  invalidateInvoiceData: vi.fn(),
  setApprovalDialogOpen: vi.fn(),
  setSelectedInvoiceForApproval: vi.fn(),
  getPaymentMethodLabel: (val: string) => val,
  getInvoicePartnerName: () => 'TURUL MARKET Kft',
  getPartnerTaxNumber: () => null,
  getNettingGroup: () => null,
  nettingInvoiceIds: new Set<string>(),
  navIdToCourierReportsMap: new Map(),
  setSuggestedLinkDialogOpen: vi.fn(),
  setSelectedSuggestedLinkPair: vi.fn(),
  lastViewedInvoiceId: null as string | null,
  setLastViewedInvoiceId: vi.fn(),
  handleCategoryChange: vi.fn(),
  handleProjectChange: vi.fn(),
};

vi.mock('../context/useInvoiceContext', () => ({
  useInvoiceContext: () => mockContextState,
}));

vi.mock('@/hooks/useCompanyJurisdiction', () => ({
  useCompanyJurisdiction: () => ({ defaultCurrency: 'HUF' }),
}));

vi.mock('@/hooks/useSzamlazzSync', () => ({
  useSzamlazzStatus: () => ({ data: { hasAgentKey: false } }),
  useSyncSzamlazzOutbound: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('../../hooks/useInvoiceAttachmentCounts', () => ({
  useInvoiceAttachmentCounts: () => ({ data: {} }),
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

describe('NavInvoiceRow Project Allocation Rendering', () => {
  const testInvoice: NavInvoice = {
    id: '012367d7-5f06-4f31-84d6-545c4b240a24',
    company_id: 'comp-1',
    invoice_number: 'E-TXLG-2026-340',
    invoice_issue_date: '2026-10-01',
    invoice_delivery_date: '2026-10-08',
    payment_method: 'TRANSFER',
    currency: 'HUF',
    invoice_gross_amount: 190500,
    invoice_net_amount: 150000,
    invoice_vat_amount: 40500,
    paid: false,
    invoice_direction: 'OUTBOUND',
    supplier_name: 'TAXOLOGY Kft.',
    customer_name: 'TURUL MARKET Kft',
    project_id: null,
  };

  it('renders multi-project allocation badge when invoice items are split across 3 projects', () => {
    const multiProjectSummary: InvoiceProjectSummary = {
      invoiceId: testInvoice.id,
      projectIds: ['proj-1', 'proj-2', 'proj-3'],
      singleProjectId: null,
      hasMultiProjects: true,
      totalProjectCount: 3,
      allocations: [
        { projectId: 'proj-1', percentage: 33.34, amount: 63513 },
        { projectId: 'proj-2', percentage: 33.33, amount: 63494 },
        { projectId: 'proj-3', percentage: 33.33, amount: 63494 },
      ],
    };

    renderInTable(
      <NavInvoiceRow
        invoice={testInvoice}
        navToSubmittedMap={new Map()}
        pageInvoiceIdToTransactionsMap={new Map()}
        onRowClick={vi.fn()}
        onToggleExclude={vi.fn()}
        itemProjectSummary={multiProjectSummary}
      />
    );

    // Expect the badge button "% 3 projekt" to be rendered
    expect(screen.getByText('3 projekt')).toBeInTheDocument();
    // Expect the count badge "3" to be rendered
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders single project dropdown when invoice has no multi-project allocation', () => {
    renderInTable(
      <NavInvoiceRow
        invoice={testInvoice}
        navToSubmittedMap={new Map()}
        pageInvoiceIdToTransactionsMap={new Map()}
        onRowClick={vi.fn()}
        onToggleExclude={vi.fn()}
      />
    );

    // Multi-project badge should NOT be in the document
    expect(screen.queryByText('3 projekt')).not.toBeInTheDocument();
  });
});
