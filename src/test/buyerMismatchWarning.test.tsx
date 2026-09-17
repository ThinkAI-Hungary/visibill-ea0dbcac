import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { checkBuyerTaxMismatch } from '@/lib/invoiceMatchingUtils';
import { InvoiceApprovalDialog } from '@/features/invoices/components/dialogs/InvoiceApprovalDialog';

// Mock AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-123', email: 'test@example.com' } }),
}));

// Mock CompanyContext with VBV Vision Kft.
vi.mock('@/contexts/CompanyContext', () => ({
  useCompany: () => ({
    selectedCompany: {
      id: 'comp-vbv',
      name: 'VBV Vision Kft.',
      tax_number: '13739830-2-03',
    },
  }),
}));

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
  },
}));

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, defaultValue?: any) => {
      if (typeof defaultValue === 'string') return defaultValue;
      if (defaultValue && typeof defaultValue === 'object' && defaultValue.defaultValue) {
        return defaultValue.defaultValue;
      }
      return k;
    },
  }),
}));

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
  toast: vi.fn(),
}));

describe('Buyer Tax Mismatch Detection (checkBuyerTaxMismatch)', () => {
  const company = {
    name: 'VBV Vision Kft.',
    tax_number: '13739830-2-03',
  };

  it('detects mismatch when INBOUND invoice has different buyer tax number (e.g. Kunfehértói)', () => {
    const invoice = {
      invoice_direction: 'INBOUND',
      vevo_vat_id: 'HU27392863',
      vevo_nev: 'KUNFEHÉRTÓI FÖLDTULAJDONOSI KÖZÖSSÉG',
    };

    const result = checkBuyerTaxMismatch(invoice, company);
    expect(result.isMismatch).toBe(true);
    expect(result.buyerName).toBe('KUNFEHÉRTÓI FÖLDTULAJDONOSI KÖZÖSSÉG');
    expect(result.buyerTax).toBe('HU27392863');
    expect(result.companyName).toBe('VBV Vision Kft.');
    expect(result.companyTax).toBe('13739830-2-03');
  });

  it('does NOT detect mismatch when INBOUND invoice has matching buyer tax number', () => {
    const invoice = {
      invoice_direction: 'INBOUND',
      vevo_vat_id: '13739830-2-03',
      vevo_nev: 'VBV Vision Kft.',
    };

    const result = checkBuyerTaxMismatch(invoice, company);
    expect(result.isMismatch).toBe(false);
  });

  it('does NOT detect mismatch on OUTBOUND invoice even if buyer tax differs', () => {
    const invoice = {
      invoice_direction: 'OUTBOUND',
      vevo_vat_id: '99887766-1-42',
      vevo_nev: 'External Customer Partner',
    };

    const result = checkBuyerTaxMismatch(invoice, company);
    expect(result.isMismatch).toBe(false);
  });

  it('detects mismatch by name when buyer tax is missing but name completely differs', () => {
    const invoice = {
      invoice_direction: 'INBOUND',
      vevo_vat_id: null,
      vevo_nev: 'MOL Magyar Olaj- és Gázipari Nyrt.',
    };

    const result = checkBuyerTaxMismatch(invoice, company);
    expect(result.isMismatch).toBe(true);
    expect(result.buyerName).toBe('MOL Magyar Olaj- és Gázipari Nyrt.');
  });

  it('does NOT detect mismatch by name when buyer name matches company name with slight variation', () => {
    const invoice = {
      invoice_direction: 'INBOUND',
      vevo_vat_id: null,
      vevo_nev: 'VBV Vision K.F.T.',
    };

    const result = checkBuyerTaxMismatch(invoice, company);
    expect(result.isMismatch).toBe(false);
  });
});

describe('InvoiceApprovalDialog Safety Guard on Buyer Mismatch', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  it('renders critical alert and disables approval button until checkbox is checked when buyer mismatch exists', () => {
    const mismatchInvoice: any = {
      id: 'inv-lend-4',
      bizonylatsorszam: 'LEND-2026-4',
      invoice_direction: 'INBOUND',
      elado_nev: 'Lendvai Ádám Attila',
      vevo_nev: 'KUNFEHÉRTÓI FÖLDTULAJDONOSI KÖZÖSSÉG',
      vevo_vat_id: 'HU27392863',
      brutto_vegosszeg: 90000,
      penznem: 'HUF',
      kibocsatas_datuma: '2026-02-11',
    };

    render(
      <QueryClientProvider client={queryClient}>
        <InvoiceApprovalDialog
          open={true}
          onOpenChange={() => {}}
          invoice={mismatchInvoice}
        />
      </QueryClientProvider>
    );

    // Critical Alert header should be displayed
    expect(screen.getByText(/A számla vevője nem az aktív cég!/i)).toBeInTheDocument();
    expect(screen.getAllByText(/KUNFEHÉRTÓI FÖLDTULAJDONOSI KÖZÖSSÉG/i).length).toBeGreaterThanOrEqual(1);

    // Confirmation checkbox should be present
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();

    // The Confirm button should be DISABLED
    const confirmBtn = screen.getByRole('button', { name: /Jóváhagyás|confirm_button/i });
    expect(confirmBtn).toBeDisabled();

    // After checking the confirmation checkbox, Confirm button becomes ENABLED
    fireEvent.click(checkbox);
    expect(confirmBtn).not.toBeDisabled();
  });

  it('does NOT display mismatch alert and leaves confirm button enabled when buyer matches', () => {
    const matchingInvoice: any = {
      id: 'inv-valid',
      bizonylatsorszam: 'VALID-2026-1',
      invoice_direction: 'INBOUND',
      elado_nev: 'Lendvai Ádám Attila',
      vevo_nev: 'VBV Vision Kft.',
      vevo_vat_id: '13739830-2-03',
      brutto_vegosszeg: 160000,
      penznem: 'HUF',
      kibocsatas_datuma: '2026-01-28',
    };

    render(
      <QueryClientProvider client={queryClient}>
        <InvoiceApprovalDialog
          open={true}
          onOpenChange={() => {}}
          invoice={matchingInvoice}
        />
      </QueryClientProvider>
    );

    // Alert should NOT be present
    expect(screen.queryByText(/A számla vevője nem az aktív cég!/i)).not.toBeInTheDocument();

    // Checkbox should NOT be present
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();

    // The Confirm button should be ENABLED by default
    const confirmBtn = screen.getByRole('button', { name: /Jóváhagyás|confirm_button/i });
    expect(confirmBtn).not.toBeDisabled();
  });
});
