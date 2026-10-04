import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AccountingRulesDialog } from '@/components/accounting/AccountingRulesDialog';

const mockCompany = {
  id: 'company-uuid-1',
  name: 'Taxology Kft.',
  tax_number: '14160877-2-41',
};

const sampleItemRules = [
  {
    id: 'item-rule-1',
    company_id: 'company-uuid-1',
    user_id: 'user-1',
    name: 'Google Cloud -> 529',
    description_pattern: 'Google Cloud',
    pattern_type: 'contains',
    direction: 'INBOUND',
    partner_tax_number: null,
    partner_name: null,
    target_gl_number: '529',
    target_gl_account_id: 'gl-529',
    target_vat_code_id: null,
    target_vat_code: 'EU',
    scope: 'company',
    is_active: true,
    priority: 100,
    created_at: '2026-10-01T00:00:00Z',
  },
];

const samplePromptRules = [
  {
    id: 'prompt-rule-1',
    company_id: 'company-uuid-1',
    rule_name: 'Benzin levonás korlátozás',
    rule_prompt: 'Azon a tankolási számlákon amin benzint vásárolunk az Áfa nem levonható.',
    is_active: true,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
  },
];

vi.mock('@/contexts/CompanyContext', () => ({
  useCompany: () => ({
    selectedCompany: mockCompany,
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    session: { user: { id: 'user-1' } },
  }),
}));

vi.mock('@/hooks/useActivePreset', () => ({
  useActivePreset: () => ({
    activePresetId: 'preset-1',
  }),
}));

vi.mock('@/lib/glData', () => ({
  fetchAllGlAccountsByPreset: vi.fn().mockResolvedValue([
    { id: 'gl-529', gl_number: '529', short_name: 'Egyéb igénybevett szolg.' },
  ]),
}));

function createChainableMock(resolvedData: any) {
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    neq: vi.fn(() => chain),
    or: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    insert: vi.fn().mockResolvedValue({ error: null }),
    update: vi.fn().mockResolvedValue({ error: null }),
    delete: vi.fn().mockResolvedValue({ error: null }),
    then: (resolve: any, reject?: any) => Promise.resolve({ data: resolvedData, error: null }).then(resolve, reject),
  };
  return chain;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'invoice_item_rules') {
        return createChainableMock(sampleItemRules);
      }
      if (table === 'company_prompt_rules') {
        return createChainableMock(samplePromptRules);
      }
      return createChainableMock([]);
    }),
  },
}));

describe('AccountingRulesDialog Integration', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  const renderDialog = (
    open = true,
    onOpenChange = vi.fn(),
    defaultTab: 'item_rules' | 'ai_prompts' = 'item_rules'
  ) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AccountingRulesDialog open={open} onOpenChange={onOpenChange} defaultTab={defaultTab} />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('renders dual tabs (Számlatétel szabályok and AI Prompt könyvtár)', async () => {
    renderDialog(true);

    expect(screen.getByText('Könyvelési Szabályok')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Számlatétel szabályok/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /AI Prompt könyvtár/i })).toBeInTheDocument();
  });

  it('displays deterministic item rules on Tab 1 by default', async () => {
    renderDialog(true);

    await waitFor(() => {
      expect(screen.getByText('Google Cloud -> 529')).toBeInTheDocument();
    });
    expect(screen.getByText('529')).toBeInTheDocument();
  });

  it('renders AI Prompt library when defaultTab is ai_prompts or tab is switched', async () => {
    renderDialog(true, vi.fn(), 'ai_prompts');

    await waitFor(() => {
      expect(screen.getByText('Benzin levonás korlátozás')).toBeInTheDocument();
    });
    expect(screen.getByText(/Azon a tankolási számlákon amin benzint vásárolunk/i)).toBeInTheDocument();
  });
});
