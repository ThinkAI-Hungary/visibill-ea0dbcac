import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  postDevelopmentReserveReleaseToLedger,
  removeDevelopmentReservePosting,
} from '@/lib/fixed-assets/developmentReserveAutoPoster';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      from: vi.fn(),
      rpc: vi.fn().mockResolvedValue({ error: null }),
    },
  };
});

import { supabase } from '@/integrations/supabase/client';

describe('developmentReserveAutoPoster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects posting when reserve amount is zero or negative', async () => {
    const res = await postDevelopmentReserveReleaseToLedger({
      companyId: 'c1',
      userId: 'u1',
      assetName: 'CNC Gép',
      inventoryNumber: 'ESZ-001',
      reserveAmount: 0,
      activationDate: '2026-06-01',
    });
    expect(res.success).toBe(false);
    expect(res.message).toContain('Nincs érvényes fejlesztési tartalék összeg');
  });

  it('resolves active COA preset via chart_of_accounts_presets and posts to ledger', async () => {
    const mockFrom = supabase.from as any;

    mockFrom.mockImplementation((table: string) => {
      if (table === 'acc_journals') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockImplementation((col: string) => {
            if (col === 'company_id') {
              return {
                eq: vi.fn().mockResolvedValue({
                  data: [{ id: 've-1', code: 'VE', name: 'Vegyes tételek' }],
                }),
              };
            }
            return {
              eq: vi.fn().mockResolvedValue({
                data: [{ id: 've-1', code: 'VE', name: 'Vegyes tételek' }],
              }),
            };
          }),
        };
      }
      if (table === 'chart_of_accounts_presets') {
        return {
          select: vi.fn().mockResolvedValue({
            data: [{ id: 'preset-1', company_id: 'c1', is_active: true, type: 'custom' }],
          }),
        };
      }
      if (table === 'gl_accounts') {
        const glData = [
          { id: 'gl-414', gl_number: '414', short_name: 'Lekötött tartalék' },
          { id: 'gl-413', gl_number: '413', short_name: 'Eredménytartalék' },
        ];
        const builder: any = {
          select: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: glData }),
        };
        builder.select.mockReturnValue(builder);
        builder.or.mockReturnValue(builder);
        builder.eq.mockReturnValue(builder);
        return builder;
      }
      if (table === 'acc_journal_headers') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'hdr-new-1' }, error: null }),
            }),
          }),
        };
      }
      if (table === 'acc_journal_lines') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };
    });

    const res = await postDevelopmentReserveReleaseToLedger({
      companyId: 'c1',
      userId: 'u1',
      assetName: 'CNC Gép',
      inventoryNumber: 'ESZ-001',
      reserveAmount: 2500000,
      activationDate: '2026-06-01',
      reserveYear: 2024,
    });

    expect(res.success).toBe(true);
    expect(res.headerId).toBe('hdr-new-1');
  });

  it('removes development reserve posting correctly', async () => {
    const mockFrom = supabase.from as any;
    const deleteHeaderMock = vi.fn().mockResolvedValue({ error: null });
    const deleteLinesMock = vi.fn().mockResolvedValue({ error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'acc_journal_headers') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'hdr-to-del' }, error: null }),
          delete: vi.fn().mockReturnValue({
            eq: deleteHeaderMock,
          }),
        };
      }
      if (table === 'acc_journal_lines') {
        return {
          delete: vi.fn().mockReturnValue({
            eq: deleteLinesMock,
          }),
        };
      }
      return {};
    });

    const res = await removeDevelopmentReservePosting('c1', 'ESZ-001');
    expect(res.success).toBe(true);
    expect(deleteLinesMock).toHaveBeenCalledWith('header_id', 'hdr-to-del');
    expect(deleteHeaderMock).toHaveBeenCalledWith('id', 'hdr-to-del');
  });
});
