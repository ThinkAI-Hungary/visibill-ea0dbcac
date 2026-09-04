import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GeneralLedgerComparisonTable } from '../GeneralLedgerComparisonTable';
import * as glDataModule from '@/lib/glData';

vi.mock('@/hooks/useExchangeRates', () => ({
  useExchangeRates: () => ({
    data: { EUR: 400, USD: 370, HUF: 1 },
    isLoading: false,
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {},
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

describe('GeneralLedgerComparisonTable', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  it('renders search, summary, paginated table and "Besorolatlan" for unclassified accounts', async () => {
    // Generate 60 accounts to trigger pagination (pageSize is 50)
    const mockCurr = Array.from({ length: 60 }, (_, i) => ({
      gl_account_id: `acc-${i}`,
      gl_number: i === 0 ? 'UNCLASSIFIED' : `${100 + i}.`,
      short_name: i === 0 ? 'Besorolatlan tételek' : `Számla ${100 + i}`,
      total_balance: 1000 * (i + 1),
    }));

    const mockPrev = Array.from({ length: 60 }, (_, i) => ({
      gl_account_id: `acc-${i}`,
      gl_number: i === 0 ? 'UNCLASSIFIED' : `${100 + i}.`,
      short_name: i === 0 ? 'Besorolatlan tételek' : `Számla ${100 + i}`,
      total_balance: 500 * (i + 1),
    }));

    vi.spyOn(glDataModule, 'fetchAllGlBalances').mockImplementation(async (params) => {
      if (params.dateFrom?.startsWith('2026')) {
        return mockCurr as any;
      }
      return mockPrev as any;
    });

    render(
      <QueryClientProvider client={queryClient}>
        <GeneralLedgerComparisonTable
          presetId="preset-1"
          companyId="comp-1"
          dateFrom="2026-01-01"
          dateTo="2026-12-31"
        />
      </QueryClientProvider>
    );

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText(/60 számla/i)).toBeInTheDocument();
    });

    // Verify search input is present
    expect(screen.getByPlaceholderText('Keresés (főkönyvi szám, megnevezés...)')).toBeInTheDocument();

    // Verify Export button is present
    expect(screen.getByRole('button', { name: /Export/i })).toBeInTheDocument();

    // Verify pagination is rendered (page 2 button exists because there are 60 items with pageSize 50)
    const page2Button = screen.getByRole('button', { name: '2' });
    expect(page2Button).toBeInTheDocument();

    // On page 1, UNCLASSIFIED is not present
    expect(screen.queryByText('UNCLASSIFIED')).not.toBeInTheDocument();

    // Click page 2 to view the end of the list where Besorolatlan is sorted
    fireEvent.click(page2Button);

    // Verify Besorolatlan is present on page 2
    expect(screen.getByText('Besorolatlan')).toBeInTheDocument();
  });
});
