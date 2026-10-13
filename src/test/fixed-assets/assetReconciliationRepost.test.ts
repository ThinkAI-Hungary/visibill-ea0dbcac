import { describe, it, expect, vi, beforeEach } from 'vitest';
import { repostUnpostedAssets } from '../../lib/fixed-assets/assetReconciliationService';
import { postAssetActivationToLedger } from '../../lib/fixed-assets/assetActivationAutoPoster';
import type { FixedAsset } from '../../types/fixed-assets';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

vi.mock('../../lib/fixed-assets/assetActivationAutoPoster', () => ({
  postAssetActivationToLedger: vi.fn(),
}));

function asset(id: string, overrides: Partial<FixedAsset> = {}): FixedAsset {
  return {
    id,
    inventory_number: `INV-${id}`,
    name: `Eszköz ${id}`,
    acquisition_value: 100000,
    activation_date: '2026-03-01',
    currency: 'HUF',
    gl_account_id: 'gl-13',
    ...overrides,
  } as FixedAsset;
}

describe('repostUnpostedAssets', () => {
  beforeEach(() => {
    vi.mocked(postAssetActivationToLedger).mockReset();
  });

  it('posts every selected asset sequentially and reports progress', async () => {
    vi.mocked(postAssetActivationToLedger).mockResolvedValue({ success: true, message: 'ok' });
    const progress: Array<[number, number]> = [];

    const results = await repostUnpostedAssets(
      'comp-1',
      [asset('a'), asset('b')],
      ['a', 'b'],
      (d, t) => progress.push([d, t]),
    );

    expect(results.map((r) => r.success)).toEqual([true, true]);
    expect(progress).toEqual([[1, 2], [2, 2]]);
    expect(postAssetActivationToLedger).toHaveBeenCalledTimes(2);
    expect(postAssetActivationToLedger).toHaveBeenNthCalledWith(1, {
      companyId: 'comp-1',
      assetId: 'a',
      assetName: 'Eszköz a',
      inventoryNumber: 'INV-a',
      acquisitionValue: 100000,
      activationDate: '2026-03-01',
      currency: 'HUF',
      glAccountId: 'gl-13',
    });
  });

  it('continues after a failure and surfaces the error message', async () => {
    vi.mocked(postAssetActivationToLedger)
      .mockResolvedValueOnce({ success: false, message: 'Nincs jogosultság' })
      .mockResolvedValueOnce({ success: true });

    const results = await repostUnpostedAssets('comp-1', [asset('a'), asset('b')], ['a', 'b']);

    expect(results[0]).toMatchObject({ assetId: 'a', success: false, message: 'Nincs jogosultság' });
    expect(results[1]).toMatchObject({ assetId: 'b', success: true });
  });

  it('skips assets without activation date or unknown ids without calling the RPC', async () => {
    const results = await repostUnpostedAssets(
      'comp-1',
      [asset('a', { activation_date: null })],
      ['a', 'missing'],
    );

    expect(postAssetActivationToLedger).not.toHaveBeenCalled();
    expect(results[0]).toMatchObject({ success: false, message: 'Hiányzó aktiválási dátum.' });
    expect(results[1]).toMatchObject({ success: false, message: 'Az eszköz nem található.' });
  });
});
