import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  formatUnplannedDepreciationDocId,
  validateUnplannedDepreciation,
  postUnplannedDepreciationToLedger,
} from '@/lib/fixed-assets/unplannedDepreciationService';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe('unplannedDepreciationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('formatUnplannedDepreciationDocId', () => {
    it('generates correct formatted document IDs with 4-digit sequence padding', () => {
      expect(formatUnplannedDepreciationDocId(2026, 1)).toBe('TF-ÉCS-2026-0001');
      expect(formatUnplannedDepreciationDocId(2026, 42)).toBe('TF-ÉCS-2026-0042');
      expect(formatUnplannedDepreciationDocId(2025, 1205)).toBe('TF-ÉCS-2025-1205');
    });
  });

  describe('validateUnplannedDepreciation', () => {
    it('rejects invalid or non-positive amounts', () => {
      const res1 = validateUnplannedDepreciation({
        eventType: 'unplanned_depreciation',
        amount: 0,
        currentBookValue: 500000,
      });
      expect(res1.valid).toBe(false);
      expect(res1.error).toContain('0-nál nagyobb');

      const res2 = validateUnplannedDepreciation({
        eventType: 'unplanned_depreciation',
        amount: -50000,
        currentBookValue: 500000,
      });
      expect(res2.valid).toBe(false);
    });

    it('rejects write-down exceeding current book value minus residual value', () => {
      const res = validateUnplannedDepreciation({
        eventType: 'unplanned_depreciation',
        amount: 600000,
        currentBookValue: 500000,
        residualValue: 50000, // Max leírható: 450 000 Ft
      });
      expect(res.valid).toBe(false);
      expect(res.error).toContain('nem haladhatja meg');
    });

    it('accepts valid write-down within limits', () => {
      const res = validateUnplannedDepreciation({
        eventType: 'unplanned_depreciation',
        amount: 400000,
        currentBookValue: 500000,
        residualValue: 50000,
      });
      expect(res.valid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it('rejects reversal exceeding previously recognized write-down', () => {
      const res = validateUnplannedDepreciation({
        eventType: 'unplanned_depreciation_reversal',
        amount: 300000,
        currentBookValue: 200000,
        previouslyRecognizedUnplanned: 250000,
      });
      expect(res.valid).toBe(false);
      expect(res.error).toContain('nem haladhatja meg a korábban elszámolt');
    });

    it('accepts valid reversal within recognized bounds', () => {
      const res = validateUnplannedDepreciation({
        eventType: 'unplanned_depreciation_reversal',
        amount: 150000,
        currentBookValue: 200000,
        previouslyRecognizedUnplanned: 250000,
      });
      expect(res.valid).toBe(true);
    });
  });

  describe('postUnplannedDepreciationToLedger', () => {
    it('returns error if missing required parameters', async () => {
      const res = await postUnplannedDepreciationToLedger({
        companyId: '',
        assetId: 'asset-1',
        eventType: 'unplanned_depreciation',
        amount: 100000,
        postingDate: '2026-10-16',
        documentId: 'TF-ÉCS-2026-0001',
        reason: 'Káresemény miatti értékvesztés',
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain('Hiányzó cég');
    });

    it('calls post_unplanned_depreciation_to_gl RPC and returns success data', async () => {
      const mockRpcResponse = {
        data: {
          success: true,
          header_id: 'hdr-123',
          journal_number: 84,
          amount: 120000,
          message: 'Sikeres ÉCS könyvelés!',
        },
        error: null,
      };

      (supabase.rpc as any).mockResolvedValue(mockRpcResponse);

      const res = await postUnplannedDepreciationToLedger({
        companyId: 'comp-1',
        assetId: 'asset-1',
        eventType: 'unplanned_depreciation',
        amount: 120000,
        postingDate: '2026-10-16',
        documentId: 'TF-ÉCS-2026-0001',
        reason: 'Sérülés miatti rendkívüli értékvesztés',
      });

      expect(supabase.rpc).toHaveBeenCalledWith('post_unplanned_depreciation_to_gl', {
        p_company_id: 'comp-1',
        p_asset_id: 'asset-1',
        p_event_type: 'unplanned_depreciation',
        p_amount: 120000,
        p_posting_date: '2026-10-16',
        p_document_id: 'TF-ÉCS-2026-0001',
        p_reason: 'Sérülés miatti rendkívüli értékvesztés',
        p_currency: 'HUF',
      });

      expect(res.success).toBe(true);
      expect(res.headerId).toBe('hdr-123');
      expect(res.journalNumber).toBe(84);
    });

    it('handles RPC errors properly', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: null,
        error: { message: 'Nincs jogosultsága a könyveléshez' },
      });

      const res = await postUnplannedDepreciationToLedger({
        companyId: 'comp-1',
        assetId: 'asset-1',
        eventType: 'unplanned_depreciation',
        amount: 120000,
        postingDate: '2026-10-16',
        documentId: 'TF-ÉCS-2026-0001',
        reason: 'Teszt',
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('Nincs jogosultsága a könyveléshez');
    });
  });
});
