import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React, { useState } from 'react';
import { ManualMatchSearchSection } from '../ManualMatchSearchSection';
import { AvailableInvoice, TransactionItem } from '@/lib/matching/types';

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) => {
      if (key === 'transactions:dialogs.details.search.multi_selected_count') {
        return `${options?.count} db számla kijelölve`;
      }
      if (key === 'transactions:dialogs.details.search.btn_save_multi_match') {
        return `${options?.count} db számla párosítása`;
      }
      if (key === 'transactions:dialogs.details.search.btn_save_match') {
        return 'Párosítás mentése';
      }
      if (key === 'transactions:dialogs.details.search.fee_difference_label') {
        return 'Levont jutalék / díj';
      }
      return key;
    },
  }),
}));

describe('ManualMatchSearchSection Component', () => {
  const mockTransaction: TransactionItem = {
    id: 'tx-booking-1',
    transaction_date: '2026-06-01',
    amount: 115282,
    currency: 'HUF',
    description: 'Booking.com payout',
    matched_invoice_id: null,
    confidence_score: null,
    match_type: null,
    is_verified: null,
    reason: null,
    created_at: '2026-06-01',
    company_id: 'comp-1',
    gl_account_id: null,
  };

  const mockCandidateInvoices: AvailableInvoice[] = [
    {
      id: 'inv-1',
      bizonylatsorszam: 'E-DP-2026-4',
      brutto_vegosszeg: 90984,
      elado_nev: 'Dr. Paróczai Csaba',
      penznem: 'HUF',
      kibocsatas_datuma: '2026-05-20',
      already_paid: 0,
      remaining: 90984,
    },
    {
      id: 'inv-2',
      bizonylatsorszam: 'E-DP-2026-3',
      brutto_vegosszeg: 39662,
      elado_nev: 'Dr. Paróczai Csaba',
      penznem: 'HUF',
      kibocsatas_datuma: '2026-05-21',
      already_paid: 0,
      remaining: 39662,
    },
  ];

  function TestHarness() {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [search, setSearch] = useState('');

    const toggleSelect = (id: string) => {
      setSelectedIds(prev =>
        prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
      );
    };

    return (
      <ManualMatchSearchSection
        mode="primary"
        transaction={mockTransaction}
        candidateInvoices={mockCandidateInvoices}
        search={search}
        setSearch={setSearch}
        selectedInvoiceIds={selectedIds}
        setSelectedInvoiceIds={setSelectedIds}
        toggleSelectInvoice={toggleSelect}
        clearSelection={() => setSelectedIds([])}
        loading={false}
        isSearchingServer={false}
        isSaving={false}
        matchStatus="unmatched"
        onMatch={vi.fn()}
      />
    );
  }

  it('renders candidate invoice items with checkboxes', () => {
    render(<TestHarness />);

    expect(screen.getByText('E-DP-2026-4')).toBeDefined();
    expect(screen.getByText('E-DP-2026-3')).toBeDefined();

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(2);
  });

  it('allows selecting multiple invoices and shows the summary bar and dynamic multi-match button', () => {
    render(<TestHarness />);

    // Initially single match button (disabled)
    const button = screen.getByRole('button', { name: /Párosítás mentése/i });
    expect(button).toBeDefined();

    // Check first invoice
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    // Check second invoice
    fireEvent.click(checkboxes[1]);

    // Summary bar should appear with 2 db számla kijelölve
    expect(screen.getByText('2 db számla kijelölve')).toBeDefined();

    // Sum is 90984 + 39662 = 130 646 Ft, difference vs 115 282 is 15 364 Ft
    expect(screen.getByText('Levont jutalék / díj:')).toBeDefined();

    // Button updates to '2 db számla párosítása'
    expect(screen.getByRole('button', { name: /2 db számla párosítása/i })).toBeDefined();
  });
});
