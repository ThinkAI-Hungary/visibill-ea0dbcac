import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { RelatedPartyTurnoverTab } from '@/components/partners/RelatedPartyTurnoverTab';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock contexts
vi.mock('@/contexts/CompanyContext', () => ({
  useCompany: () => ({
    selectedCompany: { id: 'comp-123', name: 'Test Kft.', tax_number: '12345678-2-42' },
  }),
}));

vi.mock('@/contexts/DateRangeContext', () => ({
  useDateRange: () => ({
    dateFrom: new Date('2026-01-01'),
    dateTo: new Date('2026-12-31'),
    dateFromFormatted: '2026-01-01',
    dateToFormatted: '2026-12-31',
  }),
}));

// Mock the hook useRelatedPartyTurnover
vi.mock('@/hooks/useRelatedPartyTurnover', () => ({
  useRelatedPartyTurnover: () => ({
    isLoading: false,
    data: {
      totals: {
        partnerCount: 2,
        totalOutboundGross: 12500000,
        totalInboundGross: 4200000,
        totalGrossTurnover: 16700000,
        totalNetBalance: 8300000,
        cashExceededPartnerCount: 1,
        transferPricingRequiredCount: 0,
      },
      items: [
        {
          partnerId: 'part-1',
          partnerName: 'Alfa Holding Kft.',
          taxNumber: '11112222-2-41',
          relationType: 'parent',
          ownershipPercent: 75,
          parentPartnerName: null,
          outboundCount: 3,
          outboundNet: 9842520,
          outboundVat: 2657480,
          outboundGross: 12500000,
          inboundCount: 0,
          inboundNet: 0,
          inboundVat: 0,
          inboundGross: 0,
          totalGrossTurnover: 12500000,
          netBalance: 12500000,
          monthlyCashGross: 0,
          isCashLimitExceeded: false,
          isTransferPricingDocRequired: false,
          invoices: [
            {
              id: 'inv-1',
              source: 'nav',
              invoice_number: 'ALF-2026-001',
              issue_date: '2026-03-15',
              delivery_date: '2026-03-15',
              direction: 'outbound',
              net_amount: 9842520,
              vat_amount: 2657480,
              gross_amount: 12500000,
              currency: 'HUF',
              payment_method: 'Átutalás',
              is_cash: false,
              paid: true,
            },
          ],
        },
        {
          partnerId: 'part-2',
          partnerName: 'Béta Logisztika Zrt.',
          taxNumber: '33334444-2-42',
          relationType: 'subsidiary',
          ownershipPercent: 100,
          parentPartnerName: 'Alfa Holding Kft.',
          outboundCount: 0,
          outboundNet: 0,
          outboundVat: 0,
          outboundGross: 0,
          inboundCount: 4,
          inboundNet: 3307087,
          inboundVat: 892913,
          inboundGross: 4200000,
          totalGrossTurnover: 4200000,
          netBalance: -4200000,
          monthlyCashGross: 1800000,
          isCashLimitExceeded: true,
          isTransferPricingDocRequired: false,
          invoices: [],
        },
      ],
    },
  }),
}));

describe('RelatedPartyTurnoverTab Component', () => {
  const queryClient = new QueryClient();

  it('renders turnover KPI summary cards and table rows correctly', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <RelatedPartyTurnoverTab />
      </QueryClientProvider>
    );

    // KPI Cards
    expect(screen.getByText('Kiszámlázott árbevétel (912)')).toBeInTheDocument();
    expect(screen.getByText('Befogadott számlák (4551)')).toBeInTheDocument();
    expect(screen.getByText('Nettó egyenleg')).toBeInTheDocument();
    expect(screen.getByText('Törvényi figyelések')).toBeInTheDocument();

    // Partners listed in table
    expect(screen.getByText('Alfa Holding Kft.')).toBeInTheDocument();
    expect(screen.getByText('Béta Logisztika Zrt.')).toBeInTheDocument();

    // Relation badges
    expect(screen.getByText('Anyavállalat')).toBeInTheDocument();
    expect(screen.getByText('Leányvállalat')).toBeInTheDocument();

    // Cash limit warning badge
    expect(screen.getByText('1,5M felett!')).toBeInTheDocument();

    // CSV export button
    expect(screen.getByText('CSV Export')).toBeInTheDocument();
  });
});
