import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateGrantDeferralReleaseAmount,
  resolveGrantDeferralAccounts,
  postGrantDeferralReleaseToLedger,
} from '@/lib/fixed-assets/grantDeferralPostingService';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe('Grant Deferral Posting Service (M3.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateGrantDeferralReleaseAmount', () => {
    it('calculates exact grant-proportional release according to Sztv. 45. § (2)', () => {
      expect(calculateGrantDeferralReleaseAmount(100_000, 70.0)).toBe(70_000);
      expect(calculateGrantDeferralReleaseAmount(250_000, 56.45)).toBe(141_125);
      expect(calculateGrantDeferralReleaseAmount(83_333, 49.0)).toBe(40_833);
    });

    it('returns 0 for non-grant funded assets or zero depreciation', () => {
      expect(calculateGrantDeferralReleaseAmount(150_000, 0)).toBe(0);
      expect(calculateGrantDeferralReleaseAmount(0, 70.0)).toBe(0);
      expect(calculateGrantDeferralReleaseAmount(-50_000, 70.0)).toBe(0);
    });

    it('adjusts rounding discrepancies to match remaining unreleased grant (Option A)', () => {
      // Számított: 100_000 * 50% = 50_000 Ft. Ha a maradék 50_003 Ft (±3 Ft eltérés 5 év alatt), igazítsa a maradékhoz
      expect(calculateGrantDeferralReleaseAmount(100_000, 50.0, 50_003)).toBe(50_003);
      // Ha a számított nagyobb, mint a fennmaradó keret (pl. 50_000 > 49_998), ne lépje túl a maradékot
      expect(calculateGrantDeferralReleaseAmount(100_000, 50.0, 49_998)).toBe(49_998);
      // Ha utolsó periódus (isFinalPeriod), pontosan a maradékot oldja fel
      expect(calculateGrantDeferralReleaseAmount(100_000, 50.0, 48_500, true)).toBe(48_500);
      // Ha a maradék jóval több (nem kerekítési zóna), normál számítás
      expect(calculateGrantDeferralReleaseAmount(100_000, 50.0, 800_000)).toBe(50_000);
    });
  });

  describe('fetchAvailableGrantAccounts', () => {
    it('fetches and categorizes 483 and 964 accounts', async () => {
      const mockAccounts = [
        { id: 'acc-4831', gl_number: '4831', short_name: 'Fejlesztési elhatárolás', company_id: 'c1' },
        { id: 'acc-4832', gl_number: '4832', short_name: 'GINOP elhatárolás', company_id: 'c1' },
        { id: 'acc-9641', gl_number: '9641', short_name: 'Támogatási bevétel', company_id: 'c1' },
      ];

      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockAccounts, error: null }),
            }),
          }),
        }),
      });

      const res = await (await import('@/lib/fixed-assets/grantDeferralPostingService')).fetchAvailableGrantAccounts('c1');
      expect(res.accounts483).toHaveLength(2);
      expect(res.accounts964).toHaveLength(1);
      expect(res.default483Id).toBe('acc-4831');
      expect(res.default964Id).toBe('acc-9641');
    });
  });

  describe('postGrantDeferralReleaseToLedger', () => {
    it('enriches error messages when chart of accounts is missing 483 or 964', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: null,
        error: { message: 'Hiányzó 483 vagy 964 főkönyvi számla' },
      });

      const res = await postGrantDeferralReleaseToLedger({
        companyId: 'comp-100',
        assetId: 'asset-100',
        periodDate: '2026-12-31',
        depreciationAmount: 100_000,
        grantRatioPercent: 70.0,
        gl483Id: 'gl-483-uuid',
        gl964Id: 'gl-964-uuid',
      });

      expect(res.success).toBe(false);
      expect(res.message).toContain('Hiányzó főkönyvi számla a cégnél (483 vagy 964)');
      expect(res.message).toContain('Számlatükörbe a Beállítások menüben');
    });

    it('invokes post_grant_deferral_release_to_gl RPC with verified parameters', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: {
          success: true,
          header_id: 'header-999',
          journal_number: 42,
          document_id: 'PIE-FELOLD-TE_001-202612',
          release_amount: 70_000,
          message: 'Sikeresen lekönyvelve',
        },
        error: null,
      });

      const res = await postGrantDeferralReleaseToLedger({
        companyId: 'comp-100',
        assetId: 'asset-100',
        grantProjectId: 'grant-proj-1',
        periodDate: '2026-12-31',
        depreciationAmount: 100_000,
        grantRatioPercent: 70.0,
        gl483Id: 'gl-483-uuid',
        gl964Id: 'gl-964-uuid',
        notes: 'Év végi automatikus elhatárolás zárás',
      });

      expect(supabase.rpc).toHaveBeenCalledWith(
        'post_grant_deferral_release_to_gl',
        expect.objectContaining({
          p_company_id: 'comp-100',
          p_asset_id: 'asset-100',
          p_grant_project_id: 'grant-proj-1',
          p_period_date: '2026-12-31',
          p_depreciation_amount: 100_000,
          p_release_amount: 70_000,
          p_gl_483_id: 'gl-483-uuid',
          p_gl_964_id: 'gl-964-uuid',
          p_notes: 'Év végi automatikus elhatárolás zárás',
        })
      );

      expect(res.success).toBe(true);
      expect(res.headerId).toBe('header-999');
      expect(res.journalNumber).toBe(42);
      expect(res.releaseAmount).toBe(70_000);
    });

    it('rejects posting when release amount is 0 or negative', async () => {
      const res = await postGrantDeferralReleaseToLedger({
        companyId: 'comp-100',
        assetId: 'asset-100',
        periodDate: '2026-12-31',
        depreciationAmount: 0,
        grantRatioPercent: 70.0,
        gl483Id: 'gl-483-uuid',
        gl964Id: 'gl-964-uuid',
      });

      expect(res.success).toBe(false);
      expect(res.message).toContain('nem lehet 0 vagy negatív');
      expect(supabase.rpc).not.toHaveBeenCalled();
    });
  });
});
