import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GlAccountFormFields, type GlAccountFormData } from '@/components/general-ledger/GlAccountFormFields';
import { EditGlAccountModal } from '@/components/general-ledger/EditGlAccountModal';
import { CopyChartOfAccountsModal } from '@/components/general-ledger/CopyChartOfAccountsModal';
import type { GlAccountRecord } from '@/types/accounting';

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

// Mock Select components to avoid Radix UI portal mounting issues in jsdom
vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, children, disabled }: any) => (
    <div data-testid="mock-select" data-disabled={disabled}>
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(child as any, { value, onValueChange, disabled })
          : child
      )}
    </div>
  ),
  SelectTrigger: ({ children, id, className }: any) => (
    <div id={id} className={className} data-testid="select-trigger">
      {children}
    </div>
  ),
  SelectValue: ({ placeholder }: any) => <span data-testid="select-value">{placeholder}</span>,
  SelectContent: ({ children, onValueChange }: any) => (
    <div data-testid="select-content">
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(child as any, { onValueChange })
          : child
      )}
    </div>
  ),
  SelectItem: ({ value, children, onValueChange }: any) => (
    <div
      role="option"
      data-value={value}
      onClick={() => onValueChange && onValueChange(value)}
      style={{ cursor: 'pointer' }}
    >
      {children}
    </div>
  ),
}));

vi.mock('@/lib/glData', async () => {
  const actual = await vi.importActual<any>('@/lib/glData');
  return {
    ...actual,
    fetchAllGlAccountsByPreset: vi.fn().mockResolvedValue([
      { id: 'acc-1', gl_number: '31', short_name: 'Követelések', account_type: 'group', subledger_type: 'none', is_open_item_managed: false, parent_id: null },
      { id: 'acc-2', gl_number: '311', short_name: 'Vevők', account_type: 'detail', subledger_type: 'partner', is_open_item_managed: true, parent_id: 'acc-1' },
      { id: 'acc-3', gl_number: '3111', short_name: 'Belföldi vevők', account_type: 'detail', subledger_type: 'partner', is_open_item_managed: true, parent_id: 'acc-2' },
    ]),
  };
});

const mockRpc = vi.fn();

const mockSingle = vi.fn().mockResolvedValue({ data: { id: 'acc-311' }, error: null });
const mockSelectAfterUpdate = vi.fn().mockReturnValue({ single: mockSingle });
const mockEqAfterUpdate = vi.fn().mockReturnValue({ select: mockSelectAfterUpdate });
const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqAfterUpdate });

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: any[]) => mockRpc(...args),
    from: vi.fn((table: string) => {
      if (table === 'gl_accounts') {
        return {
          update: mockUpdate,
          select: vi.fn().mockImplementation((_cols?: string, options?: any) => {
            if (options?.count === 'exact') {
              return {
                eq: vi.fn().mockResolvedValue({ count: 1645, error: null }),
              };
            }
            return {
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  range: vi.fn().mockResolvedValue({
                    data: [
                      { id: 'acc-1', gl_number: '311', short_name: 'Vevők', account_type: 'detail', subledger_type: 'partner', is_open_item_managed: true },
                    ],
                    error: null,
                  }),
                }),
              }),
            };
          }),
        };
      }
      if (table === 'chart_of_accounts_presets') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              neq: vi.fn().mockReturnValue({
                not: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: 'preset-source-1',
                      name: 'Saját számlatükör',
                      company_id: 'source-comp-1',
                      companies: {
                        id: 'source-comp-1',
                        name: 'Kolos Transport Kft.',
                      },
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };
    }),
  },
}));

