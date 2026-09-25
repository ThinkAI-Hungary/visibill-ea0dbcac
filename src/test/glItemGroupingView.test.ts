import { describe, it, expect } from 'vitest';
import { groupLedgerItemsByInvoice } from '@/lib/glInvoiceGrouping';

describe('General Ledger - Item Grouping by Invoice', () => {
  const sampleItems = [
    // Invoice 1 (INV-2026-001) - 3 line items on account 521
    {
      id: 'item_1',
      name: 'MOL Nyrt. • INV-2026-001 - Üzemanyag 95',
      balance: 15000,
      debitTurnover: 15000,
      creditTurnover: 0,
      cid: '521_item_1',
      isItem: true,
      partner: 'MOL Nyrt.',
      invoiceId: 'inv-mol-001',
      invoiceNumber: 'INV-2026-001',
      sourceTable: 'invoice_items',
    },
    {
      id: 'item_2',
      name: 'MOL Nyrt. • INV-2026-001 - Autópálya matrica',
      balance: 5000,
      debitTurnover: 5000,
      creditTurnover: 0,
      cid: '521_item_2',
      isItem: true,
      partner: 'MOL Nyrt.',
      invoiceId: 'inv-mol-001',
      invoiceNumber: 'INV-2026-001',
      sourceTable: 'invoice_items',
    },
    {
      id: 'item_3',
      name: 'MOL Nyrt. • INV-2026-001 - Mosó kupon',
      balance: 2000,
      debitTurnover: 2000,
      creditTurnover: 0,
      cid: '521_item_3',
      isItem: true,
      partner: 'MOL Nyrt.',
      invoiceId: 'inv-mol-001',
      invoiceNumber: 'INV-2026-001',
      sourceTable: 'invoice_items',
    },
    // Invoice 2 from SAME partner (INV-2026-002) - 1 line item on account 521
    {
      id: 'item_4',
      name: 'MOL Nyrt. • INV-2026-002 - AdBlue adalék',
      balance: 8000,
      debitTurnover: 8000,
      creditTurnover: 0,
      cid: '521_item_4',
      isItem: true,
      partner: 'MOL Nyrt.',
      invoiceId: 'inv-mol-002',
      invoiceNumber: 'INV-2026-002',
      sourceTable: 'invoice_items',
    },
    // Invoice 3 from DIFFERENT partner (TEL-8899) - 2 line items on account 521
    {
      id: 'item_5',
      name: 'Telekom Zrt. • TEL-8899 - Mobil előfizetés',
      balance: 10000,
      debitTurnover: 10000,
      creditTurnover: 0,
      cid: '521_item_5',
      isItem: true,
      partner: 'Telekom Zrt.',
      invoiceId: 'inv-tel-001',
      invoiceNumber: 'TEL-8899',
      sourceTable: 'invoice_items',
    },
    {
      id: 'item_6',
      name: 'Telekom Zrt. • TEL-8899 - Internet díj',
      balance: 12000,
      debitTurnover: 12000,
      creditTurnover: 0,
      cid: '521_item_6',
      isItem: true,
      partner: 'Telekom Zrt.',
      invoiceId: 'inv-tel-001',
      invoiceNumber: 'TEL-8899',
      sourceTable: 'invoice_items',
    },
  ];

  it('consolidates items from the same invoice under the same account into a single row with summed amount by default ("by_invoice")', () => {
    const grouped = groupLedgerItemsByInvoice(sampleItems, 'by_invoice');

    // 6 items should become 3 rows:
    // Row 1: MOL INV-2026-001 (sum of 3 items: 15000 + 5000 + 2000 = 22000)
    // Row 2: MOL INV-2026-002 (1 item: 8000) - separate row despite same partner!
    // Row 3: Telekom TEL-8899 (sum of 2 items: 10000 + 12000 = 22000)
    expect(grouped).toHaveLength(3);

    // Row 1 verification
    const mol1 = grouped.find(g => g.id === 'grouped_inv-mol-001');
    expect(mol1).toBeDefined();
    expect(mol1?.balance).toBe(22000);
    expect(mol1?.groupedCount).toBe(3);
    expect(mol1?.groupedItemIds).toEqual(['item_1', 'item_2', 'item_3']);
    expect(mol1?.groupedDescriptions).toHaveLength(3);
    expect(mol1?.name).toContain('MOL Nyrt.');
    expect(mol1?.name).toContain('INV-2026-001');

    // Row 2 verification (separate row from same partner)
    const mol2 = grouped.find(g => g.invoiceNumber === 'INV-2026-002');
    expect(mol2).toBeDefined();
    expect(mol2?.balance).toBe(8000);
    expect(mol2?.groupedCount).toBeUndefined(); // single item, not grouped

    // Row 3 verification (Telekom consolidated)
    const tel = grouped.find(g => g.id === 'grouped_inv-tel-001');
    expect(tel).toBeDefined();
    expect(tel?.balance).toBe(22000);
    expect(tel?.groupedCount).toBe(2);
    expect(tel?.groupedItemIds).toEqual(['item_5', 'item_6']);
  });

  it('keeps all items separated when itemGrouping is "detailed"', () => {
    const detailed = groupLedgerItemsByInvoice(sampleItems, 'detailed');
    expect(detailed).toHaveLength(6);
    expect(detailed[0].id).toBe('item_1');
    expect(detailed[1].id).toBe('item_2');
    expect(detailed[2].id).toBe('item_3');
    expect(detailed[3].id).toBe('item_4');
    expect(detailed[4].id).toBe('item_5');
    expect(detailed[5].id).toBe('item_6');
  });
});
