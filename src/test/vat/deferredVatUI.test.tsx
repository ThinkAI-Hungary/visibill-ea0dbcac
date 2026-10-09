import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DeferredVatPromptBanner } from '@/features/vat/components/DeferredVatPromptBanner';
import { DeferredVatPromptDialog } from '@/features/vat/components/DeferredVatPromptDialog';

// Mock contexts and hooks
vi.mock('@/contexts/CompanyContext', () => ({
  useCompany: () => ({
    selectedCompany: { id: 'test-comp-1', name: 'Teszt Kft' },
  }),
}));

const mockInvoices = [
  {
    id: 'inv-1',
    invoice_number: 'TEST-2026-001',
    invoice_direction: 'INBOUND',
    invoice_delivery_date: '2026-01-15',
    invoice_issue_date: '2026-01-16',
    supplier_name: 'Minta Partner Kft.',
    supplier_tax_number: '12345678-2-42',
    invoice_net_amount: 100000,
    invoice_vat_amount: 27000,
    invoice_gross_amount: 127000,
    currency: 'HUF',
    is_submitted: false,
    accounting_exclusion_type: 'DEFERRED_VAT',
    deferred_vat_reason: 'Könyvelői egyeztetés alatt',
    deferred_vat_since: '2026-01-20',
    deferred_vat_target_period: null,
    days_remaining_statutory: 680,
  },
  {
    id: 'inv-2',
    invoice_number: 'TEST-2026-002',
    invoice_direction: 'INBOUND',
    invoice_delivery_date: '2026-02-10',
    invoice_issue_date: '2026-02-11',
    supplier_name: 'Tech Beszállító Zrt.',
    supplier_tax_number: '87654321-2-41',
    invoice_net_amount: 200000,
    invoice_vat_amount: 54000,
    invoice_gross_amount: 254000,
    currency: 'HUF',
    is_submitted: true,
    accounting_exclusion_type: 'DEFERRED_VAT',
    deferred_vat_reason: 'Nem tisztázott üzleti cél',
    deferred_vat_since: '2026-02-15',
    deferred_vat_target_period: null,
    days_remaining_statutory: 120, // Critical (< 180 days)
  },
];

const mockIncludeMultipleInPeriod = vi.fn().mockResolvedValue(2);

vi.mock('@/features/invoices/hooks/useQuestionableInvoices', () => ({
  useQuestionableInvoices: () => ({
    invoices: mockInvoices,
    isLoading: false,
    isError: false,
    totalCount: 2,
    totalNet: 300000,
    totalVat: 81000,
    totalGross: 381000,
    criticalCount: 1,
    warningCount: 0,
    includeInPeriod: vi.fn(),
    isIncluding: false,
    includeMultipleInPeriod: mockIncludeMultipleInPeriod,
    isIncludingMultiple: false,
    setPermanentExclusion: vi.fn(),
    isSettingPermanent: false,
  }),
}));

describe('Deferred VAT Deduction UI Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('DeferredVatPromptBanner', () => {
    it('renders alert banner with count, VAT amount, and critical deadline badge', () => {
      render(
        <DeferredVatPromptBanner
          year={2026}
          month={3}
          onRecalculate={vi.fn()}
        />
      );

      // Verify title with counts
      expect(
        screen.getByText(/2 db kérdéses számla várakozik döntésre/)
      ).toBeInTheDocument();

      // Verify Áfa tv. badge
      expect(screen.getByText('Áfa tv. 153/A. §')).toBeInTheDocument();

      // Verify critical badge (< 180 nap)
      expect(screen.getByText(/1 db < 180 nap/i)).toBeInTheDocument();

      // Verify button
      expect(screen.getByRole('button', { name: /Számlák áttekintése és beemelése/i })).toBeInTheDocument();
    });

    it('opens prompt dialog when button is clicked', () => {
      render(
        <DeferredVatPromptBanner
          year={2026}
          month={3}
          onRecalculate={vi.fn()}
        />
      );

      const btn = screen.getByRole('button', { name: /Számlák áttekintése és beemelése/i });
      fireEvent.click(btn);

      // Dialog title should now be in the document
      expect(
        screen.getByText('Kérdéses számlák beemelése az ÁFA bevallásba')
      ).toBeInTheDocument();
      expect(screen.getByText('Minta Partner Kft.')).toBeInTheDocument();
      expect(screen.getByText('Tech Beszállító Zrt.')).toBeInTheDocument();
    });
  });

  describe('DeferredVatPromptDialog', () => {
    it('allows selecting invoices and submitting batch inclusion into target period', async () => {
      const onIncluded = vi.fn();
      const onOpenChange = vi.fn();

      render(
        <DeferredVatPromptDialog
          open={true}
          onOpenChange={onOpenChange}
          currentYear={2026}
          currentMonth={3}
          onIncluded={onIncluded}
        />
      );

      expect(screen.getByText('Kérdéses számlák beemelése az ÁFA bevallásba')).toBeInTheDocument();
      expect(screen.getByText(/2 \/ 2 db/i)).toBeInTheDocument();

      const submitBtn = screen.getByRole('button', { name: /Kijelöltek beemelése \(2\)/i });
      fireEvent.click(submitBtn);

      expect(mockIncludeMultipleInPeriod).toHaveBeenCalledWith({
        items: [
          { id: 'inv-1', isSubmitted: false },
          { id: 'inv-2', isSubmitted: true },
        ],
        targetPeriod: '2026-03',
      });
    });
  });
});
