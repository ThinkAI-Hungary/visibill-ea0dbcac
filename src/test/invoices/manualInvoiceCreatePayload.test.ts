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
