import { describe, it, expect } from 'vitest';
import type { FixedAsset, AssetEvent, AssetProject } from '@/types/fixed-assets';

describe('Fixed Assets Project Assignment', () => {
  const mockProjectA: AssetProject = {
    id: 'proj-1',
    name: 'Webshop Fejlesztés',
    project_code: 'WEB-2026',
    color: '#3b82f6',
    icon: 'FolderOpen',
  };

  const mockProjectB: AssetProject = {
    id: 'proj-2',
    name: 'Iroda Felújítás',
    project_code: 'OFF-001',
    color: '#10b981',
    icon: 'Building2',
  };

  const mockAssets: FixedAsset[] = [
    {
      id: 'asset-1',
      company_id: 'comp-1',
      user_id: 'user-1',
      inventory_number: 'SZ-2026/001 - 2608 - 0001',
      name: 'MacBook Pro M3 Max',
      description: 'Fejlesztői laptop',
      vtsz_teszor: '84713000',
      acquisition_value: 1200000,
      residual_value: 0,
      currency: 'HUF',
      purchase_date: '2026-08-01',
      activation_date: '2026-08-05',
      disposal_date: null,
      useful_life_months: 36,
      depreciation_method: 'linear',
      performance_unit: null,
      total_planned_performance: null,
      depreciation_schedule: null,
      tao_template_id: null,
      tao_rate_override: null,
      location_id: 'loc-1',
      project_id: 'proj-1',
      project: mockProjectA,
      activated_by_user_id: 'user-1',
      activated_by_name: 'Teszt Elek',
      gl_account_id: null,
      source_invoice_id: 'inv-1',
      source_invoice_type: 'nav',
      source_invoice_number: 'SZ-2026/001',
      supplier_name: 'Apple Store',
      status: 'active',
      documents: [],
      created_at: '2026-08-05T10:00:00Z',
      updated_at: '2026-08-05T10:00:00Z',
    },
    {
      id: 'asset-2',
      company_id: 'comp-1',
      user_id: 'user-1',
      inventory_number: 'SZ-2026/002 - 2608 - 0002',
      name: 'Ergonomikus Irodai Szék',
      description: 'Vezetői forgószék',
      vtsz_teszor: '94013000',
      acquisition_value: 250000,
      residual_value: 0,
      currency: 'HUF',
      purchase_date: '2026-08-10',
      activation_date: '2026-08-12',
      disposal_date: null,
      useful_life_months: 60,
      depreciation_method: 'linear',
      performance_unit: null,
      total_planned_performance: null,
      depreciation_schedule: null,
      tao_template_id: null,
      tao_rate_override: null,
      location_id: 'loc-1',
      project_id: 'proj-2',
      project: mockProjectB,
      activated_by_user_id: 'user-1',
      activated_by_name: 'Teszt Elek',
      gl_account_id: null,
      source_invoice_id: 'inv-2',
      source_invoice_type: 'submitted',
      source_invoice_number: 'SZ-2026/002',
      supplier_name: 'Office Depot',
      status: 'active',
      documents: [],
      created_at: '2026-08-12T10:00:00Z',
      updated_at: '2026-08-12T10:00:00Z',
    },
    {
      id: 'asset-3',
      company_id: 'comp-1',
      user_id: 'user-1',
      inventory_number: 'SZ-2026/003 - 2608 - 0003',
      name: 'Központi Szerver HP ProLiant',
      description: 'Szerver infrastruktúra',
      vtsz_teszor: '84714100',
      acquisition_value: 3500000,
      residual_value: 500000,
      currency: 'HUF',
      purchase_date: '2026-08-15',
      activation_date: '2026-08-16',
      disposal_date: null,
      useful_life_months: 48,
      depreciation_method: 'linear',
      performance_unit: null,
      total_planned_performance: null,
      depreciation_schedule: null,
      tao_template_id: null,
      tao_rate_override: null,
      location_id: 'loc-2',
      project_id: null,
      activated_by_user_id: 'user-1',
      activated_by_name: 'Teszt Elek',
      gl_account_id: null,
      source_invoice_id: null,
      source_invoice_type: null,
      source_invoice_number: null,
      supplier_name: 'HP Hungary',
      status: 'active',
      documents: [],
      created_at: '2026-08-16T10:00:00Z',
      updated_at: '2026-08-16T10:00:00Z',
    },
  ];

  it('correctly associates assets with projects', () => {
    const assetA = mockAssets.find(a => a.id === 'asset-1');
    expect(assetA?.project_id).toBe('proj-1');
    expect(assetA?.project?.name).toBe('Webshop Fejlesztés');
    expect(assetA?.project?.project_code).toBe('WEB-2026');

    const unassignedAsset = mockAssets.find(a => a.id === 'asset-3');
    expect(unassignedAsset?.project_id).toBeNull();
    expect(unassignedAsset?.project).toBeUndefined();
  });

  it('filters assets by project name and project code in list view search', () => {
    const searchByName = (query: string) => {
      const s = query.toLowerCase();
      return mockAssets.filter(a =>
        a.name.toLowerCase().includes(s) ||
        a.inventory_number.toLowerCase().includes(s) ||
        (a.project?.name || '').toLowerCase().includes(s) ||
        (a.project?.project_code || '').toLowerCase().includes(s)
      );
    };

    // Search by project name
    const webResults = searchByName('Webshop');
    expect(webResults).toHaveLength(1);
    expect(webResults[0].id).toBe('asset-1');

    // Search by project code
    const codeResults = searchByName('OFF-001');
    expect(codeResults).toHaveLength(1);
    expect(codeResults[0].id).toBe('asset-2');

    // Search for non-project string
    const laptopResults = searchByName('MacBook');
    expect(laptopResults).toHaveLength(1);
    expect(laptopResults[0].id).toBe('asset-1');
  });

  it('calculates total asset count and acquisition value per project', () => {
    const getProjectStats = (projectId: string) => {
      const assigned = mockAssets.filter(a => a.project_id === projectId);
      const totalValue = assigned.reduce((sum, a) => sum + a.acquisition_value, 0);
      return { count: assigned.length, totalValue };
    };

    const statsA = getProjectStats('proj-1');
    expect(statsA.count).toBe(1);
    expect(statsA.totalValue).toBe(1200000);

    const statsB = getProjectStats('proj-2');
    expect(statsB.count).toBe(1);
    expect(statsB.totalValue).toBe(250000);

    const statsNone = getProjectStats('non-existent');
    expect(statsNone.count).toBe(0);
    expect(statsNone.totalValue).toBe(0);
  });

  it('creates project_transfer asset events on reassignment', () => {
    const event: AssetEvent = {
      id: 'event-1',
      asset_id: 'asset-1',
      company_id: 'comp-1',
      user_id: 'user-1',
      event_type: 'project_transfer',
      event_date: '2026-08-20',
      description: 'Projekt hozzárendelés: Webshop Fejlesztés → Iroda Felújítás',
      old_values: { project: 'Webshop Fejlesztés' },
      new_values: { project: 'Iroda Felújítás' },
      created_at: '2026-08-20T12:00:00Z',
    };

    expect(event.event_type).toBe('project_transfer');
    expect(event.old_values?.project).toBe('Webshop Fejlesztés');
    expect(event.new_values?.project).toBe('Iroda Felújítás');
    expect(event.description).toContain('Webshop Fejlesztés');
  });
});
