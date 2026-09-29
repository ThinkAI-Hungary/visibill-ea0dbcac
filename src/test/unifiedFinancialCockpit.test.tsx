import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import UnifiedFinancialCockpit, { CockpitRowSkeleton, PAGE_SIZE } from '@/components/dashboard/UnifiedFinancialCockpit';

const mockNavigate = vi.fn();

vi.mock('@/lib/navigation', () => ({
  useScopedNavigate: () => mockNavigate,
}));

vi.mock('@/contexts/CompanyContext', () => ({
  useCompany: () => ({
    selectedCompany: { id: 'company-test-123', name: 'Test Company' },
  }),
}));

vi.mock('@/contexts/DateRangeContext', () => ({
  useDateRange: () => ({
    dateFromFormatted: '2026-01-01',
    dateToFormatted: '2026-12-31',
  }),
}));

vi.mock('@/components/InvoiceItemsDialog', () => ({
  InvoiceItemsDialog: ({ open, invoiceNumber, onOpenChange }: any) => {
    if (!open) return null;
    return (
      <div data-testid="invoice-items-dialog">
        <span>Invoice Dialog: {invoiceNumber}</span>
        <button onClick={() => onOpenChange?.(false)}>Close</button>
      </div>
    );
  },
}));

vi.mock('@/components/TransactionDetailsDialog', () => ({
  TransactionDetailsDialog: ({ open, transaction, onOpenChange }: any) => {
    if (!open) return null;
    return (
      <div data-testid="transaction-details-dialog">
        <span>Transaction Dialog: {transaction?.description}</span>
        <button onClick={() => onOpenChange?.(false)}>Close</button>
      </div>
    );
  },
}));

const mockNavInvoices = [
  {
    id: 'nav-inbound-1',
    invoice_number: 'INV-2026-IN-001',
    invoice_direction: 'INBOUND',
    invoice_issue_date: '2026-09-20',
    invoice_delivery_date: '2026-09-30',
    supplier_name: 'Anthropic PBC',
    customer_name: null,
    supplier_tax_number: '12345678-1-23',
    invoice_gross_amount: 50000,
    currency: 'HUF',
    payment_method: 'Átutalás',
    transaction_id: null,
    submitted: true,
  },
  {
    id: 'nav-outbound-1',
    invoice_number: 'INV-2026-OUT-002',
    invoice_direction: 'OUTBOUND',
    invoice_issue_date: '2026-09-18',
    invoice_delivery_date: '2026-09-28',
    supplier_name: null,
    customer_name: 'Client Omega Kft',
    supplier_tax_number: null,
    invoice_gross_amount: 120000,
    currency: 'HUF',
    payment_method: 'Bankkártya',
    transaction_id: null,
    submitted: true,
  },
  {
    id: 'nav-missing-1',
    invoice_number: 'INV-2026-MISSING',
    invoice_direction: 'INBOUND',
    invoice_issue_date: '2026-09-12',
    invoice_delivery_date: '2026-09-22',
    supplier_name: 'Missing Supplier Kft',
    customer_name: null,
    supplier_tax_number: '99999999-1-23',
    invoice_gross_amount: 35000,
    currency: 'HUF',
    payment_method: 'Átutalás',
    transaction_id: null,
    submitted: false,
  },
  {
    id: 'nav-zero',
    invoice_number: 'INV-2026-ZERO',
    invoice_direction: 'INBOUND',
    invoice_issue_date: '2026-09-11',
    invoice_delivery_date: '2026-09-11',
    supplier_name: 'Zero Posta',
    customer_name: null,
    supplier_tax_number: '88888888-1-23',
    invoice_gross_amount: 0,
    currency: 'HUF',
    payment_method: 'Átutalás',
    transaction_id: null,
    submitted: false,
  },
  {
    id: 'nav-uploaded-whitespace',
    invoice_number: 'DATA / 2026-000001',
    invoice_direction: 'INBOUND',
    invoice_issue_date: '2026-09-10',
    invoice_delivery_date: '2026-09-10',
    supplier_name: 'Data-Rocket Labs Kft.',
    customer_name: null,
    supplier_tax_number: '77777777-1-23',
    invoice_gross_amount: 1778000,
    currency: 'HUF',
    payment_method: 'Átutalás',
    transaction_id: null,
    submitted: false,
  },
];

