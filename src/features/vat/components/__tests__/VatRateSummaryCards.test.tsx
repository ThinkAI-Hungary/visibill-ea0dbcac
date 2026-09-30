import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { VatRateSummaryCards } from '../VatRateSummaryCards';

describe('VatRateSummaryCards (ÁFA Kulcs Összesítő)', () => {
  const sampleLineMap = {
    '07': { base_amount_rounded: 10000, tax_amount_rounded: 2700 }, // 27% payable
    '66': { base_amount_rounded: 4000, tax_amount_rounded: 1080 },  // 27% deductible
    '06': { base_amount_rounded: 2000, tax_amount_rounded: 360 },   // 18% payable
    '65': { base_amount_rounded: 1000, tax_amount_rounded: 180 },   // 18% deductible
    '05': { base_amount_rounded: 500, tax_amount_rounded: 25 },     // 5% payable
    '64': { base_amount_rounded: 200, tax_amount_rounded: 10 },     // 5% deductible
  };

  it('renders summary cards for all active VAT rates', () => {
    render(
      <VatRateSummaryCards
        lines={[]}
        lineMap={sampleLineMap}
        periodLabel="2026. március hó"
      />
    );

    expect(screen.getByText('27%-os')).toBeInTheDocument();
    expect(screen.getByText('18%-os')).toBeInTheDocument();
    expect(screen.getByText('5%-os')).toBeInTheDocument();
  });

  it('uses eFt unit by default for Hungarian companies', () => {
    render(
      <VatRateSummaryCards
        lines={[]}
        lineMap={sampleLineMap}
        isCroatia={false}
      />
    );

    // Checks that eFt is rendered
    expect(screen.getAllByText(/eFt/i).length).toBeGreaterThan(0);
  });

  it('uses € unit when isCroatia is true', () => {
    render(
      <VatRateSummaryCards
        lines={[]}
        lineMap={sampleLineMap}
        isCroatia={true}
      />
    );

    // Checks that € is rendered
    expect(screen.getAllByText(/€/i).length).toBeGreaterThan(0);
  });

  it('calculates net tax balance for 27% (2700 payable - 1080 deductible = +1620 eFt)', () => {
    render(
      <VatRateSummaryCards
        lines={[]}
        lineMap={sampleLineMap}
        isCroatia={false}
      />
    );

    expect(screen.getAllByText(/1\s*620/).length).toBeGreaterThan(0);
  });

  it('toggles expansion state when toggle button is clicked', () => {
    render(
      <VatRateSummaryCards
        lines={[]}
        lineMap={sampleLineMap}
      />
    );

    const toggleBtn = screen.getByRole('button');
    // Initially expanded
    expect(screen.getByRole('table')).toBeInTheDocument();

    // Collapse
    fireEvent.click(toggleBtn);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    // Expand again
    fireEvent.click(toggleBtn);
    expect(screen.getByRole('table')).toBeInTheDocument();
  });
});
