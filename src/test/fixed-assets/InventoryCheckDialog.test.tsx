import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InventoryCheckDialog } from '@/components/fixed-assets/InventoryCheckDialog';
import type { FixedAsset } from '@/types/fixed-assets';

const mockToast = vi.fn();

vi.mock('@/contexts/CompanyContext', () => ({
  useCompany: () => ({
    selectedCompany: { id: 'test-comp-1', name: 'Teszt Vállalkozás Kft.' },
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-1', email: 'admin@visibill.hu' },
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

vi.mock('@/hooks/useCompanySubLocations', () => ({
  useCompanySubLocations: () => ({
    data: [
      { id: 'sub-1', name: 'IT Labor', code: 'LAB-01' },
      { id: 'sub-2', name: 'Tárgyaló', code: 'CONF-01' },
    ],
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useFixedAssets', () => ({
  useCompanyEmployees: () => ({
    data: [
      { id: 'emp-1', full_name: 'Kovács János', employee_number: 'E-001' },
    ],
    isLoading: false,
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ error: null }),
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  },
}));

describe('InventoryCheckDialog', () => {
  const queryClient = new QueryClient();

  const mockAssets: FixedAsset[] = [
    {
      id: 'asset-1',
      company_id: 'test-comp-1',
      inventory_number: 'TE-2026/001',
      name: 'MacBook Pro M3 Max',
      asset_group: 'machines',
      acquisition_date: '2026-01-10',
      activation_date: '2026-01-15',
      acquisition_value: 1200000,
      gross_value: 1200000,
      accumulated_depreciation: 200000,
      net_book_value: 1000000,
      currency: 'HUF',
      depreciation_method: 'linear',
      annual_depreciation_rate: 33,
      residual_value: 0,
      status: 'active',
      created_at: '2026-01-10T00:00:00Z',
      updated_at: '2026-01-10T00:00:00Z',
      location: { id: 'loc-1', name: 'Központi Iroda' },
      sub_location: { id: 'sub-1', name: 'IT Labor', code: 'LAB-01' },
      custodian: { id: 'emp-1', full_name: 'Kovács János', employee_number: 'E-001' },
    },
    {
      id: 'asset-2',
      company_id: 'test-comp-1',
      inventory_number: 'TE-2026/002',
      name: 'Dell Monitor 32"',
      asset_group: 'equipment',
      acquisition_date: '2026-02-01',
      activation_date: '2026-02-05',
      acquisition_value: 250000,
      gross_value: 250000,
      accumulated_depreciation: 30000,
      net_book_value: 220000,
      currency: 'HUF',
      depreciation_method: 'linear',
      annual_depreciation_rate: 33,
      residual_value: 0,
      status: 'active',
      created_at: '2026-02-01T00:00:00Z',
      updated_at: '2026-02-01T00:00:00Z',
      location: { id: 'loc-1', name: 'Központi Iroda' },
      sub_location: null,
      custodian: null,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders scanner tab and allows searching for asset by inventory number', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <InventoryCheckDialog open={true} onOpenChange={vi.fn()} assets={mockAssets} />
      </QueryClientProvider>
    );

    expect(screen.getByText('Tárgyi Eszköz Leltározó és Fordulónapi Leltárív')).toBeInTheDocument();
    expect(screen.getByText('Gyors Scanner')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Olvass be vonalkódot vagy gépelj leltári számot/i)).toBeInTheDocument();

    // Type inventory number
    const input = screen.getByPlaceholderText(/Olvass be vonalkódot vagy gépelj leltári számot/i);
    fireEvent.change(input, { target: { value: 'TE-2026/001' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    // The asset card should pop up with condition buttons
    expect(await screen.findByText('MacBook Pro M3 Max')).toBeInTheDocument();
    expect(screen.getByText('Épp / Rendben')).toBeInTheDocument();
    expect(screen.getByText('Sérült')).toBeInTheDocument();
    expect(screen.getByText('Selejtezendő')).toBeInTheDocument();
  });

  it('displays active assets in the list tab with status indicators', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <InventoryCheckDialog open={true} onOpenChange={vi.fn()} assets={mockAssets} />
      </QueryClientProvider>
    );

    // Switch to list tab
    const listTabTrigger = screen.getByRole('tab', { name: /Leltárlista/i });
    fireEvent.pointerDown(listTabTrigger);
    fireEvent.click(listTabTrigger);
    fireEvent.keyDown(listTabTrigger, { key: 'Enter', code: 'Enter' });

    expect(screen.getByText('MacBook Pro M3 Max')).toBeInTheDocument();
    expect(screen.getByText('Dell Monitor 32"')).toBeInTheDocument();
  });

  it('renders report tab with analytical report export buttons', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <InventoryCheckDialog open={true} onOpenChange={vi.fn()} assets={mockAssets} />
      </QueryClientProvider>
    );

    // Switch to report tab
    const reportTabTrigger = screen.getByRole('tab', { name: /Zárás & Export/i });
    fireEvent.pointerDown(reportTabTrigger);
    fireEvent.click(reportTabTrigger);
    fireEvent.keyDown(reportTabTrigger, { key: 'Enter', code: 'Enter' });

    expect(screen.getByText(/Hivatalos Excel Leltárív \(\.xlsx\) Letöltése/i)).toBeInTheDocument();
    expect(screen.getByText(/Nyomtatható PDF Leltárív \(\.pdf\) Letöltése/i)).toBeInTheDocument();
    expect(screen.getByText(/Leltár fordulónapja:/i)).toBeInTheDocument();
  });
});
