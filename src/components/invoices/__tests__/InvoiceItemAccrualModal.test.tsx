import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InvoiceItemAccrualModal } from '../InvoiceItemAccrualModal';
import * as accrualPostingService from '@/features/journals/services/accrualPostingService';
import * as glData from '@/lib/glData';

// Mock dependencies
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/lib/glData', () => ({
  fetchAllGlAccountsByPreset: vi.fn(),
}));

vi.mock('@/features/journals/services/accrualPostingService', () => ({
  createAccrualJournalEntry: vi.fn(),
  getExistingAccrualForInvoice: vi.fn(),
  deleteAccrualEntry: vi.fn(),
}));

describe('InvoiceItemAccrualModal Component', () => {
  let queryClient: QueryClient;

  const mockItem = {
    id: 'item_test_1',
    line_number: 1,
    line_description: 'GDPR Kieg.biztositásí díj 2026.09.01.-2027.08.31. Közvetitett szolgáltatást tartalmaz',
    net_amount: 7700,
    gross_amount: 7700,
    gl_classifications: {
      preset_ts: {
        gl_number: '5359',
        gl_account_id: 'acc_5359',
      },
    },
  };

  const mockGlAccounts = [
    { id: 'acc_392', gl_number: '392', short_name: 'Költségek aktív időbeli elhatárolása', type: 'ASSET' },
    { id: 'acc_3921', gl_number: '3921', short_name: 'Költségek, ráfordítások aktív időbeli elhatárolása', type: 'ASSET' },
    { id: 'acc_481', gl_number: '481', short_name: 'Árbevételek passzív időbeli elhatárolása', type: 'LIABILITY' },
    { id: 'acc_5359', gl_number: '5359', short_name: 'Egyéb igénybe vett szolgáltatások', type: 'EXPENSE' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });

    vi.mocked(glData.fetchAllGlAccountsByPreset).mockResolvedValue(mockGlAccounts as any);
    vi.mocked(accrualPostingService.getExistingAccrualForInvoice).mockResolvedValue(null);
  });

  const renderModal = (props: Partial<React.ComponentProps<typeof InvoiceItemAccrualModal>> = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <InvoiceItemAccrualModal
          open={true}
          onOpenChange={vi.fn()}
          item={mockItem}
          invoiceId="inv_8c4def4c"
          invoiceNumber="E1720263358"
          currency="HUF"
          direction="INBOUND"
          partnerId="18105791"
          partnerName="MKOE"
          companyId="comp_35a5409c"
          presetId="preset_ts"
          {...props}
        />
      </QueryClientProvider>
    );
  };

  it('renders modal header, invoice number, and AIE badge for inbound invoice', async () => {
    renderModal();

    expect(screen.getByText('Időbeli elhatárolás rögzítése')).toBeInTheDocument();
    expect(screen.getByText('E1720263358')).toBeInTheDocument();
    expect(screen.getByText('AIE')).toBeInTheDocument();
    expect(screen.getByText(/MKOE/)).toBeInTheDocument();
  });

  it('automatically detects dates from line description and shows recognition badge', async () => {
    renderModal();

    expect(screen.getByText('Szövegből felismerve')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2026-09-01')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2027-08-31')).toBeInTheDocument();
  });

  it('calculates and displays pro-rata split amounts accurately for 7 700 Ft', async () => {
    renderModal();

    // Default method is monthly:
    // 2026: 4 months = 2 567 Ft
    // 2027: 8 months = 5 133 Ft
    await waitFor(() => {
      expect(screen.getByText(/2026.*költség:/i)).toBeInTheDocument();
      expect(screen.getByText(/2027.*elhatárolás:/i)).toBeInTheDocument();
      expect(screen.getAllByText(/5\s*133\s*Ft/).length).toBeGreaterThan(0);
    });
  });

  it('switches calculation method between monthly and daily smoothly', async () => {
    renderModal();

    const dailyBtn = screen.getByRole('button', { name: /Exakt naparányos/i });
    fireEvent.click(dailyBtn);

    // In daily mode for 2026-09-01 - 2027-08-31 (365 days):
    // 2026: 122 days = 2 574 Ft
    // 2027: 243 days = 5 126 Ft
    await waitFor(() => {
      expect(screen.getByText(/365 nap összesen/i)).toBeInTheDocument();
      expect(screen.getAllByText(/5\s*126\s*Ft/).length).toBeGreaterThan(0);
    });
  });

  it('renders the GL account select with full width and options without overflow blowout', async () => {
    renderModal();

    await waitFor(() => {
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
      expect(select.className).toContain('w-full');
      expect(select.className).toContain('truncate');
      const options = screen.getAllByRole('option');
      expect(options.length).toBeGreaterThanOrEqual(1);
      expect(options.some(opt => opt.textContent?.includes('392'))).toBe(true);
    });
  });

  it('calls createAccrualJournalEntry when "Elhatárolás könyvelése" button is clicked', async () => {
    vi.mocked(accrualPostingService.createAccrualJournalEntry).mockResolvedValue({
      headerId: 'hdr_created_1',
      accrualId: 'acc_created_1',
    });

    const mockOnSuccess = vi.fn();
    const mockOnOpenChange = vi.fn();

    renderModal({ onSuccess: mockOnSuccess, onOpenChange: mockOnOpenChange });

    // Wait for calculations and options to settle
    await waitFor(() => {
      expect(screen.getByText(/2027.*elhatárolás:/i)).toBeInTheDocument();
    });

    const submitBtn = screen.getByRole('button', { name: /Elhatárolás könyvelése/i });
    expect(submitBtn).toBeInTheDocument();

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(accrualPostingService.createAccrualJournalEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 'comp_35a5409c',
          presetId: 'preset_ts',
          invoiceId: 'inv_8c4def4c',
          invoiceNumber: 'E1720263358',
          partnerName: 'MKOE',
          accrualType: 'AIE',
          accrualDate: '2026-12-31',
          reversalDate: '2027-01-01',
          accrualAmount: 5133,
        })
      );
      expect(mockOnSuccess).toHaveBeenCalled();
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('displays existing accrual banner and allows deletion/storno', async () => {
    vi.mocked(accrualPostingService.getExistingAccrualForInvoice).mockResolvedValue({
      id: 'acc_existing_123',
      invoice_id: 'inv_8c4def4c',
      accrual_type: 'AIE',
      accrual_date: '2026-12-31',
      reversal_date: '2027-01-01',
      amount: 5133,
      gl_debit: '392',
      gl_credit: '5359',
      status: 'booked',
      booked_journal_entry_id: 'hdr_booked_123',
    });

    vi.mocked(accrualPostingService.deleteAccrualEntry).mockResolvedValue();

    renderModal();

    await waitFor(() => {
      expect(screen.getByText('Ezen a bizonylaton már van lekönyvelt elhatárolás!')).toBeInTheDocument();
    });

    const deleteBtn = screen.getByRole('button', { name: /Törlés/i });
    expect(deleteBtn).toBeInTheDocument();

    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(accrualPostingService.deleteAccrualEntry).toHaveBeenCalledWith(
        'acc_existing_123',
        'hdr_booked_123'
      );
    });
  });
});
