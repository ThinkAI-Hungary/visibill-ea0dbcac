import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InvoiceItemRulesManager } from '@/components/invoices/InvoiceItemRulesManager';
import { DateRangeProvider } from '@/contexts/DateRangeContext';

const mockToast = vi.fn();
const mockRpc = vi.fn();

const sampleRules = [
  {
    id: 'rule-test-1',
    company_id: 'company-uuid-1',
    user_id: 'user-1',
    name: 'Minta Szabály',
    description_pattern: 'Minta',
    pattern_type: 'contains',
    direction: 'ALL',
    partner_tax_number: null,
    partner_name: null,
    target_gl_number: '511000',
    target_gl_account_id: 'gl-acc-1',
    target_vat_code_id: null,
    target_vat_code: null,
    scope: 'company',
    is_active: true,
    priority: 100,
    created_at: '2026-10-14T00:00:00Z',
  },
];

vi.mock('@/integrations/supabase/client', () => ({
  SUPABASE_URL: 'https://vxxgvdlqvvchtlmqnrqf.supabase.co',
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        or: vi.fn(() => ({
          order: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({ data: sampleRules, error: null }),
          })),
        })),
        eq: vi.fn(() => ({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        })),
      })),
      update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
      delete: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
      insert: vi.fn().mockResolvedValue({ error: null }),
    })),
    rpc: (...args: any[]) => mockRpc(...args),
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/contexts/CompanyContext', () => ({
  useCompany: () => ({
    selectedCompany: { id: 'company-uuid-1', name: 'Teszt Cég Kft' },
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    session: { user: { id: 'user-uuid-1' } },
  }),
}));

vi.mock('@/hooks/useActivePreset', () => ({
  useActivePreset: () => ({
    activePresetId: 'preset-uuid-1',
    isLoading: false,
  }),
}));

vi.mock('@/lib/glData', () => ({
  fetchAllGlAccountsByPreset: vi.fn().mockResolvedValue([
    { id: 'gl-acc-1', gl_number: '511000', short_name: 'Anyagköltség' },
  ]),
}));

describe('InvoiceItemRulesManager — Date Range Scoped Execution', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockRpc.mockResolvedValue({
      data: { success: true, total_updated: 5 },
      error: null,
    });
  });

  it('passes active date range from DateRangeContext to apply_invoice_item_rules RPC', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <DateRangeProvider>
            <InvoiceItemRulesManager />
          </DateRangeProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await screen.findByText('Minta Szabály');
    const runBtn = screen.getByRole('button', { name: /Szabályok futtatása/i });
    expect(runBtn).not.toBeDisabled();
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('apply_invoice_item_rules', expect.objectContaining({
        p_company_id: 'company-uuid-1',
        p_preset_id: 'preset-uuid-1',
        p_only_unclassified: true,
        p_date_from: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        p_date_to: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      }));
    });
  });

  it('runs safely without throwing when DateRangeProvider is omitted (defaults to null dates)', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <InvoiceItemRulesManager />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await screen.findByText('Minta Szabály');
    const runBtn = screen.getByRole('button', { name: /Szabályok futtatása/i });
    expect(runBtn).not.toBeDisabled();
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('apply_invoice_item_rules', expect.objectContaining({
        p_company_id: 'company-uuid-1',
        p_preset_id: 'preset-uuid-1',
        p_date_from: null,
        p_date_to: null,
      }));
    });
  });
});
