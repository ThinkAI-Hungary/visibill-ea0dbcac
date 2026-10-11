import { describe, it, expect, vi, beforeEach } from 'vitest';
import { postAssetActivationToLedger, removeAssetActivationPosting } from '@/lib/fixed-assets/assetActivationAutoPoster';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      from: vi.fn(),
      rpc: vi.fn(),
    },
  };
});

describe('Asset Activation Auto Poster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fails gracefully when acquisitionValue is 0 or negative', async () => {
    const result = await postAssetActivationToLedger({
      companyId: 'comp-1',
      assetId: 'asset-1',
      assetName: 'Laptop',
      inventoryNumber: 'INV-001',
      acquisitionValue: 0,
      activationDate: '2026-05-26',
      glAccountId: 'gl-1341',
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Nincs érvényes aktiválási bekerülési érték');
  });

  it('fails gracefully when glAccountId is missing', async () => {
    const result = await postAssetActivationToLedger({
      companyId: 'comp-1',
      assetId: 'asset-1',
      assetName: 'Laptop',
      inventoryNumber: 'INV-001',
      acquisitionValue: 150000,
      activationDate: '2026-05-26',
      glAccountId: null,
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Nincs megadva eszköz főkönyvi számla');
  });

  it('detects existing posted activation and avoids duplicates', async () => {
    // 1. Mock journals
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'acc_journals') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockImplementation((col, val) => {
            if (col === 'is_active') {
              return Promise.resolve({
                data: [{ id: 've-1', code: 'VE', name: 'Vegyes tételek' }],
              });
            }
            return {
              eq: vi.fn().mockResolvedValue({
                data: [{ id: 've-1', code: 'VE', name: 'Vegyes tételek' }],
              }),
            };
          }),
        };
      }
      if (table === 'chart_of_accounts_presets') {
        return {
          select: vi.fn().mockResolvedValue({
            data: [{ id: 'preset-1', company_id: 'comp-1', is_active: true, type: 'custom' }],
          }),
        };
      }
      if (table === 'companies') {
        return {
          select: vi.fn().mockResolvedValue({
            data: [{ id: 'preset-1', company_id: 'comp-1', is_active: true, type: 'custom' }],
          }),
        };
      }
      if (table === 'gl_accounts') {
        const glData = [{ id: 'gl-161', gl_number: '161', short_name: 'Befejezetlen beruházások' }];
        const builder: any = {
          select: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: glData }),
        };
        builder.select.mockReturnValue(builder);
        builder.or.mockReturnValue(builder);
        builder.eq.mockReturnValue(builder);
        return builder;
      }
      if (table === 'acc_journal_headers') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'hdr-existing', status: 'KONYVELT' },
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };
    });

    (supabase.rpc as any).mockImplementation((fn: string, args: any) => {
      if (fn === 'post_asset_activation_to_gl') {
        return Promise.resolve({
          data: {
            success: true,
            header_id: 'hdr-existing',
            message: 'Az eszköz aktiválása már korábban le lett könyvelve (JK-E-PRIME-2026-6772 - 2609 - 0001).',
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const result = await postAssetActivationToLedger({
      companyId: 'comp-1',
      assetId: 'asset-1',
      assetName: 'Samsung S26',
      inventoryNumber: 'E-PRIME-2026-6772 - 2609 - 0001',
      acquisitionValue: 205496,
      activationDate: '2026-05-26',
      glAccountId: 'gl-1341',
    });

    expect(result.success).toBe(true);
    expect(result.headerId).toBe('hdr-existing');
    expect(result.message).toContain('már korábban le lett könyvelve');
    expect(supabase.rpc).toHaveBeenCalledWith('post_asset_activation_to_gl', expect.objectContaining({
      p_company_id: 'comp-1',
      p_asset_id: 'asset-1',
      p_asset_name: 'Samsung S26',
      p_acquisition_value: 205496,
    }));
  });

  it('removes asset activation posting via remove_asset_activation_from_gl RPC', async () => {
    (supabase.rpc as any).mockResolvedValue({
      data: { success: true, message: 'Aktiválás sikeresen sztornózva.' },
      error: null,
    });

    const result = await removeAssetActivationPosting('comp-1', 'INV-001');

    expect(result.success).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith('remove_asset_activation_from_gl', {
      p_company_id: 'comp-1',
      p_inventory_number: 'INV-001',
    });
  });
});
