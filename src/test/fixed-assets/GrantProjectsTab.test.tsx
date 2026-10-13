import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GrantProjectsTab } from '@/components/fixed-assets/GrantProjectsTab';
import type { FixedAsset, GrantProject } from '@/types/fixed-assets';

const mockProjects: GrantProject[] = [
  {
    id: 'p1',
    company_id: 'comp-1',
    name: 'GINOP Ipar 4.0 Kapacitásbővítés',
    code: 'GINOP-1.2.3',
    grantor: 'Nemzetgazdasági Minisztérium',
    contract_number: 'GINOP-2026/001',
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
    company_id: 'comp-1',
    user_id: 'user-1',
    inventory_number: 'TE-001',
    name: 'CNC Ipari Megmunkáló',
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
    grant_project_id: 'p1',
  },
];

vi.mock('@/hooks/useGrantProjects', () => ({
  useGrantProjects: () => ({
    projects: mockProjects,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    createProject: vi.fn().mockResolvedValue({}),
    updateProject: vi.fn().mockResolvedValue({}),
    deleteProject: vi.fn().mockResolvedValue({}),
    isCreating: false,
    isUpdating: false,
    isDeleting: false,
  }),
}));

vi.mock('@/hooks/useAssetComponents', () => ({
  useCompanyAssetComponents: () => ({
    data: [],
    refetch: vi.fn(),
  }),
}));

vi.mock('@/lib/fixed-assets/grantReconciliationService', () => ({
  calculateGrantReconciliation: () => ({
    pillars: {
      grantContract: {
        totalEligibleCost: 20_000_000,
        totalGrantAmount: 14_000_000,
        totalDisbursedAmount: 14_000_000,
        totalAdvanceAmount: 2_000_000,
        unallocatedGrantAmount: 7_000_000,
      },
      assetAnalytics: {
        connectedAssetCount: 1,
        connectedComponentCount: 0,
        totalAssetGrossValue: 10_000_000,
        totalAllocatedGrantAmount: 7_000_000,
        totalAllocatedOwnAmount: 3_000_000,
        effectiveGrantRatioPercent: 70.0,
      },
      generalLedger: {
        gl483Balance: 6_300_000,
        gl964Turnover: 700_000,
        gl161Balance: 0,
      },
      deferralAnalytics: {
        calculatedReleasedPie: 700_000,
        expectedRemainingPie: 6_300_000,
        pieDiscrepancy: 0,
      },
    },
    isBalanced: true,
    alerts: [],
  }),
  fetchGrantGlBalances: vi.fn().mockResolvedValue({
    gl483Balance: 6_300_000,
    gl964Turnover: 700_000,
  }),
}));

describe('GrantProjectsTab Component (M3.4)', () => {
  const queryClient = new QueryClient();

  it('renders 4-way reconciliation header and KPI metrics', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <GrantProjectsTab
          companyId="comp-1"
          assets={mockAssets}
        />
      </QueryClientProvider>
    );

    expect(screen.getByText('Négyoldalú Rekonciliáció: Egyensúlyban (Zero-Error)')).toBeInTheDocument();
    expect(screen.getByText('Összes Pályázati Keret')).toBeInTheDocument();
    expect(screen.getByText('Folyósított Támogatás')).toBeInTheDocument();
    expect(screen.getByText('Eszközökhöz Allokált Támogatás')).toBeInTheDocument();
    expect(screen.getByText('GINOP-1.2.3')).toBeInTheDocument();
  });

  it('opens new grant project dialog on click', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <GrantProjectsTab
          companyId="comp-1"
          assets={mockAssets}
        />
      </QueryClientProvider>
    );

    const addBtn = screen.getByText('Új pályázati projekt');
    fireEvent.click(addBtn);

    expect(screen.getByText('Új Támogatási Projekt Rögzítése')).toBeInTheDocument();
    expect(screen.getByLabelText(/Pályázati Azonosító Kód/)).toBeInTheDocument();
  });

  it('opens PIE release modal on click', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <GrantProjectsTab
          companyId="comp-1"
          assets={mockAssets}
        />
      </QueryClientProvider>
    );

    const pieBtn = screen.getByText('PIE feloldás könyvelése');
    fireEvent.click(pieBtn);

    expect(screen.getByText('Passzív Időbeli Elhatárolás Feloldása')).toBeInTheDocument();
    expect(screen.getByText(/T 483 \(Passzív időbeli elhatárolás\) → K 964/)).toBeInTheDocument();
  });
});