const mockUploadedInvoices = [
  { bizonylatsorszam: 'DATA/2026-000001' },
];

const mockTransactions = [
  {
    id: 'tx-1',
    transaction_date: '2026-09-21',
    amount: -50000,
    description: 'Bank payment to Anthropic',
    currency: 'HUF',
    type: 'Átutalás',
    matched_invoice_id: null,
  },
];

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      let isMissing = false;
      const builder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        or: vi.fn().mockImplementation((condition: string) => {
          if (condition.includes('submitted')) isMissing = true;
          return builder;
        }),
        order: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => {
          if (table === 'invoices') {
            return Promise.resolve(resolve({ data: mockUploadedInvoices, error: null }));
          }
          return Promise.resolve(resolve({ data: [], error: null }));
        }),
        range: vi.fn().mockImplementation(() => {
          if (table === 'nav_invoices') {
            if (isMissing) {
              const missingData = mockNavInvoices.filter(
                (inv) => inv.invoice_direction === 'INBOUND' && (inv.submitted === null || inv.submitted === false)
              );
              return Promise.resolve({ data: missingData, error: null });
            }
            return Promise.resolve({ data: mockNavInvoices, error: null });
          }
          if (table === 'transactions') {
            return Promise.resolve({ data: mockTransactions, error: null });
          }
          if (table === 'partners') {
            return Promise.resolve({
              data: [
                { tax_number: '12345678-1-23', name: 'Anthropic PBC' },
                { tax_number: '99999999-1-23', name: 'Missing Supplier Kft' },
              ],
              error: null,
            });
          }
          return Promise.resolve({ data: [], error: null });
        }),
      };
      return builder;
    },
    rpc: vi.fn().mockImplementation((fnName: string, args: any) => {
      if (fnName === 'get_filtered_nav_invoices') {
        const direction = args?.p_direction;
        const filtered = mockNavInvoices.filter(
          (inv) => !direction || inv.invoice_direction === direction
        );
        return Promise.resolve({ data: filtered, error: null });
      }
      return Promise.resolve({ data: [], error: null });
    }),
  },
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

