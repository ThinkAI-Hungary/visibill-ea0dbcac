import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RoundingRulesCard } from '@/components/accounting/rules/RoundingRulesCard';
import { FxDifferenceRulesCard } from '@/components/accounting/rules/FxDifferenceRulesCard';
import { VatTransferRulesCard } from '@/components/accounting/rules/VatTransferRulesCard';
import { CopyCompanyRulesModal } from '@/components/accounting/rules/CopyCompanyRulesModal';
import { AutoAccountingRulesTab } from '@/components/accounting/rules/AutoAccountingRulesTab';
import type { AutoAccountingRules, GlAccountOption, JournalOption } from '@/hooks/useAutoAccountingRules';

const mockCompany = {
  id: 'c-test-1',
  name: 'Test Kft.',
  tax_number: '12345678-2-42',
};

const mockCompanyList = [
  { id: 'c-test-1', name: 'Test Kft.' },
  { id: 'c-source-2', name: 'Minta Könyvelő Kft.' },
];

const mockGlAccounts: GlAccountOption[] = [
  { id: 'gl-47911', gl_number: '47911', name: 'Pénzforgalmi ÁFA fizetendő' },
  { id: 'gl-36911', gl_number: '36911', name: 'Pénzforgalmi ÁFA levonható' },
  { id: 'gl-36914', gl_number: '36914', name: 'Bruttó előleg ÁFA' },
  { id: 'gl-47912', gl_number: '47912', name: 'Éven belüli ÁFA fizetendő' },
  { id: 'gl-36912', gl_number: '36912', name: 'Éven belüli ÁFA levonható' },
  { id: 'gl-47913', gl_number: '47913', name: 'Évek közötti ÁFA fizetendő' },
  { id: 'gl-36913', gl_number: '36913', name: 'Évek közötti ÁFA levonható' },
  { id: 'gl-9779', gl_number: '9779', name: 'Realizált árfolyamnyereség' },
  { id: 'gl-8755', gl_number: '8755', name: 'Realizált árfolyamveszteség' },
  { id: 'gl-9762', gl_number: '9762', name: 'Nem realizált árfolyamnyereség' },
  { id: 'gl-8762', gl_number: '8762', name: 'Nem realizált árfolyamveszteség' },
  { id: 'gl-9699', gl_number: '9699', name: 'Kerekítési többlet' },
  { id: 'gl-8699', gl_number: '8699', name: 'Kerekítési veszteség' },
];

const mockJournals: JournalOption[] = [
  { id: 'j-ve', code: 'VE', name: 'Vegyes napló', type: 'GENERAL' },
  { id: 'j-b1', code: 'B1', name: 'HUF Bank', type: 'BANK' },
];

const mockRules: AutoAccountingRules = {
  id: 'rule-1',
  company_id: 'c-test-1',
  vat_pf_payable_gl_id: 'gl-47911',
  vat_pf_deductible_gl_id: 'gl-36911',
  vat_advance_gross_gl_id: 'gl-36914',
  vat_intra_year_payable_gl_id: 'gl-47912',
  vat_intra_year_deductible_gl_id: 'gl-36912',
  vat_cross_year_payable_gl_id: 'gl-47913',
  vat_cross_year_deductible_gl_id: 'gl-36913',
  fx_realized_gain_gl_id: 'gl-9779',
  fx_realized_loss_gl_id: 'gl-8755',
  fx_realized_journal_id: 'j-ve',
  fx_unrealized_gain_gl_id: 'gl-9762',
  fx_unrealized_loss_gl_id: 'gl-8762',
  fx_unrealized_journal_id: 'j-ve',
  rounding_gain_gl_id: 'gl-9699',
  rounding_loss_gl_id: 'gl-8699',
  rounding_max_limit_huf: 10,
  is_active: true,
};

vi.mock('@/contexts/CompanyContext', () => ({
  useCompany: () => ({
    selectedCompany: mockCompany,
    companies: mockCompanyList,
  }),
}));

vi.mock('@/hooks/useAutoAccountingRules', async () => {
  const actual = await vi.importActual('@/hooks/useAutoAccountingRules');
  return {
    ...actual,
    useAutoAccountingRules: vi.fn(),
    useCompanyGlAccountsLookup: vi.fn(() => ({ data: mockGlAccounts, isLoading: false })),
    useCompanyJournalsLookup: vi.fn(() => ({ data: mockJournals, isLoading: false })),
    useSaveAutoAccountingRules: vi.fn(),
    useCopyAutoAccountingRules: vi.fn(),
  };
});

