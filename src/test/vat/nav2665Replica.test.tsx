import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Nav2665CharBox,
  Nav2665TaxNumberBoxes,
  Nav2665BankAccountBoxes,
  Nav2665DateBoxes,
  Nav2665SheetFolap,
  Nav2665Sheet0101,
  Nav2665Sheet0102,
  Nav2665Sheet0103,
  Nav2665Sheet0105,
  Nav2665Sheet07,
  Nav2665Sheet08,
  Nav2665PageFrame,
} from '@/features/vat/components/replica';

// Mock hook for steel products so container tests can run without Supabase query
vi.mock('@/features/vat/hooks/useSteelProductsData', () => ({
  useSteelProductsData: () => ({
    steelItems: [
      {
        id: 'steel-1',
        partnerTaxNumber: '13520601-2-09',
        deliveryDate: '2026-01-19',
        productName: 'Más rúd vasból vagy ötvözetlen acélból',
        vtsz: '7215',
        netWeightKg: 4708,
        netAmount: 1214775,
        direction: 'INBOUND',
      },
      {
        id: 'steel-2',
        partnerTaxNumber: '26320834-2-41',
        deliveryDate: '2026-01-19',
        productName: 'Más rúd vasból vagy ötvözetlen acélból',
        vtsz: '7215',
        netWeightKg: 9761,
        netAmount: 2753708,
        direction: 'OUTBOUND',
      },
    ],
    isLoading: false,
    refetch: vi.fn(),
  }),
}));

