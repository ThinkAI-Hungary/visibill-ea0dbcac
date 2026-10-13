import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AssetComponentsView } from '@/components/fixed-assets/AssetComponentsView';
import type { FixedAsset, FixedAssetComponent } from '@/types/fixed-assets';

const mockAsset: FixedAsset = {
  id: 'test-asset-123',
  company_id: 'test-comp-456',
  user_id: 'test-user-789',
  inventory_number: 'TE-001',
  name: 'Ipari CNC Marógép',
  description: null,
  vtsz_teszor: null,
  acquisition_value: 8_000_000,
  residual_value: 0,
  currency: 'HUF',
  purchase_date: '2025-01-01',
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
  created_at: '2025-01-15T10:00:00Z',
  updated_at: '2025-01-15T10:00:00Z',
};

const mockComponents: FixedAssetComponent[] = [
  {
    id: 'comp-1',
    company_id: 'test-comp-456',
    fixed_asset_id: 'test-asset-123',
    name: 'Alapgép váz',
    component_type: 'initial',
    activation_date: '2025-01-15',
    gross_value: 5_000_000,
    grant_project_id: 'grant-1',
    grant_funding_amount: 3_500_000,
    own_funding_amount: 1_500_000,
    grant_ratio_percent: 70.0,
    useful_life_months: 60,
    depreciation_rate: 20,
    gl_asset_account: null,
    notes: null,
    created_at: '2025-01-15T10:00:00Z',
    updated_at: '2025-01-15T10:00:00Z',
  },
];

vi.mock('@/hooks/useAssetComponents', () => ({
  useAssetComponents: (assetId: string) => ({
    components: assetId === 'test-asset-empty' ? [] : mockComponents,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    createComponent: vi.fn().mockResolvedValue({}),
    updateComponent: vi.fn().mockResolvedValue({}),
    deleteComponent: vi.fn().mockResolvedValue({}),
    isCreating: false,
    isUpdating: false,
    isDeleting: false,
  }),
}));

vi.mock('@/hooks/useGrantProjects', () => ({
  useGrantProjects: () => ({
    projects: [
      {
        id: 'grant-1',
        company_id: 'test-comp-456',
        name: 'GINOP Technológia',
        code: 'GINOP-1.2.3',
        eligible_cost: 10_000_000,
        grant_amount: 7_000_000,
        intensity_rate: 70,
        own_contribution: 3_000_000,
        advance_amount: 0,
        disbursed_amount: 7_000_000,
        maintenance_period_years: 3,
        maintenance_end_date: '2028-01-15',
        status: 'active',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      },
    ],
    isLoading: false,
  }),
}));

describe('AssetComponentsView Component (M3.2)', () => {
  const queryClient = new QueryClient();

  it('renders components table and financing breakdown when components exist', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AssetComponentsView asset={mockAsset} />
      </QueryClientProvider>
    );

    expect(screen.getByText('Komponens-elvű Eszközkarton')).toBeInTheDocument();
    expect(screen.getByText('Alapgép váz')).toBeInTheDocument();
    expect(screen.getByText('1 forráskomponens')).toBeInTheDocument();
    expect(screen.getByText(/Támogatási Forrás/)).toBeInTheDocument();
  });

  it('renders empty state message when no components are recorded yet', () => {
    const emptyAsset = { ...mockAsset, id: 'test-asset-empty' };
    render(
      <QueryClientProvider client={queryClient}>
        <AssetComponentsView asset={emptyAsset} />
      </QueryClientProvider>
    );

    expect(screen.getByText('Egyetlen forrásként nyilvántartott eszköz')).toBeInTheDocument();
    expect(screen.getByText('Első komponens rögzítése')).toBeInTheDocument();
  });

  it('opens component create modal on click', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AssetComponentsView asset={mockAsset} />
      </QueryClientProvider>
    );

    const addBtn = screen.getByText('Új komponens hozzáadása');
    fireEvent.click(addBtn);

    expect(screen.getByText('Új Komponens / Ráaktiválás Hozzáadása')).toBeInTheDocument();
    expect(screen.getByLabelText(/Komponens Megnevezése/)).toBeInTheDocument();
  });

  it('locks component actions when asset is disposed or inactive (Option A)', () => {
    const disposedAsset = { ...mockAsset, status: 'disposed' as const };
    render(
      <QueryClientProvider client={queryClient}>
        <AssetComponentsView asset={disposedAsset} />
      </QueryClientProvider>
    );

    // Figyelmeztető sáv megjelenik
    expect(screen.getByText(/Ez a tárgyi eszköz nem aktív/)).toBeInTheDocument();
    expect(screen.getByText(/A hozzá tartozó komponensek zárolva vannak/)).toBeInTheDocument();

    // Hozzáadás gomb le van tiltva
    const addBtn = screen.getByRole('button', { name: /Új komponens hozzáadása/i });
    expect(addBtn).toBeDisabled();

    // Műveletek oszlopban a 'Zárolva' badge látható a szerkesztés/törlés gombok helyett
    expect(screen.getByText('Zárolva')).toBeInTheDocument();
  });
});
