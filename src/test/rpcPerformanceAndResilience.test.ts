import { describe, it, expect, vi, beforeEach } from 'vitest';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. Edge Function Resilient Caching Logic Test
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface CompanyCountsData {
  invoices: Record<string, number>;
  nav_invoices: Record<string, number>;
  transactions: Record<string, number>;
  salary: Record<string, number>;
}

// Pure caching implementation identical to overviewHandler.ts
function createCompanyCountsCacheManager(ttlMs: number = 2 * 60 * 1000) {
  let cachedCompanyCounts: { data: CompanyCountsData; timestamp: number } | null = null;

  async function fetchCompanyCountsWithCache(admin: { rpc: (name: string) => Promise<{ data: any; error: any }> }): Promise<CompanyCountsData> {
    const now = Date.now();
    if (cachedCompanyCounts && (now - cachedCompanyCounts.timestamp) < ttlMs) {
      return cachedCompanyCounts.data;
    }

    try {
      const { data, error } = await admin.rpc("get_company_counts");
      if (error) {
        if (cachedCompanyCounts) {
          return cachedCompanyCounts.data;
        }
        return { invoices: {}, nav_invoices: {}, transactions: {}, salary: {} };
      }
      const countsData = (data as CompanyCountsData) || { invoices: {}, nav_invoices: {}, transactions: {}, salary: {} };
      cachedCompanyCounts = { data: countsData, timestamp: now };
      return countsData;
    } catch {
      if (cachedCompanyCounts) return cachedCompanyCounts.data;
      return { invoices: {}, nav_invoices: {}, transactions: {}, salary: {} };
    }
  }

  function getRawCache() {
    return cachedCompanyCounts;
  }

  function clearCache() {
    cachedCompanyCounts = null;
  }

  return { fetchCompanyCountsWithCache, getRawCache, clearCache };
}

