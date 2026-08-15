import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useInvoiceFilters } from '@/hooks/useInvoiceFilters';

// Mock dependencies of useInvoiceFilters if any
vi.mock('@/hooks/useActivePreset', () => ({
  useActivePreset: () => ({ activePresetId: 'test-preset-id' })
}));

// QueryClientProvider mock is needed because useInvoiceFilters uses react-query's useQuery
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

function TestComponent() {
  const { filters } = useInvoiceFilters(
    'test-company',
    false, // disabled to prevent actual API calls
    '2026-01-01',
    '2026-12-31',
    [],
    [],
    [],
    'OUTBOUND'
  );

  return (
    <div>
      <span data-testid="search-value">{filters.search}</span>
    </div>
  );
}

describe('useInvoiceFilters URL parameters integration', () => {
  it('correctly initializes search query from the "search" query parameter', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/invoices?search=Golden+D%C3%B6ner+Kft.']}>
          <TestComponent />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByTestId('search-value').textContent).toBe('Golden Döner Kft.');
  });

  it('correctly initializes search query from the standard "q" query parameter', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/invoices?q=ArtHold+Kft']}>
          <TestComponent />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByTestId('search-value').textContent).toBe('ArtHold Kft');
  });
});
