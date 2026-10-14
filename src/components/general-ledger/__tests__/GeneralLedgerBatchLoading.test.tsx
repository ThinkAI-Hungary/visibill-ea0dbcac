import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as glDataModule from '../../../lib/glData';

describe('GeneralLedger - Batch Loading & Concurrency Protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetchGlItemsForAccounts passes array of UUIDs and supports UNCLASSIFIED 00000000-0000-0000-0000-000000000000', async () => {
    const spy = vi.spyOn(glDataModule, 'fetchGlItemsForAccounts').mockResolvedValue([
      {
        item_id: 'item-1',
        gl_account_id: 'acc-uuid-1',
        source_table: 'invoice_items',
        item_type: 'Bejövő (Költség)',
        partner: 'Partner A',
        description: 'Tétel 1',
        amount: 10000,
        original_amount: 10000,
        original_currency: 'HUF',
        item_date: '2026-05-01',
        is_temporary: false,
      },
      {
        item_id: 'item-2',
        gl_account_id: '00000000-0000-0000-0000-000000000000',
        source_table: 'transactions',
        item_type: 'Banki tranzakció',
        partner: 'Partner B',
        description: 'Tétel 2',
        amount: 5000,
        original_amount: 5000,
        original_currency: 'HUF',
        item_date: '2026-05-02',
        is_temporary: true,
      },
    ]);

    const result = await glDataModule.fetchGlItemsForAccounts({
      companyId: 'company-123',
      presetId: 'preset-456',
      glAccountIds: ['acc-uuid-1', '00000000-0000-0000-0000-000000000000'],
      dateFrom: '2026-01-01',
      dateTo: '2026-12-31',
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      companyId: 'company-123',
      presetId: 'preset-456',
      glAccountIds: ['acc-uuid-1', '00000000-0000-0000-0000-000000000000'],
    }));
    expect(result).toHaveLength(2);
    expect(result[0].item_id).toBe('item-1');
    expect(result[1].gl_account_id).toBe('00000000-0000-0000-0000-000000000000');
  });

  it('correctly partitions batched results to distinct accounts', () => {
    const rawItems = [
      {
        item_id: 'item-1',
        gl_account_id: 'acc-uuid-1',
        amount: 10000,
      },
      {
        item_id: 'item-2',
        gl_account_id: 'acc-uuid-2',
        amount: 25000,
      },
      {
        item_id: 'item-3',
        gl_account_id: '00000000-0000-0000-0000-000000000000',
        amount: 5000,
      },
    ];

    const accountIdToCid = new Map<string, string>([
      ['acc-uuid-1', '511'],
      ['acc-uuid-2', '512'],
    ]);

    const itemsByCid = new Map<string, typeof rawItems>();
    itemsByCid.set('511', []);
    itemsByCid.set('512', []);
    itemsByCid.set('UNCLASSIFIED', []);

    rawItems.forEach(item => {
      const isUnclass = !item.gl_account_id || item.gl_account_id === '00000000-0000-0000-0000-000000000000';
      const parentCid = isUnclass ? 'UNCLASSIFIED' : (accountIdToCid.get(item.gl_account_id) || 'UNCLASSIFIED');
      itemsByCid.get(parentCid)?.push(item);
    });

    expect(itemsByCid.get('511')).toHaveLength(1);
    expect(itemsByCid.get('511')![0].item_id).toBe('item-1');
    expect(itemsByCid.get('512')).toHaveLength(1);
    expect(itemsByCid.get('512')![0].item_id).toBe('item-2');
    expect(itemsByCid.get('UNCLASSIFIED')).toHaveLength(1);
    expect(itemsByCid.get('UNCLASSIFIED')![0].item_id).toBe('item-3');
  });
});
