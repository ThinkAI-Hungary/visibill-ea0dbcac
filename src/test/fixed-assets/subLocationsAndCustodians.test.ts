import { describe, it, expect } from 'vitest';
import { buildSubLocationTree } from '@/hooks/useCompanySubLocations';
import type { CompanySubLocation, FixedAsset } from '@/types/fixed-assets';

describe('M2.1: Hierarchical sub-locations and tree builder', () => {
  it('correctly builds a nested tree from flat sub-location records', () => {
    const flatLocations: CompanySubLocation[] = [
      {
        id: 'sub-1',
        company_id: 'comp-1',
        location_id: 'loc-1',
        parent_id: null,
        name: 'A Épület',
        code: 'EP-A',
        description: 'Főépület',
        is_active: true,
      },
      {
        id: 'sub-2',
        company_id: 'comp-1',
        location_id: 'loc-1',
        parent_id: 'sub-1',
        name: '2. Emelet',
        code: 'EM-02',
        description: null,
        is_active: true,
      },
      {
        id: 'sub-3',
        company_id: 'comp-1',
        location_id: 'loc-1',
        parent_id: 'sub-2',
        name: '204-es Iroda',
        code: 'IR-204',
        description: 'Pénzügyi osztály',
        is_active: true,
      },
      {
        id: 'sub-4',
        company_id: 'comp-1',
        location_id: 'loc-1',
        parent_id: null,
        name: 'Központi Raktár',
        code: 'RAKT-K',
        description: null,
        is_active: true,
      },
    ];

    const tree = buildSubLocationTree(flatLocations);

    expect(tree).toHaveLength(2);
    expect(tree[0].name).toBe('A Épület');
    expect(tree[0].children).toHaveLength(1);

    const floor2 = tree[0].children![0];
    expect(floor2.name).toBe('2. Emelet');
    expect(floor2.parent?.name).toBe('A Épület');
    expect(floor2.children).toHaveLength(1);

    const room204 = floor2.children![0];
    expect(room204.name).toBe('204-es Iroda');
    expect(room204.parent?.name).toBe('2. Emelet');

    expect(tree[1].name).toBe('Központi Raktár');
    expect(tree[1].children).toHaveLength(0);
  });

  it('handles empty array gracefully', () => {
    const tree = buildSubLocationTree([]);
    expect(tree).toEqual([]);
  });

  it('handles broken parent_id references gracefully by treating them as roots', () => {
    const items: CompanySubLocation[] = [
      {
        id: 'sub-child-orphan',
        company_id: 'comp-1',
        location_id: 'loc-1',
        parent_id: 'non-existing-parent-id',
        name: 'Árva tárolóhely',
        code: null,
        description: null,
        is_active: true,
      },
    ];

    const tree = buildSubLocationTree(items);
    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe('Árva tárolóhely');
  });

  it('supports custodian, sub_location, and cost_center associations on FixedAsset', () => {
    const asset: Partial<FixedAsset> = {
      id: 'asset-1',
      name: 'Dell XPS Fejlesztői Laptop',
      inventory_number: 'TE-2026-0042',
      location_id: 'loc-1',
      sub_location_id: 'sub-3',
      custodian_id: 'emp-101',
      cost_center_id: 'cc-it',
      custodian: {
        id: 'emp-101',
        first_name: 'János',
        last_name: 'Kovács',
        email: 'janos.kovacs@visibill.hu',
      },
      sub_location: {
        id: 'sub-3',
        company_id: 'comp-1',
        location_id: 'loc-1',
        parent_id: 'sub-2',
        name: '204-es Iroda',
        code: 'IR-204',
        description: null,
        is_active: true,
      },
      cost_center: {
        id: 'cc-it',
        code: 'IT-DEV',
        name: 'Informatikai Fejlesztés',
      },
    };

    expect(asset.sub_location_id).toBe('sub-3');
    expect(asset.custodian?.first_name).toBe('János');
    expect(asset.cost_center?.code).toBe('IT-DEV');
  });
});
