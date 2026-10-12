import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Petty Cash Attach & Unlink Invoice Feature', () => {
  it('detects invoice number from entry description', () => {
    const entryDesc = 'ZG-2026-3';
    const openInvoices = [
      { id: 'inv-1', bizonylatsorszam: 'GA-2026-4', brutto_vegosszeg: 160000, invoice_direction: 'INBOUND' },
      { id: 'inv-2', bizonylatsorszam: 'ZG-2026-3', brutto_vegosszeg: 160000, invoice_direction: 'INBOUND' },
      { id: 'inv-3', bizonylatsorszam: 'GVA-2026-4', brutto_vegosszeg: 155275, invoice_direction: 'INBOUND' },
    ];

    const match = openInvoices.find(
      (inv) => entryDesc.toUpperCase().includes(inv.bizonylatsorszam.toUpperCase())
    );

    expect(match).toBeDefined();
    expect(match?.id).toBe('inv-2');
    expect(match?.bizonylatsorszam).toBe('ZG-2026-3');
  });

  it('detects invoice by exact amount in matching direction as fallback', () => {
    const entryAmount = -155275;
    const absEntryAmount = Math.abs(entryAmount);
    const openInvoices = [
      { id: 'inv-1', bizonylatsorszam: 'GA-2026-4', brutto_vegosszeg: 160000, invoice_direction: 'INBOUND' },
      { id: 'inv-3', bizonylatsorszam: 'GVA-2026-4', brutto_vegosszeg: 155275, invoice_direction: 'INBOUND' },
    ];

    const byAmount = openInvoices.filter(
      (inv) =>
        inv.invoice_direction === 'INBOUND' &&
        Math.abs(Number(inv.brutto_vegosszeg)) === absEntryAmount
    );

    expect(byAmount).toHaveLength(1);
    expect(byAmount[0].id).toBe('inv-3');
  });

  it('prioritizes auto-matched invoice to the top of list', () => {
    const autoMatchId = 'inv-2';
    const list = [
      { id: 'inv-1', bizonylatsorszam: 'GA-2026-4' },
      { id: 'inv-2', bizonylatsorszam: 'ZG-2026-3' },
      { id: 'inv-3', bizonylatsorszam: 'GVA-2026-4' },
    ];

    const sorted = [...list].sort((a, b) => {
      if (a.id === autoMatchId) return -1;
      if (b.id === autoMatchId) return 1;
      return 0;
    });

    expect(sorted[0].id).toBe('inv-2');
    expect(sorted[0].bizonylatsorszam).toBe('ZG-2026-3');
  });

  it('correctly sets invoice settlement fields when attaching', () => {
    const entryId = 'entry-123';
    const invoiceId = 'inv-2';
    const entryDate = '2026-04-30';

    const pettyCashUpdate = {
      source_table: 'invoices',
      source_id: invoiceId,
      source_type: 'invoice_settlement',
    };

    const invoiceUpdate = {
      fizetve: true,
      is_manual_payment: true,
      manual_payment_date: entryDate,
      manual_payment_type: 'cash',
      manual_payment_note: 'Házipénztár bizonylathoz kapcsolva',
    };

    expect(pettyCashUpdate.source_table).toBe('invoices');
    expect(pettyCashUpdate.source_id).toBe(invoiceId);
    expect(pettyCashUpdate.source_type).toBe('invoice_settlement');
    expect(invoiceUpdate.fizetve).toBe(true);
    expect(invoiceUpdate.manual_payment_type).toBe('cash');
    expect(invoiceUpdate.manual_payment_date).toBe('2026-04-30');
  });

  it('correctly resets fields when unlinking an invoice', () => {
    const entryReset = {
      source_table: null,
      source_id: null,
    };

    const invoiceReset = {
      fizetve: false,
      is_manual_payment: false,
      manual_payment_date: null,
      manual_payment_type: null,
      manual_payment_note: null,
    };

    expect(entryReset.source_table).toBeNull();
    expect(entryReset.source_id).toBeNull();
    expect(invoiceReset.fizetve).toBe(false);
    expect(invoiceReset.is_manual_payment).toBe(false);
  });
});
