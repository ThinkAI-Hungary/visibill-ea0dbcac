import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildAssetReconciliationReport,
  computeExpectedAccumulated,
  fetchAssetReconciliationRpc,
  getDepreciationCutoff,
  type ReconAssetGlRow,
  type ReconRpcResult,
} from '../../lib/fixed-assets/assetReconciliationService';
import type { FixedAsset } from '../../types/fixed-assets';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

function makeAsset(overrides: Partial<FixedAsset> = {}): FixedAsset {
  return {
    id: 'asset-1',
    company_id: 'comp-1',
    user_id: 'user-1',
    inventory_number: 'ESZK-001',
    name: 'Laptop',
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
    disposal_status: 'none',
    disposal_reason_type: null,
    disposal_committee: null,
    disposal_waste_info: null,
    disposal_details: null,
    disposal_journal_entry_id: null,
    ...overrides,
  } as FixedAsset;
}

function glRow(overrides: Partial<ReconAssetGlRow> = {}): ReconAssetGlRow {
  return {
    asset_id: 'asset-1',
    inventory_number: 'ESZK-001',
    name: 'Laptop',
    status: 'active',
    activation_date: '2026-05-26',
    disposal_date: null,
    acquisition_value: 205496,
    expected_gross: 205496,
    gl_gross: 205496,
    gl_accum: 0,
    gl_cip: -205496,
    gross_line_count: 1,
    first_gross_posting_date: '2026-05-26',
    issue: 'ok',
    ...overrides,
  };
}

function rpcResult(rows: ReconAssetGlRow[], overrides: Partial<ReconRpcResult> = {}): ReconRpcResult {
  const glGross = rows.reduce((s, r) => s + r.gl_gross, 0);
  const analytic = rows.reduce((s, r) => s + r.expected_gross, 0);
  const glAccum = rows.reduce((s, r) => s + r.gl_accum, 0);
  return {
    company_id: 'comp-1',
    as_of: '2026-08-31',
    totals: {
      gross: { gl: glGross, gl_tagged: glGross, gl_untagged: 0, analytic, difference: glGross - analytic },
      accum: { gl: glAccum, gl_tagged: glAccum, gl_untagged: 0 },
      cip: { gl: 0, gl_tagged: 0, gl_untagged: 0 },
    },
    root_causes: {
      unposted_assets: { count: 0, amount: 0 },
      orphan_gl_lines: { count: 0, amount: 0 },
      period_mismatches: { count: 0, amount: 0 },
      value_mismatches: { count: 0, amount: 0 },
    },
    counts: { assets_total: rows.length, assets_ok: rows.filter((r) => r.issue === 'ok').length },
    assets: rows,
    orphans: [],
    ...overrides,
  };
}

describe('getDepreciationCutoff', () => {
  it('keeps a month-end date as is', () => {
    expect(getDepreciationCutoff('2026-08-31')).toBe('2026-08-31');
    expect(getDepreciationCutoff('2026-02-28')).toBe('2026-02-28');
  });

  it('uses the previous month end for a mid-month date', () => {
    expect(getDepreciationCutoff('2026-09-15')).toBe('2026-08-31');
    expect(getDepreciationCutoff('2026-03-10')).toBe('2026-02-28');
  });

  it('crosses the year boundary and handles leap years', () => {
    expect(getDepreciationCutoff('2026-01-10')).toBe('2025-12-31');
    expect(getDepreciationCutoff('2024-03-15')).toBe('2024-02-29');
  });
});

describe('computeExpectedAccumulated', () => {
  it('sums whole months (rounded monthly) from the activation month up to the cutoff', () => {
    // 205496 / 36 = 5708.22 → 5708 / hó; máj–aug = 4 hónap
    expect(computeExpectedAccumulated(makeAsset(), '2026-08-31')).toBe(4 * 5708);
  });

  it('is zero when the asset is not activated yet at the cutoff', () => {
    expect(computeExpectedAccumulated(makeAsset(), '2026-04-30')).toBe(0);
    expect(computeExpectedAccumulated(makeAsset({ activation_date: null }), '2026-08-31')).toBe(0);
  });

  it('writes off immediately-depreciated assets in full', () => {
    const asset = makeAsset({ depreciation_method: 'immediate', acquisition_value: 150000 });
    expect(computeExpectedAccumulated(asset, '2026-08-31')).toBe(150000);
  });

  it('never exceeds the depreciable base', () => {
    const asset = makeAsset({ useful_life_months: 12, acquisition_value: 12000, activation_date: '2020-01-10' });
    expect(computeExpectedAccumulated(asset, '2026-08-31')).toBe(12000);
  });
});