describe('AutoAccountingRules Unit & Integration Tests (EB-0256)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it('renders RoundingRulesCard correctly with gain, loss, and max limit fields', () => {
    const handleChange = vi.fn();
    render(
      <RoundingRulesCard
        rules={mockRules}
        accounts={mockGlAccounts}
        onChange={handleChange}
      />
    );

    expect(screen.getByText(/3\.\s*Kerekítési Különbözet Paraméterezése/i)).toBeInTheDocument();
    expect(screen.getByText(/Maximális forintos kerekítési határ \(HUF\)/i)).toBeInTheDocument();

    const limitInput = screen.getByDisplayValue('10');
    expect(limitInput).toBeInTheDocument();

    fireEvent.change(limitInput, { target: { value: '25' } });
    expect(handleChange).toHaveBeenCalledWith('rounding_max_limit_huf', 25);

    // Negative guard test
    fireEvent.change(limitInput, { target: { value: '-5' } });
    expect(handleChange).toHaveBeenCalledWith('rounding_max_limit_huf', 0);
  });

  it('renders FxDifferenceRulesCard with realized and unrealized sections', () => {
    const handleChange = vi.fn();
    render(
      <FxDifferenceRulesCard
        rules={mockRules}
        accounts={mockGlAccounts}
        journals={mockJournals}
        onChange={handleChange}
      />
    );

    expect(screen.getByText(/2\.\s*Árfolyam-különbözet Paraméterezése/i)).toBeInTheDocument();
    expect(screen.getByText('A.) Realizált Árfolyam-különbözet')).toBeInTheDocument();
    expect(screen.getByText('B.) Nem Realizált Árfolyam-különbözet')).toBeInTheDocument();
  });

  it('renders VatTransferRulesCard with all 4 required VAT transfer categories', () => {
    const handleChange = vi.fn();
    render(
      <VatTransferRulesCard
        rules={mockRules}
        accounts={mockGlAccounts}
        onChange={handleChange}
      />
    );

    expect(screen.getByText(/1\.\s*ÁFA Átvezetések Paraméterezése/i)).toBeInTheDocument();
    expect(screen.getByText('A.) Pénzforgalmi ÁFA Átvezetése')).toBeInTheDocument();
    expect(screen.getByText('B.) Bruttó Előleg ÁFA Kezelése')).toBeInTheDocument();
    expect(screen.getByText('C.) Automatikus ÁFA Átvezetés Éven Belül')).toBeInTheDocument();
    expect(screen.getByText('D.) Automatikus ÁFA Átvezetés Évek Között')).toBeInTheDocument();
  });

  it('renders CopyCompanyRulesModal and displays source company choices', async () => {
    const { useCopyAutoAccountingRules } = await import('@/hooks/useAutoAccountingRules');
    vi.mocked(useCopyAutoAccountingRules).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);

    render(
      <CopyCompanyRulesModal
        isOpen={true}
        onClose={vi.fn()}
        targetCompanyId="c-test-1"
        targetCompanyName="Test Kft."
      />
    );

    expect(screen.getByText('Szabályok Átvétele Másik Cégből')).toBeInTheDocument();
    expect(screen.getByText(/Test Kft./)).toBeInTheDocument();
    expect(screen.getByText(/Hogyan működik az átvétel\?/i)).toBeInTheDocument();
  });

  it('renders AutoAccountingRulesTab with floating unsaved bar when edits are made', async () => {
    const { useAutoAccountingRules, useSaveAutoAccountingRules, useCopyAutoAccountingRules } = await import('@/hooks/useAutoAccountingRules');
    const mockSaveMutate = vi.fn();

    vi.mocked(useAutoAccountingRules).mockReturnValue({
      data: { rules: mockRules, isConfigured: true },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.mocked(useSaveAutoAccountingRules).mockReturnValue({
      mutate: mockSaveMutate,
      isPending: false,
    } as any);

    vi.mocked(useCopyAutoAccountingRules).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <AutoAccountingRulesTab companyId="c-test-1" companyName="Test Kft." />
      </QueryClientProvider>
    );

    // Initial state: tab title and copy button
    expect(screen.getByText('Automata Könyvelés és Átvezetések Paraméterezése')).toBeInTheDocument();
    expect(screen.getByText('Átvétel másik cégből')).toBeInTheDocument();
    expect(screen.getByText(/Tájékoztatás a szabályok érvényességéről/i)).toBeInTheDocument();

    // Change the rounding max limit
    const limitInput = screen.getByDisplayValue('10');
    fireEvent.change(limitInput, { target: { value: '50' } });

    // Floating save bar must appear
    await waitFor(() => {
      expect(screen.getByText(/Nem mentett módosítások vannak/i)).toBeInTheDocument();
    });

    const saveButtons = screen.getAllByRole('button', { name: /Mentés/i });
    fireEvent.click(saveButtons[saveButtons.length - 1]);

    expect(mockSaveMutate).toHaveBeenCalled();
  });
});
