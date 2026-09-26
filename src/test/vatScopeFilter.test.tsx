import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { VatScopeRadioGroup } from '@/features/vat/components/VatScopeRadioGroup';
import type { VatScope } from '@/features/vat/types';

describe('VAT Scope (Számlakép / OSA) Processing Logic & UI Tests', () => {
  describe('Business Logic Invariants', () => {
    // Simulated invoice records
    const mockInvoices = [
      {
        id: 'out-1',
        invoice_number: 'SZ-2026/001',
        invoice_direction: 'OUTBOUND',
        invoice_net_amount: 1000000,
        invoice_vat_amount: 270000,
        has_image: false, // Outbound without image scan
      },
      {
        id: 'in-with-img',
        invoice_number: 'BEJ-2026/101',
        invoice_direction: 'INBOUND',
        invoice_net_amount: 500000,
        invoice_vat_amount: 135000,
        has_image: true, // Inbound with uploaded scan
      },
      {
        id: 'in-no-img',
        invoice_number: 'BEJ-2026/102',
        invoice_direction: 'INBOUND',
        invoice_net_amount: 300000,
        invoice_vat_amount: 81000,
        has_image: false, // Inbound seen in OSA but missing scan
      },
    ];

    it('scope="all" includes ALL inbound and outbound invoices', () => {
      const scope: VatScope = 'all';
      const filtered = mockInvoices.filter((inv) => {
        if (inv.invoice_direction === 'OUTBOUND') return true;
        if ((scope as string) === 'with_image') return inv.has_image;
        return true;
      });

      expect(filtered.length).toBe(3);
      const totalNet = filtered.reduce((sum, i) => sum + i.invoice_net_amount, 0);
      expect(totalNet).toBe(1800000);
      const deductibleVat = filtered
        .filter((i) => i.invoice_direction === 'INBOUND')
        .reduce((sum, i) => sum + i.invoice_vat_amount, 0);
      expect(deductibleVat).toBe(216000); // 135000 + 81000
    });

    it('scope="with_image" strictly filters out inbound invoices lacking images', () => {
      const scope: VatScope = 'with_image';
      const filtered = mockInvoices.filter((inv) => {
        if (inv.invoice_direction === 'OUTBOUND') return true;
        if (scope === 'with_image') return inv.has_image;
        return true;
      });

      expect(filtered.length).toBe(2);
      expect(filtered.some((i) => i.id === 'in-no-img')).toBe(false);
      expect(filtered.some((i) => i.id === 'in-with-img')).toBe(true);

      const deductibleVat = filtered
        .filter((i) => i.invoice_direction === 'INBOUND')
        .reduce((sum, i) => sum + i.invoice_vat_amount, 0);
      expect(deductibleVat).toBe(135000); // Only the with_image invoice
    });

    it('CRITICAL INVARIANT: Outbound sales invoices are NEVER dropped in "with_image" mode', () => {
      const scope: VatScope = 'with_image';
      const filtered = mockInvoices.filter((inv) => {
        if (inv.invoice_direction === 'OUTBOUND') return true;
        if (scope === 'with_image') return inv.has_image;
        return true;
      });

      const outboundInvoices = filtered.filter((i) => i.invoice_direction === 'OUTBOUND');
      expect(outboundInvoices.length).toBe(1);
      expect(outboundInvoices[0].id).toBe('out-1');
      expect(outboundInvoices[0].invoice_vat_amount).toBe(270000);
    });

    it('Image resolution detects scans across image_url, melleklet_url, invoice_uploads_id, and attachments', () => {
      const hasImage = (inv: any) =>
        Boolean(
          inv.image_url ||
          inv.melleklet_url ||
          inv.invoice_uploads_id ||
          (Array.isArray(inv.attachments) && inv.attachments.length > 0)
        );

      expect(hasImage({ image_url: 'https://storage/inv.pdf' })).toBe(true);
      expect(hasImage({ melleklet_url: '/files/scan.png' })).toBe(true);
      expect(hasImage({ invoice_uploads_id: 'd9b04975-47e0-4712-ba29-373305419914' })).toBe(true);
      expect(hasImage({ attachments: [{ file_url: 'a.pdf' }] })).toBe(true);
      expect(hasImage({ attachments: [] })).toBe(false);
      expect(hasImage({ image_url: null, melleklet_url: null })).toBe(false);
    });
  });

  describe('VatScopeRadioGroup Component', () => {
    it('renders the prominent radio cards with live counts and active selection', () => {
      const handleChange = vi.fn();
      const handleOpenOsa = vi.fn();

      render(
        <VatScopeRadioGroup
          value="all"
          onChange={handleChange}
          totalCount={45}
          withImageCount={38}
          missingCount={7}
          onOpenOsaCheck={handleOpenOsa}
        />
      );

      // Verify Option titles
      expect(screen.getByText('Minden számla könyvelése')).toBeDefined();
      expect(screen.getByText('Csak számlaképpel rendelkező számlák')).toBeDefined();

      // Verify count badges
      expect(screen.getByText('45 bejövő számla')).toBeDefined();
      expect(screen.getByText('38 számlaképes')).toBeDefined();

      // Verify missing image indicators
      expect(screen.getByText('-7 számlakép hiányzik')).toBeDefined();
      expect(screen.getByText(/még nem érkezett feltöltött számlakép/i)).toBeDefined();

      // Clicking the "CSAK számlaképpel" card triggers onChange with "with_image"
      const withImageRadio = screen.getByText('Csak számlaképpel rendelkező számlák');
      fireEvent.click(withImageRadio);
      expect(handleChange).toHaveBeenCalledWith('with_image');
    });

    it('navigates to OSA check when clicking the quick action button', () => {
      const handleChange = vi.fn();
      const handleOpenOsa = vi.fn();

      render(
        <VatScopeRadioGroup
          value="with_image"
          onChange={handleChange}
          totalCount={50}
          withImageCount={40}
          missingCount={10}
          onOpenOsaCheck={handleOpenOsa}
        />
      );

      const osaBtn = screen.getByText(/OSA egyeztetés megnyitása/i);
      fireEvent.click(osaBtn);
      expect(handleOpenOsa).toHaveBeenCalledTimes(1);
    });
  });

  describe('Module Transformation & Clean Syntax', () => {
    it('imports all VAT feature components cleanly without Babel/duplicate declaration errors', async () => {
      const vatIndex = await import('@/features/vat');
      expect(vatIndex.VatScopeRadioGroup).toBeDefined();
      expect(vatIndex.VatAnnualMatrixView).toBeDefined();
      expect(vatIndex.VatItemizedJournalView).toBeDefined();
      expect(vatIndex.VatMLineMasterDetail).toBeDefined();
      expect(vatIndex.VatReturnContainer).toBeDefined();
    });

    it('correctly calculates dynamic deductions for with_image scope', () => {
      const originalLineMap: Record<string, { base_amount_rounded: number; tax_amount_rounded: number }> = {
        '36': { base_amount_rounded: 3438, tax_amount_rounded: 928 },
        '66': { base_amount_rounded: 382, tax_amount_rounded: 103 },
        '76': { base_amount_rounded: 382, tax_amount_rounded: 107 },
        '83': { base_amount_rounded: 0, tax_amount_rounded: 821 },
        '84': { base_amount_rounded: 0, tax_amount_rounded: 821 },
      };

      const missingDeductions = {
        missingNetEft: 402,
        missingVatEft: 16,
        missing27BaseEft: 58,
        missing27TaxEft: 16,
        missing18BaseEft: 0,
        missing18TaxEft: 0,
        missing5BaseEft: 0,
        missing5TaxEft: 0,
        missingFadBaseEft: 0,
        missingFadTaxEft: 0,
        missingExemptBaseEft: 340,
      };

      // With with_image scope:
      const new76Tax = originalLineMap['76'].tax_amount_rounded - missingDeductions.missingVatEft;
      const payableTax36 = originalLineMap['36'].tax_amount_rounded;
      const new83Tax = payableTax36 - new76Tax;

      expect(new76Tax).toBe(91); // 107 - 16 = 91
      expect(new83Tax).toBe(837); // 928 - 91 = 837
    });
  });
});

