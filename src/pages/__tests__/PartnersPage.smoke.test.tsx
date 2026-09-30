import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PartnersPage from '../PartnersPage';

// Mock Auth & Company
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', resolvedTheme: 'light', setTheme: vi.fn() }),
  ThemeProvider: ({ children }: any) => children,
}));

const mockCompany = { id: 'company-1', name: 'Test Kft.', tax_number: '12345678-2-41' };

vi.mock('@/contexts/CompanyContext', () => ({
  useCompany: () => ({
    selectedCompany: mockCompany,
    companies: [mockCompany],
  }),
  useOptionalCompany: () => ({
    selectedCompany: mockCompany,
    companies: [mockCompany],
  }),
}));

vi.mock('@/contexts/DateRangeContext', () => ({
  useDateRange: () => ({
    dateRange: { from: new Date('2026-01-01'), to: new Date('2026-12-31') },
    setDateRange: vi.fn(),
    dateFrom: '2026-01-01',
    dateTo: '2026-12-31',
    dateFromFormatted: '2026.01.01',
    dateToFormatted: '2026.12.31',
  }),
}));

vi.mock('@/hooks/useEaisybillPermissions', () => ({
  useEaisybillPermissions: () => ({
    canEdit: true,
    canDelete: true,
    canWrite: vi.fn().mockReturnValue(true),
    canRead: vi.fn().mockReturnValue(true),
    isSuperAdmin: true,
    role: 'owner',
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue?: any) => {
      if (typeof defaultValue === 'string') return defaultValue;
      return _key;
    },
    i18n: {
      language: 'hu',
    },
  }),
}));

// Mock Supabase data
const samplePartners = [
  {
    id: 'p1',
    company_id: 'company-1',
    name: 'Almási Szolgáltató Kft.',
    tax_number: '12345678-2-41',
    iban: 'HU42117730161111222200000000',
    partner_type: 'supplier',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'p2',
    company_id: 'company-1',
    name: 'Bivaly Építő Zrt.',
    tax_number: '87654321-2-42',
    iban: null,
    partner_type: 'customer',
    created_at: '2026-01-02T00:00:00Z',
  },
];

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: table === 'partners' ? samplePartners : [],
            error: null,
            count: 2,
          }),
          range: vi.fn().mockResolvedValue({
            data: table === 'partners' ? samplePartners : [],
            error: null,
            count: 2,
          }),
        }),
        in: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    })),
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('PartnersPage Smoke Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mounts without throwing and renders partner search and action bar', async () => {
    render(<PartnersPage />, { wrapper: createWrapper() });

    // The search input should be present
    const searchInputs = screen.getAllByRole('textbox');
    expect(searchInputs.length).toBeGreaterThan(0);

    // Verify partners are rendered
    await waitFor(() => {
      expect(screen.getByText('Almási Szolgáltató Kft.')).toBeInTheDocument();
      expect(screen.getByText('Bivaly Építő Zrt.')).toBeInTheDocument();
    });
  });

  it('renders partner tax numbers and table structure', async () => {
    render(<PartnersPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('12345678-2-41')).toBeInTheDocument();
      expect(screen.getByText('87654321-2-42')).toBeInTheDocument();
    });
  });
});
