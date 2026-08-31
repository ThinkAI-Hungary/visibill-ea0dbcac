import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { GeneralLedgerBadgeSection } from '../components/expanded-row/GeneralLedgerBadgeSection';
import { ContinuousServiceCardSection } from '../components/expanded-row/ContinuousServiceCardSection';
import { NettingCardSection } from '../components/expanded-row/NettingCardSection';
import { MatchedCourierReportsSection } from '../components/expanded-row/MatchedCourierReportsSection';

describe('Expanded Invoice Row Subcomponents', () => {
  describe('GeneralLedgerBadgeSection', () => {
    it('renders null when glNumbers is empty', () => {
      const { container } = render(<GeneralLedgerBadgeSection glNumbers={null} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders badges for assigned GL numbers with status label', () => {
      render(<GeneralLedgerBadgeSection glNumbers="521, 529" hasSubmittedMatch={true} />);
      expect(screen.getByText(/Hozzárendelt főkönyvi számok/i)).toBeDefined();
      expect(screen.getByText(/521 \(Végleges\)/i)).toBeDefined();
      expect(screen.getByText(/529 \(Végleges\)/i)).toBeDefined();
    });

    it('renders temporary badge when hasSubmittedMatch is false', () => {
      render(<GeneralLedgerBadgeSection glNumbers="814" hasSubmittedMatch={false} />);
      expect(screen.getByText(/814 \(Ideiglenes\)/i)).toBeDefined();
    });
  });

  describe('ContinuousServiceCardSection', () => {
    it('renders null when isContinuous is false', () => {
      const { container } = render(<ContinuousServiceCardSection isContinuous={false} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders continuous service details and TI calculation when enabled', () => {
      render(
        <ContinuousServiceCardSection
          isContinuous={true}
          servicePeriodStart="2026-01-01"
          servicePeriodEnd="2026-01-31"
          calculatedTi="2026-02-15"
          tiCalculationMethod="payment_due"
        />
      );
      expect(screen.getByText(/Folyamatos szolgáltatás/i)).toBeDefined();
      expect(screen.getByText(/Áfa tv. 58.§/i)).toBeDefined();
      expect(screen.getByText(/Fizetési határidő/i)).toBeDefined();
    });
  });

  describe('NettingCardSection', () => {
    it('renders null when nettingGroup is null', () => {
      const { container } = render(<NettingCardSection nettingGroup={null} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders netting proposal details with partner and difference', () => {
      const mockNetting = {
        partnerTaxNumber: '12345678',
        partnerName: 'Partner Kft',
        deliveryMonth: '2026-01',
        currency: 'HUF',
        inboundInvoices: [
          { id: '1', invoice_number: 'IN-001', invoice_gross_amount: 50000, currency: 'HUF' } as any,
        ],
        outboundInvoices: [
          { id: '2', invoice_number: 'OUT-001', invoice_gross_amount: 80000, currency: 'HUF' } as any,
        ],
        inboundTotal: 50000,
        outboundTotal: 80000,
        netDifference: 30000,
      };

      render(<NettingCardSection nettingGroup={mockNetting} />);
      expect(screen.getByText(/Kompenzálási javaslat/i)).toBeDefined();
      expect(screen.getByText(/Partner Kft/i)).toBeDefined();
      expect(screen.getByText(/IN-001/i)).toBeDefined();
      expect(screen.getByText(/OUT-001/i)).toBeDefined();
      expect(screen.getByText(/követelés/i)).toBeDefined();
    });
  });

  describe('MatchedCourierReportsSection', () => {
    it('renders null when courierReports is empty', () => {
      const { container } = render(<MatchedCourierReportsSection courierReports={[]} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders courier report item card', () => {
      const mockReports = [
        {
          id: 'cr-1',
          report_type: 'GLS',
          package_number: 'PKG-123456',
          reference_number: 'REF-999',
          delivery_date: '2026-02-01',
          cod_amount: 15400,
          recipient_name: 'Teszt Vevő',
          matched_nav_invoice_id: null,
          matched_transaction_id: null,
        },
      ];

      render(<MatchedCourierReportsSection courierReports={mockReports} />);
      expect(screen.getByText(/Futárjelentés tétel/i)).toBeDefined();
      expect(screen.getByText('GLS')).toBeDefined();
      expect(screen.getByText('PKG-123456')).toBeDefined();
      expect(screen.getByText('Teszt Vevő')).toBeDefined();
    });
  });
});
