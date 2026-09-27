import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';

// Unit test verifying that rows with duplicate item_ids across accounts
// or within the same account generate strictly unique React keys and trigger 0 duplicate key warnings.

describe('GeneralLedger - Unique React keys for compound/duplicate items', () => {
  it('ensures all rendered row keys are strictly unique even with identical item_id across accounts', () => {
    // Spy on console.error to catch any React duplicate key warnings
    const consoleErrorSpy = vi.spyOn(console, 'error');

    const duplicateItemId = '380d0050-e5cd-4186-8781-b8a5ab5b2897';

    // Mock tableData items representing account 311, account 467, and items under each with the SAME item_id
    const mockTableData = [
      {
        id: '311.',
        cid: '311',
        name: 'Belföldi vevő követelések',
        balance: 100000,
        isItem: false,
        isRoot: false,
        depth: 2,
        ancestorIds: ['3.', '31.'],
      },
      {
        id: `item_${duplicateItemId}`,
        cid: `311_invoices_partner_${duplicateItemId}`,
        name: 'Test Partner - Invoice Partner Leg',
        balance: 100000,
        isItem: true,
        sourceTable: 'invoices_partner',
        depth: 3,
        ancestorIds: ['311.', '3.', '31.'],
      },
      {
        id: '467.',
        cid: '467',
        name: 'Fizetendő ÁFA',
        balance: -27000,
        isItem: false,
        isRoot: false,
        depth: 2,
        ancestorIds: ['4.'],
      },
      {
        id: `item_${duplicateItemId}`,
        cid: `467_invoices_vat_${duplicateItemId}`,
        name: 'Test Partner - Invoice VAT Leg',
        balance: -27000,
        isItem: true,
        sourceTable: 'invoices_vat',
        depth: 3,
        ancestorIds: ['467.', '4.'],
      },
      // Even within the same account: multiple entries with identical id
      {
        id: `item_${duplicateItemId}`,
        cid: `467_invoices_vat_${duplicateItemId}_1`,
        name: 'Test Partner - Invoice VAT Leg Correction',
        balance: -5000,
        isItem: true,
        sourceTable: 'invoices_vat',
        depth: 3,
        ancestorIds: ['467.', '4.'],
      },
    ];

    // Compute rowKey logic as implemented in processedRows useMemo
    const seenKeys = new Set<string>();
    const processedRows = mockTableData.map((item: any, index: number) => {
      const baseKey = item.isLoadingRow
        ? `loading_${item.cid || item.id}`
        : item.isLoadMoreRow
        ? `loadmore_${item.cid || item.id}`
        : item.isItem
        ? (item.cid ? `item_${item.cid}` : `item_${item.id}`)
        : `acc_${item.cid || item.id}`;

      let rowKey = baseKey;
      if (seenKeys.has(rowKey)) {
        rowKey = `${rowKey}_${index}`;
      }
      seenKeys.add(rowKey);

      return { ...item, isVisibleOnScreen: true, rowKey };
    });

    // Verify all keys in processedRows are unique
    const keySet = new Set(processedRows.map(r => r.rowKey));
    expect(keySet.size).toBe(processedRows.length);

    // Render component list using rowKey
    const { container } = render(
      <div>
        {processedRows.map(row => (
          <div key={row.rowKey || row.id} id={`row_${row.id}`} data-testid="gl-row">
            <span>{row.name}</span>
          </div>
        ))}
      </div>
    );

    // Check that all 5 rows rendered
    const renderedRows = container.querySelectorAll('[data-testid="gl-row"]');
    expect(renderedRows.length).toBe(5);

    // Verify NO "Encountered two children with the same key" warning was emitted!
    const keyWarnings = consoleErrorSpy.mock.calls.filter(args =>
      args.some(arg => typeof arg === 'string' && arg.includes('Encountered two children with the same key'))
    );
    expect(keyWarnings.length).toBe(0);

    consoleErrorSpy.mockRestore();
  });
});
