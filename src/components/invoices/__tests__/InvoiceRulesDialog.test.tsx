import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InvoiceRulesDialog } from '../InvoiceRulesDialog';

const mockToast = vi.fn();
const mockInvalidateQueries = vi.fn();
const mockRpc = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

const sampleRules = [
  {
    id: 'rule-1',
    company_id: 'company-uuid-1',
    user_id: 'user-1',
    name: 'Telekom számlák',
    description_pattern: 'Telekom',
    pattern_type: 'contains',
    direction: 'ALL',
    partner_tax_number: null,
    partner_name: 'Magyar Telekom Nyrt.',
    target_gl_number: '5230',
    target_gl_account_id: 'gl-acc-1',
    target_vat_code_id: 'vat-1',
    target_vat_code: '27%',
    scope: 'company',
    is_active: true,
    priority: 100,
    created_at: '2026-09-24T00:00:00Z',
  },
];

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        or: vi.fn(() => ({
          order: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({ data: sampleRules, error: null }),
          })),
        })),
        eq: vi.fn(() => ({
          order: vi.fn().mockResolvedValue({ data: [{ id: 'vat-1', code: '27%' }], error: null }),
        })),
      })),
      update: vi.fn(() => ({
        eq: mockUpdate,
      })),
      delete: vi.fn(() => ({
        eq: mockDelete,
      })),
      insert: vi.fn().mockResolvedValue({ error: null }),
    })),
    rpc: (...args: any[]) => mockRpc(...args),
  },
}));

vi.mock('@/lib/glData', () => ({
  fetchAllGlAccountsByPreset: vi.fn().mockResolvedValue([
    { id: 'gl-acc-1', gl_number: '5230', short_name: 'Távközlési szolgáltatás' },
  ]),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ session: { user: { id: 'user-1' } } }),
}));

vi.mock('@/contexts/CompanyContext', () => ({
  useCompany: () => ({
    selectedCompany: { id: 'company-uuid-1', name: 'Test Kft.' },
  }),
  useOptionalCompany: () => ({
    selectedCompany: { id: 'company-uuid-1', name: 'Test Kft.' },
  }),
}));

vi.mock('@/hooks/useActivePreset', () => ({
  useActivePreset: () => ({ activePresetId: 'preset-uuid-1' }),
}));

vi.mock('@tanstack/react-query', () => {
  return {
    useQuery: ({ queryKey }: any) => {
      if (queryKey[0] === 'invoice_item_rules') {
        return { data: sampleRules, isLoading: false };
      }
      if (queryKey[0] === 'glAccounts_rules_dialog') {
        return { data: [{ id: 'gl-acc-1', gl_number: '5230', short_name: 'Távközlési szolgáltatás' }], isLoading: false };
      }
      if (queryKey[0] === 'vat_codes_rules_dialog') {
        return { data: [{ id: 'vat-1', code: '27%' }], isLoading: false };
      }
      return { data: [], isLoading: false };
    },
    useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
  };
});

describe('InvoiceRulesDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ data: { total_updated: 5 }, error: null });
    mockUpdate.mockResolvedValue({ error: null });
    mockDelete.mockResolvedValue({ error: null });
  });

  it('renders rules list, rule details, and action buttons', () => {
    render(<InvoiceRulesDialog {...defaultProps} />);

    expect(screen.getByText('Számlakontírozási Szabályok')).toBeInTheDocument();
    expect(screen.getByText('Telekom számlák')).toBeInTheDocument();
    expect(screen.getByText('5230')).toBeInTheDocument();
    expect(screen.getByText('ÁFA: 27%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Szabályok futtatása/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Új szabály/i })).toBeInTheDocument();
  });

  it('executes batch apply RPC when "Szabályok futtatása" is clicked', async () => {
    render(<InvoiceRulesDialog {...defaultProps} />);

    const runBtn = screen.getByRole('button', { name: /Szabályok futtatása/i });
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('apply_invoice_item_rules', {
        p_company_id: 'company-uuid-1',
        p_preset_id: 'preset-uuid-1',
        p_user_id: 'user-1',
        p_only_unclassified: true,
      });
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Szabályok alkalmazása befejeződött',
      }));
    });
  });

  it('switches to create mode and renders form fields', () => {
    render(<InvoiceRulesDialog {...defaultProps} />);

    const newRuleBtn = screen.getByRole('button', { name: /Új szabály/i });
    fireEvent.click(newRuleBtn);

    expect(screen.getByText('Új számlakontírozási szabály létrehozása')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/pl. Telekom számlák kontírozása/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Szabály létrehozása/i })).toBeInTheDocument();
  });
});
