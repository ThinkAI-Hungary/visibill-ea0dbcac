import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssetListTable } from '@/components/fixed-assets/AssetListTable';
import type { FixedAsset } from '@/types/fixed-assets';

const mockAssets: FixedAsset[] = [
  {
    id: 'asset-1',
    company_id: 'comp-1',
    user_id: 'user-1',
    inventory_number: '250702579865 - 2024',
    name: 'Pur Raspberry &amp; Red Currant Mosogatószer',
    description: null,
    vtsz_teszor: null,
    acquisition_value: 1499,
    residual_value: 0,
    currency: 'HUF',
    purchase_date: '2026-01-10',
    activation_date: '2026-01-15',
    disposal_date: null,
    useful_life_months: 12,
    depreciation_method: 'linear',
    performance_unit: null,
    total_planned_performance: null,
    depreciation_schedule: null,
    tao_template_id: null,
    tao_rate_override: null,
    location_id: 'loc-1',
    project_id: 'proj-1',
    activated_by_user_id: null,
    activated_by_name: null,
    gl_account_id: null,
    development_reserve_id: null,
    development_reserve_amount: 0,
    source_invoice_id: null,
    source_invoice_item_id: null,
    status: 'active',
    tax_depreciation_base: 1499,
    tax_depreciation_rate: 100,
    grant_depreciation_base: null,
    grant_project_id: null,
    has_tax_credit: false,
    tax_credit_retention_until: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    project: {
      id: 'proj-1',
      name: 'Iroda &amp; Üzemeltetés',
      project_code: 'PRJ-01',
      color: '#3b82f6',
    },
    location: {
      id: 'loc-1',
      name: 'Főiroda',
      address: '1118 Budapest, Villányi út 42.',
    },
  },
  {
    id: 'asset-2',
    company_id: 'comp-1',
    user_id: 'user-1',
    inventory_number: 'S2026/297971 - 2026',
    name: 'Irattartó tasak, A4, PP, patentos',
    description: null,
    vtsz_teszor: null,
    acquisition_value: 2115,
    residual_value: 0,
    currency: 'HUF',
    purchase_date: '2026-01-10',
    activation_date: '2026-01-15',
    disposal_date: null,
    useful_life_months: 12,
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
    development_reserve_id: 'dr-1',
    development_reserve_amount: 500,
    source_invoice_id: null,
    source_invoice_item_id: null,
    status: 'active',
    tax_depreciation_base: 1615,
    tax_depreciation_rate: 100,
    grant_depreciation_base: null,
    grant_project_id: null,
    has_tax_credit: false,
    tax_credit_retention_until: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
];

describe('AssetListTable', () => {
  it('renders all table headers with nowrap and proper column layout', () => {
    render(
      <AssetListTable
        assets={mockAssets}
        loading={false}
        selectedAssetId={null}
        onSelectAsset={vi.fn()}
      />
    );

    expect(screen.getByText('Leltári Szám')).toBeInTheDocument();
    expect(screen.getByText('Megnevezés')).toBeInTheDocument();
    expect(screen.getByText('Státusz')).toBeInTheDocument();
    expect(screen.getByText('Bekerülési érték')).toBeInTheDocument();
    expect(screen.getByText('Fejlesztési tart.')).toBeInTheDocument();
    expect(screen.getByText('TAO ÉCS alap')).toBeInTheDocument();
    expect(screen.getByText('Projekt')).toBeInTheDocument();
    expect(screen.getByText('Helyszín')).toBeInTheDocument();
  });

  it('displays inventory number, decodes HTML entities and truncates long names', () => {
    render(
      <AssetListTable
        assets={mockAssets}
        loading={false}
        selectedAssetId={null}
        onSelectAsset={vi.fn()}
      />
    );

    // Full inventory number must be visible
    expect(screen.getByText('250702579865 - 2024')).toBeInTheDocument();
    expect(screen.getByText('S2026/297971 - 2026')).toBeInTheDocument();

    // Name is truncated after 28 chars with ellipsis, but decoded
    expect(screen.getByText('Pur Raspberry & Red Currant…')).toBeInTheDocument();
    expect(screen.getByText('Irattartó tasak, A4, PP, pat…')).toBeInTheDocument();

    // Decoded project name
    expect(screen.getByText('Iroda & Üzemeltetés')).toBeInTheDocument();
  });

  it('highlights the selected row with background without layout-shifting border-l', () => {
    const handleSelect = vi.fn();
    const { container } = render(
      <AssetListTable
        assets={mockAssets}
        loading={false}
        selectedAssetId="asset-1"
        onSelectAsset={handleSelect}
      />
    );

    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);

    // First row is selected: should have bg-primary/10 and NOT have border-l-2
    expect(rows[0].className).toContain('bg-primary/10');
    expect(rows[0].className).not.toContain('border-l-2');
    expect(rows[0].className).not.toContain('border-l-primary');

    // Click second row triggers callback
    fireEvent.click(rows[1]);
    expect(handleSelect).toHaveBeenCalledWith('asset-2');
  });

  it('filters assets by search term including decoded entity text', () => {
    render(
      <AssetListTable
        assets={mockAssets}
        loading={false}
        selectedAssetId={null}
        onSelectAsset={vi.fn()}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Keresés eszközök/);

    // Search by decoded entity text
    fireEvent.change(searchInput, { target: { value: 'Raspberry &' } });
    expect(screen.getByText('Pur Raspberry & Red Currant…')).toBeInTheDocument();
    expect(screen.queryByText('Irattartó tasak, A4, PP, pa…')).not.toBeInTheDocument();

    // Clear search
    const clearBtn = screen.getByTitle('Törlés');
    fireEvent.click(clearBtn);
    expect(screen.getByText('Irattartó tasak, A4, PP, pat…')).toBeInTheDocument();
  });

  it('paginates assets with default 50 items per page', () => {
    // Generate 55 assets
    const manyAssets: FixedAsset[] = Array.from({ length: 55 }, (_, i) => ({
      ...mockAssets[0],
      id: `asset-${i + 1}`,
      inventory_number: `INV-2026-${String(i + 1).padStart(3, '0')}`,
      name: `Tárgyi Eszköz #${i + 1}`,
    }));

    const { container } = render(
      <AssetListTable
        assets={manyAssets}
        loading={false}
        selectedAssetId={null}
        onSelectAsset={vi.fn()}
      />
    );

    // Page 1: only 50 rows rendered
    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBe(50);
    expect(screen.getByText('INV-2026-001')).toBeInTheDocument();
    expect(screen.getByText('INV-2026-050')).toBeInTheDocument();
    expect(screen.queryByText('INV-2026-051')).not.toBeInTheDocument();

    // Navigate to page 2
    const nextBtn = screen.getByLabelText('Következő oldal');
    fireEvent.click(nextBtn);

    // Page 2: remaining 5 rows rendered (51 to 55)
    const rowsPage2 = container.querySelectorAll('tbody tr');
    expect(rowsPage2.length).toBe(5);
    expect(screen.getByText('INV-2026-051')).toBeInTheDocument();
    expect(screen.getByText('INV-2026-055')).toBeInTheDocument();
    expect(screen.queryByText('INV-2026-001')).not.toBeInTheDocument();
  });
});