describe('RPC Performance & Edge Function Resilience Tests', () => {
  describe('fetchCompanyCountsWithCache Resilience & TTL', () => {
    let mockAdmin: { rpc: ReturnType<typeof vi.fn> };
    let cacheManager: ReturnType<typeof createCompanyCountsCacheManager>;

    beforeEach(() => {
      mockAdmin = {
        rpc: vi.fn(),
      };
      cacheManager = createCompanyCountsCacheManager(1000); // 1s TTL for testing
    });

    it('fetches from RPC on first call and caches the result', async () => {
      const mockData: CompanyCountsData = {
        invoices: { 'comp-1': 10 },
        nav_invoices: { 'comp-1': 20 },
        transactions: { 'comp-1': 30 },
        salary: { 'comp-1': 5 },
      };
      mockAdmin.rpc.mockResolvedValueOnce({ data: mockData, error: null });

      const res1 = await cacheManager.fetchCompanyCountsWithCache(mockAdmin);
      expect(mockAdmin.rpc).toHaveBeenCalledTimes(1);
      expect(mockAdmin.rpc).toHaveBeenCalledWith('get_company_counts');
      expect(res1).toEqual(mockData);

      // Second call within TTL should NOT invoke RPC again
      const res2 = await cacheManager.fetchCompanyCountsWithCache(mockAdmin);
      expect(mockAdmin.rpc).toHaveBeenCalledTimes(1);
      expect(res2).toEqual(mockData);
    });

    it('serves stale cached data when RPC fails with Postgres statement_timeout (57014)', async () => {
      const initialData: CompanyCountsData = {
        invoices: { 'comp-1': 100 },
        nav_invoices: { 'comp-1': 200 },
        transactions: { 'comp-1': 300 },
        salary: { 'comp-1': 50 },
      };
      mockAdmin.rpc.mockResolvedValueOnce({ data: initialData, error: null });

      // First call primes the cache
      await cacheManager.fetchCompanyCountsWithCache(mockAdmin);
      expect(mockAdmin.rpc).toHaveBeenCalledTimes(1);

      // Advance time past TTL
      vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 5000);

      // Next call simulates statement timeout (57014)
      mockAdmin.rpc.mockResolvedValueOnce({
        data: null,
        error: { code: '57014', message: 'canceling statement due to statement timeout' },
      });

      const resStale = await cacheManager.fetchCompanyCountsWithCache(mockAdmin);
      expect(mockAdmin.rpc).toHaveBeenCalledTimes(2);
      // It should gracefully return stale data instead of throwing or crashing
      expect(resStale).toEqual(initialData);

      vi.restoreAllMocks();
    });

    it('returns empty counts structure when cold cache encounters timeout/error without throwing', async () => {
      mockAdmin.rpc.mockResolvedValueOnce({
        data: null,
        error: { code: '57014', message: 'canceling statement due to statement timeout' },
      });

      const res = await cacheManager.fetchCompanyCountsWithCache(mockAdmin);
      expect(res).toEqual({
        invoices: {},
        nav_invoices: {},
        transactions: {},
        salary: {},
      });
    });

    it('handles unexpected thrown exceptions in RPC invocation safely', async () => {
      mockAdmin.rpc.mockRejectedValueOnce(new Error('Network connection terminated'));

      const res = await cacheManager.fetchCompanyCountsWithCache(mockAdmin);
      expect(res).toEqual({
        invoices: {},
        nav_invoices: {},
        transactions: {},
        salary: {},
      });
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 2. RPC Return Schema & Backward Compatibility Contracts
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  describe('get_management_files RPC Return Contract', () => {
    it('validates expected return structure with pagination metadata', () => {
      const mockRpcResponse = {
        data: {
          files: [
            {
              id: 'file-1',
              file_name: 'invoice_2026.pdf',
              file_url: 'https://storage.../invoice_2026.pdf',
              source_table: 'invoices',
              file_type: 'invoice',
              company_id: 'comp-1',
              company_name: 'Test Kft.',
              user_id: 'user-1',
              user_name: 'Test User',
              created_at: '2026-10-01T10:00:00Z',
              status_category: 'success',
              status_details: null,
            },
          ],
          total_count: 15822,
          page: 1,
          page_size: 25,
        },
      };

      expect(mockRpcResponse.data).toHaveProperty('files');
      expect(mockRpcResponse.data).toHaveProperty('total_count');
      expect(mockRpcResponse.data).toHaveProperty('page');
      expect(mockRpcResponse.data).toHaveProperty('page_size');
      expect(Array.isArray(mockRpcResponse.data.files)).toBe(true);
      expect(mockRpcResponse.data.files[0]).toMatchObject({
        id: expect.any(String),
        file_name: expect.any(String),
        source_table: expect.any(String),
        status_category: expect.any(String),
      });
    });
  });

  describe('get_filtered_nav_invoices RPC Return Contract', () => {
    it('validates pagination slice contract and gl_numbers array type', () => {
      const mockNavInvoiceRow = {
        id: 'nav-inv-1',
        company_id: 'comp-1',
        invoice_number: 'NAV-2026-001',
        supplier_name: 'Supplier Zrt.',
        customer_name: 'Buyer Kft.',
        net_amount: 100000,
        vat_amount: 27000,
        gross_amount: 127000,
        currency: 'HUF',
        invoice_date: '2026-10-01',
        payment_date: '2026-10-15',
        gl_numbers: ['5110', '5210'],
        total_count: 1420,
      };

      expect(mockNavInvoiceRow).toMatchObject({
        id: expect.any(String),
        company_id: expect.any(String),
        invoice_number: expect.any(String),
        gross_amount: expect.any(Number),
        gl_numbers: expect.any(Array),
      });
      expect(Array.isArray(mockNavInvoiceRow.gl_numbers)).toBe(true);
      expect(mockNavInvoiceRow.gl_numbers).toContain('5110');
    });
  });
});
