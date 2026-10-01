import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateFixedAssetDialog } from '@/components/fixed-assets/CreateFixedAssetDialog';

const mockMutateAsync = vi.fn();
const mockToast = vi.fn();

vi.mock('@/contexts/CompanyContext', () => ({
  useCompany: () => ({
    selectedCompany: { id: 'test-comp-1', name: 'Mandala Fogadó Kft.' },
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-1', email: 'teca@i-tax.hu' },
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

vi.mock('@/hooks/useFixedAssets', () => ({
  useTaoTemplates: () => ({
    data: [
      { id: 'tao-1', name: 'Informatikai eszközök (33%)', tao_rate_percent: 33 },
      { id: 'tao-2', name: 'Gépjárművek (20%)', tao_rate_percent: 20 },
    ],
  }),
  useAssetGlAccounts: () => ({
    data: [
      { id: 'gl-131', gl_number: '131', short_name: 'Műszaki berendezések, gépek' },
      { id: 'gl-141', gl_number: '141', short_name: 'Járművek' },
    ],
  }),
  useCreateFixedAsset: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
  generateInventoryNumber: vi.fn().mockResolvedValue('TE-2610-0001'),
}));

vi.mock('@/hooks/useCompanyLocations', () => ({
  useCompanyLocations: () => ({
    locations: [{ id: 'loc-1', name: 'Székhely', address: '1011 Budapest, Fő u. 1.' }],
  }),
}));

vi.mock('@/hooks/useProjectList', () => ({
  useProjectList: () => ({
    projects: [{ id: 'proj-1', name: 'Weboldal megújítás', project_code: 'PRJ-01' }],
  }),
}));

vi.mock('@/hooks/useActivePreset', () => ({
  useActivePreset: () => ({
    activePresetId: 'preset-1',
  }),
}));

vi.mock('@/hooks/useDevelopmentReserves', () => ({
  useDevelopmentReserves: () => ({
    data: [],
  }),
}));

vi.mock('@/hooks/useAccountingPolicy', () => ({
  useCompanyAccountingRule: () => ({
    value: { amount: 200000 },
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: { name: 'Ruzsa Teréz' } }),
        }),
      }),
    }),
  },
}));

describe('CreateFixedAssetDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with required fields when open is true', async () => {
    render(<CreateFixedAssetDialog open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText('Új tárgyi eszköz felvétele')).toBeInTheDocument();
    expect(screen.getByLabelText(/Megnevezés/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Leltári szám/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Bekerülési \(bruttó\) érték/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Előzmény \/ nyitó eszköz/i)).toBeInTheDocument();
  });

  it('validates mandatory fields and blocks submission if name or value is missing', async () => {
    render(<CreateFixedAssetDialog open={true} onOpenChange={vi.fn()} />);

    const submitBtn = screen.getByRole('button', { name: /Eszköz mentése/i });
    fireEvent.click(submitBtn);

    // Form should trigger validation toast
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.anything(),
        variant: 'destructive',
      })
    );
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('successfully creates an opening / historical asset with skipLedgerPosting: true', async () => {
    mockMutateAsync.mockResolvedValueOnce({ id: 'new-asset-id' });
    const handleSuccess = vi.fn();
    const handleOpenChange = vi.fn();

    render(
      <CreateFixedAssetDialog
        open={true}
        onOpenChange={handleOpenChange}
        onSuccess={handleSuccess}
      />
    );

    // Wait for auto-generated inventory number
    await waitFor(() => {
      const invInput = screen.getByLabelText(/Leltári szám/i) as HTMLInputElement;
      expect(invInput.value).toBe('TE-2610-0001');
    });

    // Fill form
    fireEvent.change(screen.getByLabelText(/Megnevezés/i), {
      target: { value: 'Dell Szerver R740' },
    });
    fireEvent.change(screen.getByLabelText(/Bekerülési \(bruttó\) érték/i), {
      target: { value: '1500000' },
    });

    // Check opening asset checkbox
    const openingCheckbox = screen.getByLabelText(/Előzmény \/ nyitó eszköz/i);
    fireEvent.click(openingCheckbox);
    expect(openingCheckbox).toBeChecked();

    // Submit button should now reflect opening asset
    const submitBtn = screen.getByRole('button', { name: /Nyitó eszköz rögzítése/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 'test-comp-1',
          name: 'Dell Szerver R740',
          inventoryNumber: 'TE-2610-0001',
          acquisitionValue: 1500000,
          skipLedgerPosting: true, // MUST be true for opening asset!
        })
      );
    });

    expect(handleSuccess).toHaveBeenCalled();
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });

  it('submits standard active asset with skipLedgerPosting: false when not an opening asset', async () => {
    mockMutateAsync.mockResolvedValueOnce({ id: 'new-asset-id-2' });

    render(<CreateFixedAssetDialog open={true} onOpenChange={vi.fn()} />);

    await waitFor(() => {
      const invInput = screen.getByLabelText(/Leltári szám/i) as HTMLInputElement;
      expect(invInput.value).toBe('TE-2610-0001');
    });

    fireEvent.change(screen.getByLabelText(/Megnevezés/i), {
      target: { value: 'iPhone 15 Pro' },
    });
    fireEvent.change(screen.getByLabelText(/Bekerülési \(bruttó\) érték/i), {
      target: { value: '450000' },
    });

    const submitBtn = screen.getByRole('button', { name: /Eszköz mentése/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 'test-comp-1',
          name: 'iPhone 15 Pro',
          acquisitionValue: 450000,
          skipLedgerPosting: false, // Standard active asset triggers ledger posting
        })
      );
    });
  });
});
