import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchAllGlBalances, fetchAllGlCategorizedItems, fetchAllGlAccountsByPreset, fetchGlItemsForAccount } from './glData';

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
    it('fetches single page when items are less than 1000', async () => {
      const mockItems = Array.from({ length: 250 }, (_, i) => ({
        gl_account_id: `id-${i}`,
        gl_number: `${i}`,
        short_name: `Account ${i}`,
        total_balance: 100,
      }));

      const mockRange = vi.fn().mockResolvedValue({ data: mockItems, error: null });
      (supabase.rpc as any).mockReturnValue({ range: mockRange });

      const result = await fetchAllGlBalances({
        companyId: 'company-1',
        presetId: 'preset-1',
      });

      expect(result).toHaveLength(250);
      expect(mockRange).toHaveBeenCalledTimes(1);
      expect(mockRange).toHaveBeenCalledWith(0, 999);
    });

    it('automatically paginates across multiple pages when count >= 1000', async () => {
      const page1 = Array.from({ length: 1000 }, (_, i) => ({
        gl_account_id: `id-${i}`,
        gl_number: `${i}`,
        short_name: `Account ${i}`,
        total_balance: 100,
      }));
      const page2 = Array.from({ length: 111 }, (_, i) => ({
        gl_account_id: `id-${1000 + i}`,
        gl_number: `${1000 + i}`,
        short_name: `Account ${1000 + i}`,
        total_balance: 200,
      }));

      const mockRange = vi.fn()
        .mockResolvedValueOnce({ data: page1, error: null })
        .mockResolvedValueOnce({ data: page2, error: null });

      (supabase.rpc as any).mockReturnValue({ range: mockRange });

      const result = await fetchAllGlBalances({
        companyId: 'company-1',
        presetId: 'preset-1',
      });

      expect(result).toHaveLength(1111);
      expect(mockRange).toHaveBeenCalledTimes(2);
      expect(mockRange).toHaveBeenNthCalledWith(1, 0, 999);
      expect(mockRange).toHaveBeenNthCalledWith(2, 1000, 1999);
      expect(result[1110].gl_number).toBe('1110');
    });

    it('passes dateBasis to RPC when provided', async () => {
      const mockRange = vi.fn().mockResolvedValue({ data: [], error: null });
      (supabase.rpc as any).mockReturnValue({ range: mockRange });

      await fetchAllGlBalances({
        companyId: 'company-1',
        presetId: 'preset-1',
        dateBasis: 'teljesites',
      });

      expect(supabase.rpc).toHaveBeenCalledWith('get_gl_balances', {
        p_company_id: 'company-1',
        p_preset_id: 'preset-1',
        p_date_from: null,
        p_date_to: null,
        p_exchange_rates: {},
        p_date_basis: 'teljesites',
        p_posting_status: 'ALL',
      });
    });

    it('passes postingStatus POSTED_ONLY to RPC when requested', async () => {
      const mockRange = vi.fn().mockResolvedValue({ data: [], error: null });
      (supabase.rpc as any).mockReturnValue({ range: mockRange });

      await fetchAllGlBalances({
        companyId: 'company-1',
        presetId: 'preset-1',
        postingStatus: 'posted_only',
      });

      expect(supabase.rpc).toHaveBeenCalledWith('get_gl_balances', {
        p_company_id: 'company-1',
        p_preset_id: 'preset-1',
        p_date_from: null,
        p_date_to: null,
        p_exchange_rates: {},
        p_date_basis: 'kibocsatas',
        p_posting_status: 'POSTED_ONLY',
      });
    });

    it('defaults dateBasis to kibocsatas and postingStatus to ALL when omitted', async () => {
      const mockRange = vi.fn().mockResolvedValue({ data: [], error: null });
      (supabase.rpc as any).mockReturnValue({ range: mockRange });

      await fetchAllGlBalances({
        companyId: 'company-1',
        presetId: 'preset-1',
      });

      expect(supabase.rpc).toHaveBeenCalledWith('get_gl_balances', {
        p_company_id: 'company-1',
        p_preset_id: 'preset-1',
        p_date_from: null,
        p_date_to: null,
        p_exchange_rates: {},
        p_date_basis: 'kibocsatas',
        p_posting_status: 'ALL',
      });
    });
  });

  describe('fetchAllGlCategorizedItems', () => {
    it('passes dateBasis to RPC when provided', async () => {
      const mockRange = vi.fn().mockResolvedValue({ data: [], error: null });
      (supabase.rpc as any).mockReturnValue({ range: mockRange });

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
      });
    });

    it('passes postingStatus POSTED_ONLY to RPC when requested', async () => {
      const mockRange = vi.fn().mockResolvedValue({ data: [], error: null });
      (supabase.rpc as any).mockReturnValue({ range: mockRange });

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
      const mockRange = vi.fn().mockResolvedValue({ data: [{ item_id: 'item-1', amount: 500 }], error: null });
      (supabase.rpc as any).mockReturnValue({ range: mockRange });

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
      });
      expect(mockRange).toHaveBeenCalledWith(0, 999);
    });

    it('defaults to 00000000-0000-0000-0000-000000000000 when glAccountId is null', async () => {
      const mockRange = vi.fn().mockResolvedValue({ data: [], error: null });
      (supabase.rpc as any).mockReturnValue({ range: mockRange });

      await fetchGlItemsForAccount({
        companyId: 'company-1',
        presetId: 'preset-1',
        glAccountId: null,
      });

      expect(supabase.rpc).toHaveBeenCalledWith('get_gl_categorized_items', expect.objectContaining({
        p_gl_account_id: '00000000-0000-0000-0000-000000000000',
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
});


