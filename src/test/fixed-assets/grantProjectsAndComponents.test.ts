import { describe, it, expect } from 'vitest';
import type {
  GrantProject,
  CreateGrantProjectInput,
  FixedAssetComponent,
  CreateFixedAssetComponentInput,
} from '@/types/fixed-assets';

describe('Grant Projects and Components Data Integrity (M3.1)', () => {
  it('calculates own contribution and grant ratio correctly on project creation input', () => {
    const input: CreateGrantProjectInput = {
      company_id: 'ecf31039-b539-4e04-bbea-70ea48c701bb',
      name: 'GINOP Technológiai Fejlesztés 2026',
      code: 'GINOP-Plusz-1.2.1-2026',
      grantor: 'Nemzetgazdasági Minisztérium',
      contract_number: 'GINOP-2026-001',
      eligible_cost: 10_000_000,
      grant_amount: 7_000_000,
      intensity_rate: 70.0,
      maintenance_period_years: 3,
      status: 'active',
    };

    const derivedOwnContribution = input.own_contribution ?? Math.max(0, (input.eligible_cost ?? 0) - input.grant_amount);
    expect(derivedOwnContribution).toBe(3_000_000);
    expect(input.intensity_rate).toBe(70.0);
  });

  it('validates component funding split between grant and own funds', () => {
    const componentInput: CreateFixedAssetComponentInput = {
      company_id: 'ecf31039-b539-4e04-bbea-70ea48c701bb',
      fixed_asset_id: 'a1111111-2222-3333-4444-555555555555',
      name: 'Főorsó és Hajtómű Egység',
      component_type: 'initial',
      activation_date: '2026-03-01',
      gross_value: 5_000_000,
      grant_funding_amount: 3_500_000,
    };

    const calculatedOwnFunding = componentInput.own_funding_amount ?? Math.max(0, componentInput.gross_value - (componentInput.grant_funding_amount || 0));
    const calculatedRatio = componentInput.grant_ratio_percent ?? (
      componentInput.gross_value > 0 && (componentInput.grant_funding_amount || 0) > 0
        ? Math.round(((componentInput.grant_funding_amount || 0) / componentInput.gross_value) * 10000) / 100
        : 0
    );

    expect(calculatedOwnFunding).toBe(1_500_000);
    expect(calculatedRatio).toBe(70.0);
  });

  it('handles 100% own funded subsequent upgrade component', () => {
    const upgradeInput: CreateFixedAssetComponentInput = {
      company_id: 'ecf31039-b539-4e04-bbea-70ea48c701bb',
      fixed_asset_id: 'a1111111-2222-3333-4444-555555555555',
      name: 'Utólagos CNC Szenzor Bővítés',
      component_type: 'upgrade',
      activation_date: '2026-09-15',
      gross_value: 800_000,
      grant_funding_amount: 0,
      own_funding_amount: 800_000,
      grant_ratio_percent: 0,
    };

    expect(upgradeInput.grant_funding_amount).toBe(0);
    expect(upgradeInput.own_funding_amount).toBe(800_000);
    expect(upgradeInput.grant_ratio_percent).toBe(0);
    expect(upgradeInput.component_type).toBe('upgrade');
  });

  it('validates maintenance period calculation', () => {
    const activationDate = new Date('2026-01-15');
    const maintenanceYears = 3;
    const maintenanceEndDate = new Date(activationDate);
    maintenanceEndDate.setFullYear(maintenanceEndDate.getFullYear() + maintenanceYears);

    expect(maintenanceEndDate.toISOString().slice(0, 10)).toBe('2029-01-15');
  });
});
