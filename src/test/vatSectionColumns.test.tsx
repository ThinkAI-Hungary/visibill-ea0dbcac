import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import VatSection from '@/components/dashboard/VatSection';

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, defaultValue?: any) => {
      const translations: Record<string, string> = {
        'vat.title': 'ÁFA kimutatás',
        'vat.total_vat': 'Összes ÁFA:',
        'vat.revenue': 'NETTÓ Árbevétel:',
        'vat.net_revenue': 'NETTÓ Árbevétel:',
        'vat.costs': 'NETTÓ Költségek:',
        'vat.net_costs': 'NETTÓ Költségek:',
        'vat.categories': 'ÁFA kategóriák:',
        'vat.outbound_vat_content': 'Bevételek ÁFA tartalma',
        'vat.inbound_vat_content': 'Kiadások ÁFA tartalma',
        'vat.deductible_vat': 'Levonható ÁFA:',
        'vat.payable_vat': 'Fizetendő ÁFA',
        'vat.total': 'Összesen:',
      };
      if (translations[k]) return translations[k];
      if (typeof defaultValue === 'string') return defaultValue;
      return k;
    },
  }),
}));

describe('VatSection column layout & net revenue/costs display', () => {
  const mockVatBreakdown = {
    outboundVatCategories: [
      { rate: '27%', netAmount: 100000, vatAmount: 27000 },
      { rate: 'ÁFA mentes', netAmount: 50000, vatAmount: 0 },
    ],
    inboundVatCategories: [
      { rate: '27%', netAmount: 40000, vatAmount: 10800 },
      { rate: '5%', netAmount: 20000, vatAmount: 1000 },
    ],
    totalOutboundVat: 27000,
    totalInboundVat: 11800,
  };

  it('renders NETTÓ Árbevétel as second column and Összes ÁFA as third column for Outbound table', () => {
    render(
      <VatSection
        navVatData={undefined}
        vatBreakdown={mockVatBreakdown}
        selectedCurrency="HUF"
        displayedPeriod="2026. jan. 01. - 2026. dec. 31."
        convertToSelectedCurrency={(amt) => amt}
        vatSectionOpen={true}
        onVatSectionOpenChange={vi.fn()}
      />
    );

    const tables = screen.getAllByRole('table');
    expect(tables.length).toBe(2);

    // Outbound table headers
    const outboundHeaders = tables[0].querySelectorAll('thead th');
    expect(outboundHeaders[0].textContent).toBe('ÁFA kategóriák:');
    expect(outboundHeaders[1].textContent).toBe('NETTÓ Árbevétel:');
    expect(outboundHeaders[2].textContent).toBe('Összes ÁFA:');

    // First row values: 100 000 Ft net, 27 000 Ft VAT (NOT 127 000 Ft gross!)
    const rows = tables[0].querySelectorAll('tbody tr');
    const firstRowCells = rows[0].querySelectorAll('td');
    expect(firstRowCells[0].textContent).toContain('27%');
    expect(firstRowCells[1].textContent).toContain('100'); // 100 000 Ft
    expect(firstRowCells[1].textContent).not.toContain('127'); // NOT gross
    expect(firstRowCells[2].textContent).toContain('27'); // 27 000 Ft

    // Total row: 150 000 Ft net, 27 000 Ft VAT (NOT 177 000 Ft gross!)
    const totalRowCells = rows[2].querySelectorAll('td');
    expect(totalRowCells[0].textContent).toContain('Összesen');
    expect(totalRowCells[1].textContent).toContain('150'); // 150 000 Ft
    expect(totalRowCells[1].textContent).not.toContain('177');
    expect(totalRowCells[2].textContent).toContain('27');
  });

  it('renders NETTÓ Költségek as second column and Levonható ÁFA as third column for Inbound table', () => {
    render(
      <VatSection
        navVatData={undefined}
        vatBreakdown={mockVatBreakdown}
        selectedCurrency="HUF"
        displayedPeriod="2026. jan. 01. - 2026. dec. 31."
        convertToSelectedCurrency={(amt) => amt}
        vatSectionOpen={true}
        onVatSectionOpenChange={vi.fn()}
      />
    );

    const tables = screen.getAllByRole('table');
    // Inbound table headers
    const inboundHeaders = tables[1].querySelectorAll('thead th');
    expect(inboundHeaders[0].textContent).toBe('ÁFA kategóriák:');
    expect(inboundHeaders[1].textContent).toBe('NETTÓ Költségek:');
    expect(inboundHeaders[2].textContent).toBe('Levonható ÁFA:');

    // First row values: 40 000 Ft net, 10 800 Ft VAT (NOT 50 800 Ft gross!)
    const rows = tables[1].querySelectorAll('tbody tr');
    const firstRowCells = rows[0].querySelectorAll('td');
    expect(firstRowCells[0].textContent).toContain('27%');
    expect(firstRowCells[1].textContent).toContain('40'); // 40 000 Ft net
    expect(firstRowCells[1].textContent).not.toContain('50'); // NOT gross
    expect(firstRowCells[2].textContent).toContain('10'); // 10 800 Ft VAT

    // Total row: 60 000 Ft net, 11 800 Ft VAT (NOT 71 800 Ft gross!)
    const totalRowCells = rows[2].querySelectorAll('td');
    expect(totalRowCells[0].textContent).toContain('Összesen');
    expect(totalRowCells[1].textContent).toContain('60'); // 60 000 Ft net
    expect(totalRowCells[1].textContent).not.toContain('71');
    expect(totalRowCells[2].textContent).toContain('11');
  });

  it('renders EUR values properly when baseCurrency is EUR without HUF hardcoding', () => {
    const mockEurBreakdown = {
      outboundVatCategories: [
        { rate: '25%', netAmount: 126032.16, vatAmount: 31508.40 },
        { rate: 'Oslobođeno PDV-a', netAmount: 19457.62, vatAmount: 0 },
      ],
      inboundVatCategories: [
        { rate: '25%', netAmount: 48118.25, vatAmount: 12028.69 },
      ],
      totalOutboundVat: 31508.40,
      totalInboundVat: 12028.69,
      baseCurrency: 'EUR',
    };

    render(
      <VatSection
        navVatData={undefined}
        vatBreakdown={mockEurBreakdown}
        selectedCurrency="EUR"
        displayedPeriod="01.01.2026. - 31.12.2026."
        convertToSelectedCurrency={(amt, from, to) => from === to ? amt : amt}
        vatSectionOpen={true}
        onVatSectionOpenChange={vi.fn()}
      />
    );

    const tables = screen.getAllByRole('table');
    expect(tables.length).toBe(2);

    // Outbound table has 25% and Oslobođeno PDV-a
    const rows = tables[0].querySelectorAll('tbody tr');
    expect(rows[0].textContent).toContain('25%');
    expect(rows[0].textContent).toMatch(/€|EUR/);
    expect(rows[1].textContent).toContain('Oslobođeno PDV-a');
    expect(rows[1].textContent).toMatch(/€|EUR/);
  });
});

