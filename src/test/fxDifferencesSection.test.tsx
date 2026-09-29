import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FxDifferencesSection, {
  type FxDifferenceRow,
  type FxMonthlySummary,
} from '@/components/dashboard/FxDifferencesSection';

// Mock recharts ResponsiveContainer to avoid jsdom zero-dimension issues
vi.mock('recharts', async () => {
  const actual: any = await vi.importActual('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  };
});

describe('FxDifferencesSection - Fintech Dense Split (Option 1)', () => {
  const sampleSummary: FxMonthlySummary[] = [
    { month: '2026-01', gain: 140000, loss: -50000, net: 90000, count: 2 },
    { month: '2026-02', gain: 80000, loss: -120000, net: -40000, count: 2 },
  ];

  const sampleDifferences: FxDifferenceRow[] = [
    {
      invoice_id: 'inv-1',
      invoice_source: 'submitted',
      invoice_number: 'INV-2026-01',
      partner_name: 'DHL Express',
      invoice_direction: 'INBOUND',
      currency: 'EUR',
      foreign_amount: 1000,
      delivery_date: '2026-01-10',
      delivery_rate: 395,
      delivery_huf: 395000,
      settlement_date: '2026-01-20',
      settlement_rate: 405,
      settlement_huf: 405000,
      fx_difference: 10000,
      settlement_month: '2026-01',
    },
    {
      invoice_id: 'inv-2',
      invoice_source: 'submitted',
      invoice_number: 'AWS-2026-02',
      partner_name: 'Amazon Web Services',
      invoice_direction: 'INBOUND',
      currency: 'USD',
      foreign_amount: 500,
      delivery_date: '2026-02-05',
      delivery_rate: 360,
      delivery_huf: 180000,
      settlement_date: '2026-02-15',
      settlement_rate: 350,
      settlement_huf: 175000,
      fx_difference: -5000,
      settlement_month: '2026-02',
    },
  ];

  it('renders section title, KPI cards, and annual net total', () => {
    render(
      <FxDifferencesSection
        fxDifferences={sampleDifferences}
        fxMonthlySummary={sampleSummary}
        isOpen={true}
        onOpenChange={() => {}}
      />
    );

    // Section title
    expect(screen.getByText('Árfolyam-különbözetek')).toBeInTheDocument();

    // Annual net is (90 000 - 40 000) = +50 000 Ft
    expect(screen.getAllByText(/\+50\s?000\s?Ft/).length).toBeGreaterThan(0);

    // GL Classification block
    expect(screen.getByText('Főkönyvi besorolás')).toBeInTheDocument();
    expect(screen.getAllByText(/976/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/876/).length).toBeGreaterThan(0);
  });

  it('allows expanding and viewing invoice rows inside months', () => {
    render(
      <FxDifferencesSection
        fxDifferences={sampleDifferences}
        fxMonthlySummary={sampleSummary}
        isOpen={true}
        onOpenChange={() => {}}
      />
    );

    // Click on 2026. Jan month row header to expand
    const janHeader = screen.getByText('2026. Jan');
    fireEvent.click(janHeader);

    // DHL Express row should be visible
    expect(screen.getByText(/INV-2026-01/)).toBeInTheDocument();
    expect(screen.getByText(/DHL Express/)).toBeInTheDocument();
  });

  it('filters rows by currency when currency buttons are clicked', () => {
    render(
      <FxDifferencesSection
        fxDifferences={sampleDifferences}
        fxMonthlySummary={sampleSummary}
        isOpen={true}
        onOpenChange={() => {}}
      />
    );

    // In 2026-02, AWS-2026-02 is default expanded and visible
    expect(screen.getByText(/AWS-2026-02/)).toBeInTheDocument();

    // Filter to EUR: AWS (USD) should disappear, EUR should remain when Jan is opened
    const eurBtn = screen.getByRole('button', { name: /EUR/ });
    fireEvent.click(eurBtn);

    expect(screen.queryByText(/AWS-2026-02/)).not.toBeInTheDocument();

    // Open Jan to see DHL Express (EUR)
    const janHeader = screen.getByText('2026. Jan');
    fireEvent.click(janHeader);
    expect(screen.getByText(/INV-2026-01/)).toBeInTheDocument();
  });

  it('returns null when both fxDifferences and fxMonthlySummary are empty', () => {
    const { container } = render(
      <FxDifferencesSection
        fxDifferences={[]}
        fxMonthlySummary={[]}
        isOpen={true}
        onOpenChange={() => {}}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});
