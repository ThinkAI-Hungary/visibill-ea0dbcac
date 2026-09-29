import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DashboardMetrics from '@/components/dashboard/DashboardMetrics';
import type { DashboardMetrics as Metrics, NavVatData } from '@/hooks/useDashboardData';

const mockMetrics: Metrics = {
  totalRevenue: 1000000,
  totalExpenses: 600000,
  netIncome: 400000,
  totalInvoices: 25,
  completedCount: 20,
  pendingCount: 5,
  totalAmountByCurrency: { HUF: 400000 },
};

const mockNavVatData: NavVatData = {
  revenueNet: { HUF: 1000000 },
  revenueGross: { HUF: 1270000 },
  expensesNet: { HUF: 600000 },
  expensesGross: { HUF: 762000 },
  unpaidOutboundNet: { HUF: 200000 },
  unpaidOutboundGross: { HUF: 254000 },
  unpaidInboundNet: { HUF: 100000 },
  unpaidInboundGross: { HUF: 127000 },
  inboundVat: { HUF: 162000 },
  outboundVat: { HUF: 270000 },
};

const convertToSelectedCurrency = (amount: number) => amount;

describe('DashboardMetrics - Profit KPI Net Invariance', () => {
  it('renders Eredmény as nettó when showBrutto is false', () => {
    render(
      <DashboardMetrics
        metrics={mockMetrics}
        navVatData={mockNavVatData}
        showBrutto={false}
        selectedCurrency="HUF"
        pettyCashBalances={[]}
        convertToSelectedCurrency={convertToSelectedCurrency}
      />
    );

    // Verify card titles have (nettó)
    expect(screen.getByText(/Összes bevétel \(nettó\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Összes kiadás \(nettó\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Eredmény \(nettó\)/i)).toBeInTheDocument();

    // Net operating balance should be 1 000 000 - 600 000 = 400 000 Ft (Könyvelt)
    expect(screen.getByText(/400\s?000\s?Ft/)).toBeInTheDocument();
    expect(screen.getAllByText(/Könyvelt/i).length).toBeGreaterThan(0);

    // Realized profit: 400 000 - 200 000 = 200 000 Ft (Realizált)
    expect(screen.getByText(/Realizált/i)).toBeInTheDocument();
    expect(screen.getAllByText(/200\s?000\s?Ft/).length).toBeGreaterThan(0);

    // Unpaid receivables: 200 000 Ft
    expect(screen.getByText(/Kintlévőség \(nyitott\)/i)).toBeInTheDocument();
  });

  it('renders Eredmény strictly as nettó even when showBrutto is true', () => {
    render(
      <DashboardMetrics
        metrics={mockMetrics}
        navVatData={mockNavVatData}
        showBrutto={true}
        selectedCurrency="HUF"
        pettyCashBalances={[]}
        convertToSelectedCurrency={convertToSelectedCurrency}
      />
    );

    // Revenue and Expenses should show (bruttó)
    expect(screen.getByText(/Összes bevétel \(bruttó\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Összes kiadás \(bruttó\)/i)).toBeInTheDocument();

    // But Eredmény MUST remain (nettó)! It should NOT be (bruttó)!
    expect(screen.getByText(/Eredmény \(nettó\)/i)).toBeInTheDocument();
    expect(screen.queryByText(/Eredmény \(bruttó\)/i)).not.toBeInTheDocument();

    // The value must STILL be the net operating balance: 1 000 000 - 600 000 = 400 000 Ft
    // (and NOT 1 270 000 - 762 000 = 508 000 Ft)
    expect(screen.getByText(/400\s?000\s?Ft/)).toBeInTheDocument();
    expect(screen.queryByText(/508\s?000\s?Ft/)).not.toBeInTheDocument();

    // Realized result must also remain net: 400 000 - 200 000 = 200 000 Ft
    expect(screen.getByText(/Realizált/i)).toBeInTheDocument();
    expect(screen.getAllByText(/200\s?000\s?Ft/).length).toBeGreaterThan(0);
  });
});
