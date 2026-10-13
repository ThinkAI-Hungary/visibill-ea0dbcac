import { describe, it, expect } from 'vitest';
import {
  calculateElapsedMonths,
  calculateAssetComponentsDepreciation,
} from '@/lib/fixed-assets/assetComponentCalculator';
import type { FixedAsset, FixedAssetComponent } from '@/types/fixed-assets';

describe('Asset Component Calculator (M3.2)', () => {
  const mockBaseAsset: FixedAsset = {
    id: 'asset-001',
    company_id: 'comp-100',
    user_id: 'user-100',
    inventory_number: 'TE-2026-0001',
    name: 'CNC Megmunkáló Központ 5-tengelyes',
    description: 'Nagy pontosságú ipari marógép',
    vtsz_teszor: '84571090',
    acquisition_value: 10_000_000,
    residual_value: 0,
    currency: 'HUF',
    purchase_date: '2025-01-10',
    activation_date: '2025-01-15',
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
    created_at: '2025-01-10T10:00:00Z',
    updated_at: '2025-01-10T10:00:00Z',
  };

  it('calculates elapsed months correctly between dates', () => {
    expect(calculateElapsedMonths('2025-01-15', '2025-01-15')).toBe(1);
    expect(calculateElapsedMonths('2025-01-15', '2025-07-15')).toBe(7);
    expect(calculateElapsedMonths('2025-01-15', '2026-01-15')).toBe(13);
  });

  it('provides default single-component calculation when no sub-components are attached', () => {
    const result = calculateAssetComponentsDepreciation(mockBaseAsset, [], '2025-07-15');

    expect(result.hasComponents).toBe(false);
    expect(result.totalGrossValue).toBe(10_000_000);
    expect(result.monthlyDepreciation).toBe(Math.round(10_000_000 / 60)); // ~166667
    expect(result.componentsBreakdown).toHaveLength(1);
    expect(result.componentsBreakdown[0].componentId).toBe('primary-asset');
    expect(result.effectiveGrantRatio).toBe(0);
  });

  it('calculates multi-component depreciation with mixed funding and differing activation dates', () => {
    const components: FixedAssetComponent[] = [
      {
        id: 'comp-main',
        company_id: 'comp-100',
        fixed_asset_id: 'asset-001',
        name: 'Alapgép és szerszámtár',
        component_type: 'initial',
        activation_date: '2025-01-15',
        gross_value: 7_000_000,
        grant_project_id: 'grant-ginop-01',
        grant_funding_amount: 4_900_000, // 70% grant
        own_funding_amount: 2_100_000, // 30% own
        grant_ratio_percent: 70.0,
        useful_life_months: 60,
        depreciation_rate: 20,
        gl_asset_account: null,
        notes: null,
        created_at: '2025-01-15T10:00:00Z',
        updated_at: '2025-01-15T10:00:00Z',
      },
      {
        id: 'comp-upgrade',
        company_id: 'comp-100',
        fixed_asset_id: 'asset-001',
        name: 'Utólagos Nagy Pontosságú Mérőfej',
        component_type: 'upgrade',
        activation_date: '2026-01-15', // 12 hónappal később aktiválva!
        gross_value: 3_000_000,
        grant_project_id: null,
        grant_funding_amount: 0, // 100% saját erő
        own_funding_amount: 3_000_000,
        grant_ratio_percent: 0,
        useful_life_months: 36, // Eltérő hasznos élettartam!
        depreciation_rate: 33.33,
        gl_asset_account: null,
        notes: null,
        created_at: '2026-01-15T10:00:00Z',
        updated_at: '2026-01-15T10:00:00Z',
      },
    ];

    // Számítás 2026-07-15 fordulónapra:
    // comp-main eltelt: 19 hónap
    // comp-upgrade eltelt: 7 hónap
    const result = calculateAssetComponentsDepreciation(mockBaseAsset, components, '2026-07-15');

    expect(result.hasComponents).toBe(true);
    expect(result.totalGrossValue).toBe(10_000_000);
    expect(result.totalGrantFunding).toBe(4_900_000);
    expect(result.totalOwnFunding).toBe(5_100_000);
    expect(result.effectiveGrantRatio).toBe(49.0); // 4.9M / 10M

    // Alapgép havi ÉCS: 7_000_000 / 60 = 116_667 Ft
    // Ebből támogatási hányad (70%): 81_667 Ft
    // Bővítés havi ÉCS: 3_000_000 / 36 = 83_333 Ft (0% támogatás)
    expect(result.monthlyDepreciation).toBe(116_667 + 83_333);
    expect(result.monthlyGrantDepreciation).toBe(81_667);
    expect(result.monthlyOwnDepreciation).toBe(result.monthlyDepreciation - 81_667);

    // Komponens szintű bontások ellenőrzése
    expect(result.componentsBreakdown).toHaveLength(2);
    const mainComp = result.componentsBreakdown.find(c => c.componentId === 'comp-main')!;
    const upgradeComp = result.componentsBreakdown.find(c => c.componentId === 'comp-upgrade')!;

    expect(mainComp.elapsedMonths).toBe(19);
    expect(upgradeComp.elapsedMonths).toBe(7);

    expect(mainComp.accumulatedGrantDepreciation).toBeGreaterThan(0);
    expect(upgradeComp.accumulatedGrantDepreciation).toBe(0);
    expect(upgradeComp.grantNetBookValue).toBe(0);
    expect(upgradeComp.ownNetBookValue).toBe(3_000_000 - (83_333 * 7));
  });
});
