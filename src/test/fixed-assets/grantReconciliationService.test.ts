import { describe, it, expect } from 'vitest';
import {
  calculateGrantReconciliation,
} from '@/lib/fixed-assets/grantReconciliationService';
import type { FixedAsset, FixedAssetComponent, GrantProject } from '@/types/fixed-assets';

describe('Grant Reconciliation Service - 4-Way Reconciliation (M3.4)', () => {
  const mockProjects: GrantProject[] = [
    {
      id: 'proj-ginop-1',
      company_id: 'c1',
      name: 'GINOP Ipar 4.0 Fejlesztés',
      code: 'GINOP-4.1.2-2026',
      grantor: 'NGM',
      contract_number: 'GINOP-001',
      eligible_cost: 20_000_000,
      grant_amount: 14_000_000,
      intensity_rate: 70.0,
      own_contribution: 6_000_000,
      advance_amount: 2_000_000,
      disbursed_amount: 14_000_000,
      maintenance_period_years: 3,
      maintenance_end_date: '2029-01-01',
      status: 'active',
      notes: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  ];

  const mockAssets: FixedAsset[] = [
    {
      id: 'asset-1',
      company_id: 'c1',
      user_id: 'u1',
      inventory_number: 'TE-001',
      name: 'Megmunkáló központ',
      description: null,
      vtsz_teszor: null,
      acquisition_value: 10_000_000,
      residual_value: 0,
      currency: 'HUF',
      purchase_date: '2026-01-10',
      activation_date: '2026-01-15',
      disposal_date: null,
      useful_life_months: 60,
      depreciation_method: 'linear',
      performance_unit: null,
      total_planned_performance: null,
      depreciation_schedule: null,
      tao_template_id: null,
      tao_rate_override: null,
      location_id: null,
      project_id: null,
      activated_by_user_id: null,
      activated_by_name: null,
      gl_account_id: null,
      development_reserve_id: null,
      development_reserve_amount: 0,
      source_invoice_id: null,
      source_invoice_type: null,
      source_invoice_number: null,
      supplier_name: null,
      status: 'active',
      disposal_status: 'none',
      disposal_reason_type: null,
      disposal_committee: null,
      disposal_waste_info: null,
      disposal_details: null,
      disposal_journal_entry_id: null,
      documents: [],
      created_at: '2026-01-15T10:00:00Z',
      updated_at: '2026-01-15T10:00:00Z',
      grant_project_id: 'proj-ginop-1',
    },
  ];

  const mockComponents: FixedAssetComponent[] = [
    {
      id: 'comp-1',
      company_id: 'c1',
      fixed_asset_id: 'asset-1',
      name: 'Alapgép',
      component_type: 'initial',
      activation_date: '2026-01-15',
      gross_value: 10_000_000,
      grant_project_id: 'proj-ginop-1',
      grant_funding_amount: 7_000_000,
      own_funding_amount: 3_000_000,
      grant_ratio_percent: 70.0,
      useful_life_months: 60,
      depreciation_rate: 20,
      gl_asset_account: null,
      notes: null,
      created_at: '2026-01-15T10:00:00Z',
      updated_at: '2026-01-15T10:00:00Z',
    },
  ];

  it('calculates balanced state when pillars match perfectly', () => {
    // 7,000,000 Ft elhatárolásból 700,000 Ft feloldva 964-re -> Várható 483 egyenleg: 6,300,000 Ft
    const result = calculateGrantReconciliation(
      mockProjects,
      mockAssets,
      mockComponents,
      6_300_000, // gl483Balance
      700_000    // gl964Turnover
    );

    expect(result.pillars.grantContract.totalGrantAmount).toBe(14_000_000);
    expect(result.pillars.assetAnalytics.totalAllocatedGrantAmount).toBe(7_000_000);
    expect(result.pillars.assetAnalytics.totalAllocatedOwnAmount).toBe(3_000_000);
    expect(result.pillars.assetAnalytics.effectiveGrantRatioPercent).toBe(70.0);
    expect(result.pillars.deferralAnalytics.expectedRemainingPie).toBe(6_300_000);
    expect(result.pillars.deferralAnalytics.pieDiscrepancy).toBe(0);
    expect(result.isBalanced).toBe(true);
    expect(result.alerts).toHaveLength(0);
  });

  it('triggers alert when allocated grant exceeds contract budget', () => {
    // Tegyük fel, hogy a projekt kerete csak 5,000,000 Ft, de 7,000,000 Ft-ot allokáltunk
    const smallBudgetProjects: GrantProject[] = [
      {
        ...mockProjects[0],
        grant_amount: 5_000_000,
      },
    ];

    const result = calculateGrantReconciliation(
      smallBudgetProjects,
      mockAssets,
      mockComponents,
      5_000_000,
      0
    );

    expect(result.alerts.some(a => a.id === 'grant-overallocated')).toBe(true);
    expect(result.isBalanced).toBe(false);
  });

  it('triggers warning when GL 483 balance differs from analytical expected PIE', () => {
    const result = calculateGrantReconciliation(
      mockProjects,
      mockAssets,
      mockComponents,
      5_000_000, // Eltér a várt 6,300,000-től
      700_000
    );

    expect(result.pillars.deferralAnalytics.pieDiscrepancy).toBe(1_300_000);
    expect(result.alerts.some(a => a.id === 'pie-mismatch')).toBe(true);
    expect(result.isBalanced).toBe(false);
  });

  it('triggers maintenance violation alert if an asset is disposed during active maintenance period', () => {
    const disposedAssets: FixedAsset[] = [
      {
        ...mockAssets[0],
        status: 'sold',
        disposal_status: 'approved',
      },
    ];

    const result = calculateGrantReconciliation(
      mockProjects,
      disposedAssets,
      mockComponents,
      6_300_000,
      700_000
    );

    expect(result.alerts.some(a => a.id.startsWith('maintenance-violation'))).toBe(true);
    expect(result.isBalanced).toBe(false);
  });
});