describe('NAV 2665A Official Tax Return Replica Test Suite', () => {
  const mockCompany = {
    id: 'comp-1',
    name: 'Betonacél Kereskedelmi és Szerelő Kft',
    tax_number: '27110250-2-13',
    bank_account_number: '10401024-50526965-68901002',
    bank_name: 'K&H Bank Zrt.',
    representative_name: 'Jámbor Viktor',
    phone: '36302491121',
    city: 'Tésa',
    postal_code: '2611',
    street_address: 'Fő utca 1.',
  };

  const mockGetVal = (row: string, col: 'base' | 'tax') => {
    const table: Record<string, { base: number; tax: number }> = {
      '04': { base: 28990, tax: 0 },
      '07': { base: 0, tax: 0 },
      '29': { base: 39067, tax: 10548 },
      '36': { base: 68057, tax: 10548 },
      '66': { base: 39132, tax: 10566 },
      '76': { base: 39132, tax: 10566 },
      '82': { base: 0, tax: 250 },
      '83': { base: 0, tax: -268 },
      '85': { base: 0, tax: 268 },
      '88': { base: 0, tax: 0 },
      '100': { base: 1, tax: 0 },
      '101': { base: 1, tax: 1 },
      '105': { base: 101, tax: 18 },
    };
    return table[row]?.[col] ?? 0;
  };

  describe('1. Segmented Character Boxes (Nav2665CharBox)', () => {
    it('splits a Hungarian tax number into 8-1-2 character boxes', () => {
      const { container } = render(<Nav2665TaxNumberBoxes taxNumber="27110250-2-13" />);
      expect(container.textContent).toContain('27110250');
      expect(container.textContent).toContain('2');
      expect(container.textContent).toContain('13');
    });

    it('splits a Hungarian bank account number into 3x8 character boxes', () => {
      const { container } = render(
        <Nav2665BankAccountBoxes accountNumber="104010245052696568901002" />
      );
      expect(container.textContent).toContain('10401024');
      expect(container.textContent).toContain('50526965');
      expect(container.textContent).toContain('68901002');
    });

    it('splits a date into YYYY MM DD segmented boxes', () => {
      const { container } = render(<Nav2665DateBoxes dateStr="20260331" />);
      expect(container.textContent).toContain('2026');
      expect(container.textContent).toContain('03');
      expect(container.textContent).toContain('31');
    });
  });

  describe('2. NAV 2665A Főlap (Nav2665SheetFolap)', () => {
    it('renders company name, tax number, bank details, and period', () => {
      render(
        <Nav2665SheetFolap
          selectedCompany={mockCompany}
          year={2026}
          month={3}
          frequency="N"
          hasSteelItems={true}
          mLineCount={5}
          partnerCount={5}
        />
      );

      expect(screen.getByText('ÁFABEVALLÁS')).toBeDefined();
      expect(screen.getByText('2665A')).toBeDefined();
      expect(screen.getByText(/Betonacél Kereskedelmi és Szerelő Kft/i)).toBeDefined();
      expect(screen.getByText(/K&H Bank Zrt./i)).toBeDefined();
      expect(screen.getAllByText(/Jámbor Viktor/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('3. Accounting Sheets (01-01, 01-02, 01-03, 01-05)', () => {
    it('01-01 correctly displays payable VAT and total row 36', () => {
      const { container } = render(<Nav2665Sheet0101 getVal={mockGetVal} />);
      const text = container.textContent?.replace(/\u00a0/g, ' ') || '';
      expect(screen.getByText(/Fizetendő általános forgalmi adó/i)).toBeDefined();
      expect(text).toContain('28 990'); // 04. row base
      expect(text).toContain('39 067'); // 29. row base
      expect(text).toContain('10 548'); // 29. row tax
      expect(text).toContain('68 057'); // 36. row total base
    });

    it('01-02 correctly displays deductible VAT and row 66 FAD detail', () => {
      const { container } = render(<Nav2665Sheet0102 getVal={mockGetVal} />);
      const text = container.textContent?.replace(/\u00a0/g, ' ') || '';
      expect(screen.getByText(/Beszerzést terhelő, előzetesen felszámított, levonható/i)).toBeDefined();
      expect(text).toContain('39 132'); // 66. row base
      expect(text).toContain('10 566'); // 66. row tax
      expect(text).toContain('10 548'); // FAD levont adó
    });

    it('01-03 correctly displays settlement rows 82, 83, 85', () => {
      const { container } = render(<Nav2665Sheet0103 getVal={mockGetVal} />);
      const text = container.textContent?.replace(/\u00a0/g, ' ') || '';
      expect(screen.getByText(/Általános forgalmi adó elszámolása/i)).toBeDefined();
      expect(text).toContain('250'); // 82. row áthozott
      expect(text).toContain('-268'); // 83. row különbözet
      expect(text).toContain('268'); // 85. row visszaigényelhető
    });

    it('01-05 correctly displays 6/B steel summary and 2665M aggregation', () => {
      const { container } = render(
        <Nav2665Sheet0105
          getVal={mockGetVal}
          partnerCount={5}
          invoiceCount={5}
          mLineTotalBase={101}
          mLineTotalTax={18}
        />
      );
      const text = container.textContent?.replace(/\u00a0/g, ' ') || '';
      expect(screen.getByText(/Vas- és acéltermékek \(6\/B\.\)/i)).toBeDefined();
      expect(screen.getByText(/A csatolt összes 2665M összesítő jelentés/i)).toBeDefined();
      expect(text).toContain('101'); // 105. row base
      expect(text).toContain('18'); // 105. row tax
    });
  });

  describe('4. Reverse Charge Steel Sheets (07 & 08)', () => {
    it('07 sheet renders outbound reverse charge steel items', () => {
      const mockOutbound = [
        {
          id: '1',
          partnerTaxNumber: '26320834-2-41',
          deliveryDate: '2026-01-19',
          productName: 'Más rúd vasból vagy ötvözetlen acélból',
          vtsz: '7215',
          quantityKg: 9761,
          netAmountHuf: 2753708,
        },
      ];
      const { container } = render(<Nav2665Sheet07 items={mockOutbound} />);
      const text = container.textContent?.replace(/\u00a0/g, ' ') || '';
      expect(screen.getByText(/értékesítésre vonatkozó nyilatkozat/i)).toBeDefined();
      expect(text).toContain('9761');
      expect(text).toContain('2 753 708');

      // Table layout and anti-overflow assertions
      const table = container.querySelector('table');
      expect(table).not.toBeNull();
      expect(table?.className).toContain('table-fixed');
      expect(container.firstChild).toHaveClass('overflow-hidden');
      const cols = container.querySelectorAll('colgroup col');
      expect(cols.length).toBe(8);
    });

    it('08 sheet renders inbound reverse charge steel items without width overflow', () => {
      const mockInbound = [
        {
          id: '2',
          partnerTaxNumber: '13520601-2-09',
          deliveryDate: '2026-01-19',
          productName: 'Más rúd vasból vagy ötvözetlen acélból',
          vtsz: '7215',
          quantityKg: 4708,
          netAmountHuf: 1214775,
        },
      ];
      const { container } = render(<Nav2665Sheet08 items={mockInbound} pageNumber={1} />);
      const text = container.textContent?.replace(/\u00a0/g, ' ') || '';
      expect(screen.getByText(/beszerzésre vonatkozó nyilatkozat/i)).toBeDefined();
      expect(text).toContain('4708');
      expect(text).toContain('1 214 775');

      // Table layout and anti-overflow assertions
      const table = container.querySelector('table');
      expect(table).not.toBeNull();
      expect(table?.className).toContain('table-fixed');
      expect(container.firstChild).toHaveClass('overflow-hidden');
      const cols = container.querySelectorAll('colgroup col');
      expect(cols.length).toBe(8);
    });
  });
});
