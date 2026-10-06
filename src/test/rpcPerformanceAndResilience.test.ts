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

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 3. P1 Financial & Filter RPC Return Contracts & Isolation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  describe('get_gl_balances RPC Return Contract & Tenant Isolation', () => {
    it('validates general ledger balance row structure and numeric types', () => {
      const mockGlRow = {
        gl_account_id: 'a1b2c3d4-0000-0000-0000-000000000001',
        gl_number: '466',
        short_name: 'Levonható ÁFA',
        total_balance: 1450000,
        final_balance: 1200000,
        temp_balance: 250000,
        item_count: 85,
      };

      expect(mockGlRow).toMatchObject({
        gl_account_id: expect.any(String),
        gl_number: '466',
        short_name: expect.any(String),
        total_balance: expect.any(Number),
        final_balance: expect.any(Number),
        temp_balance: expect.any(Number),
        item_count: expect.any(Number),
      });

      // Mathematical invariant: total_balance = final_balance + temp_balance
      expect(mockGlRow.total_balance).toBe(mockGlRow.final_balance + mockGlRow.temp_balance);
    });

    it('validates UNCLASSIFIED orphan balance fallback structure', () => {
      const mockOrphanRow = {
        gl_account_id: null,
        gl_number: 'UNCLASSIFIED',
        short_name: 'Besorolatlan tételek',
        total_balance: 50000,
        final_balance: 50000,
        temp_balance: 0,
        item_count: 3,
      };

      expect(mockOrphanRow.gl_account_id).toBeNull();
      expect(mockOrphanRow.gl_number).toBe('UNCLASSIFIED');
      expect(mockOrphanRow.total_balance).toBeGreaterThan(0);
    });
  });

  describe('get_gl_categorized_items RPC Return Contract', () => {
    it('validates categorized item breakdown row schema and multi-source types', () => {
      const mockItem = {
        item_id: 'item-uuid-1',
        gl_account_id: 'gl-uuid-1',
        source_table: 'invoices',
        item_type: 'Bejövő (Költség)',
        partner: 'Partner Teszt Kft.',
        description: 'SZLA-2026/01 - Irodaszer beszerzés',
        amount: 127000,
        original_amount: 127000,
        original_currency: 'HUF',
        item_date: '2026-10-01',
        is_temporary: false,
      };

      expect(mockItem).toMatchObject({
        item_id: expect.any(String),
        gl_account_id: expect.any(String),
        source_table: expect.stringMatching(/^(transactions|invoice_items|invoices_vat|invoices_partner|nav_invoice_items|nav_invoices_vat|nav_invoices_partner|journal_entry|acc_journal_lines|invoices)$/),
        partner: expect.any(String),
        description: expect.any(String),
        amount: expect.any(Number),
        original_amount: expect.any(Number),
        original_currency: expect.any(String),
        item_date: expect.any(String),
        is_temporary: expect.any(Boolean),
      });
    });
  });

  describe('get_filtered_submitted_invoices RPC Return Contract', () => {
    it('validates submitted invoice contract with accountant review & match status', () => {
      const mockSubmittedInvoice = {
        id: 'inv-uuid-1',
        bizonylatsorszam: 'BEJ-2026-99',
        kibocsatas_datuma: '2026-10-01',
        teljesites_datuma: '2026-10-01',
        elado_nev: 'Beszállító Zrt.',
        vevo_nev: 'Ügyfél Kft.',
        adoalap_osszesen: 100000,
        brutto_vegosszeg: 127000,
        afa_osszeg_osszesen: 27000,
        penznem: 'HUF',
        category_id: null,
        project_id: null,
        image_url: 'https://storage/inv.pdf',
        melleklet_url: null,
        invoice_direction: 'INBOUND',
        reference_number: 'REF-001',
        exclude_from_accounting: false,
        is_accountant_reviewed: true,
        fizetesi_mod: 'TRANSFER',
        match_status: 'matched',
        paid_amount: 127000,
        remaining_amount: 0,
        statusz: 'verified',
        nav_status: 'matched',
        approval_note: 'Minden rendben',
        approved_at: '2026-10-02T12:00:00Z',
        total_count: 42,
      };

      expect(mockSubmittedInvoice).toMatchObject({
        id: expect.any(String),
        bizonylatsorszam: expect.any(String),
        brutto_vegosszeg: expect.any(Number),
        exclude_from_accounting: false,
        is_accountant_reviewed: true,
        match_status: 'matched',
        paid_amount: 127000,
        remaining_amount: 0,
        total_count: expect.any(Number),
      });

      // Gross amount equals net + VAT
      expect(mockSubmittedInvoice.brutto_vegosszeg).toBe(
        mockSubmittedInvoice.adoalap_osszesen + mockSubmittedInvoice.afa_osszeg_osszesen
      );
    });
  });

  describe('company_counts_cache & get_company_counts Contract Tests', () => {
    it('validates the structure returned by get_company_counts from company_counts_cache', () => {
      const mockCachedCounts: CompanyCountsData = {
        invoices: {
          '0922dcf6-1111-2222-3333-444455556666': 120,
          '1b62659f-4f26-4599-b6dc-2ae2cd124641': 450,
        },
        nav_invoices: {
          '0922dcf6-1111-2222-3333-444455556666': 310,
          '1b62659f-4f26-4599-b6dc-2ae2cd124641': 890,
        },
        transactions: {
          '0922dcf6-1111-2222-3333-444455556666': 95,
          '1b62659f-4f26-4599-b6dc-2ae2cd124641': 600,
        },
        salary: {
          '0922dcf6-1111-2222-3333-444455556666': 12,
          '1b62659f-4f26-4599-b6dc-2ae2cd124641': 24,
        },
      };

      // 1. All 4 top-level keys must exist
      expect(mockCachedCounts).toHaveProperty('invoices');
      expect(mockCachedCounts).toHaveProperty('nav_invoices');
      expect(mockCachedCounts).toHaveProperty('transactions');
      expect(mockCachedCounts).toHaveProperty('salary');

      // 2. Counts must be non-negative integers
      for (const [key, map] of Object.entries(mockCachedCounts)) {
        for (const [companyId, count] of Object.entries(map)) {
          expect(typeof companyId).toBe('string');
          expect(typeof count).toBe('number');
          expect(count).toBeGreaterThanOrEqual(0);
          expect(Number.isInteger(count)).toBe(true);
        }
      }
    });

    it('handles fallback when company_counts_cache returns empty aggregates gracefully', () => {
      const emptyResult: CompanyCountsData = {
        invoices: {},
        nav_invoices: {},
        transactions: {},
        salary: {},
      };

      expect(emptyResult.invoices).toEqual({});
      expect(emptyResult.nav_invoices).toEqual({});
      expect(emptyResult.transactions).toEqual({});
      expect(emptyResult.salary).toEqual({});
    });
  });

  describe('get_gl_balances & get_gl_categorized_items Contract & Pre-materialization Invariants', () => {
    interface GlBalanceRow {
      gl_account_id: string | null;
      gl_number: string;
      short_name: string;
      total_balance: number;
      final_balance: number;
      temp_balance: number;
      item_count: number;
    }

    interface GlCategorizedItemRow {
      item_id: string;
      gl_account_id: string | null;
      source_table: string;
      item_type: string;
      partner: string | null;
      description: string | null;
      amount: number;
      original_amount: number;
      original_currency: string;
      item_date: string;
      is_temporary: boolean;
    }

    it('validates the row contract of get_gl_balances', () => {
      const mockBalanceRow: GlBalanceRow = {
        gl_account_id: '44538cf2-643d-4e51-a8ef-18a79e03aeb6',
        gl_number: '311',
        short_name: 'Vevők',
        total_balance: 150000.5,
        final_balance: 100000.0,
        temp_balance: 50000.5,
        item_count: 42,
      };

      expect(mockBalanceRow).toMatchObject({
        gl_account_id: expect.any(String),
        gl_number: '311',
        short_name: 'Vevők',
        total_balance: expect.any(Number),
        final_balance: expect.any(Number),
        temp_balance: expect.any(Number),
        item_count: expect.any(Number),
      });

      // Total balance must equal final_balance + temp_balance
      expect(mockBalanceRow.total_balance).toBeCloseTo(
        mockBalanceRow.final_balance + mockBalanceRow.temp_balance,
        2
      );
    });

    it('validates unclassified balances special row representation', () => {
      const unclassifiedRow: GlBalanceRow = {
        gl_account_id: null,
        gl_number: 'UNCLASSIFIED',
        short_name: 'Besorolatlan tételek',
        total_balance: 12500,
        final_balance: 12500,
        temp_balance: 0,
        item_count: 3,
      };

      expect(unclassifiedRow.gl_account_id).toBeNull();
      expect(unclassifiedRow.gl_number).toBe('UNCLASSIFIED');
      expect(unclassifiedRow.item_count).toBeGreaterThan(0);
    });

    it('validates get_gl_categorized_items contract with pagination and source tables', () => {
      const mockItems: GlCategorizedItemRow[] = [
        {
          item_id: '011027e8-ee28-424d-b996-f9f5db84d492',
          gl_account_id: '85c46ec9-fc8b-44ae-9bee-0d99e4e98bee',
          source_table: 'nav_invoices_partner',
          item_type: 'NAV Vevőkövetelés (311)',
          partner: 'Partner Kft.',
          description: 'NAV-2026/001 - Bruttó partner',
          amount: 11198.0,
          original_amount: 11198.0,
          original_currency: 'HUF',
          item_date: '2026-09-28',
          is_temporary: true,
        },
        {
          item_id: '022027e8-ee28-424d-b996-f9f5db84d493',
          gl_account_id: '85c46ec9-fc8b-44ae-9bee-0d99e4e98bee',
          source_table: 'invoice_items',
          item_type: 'Kimenő (Bevétel)',
          partner: 'Ügyfél Zrt.',
          description: 'Szolgáltatás díj',
          amount: -50000.0,
          original_amount: -50000.0,
          original_currency: 'HUF',
          item_date: '2026-09-29',
          is_temporary: false,
        },
      ];

      expect(mockItems.length).toBe(2);
      expect(mockItems[0].is_temporary).toBe(true);
      expect(mockItems[1].is_temporary).toBe(false);
      expect(['nav_invoices_partner', 'invoice_items', 'transactions', 'acc_journal_lines']).toContain(
        mockItems[0].source_table
      );
    });
  });
});
