import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { VatA60Table } from '../VatA60Table';
import type { A60CalculationsResult, A60Line } from '../../types';

describe('VatA60Table Component', () => {
  const mockA60Calculations: A60CalculationsResult = {
    isValid: true,
    goodsOutSum: 0,
    goodsInSum: 13,
    servicesOutSum: 0,
    servicesInSum: 31,
    expectedGoodsOut: 0,
    expectedGoodsIn: 13,
    expectedServicesOut: 0,
    expectedServicesIn: 31,
    goodsOutMismatch: false,
    goodsInMismatch: false,
    servicesOutMismatch: false,
    servicesInMismatch: false,
    itemsList: [
      {
        id: 'inv-1',
        invoice_number: 'DE-2026-001',
        invoice_direction: 'INBOUND',
        partner_name: 'Digital Charging Solutions GmbH',
        partner_tax_number: 'DE312237805',
        country_code: 'DE',
        invoice_delivery_date: '2026-07-15',
        invoice_net_amount: 12699,
        currency: 'EUR',
        category: 'goods_in',
        isValidFormat: true,
      },
      {
        id: 'inv-2',
        invoice_number: 'IE-2026-099',
        invoice_direction: 'INBOUND',
        partner_name: 'Google Cloud EMEA Limited',
        partner_tax_number: 'IE3668997OH',
        country_code: 'IE',
        invoice_delivery_date: '2026-07-20',
        invoice_net_amount: 31300,
        currency: 'EUR',
        category: 'services_in',
        isValidFormat: true,
      },
    ],
    taxErrors: [],
  };

  const mockA60Lines: A60Line[] = [
    {
      id: 'a60-line-1',
      vat_return_id: 'ret-1',
      company_id: 'comp-1',
      category: 'goods_in',
      country_code: 'DE',
      partner_vat_number: '312237805',
      partner_name: 'Digital Charging Solutions GmbH',
      invoice_count: 1,
      base_amount: 12699,
      base_amount_rounded: 13,
      invoice_details: [],
    },
    {
      id: 'a60-line-2',
      vat_return_id: 'ret-1',
      company_id: 'comp-1',
      category: 'services_in',
      country_code: 'IE',
      partner_vat_number: '3668997OH',
      partner_name: 'Google Cloud EMEA Limited',
      invoice_count: 1,
      base_amount: 31300,
      base_amount_rounded: 31,
      invoice_details: [],
    },
  ];

  it('renders ÁNYK A60 Export button and triggers callback on click', () => {
    const handleExport = vi.fn();
    render(
      <VatA60Table
        a60Calculations={mockA60Calculations}
        viesStatuses={{}}
        isValidatingVies={false}
        handleViesCheck={vi.fn()}
        setEuTypeOverrides={vi.fn()}
        a60Lines={mockA60Lines}
        onExportClick={handleExport}
      />
    );

    const exportBtn = screen.getByRole('button', { name: /ÁNYK A60 Export/i });
    expect(exportBtn).toBeInTheDocument();

    fireEvent.click(exportBtn);
    expect(handleExport).toHaveBeenCalledTimes(1);
  });

  it('renders official 26A60 sheet tables with partner numbers and sheet totals', () => {
    render(
      <VatA60Table
        a60Calculations={mockA60Calculations}
        viesStatuses={{}}
        isValidatingVies={false}
        handleViesCheck={vi.fn()}
        setEuTypeOverrides={vi.fn()}
        a60Lines={mockA60Lines}
      />
    );

    // Checks header for A60 sheet section
    expect(screen.getByText(/Hivatalos 26A60 Nyilatkozat Lapjai/i)).toBeInTheDocument();

    // Sheet 0C (Termékbeszerzés)
    expect(screen.getAllByText(/0C lap/i).length).toBeGreaterThan(0);
    expect(screen.getByText('312237805')).toBeInTheDocument();
    expect(screen.getAllByText('Digital Charging Solutions GmbH').length).toBeGreaterThan(0);

    // Sheet 0E (Szolgáltatás igénybevétel)
    expect(screen.getAllByText(/0E lap/i).length).toBeGreaterThan(0);
    expect(screen.getByText('3668997OH')).toBeInTheDocument();
    expect(screen.getAllByText('Google Cloud EMEA Limited').length).toBeGreaterThan(0);
  });
});
