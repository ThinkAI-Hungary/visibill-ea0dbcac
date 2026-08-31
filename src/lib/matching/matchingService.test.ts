import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildAvailableInvoicesList,
  applyMatch,
  unmatchTransaction,
  verifyMatch,
  markNoInvoice,
  markInvoiceMissing,
  revertStatus,
} from './matchingService';
import { invalidateMatchingQueries, MATCHING_QUERY_KEYS } from './matchingKeys';
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => {
  const queryBuilder: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  return {
    supabase: {
      from: vi.fn(() => queryBuilder),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-1' } }, error: null }),
        getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'test-user-1' } } }, error: null }),
      },
    },
  };
});

describe('matchingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildAvailableInvoicesList', () => {
    it('combines submitted and nav invoices with remaining amount calculation', async () => {
      const mockInvoices = [
        {
          id: 'inv-1',
          bizonylatsorszam: 'SZL-001',
          brutto_vegosszeg: 50000,
          elado_nev: 'Supplier A',
          penznem: 'HUF',
          kibocsatas_datuma: '2026-08-01',
        },
      ];
      const mockNavInvoices = [
        {
          id: 'nav-1',
          invoice_number: 'NAV-001',
          invoice_gross_amount: 30000,
          supplier_name: 'Supplier B',
          customer_name: null,
          currency: 'HUF',
          invoice_issue_date: '2026-08-05',
        },
      ];

      const result = await buildAvailableInvoicesList(mockInvoices, mockNavInvoices, 'company-123');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('inv-1');
      expect(result[0].remaining).toBe(50000);
      expect(result[1].id).toBe('nav-1');
      expect(result[1].remaining).toBe(30000);
    });
  });

  describe('applyMatch', () => {
    it('updates transactions table with matched invoice and manual match type', async () => {
      const qb: any = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      (supabase.from as any).mockReturnValue(qb);

      await applyMatch({
        transactionId: 'tx-100',
        invoiceId: 'inv-200',
        matchType: 'manual',
        confidenceScore: 1.0,
      });

      expect(supabase.from).toHaveBeenCalledWith('transactions');
      expect(qb.update).toHaveBeenCalledWith({
        matched_invoice_id: 'inv-200',
        is_verified: true,
        match_type: 'manual',
        confidence_score: 1.0,
      });
      expect(qb.eq).toHaveBeenCalledWith('id', 'tx-100');
    });
  });

  describe('unmatchTransaction', () => {
    it('clears transaction matches and associated invoice records', async () => {
      const qb: any = {
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      (supabase.from as any).mockReturnValue(qb);

      await unmatchTransaction('tx-100');

      expect(supabase.from).toHaveBeenCalledWith('transactions');
      expect(qb.update).toHaveBeenCalledWith({
        matched_invoice_id: null,
        is_verified: false,
        match_type: null,
      });
    });
  });

  describe('invalidateMatchingQueries', () => {
    it('invalidates all 15 matching query keys', async () => {
      const queryClient = {
        invalidateQueries: vi.fn().mockResolvedValue(undefined),
      } as any;

      await invalidateMatchingQueries(queryClient, 'company-abc');

      expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(15);
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: MATCHING_QUERY_KEYS.transactions('company-abc'),
      });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: MATCHING_QUERY_KEYS.invoiceKpis('company-abc'),
      });
    });
  });
});