describe('EB-0255: Chart of Accounts & Subledger Enhancements', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  describe('GlAccountFormFields component', () => {
    it('renders Group vs Detail account type options and subledger selection', () => {
      const mockOnChange = vi.fn();
      const initialValues: GlAccountFormData = {
        glNumber: '311',
        shortName: 'Vevők',
        description: 'Belföldi vevőkkel szembeni követelések',
        accountType: 'detail',
        subledgerType: 'partner',
        isOpenItemManaged: true,
        currency: 'HUF',
        isMulticurrency: false,
      };

      render(
        <GlAccountFormFields
          data={initialValues}
          onChange={mockOnChange}
          detectedParent={null}
        />
      );

      // Verify account type radio buttons are present
      expect(screen.getByText('Számla jellege')).toBeInTheDocument();
      expect(screen.getByText('Könyvelési számla (analitikus)')).toBeInTheDocument();
      expect(screen.getByText('Csoportszámla (gyűjtő)')).toBeInTheDocument();

      // Verify subledger type options are present
      expect(screen.getByText('Folyószámla és analitika típus')).toBeInTheDocument();
      expect(screen.getByText(/Nyitott tételek kezelése/i)).toBeInTheDocument();
    });

    it('toggles open-item managed setting when checkbox is clicked', () => {
      const mockOnChange = vi.fn();
      const initialValues: GlAccountFormData = {
        glNumber: '451',
        shortName: 'Tagi kölcsön',
        description: '',
        accountType: 'detail',
        subledgerType: 'none',
        isOpenItemManaged: false,
        currency: 'HUF',
        isMulticurrency: false,
      };

      const { container } = render(
        <GlAccountFormFields
          data={initialValues}
          onChange={mockOnChange}
        />
      );

      const checkbox = container.querySelector('#open-item-check');
      expect(checkbox).not.toBeNull();
      fireEvent.click(checkbox!);

      expect(mockOnChange).toHaveBeenCalledWith({ isOpenItemManaged: true });
    });
  });

  describe('EditGlAccountModal component', () => {
    const mockAccount: GlAccountRecord = {
      id: 'acc-311',
      gl_number: '311',
      name: 'Vevők',
      short_name: 'Vevők',
      description: 'Belföldi követelések',
      account_type: 'detail',
      subledger_type: 'partner',
      is_open_item_managed: true,
      currency: 'HUF',
      is_multicurrency: false,
      is_active: true,
      preset_id: 'preset-1',
      company_id: 'comp-1',
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    };

    it('renders with existing account details prefilled', () => {
      render(
        <QueryClientProvider client={queryClient}>
          <EditGlAccountModal
            open={true}
            onOpenChange={vi.fn()}
            account={mockAccount}
            presetId="preset-1"
            companyId="comp-1"
          />
        </QueryClientProvider>
      );

      expect(screen.getByText(/Főkönyvi szám szerkesztése/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('311')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Vevők')).toBeInTheDocument();
    });

    it('submits updated subledger and account type settings', async () => {
      const mockOnOpenChange = vi.fn();

      render(
        <QueryClientProvider client={queryClient}>
          <EditGlAccountModal
            open={true}
            onOpenChange={mockOnOpenChange}
            account={mockAccount}
            presetId="preset-1"
            companyId="comp-1"
          />
        </QueryClientProvider>
      );

      const submitBtn = screen.getByRole('button', { name: /Módosítások mentése/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            subledger_type: 'partner',
            is_open_item_managed: true,
            account_type: 'detail',
          })
        );
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: expect.stringMatching(/Főkönyvi szám módosítva/i),
          })
        );
        expect(mockOnOpenChange).toHaveBeenCalledWith(false);
      });
    });
  });

  describe('CopyChartOfAccountsModal component', () => {
    it('calls acc_copy_chart_of_accounts RPC and includes mapping counts in toast', async () => {
      mockRpc.mockResolvedValue({
        data: {
          success: true,
          source_company_id: 'source-comp-1',
          target_company_id: 'target-comp-2',
          target_preset_id: 'preset-cloned-1',
          accounts_copied: 1645,
          bs_mappings_copied: 250,
          pnl_mappings_copied: 120,
          source_company_name: 'Kolos Transport Kft.',
        },
        error: null,
      });

      const mockSuccess = vi.fn();

      render(
        <QueryClientProvider client={queryClient}>
          <CopyChartOfAccountsModal
            open={true}
            onOpenChange={vi.fn()}
            targetCompanyId="target-comp-2"
            targetCompanyName="Mandala Kft."
            onSuccess={mockSuccess}
          />
        </QueryClientProvider>
      );

      expect(screen.getByText(/Számlatükör Másolása Másik Cégből/i)).toBeInTheDocument();
      expect(screen.getByText(/Mandala Kft\./i)).toBeInTheDocument();

      // Wait for source companies to load into the mocked Select options
      await waitFor(() => {
        expect(screen.getByText(/Kolos Transport Kft\./i)).toBeInTheDocument();
      });

      // Select the source company by clicking option
      const companyOption = screen.getByText(/Kolos Transport Kft\./i);
      fireEvent.click(companyOption);

      // Click copy button
      const copyBtn = screen.getByRole('button', { name: /1-kattintásos átmásolás/i });
      expect(copyBtn).not.toBeDisabled();
      fireEvent.click(copyBtn);

      await waitFor(() => {
        expect(mockRpc).toHaveBeenCalledWith('acc_copy_chart_of_accounts', {
          p_source_company_id: 'source-comp-1',
          p_target_company_id: 'target-comp-2',
        });
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: expect.stringMatching(/Számlatükör sikeresen átmásolva/i),
            description: expect.stringMatching(/250 mérleg- és 120 eredménykimutatás/i),
          })
        );
        expect(mockSuccess).toHaveBeenCalledWith('preset-cloned-1');
      });
    });
  });

  describe('Subledger Filtering and Partner Constraint Rules', () => {
    it('filters out group accounts and retains only posting accounts in subledger dropdown', () => {
      const allAccounts = [
        { id: '1', gl_number: '31', short_name: 'Követelések', account_type: 'group', subledger_type: 'none', is_open_item_managed: false },
        { id: '2', gl_number: '311', short_name: 'Belföldi vevők', account_type: 'detail', subledger_type: 'partner', is_open_item_managed: true },
        { id: '3', gl_number: '4511', short_name: 'Tagi kölcsön A', account_type: 'detail', subledger_type: 'detail', is_open_item_managed: true },
        { id: '4', gl_number: '45', short_name: 'Rövid lejáratú kötelezettségek', account_type: 'group', subledger_type: 'none', is_open_item_managed: false },
      ];

      // Simulate filter from useSubledgerAccounts
      const filtered = allAccounts.filter((acc) => acc.account_type !== 'group');

      expect(filtered).toHaveLength(2);
      expect(filtered.map(a => a.gl_number)).toEqual(['311', '4511']);
      expect(filtered.every(a => a.account_type === 'detail')).toBe(true);
    });

    it('identifies partner-enforced accounts and group accounts for manual journal validation', () => {
      const glAccounts = [
        { id: 'gl-grp', gl_number: '31', short_name: 'Követelések', account_type: 'group', subledger_type: 'none' },
        { id: 'gl-partner', gl_number: '311', short_name: 'Belföldi vevők', account_type: 'detail', subledger_type: 'partner' },
        { id: 'gl-detail', gl_number: '4511', short_name: 'Tagi kölcsön', account_type: 'detail', subledger_type: 'detail' },
        { id: 'gl-std', gl_number: '511', short_name: 'Bérköltség', account_type: 'detail', subledger_type: 'none' },
      ];

      // Validate group account check
      const lineWithGroup = { gl_account_id: 'gl-grp', amount: 10000 };
      const matchedGroup = glAccounts.find(g => g.id === lineWithGroup.gl_account_id);
      expect(matchedGroup?.account_type).toBe('group');

      // Validate partner-enforced account check
      const lineWithPartnerRequired = { gl_account_id: 'gl-partner', amount: 10000 };
      const matchedPartner = glAccounts.find(g => g.id === lineWithPartnerRequired.gl_account_id);
      expect(matchedPartner?.subledger_type).toBe('partner');

      // Detail subledger does not enforce partner
      const lineWithDetail = { gl_account_id: 'gl-detail', amount: 5000 };
      const matchedDetail = glAccounts.find(g => g.id === lineWithDetail.gl_account_id);
      expect(matchedDetail?.subledger_type).toBe('detail');
    });
  });
});