describe('buildAssetReconciliationReport', () => {
  it('reports full reconciliation when GL gross and accumulated depreciation match the analytics', () => {
    const asset = makeAsset();
    const rows = [glRow({ gl_accum: 4 * 5708 })];
    const report = buildAssetReconciliationReport(rpcResult(rows), [asset], '2026-08-31');

    expect(report.gross.status).toBe('OK');
    expect(report.accum.status).toBe('OK');
    expect(report.accum.analytic).toBe(22832);
    expect(report.assets[0].accum_issue).toBe('ok');
    expect(report.isFullyReconciled).toBe(true);
    expect(report.depreciationCutoff).toBe('2026-08-31');
  });

  it('flags depreciation that was never posted (ÉCS unposted)', () => {
    const asset = makeAsset();
    const rows = [glRow({ gl_accum: 0 })];
    const report = buildAssetReconciliationReport(rpcResult(rows), [asset], '2026-08-31');

    expect(report.assets[0].accum_issue).toBe('unposted_depreciation');
    expect(report.accum.status).toBe('DISCREPANCY');
    expect(report.accum.difference).toBe(-22832);
    expect(report.rootCauses.unposted_depreciation).toEqual({ count: 1, amount: 22832 });
    expect(report.isFullyReconciled).toBe(false);
  });

  it('distinguishes under- and over-posted depreciation', () => {
    const a1 = makeAsset({ id: 'a1', inventory_number: 'A1' });
    const a2 = makeAsset({ id: 'a2', inventory_number: 'A2' });
    const rows = [
      glRow({ asset_id: 'a1', inventory_number: 'A1', gl_accum: 5708 }),
      glRow({ asset_id: 'a2', inventory_number: 'A2', gl_accum: 30000 }),
    ];
    const report = buildAssetReconciliationReport(rpcResult(rows), [a1, a2], '2026-08-31');

    expect(report.assets.find((r) => r.asset_id === 'a1')?.accum_issue).toBe('under_posted');
    expect(report.assets.find((r) => r.asset_id === 'a2')?.accum_issue).toBe('over_posted');
    expect(report.rootCauses.accum_mismatches.count).toBe(2);
  });

  it('collects unposted assets as repostable and keeps gross discrepancy from the RPC', () => {
    const asset = makeAsset();
    const rows = [glRow({ gl_gross: 0, gl_cip: 0, gl_accum: 0, gross_line_count: 0, first_gross_posting_date: null, issue: 'unposted' })];
    const rpc = rpcResult(rows, {
      root_causes: {
        unposted_assets: { count: 1, amount: 205496 },
        orphan_gl_lines: { count: 0, amount: 0 },
        period_mismatches: { count: 0, amount: 0 },
        value_mismatches: { count: 0, amount: 0 },
      },
    });
    const report = buildAssetReconciliationReport(rpc, [asset], '2026-08-31');

    expect(report.repostableAssetIds).toEqual(['asset-1']);
    expect(report.gross.difference).toBe(-205496);
    expect(report.gross.status).toBe('DISCREPANCY');
    expect(report.rootCauses.unposted_assets.amount).toBe(205496);
  });

  it('tolerates sub-forint rounding noise', () => {
    const asset = makeAsset();
    const rows = [glRow({ gl_accum: 4 * 5708 + 0.4 })];
    const report = buildAssetReconciliationReport(rpcResult(rows), [asset], '2026-08-31');

    expect(report.assets[0].accum_issue).toBe('ok');
    expect(report.accum.status).toBe('OK');
  });

  it('treats an asset missing from the analytics list as zero expected depreciation', () => {
    const rows = [glRow({ gl_accum: 1000 })];
    const report = buildAssetReconciliationReport(rpcResult(rows), [], '2026-08-31');
    expect(report.assets[0].expected_accum).toBe(0);
    expect(report.assets[0].accum_issue).toBe('over_posted');
  });

  it('exposes untagged GL balances and orphan lines for the worksheet', () => {
    const rpc = rpcResult([], {
      totals: {
        gross: { gl: 500000, gl_tagged: 0, gl_untagged: 500000, analytic: 0, difference: 500000 },
        accum: { gl: 20000, gl_tagged: 0, gl_untagged: 20000 },
        cip: { gl: 100000, gl_tagged: 0, gl_untagged: 100000 },
      },
      orphans: [
        {
          line_id: 'l1',
          header_id: 'h1',
          posting_date: '2026-03-01',
          document_id: 'LEGACY-1',
          gl_number: '1341',
          cls: 'gross',
          dc_type: 'T',
          amount: 500000,
          signed_amount: 500000,
          description: null,
        },
      ],
    });
    const report = buildAssetReconciliationReport(rpc, [], '2026-08-31');

    expect(report.orphans).toHaveLength(1);
    expect(report.accum.glUntagged).toBe(20000);
    expect(report.cip.glUntagged).toBe(100000);
    // Az orphan összeg mindhárom osztály (bruttó 500 000 + ÉCS 20 000 + 161: 100 000) abszolút egyenlege
    expect(report.rootCauses.orphan_gl_lines.amount).toBe(620000);
    expect(report.isFullyReconciled).toBe(false);
  });
});

describe('fetchAssetReconciliationRpc', () => {
  beforeEach(() => {
    vi.mocked(supabase.rpc).mockReset();
  });

  it('calls the reconciliation RPC with the documented parameter names', async () => {
    const payload = rpcResult([]);
    vi.mocked(supabase.rpc).mockResolvedValue({ data: payload, error: null } as never);

    const result = await fetchAssetReconciliationRpc('comp-1', '2026-08-31');

    expect(supabase.rpc).toHaveBeenCalledWith('reconcile_fixed_assets_with_gl', {
      p_company_id: 'comp-1',
      p_date: '2026-08-31',
    });
    expect(result).toBe(payload);
  });

  it('throws when the RPC fails', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: new Error('42501') } as never);
    await expect(fetchAssetReconciliationRpc('comp-1', '2026-08-31')).rejects.toThrow('42501');
  });
});
