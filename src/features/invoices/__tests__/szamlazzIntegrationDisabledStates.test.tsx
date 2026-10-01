import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InvoiceHeader } from '../components/header/InvoiceHeader';
import { NavInvoiceRow } from '../components/table/NavInvoiceRow';
import { Table, TableBody } from '@/components/ui/table';
import type { NavInvoice } from '../../types';

let mockSzamlazzStatus = {
  hasAgentKey: false,
  totalOutbound: 10,
  withImageCount: 0,
  pendingCount: 10,
};

vi.mock('@/hooks/useSzamlazzSync', () => ({
  useSzamlazzStatus: () => ({
    data: mockSzamlazzStatus,
    isLoading: false,
  }),
  useSyncSzamlazzOutbound: () => ({
    mutateAsync: vi.fn(),
  }),
}));

vi.mock('@/contexts/CompanyContext', () => ({
  useCompany: () => ({
    selectedCompany: { id: 'comp-1', name: 'Test Kft', tax_number: '12345678-1-42' },
  }),
  useOptionalCompany: () => ({
    selectedCompany: { id: 'comp-1', name: 'Test Kft', tax_number: '12345678-1-42' },
  }),
}));

vi.mock('@/components/vat/InvoiceVatCodeSelector', () => ({
  InvoiceVatCodeSelector: () => <div data-testid="vat-selector" />,
}));

vi.mock('@/components/invoices/InvoiceRulesDialog', () => ({
  InvoiceRulesDialog: () => null,
}));

vi.mock('@/components/invoices/SzamlazzSyncModal', () => ({
  SzamlazzSyncModal: () => null,
}));

vi.mock('@/features/invoices/context/useInvoiceContext', () => ({
  useInvoiceContext: () => ({
    companyId: 'comp-1',
    selectedCompany: { id: 'comp-1', name: 'Test Kft' },
    activeTab: 'OUTBOUND',
    setFilesDialogOpen: vi.fn(),
    setInvoiceParam: vi.fn(),
    openDataExportDialog: vi.fn(),
    categories: [],
    projects: [],
    nettingInvoiceIds: new Set(),
    getNettingGroup: vi.fn(),
    selectedInvoiceIds: new Set(),
    toggleSelectRow: vi.fn(),
    expandedRowIds: new Set(),
    getInvoicePartnerName: () => 'Test Partner',
    getPartnerTaxNumber: () => '12345678-1-42',
    getPaymentMethodLabel: () => 'Átutalás',
    handleCategoryChange: vi.fn(),
    handleProjectChange: vi.fn(),
    setSelectedInvoice: vi.fn(),
    setImageDialogOpen: vi.fn(),
    setSelectedNavInvoice: vi.fn(),
    setItemsDialogOpen: vi.fn(),
    linkedInvoicesLoading: false,
    linkedInvoicesMap: new Map(),
    invalidateInvoiceData: vi.fn(),
    navIdToCourierReportsMap: new Map(),
    setSuggestedLinkDialogOpen: vi.fn(),
    setSelectedSuggestedLinkPair: vi.fn(),
    lastViewedInvoiceId: null,
    setLastViewedInvoiceId: vi.fn(),
    toggleRowExpanded: vi.fn(),
    navSync: {
      canSync: true,
      syncState: { isSyncing: false },
      lastSyncTime: null,
      cooldownSeconds: 0,
      formatCooldown: () => '',
      syncInvoices: vi.fn(),
    },
  }),
}));

vi.mock('@/hooks/useCompanyJurisdiction', () => ({
  useCompanyJurisdiction: () => ({
    hasNavIntegration: false,
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

function createNavInvoice(overrides: Partial<NavInvoice> = {}): NavInvoice {
  return {
    id: 'nav-inv-1',
    invoice_number: 'E-TXLG-2026-001',
    invoice_issue_date: '2026-09-01',
    invoice_delivery_date: '2026-09-01',
    payment_due_date: '2026-09-15',
    invoice_net_amount: 10000,
    invoice_gross_amount: 12700,
    invoice_vat_amount: 2700,
    currency: 'HUF',
    supplier_name: 'Test Kft',
    customer_name: 'Vevő Kft',
    invoice_direction: 'OUTBOUND',
    payment_method: 'TRANSFER',
    ...overrides,
  } as NavInvoice;
}

describe('Számlázz.hu integration disabled states when not connected', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  describe('InvoiceHeader', () => {
    it('disables Számlázz.hu sync button and hides pending badge when hasAgentKey is false', () => {
      mockSzamlazzStatus = {
        hasAgentKey: false,
        totalOutbound: 10,
        withImageCount: 0,
        pendingCount: 10,
      };

      render(
        <QueryClientProvider client={queryClient}>
          <InvoiceHeader />
        </QueryClientProvider>
      );

      const syncBtn = screen.getByRole('button', { name: /számlázz\.hu szinkron/i });
      expect(syncBtn).toBeDisabled();
      // Badge should not be visible when not connected
      expect(screen.queryByText('10')).not.toBeInTheDocument();
    });

    it('enables Számlázz.hu sync button and shows pending badge when hasAgentKey is true', () => {
      mockSzamlazzStatus = {
        hasAgentKey: true,
        totalOutbound: 10,
        withImageCount: 0,
        pendingCount: 10,
      };

      render(
        <QueryClientProvider client={queryClient}>
          <InvoiceHeader />
        </QueryClientProvider>
      );

      const syncBtn = screen.getByRole('button', { name: /számlázz\.hu szinkron/i });
      expect(syncBtn).not.toBeDisabled();
      expect(screen.getByText('10')).toBeInTheDocument();
    });
  });

  describe('NavInvoiceRow', () => {
    it('disables Számlakép download button in OUTBOUND table when hasSzamlazzKey is false', () => {
      const invoice = createNavInvoice();
      const navToSubmittedMap = new Map();

      render(
        <QueryClientProvider client={queryClient}>
          <Table>
            <TableBody>
              <NavInvoiceRow
                invoice={invoice}
                navToSubmittedMap={navToSubmittedMap}
                pageInvoiceIdToTransactionsMap={new Map()}
                hasSzamlazzKey={false}
                onRowClick={vi.fn()}
                onToggleExclude={vi.fn()}
              />
            </TableBody>
          </Table>
        </QueryClientProvider>
      );

      const downloadBtn = screen.getByRole('button', { name: /a számlázz\.hu integráció nincs beállítva/i });
      expect(downloadBtn).toBeDisabled();
    });

    it('enables Számlakép download button in OUTBOUND table when hasSzamlazzKey is true', () => {
      const invoice = createNavInvoice();
      const navToSubmittedMap = new Map();

      render(
        <QueryClientProvider client={queryClient}>
          <Table>
            <TableBody>
              <NavInvoiceRow
                invoice={invoice}
                navToSubmittedMap={navToSubmittedMap}
                pageInvoiceIdToTransactionsMap={new Map()}
                hasSzamlazzKey={true}
                onRowClick={vi.fn()}
                onToggleExclude={vi.fn()}
              />
            </TableBody>
          </Table>
        </QueryClientProvider>
      );

      const downloadBtn = screen.getByRole('button', { name: /számlakép letöltése számlázz\.hu-ból/i });
      expect(downloadBtn).not.toBeDisabled();
    });
  });
});
