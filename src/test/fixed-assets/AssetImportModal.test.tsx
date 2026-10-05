import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AssetImportModal } from '@/components/fixed-assets/AssetImportModal';
import { generateSampleAssetImportExcel } from '@/lib/fixed-assets/assetImportParser';

const mockToast = vi.fn();

vi.mock('@/contexts/CompanyContext', () => ({
  useCompany: () => ({
    selectedCompany: { id: 'test-comp-1', name: 'Mandala Fogadó Kft.' },
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-1', email: 'teca@i-tax.hu', user_metadata: { full_name: 'Ruzsa Teréz' } },
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

vi.mock('@/hooks/useActivePreset', () => ({
  useActivePreset: () => ({
    activePresetId: 'preset-1',
  }),
}));

vi.mock('@/hooks/useFixedAssets', () => ({
  useAssetGlAccounts: () => ({
    data: [
      { id: 'gl-143', gl_number: '143', short_name: 'Egyéb berendezések, felszerelések' },
      { id: 'gl-141', gl_number: '141', short_name: 'Műszaki berendezések, gépek' },
    ],
  }),
}));

const mockFixedAssetsInsert = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'fixed_assets') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ inventory_number: 'TE-2026-0001' }],
              error: null,
            }),
          }),
          insert: mockFixedAssetsInsert,
        };
      }
      if (table === 'asset_events') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    }),
  },
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe('AssetImportModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFixedAssetsInsert.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'asset-1',
            name: 'Lenovo ThinkPad',
            activation_date: '2024-03-15',
            status: 'active',
            acquisition_value: 450000,
            inventory_number: 'TE-2026-0001-IMP',
          },
        ],
        error: null,
      }),
    });
  });

  it('renders upload screen with drag&drop zone and sample download button', () => {
    const handleOpenChange = vi.fn();
    renderWithClient(
      <AssetImportModal open={true} onOpenChange={handleOpenChange} />
    );

    expect(screen.getByText('Tárgyi eszközök és nyitó állomány importálása')).toBeInTheDocument();
    expect(screen.getByText('Minta sablon letöltése')).toBeInTheDocument();
    expect(screen.getByText(/Húzd ide az Excel vagy CSV fájlt/)).toBeInTheDocument();
    expect(screen.getByText('Tallózás a számítógépről')).toBeInTheDocument();
  });

  it('triggers download sample template when clicking download button', () => {
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    renderWithClient(
      <AssetImportModal open={true} onOpenChange={vi.fn()} />
    );

    const downloadBtn = screen.getByText('Minta sablon letöltése');
    fireEvent.click(downloadBtn);

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Minta sablon letöltve',
      })
    );

    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
  });

  it('parses uploaded sample excel, detects collisions, renders badges, and allows auto-resolving', async () => {
    const sampleBytes = generateSampleAssetImportExcel();
    const file = new File([sampleBytes], 'sample_import.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    renderWithClient(
      <AssetImportModal open={true} onOpenChange={vi.fn()} />
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/Előnézet/)).toBeInTheDocument();
    });

    // Check collision badge is displayed for TE-2026-0001
    expect(screen.getByText('Létezik')).toBeInTheDocument();

    // Check collision resolution checkbox exists and is checked by default
    const collisionCheckbox = screen.getByLabelText(
      'Létező leltári számok automatikus feloldása (-IMP utótaggal)'
    );
    expect(collisionCheckbox).toBeInTheDocument();
    expect(collisionCheckbox).toBeChecked();

    // Check import button
    const importBtn = screen.getByRole('button', { name: /Importálás indítása/ });
    expect(importBtn).toBeInTheDocument();

    // Click import
    fireEvent.click(importBtn);

    await waitFor(() => {
      expect(mockFixedAssetsInsert).toHaveBeenCalled();
    });

    // Verify auto-resolved inventory number TE-2026-0001-IMP was passed
    const insertedRows = mockFixedAssetsInsert.mock.calls[0][0];
    const collidedRow = insertedRows.find((r: any) => r.name.includes('Lenovo'));
    expect(collidedRow).toBeDefined();
    expect(collidedRow.inventory_number).toBe('TE-2026-0001-IMP');
  });

  it('handles database insert error gracefully by staying in preview mode', async () => {
    mockFixedAssetsInsert.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: null,
        error: new Error('Postgres connection timeout'),
      }),
    });

    const sampleBytes = generateSampleAssetImportExcel();
    const file = new File([sampleBytes], 'sample_import.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    renderWithClient(
      <AssetImportModal open={true} onOpenChange={vi.fn()} />
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/Előnézet/)).toBeInTheDocument();
    });

    const importBtn = screen.getByRole('button', { name: /Importálás indítása/ });
    fireEvent.click(importBtn);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
        })
      );
    });

    // Stays in preview screen so user can retry or adjust settings
    expect(screen.getByText(/Előnézet/)).toBeInTheDocument();
  });
});
