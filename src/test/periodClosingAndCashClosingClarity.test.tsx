import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CashClosingDialog from '@/components/petty-cash/CashClosingDialog';
import PeriodClosingSettings from '@/components/journals/PeriodClosingSettings';

vi.mock('@/contexts/DateRangeContext', () => ({
  useDateRange: () => ({
    dateFromFormatted: '2026-04-01',
    dateToFormatted: '2026-04-30',
  }),
}));

vi.mock('@/contexts/CompanyContext', () => ({
  useCompany: () => ({
    selectedCompany: { id: 'comp-1', name: 'VBV Vision Kft.' },
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/hooks/useAccountingPolicy', () => ({
  useCompanyAccountingRule: () => ({
    value: { amount: 1500000 },
  }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: [], isLoading: false, refetch: vi.fn() }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: 'u1' } } }),
    },
    from: () => ({
      select: () => ({
        in: () => Promise.resolve({ data: [] }),
        eq: () => ({
          lt: () => Promise.resolve({ data: [] }),
          eq: () => Promise.resolve({ data: [] }),
        }),
      }),
    }),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultVal?: any) => (typeof defaultVal === 'string' ? defaultVal : key),
  }),
}));

describe('CashClosingDialog and PeriodClosing clarity enhancements', () => {
  const dummyRegisters = [
    {
      id: 'reg-1',
      company_id: 'comp-1',
      name: 'Főpénztár',
      location: 'Központ',
      currencies: ['HUF'],
      is_default: true,
      created_at: '',
      updated_at: '',
      created_by: '',
      closing_mode: 'monthly',
      custom_days: 30,
      cash_limit: 1500000,
      limit_action: 'warn',
      receipt_policy: 'when_no_document',
      approval_threshold: 200000,
      gl_account: '381',
      is_single_person_mode: false,
    },
  ];

  it('renders "Időszaki Zárási Varázsló" button when onOpenWizard is provided and calls it on click', () => {
    const handleOpenWizard = vi.fn();
    const handleOpenChange = vi.fn();

    render(
      <CashClosingDialog
        open={true}
        onOpenChange={handleOpenChange}
        entries={[]}
        registers={dummyRegisters as any}
        registerMap={{ 'reg-1': dummyRegisters[0] } as any}
        companyId="comp-1"
        onOpenWizard={handleOpenWizard}
      />
    );

    const wizardBtn = screen.getByText('Időszaki Zárási Varázsló');
    expect(wizardBtn).toBeInTheDocument();

    fireEvent.click(wizardBtn);
    expect(handleOpenChange).toHaveBeenCalledWith(false);
    expect(handleOpenWizard).toHaveBeenCalled();
  });

  it('renders PeriodClosingSettings with clear Főkönyvi title and description distinguishing it from petty cash', () => {
    render(
      <PeriodClosingSettings
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    expect(screen.getByText('Főkönyvi időszakok zárolása')).toBeInTheDocument();
    expect(screen.getByText(/Kettős könyvviteli adóidőszakok zárolása/)).toBeInTheDocument();
    expect(screen.getByText(/A házipénztár pénzforgalmi zárása és a címletjegyzék készítése a Pénzügyek → Házipénztár/)).toBeInTheDocument();
  });
});
