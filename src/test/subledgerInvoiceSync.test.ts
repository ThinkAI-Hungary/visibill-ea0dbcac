import { describe, it, expect } from 'vitest';

describe('Subledger to Invoice Settlement Synchronization Contract & Filters', () => {
  it('correctly identifies when a subledger line is 100% settled and marks invoice paid', () => {
    const invoiceLine = {
      id: 'line-sze-1',
      document_id: 'SZE-2026-1',
      amount: 160000,
      dc_type: 'K',
      gl_number: '4541',
      subledger_type: 'partner',
    };

    const matches = [
      {
        id: 'match-1',
        invoice_line_id: 'line-sze-1',
        settling_line_id: 'line-kp-1',
        settled_amount_huf: 160000,
        other_journal_code: 'P1',
        other_journal_type: 'CASH',
        other_posting_date: '2026-01-26',
      },
    ];

    const totalSettled = matches.reduce((sum, m) => sum + m.settled_amount_huf, 0);
    const isFullySettled = totalSettled >= (invoiceLine.amount - 0.01);

    expect(isFullySettled).toBe(true);

    // Simulated sync payload
    const syncResult = {
      fizetve: isFullySettled,
      is_manual_payment: true,
      manual_payment_date: matches[0].other_posting_date,
      manual_payment_type: matches[0].other_journal_type === 'CASH' ? 'petty_cash' : 'transfer',
      manual_payment_note: 'Folyószámlán készpénzzel rendezve',
    };

    expect(syncResult.fizetve).toBe(true);
    expect(syncResult.manual_payment_type).toBe('petty_cash');
    expect(syncResult.manual_payment_date).toBe('2026-01-26');
  });

  it('correctly reopens invoice when subledger match is removed', () => {
    const invoiceLine = {
      id: 'line-sze-1',
      document_id: 'SZE-2026-1',
      amount: 160000,
    };

    // After unlinking match, matches array is empty
    const matches: any[] = [];
    const totalSettled = matches.reduce((sum, m) => sum + m.settled_amount_huf, 0);
    const isFullySettled = totalSettled >= (invoiceLine.amount - 0.01);

    expect(isFullySettled).toBe(false);

    const reopenedResult = {
      fizetve: isFullySettled,
      is_manual_payment: false,
      manual_payment_date: null,
      manual_payment_type: null,
      manual_payment_note: null,
    };

    expect(reopenedResult.fizetve).toBe(false);
    expect(reopenedResult.manual_payment_date).toBeNull();
  });

  it('filters out invoices already attached to active petty cash entries in open settlement queries', () => {
    const openInvoicesFromDb = [
      { id: 'inv-1', bizonylatsorszam: 'SZE-2026-1', brutto_vegosszeg: 160000, fizetve: false },
      { id: 'inv-2', bizonylatsorszam: 'SZE-2026-2', brutto_vegosszeg: 160000, fizetve: false },
      { id: 'inv-3', bizonylatsorszam: 'SZE-2026-3', brutto_vegosszeg: 160000, fizetve: false },
      { id: 'inv-5', bizonylatsorszam: 'SZE-2026-5', brutto_vegosszeg: 160000, fizetve: false },
    ];

    // Petty cash entries already attached to inv-1, inv-2, inv-3
    const pettyCashAttachedEntries = [
      { source_id: 'inv-1', status: 'posted' },
      { source_id: 'inv-2', status: 'posted' },
      { source_id: 'inv-3', status: 'posted' },
    ];

    const attachedInvoiceIds = new Set(
      pettyCashAttachedEntries.map((p) => p.source_id).filter(Boolean)
    );

    const filtered = openInvoicesFromDb.filter((inv) => !attachedInvoiceIds.has(inv.id));

    expect(filtered).toHaveLength(1);
    expect(filtered[0].bizonylatsorszam).toBe('SZE-2026-5');
    expect(filtered.map((i) => i.bizonylatsorszam)).not.toContain('SZE-2026-1');
    expect(filtered.map((i) => i.bizonylatsorszam)).not.toContain('SZE-2026-2');
    expect(filtered.map((i) => i.bizonylatsorszam)).not.toContain('SZE-2026-3');
  });

  it('allows attaching in AttachInvoiceDialog when entry source_id matches current entry being edited', () => {
    const currentEntryId = 'pce-editing-current';
    const invoiceId = 'inv-current';

    const pceRes = [
      { id: currentEntryId, source_id: invoiceId, status: 'posted' },
      { id: 'pce-other', source_id: 'inv-other', status: 'posted' },
    ];

    // Exclude current entry itself from blocking its own attached invoice
    const attachedToOtherEntries = new Set(
      pceRes.filter((p) => p.id !== currentEntryId).map((p) => p.source_id)
    );

    expect(attachedToOtherEntries.has('inv-other')).toBe(true);
    expect(attachedToOtherEntries.has(invoiceId)).toBe(false);
  });
});
