import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ExpandedInvoiceRow } from '@/features/invoices/components/expanded-row';

vi.mock('@/contexts/CompanyContext', () => ({
  useCompany: () => ({
    selectedCompany: { id: 'test-comp-1', name: 'Teszt Kft' },
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'test@example.com' },
  }),
}));

vi.mock('@/hooks/useCompanyJurisdiction', () => ({
  useCompanyJurisdiction: () => ({
    hasNavIntegration: true,
    defaultCurrency: 'HUF',
  }),
}));

vi.mock('@/contexts/InvoiceContext', () => ({
  useInvoiceContext: () => ({
    selectedCompany: { id: 'test-comp-1' },
    companyId: 'test-comp-1',
    writable: true,
  }),
}));

// Mock child selectors and sections so test focuses on exclusion UI
vi.mock('@/components/vat/InvoiceVatCodeSelector', () => ({
  InvoiceVatCodeSelector: () => <div data-testid="mock-vat-selector" />,
}));

vi.mock('@/components/invoices/InvoiceGlAccountSelector', () => ({
  InvoiceGlAccountSelector: () => <div data-testid="mock-gl-selector" />,
}));

vi.mock('@/features/invoices/components/expanded-row/InvoiceNotesSection', () => ({
  InvoiceNotesSection: () => <div data-testid="mock-notes-section" />,
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>
      <table>
        <tbody>{ui}</tbody>
      </table>
    </QueryClientProvider>
  );
}

describe('Deferred VAT Row Badges and Explanatory Banner', () => {
  it('renders "Halasztva" button and explanatory notice card when invoice is deferred', () => {
    renderWithProviders(
      <ExpandedInvoiceRow
        colSpan={10}
        matchedSubmittedInvoices={[]}
        matchedNavInvoices={[]}
        matchedTransactions={[]}
        excludeFromAccounting={true}
        accountingExclusionType="DEFERRED_VAT"
        deferredVatReason="Költségszámla ÁFA levonás elhalasztva 2 évig"
        deferredVatSince="2026-10-09"
        onToggleExclude={vi.fn()}
        onOpenExclusionDialog={vi.fn()}
      />
    );

    // Verify "Halasztva" labels (both badge in header banner and toggle button)
    expect(screen.getAllByText('Halasztva')).toHaveLength(2);

    // Verify prominent banner title
    expect(screen.getByText('ÁFA levonás elhalasztva (Kérdéses számla)')).toBeInTheDocument();

    // Verify given reason is displayed
    expect(screen.getByText(/Költségszámla ÁFA levonás elhalasztva 2 évig/)).toBeInTheDocument();

    // Verify deferral start date
    expect(screen.getByText(/Halasztás kezdete: 2026-10-09/)).toBeInTheDocument();
  });

  it('renders "Nem kerül könyvelésre" when invoice has permanent accounting exclusion', () => {
    renderWithProviders(
      <ExpandedInvoiceRow
        colSpan={10}
        matchedSubmittedInvoices={[]}
        matchedNavInvoices={[]}
        matchedTransactions={[]}
        excludeFromAccounting={true}
        accountingExclusionType="PERMANENT"
        onToggleExclude={vi.fn()}
        onOpenExclusionDialog={vi.fn()}
      />
    );

    // Verify permanent button label
    expect(screen.getByText('Nem kerül könyvelésre')).toBeInTheDocument();

    // Verify permanent banner title
    expect(screen.getByText('Kizárva a könyvelésből')).toBeInTheDocument();
  });
});
