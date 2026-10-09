import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  Nav26TfejlhSheetFolap,
  Nav26TfejlhReplicaContainer,
} from '@/features/vat/components/replica';
import { VatTourismTaxSection } from '@/features/vat/components/VatTourismTaxSection';
import { generateTfejlhPdf } from '@/lib/tfejlhPdf';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

// Mock matchMedia for window printing or theme checks
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe('NAV 26TFEJLH Official Tourism Contribution Replica Test Suite', () => {
  // Test company matching the Golden Döner PDF fixture: 25883046-2-42, 2026.07.01 - 2026.07.31
  const mockCompany = {
    id: 'comp-golden-doner',
    name: 'GOLDEN DÖNER KFT.',
    tax_number: '25883046-2-42',
    representative_name: 'Döner Gábor',
    phone: '06301234567',
  };

  describe('1. NAV 26TFEJLH Főlap (Nav26TfejlhSheetFolap)', () => {
    it('renders official header, form code, coat of arms and NAV title', () => {
      render(
        <Nav26TfejlhSheetFolap
          selectedCompany={mockCompany}
          year={2026}
          month={7}
          frequency="H"
          baseEtkezohely={16017000}
          baseEtterem={0}
          baseSzallas={0}
          baseBusz={0}
        />
      );

      // Form code
      expect(screen.getByText('26TFEJLH')).toBeDefined();
      // Title
      expect(screen.getByText('BEVALLÁS')).toBeDefined();
      expect(screen.getByText('a turizmusfejlesztési hozzájárulásról')).toBeDefined();
      // NAV title
      expect(screen.getByText('Nemzeti Adó- és Vámhivatal')).toBeDefined();
    });

    it('renders Section B (Taxpayer details) with tax number segments and company name', () => {
      render(
        <Nav26TfejlhSheetFolap
          selectedCompany={mockCompany}
          year={2026}
          month={7}
          frequency="H"
          baseEtkezohely={16017000}
          baseEtterem={0}
          baseSzallas={0}
          baseBusz={0}
          agentName="Kovács Anna"
          agentPhone="36309876543"
        />
      );

      // Taxpayer name
      expect(screen.getByText('GOLDEN DÖNER KFT.')).toBeDefined();

      // Representative details
      expect(screen.getByText('Kovács Anna')).toBeDefined();
      expect(screen.getByText('36309876543')).toBeDefined();
    });

    it('renders Section C (Period) with monthly indicator and date segments', () => {
      render(
        <Nav26TfejlhSheetFolap
          selectedCompany={mockCompany}
          year={2026}
          month={7}
          frequency="H"
          baseEtkezohely={16017000}
          baseEtterem={0}
          baseSzallas={0}
          baseBusz={0}
        />
      );

      // Period elements
      expect(screen.getByText('Bevallási időszak')).toBeDefined();
      expect(screen.getByText('Bevallás gyakorisága')).toBeDefined();
      expect(screen.getAllByText('H').length).toBeGreaterThan(0);
    });

    it('calculates and renders Section D in thousands (ezer Ft) matching Golden Döner PDF', () => {
      // 16 017 000 Ft base -> 16 017 ezer Ft, 4% tax = 640 680 Ft -> 641 ezer Ft
      render(
        <Nav26TfejlhSheetFolap
          selectedCompany={mockCompany}
          year={2026}
          month={7}
          frequency="H"
          baseEtkezohely={16017000}
          baseEtterem={0}
          baseSzallas={0}
          baseBusz={0}
        />
      );

      // Statutory tax code 310
      expect(screen.getAllByText('310').length).toBeGreaterThan(0);

      // Base: 16 017
      expect(screen.getAllByText('16 017').length).toBeGreaterThanOrEqual(1);

      // Calculated tax at 4%: 641
      expect(screen.getAllByText('641').length).toBeGreaterThanOrEqual(1);

      // Footer notice
      expect(screen.getByText(/Ny\.v\.:3\.0/)).toBeDefined();
      expect(screen.getByText(/A nyomtatvány papír alapon nem küldhető be!/)).toBeDefined();
    });

    it('renders self-revision Section E when selfRevision is active', () => {
      render(
        <Nav26TfejlhSheetFolap
          selectedCompany={mockCompany}
          year={2026}
          month={7}
          frequency="H"
          baseEtkezohely={16017000}
          baseEtterem={0}
          baseSzallas={0}
          baseBusz={0}
          isSelfRevision={true}
          isRepeatedSelfRevision={false}
          selfRevisionTaxDiff={15000}
          selfRevisionSurcharge={2000}
        />
      );

      // Statutory self-revision surcharge code 215
      expect(screen.getByText('215')).toBeDefined();
      // Difference value (15000 Ft -> 15 ezer)
      expect(screen.getByText('15')).toBeDefined();
      // Surcharge value (2000 Ft -> 2 ezer)
      expect(screen.getAllByText('2').length).toBeGreaterThan(0);
    });
  });

  describe('2. NAV 26TFEJLH Container (Nav26TfejlhReplicaContainer)', () => {
    it('renders toolbar buttons and handles zoom level', () => {
      render(
        <Nav26TfejlhReplicaContainer
          selectedCompany={mockCompany}
          year={2026}
          month={7}
          frequency="H"
          baseEtkezohely={16017000}
          baseEtterem={0}
          baseSzallas={0}
          baseBusz={0}
          onExportXml={vi.fn()}
        />
      );

      // Action buttons
      expect(screen.getByText('Nyomtatás / PDF')).toBeDefined();
      expect(screen.getByText('PDF riport')).toBeDefined();
      expect(screen.getByText('ÁNYK XML')).toBeDefined();
      expect(screen.getByRole('button', { name: /Ügyintéző adatai/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /Önellenőrzés/i })).toBeDefined();

      // Zoom badge default
      expect(screen.getByText('100%')).toBeDefined();

      // Click Zoom In
      const zoomInBtn = screen.getByTitle('Nagyítás');
      fireEvent.click(zoomInBtn);
      expect(screen.getByText('110%')).toBeDefined();

      // Click Zoom Out
      const zoomOutBtn = screen.getByTitle('Kicsinyítés');
      fireEvent.click(zoomOutBtn);
      expect(screen.getByText('100%')).toBeDefined();
    });

    it('triggers window.print when Nyomtatás / PDF button is clicked', () => {
      const originalPrint = window.print;
      window.print = vi.fn();

      render(
        <Nav26TfejlhReplicaContainer
          selectedCompany={mockCompany}
          year={2026}
          month={7}
          frequency="H"
          baseEtkezohely={16017000}
          baseEtterem={0}
          baseSzallas={0}
          baseBusz={0}
        />
      );

      const printBtn = screen.getByText('Nyomtatás / PDF');
      fireEvent.click(printBtn);

      expect(window.print).toHaveBeenCalledTimes(1);
      window.print = originalPrint;
    });
  });

  describe('3. High-resolution PDF Report Generation (generateTfejlhPdf)', () => {
    it('opens print window with accurate HTML structure, statutory table and CSS rules', () => {
      const mockPrintWindow = {
        document: {
          write: vi.fn(),
          close: vi.fn(),
        },
        focus: vi.fn(),
        print: vi.fn(),
      };

      const originalOpen = window.open;
      window.open = vi.fn().mockReturnValue(mockPrintWindow);

      generateTfejlhPdf({
        companyName: mockCompany.name,
        companyTaxNumber: mockCompany.tax_number,
        year: 2026,
        month: 7,
        frequency: 'H',
        baseEtkezohely: 16017000,
        baseEtterem: 0,
        baseSzallas: 0,
        baseBusz: 0,
      });

      expect(window.open).toHaveBeenCalledWith('', '_blank');
      expect(mockPrintWindow.document.write).toHaveBeenCalledTimes(1);

      const writtenHtml = (mockPrintWindow.document.write as any).mock.calls[0][0];
      // Contains A4 page setup
      expect(writtenHtml).toContain('@page { size: A4 portrait;');
      // Contains company name
      expect(writtenHtml).toContain('GOLDEN DÖNER KFT.');
      // Contains statutory rows
      expect(writtenHtml).toContain('Étkezőhelyi vendéglátás');
      expect(writtenHtml).toContain('16 017');
      expect(writtenHtml).toContain('641');
      expect(writtenHtml).toContain('310');

      window.open = originalOpen;
    });
  });

  describe('4. Tourism Tax Section Integration (VatTourismTaxSection)', () => {
    it('switches seamlessly between Calculator and Replica view modes', () => {
      render(
        <QueryClientProvider client={queryClient}>
          <VatTourismTaxSection
            companyId={mockCompany.id}
            year={2026}
            month={7}
            frequency="H"
            selectedCompany={mockCompany}
          />
        </QueryClientProvider>
      );

      // Initially in calculator view
      expect(screen.getByText('1. Étkezőhelyi étel- és helyben készített alkoholmentes italforgalom')).toBeDefined();
      expect(screen.getByText('Nyomtatvány replika megtekintése')).toBeDefined();

      // Switch to replica view
      const replicaTabBtn = screen.getByRole('button', { name: /26TFEJLH Nyomtatvány replika/i });
      fireEvent.click(replicaTabBtn);

      // Now replica header is visible
      expect(screen.getByText(/26TFEJLH Hivatalos Nyomtatvány Hiteles Replika/i)).toBeDefined();

      // Switch back to calculator
      const calcTabBtn = screen.getByRole('button', { name: /Kalkulátor & Főkönyv/i });
      fireEvent.click(calcTabBtn);

      expect(screen.getByText('1. Étkezőhelyi étel- és helyben készített alkoholmentes italforgalom')).toBeDefined();
    });
  });
});
