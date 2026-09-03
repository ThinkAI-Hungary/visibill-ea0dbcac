import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateDraftsFallback } from '../services/draftFallbackGenerator';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe('draftFallbackGenerator', () => {
  const mockCompanyId = '35a5409c-d9a7-4c0b-819e-b1ae79a9dd98';
  const mockPresetId = '9e355eaa-4f6f-4290-b1af-c442964788bd';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 0 when there are no categorized items', async () => {
    // Mock delete
    const deleteEq2 = vi.fn().mockResolvedValue({ error: null });
    const deleteEq1 = vi.fn().mockReturnValue({ eq: deleteEq2 });
    (supabase.from as any).mockReturnValue({
      delete: vi.fn().mockReturnValue({ eq: deleteEq1 }),
    });

    // Mock RPC calls
    (supabase.rpc as any).mockImplementation((rpcName: string) => {
      if (rpcName === 'acc_seed_default_journals') {
        return Promise.resolve({ error: null });
      }
      if (rpcName === 'get_gl_categorized_items') {
        return Promise.resolve({ data: [], error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const result = await generateDraftsFallback(mockCompanyId, mockPresetId);
    expect(result).toBe(0);
    expect(supabase.rpc).toHaveBeenCalledWith('get_gl_categorized_items', {
      p_company_id: mockCompanyId,
      p_preset_id: mockPresetId,
    });
  });

  it('should throw error when get_gl_categorized_items returns an error', async () => {
    const deleteEq2 = vi.fn().mockResolvedValue({ error: null });
    const deleteEq1 = vi.fn().mockReturnValue({ eq: deleteEq2 });
    (supabase.from as any).mockReturnValue({
      delete: vi.fn().mockReturnValue({ eq: deleteEq1 }),
    });

    (supabase.rpc as any).mockImplementation((rpcName: string) => {
      if (rpcName === 'acc_seed_default_journals') {
        return Promise.resolve({ error: null });
      }
      if (rpcName === 'get_gl_categorized_items') {
        return Promise.resolve({ data: null, error: new Error('DB query error') });
      }
      return Promise.resolve({ data: null, error: null });
    });

    await expect(generateDraftsFallback(mockCompanyId, mockPresetId)).rejects.toThrow('DB query error');
  });

  it('should process invoice items into 3-legged entries with VAT and exchange rate', async () => {
    const insertedHeaders: any[] = [];
    const insertedLines: any[] = [];

    // Mock delete
    const deleteEq2 = vi.fn().mockResolvedValue({ error: null });
    const deleteEq1 = vi.fn().mockReturnValue({ eq: deleteEq2 });

    // Mock RPC calls
    (supabase.rpc as any).mockImplementation((rpcName: string) => {
      if (rpcName === 'acc_seed_default_journals') {
        return Promise.resolve({ error: null });
      }
      if (rpcName === 'get_gl_categorized_items') {
        return Promise.resolve({
          data: [
            {
              item_id: 'item-inv-1234',
              source_table: 'invoice_items',
              gl_account_id: 'gl-5131',
              amount: -26832,
              original_amount: -26832,
              original_currency: 'HUF',
              item_date: '2026-07-15',
              description: 'HP CF283X Toner',
            }
          ],
          error: null
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'acc_journal_headers') {
        return {
          delete: vi.fn().mockReturnValue({ eq: deleteEq1 }),
          insert: vi.fn().mockImplementation((payload) => {
            insertedHeaders.push(payload);
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'hdr-1' }, error: null })
              })
            };
          })
        };
      }
      if (table === 'gl_accounts') {
        return {
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockResolvedValue({
              data: [
                { id: 'gl-311', gl_number: '3110' },
                { id: 'gl-4541', gl_number: '4541' },
                { id: 'gl-466', gl_number: '4660' },
                { id: 'gl-467', gl_number: '4670' },
                { id: 'gl-5131', gl_number: '5131' },
              ],
              error: null
            })
          })
        };
      }
      if (table === 'acc_journals') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: 'j-sz', code: 'SZ', type: 'SUPPLIER', currency: 'HUF' },
                { id: 'j-v', code: 'V', type: 'CUSTOMER', currency: 'HUF' }
              ],
              error: null
            })
          })
        };
      }
      if (table === 'invoice_items') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ id: 'item-inv-1234', vat_amount: 7245, vat_rate: '27%' }],
              error: null
            })
          })
        };
      }
      if (table === 'daily_exchange_rates') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [{ currency: 'USD', rate_date: '2026-07-15', rate: 316.22 }],
              error: null
            })
          })
        };
      }
      if (table === 'acc_journal_lines') {
        return {
          insert: vi.fn().mockImplementation((payload) => {
            if (Array.isArray(payload)) {
              insertedLines.push(...payload);
            } else {
              insertedLines.push(payload);
            }
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'line-1' }, error: null })
              })
            };
          })
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: [], error: null })
        })
      };
    });

    const count = await generateDraftsFallback(mockCompanyId, mockPresetId);
    expect(count).toBe(1);
    expect(insertedHeaders.length).toBe(1);
    expect(insertedHeaders[0].currency).toBe('HUF');
    expect(insertedHeaders[0].exchange_rate).toBe(1);

    // 3 legs: Net expense (Seq 1), VAT (Seq 2), Supplier Gross (Seq 3)
    expect(insertedLines.length).toBe(3);
    const netLine = insertedLines.find(l => l.vat_role === 'ALAP');
    const vatLine = insertedLines.find(l => l.vat_role === 'AFA');
    const suppLine = insertedLines.find(l => l.vat_role === 'NONE');

    expect(netLine).toBeDefined();
    expect(netLine.amount).toBe(26832);
    expect(netLine.dc_type).toBe('T');

    expect(vatLine).toBeDefined();
    expect(vatLine.amount).toBe(7245);
    expect(vatLine.dc_type).toBe('T');

    expect(suppLine).toBeDefined();
    expect(suppLine.amount).toBe(34077);
    expect(suppLine.dc_type).toBe('K');
  });
});
