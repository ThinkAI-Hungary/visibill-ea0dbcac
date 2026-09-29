import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SubmittedInvoiceRow } from '../components/table/SubmittedInvoiceRow';
import type { SubmittedInvoice } from '@/hooks/useInvoiceData';
import { Table, TableBody } from '@/components/ui/table';

// Mock contexts
vi.mock('@/contexts/CompanyContext', () => ({
  useCompany: () => ({
    selectedCompany: { id: 'comp-1', name: 'Test Kft', country: 'HU' },
  }),
}));

vi.mock('@/features/invoices/context/useInvoiceContext', () => ({
  useInvoiceContext: () => ({
    activeTab: 'SUBMITTED_INBOUND',
    companyId: 'comp-1',
    selectedCompany: { id: 'comp-1', name: 'Test Kft', country: 'HU' },
    categories: [],
    projects: [],
    expandedRowIds: new Set(),
    selectedSubmittedIds: new Set(),
    toggleSelectRow: vi.fn(),
    setInvoiceParam: vi.fn(),
    linkedInvoicesLoading: false,
    linkedInvoicesMap: new Map(),
    invalidateInvoiceData: vi.fn(),
    setApprovalDialogOpen: vi.fn(),
    setSelectedInvoiceForApproval: vi.fn(),
    getPaymentMethodLabel: vi.fn(),
    lastViewedInvoiceId: null,
    setLastViewedInvoiceId: vi.fn(),
    toggleRowExpanded: vi.fn(),
  }),
}));

vi.mock('@/hooks/useCompanyJurisdiction', () => ({
  useCompanyJurisdiction: () => ({
    hasNavIntegration: true,
    defaultCurrency: 'HUF',
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: any) => {
      if (typeof fallback === 'string') return fallback;
      if (fallback && typeof fallback === 'object' && fallback.defaultValue) return fallback.defaultValue;
      return key;
    },
  }),
}));

function createSubmittedInvoice(overrides: Partial<SubmittedInvoice> = {}): SubmittedInvoice {
  return {
    id: 'sub-inv-1',
    bizonylatsorszam: 'TEST-2026-01',
    kibocsatas_datuma: '2026-09-01',
    teljesites_datuma: '2026-09-01',
    elado_nev: 'Belföldi Partner Kft',
    elado_vat_id: '12345678-2-42',
    vevo_nev: 'Test Kft',
    vevo_vat_id: '99999999-2-42',
    adoalap_osszesen: 100000,
    brutto_vegosszeg: 127000,
    afa_osszeg_osszesen: 27000,
    penznem: 'HUF',
    category_id: null,
    project_id: null,
    image_url: null,
    melleklet_url: null,
    invoice_direction: 'INBOUND',
    reference_number: null,
    fizetesi_mod: 'Átutalás',
    invoice_type: 'SZAMLA',
    nav_status: 'missing_nav',
    ...overrides,
  };
}

function renderRow(invoice: SubmittedInvoice) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <Table>
        <TableBody>
          <SubmittedInvoiceRow
            invoice={invoice}
            submittedToNavMap={new Map()}
            pageInvoiceIdToTransactionsMap={new Map()}
            onRowClick={vi.fn()}
            onToggleExclude={vi.fn()}
          />
        </TableBody>
      </Table>
    </QueryClientProvider>
  );
}

describe('SubmittedInvoiceRow NAV missing badge', () => {
  it('renders NAV missing warning badge for domestic invoice when nav_status is missing_nav', () => {
    const invoice = createSubmittedInvoice({
      elado_vat_id: '12345678-2-42',
      penznem: 'HUF',
      nav_status: 'missing_nav',
    });

    renderRow(invoice);

    const warningBtn = screen.getByRole('button', {
      name: /A számlaképhez nem sikerült NAV számlát párosítani! Kattintson a könyvelői jóváhagyáshoz./i,
    });
    expect(warningBtn).toBeDefined();
  });

  it('does NOT render NAV missing warning badge for foreign invoices (non-HU VAT ID)', () => {
    const foreignInvoice = createSubmittedInvoice({
      elado_vat_id: 'DE12345678',
      penznem: 'EUR',
      nav_status: 'missing_nav',
    });

    renderRow(foreignInvoice);

    const warningBtn = screen.queryByRole('button', {
      name: /A számlaképhez nem sikerült NAV számlát párosítani/i,
    });
    expect(warningBtn).toBeNull();
  });

  it('does NOT render NAV missing warning badge for foreign invoices with FOREIGN: prefix', () => {
    const foreignInvoice = createSubmittedInvoice({
      elado_vat_id: 'FOREIGN:googleireland',
      penznem: 'HUF',
      nav_status: 'missing_nav',
    });

    renderRow(foreignInvoice);

    const warningBtn = screen.queryByRole('button', {
      name: /A számlaképhez nem sikerült NAV számlát párosítani/i,
    });
    expect(warningBtn).toBeNull();
  });

  it('does NOT render NAV missing warning badge when nav_status is not_applicable', () => {
    const invoice = createSubmittedInvoice({
      nav_status: 'not_applicable',
    });

    renderRow(invoice);

    const warningBtn = screen.queryByRole('button', {
      name: /A számlaképhez nem sikerült NAV számlát párosítani/i,
    });
    expect(warningBtn).toBeNull();
  });
});
