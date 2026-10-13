import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AssetAgingPyramidChart } from '@/components/fixed-assets/AssetAgingPyramidChart';
import { MultiYearMovementTable } from '@/components/fixed-assets/MultiYearMovementTable';
import type { FixedAsset } from '@/types/fixed-assets';

// Mock recharts to avoid jsdom layout/svg rendering issues
vi.mock('recharts', async () => {
  const actual = await vi.importActual<any>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  };
});

describe('AssetAgingPyramidChart and MultiYearMovementTable', () => {
  const mockAsset: FixedAsset = {
    id: 'asset-1',
    company_id: 'comp-1',
    inventory_number: 'TE-2026/001',
    name: 'CNC Megmunkálóközpont',
    asset_group: 'machines',
    acquisition_date: '2024-01-10',
    activation_date: '2024-01-15',
    acquisition_value: 10000000,
    gross_value: 10000000,
    accumulated_depreciation: 2000000,
    net_book_value: 8000000,
    currency: 'HUF',
    depreciation_method: 'linear',
    annual_depreciation_rate: 20, // 20% / év
    residual_value: 0,
    status: 'active',
    created_at: '2024-01-10T00:00:00Z',
    updated_at: '2024-01-10T00:00:00Z',
    location: { id: 'loc-1', name: 'Gyártócsarnok' },
    sub_location: { id: 'sub-1', name: 'CNC Sor', code: 'CNC-01' },
    custodian: { id: 'emp-1', full_name: 'Kovács Gábor' },
    tao_template: { id: 'tao-1', name: 'Ipari gépek (14.5%)', tao_rate_percent: 14.5 },
  };

  it('renders AssetAgingPyramidChart with bucket cards and tabs', () => {
    render(<AssetAgingPyramidChart assets={[mockAsset]} />);

    expect(screen.getByText('Eszközpark Életkor és Öregedési Piramis')).toBeInTheDocument();
    expect(screen.getByText('Nettó érték')).toBeInTheDocument();
    expect(screen.getByText('Bruttó érték')).toBeInTheDocument();
    expect(screen.getByText('Darabszám')).toBeInTheDocument();
  });

  it('renders MultiYearMovementTable for a single asset with Sztv and Tao comparison', () => {
    render(<MultiYearMovementTable asset={mockAsset} />);

    expect(screen.getByText(/Többéves Amortizációs Mozgástábla — TE-2026\/001/i)).toBeInTheDocument();
    expect(screen.getByText('Tao ÉCS összehasonlítás')).toBeInTheDocument();
    expect(screen.getByText('Tárgyévi Sztv ÉCS')).toBeInTheDocument();
    expect(screen.getByText('Tárgyévi Tao ÉCS')).toBeInTheDocument();
    expect(screen.getByText('Tao Különbözet')).toBeInTheDocument();

    // Check presence of activation year
    expect(screen.getByText(/2024/i)).toBeInTheDocument();
  });

  it('renders MultiYearMovementTable for company aggregate assets', () => {
    render(<MultiYearMovementTable assets={[mockAsset]} />);

    expect(screen.getByText('Vállalati Többéves Tárgyieszköz Mozgástábla')).toBeInTheDocument();
    expect(screen.getByText('Bruttó Nyitó')).toBeInTheDocument();
    expect(screen.getByText('Növekedés (+)')).toBeInTheDocument();
    expect(screen.getByText('Bruttó Záró')).toBeInTheDocument();
  });
});
