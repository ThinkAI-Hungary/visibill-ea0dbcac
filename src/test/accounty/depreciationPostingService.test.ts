import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateAssetPeriodDepreciation,
  checkExistingDepreciationPosting,
  postDepreciationRunToLedger,
} from '../../lib/fixed-assets/depreciationPostingService';
import type { FixedAsset } from '../../types/fixed-assets';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      from: vi.fn(),
      rpc: vi.fn(),
    },
  };
});

describe('depreciationPostingService', () => {
  const baseAsset: FixedAsset = {
    id: 'asset-test-1',
    company_id: 'comp-1',
    user_id: 'user-1',
    inventory_number: 'ESZK-2026-001',
    name: 'Samsung Galaxy S26 5G',
    description: null,
    vtsz_teszor: null,
    acquisition_value: 205496,
    residual_value: 0,
    currency: 'HUF',
    purchase_date: '2026-05-20',
    activation_date: '2026-05-26',
    disposal_date: null,
    useful_life_months: 36,
    depreciation_method: 'linear',
    performance_unit: null,
    total_planned_performance: null,
    depreciation_schedule: null,
    tao_template_id: null,
    tao_rate_override: 20,
    location_id: null,
    project_id: null,
    activated_by_user_id: null,
    activated_by_name: null,
    gl_account_id: 'gl-1341',
    development_reserve_id: null,
    development_reserve_amount: 0,
    source_invoice_id: null,
    source_invoice_type: null,
    source_invoice_number: null,
    supplier_name: null,
    status: 'active',
    documents: [],
    created_at: '2026-05-26T10:00:00Z',
    updated_at: '2026-05-26T10:00:00Z',
    gl_account: {
      id: 'gl-1341',
      gl_number: '1341',
      short_name: 'Számítástechnikai berendezések',
    },
  };

  describe('calculateAssetPeriodDepreciation', () => {
    it('calculates single month linear depreciation correctly for August 2026', () => {
      // Monthly linear: 205496 / 36 = 5708.22 -> 5708 Ft
      const res = calculateAssetPeriodDepreciation(baseAsset, '2026-08-01', '2026-08-31');

      expect(res.activeMonths).toBe(1);
      expect(res.amount).toBe(5708);
      // Prior months: May, June, July = 3 months
      expect(res.accumulatedBefore).toBe(3 * 5708);
      expect(res.remainingBookValue).toBe(205496 - 4 * 5708);
    });

    it('calculates cumulative 4 months depreciation for retroactive run (May to August 2026)', () => {
      // 4 months: May, June, July, August => 4 * 5708 = 22832 Ft
      const res = calculateAssetPeriodDepreciation(baseAsset, '2026-05-01', '2026-08-31');

      expect(res.activeMonths).toBe(4);
      expect(res.amount).toBe(22832);
      expect(res.accumulatedBefore).toBe(0); // May was the activation month
      expect(res.remainingBookValue).toBe(205496 - 22832);
    });

    it('returns 0 if asset activation is after the period end', () => {
      const futureAsset: FixedAsset = {
        ...baseAsset,
        activation_date: '2026-09-15',
      };

      const res = calculateAssetPeriodDepreciation(futureAsset, '2026-08-01', '2026-08-31');
      expect(res.amount).toBe(0);
      expect(res.activeMonths).toBe(0);
      expect(res.reason).toContain('vége utáni');
    });

    it('returns 0 if asset was disposed prior to period start', () => {
      const disposedAsset: FixedAsset = {
        ...baseAsset,
        disposal_date: '2026-07-15',
      };

      const res = calculateAssetPeriodDepreciation(disposedAsset, '2026-08-01', '2026-08-31');
      expect(res.amount).toBe(0);
      expect(res.activeMonths).toBe(0);
      expect(res.reason).toContain('kivezetésre került');
    });

    it('depreciates only until disposal month if asset is disposed mid-period', () => {
      const disposedMidAsset: FixedAsset = {
        ...baseAsset,
        activation_date: '2026-01-01',
        disposal_date: '2026-07-20',
      };

      // Q3 period: 2026-07-01 to 2026-09-30. Active only in July (1 month)
      const res = calculateAssetPeriodDepreciation(disposedMidAsset, '2026-07-01', '2026-09-30');
      expect(res.activeMonths).toBe(1);
      expect(res.amount).toBe(5708);
    });

    it('handles immediate write-off (kisértékű eszköz) 100% in activation month and 0 later', () => {
      const smallAsset: FixedAsset = {
        ...baseAsset,
        acquisition_value: 120000,
        residual_value: 0,
        activation_date: '2026-08-10',
        depreciation_method: 'immediate',
      };

      // In August (activation month): 100% written off
      const resAugust = calculateAssetPeriodDepreciation(smallAsset, '2026-08-01', '2026-08-31');
      expect(resAugust.amount).toBe(120000);
      expect(resAugust.remainingBookValue).toBe(0);

      // In September: already written off, returns 0
      const resSept = calculateAssetPeriodDepreciation(smallAsset, '2026-09-01', '2026-09-30');
      expect(resSept.amount).toBe(0);
      expect(resSept.reason).toContain('elszámolva');
    });

    it('caps depreciation at residual value and does not over-depreciate', () => {
      const assetNearEnd: FixedAsset = {
        ...baseAsset,
        acquisition_value: 100000,
        residual_value: 10000, // 90000 depreciable base
        useful_life_months: 10, // 9000 / month
        activation_date: '2025-01-01',
      };

      // By 2025-10-01 (10th month), accumulated is 9 * 9000 = 81000. Remaining base = 9000.
      const resMonth10 = calculateAssetPeriodDepreciation(assetNearEnd, '2025-10-01', '2025-10-31');
      expect(resMonth10.amount).toBe(9000);
      expect(resMonth10.remainingBookValue).toBe(10000);

      // In month 11 (2025-11): fully depreciated, amount must be 0
      const resMonth11 = calculateAssetPeriodDepreciation(assetNearEnd, '2025-11-01', '2025-11-30');
      expect(resMonth11.amount).toBe(0);
      expect(resMonth11.remainingBookValue).toBe(10000);
      expect(resMonth11.reason).toContain('leíródott');
    });
  });

  describe('postDepreciationRunToLedger and idempotency', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('returns error if existing posting already exists for documentId', async () => {
      const { supabase } = await import('@/integrations/supabase/client');

      // Mock existing header returned
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'acc_journal_headers') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            neq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: 'head-existing-1',
                journal_number: 14,
                status: 'KONYVELT',
                posting_date: '2026-08-31',
              },
              error: null,
            }),
          } as any;
        }
        if (table === 'fixed_assets') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            then: (resolve: any) => resolve({ data: [baseAsset], error: null }),
          } as any;
        }
        if (table === 'chart_of_accounts_presets') {
          return {
            select: vi.fn().mockResolvedValue({
              data: [{ id: 'preset-1', company_id: 'comp-1', is_active: true, type: 'custom' }],
              error: null,
            }),
          } as any;
        }
        if (table === 'gl_accounts') {
          return {
            select: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
              data: [
                { id: 'gl-5711', gl_number: '5711', short_name: 'Terv szerinti ÉCS' },
                { id: 'gl-13941', gl_number: '13941', short_name: 'Számítástechnikai ÉCS' },
              ],
              error: null,
            }),
          } as any;
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        } as any;
      });

      const res = await postDepreciationRunToLedger({
        companyId: 'comp-1',
        userId: 'user-1',
        periodType: 'monthly',
        dateFrom: '2026-08-01',
        dateTo: '2026-08-31',
        documentId: 'ECS-2026-08',
      });

      expect(res.success).toBe(false);
      expect(res.message).toContain('már létezik lekönyvelt tétel');
    });

    it('generates balanced journal lines (T = K) and calls acc_post_journal_entry', async () => {
      const { supabase } = await import('@/integrations/supabase/client');

      let insertedHeader: any = null;
      let insertedLines: any[] = [];
      let rpcCallArgs: any = null;

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'chart_of_accounts_presets') {
          return {
            select: vi.fn().mockResolvedValue({
              data: [{ id: 'preset-1', company_id: 'comp-1', is_active: true, type: 'custom' }],
              error: null,
            }),
          } as any;
        }
        if (table === 'gl_accounts') {
          return {
            select: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
              data: [
                { id: 'gl-5711', gl_number: '5711', short_name: 'Terv szerinti ÉCS' },
                { id: 'gl-13941', gl_number: '13941', short_name: 'Számítástechnikai ÉCS' },
              ],
              error: null,
            }),
          } as any;
        }
        if (table === 'fixed_assets') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            then: (resolve: any) => resolve({ data: [baseAsset], error: null }),
          } as any;
        }
        if (table === 'acc_journals') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            then: (resolve: any) => resolve({ data: [{ id: 'jour-ve', code: 'VE', name: 'Vegyes napló' }], error: null }),
          } as any;
        }
        if (table === 'acc_journal_headers') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            neq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }), // no duplicate
            insert: vi.fn().mockImplementation((data: any) => {
              insertedHeader = data;
              return {
                select: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: { id: 'head-new-123' }, error: null }),
              };
            }),
            update: vi.fn().mockReturnThis(),
          } as any;
        }
        if (table === 'acc_journal_lines') {
          return {
            insert: vi.fn().mockImplementation((lines: any) => {
              insertedLines = lines;
              return { error: null };
            }),
          } as any;
        }
        if (table === 'asset_events') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          } as any;
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        } as any;
      });

      vi.mocked(supabase.rpc).mockImplementation((fn: string, args: any) => {
        if (fn === 'acc_post_journal_entry') {
          rpcCallArgs = args;
          return Promise.resolve({ data: null, error: null }) as any;
        }
        return Promise.resolve({ data: null, error: null }) as any;
      });

      const res = await postDepreciationRunToLedger({
        companyId: 'comp-1',
        userId: 'user-1',
        periodType: 'monthly',
        dateFrom: '2026-08-01',
        dateTo: '2026-08-31',
        documentId: 'ECS-2026-08',
      });

      expect(res.success).toBe(true);
      expect(res.totalAmount).toBe(5708);
      expect(res.assetCount).toBe(1);

      // Verify Header
      expect(insertedHeader).not.toBeNull();
      expect(insertedHeader.document_id).toBe('ECS-2026-08');
      expect(insertedHeader.journal_id).toBe('jour-ve');
      expect(insertedHeader.accounting_year).toBe(2026);

      // Verify Lines
      expect(insertedLines.length).toBe(2);
      const debitLine = insertedLines.find(l => l.dc_type === 'T');
      const creditLine = insertedLines.find(l => l.dc_type === 'K');

      expect(debitLine).toBeDefined();
      expect(creditLine).toBeDefined();
      expect(debitLine.amount).toBe(5708);
      expect(creditLine.amount).toBe(5708);
      expect(debitLine.gl_account_id).toBe('gl-5711');
      expect(creditLine.gl_account_id).toBe('gl-13941');

      // Exact double-entry balance: sum(T) === sum(K)
      const sumT = insertedLines.filter(l => l.dc_type === 'T').reduce((acc, l) => acc + l.amount, 0);
      const sumK = insertedLines.filter(l => l.dc_type === 'K').reduce((acc, l) => acc + l.amount, 0);
      expect(sumT).toBe(sumK);

      // Verify RPC call
      expect(rpcCallArgs).toEqual({
        p_header_id: 'head-new-123',
        p_user_id: 'user-1',
      });
    });
  });
});

