import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import UnmatchedSection from '@/components/dashboard/UnmatchedItemsModal';
import InvoiceStatusTables from '@/components/dashboard/InvoiceStatusTables';

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

const mockNavInvoices = [
  {
    id: 'nav-1',
    invoice_number: 'INV-2026-001',
    invoice_direction: 'INBOUND',
    invoice_issue_date: '2026-09-20',
    invoice_delivery_date: '2026-09-20',
    supplier_name: 'Anthropic, PBC',
    customer_name: null,
    supplier_tax_number: '12345678-1-23',
    invoice_gross_amount: 50000,
    currency: 'HUF',
    payment_method: 'Átutalás',
    transaction_id: null,
    submitted: true,
  },
  {
    id: 'nav-2',
    invoice_number: 'INV-2026-002',
    invoice_direction: 'OUTBOUND',
    invoice_issue_date: '2026-09-18',
    invoice_delivery_date: '2026-09-18',
    supplier_name: null,
    customer_name: 'Client Alpha Kft',
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
    invoice_delivery_date: '2026-09-12',
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
                { tax_number: '12345678-1-23', name: 'Anthropic, PBC' },
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

describe('UnmatchedSection - Fintech Side-by-Side Split', () => {
  it('renders card with h-[520px] and subtabs for NAV and Transactions', async () => {
    const queryClient = createTestQueryClient();
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <UnmatchedSection />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const card = container.querySelector('.h-\\[520px\\]');
    expect(card).toBeInTheDocument();

    expect(screen.getByText('Nem párosított tételek')).toBeInTheDocument();
    expect(screen.getByText('NAV számlák')).toBeInTheDocument();
    expect(screen.getAllByText(/Tranzakciók/i).length).toBeGreaterThanOrEqual(1);
  });

  it('switches between NAV and Transactions subtabs when clicked', async () => {
    const queryClient = createTestQueryClient();
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <UnmatchedSection />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const txTabBtn = container.querySelector('button[data-tab="transactions"]');
    expect(txTabBtn).toBeInTheDocument();
    if (txTabBtn) {
      fireEvent.click(txTabBtn);
    }

    await waitFor(() => {
      expect(screen.getByText('Párosítatlan összeg:')).toBeInTheDocument();
    });
  });

  it('deep links to invoice items when clicking match or row on a NAV invoice', async () => {
    mockNavigate.mockClear();
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <UnmatchedSection />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('INV-2026-001')).toBeInTheDocument();
    });

    const matchButtons = screen.getAllByRole('button', { name: /párosít/i });
    expect(matchButtons.length).toBeGreaterThan(0);
    fireEvent.click(matchButtons[0]);

    expect(mockNavigate).toHaveBeenCalledWith('invoices/inbound_nav?invoice=nav-1');
  });

  it('deep links to transaction details when clicking match or row on a transaction', async () => {
    mockNavigate.mockClear();
    const queryClient = createTestQueryClient();
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <UnmatchedSection />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('INV-2026-001')).toBeInTheDocument();
    });

    const txTabBtn = container.querySelector('button[data-tab="transactions"]');
    expect(txTabBtn).toBeInTheDocument();
    fireEvent.click(txTabBtn!);

    await waitFor(() => {
      expect(container.textContent).toContain('Bank payment to Anthropic');
    });

    const matchButtons = screen.getAllByRole('button', { name: /párosít/i });
    expect(matchButtons.length).toBeGreaterThan(0);
    fireEvent.click(matchButtons[0]);

    expect(mockNavigate).toHaveBeenCalledWith('transactions?transaction=tx-1');
  });
});

describe('InvoiceStatusTables - Fintech Side-by-Side Split', () => {
  it('renders card with h-[520px] and subtabs for Payable and Missing', async () => {
    const queryClient = createTestQueryClient();
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <InvoiceStatusTables />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const card = container.querySelector('.h-\\[520px\\]');
    expect(card).toBeInTheDocument();

    expect(screen.getByText('Bejövő számlák állapota')).toBeInTheDocument();
    expect(screen.getAllByText(/Fizetendő/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Hiányzó')).toBeInTheDocument();
  });

  it('switches to missing subtab and allows triggering upload navigation', async () => {
    const queryClient = createTestQueryClient();
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <InvoiceStatusTables />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const missingTabBtn = container.querySelector('button[data-tab="missing"]');
    expect(missingTabBtn).toBeInTheDocument();
    if (missingTabBtn) {
      fireEvent.click(missingTabBtn);
    }

    await waitFor(() => {
      expect(screen.getByText('Beküldésre vár:')).toBeInTheDocument();
    });
  });

  it('deep links to invoice items when clicking a payable invoice row', async () => {
    mockNavigate.mockClear();
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <InvoiceStatusTables />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('INV-2026-001')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('INV-2026-001'));
    expect(mockNavigate).toHaveBeenCalledWith('invoices/inbound_nav?invoice=nav-1');
  });

  it('excludes 0 Ft invoices and already uploaded invoices (with whitespace differences) from missing tab', async () => {
    const queryClient = createTestQueryClient();
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <InvoiceStatusTables />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const missingTabBtn = container.querySelector('button[data-tab="missing"]');
    expect(missingTabBtn).toBeInTheDocument();
    fireEvent.click(missingTabBtn!);

    await waitFor(() => {
      // Genuinely missing invoice must be present
      expect(screen.getByText('INV-2026-MISSING')).toBeInTheDocument();
    });

    // 0 Ft invoice (INV-2026-ZERO) must NOT be present
    expect(screen.queryByText('INV-2026-ZERO')).not.toBeInTheDocument();

    // Whitespace-matched invoice (DATA / 2026-000001 matching DATA/2026-000001) must NOT be present
    expect(screen.queryByText('DATA / 2026-000001')).not.toBeInTheDocument();

    // Missing count should reflect strictly missing (1 item)
    expect(screen.getByText(/1 db számlakép/i)).toBeInTheDocument();
  });
});
