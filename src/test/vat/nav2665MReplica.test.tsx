import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  buildNav65MPartnerSheets,
  getPeriodDates,
} from '@/features/vat/utils/nav65MPaginationHelper';
import {
  Nav2665MSheetFolap,
  Nav2665MSheet02,
  Nav2665MSheet02K,
  Nav2665MReplicaContainer,
} from '@/features/vat/components/replica';
import { VatNav65MReplica } from '@/features/vat';
import { MLine } from '@/features/vat/types';

describe('NAV 2665M Official Tax Return Replica Test Suite', () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const mockCompany = {
    id: 'acc22ca9-e9ff-4f9f-9495-ca7612b2e5e2',
    name: 'TAXOLOGY Kft.',
    tax_number: '14160877-2-43',
  };

  const mockPartner: MLine = {
    id: 'partner-1',
    partner_name: 'Adriana Automatik Kft.',
    partner_tax_number: '26383738-2-41',
    invoice_count: 3,
    base_amount_rounded: 50370,
    tax_amount_rounded: 13600,
    tax_5_amount: 0,
    tax_18_amount: 0,
    tax_27_amount: 13600,
    invoice_details: [
      {
        id: 'inv-1',
        invoice_number: 'AA / 2026-007512',
        delivery_date: '2026-07-01',
        issue_date: '2026-07-01',
        net_amount: 50370,
        vat_amount: 13600,
        invoice_operation: 'CREATE',
      },
    ],
  };

  describe('1. nav65MPaginationHelper & Chunking Engine', () => {
    it('correctly calculates period dates for monthly and quarterly frequencies', () => {
      const monthlyDates = getPeriodDates(2026, 7, 'H');
      expect(monthlyDates.periodFrom).toBe('2026.07.01');
      expect(monthlyDates.periodTo).toBe('2026.07.31');
      expect(monthlyDates.fromYear).toBe('2026');
      expect(monthlyDates.fromMonth).toBe('07');

      const quarterlyDates = getPeriodDates(2026, 2, 'N');
      expect(quarterlyDates.periodFrom).toBe('2026.04.01');
      expect(quarterlyDates.periodTo).toBe('2026.06.30');
    });

    it('builds authentic 2665M dataset with Főlap (eFt) and 02 page (Ft)', () => {
      const sheetData = buildNav65MPartnerSheets(
        mockPartner,
        mockCompany,
        2026,
        7,
        'H',
        mockPartner.invoice_details
      );

      // Partner identification
      expect(sheetData.partnerName).toBe('Adriana Automatik Kft.');
      expect(sheetData.partnerTax8).toBe('26383738');
      expect(sheetData.companyTax8).toBe('14160877');

      // Főlap totals in thousands of HUF (eFt)
      expect(sheetData.folap.row04.invoiceCount).toBe(1);
      expect(sheetData.folap.row04.baseEft).toBe(50); // 50 370 -> 50 eFt
      expect(sheetData.folap.row04.taxEft).toBe(14);  // 13 600 -> 14 eFt
      expect(sheetData.folap.row07.baseEft).toBe(50);
      expect(sheetData.folap.row07.taxEft).toBe(14);

      // Normal pages (36 rows chunking)
      expect(sheetData.normalPages.length).toBe(1);
      expect(sheetData.normalPages[0].items.length).toBe(1);
      expect(sheetData.normalPages[0].items[0].invoiceNumber).toBe('AA / 2026-007512');
      expect(sheetData.normalPages[0].items[0].baseAmountHuf).toBe(50370);
      expect(sheetData.normalPages[0].items[0].taxAmountHuf).toBe(13600);
      expect(sheetData.normalPages[0].pageBaseTotalHuf).toBe(50370);
      expect(sheetData.normalPages[0].pageTaxTotalHuf).toBe(13600);
    });

    it('correctly handles storno/correction invoices for 2665M-02-K with negative KT rows', () => {
      const partnerWithStorno: MLine = {
        ...mockPartner,
        invoice_details: [
          {
            id: 'inv-storno',
            invoice_number: 'SZ-MOD-01',
            original_invoice_number: 'AA / 2026-007512',
            delivery_date: '2026-07-15',
            issue_date: '2026-07-15',
            net_amount: -50000,
            vat_amount: -13500,
            invoice_operation: 'STORNO',
            invoice_type: 'sztorno_szamla',
          },
        ],
      };

      const sheetData = buildNav65MPartnerSheets(
        partnerWithStorno,
        mockCompany,
        2026,
        7,
        'H',
        partnerWithStorno.invoice_details
      );

      // Correction pages
      expect(sheetData.correctionPages.length).toBe(1);
      const page = sheetData.correctionPages[0];
      expect(page.items.length).toBe(2); // Row E and Row KT

      // Row E (Original positive)
      expect(page.items[0].rowType).toBe('E');
      expect(page.items[0].baseAmountHuf).toBe(50000);
      expect(page.items[0].taxAmountHuf).toBe(13500);

      // Row KT (Current period negative)
      expect(page.items[1].rowType).toBe('KT');
      expect(page.items[1].baseAmountHuf).toBe(-50000);
      expect(page.items[1].taxAmountHuf).toBe(-13500);
      expect(page.pageBaseTotalHuf).toBe(-50000);
      expect(page.pageTaxTotalHuf).toBe(-13500);

      // Főlap row 05
      expect(sheetData.folap.row05.invoiceCount).toBe(1);
      expect(sheetData.folap.row05.baseEft).toBe(-50);
      expect(sheetData.folap.row05.taxEft).toBe(-13); // Math.round(-13500 / 1000) === -13
    });
  });

  describe('2. NAV 2665M Főlap Component (Nav2665MSheetFolap)', () => {
    it('renders authentic form code, company details, partner details, and summary rows', () => {
      const sheetData = buildNav65MPartnerSheets(
        mockPartner,
        mockCompany,
        2026,
        7,
        'H',
        mockPartner.invoice_details
      );

      render(<Nav2665MSheetFolap sheetData={sheetData} />);

      // Official header
      expect(screen.getByText('2665M')).toBeDefined();
      expect(screen.getByText(/ÖSSZESÍTŐ JELENTÉS/i)).toBeDefined();

      // Company & Partner
      expect(screen.getByText('TAXOLOGY Kft.')).toBeDefined();
      expect(screen.getByText('Adriana Automatik Kft.')).toBeDefined();

      // Statutory table row tags
      expect(screen.getByText('04.')).toBeDefined();
      expect(screen.getByText('05.')).toBeDefined();
      expect(screen.getByText('07.')).toBeDefined();
      expect(screen.getByText('Az adatokat ezer forintban kell feltüntetni!')).toBeDefined();
    });
  });

  describe('3. NAV 2665M-02 Sub-Sheet Component (Nav2665MSheet02)', () => {
    it('renders 2665M-02 header, Lapszám, 36 numbered rows and row 37 Összesen', () => {
      const sheetData = buildNav65MPartnerSheets(
        mockPartner,
        mockCompany,
        2026,
        7,
        'H',
        mockPartner.invoice_details
      );

      render(
        <Nav2665MSheet02
          sheetData={sheetData}
          pageData={sheetData.normalPages[0]}
        />
      );

      expect(screen.getByText('2665M-02')).toBeDefined();
      expect(screen.getByText('Lapszám')).toBeDefined();
      expect(screen.getByText('AA / 2026-007512')).toBeDefined();
      expect(screen.getByText('Az adatokat forintban kell feltüntetni!')).toBeDefined();
      expect(screen.getByText('Összesen:')).toBeDefined();
    });
  });

  describe('4. NAV 2665M-02-K Sub-Sheet Component (Nav2665MSheet02K)', () => {
    it('renders 2665M-02-K header, MÓDOSÍTÓ LAP banner, and row pairings', () => {
      const partnerWithStorno: MLine = {
        ...mockPartner,
        invoice_details: [
          {
            id: 'inv-storno',
            invoice_number: 'SZ-MOD-01',
            original_invoice_number: 'AA / 2026-007512',
            delivery_date: '2026-07-15',
            issue_date: '2026-07-15',
            net_amount: -50000,
            vat_amount: -13500,
            invoice_operation: 'STORNO',
            invoice_type: 'sztorno_szamla',
          },
        ],
      };

      const sheetData = buildNav65MPartnerSheets(
        partnerWithStorno,
        mockCompany,
        2026,
        7,
        'H',
        partnerWithStorno.invoice_details
      );

      render(
        <Nav2665MSheet02K
          sheetData={sheetData}
          pageData={sheetData.correctionPages[0]}
        />
      );

      expect(screen.getByText('2665M-02-K')).toBeDefined();
      expect(screen.getByText('MÓDOSÍTÓ LAP')).toBeDefined();
      expect(screen.getAllByText('SZ-MOD-01').length).toBe(2);
      expect(screen.getByText('E')).toBeDefined();
      expect(screen.getByText('KT')).toBeDefined();
    });
  });

  describe('5. NAV 2665M Container & Facade (VatNav65MReplica)', () => {
    it('renders replica container with partner controls, mode switcher and print button', () => {
      render(
        <QueryClientProvider client={queryClient}>
          <VatNav65MReplica
            selectedCompany={mockCompany}
            year={2026}
            month={7}
            frequency="H"
            mLines={[mockPartner]}
          />
        </QueryClientProvider>
      );

      expect(screen.getByText('NAV 2665M Hivatalos M-lap Replika')).toBeDefined();
      expect(screen.getByText('Lapozható mód')).toBeDefined();
      expect(screen.getByText('Egybefűzve görgethető')).toBeDefined();
      expect(screen.getByText('Nyomtatás')).toBeDefined();
    });
  });
});