describe('UnifiedFinancialCockpit - Option 2 Action Hub', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders all 4 top KPI switcher tiles with values and status tags', async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <UnifiedFinancialCockpit />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // 4 tiles should exist
    expect(screen.getByTestId('cockpit-tile-missing')).toBeInTheDocument();
    expect(screen.getByTestId('cockpit-tile-payable')).toBeInTheDocument();
    expect(screen.getByTestId('cockpit-tile-bank')).toBeInTheDocument();
    expect(screen.getByTestId('cockpit-tile-receivables')).toBeInTheDocument();

    // Verify tile headers / labels
    expect(screen.getByText('Hiányzó bizonylatok')).toBeInTheDocument();
    expect(screen.getByText('Kifizetetlen szállítók')).toBeInTheDocument();
    expect(screen.getByText('Párosítatlan bank')).toBeInTheDocument();
    expect(screen.getByText('Kintlévőség (Vevők)')).toBeInTheDocument();

    // Verify refined subtitles
    expect(screen.getByText('NAV-ban van, de nem található számlakép')).toBeInTheDocument();
    expect(screen.getByText(/párosított banki tranzakció nélkül/i)).toBeInTheDocument();

    // Wait for async queries to resolve
    await waitFor(() => {
      expect(screen.getByText('INV-2026-MISSING')).toBeInTheDocument();
    });

    // Verify clicking missing voucher row opens InvoiceItemsDialog
    const rows = screen.getAllByTestId('cockpit-row');
    expect(rows.length).toBeGreaterThan(0);
    fireEvent.click(rows[0]);

    expect(screen.getByTestId('invoice-items-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('invoice-items-dialog')).toHaveTextContent('Invoice Dialog: INV-2026-MISSING');
  });

  it('switches to payable tab and renders inbound invoices and opens invoice items dialog on row click', async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <UnifiedFinancialCockpit />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const payableTile = screen.getByTestId('cockpit-tile-payable');
    fireEvent.click(payableTile);

    await waitFor(() => {
      expect(screen.getByText('INV-2026-IN-001')).toBeInTheDocument();
    });

    const rows = screen.getAllByTestId('cockpit-row');
    expect(rows.length).toBeGreaterThan(0);
    fireEvent.click(rows[0]);

    expect(screen.getByTestId('invoice-items-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('invoice-items-dialog')).toHaveTextContent('Invoice Dialog: INV-2026-IN-001');
  });

  it('switches to bank tab and opens transaction details dialog on row click', async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <UnifiedFinancialCockpit />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const bankTile = screen.getByTestId('cockpit-tile-bank');
    fireEvent.click(bankTile);

    await waitFor(() => {
      expect(screen.getByText('Bank payment to Anthropic')).toBeInTheDocument();
    });

    const rows = screen.getAllByTestId('cockpit-row');
    expect(rows.length).toBeGreaterThan(0);
    fireEvent.click(rows[0]);

    expect(screen.getByTestId('transaction-details-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('transaction-details-dialog')).toHaveTextContent('Transaction Dialog: Bank payment to Anthropic');
  });

  it('switches to receivables tab and opens invoice items dialog on row click', async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <UnifiedFinancialCockpit />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const receivablesTile = screen.getByTestId('cockpit-tile-receivables');
    fireEvent.click(receivablesTile);

    await waitFor(() => {
      expect(screen.getByText('INV-2026-OUT-002')).toBeInTheDocument();
    });

    const rows = screen.getAllByTestId('cockpit-row');
    expect(rows.length).toBeGreaterThan(0);
    fireEvent.click(rows[0]);

    expect(screen.getByTestId('invoice-items-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('invoice-items-dialog')).toHaveTextContent('Invoice Dialog: INV-2026-OUT-002');
  });

  it('filters rows when user types into the search box', async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <UnifiedFinancialCockpit />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('INV-2026-MISSING')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/gyorskeresés partnerre/i);
    fireEvent.change(searchInput, { target: { value: 'non-existent-search-key' } });

    await waitFor(() => {
      expect(screen.queryByText('INV-2026-MISSING')).not.toBeInTheDocument();
      expect(screen.getByText(/nincs találat a keresésre/i)).toBeInTheDocument();
    });

    fireEvent.change(searchInput, { target: { value: 'MISSING' } });
    await waitFor(() => {
      expect(screen.getByText('INV-2026-MISSING')).toBeInTheDocument();
    });
  });

  it('primary toolbar action button navigates to upload when on missing tab and shows uniform Párosítás on other tabs', async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <UnifiedFinancialCockpit />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const uploadBtn = screen.getByRole('button', { name: /bizonylatfeltöltés/i });
    expect(uploadBtn).toBeInTheDocument();
    fireEvent.click(uploadBtn);

    expect(mockNavigate).toHaveBeenCalledWith('upload');

    // Switch to payable tab and verify uniform "Párosítás" button text
    const payableTile = screen.getByTestId('cockpit-tile-payable');
    fireEvent.click(payableTile);

    const matchBtn = screen.getByTestId('cockpit-header-action-btn');
    expect(matchBtn).toHaveTextContent('Párosítás');
  });

  it('renders payable and bank tabs with unique prefixed keys and no duplicate key warnings', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <UnifiedFinancialCockpit />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Switch to payable tab
    const payableTile = screen.getByTestId('cockpit-tile-payable');
    fireEvent.click(payableTile);

    await waitFor(() => {
      expect(screen.getByText('INV-2026-IN-001')).toBeInTheDocument();
    });

    // Switch to bank tab
    const bankTile = screen.getByTestId('cockpit-tile-bank');
    fireEvent.click(bankTile);

    await waitFor(() => {
      expect(screen.getByText('Bank payment to Anthropic')).toBeInTheDocument();
    });

    // Verify no "Encountered two children with the same key" error was logged
    const duplicateKeyWarnings = consoleWarnSpy.mock.calls.filter((call) =>
      String(call[0]).includes('Encountered two children with the same key')
    );
    expect(duplicateKeyWarnings).toHaveLength(0);
    consoleWarnSpy.mockRestore();
  });
});

