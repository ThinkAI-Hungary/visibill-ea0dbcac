import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MetricCard from '@/components/dashboard/MetricCard';
import { TrendingUp, Upload } from 'lucide-react';

describe('MetricCard - Structured Currency Matrix (Option 2)', () => {
  it('renders single amount correctly with fixed header and pinned footer', () => {
    render(
      <MetricCard
        title="Feltöltött számlák"
        value="319 db"
        description="Bizonylat összesen"
        footerBadge="239 befejezve"
        icon={Upload}
        variant="default"
      />
    );

    expect(screen.getByText('Feltöltött számlák')).toBeInTheDocument();
    expect(screen.getByText('319 db')).toBeInTheDocument();
    expect(screen.getByText('Bizonylat összesen')).toBeInTheDocument();
    expect(screen.getByText('239 befejezve')).toBeInTheDocument();
  });

  it('renders structured multi-currency rows with ISO badges and formatted amounts', () => {
    const currencyRows = [
      { currency: 'EUR', amount: 71459.42, formatted: '71 459,42 €', isNegative: false },
      { currency: 'USD', amount: 61075.48, formatted: '61 075,48 $', isNegative: false },
      { currency: 'HUF', amount: 67811812, formatted: '67 811 812 Ft', isNegative: false },
    ];

    render(
      <MetricCard
        title="Összes kiadás (Nettó)"
        currencyRows={currencyRows}
        description="INBOUND"
        icon={TrendingUp}
        variant="destructive"
      />
    );

    expect(screen.getByText('Összes kiadás (Nettó)')).toBeInTheDocument();
    expect(screen.getByText('EUR')).toBeInTheDocument();
    expect(screen.getByText('71 459,42 €')).toBeInTheDocument();
    expect(screen.getByText('USD')).toBeInTheDocument();
    expect(screen.getByText('61 075,48 $')).toBeInTheDocument();
    expect(screen.getByText('HUF')).toBeInTheDocument();
    expect(screen.getByText('67 811 812 Ft')).toBeInTheDocument();
    expect(screen.getByText('INBOUND')).toBeInTheDocument();
    expect(screen.getByText('3 deviza')).toBeInTheDocument();
  });

  it('handles negative currency amounts with destructive styling', () => {
    const currencyRows = [
      { currency: 'EUR', amount: 57231.30, formatted: '57 231,30 €', isNegative: false },
      { currency: 'HUF', amount: -1753650, formatted: '- 1 753 650 Ft', isNegative: true },
    ];

    render(
      <MetricCard
        title="Kintlévőség (Nettó)"
        currencyRows={currencyRows}
        description="Kifizetetlen kimenő számlák"
        icon={TrendingUp}
        variant="info"
      />
    );

    const negativeAmount = screen.getByText('- 1 753 650 Ft');
    expect(negativeAmount).toHaveClass('text-destructive');
  });
});
