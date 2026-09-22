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

function TestComponent({ defaultDateBasis }: { defaultDateBasis?: string }) {
  const { filters, setFilters } = useInvoiceFilters(
    'test-company',
    false, // disabled to prevent actual API calls
    '2026-01-01',
    '2026-12-31',
    [],
    [],
    [],
    'OUTBOUND',
    defaultDateBasis
  );

  return (
    <div>
      <span data-testid="search-value">{filters.search}</span>
      <span data-testid="date-basis">{filters.dateBasis}</span>
      <span data-testid="ddf-value">{filters.deliveryDateFrom}</span>
      <span data-testid="ddt-value">{filters.deliveryDateTo}</span>
      <button
        data-testid="toggle-kibocsatas"
        onClick={() => setFilters(prev => ({ ...prev, dateBasis: 'kibocsatas' }))}
      >
        Kibocsátás
      </button>
      <button
        data-testid="toggle-teljesites"
        onClick={() => setFilters(prev => ({ ...prev, dateBasis: 'teljesites' }))}
      >
        Teljesítés
      </button>
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

  it('correctly initializes delivery date and date basis parameters from URL', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/invoices?db=teljesites&ddf=2026-08-01&ddt=2026-08-31']}>
          <TestComponent />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByTestId('date-basis').textContent).toBe('teljesites');
    expect(screen.getByTestId('ddf-value').textContent).toBe('2026-08-01');
    expect(screen.getByTestId('ddt-value').textContent).toBe('2026-08-31');
  });

  it('honors defaultDateBasis when no URL param is present', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/invoices']}>
          <TestComponent defaultDateBasis="teljesites" />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByTestId('date-basis').textContent).toBe('teljesites');
  });

  it('allows overriding defaultDateBasis with explicit db=kibocsatas in URL', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/invoices?db=kibocsatas']}>
          <TestComponent defaultDateBasis="teljesites" />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByTestId('date-basis').textContent).toBe('kibocsatas');
  });

  it('updates dateBasis when toggled via user click', async () => {
    const { act } = await import('@testing-library/react');
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/invoices']}>
          <TestComponent defaultDateBasis="teljesites" />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByTestId('date-basis').textContent).toBe('teljesites');
    
    // Click Kibocsátás inside act
    await act(async () => {
      screen.getByTestId('toggle-kibocsatas').click();
    });
    expect(screen.getByTestId('date-basis').textContent).toBe('kibocsatas');

    // Click Teljesítés inside act
    await act(async () => {
      screen.getByTestId('toggle-teljesites').click();
    });
    expect(screen.getByTestId('date-basis').textContent).toBe('teljesites');
  });
});


