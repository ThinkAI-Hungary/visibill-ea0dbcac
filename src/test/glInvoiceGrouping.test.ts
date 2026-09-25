import { describe, it, expect } from 'vitest';
import { groupLedgerItemsByInvoice, GroupableLedgerItem } from '@/lib/glInvoiceGrouping';

describe('groupLedgerItemsByInvoice', () => {
  const sampleItems: GroupableLedgerItem[] = [
    {
      id: 'item_1',
      name: 'Alpha Kft. - Nyomtatópapír',
      balance: 15000,
      cid: '511_item_1',
      isItem: true,
      partner: 'Alpha Kft.',
      date: '2026-03-10',
      invoiceId: 'inv_001',
      invoiceNumber: 'INV-2026-01',
      originalGlId: 'gl_511',
    },
    {
      id: 'item_2',
      name: 'Alpha Kft. - Golyóstoll kék',
      balance: 5000,
      cid: '511_item_2',
      isItem: true,
      partner: 'Alpha Kft.',
      date: '2026-03-10',
      invoiceId: 'inv_001',
      invoiceNumber: 'INV-2026-01',
      originalGlId: 'gl_511',
    },
    {
      id: 'item_3',
      name: 'Alpha Kft. - Iratrendező',
      balance: 10000,
      cid: '511_item_3',
      isItem: true,
      partner: 'Alpha Kft.',
      date: '2026-03-10',
      invoiceId: 'inv_001',
      invoiceNumber: 'INV-2026-01',
      originalGlId: 'gl_511',
    },
    // Another invoice from Alpha Kft.
    {
      id: 'item_4',
      name: 'Alpha Kft. - Tonerkazetta',
      balance: 45000,
      cid: '511_item_4',
      isItem: true,
      partner: 'Alpha Kft.',
      date: '2026-03-25',
      invoiceId: 'inv_002',
      invoiceNumber: 'INV-2026-02',
      originalGlId: 'gl_511',
    },
    // A bank transaction with no invoice ID
    {
      id: 'tx_bank_1',
      name: 'Banki jutalék levonás',
      balance: -1500,
      cid: '511_tx_bank_1',
      isItem: true,
      partner: 'OTP Bank',
      date: '2026-03-31',
    },
  ];

  it('consolidates items from the same invoice under the same GL account into one row with sum', () => {
    const grouped = groupLedgerItemsByInvoice(sampleItems, 'by_invoice');

    // Should have 3 rows:
    // 1) inv_001 (sum = 15000 + 5000 + 10000 = 30000, 3 items)
    // 2) inv_002 (45000, 1 item)
    // 3) tx_bank_1 (-1500, 1 item)
    expect(grouped).toHaveLength(3);

    const inv1 = grouped.find(g => g.invoiceId === 'inv_001');
    expect(inv1).toBeDefined();
    expect(inv1?.balance).toBe(30000);
    expect(inv1?.groupedCount).toBe(3);
    expect(inv1?.groupedItemIds).toEqual(['item_1', 'item_2', 'item_3']);
    expect(inv1?.name).toContain('INV-2026-01');

    const inv2 = grouped.find(g => g.invoiceId === 'inv_002');
    expect(inv2).toBeDefined();
    expect(inv2?.balance).toBe(45000);
    expect(inv2?.groupedCount).toBeUndefined(); // single item does not need groupedCount

    const bankTx = grouped.find(g => g.id === 'tx_bank_1');
    expect(bankTx).toBeDefined();
    expect(bankTx?.balance).toBe(-1500);
  });

  it('keeps separate rows for different invoices from the same partner', () => {
    const grouped = groupLedgerItemsByInvoice(sampleItems, 'by_invoice');
    const alphaRows = grouped.filter(g => g.partner === 'Alpha Kft.');
    // inv_001 and inv_002 MUST be separate rows!
    expect(alphaRows).toHaveLength(2);
  });

  it('returns all items unmodified when mode is detailed', () => {
    const detailed = groupLedgerItemsByInvoice(sampleItems, 'detailed');
    expect(detailed).toHaveLength(5);
    expect(detailed.map(d => d.id)).toEqual(['item_1', 'item_2', 'item_3', 'item_4', 'tx_bank_1']);
  });
});
