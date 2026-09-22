import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TransactionDataExportDialog, type ExportableTransaction } from '@/components/transactions/TransactionDataExportDialog';

const mockTransactions: ExportableTransaction[] = [
  {
    id: 'tx-1',
    transaction_date: '2026-09-11',
    description: 'SimplePay kártyás fizetés 1',
    amount: 37790,
    currency: 'HUF',
    fee_amount: 572,
    type: 'vevői tranzakció',
    matched_invoice_id: 'inv-1',
    matched_invoice_number: 'VMusic00658/2026',
    confidence_score: 1.0,
    is_verified: true,
    match_type: 'exact',
    reason: null,
    created_at: '2026-09-11T12:00:00Z',
    company_id: 'comp-1',
    upload_id: 'up-1',
    gl_account_id: null,
  },
  {
    id: 'tx-2',
    transaction_date: '2026-09-10',
    description: 'Banki számlavezetési díj',
    amount: -1500,
    currency: 'HUF',
    fee_amount: null,
    type: 'banki költség',
    matched_invoice_id: null,
    matched_invoice_number: undefined,
    confidence_score: null,
    is_verified: true,
    match_type: 'no_match_category',
    reason: null,
    created_at: '2026-09-10T10:00:00Z',
    company_id: 'comp-1',
    upload_id: 'up-1',
    gl_account_id: null,
  },
];

describe('TransactionDataExportDialog', () => {
  it('renders modal with title, format options, and transactions list', () => {
    render(
      <TransactionDataExportDialog
        open={true}
        onClose={vi.fn()}
        transactions={mockTransactions}
        onExport={vi.fn()}
      />
    );

    expect(screen.getByText('Tranzakciók Exportálása')).toBeInTheDocument();
    expect(screen.getByText('Excel (.xlsx)')).toBeInTheDocument();
    expect(screen.getByText('CSV (.csv)')).toBeInTheDocument();
    expect(screen.getByText('PDF (.pdf)')).toBeInTheDocument();
    expect(screen.getByText('SimplePay kártyás fizetés 1')).toBeInTheDocument();
    expect(screen.getByText('VMusic00658/2026')).toBeInTheDocument();
  });

  it('filters transactions via search query', () => {
    render(
      <TransactionDataExportDialog
        open={true}
        onClose={vi.fn()}
        transactions={mockTransactions}
        onExport={vi.fn()}
      />
    );

    const searchInput = screen.getByPlaceholderText('Keresés leírás, összeg vagy számlaszám alapján...');
    fireEvent.change(searchInput, { target: { value: 'VMusic' } });

    expect(screen.getByText('SimplePay kártyás fizetés 1')).toBeInTheDocument();
    expect(screen.queryByText('Banki számlavezetési díj')).not.toBeInTheDocument();
  });

  it('calls onExport with selected transactions and chosen format', async () => {
    const handleExport = vi.fn().mockResolvedValue(undefined);
    render(
      <TransactionDataExportDialog
        open={true}
        onClose={vi.fn()}
        transactions={mockTransactions}
        initialFormat="xlsx"
        onExport={handleExport}
      />
    );

    // Switch to CSV
    const csvButton = screen.getByText('CSV (.csv)');
    fireEvent.click(csvButton);

    // Click Export
    const exportButton = screen.getByRole('button', { name: /Exportálás/i });
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(handleExport).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'tx-1' }),
          expect.objectContaining({ id: 'tx-2' }),
        ]),
        'csv'
      );
    });
  });
});
