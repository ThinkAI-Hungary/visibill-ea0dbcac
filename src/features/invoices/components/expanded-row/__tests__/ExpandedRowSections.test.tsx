import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { GeneralLedgerBadgeSection } from '../GeneralLedgerBadgeSection';
import { ContinuousServiceCardSection } from '../ContinuousServiceCardSection';
import { NettingCardSection } from '../NettingCardSection';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, optionsOrDefault?: any) => {
      if (typeof optionsOrDefault === 'string') return optionsOrDefault;
      if (optionsOrDefault && typeof optionsOrDefault === 'object' && optionsOrDefault.defaultValue) {
        return optionsOrDefault.defaultValue;
      }
      return _key;
    },
  }),
}));

describe('Expanded Invoice Row Sub-Components', () => {
  describe('GeneralLedgerBadgeSection', () => {
    it('returns null when glNumbers is not provided', () => {
      const { container } = render(<GeneralLedgerBadgeSection glNumbers={null} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders temporary badges when hasSubmittedMatch is false', () => {
      render(<GeneralLedgerBadgeSection glNumbers="911, 511" hasSubmittedMatch={false} />);

      expect(screen.getByText(/Hozzárendelt főkönyvi számok/i)).toBeInTheDocument();
      expect(screen.getByText(/911 \(Ideiglenes\)/i)).toBeInTheDocument();
      expect(screen.getByText(/511 \(Ideiglenes\)/i)).toBeInTheDocument();
    });

    it('renders final badges when hasSubmittedMatch is true', () => {
      render(<GeneralLedgerBadgeSection glNumbers="911" hasSubmittedMatch={true} />);

      expect(screen.getByText(/911 \(Végleges\)/i)).toBeInTheDocument();
    });
  });

  describe('ContinuousServiceCardSection', () => {
    it('returns null when isContinuous is false', () => {
      const { container } = render(<ContinuousServiceCardSection isContinuous={false} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders continuous service details and Áfa tv. 58.§ badge', () => {
      render(
        <ContinuousServiceCardSection
          isContinuous={true}
          servicePeriodStart="2026-03-01"
          servicePeriodEnd="2026-03-31"
          calculatedTi="2026-03-31"
          tiCalculationMethod="nav_period_end"
        />
      );

      expect(screen.getByText('Folyamatos szolgáltatás')).toBeInTheDocument();
      expect(screen.getByText('Áfa tv. 58.§')).toBeInTheDocument();
      expect(screen.getByText('📋 NAV szolg. időszak vége')).toBeInTheDocument();
      expect(screen.getByText('Szolg. időszak kezdete:')).toBeInTheDocument();
      expect(screen.getByText('Szolg. időszak vége:')).toBeInTheDocument();
    });

    it('renders manual override label when tiCalculationMethod is manual', () => {
      render(
        <ContinuousServiceCardSection
          isContinuous={true}
          tiOverride="2026-04-10"
          tiCalculationMethod="manual"
        />
      );

      expect(screen.getByText('✏️ Kézi felülírás')).toBeInTheDocument();
    });
  });

  describe('NettingCardSection', () => {
    it('returns null when nettingGroup is null', () => {
      const { container } = render(<NettingCardSection nettingGroup={null} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders netting partner, opposing invoices, and receivable net diff', () => {
      const mockNettingGroup = {
        partnerTaxNumber: '12345678-2-41',
        partnerName: 'Partner Kft.',
        deliveryMonth: '2026-03',
        currency: 'HUF',
        inboundInvoices: [
          {
            id: 'in-1',
            invoice_number: 'IN-001',
            invoice_gross_amount: 100000,
            currency: 'HUF',
          } as any,
        ],
        outboundInvoices: [
          {
            id: 'out-1',
            invoice_number: 'OUT-001',
            invoice_gross_amount: 250000,
            currency: 'HUF',
          } as any,
        ],
        inboundTotal: 100000,
        outboundTotal: 250000,
        netDifference: 150000,
      };

      render(<NettingCardSection nettingGroup={mockNettingGroup} />);

      expect(screen.getByText('Kompenzálási javaslat')).toBeInTheDocument();
      expect(screen.getByText('Partner Kft.')).toBeInTheDocument();
      expect(screen.getByText('(12345678-2-41)')).toBeInTheDocument();
      expect(screen.getByText('IN-001')).toBeInTheDocument();
      expect(screen.getByText('OUT-001')).toBeInTheDocument();
      expect(screen.getByText(/követelés/i)).toBeInTheDocument();
    });
  });
});
