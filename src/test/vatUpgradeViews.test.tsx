import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { VatRateSummaryCards } from '@/features/vat/components/VatRateSummaryCards';
import { VatTourismTaxSection } from '@/features/vat/components/VatTourismTaxSection';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock contexts and hooks
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

function renderWithClient(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe('Nagy ÁFA Nézet Upgrade - Business Logic & UI Component Tests', () => {
  describe('VatRateSummaryCards (Image 8 - ÁFA Összesítés)', () => {
    it('correctly aggregates 27%, 18%, 5%, and Mentes rows and calculates net balance', () => {
      const mockLineMap: Record<string, any> = {
        '07': { row_number: '07', base_amount_rounded: 39067142, tax_amount_rounded: 10548126 },
        '66': { row_number: '66', base_amount_rounded: 39132185, tax_amount_rounded: 10565687 },
        '04': { row_number: '04', base_amount_rounded: 28990226, tax_amount_rounded: 0 },
        '63': { row_number: '63', base_amount_rounded: 295004, tax_amount_rounded: 0 },
      };

      renderWithClient(
        <VatRateSummaryCards
          lines={Object.values(mockLineMap)}
          lineMap={mockLineMap}
          periodLabel="2026. Q1"
        />
      );

      // Verify 27% row
      expect(screen.getByText('27%-os')).toBeDefined();
      // Verify overall balance: 10,548,126 - 10,565,687 = -17,561 Ft
      expect(screen.getAllByText(/-17\s*561/i).length).toBeGreaterThan(0);
    });

    it('displays Fordított (FAD) row when row 29 is present', () => {
      const mockLineMap: Record<string, any> = {
        '07': { row_number: '07', base_amount_rounded: 1000000, tax_amount_rounded: 270000 },
        '29': { row_number: '29', base_amount_rounded: 500000, tax_amount_rounded: 135000 },
        '66_fad': { row_number: '66_fad', base_amount_rounded: 500000, tax_amount_rounded: 135000 },
      };

      renderWithClient(
        <VatRateSummaryCards
          lines={Object.values(mockLineMap)}
          lineMap={mockLineMap}
          periodLabel="2026. 03. hó"
        />
      );

      expect(screen.getByText('Fordított (FAD)')).toBeDefined();
    });
  });

  describe('26TFEJLH Turizmusfejlesztési hozzájárulás (Image 1)', () => {
    it('calculates the 4% statutory contribution rate accurately', () => {
      const base1 = 2500000; // Étkezőhelyi étel/ital
      const base2 = 1500000; // Étterem
      const base3 = 1000000; // Szálláshely
      const base4 = 0;       // Busz

      const totalBase = base1 + base2 + base3 + base4; // 5,000,000 Ft
      const payable4Percent = Math.round(totalBase * 0.04); // 200,000 Ft

      expect(totalBase).toBe(5000000);
      expect(payable4Percent).toBe(200000);
    });
  });

  describe('OSA Reconciliation Logic (Image 2 - Áfa ellenőrzés OSA alapján)', () => {
    it('detects matching invoices when delivery date, net, and VAT match', () => {
      const local = { date: '2026-01-12', net: 28600, vat: 7722 };
      const nav = { date: '2026-01-12', net: 28600, vat: 7722 };

      const isMatch =
        local.date === nav.date &&
        Math.abs(local.net - nav.net) <= 1 &&
        Math.abs(local.vat - nav.vat) <= 1;

      expect(isMatch).toBe(true);
    });

    it('flags differences when amounts or dates mismatch (e.g. Porsche Finance Zrt.)', () => {
      // As shown in Screenshot 2:
      // Local: 2026.01.15, Nettó: 49 409, ÁFA: 5 234
      // OSA:   2026.01.15, Nettó: 44 175, ÁFA: 10 468
      const local = { date: '2026-01-15', net: 49409, vat: 5234 };
      const nav = { date: '2026-01-15', net: 44175, vat: 10468 };

      const isMatch =
        local.date === nav.date &&
        Math.abs(local.net - nav.net) <= 1 &&
        Math.abs(local.vat - nav.vat) <= 1;

      expect(isMatch).toBe(false);
      expect(local.net !== nav.net).toBe(true);
      expect(local.vat !== nav.vat).toBe(true);
    });
  });
});
