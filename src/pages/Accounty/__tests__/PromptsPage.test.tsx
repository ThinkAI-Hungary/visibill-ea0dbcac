import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PromptsPage from '../PromptsPage';

const mockCompany = {
  id: 'company-uuid-1',
  name: 'TS Consult Kft.',
  tax_number: '13086905-2-08',
};

const sampleItemRules = [
  {
    id: 'item-rule-1',
    company_id: 'company-uuid-1',
    user_id: 'user-1',
    name: 'Számviteli szolg. -> 921',
    description_pattern: 'Számviteli szolg.',
    pattern_type: 'contains',
    direction: 'OUTBOUND',
    partner_tax_number: null,
    partner_name: null,
    target_gl_number: '921',
    target_gl_account_id: 'gl-921',
    target_vat_code_id: null,
    target_vat_code: null,
    scope: 'company',
    is_active: true,
    priority: 100,
    created_at: '2026-09-29T00:00:00Z',
  },
];

const samplePromptRules = [
  {
    id: 'prompt-rule-1',
    company_id: 'company-uuid-1',
    rule_name: 'Benzin',
    rule_prompt: 'Azon a tankolási számlákon amin benzint vásárolunk az Áfa nem levonható.',
    is_active: true,
    created_at: '2026-09-08T00:00:00Z',
    updated_at: '2026-09-08T00:00:00Z',
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

vi.mock('@/hooks/accounty', () => ({
  useAccountyClient: () => ({
    data: mockCompany,
  }),
}));

vi.mock('@/hooks/useActivePreset', () => ({
  useActivePreset: () => ({
    activePresetId: 'preset-1',
  }),
}));

vi.mock('@/lib/glData', () => ({
  fetchAllGlAccountsByPreset: vi.fn().mockResolvedValue([
    { id: 'gl-921', gl_number: '921', short_name: 'Belf. szolg. árbev.' },
  ]),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'invoice_item_rules') {
        return {
          select: vi.fn(() => ({
            or: vi.fn(() => ({
              order: vi.fn(() => ({
                order: vi.fn().mockResolvedValue({ data: sampleItemRules, error: null }),
              })),
            })),
          })),
          update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
          delete: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      if (table === 'company_prompt_rules') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({ data: samplePromptRules, error: null }),
            })),
          })),
          update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
          delete: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      if (table === 'vat_codes') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            })),
          })),
        };
      }
      return {
        select: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    }),
    rpc: vi.fn().mockResolvedValue({ data: { total_updated: 0 }, error: null }),
  },
}));

function renderWithClient(ui: React.ReactElement, route: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/eaisybooks/:companyId/:dateRange/prompts" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('PromptsPage Dual Tabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dual tabs and defaults to item_rules tab showing InvoiceItemRulesManager', async () => {
    renderWithClient(
      <PromptsPage />,
      '/eaisybooks/company-uuid-1/2026-01-01_2026-12-31/prompts'
    );

    // Header title
    expect(screen.getByText('Könyvelési Szabályok')).toBeInTheDocument();

    // Tabs exist
    const itemRulesTab = screen.getByRole('tab', { name: /Számlatétel szabályok/i });
    const aiPromptsTab = screen.getByRole('tab', { name: /AI Prompt könyvtár/i });
    expect(itemRulesTab).toBeInTheDocument();
    expect(aiPromptsTab).toBeInTheDocument();

    // In item_rules tab, InvoiceItemRulesManager is visible with sample item rule
    await waitFor(() => {
      expect(screen.getByText('Számviteli szolg. -> 921')).toBeInTheDocument();
    });
    expect(screen.getByText('921')).toBeInTheDocument();
  });

  it('switches to AI Prompts tab and renders AI Prompt Library cards', async () => {
    renderWithClient(
      <PromptsPage />,
      '/eaisybooks/company-uuid-1/2026-01-01_2026-12-31/prompts?tab=ai_prompts'
    );

    // In ai_prompts tab, prompt rule card is visible
    await waitFor(() => {
      expect(screen.getByText('Benzin')).toBeInTheDocument();
    });
    expect(screen.getByText(/Azon a tankolási számlákon amin benzint vásárolunk/i)).toBeInTheDocument();
  });
});
