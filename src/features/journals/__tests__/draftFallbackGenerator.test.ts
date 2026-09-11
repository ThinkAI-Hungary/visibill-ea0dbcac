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
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null })
          }),
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
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
          eq: vi.fn().mockResolvedValue({ data: [], error: null })
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

  it('should process 0% deductible invoice items into 2-legged entries with full gross expense and no 466 line', async () => {
    const mockItems = [
      {
        item_id: 'item-inv-fuel',
        gl_account_id: 'mock-exp-5121',
        source_table: 'invoice_items',
        item_type: 'Bejövő (Költség)',
        partner: 'OMV Hungária Kft.',
        description: 'OMV Super 95',
        amount: -18628,
        original_amount: -18628,
        original_currency: 'HUF',
        item_date: '2026-07-28'
      }
    ];

    const insertedHeaders: any[] = [];
    const insertedLines: any[] = [];

    vi.mocked(supabase.rpc).mockImplementation(async (rpcName: string) => {
      if (rpcName === 'get_gl_categorized_items') {
        return { data: mockItems, error: null } as any;
      }
      return { data: null, error: null } as any;
    });

    vi.mocked(supabase.from).mockImplementation((table: string): any => {
      if (table === 'acc_journals') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ id: 'journal-sz', code: 'SZ', type: 'SUPPLIER' }],
              error: null
            })
          })
        };
      }
      if (table === 'gl_accounts') {
        return {
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockResolvedValue({
              data: [
                { id: 'mock-supp-4541', gl_number: '4541', short_name: 'Szállítók' },
                { id: 'mock-vat-466', gl_number: '466', short_name: 'Levonható ÁFA' },
                { id: 'mock-exp-5121', gl_number: '5121', short_name: 'Üzemanyagok' }
              ],
              error: null
            })
          })
        };
      }
      if (table === 'acc_journal_headers') {
        return {
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null })
            })
          }),
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null })
          }),
          insert: vi.fn().mockImplementation((payload) => {
            insertedHeaders.push(payload);
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'hdr-fuel' }, error: null })
              })
            };
          })
        };
      }
      if (table === 'invoice_items') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ id: 'item-inv-fuel', vat_amount: 5029, vat_rate: '27%', deductible_percentage: 0 }],
              error: null
            })
          })
        };
      }
      if (table === 'daily_exchange_rates') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null })
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
                single: vi.fn().mockResolvedValue({ data: { id: 'line-fuel' }, error: null })
              })
            };
          })
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
          eq: vi.fn().mockResolvedValue({ data: [], error: null })
        })
      };
    });

    const count = await generateDraftsFallback(mockCompanyId, mockPresetId);
    expect(count).toBe(1);

    // 2 legs: Gross expense (Seq 1: 18628 + 5029 = 23657), Supplier Gross (Seq 2: 23657), NO 466 line!
    expect(insertedLines.length).toBe(2);
    const expLine = insertedLines.find(l => l.vat_role === 'ALAP');
    const vatLine = insertedLines.find(l => l.vat_role === 'AFA');
    const suppLine = insertedLines.find(l => l.vat_role === 'NONE');

    expect(expLine).toBeDefined();
    expect(expLine.amount).toBe(23657);
    expect(expLine.dc_type).toBe('T');

    expect(vatLine).toBeUndefined(); // 466 line is absent!

    expect(suppLine).toBeDefined();
    expect(suppLine.amount).toBe(23657);
    expect(suppLine.dc_type).toBe('K');
  });

  it('should resolve bank drafts to the journal connected_gl_account (3841) rather than synthetic parent 384', async () => {
    const mockItems = [
      {
        item_id: 'tr-bank-1',
        gl_account_id: 'gl-cust-311',
        source_table: 'transactions',
        item_type: 'Banki tranzakció',
        description: 'Vevői átutalás OTP',
        amount: 50000,
        original_amount: 50000,
        original_currency: 'HUF',
        item_date: '2026-08-10'
      }
    ];

    const insertedHeaders: any[] = [];
    const insertedLines: any[] = [];

    vi.mocked(supabase.rpc).mockImplementation(async (rpcName: string) => {
      if (rpcName === 'get_gl_categorized_items') {
        return { data: mockItems, error: null } as any;
      }
      return { data: null, error: null } as any;
    });

    vi.mocked(supabase.from).mockImplementation((table: string): any => {
      if (table === 'acc_journals') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: 'j-b1', code: 'B1', name: 'OTP Bank HUF', type: 'BANK', connected_gl_account: '3841', currency: 'HUF' }
              ],
              error: null
            })
          })
        };
      }
      if (table === 'gl_accounts') {
        return {
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockResolvedValue({
              data: [
                { id: 'gl-384-parent', gl_number: '384', short_name: 'Elszámolási betétszámlák (szintetikus)' },
                { id: 'gl-3841-analytic', gl_number: '3841', short_name: 'OTP Bank HUF' },
                { id: 'gl-cust-311', gl_number: '3110', short_name: 'Vevők' }
              ],
              error: null
            })
          })
        };
      }
      if (table === 'acc_journal_headers') {
        return {
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null })
            })
          }),
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null })
          }),
          insert: vi.fn().mockImplementation((payload) => {
            insertedHeaders.push(payload);
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'hdr-tr-1' }, error: null })
              })
            };
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
                single: vi.fn().mockResolvedValue({ data: { id: 'line-tr-1' }, error: null })
              })
            };
          })
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          order: vi.fn().mockResolvedValue({ data: [], error: null })
        })
      };
    });

    const count = await generateDraftsFallback(mockCompanyId, mockPresetId);
    expect(count).toBe(1);
    expect(insertedHeaders.length).toBe(1);
    expect(insertedHeaders[0].journal_id).toBe('j-b1');

    // Bank debit line should use gl-3841-analytic, NOT gl-384-parent!
    const bankLine = insertedLines.find(l => l.dc_type === 'T');
    expect(bankLine).toBeDefined();
    expect(bankLine.gl_account_id).toBe('gl-3841-analytic');
  });

  it('should resolve petty cash drafts to the journal connected_gl_account (3811) rather than synthetic parent 381', async () => {
    const insertedHeaders: any[] = [];
    const insertedLines: any[] = [];

    vi.mocked(supabase.rpc).mockImplementation(async (rpcName: string) => {
      if (rpcName === 'get_gl_categorized_items') {
        return { data: [{ item_id: 'dummy', amount: 0 }], error: null } as any;
      }
      return { data: null, error: null } as any;
    });

    vi.mocked(supabase.from).mockImplementation((table: string): any => {
      if (table === 'acc_journals') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: 'j-p1', code: 'P1', name: 'Házipénztár HUF', type: 'PETTY_CASH', connected_gl_account: '3811', currency: 'HUF' }
              ],
              error: null
            })
          })
        };
      }
      if (table === 'gl_accounts') {
        return {
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockResolvedValue({
              data: [
                { id: 'gl-cust-311', gl_number: '3110', short_name: 'Vevők' },
                { id: 'gl-supp-4541', gl_number: '4541', short_name: 'Szállítók' },
                { id: 'gl-381-parent', gl_number: '381', short_name: 'Pénztár (szintetikus)' },
                { id: 'gl-3811-analytic', gl_number: '3811', short_name: 'Házipénztár HUF' },
                { id: 'gl-exp-52', gl_number: '521', short_name: 'Anyagköltség' }
              ],
              error: null
            })
          })
        };
      }
      if (table === 'acc_journal_headers') {
        return {
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null })
            })
          }),
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null })
          }),
          insert: vi.fn().mockImplementation((payload) => {
            insertedHeaders.push(payload);
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'hdr-pce-1' }, error: null })
              })
            };
          })
        };
      }
      if (table === 'petty_cash_entries') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'pce-1234',
                  entry_date: '2026-08-15',
                  description: 'Irodai tisztítószer',
                  amount: -4500,
                  currency: 'HUF',
                  source_type: 'MANUAL'
                }
              ],
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
                single: vi.fn().mockResolvedValue({ data: { id: 'line-pce-1' }, error: null })
              })
            };
          })
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          order: vi.fn().mockResolvedValue({ data: [], error: null })
        })
      };
    });

    const count = await generateDraftsFallback(mockCompanyId, mockPresetId);
    expect(count).toBe(1);
    expect(insertedHeaders.length).toBe(1);
    expect(insertedHeaders[0].journal_id).toBe('j-p1');

    // Petty cash credit line for negative expense (-4500) should use gl-3811-analytic, NOT gl-381-parent!
    const cashLine = insertedLines.find(l => l.dc_type === 'K');
    expect(cashLine).toBeDefined();
    expect(cashLine.gl_account_id).toBe('gl-3811-analytic');
  });

  it('should route transactions to matching bank journal (e.g. B3 OTP) when multiple bank journals exist for HUF', async () => {
    const mockItems = [
      {
        item_id: 'tr-otp-specific',
        gl_account_id: 'gl-cust-311',
        source_table: 'transactions',
        item_type: 'Banki tranzakció',
        description: 'OTP Bank mobilfizetés jóváírás',
        amount: 35000,
        original_amount: 35000,
        original_currency: 'HUF',
        item_date: '2026-08-20'
      }
    ];

    const insertedHeaders: any[] = [];
    const insertedLines: any[] = [];

    vi.mocked(supabase.rpc).mockImplementation(async (rpcName: string) => {
      if (rpcName === 'get_gl_categorized_items') {
        return { data: mockItems, error: null } as any;
      }
      return { data: null, error: null } as any;
    });

    vi.mocked(supabase.from).mockImplementation((table: string): any => {
      if (table === 'acc_journals') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: 'j-b1-kh', code: 'B1', name: 'K&H bank HUF', type: 'BANK', connected_gl_account: '3841', currency: 'HUF' },
                { id: 'j-b3-otp', code: 'B3', name: 'OTP Bank HUF', type: 'BANK', connected_gl_account: '3842', currency: 'HUF' }
              ],
              error: null
            })
          })
        };
      }
      if (table === 'gl_accounts') {
        return {
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockResolvedValue({
              data: [
                { id: 'gl-3841-kh', gl_number: '3841', short_name: 'K&H Bank HUF' },
                { id: 'gl-3842-otp', gl_number: '3842', short_name: 'OTP Bank HUF' },
                { id: 'gl-cust-311', gl_number: '3110', short_name: 'Vevők' },
                { id: 'gl-supp-4541', gl_number: '4541', short_name: 'Szállítók' }
              ],
              error: null
            })
          })
        };
      }
      if (table === 'acc_journal_headers') {
        return {
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null })
            })
          }),
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null })
          }),
          insert: vi.fn().mockImplementation((payload) => {
            insertedHeaders.push(payload);
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'hdr-otp' }, error: null })
              })
            };
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
                single: vi.fn().mockResolvedValue({ data: { id: 'line-otp' }, error: null })
              })
            };
          })
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          order: vi.fn().mockResolvedValue({ data: [], error: null })
        })
      };
    });

    const count = await generateDraftsFallback(mockCompanyId, mockPresetId);
    expect(count).toBe(1);
    expect(insertedHeaders.length).toBe(1);
    // Crucial assertion: Must match OTP journal (j-b3-otp), not first HUF journal (j-b1-kh)!
    expect(insertedHeaders[0].journal_id).toBe('j-b3-otp');

    const bankLine = insertedLines.find(l => l.dc_type === 'T');
    expect(bankLine).toBeDefined();
    // Crucial assertion: Must resolve to 3842 (OTP analytical), not 3841 (K&H)!
    expect(bankLine.gl_account_id).toBe('gl-3842-otp');
  });
});
