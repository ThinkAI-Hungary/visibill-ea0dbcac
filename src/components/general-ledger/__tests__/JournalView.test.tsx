import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import JournalView, { getLogicalTypeLabel, TYPE_LABELS } from '../JournalView';
import * as glDataModule from '@/lib/glData';

// Mock contexts and hooks
vi.mock('@/contexts/CompanyContext', () => ({
  useCompany: () => ({
    selectedCompany: { id: 'company-123', name: 'Test Kft.' },
  }),
}));

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

describe('JournalView - logical types and unclassified label', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  it('correctly maps raw source_table names to logical Hungarian labels in getLogicalTypeLabel', () => {
    expect(getLogicalTypeLabel('invoice_items')).toBe('Számla');
    expect(getLogicalTypeLabel('nav_invoice_items')).toBe('NAV Számla');
    expect(getLogicalTypeLabel('acc_journal_lines')).toBe('Naplótétel');
    expect(getLogicalTypeLabel('transactions')).toBe('Banki tranzakció');
    expect(getLogicalTypeLabel('journal_entry')).toBe('XML Naplótétel');
    expect(getLogicalTypeLabel(null, 'Banki tranzakció')).toBe('Banki tranzakció');
    expect(getLogicalTypeLabel(null, 'Bejövő (Költség)')).toBe('Számla');
    expect(getLogicalTypeLabel(null, 'NAV Bejövő tétel')).toBe('NAV Számla');
  });

  it('renders "Besorolatlan" instead of "UNCLASSIFIED" and logical type names instead of table names', async () => {
    const mockItems = [
      {
        item_id: 'item-1',
        item_date: '2026-09-01',
        partner: 'Hetzner Online GmbH',
        description: 'Project Default',
        gl_account_id: null,
        gl_number: 'UNCLASSIFIED',
        gl_name: 'Besorolatlan tételek',
        item_type: 'Bejövő (Költség)',
        amount: -14527.27,
        source_table: 'invoice_items',
        is_excluded: false,
      },
      {
        item_id: 'item-2',
        item_date: '2026-09-01',
        partner: 'DigitalOcean LLC',
        description: 'Droplets',
        gl_account_id: 'acc-529',
        amount: 28.00,
        source_table: 'acc_journal_lines',
        is_excluded: false,
      },
      {
        item_id: 'item-3',
        item_date: '2026-08-31',
        partner: 'Wagner Global Services Kft.',
        description: 'Szoftver',
        gl_account_id: null,
        amount: 11621961.00,
        source_table: 'nav_invoice_items',
        is_excluded: false,
      },
    ];

    const mockBalances = [
      {
        gl_account_id: 'acc-529',
        gl_number: '529.',
        short_name: 'Egyéb igénybe vett szolgáltatások',
        total_balance: 28.00,
      },
      {
        gl_account_id: null,
        gl_number: 'UNCLASSIFIED',
        short_name: 'Besorolatlan tételek',
        total_balance: 11607433.73,
      },
    ];

    vi.spyOn(glDataModule, 'fetchAllGlCategorizedItems').mockResolvedValue(mockItems as any);
    vi.spyOn(glDataModule, 'fetchAllGlBalances').mockResolvedValue(mockBalances as any);

    render(
      <QueryClientProvider client={queryClient}>
        <JournalView presetId="preset-1" />
      </QueryClientProvider>
    );

    // Wait for items to be loaded and rendered
    await waitFor(() => {
      expect(screen.getByText('Hetzner Online GmbH')).toBeInTheDocument();
      expect(screen.getByText('DigitalOcean LLC')).toBeInTheDocument();
      expect(screen.getByText('Wagner Global Services Kft.')).toBeInTheDocument();
    });

    // 1. Check FŐK. SZÁM column: UNCLASSIFIED must NOT be displayed; "Besorolatlan" must be present!
    expect(screen.queryByText('UNCLASSIFIED')).not.toBeInTheDocument();
    const besorolatlanBadges = screen.getAllByText('Besorolatlan');
    expect(besorolatlanBadges.length).toBeGreaterThanOrEqual(2); // Hetzner and Wagner

    // The classified item should show its GL number '529.'
    expect(screen.getByText('529.')).toBeInTheDocument();

    // 2. Check TÍPUS column: Raw table names must NOT appear in the rendered document!
    expect(screen.queryByText('invoice_items')).not.toBeInTheDocument();
    expect(screen.queryByText('acc_journal_lines')).not.toBeInTheDocument();
    expect(screen.queryByText('nav_invoice_items')).not.toBeInTheDocument();

    // Logical type names must be present in the document
    expect(screen.getByText('Számla')).toBeInTheDocument();
    expect(screen.getByText('Naplótétel')).toBeInTheDocument();
    expect(screen.getByText('NAV Számla')).toBeInTheDocument();
  });
});
