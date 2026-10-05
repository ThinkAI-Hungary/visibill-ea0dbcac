import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TransactionMultiPicker } from '../manual-create/TransactionMultiPicker';
import { InvoiceDocumentDropzone } from '../manual-create/InvoiceDocumentDropzone';

const mockToast = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  toast: (...args: any[]) => mockToast(...args),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'tx-unmatched-1',
                  amount: -50000,
                  description: 'Office Supplies Inc',
                  transaction_date: '2026-03-01',
                  currency: 'HUF',
                  type: 'expense',
                  matched_invoice_id: null,
                },
                {
                  id: 'tx-matched-other',
                  amount: -120000,
                  description: 'Rent Payment',
                  transaction_date: '2026-03-02',
                  currency: 'HUF',
                  type: 'expense',
                  matched_invoice_id: 'inv-other-999',
                },
              ],
              error: null,
            }),
          })),
        })),
      })),
    })),
  },
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryFn }: any) => {
    return {
      data: [
        {
          id: 'tx-unmatched-1',
          amount: -50000,
          description: 'Office Supplies Inc',
          transaction_date: '2026-03-01',
          currency: 'HUF',
          type: 'expense',
          matched_invoice_id: null,
        },
        {
          id: 'tx-matched-other',
          amount: -120000,
          description: 'Rent Payment',
          transaction_date: '2026-03-02',
          currency: 'HUF',
          type: 'expense',
          matched_invoice_id: 'inv-other-999',
        },
      ],
      isLoading: false,
    };
  },
}));

describe('TransactionMultiPicker', () => {
  const defaultProps = {
    companyId: 'comp-1',
    selectedTransactions: [],
    onToggleTransaction: vi.fn(),
    onRemoveTransaction: vi.fn(),
    invoiceGrossAmount: 100000,
    invoiceCurrency: 'HUF',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders picker trigger button and opens popover', () => {
    render(<TransactionMultiPicker {...defaultProps} />);

    const trigger = screen.getByRole('combobox');
    expect(trigger).toBeInTheDocument();
    fireEvent.click(trigger);

    expect(screen.getByText('Office Supplies Inc')).toBeInTheDocument();
  });

  it('disables already matched transaction to prevent transaction stealing', () => {
    render(<TransactionMultiPicker {...defaultProps} />);

    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    // Show all transactions to view the already-matched one
    const toggleAllBtn = screen.getByRole('button', { name: /Összes/i });
    fireEvent.click(toggleAllBtn);

    expect(screen.getByText('Rent Payment')).toBeInTheDocument();
    expect(screen.getByText('Másik számlához kötve')).toBeInTheDocument();

    const matchedTxBtn = screen.getByText('Rent Payment').closest('button');
    expect(matchedTxBtn).toBeDisabled();

    // Clicking it should not call onToggleTransaction
    if (matchedTxBtn) {
      fireEvent.click(matchedTxBtn);
    }
    expect(defaultProps.onToggleTransaction).not.toHaveBeenCalled();
  });

  it('allows clicking an unmatched transaction', () => {
    render(<TransactionMultiPicker {...defaultProps} />);

    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    const unmatchedTxBtn = screen.getByText('Office Supplies Inc').closest('button');
    expect(unmatchedTxBtn).not.toBeDisabled();

    if (unmatchedTxBtn) {
      fireEvent.click(unmatchedTxBtn);
    }
    expect(defaultProps.onToggleTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'tx-unmatched-1' })
    );
  });
});

describe('InvoiceDocumentDropzone', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows error toast when invalid file type is uploaded', () => {
    const onFileChange = vi.fn();
    const { container } = render(
      <InvoiceDocumentDropzone file={null} onFileChange={onFileChange} />
    );

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeInTheDocument();

    const invalidFile = new File(['dummy content'], 'document.exe', { type: 'application/x-msdownload' });
    fireEvent.change(input, { target: { files: [invalidFile] } });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
      })
    );
    expect(onFileChange).not.toHaveBeenCalled();
  });

  it('shows error toast when file exceeds 25MB limit', () => {
    const onFileChange = vi.fn();
    const { container } = render(
      <InvoiceDocumentDropzone file={null} onFileChange={onFileChange} />
    );

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const oversizedFile = new File(['a'], 'huge_scan.pdf', { type: 'application/pdf' });
    Object.defineProperty(oversizedFile, 'size', { value: 30 * 1024 * 1024 });

    fireEvent.change(input, { target: { files: [oversizedFile] } });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
      })
    );
    expect(onFileChange).not.toHaveBeenCalled();
  });
});
