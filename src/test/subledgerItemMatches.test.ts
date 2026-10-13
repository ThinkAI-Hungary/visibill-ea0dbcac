import { describe, it, expect } from 'vitest';
import type { SubledgerItemMatch } from '@/types/subledger';

describe('Subledger Item Matches RPC Contract & Mapping', () => {
  it('correctly maps RPC row with long text description without truncation or 42804 error', () => {
    const rawRpcRow = {
      match_id: '846b8c1a-4c29-4a81-890d-cbdc145f37d6',
      settled_amount_huf: '55700.00',
      settled_amount_foreign: null,
      currency: 'HUF',
      settled_at: '2026-10-12T08:14:23.212867Z',
      match_type: 'MANUAL',
      notes: 'Folyószámla rendezés (KP-6B441ABB <-> A28000074/1094/00002)',
      other_line_id: 'b6e163f0-720f-4c31-b228-4afab15dd8d8',
      other_header_id: '275c3fa2-ea63-49a1-b6de-4ae7993acd13',
      other_document_id: 'KP-6B441ABB',
      other_posting_date: '2026-01-21',
      other_dc_type: 'T',
      other_amount: '55700.00',
      other_journal_code: 'P1',
      other_description: 'Szállító tartozás kiegyenlítése - A28000074/1094/00002 nagyon hosszú részletes könyvelési szöveggel, amely meghaladja a varchar határokat és text típusként érkezik vissza a PostgreSQL tárolt eljárásból hiba nélkül',
    };

    const mapped: SubledgerItemMatch = {
      ...rawRpcRow,
      settled_amount_huf: Number(rawRpcRow.settled_amount_huf || 0),
      settled_amount_foreign: rawRpcRow.settled_amount_foreign ? Number(rawRpcRow.settled_amount_foreign) : null,
      other_amount: Number(rawRpcRow.other_amount || 0),
    };

    expect(mapped.match_id).toBe('846b8c1a-4c29-4a81-890d-cbdc145f37d6');
    expect(mapped.settled_amount_huf).toBe(55700);
    expect(mapped.settled_amount_foreign).toBeNull();
    expect(mapped.other_amount).toBe(55700);
    expect(mapped.other_description).toContain('nagyon hosszú részletes könyvelési szöveggel');
    expect(mapped.other_journal_code).toBe('P1');
    expect(mapped.other_dc_type).toBe('T');
  });

  it('handles foreign currency settlement matching correctly', () => {
    const rawRpcRow = {
      match_id: 'match-eur-01',
      settled_amount_huf: '395000.00',
      settled_amount_foreign: '1000.00',
      currency: 'EUR',
      settled_at: '2026-10-13T10:00:00Z',
      match_type: 'AUTO_REF',
      notes: 'Banki hivatkozás alapján',
      other_line_id: 'line-eur-02',
      other_header_id: 'head-eur-02',
      other_document_id: 'BANK-2026/042',
      other_posting_date: '2026-10-13',
      other_dc_type: 'K',
      other_amount: '395000.00',
      other_journal_code: 'B1',
      other_description: 'EUR átutalás jóváírás',
    };

    const mapped: SubledgerItemMatch = {
      ...rawRpcRow,
      settled_amount_huf: Number(rawRpcRow.settled_amount_huf || 0),
      settled_amount_foreign: rawRpcRow.settled_amount_foreign ? Number(rawRpcRow.settled_amount_foreign) : null,
      other_amount: Number(rawRpcRow.other_amount || 0),
    };

    expect(mapped.currency).toBe('EUR');
    expect(mapped.settled_amount_huf).toBe(395000);
    expect(mapped.settled_amount_foreign).toBe(1000);
  });
});
