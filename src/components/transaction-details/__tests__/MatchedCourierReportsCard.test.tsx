import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MatchedCourierReportsCard } from '../MatchedCourierReportsCard';
import { MatchedCourierReport } from '@/lib/matching/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => {
    React.useState(0);
    return {
      t: (key: string, defaultVal?: any) => {
        if (typeof defaultVal === 'string') return defaultVal;
        if (defaultVal?.defaultValue) return defaultVal.defaultValue;
        return key;
      },
    };
  },
}));

describe('MatchedCourierReportsCard - Rules of Hooks', () => {
  it('does not violate Rules of Hooks when transitioning from empty reports to loaded reports', () => {
    const mockReport: MatchedCourierReport = {
      id: 'report-1',
      report_type: 'GLS',
      package_number: 'PKG-123456',
      reference_number: 'REF-789',
      delivery_date: '2026-09-28',
      cod_amount: 15400,
      recipient_name: 'Minta Ügyfél',
      match_status: 'full',
      match_confidence: 0.95,
      invoice_number: 'SZ-2026-001',
      matched_nav_invoice_id: 'inv-123',
    };

    // First render with empty courier reports (initial query state: matchedCourierReports = [])
    const { rerender } = render(
      <MatchedCourierReportsCard
        courierReports={[]}
        extraMatches={[]}
        matchedInvoiceId={null}
      />
    );

    // Second render with loaded reports (after React Query completes)
    // In unpatched code, this will throw "Rendered more hooks than during the previous render"
    rerender(
      <MatchedCourierReportsCard
        courierReports={[mockReport]}
        extraMatches={[]}
        matchedInvoiceId={null}
      />
    );

    expect(screen.getByText('PKG-123456')).toBeInTheDocument();
  });

  it('renders null safely when courierReports is empty or undefined', () => {
    const { container } = render(
      <MatchedCourierReportsCard
        courierReports={[]}
        extraMatches={[]}
        matchedInvoiceId={null}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders summary frame when total row is present and calls onLinkCourierInvoices', () => {
    const onLinkMock = vi.fn();
    const reports: MatchedCourierReport[] = [
      {
        id: 'rep-total',
        report_type: 'GLS',
        package_number: null,
        reference_number: null,
        delivery_date: '2026-09-28',
        cod_amount: 50000,
        recipient_name: 'Összesítés',
        match_status: 'full',
        match_confidence: 1,
        row_type: 'total',
      },
      {
        id: 'rep-item-1',
        report_type: 'GLS',
        package_number: 'PKG-777',
        reference_number: 'REF-111',
        delivery_date: '2026-09-28',
        cod_amount: 25000,
        recipient_name: 'Vevő 1',
        match_status: 'suggested',
        match_confidence: 0.8,
        matched_nav_invoice_id: 'inv-999',
      },
    ];

    render(
      <MatchedCourierReportsCard
        courierReports={reports}
        extraMatches={[]}
        matchedInvoiceId={null}
        onLinkCourierInvoices={onLinkMock}
      />
    );

    expect(screen.getByText('PKG-777')).toBeInTheDocument();
    const linkBtn = screen.getByRole('button', { name: /Futár tételek összerendelése/i });
    expect(linkBtn).toBeInTheDocument();
    linkBtn.click();
    expect(onLinkMock).toHaveBeenCalledWith(['inv-999']);
  });
});
