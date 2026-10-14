import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchAllGlBalances, fetchAllGlCategorizedItems, fetchAllGlAccountsByPreset, fetchGlItemsForAccount, fetchGlItemsForAccounts } from './glData';

import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

describe('glData pagination utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchAllGlBalances', () => {
    it('fetches all balances atomically via get_gl_balances_json in a single request without range pagination', async () => {
      const mockItems = Array.from({ length: 1250 }, (_, i) => ({
        gl_account_id: `id-${i}`,
        gl_number: `${i}`,
        short_name: `Account ${i}`,
        total_balance: 100,
        final_balance: 80,
        temp_balance: 20,
        item_count: 5,
      }));

      (supabase.rpc as any).mockImplementation((fnName: string) => {
        if (fnName === 'get_gl_balances_json') {
          return Promise.resolve({ data: mockItems, error: null });
        }
        return { range: vi.fn() };
      });

      const result = await fetchAllGlBalances({
        companyId: 'company-1',
        presetId: 'preset-1',
      });

      expect(result).toHaveLength(1250);
      expect(supabase.rpc).toHaveBeenCalledWith('get_gl_balances_json', {
        p_company_id: 'company-1',
        p_preset_id: 'preset-1',
        p_date_from: null,
        p_date_to: null,
        p_exchange_rates: {},
        p_date_basis: 'kibocsatas',
        p_posting_status: 'ALL',
        p_only_active: false,
      });
    });

    it('passes dateBasis to RPC when provided', async () => {
      (supabase.rpc as any).mockResolvedValue({ data: [], error: null });

      await fetchAllGlBalances({
        companyId: 'company-1',
        presetId: 'preset-1',
        dateBasis: 'teljesites',
      });

      expect(supabase.rpc).toHaveBeenCalledWith('get_gl_balances_json', {
        p_company_id: 'company-1',
        p_preset_id: 'preset-1',
        p_date_from: null,
        p_date_to: null,
        p_exchange_rates: {},
        p_date_basis: 'teljesites',
        p_posting_status: 'ALL',
        p_only_active: false,
      });
    });

    it('passes postingStatus POSTED_ONLY to RPC when requested', async () => {
      (supabase.rpc as any).mockResolvedValue({ data: [], error: null });

      await fetchAllGlBalances({
        companyId: 'company-1',
        presetId: 'preset-1',
        postingStatus: 'posted_only',
      });

      expect(supabase.rpc).toHaveBeenCalledWith('get_gl_balances_json', {
        p_company_id: 'company-1',
        p_preset_id: 'preset-1',
        p_date_from: null,
        p_date_to: null,
        p_exchange_rates: {},
        p_date_basis: 'kibocsatas',
        p_posting_status: 'POSTED_ONLY',
        p_only_active: false,
      });
    });

    it('defaults dateBasis to kibocsatas and postingStatus to ALL when omitted', async () => {
      (supabase.rpc as any).mockResolvedValue({ data: [], error: null });

      await fetchAllGlBalances({
        companyId: 'company-1',
        presetId: 'preset-1',
      });

      expect(supabase.rpc).toHaveBeenCalledWith('get_gl_balances_json', {
        p_company_id: 'company-1',
        p_preset_id: 'preset-1',
        p_date_from: null,
        p_date_to: null,
        p_exchange_rates: {},
        p_date_basis: 'kibocsatas',
        p_posting_status: 'ALL',
        p_only_active: false,
      });
    });

    it('falls back to paginated get_gl_balances if get_gl_balances_json is unavailable', async () => {
      const page1 = Array.from({ length: 1000 }, (_, i) => ({
        gl_account_id: `id-${i}`,
        gl_number: `${i}`,
        short_name: `Account ${i}`,
        total_balance: 100,
        final_balance: 100,
        temp_balance: 0,
        item_count: 1,
      }));
      const page2 = Array.from({ length: 111 }, (_, i) => ({
        gl_account_id: `id-${1000 + i}`,
        gl_number: `${1000 + i}`,
        short_name: `Account ${1000 + i}`,
        total_balance: 200,
        final_balance: 200,
        temp_balance: 0,
        item_count: 1,
      }));

      const mockRange = vi.fn()
        .mockResolvedValueOnce({ data: page1, error: null })
        .mockResolvedValueOnce({ data: page2, error: null });

      (supabase.rpc as any).mockImplementation((fnName: string) => {
        if (fnName === 'get_gl_balances_json') {
          return Promise.resolve({ data: null, error: { code: 'PGRST202', message: 'Function not found' } });
        }
        return { range: mockRange };
      });

      const result = await fetchAllGlBalances({
        companyId: 'company-1',
        presetId: 'preset-1',
      });

      expect(result).toHaveLength(1111);
      expect(mockRange).toHaveBeenCalledTimes(2);
      expect(mockRange).toHaveBeenNthCalledWith(1, 0, 999);
      expect(mockRange).toHaveBeenNthCalledWith(2, 1000, 1999);
    });
  });

  describe('fetchAllGlCategorizedItems', () => {
    it('passes dateBasis to RPC when provided', async () => {
      (supabase.rpc as any).mockResolvedValue({ data: [], error: null });

      await fetchAllGlCategorizedItems({
        companyId: 'company-1',
        presetId: 'preset-1',
        dateBasis: 'teljesites',
      });

      expect(supabase.rpc).toHaveBeenCalledWith('get_gl_categorized_items', {
        p_company_id: 'company-1',
        p_preset_id: 'preset-1',
        p_date_from: null,
        p_date_to: null,
        p_exchange_rates: {},
        p_date_basis: 'teljesites',
        p_posting_status: 'ALL',
        p_limit: 1000,
        p_offset: 0,
      });
    });

    it('passes postingStatus POSTED_ONLY to RPC when requested', async () => {
      (supabase.rpc as any).mockResolvedValue({ data: [], error: null });

      await fetchAllGlCategorizedItems({
        companyId: 'company-1',
        presetId: 'preset-1',
        postingStatus: 'posted_only',
      });

      expect(supabase.rpc).toHaveBeenCalledWith('get_gl_categorized_items', {
        p_company_id: 'company-1',
        p_preset_id: 'preset-1',
        p_date_from: null,
        p_date_to: null,
        p_exchange_rates: {},
        p_date_basis: 'kibocsatas',
        p_posting_status: 'POSTED_ONLY',
        p_limit: 1000,
        p_offset: 0,
      });
    });

    it('passes explicit p_limit and p_offset directly to RPC when provided', async () => {
      (supabase.rpc as any).mockResolvedValue({ data: [{ item_id: 'i1' }], error: null });

      const res = await fetchAllGlCategorizedItems({
        companyId: 'company-1',
        presetId: 'preset-1',
        limit: 50,
        offset: 100,
      });

      expect(res).toHaveLength(1);
      expect(supabase.rpc).toHaveBeenCalledWith('get_gl_categorized_items', {
        p_company_id: 'company-1',
        p_preset_id: 'preset-1',
        p_date_from: null,
        p_date_to: null,
        p_exchange_rates: {},
        p_date_basis: 'kibocsatas',
        p_posting_status: 'ALL',
        p_limit: 50,
        p_offset: 100,
      });
    });
  });

  describe('fetchAllGlAccountsByPreset', () => {
    it('paginates gl_accounts table query across 1000-row limit', async () => {
      const page1 = Array.from({ length: 1000 }, (_, i) => ({
        id: `id-${i}`,
        gl_number: `${i}`,
        short_name: `Account ${i}`,
        preset_id: 'preset-1',
      }));
      const page2 = Array.from({ length: 111 }, (_, i) => ({
        id: `id-${1000 + i}`,
        gl_number: `${1000 + i}`,
        short_name: `Account ${1000 + i}`,
        preset_id: 'preset-1',
      }));

      const mockRange = vi.fn()
        .mockResolvedValueOnce({ data: page1, error: null })
        .mockResolvedValueOnce({ data: page2, error: null });

      const mockOrder = vi.fn().mockReturnValue({ range: mockRange });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      (supabase.from as any).mockReturnValue({ select: mockSelect });

      const result = await fetchAllGlAccountsByPreset('preset-1');

      expect(result).toHaveLength(1111);
      expect(mockRange).toHaveBeenCalledTimes(2);
      expect(mockRange).toHaveBeenNthCalledWith(1, 0, 999);
      expect(mockRange).toHaveBeenNthCalledWith(2, 1000, 1999);
    });
  });

  describe('fetchGlItemsForAccount', () => {
    it('passes p_gl_account_id to get_gl_categorized_items RPC', async () => {
      (supabase.rpc as any).mockResolvedValue({ data: [{ item_id: 'item-1', amount: 500 }], error: null });

      const result = await fetchGlItemsForAccount({
        companyId: 'company-1',
        presetId: 'preset-1',
        glAccountId: 'gl-acc-123',
      });

      expect(result).toHaveLength(1);
      expect(supabase.rpc).toHaveBeenCalledWith('get_gl_categorized_items', {
        p_company_id: 'company-1',
        p_preset_id: 'preset-1',
        p_date_from: null,
        p_date_to: null,
        p_exchange_rates: {},
        p_date_basis: 'kibocsatas',
        p_posting_status: 'ALL',
        p_gl_account_id: 'gl-acc-123',
        p_limit: 1000,
        p_offset: 0,
      });
    });

    it('defaults to 00000000-0000-0000-0000-000000000000 when glAccountId is null', async () => {
      (supabase.rpc as any).mockResolvedValue({ data: [], error: null });

      await fetchGlItemsForAccount({
        companyId: 'company-1',
        presetId: 'preset-1',
        glAccountId: null,
      });

      expect(supabase.rpc).toHaveBeenCalledWith('get_gl_categorized_items', expect.objectContaining({
        p_gl_account_id: '00000000-0000-0000-0000-000000000000',
        p_limit: 1000,
        p_offset: 0,
      }));
    });

    it('passes p_limit and p_offset directly to get_gl_categorized_items RPC when limit is provided', async () => {
      const mockItems = Array.from({ length: 100 }, (_, i) => ({ item_id: `item-${i}`, amount: 100 }));
      (supabase.rpc as any).mockResolvedValue({ data: mockItems, error: null });

      const result = await fetchGlItemsForAccount({
        companyId: 'company-1',
        presetId: 'preset-1',
        glAccountId: 'gl-acc-123',
        limit: 100,
        offset: 200,
      });

      expect(result).toHaveLength(100);
      expect(supabase.rpc).toHaveBeenCalledWith('get_gl_categorized_items', {
        p_company_id: 'company-1',
        p_preset_id: 'preset-1',
        p_date_from: null,
        p_date_to: null,
        p_exchange_rates: {},
        p_date_basis: 'kibocsatas',
        p_posting_status: 'ALL',
        p_gl_account_id: 'gl-acc-123',
        p_limit: 100,
        p_offset: 200,
      });
    });

    it('defaults p_offset to 0 when limit is provided without explicit offset', async () => {
      (supabase.rpc as any).mockResolvedValue({ data: [], error: null });

      await fetchGlItemsForAccount({
        companyId: 'company-1',
        presetId: 'preset-1',
        glAccountId: '00000000-0000-0000-0000-000000000000',
        limit: 100,
      });

      expect(supabase.rpc).toHaveBeenCalledWith('get_gl_categorized_items', expect.objectContaining({
        p_limit: 100,
        p_offset: 0,
      }));
    });

    it('passes p_gl_account_ids to RPC when glAccountIds array is provided', async () => {
      (supabase.rpc as any).mockResolvedValue({ data: [{ item_id: 'i1' }], error: null });

      const result = await fetchGlItemsForAccount({
        companyId: 'company-1',
        presetId: 'preset-1',
        glAccountIds: ['acc-1', 'acc-2'],
      });

      expect(result).toHaveLength(1);
      expect(supabase.rpc).toHaveBeenCalledWith('get_gl_categorized_items', expect.objectContaining({
        p_gl_account_id: null,
        p_gl_account_ids: ['acc-1', 'acc-2'],
      }));
    });

    it('fetchGlItemsForAccounts forwards array correctly via helper', async () => {
      (supabase.rpc as any).mockResolvedValue({ data: [{ item_id: 'i2' }], error: null });

      const result = await fetchGlItemsForAccounts({
        companyId: 'company-1',
        presetId: 'preset-1',
        glAccountIds: ['acc-a', 'acc-b'],
        limit: 50,
      });

      expect(result).toHaveLength(1);
      expect(supabase.rpc).toHaveBeenCalledWith('get_gl_categorized_items', expect.objectContaining({
        p_gl_account_id: null,
        p_gl_account_ids: ['acc-a', 'acc-b'],
        p_limit: 50,
      }));
    });
  });

  describe('searchGlEntities', () => {
    it('returns empty array when query has less than 2 characters without calling RPC', async () => {
      const { searchGlEntities } = await import('./glData');
      const result = await searchGlEntities({
        companyId: 'comp-1',
        presetId: 'preset-1',
        query: ' a ',
      });

      expect(result).toEqual([]);
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it('calls search_gl_entities RPC with trimmed query and default limit', async () => {
      const { searchGlEntities } = await import('./glData');
      const mockResults = [
        {
          entity_type: 'account',
          entity_id: '261',
          gl_number: '261',
          title: '261 - Kereskedelmi áruk',
          subtitle: 'Főkönyvi számla',
          account_id: 'acc-uuid-1',
          target_gl_number: '261',
          amount: null,
        },
      ];
      (supabase.rpc as any).mockResolvedValue({ data: mockResults, error: null });

      const result = await searchGlEntities({
        companyId: 'comp-1',
        presetId: 'preset-1',
        query: '  261  ',
      });

      expect(result).toEqual(mockResults);
      expect(supabase.rpc).toHaveBeenCalledWith('search_gl_entities', {
        p_company_id: 'comp-1',
        p_preset_id: 'preset-1',
        p_query: '261',
        p_limit: 12,
      });
    });

    it('passes custom limit when specified', async () => {
      const { searchGlEntities } = await import('./glData');
      (supabase.rpc as any).mockResolvedValue({ data: [], error: null });

      await searchGlEntities({
        companyId: 'comp-1',
        presetId: 'preset-1',
        query: 'gitár',
        limit: 5,
      });

      expect(supabase.rpc).toHaveBeenCalledWith('search_gl_entities', {
        p_company_id: 'comp-1',
        p_preset_id: 'preset-1',
        p_query: 'gitár',
        p_limit: 5,
      });
    });

    it('throws error when RPC returns an error', async () => {
      const { searchGlEntities } = await import('./glData');
      (supabase.rpc as any).mockResolvedValue({ data: null, error: new Error('Database error') });

      await expect(searchGlEntities({
        companyId: 'comp-1',
        presetId: 'preset-1',
        query: 'test',
      })).rejects.toThrow('Database error');
    });
  });

  describe('fetchGlJournalItemsPaged', () => {
    it('calls get_gl_journal_view_items RPC with server-side pagination, search, and typeFilter', async () => {
      const { fetchGlJournalItemsPaged } = await import('./glData');
      const mockRows = [
        {
          item_id: 'item-uuid-1',
          gl_account_id: 'gl-uuid-1',
          gl_number: '529.',
          gl_name: 'Egyéb szolgáltatások',
          source_table: 'acc_journal_lines',
          item_type: 'Könyvelt napló tétel (T)',
          partner: 'DigitalOcean LLC',
          description: 'Cloud hosting',
          amount: 25000,
          original_amount: 25000,
          original_currency: 'HUF',
          item_date: '2026-10-01',
          is_temporary: false,
          total_count: 142,
          total_debit: 5000000,
          total_credit: 4900000,
        },
      ];

      (supabase.rpc as any).mockResolvedValue({ data: mockRows, error: null });

      const response = await fetchGlJournalItemsPaged({
        companyId: 'comp-1',
        presetId: 'preset-1',
        dateFrom: '2026-01-01',
        dateTo: '2026-12-31',
        dateBasis: 'teljesites',
        postingStatus: 'posted_only',
        search: '  DigitalOcean  ',
        typeFilter: 'acc_journal_lines',
        sortDir: 'asc',
        page: 2,
        pageSize: 50,
      });

      expect(supabase.rpc).toHaveBeenCalledWith('get_gl_journal_view_items', {
        p_company_id: 'comp-1',
        p_preset_id: 'preset-1',
        p_date_from: '2026-01-01',
        p_date_to: '2026-12-31',
        p_exchange_rates: {},
        p_date_basis: 'teljesites',
        p_posting_status: 'POSTED_ONLY',
        p_search: 'DigitalOcean',
        p_type_filter: 'acc_journal_lines',
        p_sort_dir: 'asc',
        p_page: 2,
        p_page_size: 50,
      });

      expect(response.totalCount).toBe(142);
      expect(response.totalDebit).toBe(5000000);
      expect(response.totalCredit).toBe(4900000);
      expect(response.items).toHaveLength(1);
      expect(response.items[0].partner).toBe('DigitalOcean LLC');
    });

    it('handles empty results and defaults totalCount and totals to 0', async () => {
      const { fetchGlJournalItemsPaged } = await import('./glData');
      (supabase.rpc as any).mockResolvedValue({ data: [], error: null });

      const response = await fetchGlJournalItemsPaged({
        companyId: 'comp-1',
        presetId: 'preset-1',
      });

      expect(response.totalCount).toBe(0);
      expect(response.totalDebit).toBe(0);
      expect(response.totalCredit).toBe(0);
      expect(response.items).toEqual([]);
    });

    it('throws error when RPC fails', async () => {
      const { fetchGlJournalItemsPaged } = await import('./glData');
      (supabase.rpc as any).mockResolvedValue({ data: null, error: new Error('RPC failure') });

      await expect(fetchGlJournalItemsPaged({
        companyId: 'comp-1',
        presetId: 'preset-1',
      })).rejects.toThrow('RPC failure');
    });
  });
});


