import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpgService } from '@/services/opgService';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'usr-test-123' } } }),
      },
      from: vi.fn(),
      rpc: vi.fn(),
    },
  };
});

import { supabase } from '@/integrations/supabase/client';

describe('Manual Invoice Create & OPG Schema Resilience Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ManualInvoiceCreateDialog Payload Guard (nav_invoice_id omission)', () => {
    it('verifies invoices insert payload does not contain nav_invoice_id', async () => {
      // Read the ManualInvoiceCreateDialog source code to ensure nav_invoice_id is never present in invoicePayload
      const fs = await import('fs');
      const path = await import('path');
      const dialogContent = fs.readFileSync(
        path.resolve(process.cwd(), 'src/components/invoices/ManualInvoiceCreateDialog.tsx'),
        'utf-8'
      );

      // 1. Ensure nav_invoice_id is NOT in invoicePayload
      expect(dialogContent).not.toMatch(/invoicePayload\s*:\s*Record<string,\s*any>\s*=\s*{[^}]*nav_invoice_id/s);
      
      // 2. Ensure nav_status is present
      expect(dialogContent).toContain("nav_status: selectedNavInvoice ? 'verified' : 'missing_nav'");

      // 3. Ensure statusz adheres to PostgreSQL check constraint: invoices_statusz_check
      expect(dialogContent).not.toContain("'feldolgozva'");
      expect(dialogContent).not.toContain("'partially_paid'");
      expect(dialogContent).toContain("statusz: isFullyPaid ? 'kifizetve' : 'feldolgozott'");

      // 4. Ensure absolute value comparison is used for credit/negative invoices (Math.abs(invoiceGross))
      expect(dialogContent).toContain("const absInvoiceGross = Math.abs(invoiceGross);");
      expect(dialogContent).toContain("totalTxAmount >= (absInvoiceGross - 0.5)");

      // 5. Ensure general_ledger and glBalances cache invalidation
      expect(dialogContent).toContain("queryClient.invalidateQueries({ queryKey: ['general_ledger'] });");
      expect(dialogContent).toContain("queryClient.invalidateQueries({ queryKey: ['glBalances'] });");
    });

    it('validates absolute value payment status logic for positive and negative (credit) invoices', () => {
      const calculatePaymentStatus = (invoiceGross: number, totalTxAmount: number, isPaidManual: boolean) => {
        const absInvoiceGross = Math.abs(invoiceGross);
        const isPaidViaTx = totalTxAmount > 0 && totalTxAmount >= (absInvoiceGross - 0.5);
        const isPartiallyPaid = totalTxAmount > 0 && !isPaidViaTx && (absInvoiceGross > 0 ? totalTxAmount < absInvoiceGross : false);
        const isFullyPaid = isPaidViaTx || isPaidManual;
        const statusz = isFullyPaid ? 'kifizetve' : 'feldolgozott';
        return { isPaidViaTx, isPartiallyPaid, isFullyPaid, statusz };
      };

      // Scenario A: Positive invoice 10000 HUF, 5000 HUF paid (Partial)
      const resPosPartial = calculatePaymentStatus(10000, 5000, false);
      expect(resPosPartial.isPaidViaTx).toBe(false);
      expect(resPosPartial.isPartiallyPaid).toBe(true);
      expect(resPosPartial.isFullyPaid).toBe(false);
      expect(resPosPartial.statusz).toBe('feldolgozott');

      // Scenario B: Negative credit invoice -10000 HUF, 5000 HUF matched (Partial)
      // Without Math.abs, 5000 >= -10000 - 0.5 would evaluate to TRUE!
      const resNegPartial = calculatePaymentStatus(-10000, 5000, false);
      expect(resNegPartial.isPaidViaTx).toBe(false);
      expect(resNegPartial.isPartiallyPaid).toBe(true);
      expect(resNegPartial.isFullyPaid).toBe(false);
      expect(resNegPartial.statusz).toBe('feldolgozott');

      // Scenario C: Negative credit invoice -10000 HUF, 10000 HUF matched (Full)
      const resNegFull = calculatePaymentStatus(-10000, 10000, false);
      expect(resNegFull.isPaidViaTx).toBe(true);
      expect(resNegFull.isPartiallyPaid).toBe(false);
      expect(resNegFull.isFullyPaid).toBe(true);
      expect(resNegFull.statusz).toBe('kifizetve');
    });
  });

  describe('OpgService.getTurnoverKpis Schema Cache Resilience', () => {
    it('returns default zero KPIs gracefully when PGRST205 (missing table in schema cache) error occurs', async () => {
      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        then: (resolve: (v: any) => void) =>
          Promise.resolve({
            data: null,
            error: {
              code: 'PGRST205',
              message: "Could not find the table 'public.opg_transactions' in the schema cache",
            },
          }).then(resolve),
      };

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'opg_cash_registers') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
              }),
            }),
          };
        }
        if (table === 'opg_transactions') {
          return mockQueryBuilder;
        }
        return mockQueryBuilder;
      });

      const result = await OpgService.getTurnoverKpis('comp-123');

      expect(result).toBeDefined();
      expect(result.totalGross).toBe(0);
      expect(result.totalCash).toBe(0);
      expect(result.totalCard).toBe(0);
      expect(result.transactionCount).toBe(0);
      expect(result.pendingCashBookingCount).toBe(0);
    });
  });
});
