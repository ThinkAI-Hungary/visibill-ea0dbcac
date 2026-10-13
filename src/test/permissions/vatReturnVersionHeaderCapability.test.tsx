import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VatReturnVersionHeader } from '@/features/vat/components/VatReturnVersionHeader';
import { useCompanyCapabilities } from '@/hooks/useCompanyCapabilities';

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/hooks/useCompanyCapabilities', () => ({
  useCompanyCapabilities: vi.fn(),
}));

vi.mock('../services/vatSnapshotService', () => ({
  fetchVatSnapshots: vi.fn().mockResolvedValue([]),
  compareCurrentInvoicesWithSnapshot: vi.fn().mockResolvedValue(null),
  createVatSnapshot: vi.fn().mockResolvedValue({}),
}));

describe('VatReturnVersionHeader capability gating', () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const mockCaps = (canClosePeriod: boolean) => {
    vi.mocked(useCompanyCapabilities).mockReturnValue({
      canClosePeriod,
      canExportOfficialTaxReturn: false,
      canWriteLedger: false,
      canManagePayments: false,
      canViewBankBalances: false,
      canViewControlling: false,
      canManageInvoices: false,
      canManageAccountingTech: false,
      canManageTeam: false,
      isLoading: false,
      hasAssignedBookkeeper: true,
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('disables the finalize button and sets explanatory tooltip when hook returns canClosePeriod: false', () => {
    mockCaps(false);

    render(
      <QueryClientProvider client={queryClient}>
        <VatReturnVersionHeader
          selectedCompany={{ id: 'c1', name: 'Test Kft' }}
          year={2026}
          month={7}
          frequency="H"
          snapshots={[]}
        />
      </QueryClientProvider>
    );

    const button = screen.getByRole('button', { name: /Beadva \/ Véglegesítés/i });
    expect(button).toBeDisabled();

    const wrapper = button.closest('span');
    expect(wrapper).toHaveAttribute(
      'title',
      'A bevallási időszak zárolása és véglegesítése a kirendelt könyvelő jogosultsága (SoD feladatmegosztás).'
    );
  });

  it('enables the finalize button and opens dialog when hook returns canClosePeriod: true', () => {
    mockCaps(true);

    render(
      <QueryClientProvider client={queryClient}>
        <VatReturnVersionHeader
          selectedCompany={{ id: 'c1', name: 'Test Kft' }}
          year={2026}
          month={7}
          frequency="H"
          snapshots={[]}
        />
      </QueryClientProvider>
    );

    const button = screen.getByRole('button', { name: /Beadva \/ Véglegesítés/i });
    expect(button).not.toBeDisabled();

    fireEvent.click(button);
    expect(screen.getByText('ÁFA Bevallás Zárolása & Snapshot')).toBeInTheDocument();
  });
});
