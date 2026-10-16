import { describe, it, expect } from 'vitest';
import { deriveItemForeignAmounts, groupSubledgerItems, formatSubledgerDescription } from '../subledgerGrouping';
import type { SubledgerItem } from '@/types/subledger';

describe('subledgerGrouping', () => {
  describe('deriveItemForeignAmounts', () => {
    it('returns empty foreign stats for domestic HUF items', () => {
      const item: SubledgerItem = {
        line_id: 'l1',
        header_id: 'h1',
        posting_date: '2026-01-10',
        document_date: '2026-01-10',
        due_date: '2026-01-20',
        document_id: 'INV-HUF-1',
        settlement_number: 'INV-HUF-1',
        partner_id: 'p1',
        partner_name: 'Test Partner',
        gl_account_id: 'gl1',
        gl_number: '4541',
        gl_short_name: 'Szállítók',
        dc_type: 'K',
        amount: 100000,
        net_amount: 78740,
        vat_amount: 21260,
        foreign_amount: null,
        currency: 'HUF',
        settled_amount: 0,
        remaining_amount: 100000,
        is_settled: false,
        match_count: 0,
        description: 'Belföldi beszerzés',
        status: 'VEGLEGES',
        journal_code: 'SZ',
        journal_number: 1,
        import_key: null,
      };

      const res = deriveItemForeignAmounts(item);
      expect(res.isForeign).toBe(false);
      expect(res.exchangeRate).toBeNull();
      expect(res.foreignGross).toBeNull();
      expect(res.foreignNet).toBeNull();
      expect(res.foreignVat).toBeNull();
    });

    it('correctly derives foreign amounts and exchange rate for EUR items', () => {
      const item: SubledgerItem = {
        line_id: 'l-zoho',
        header_id: 'h-zoho',
        posting_date: '2026-01-01',
        document_date: '2026-01-01',
        due_date: '2026-01-09',
        document_id: '92771738',
        settlement_number: '92771738',
        partner_id: null,
        partner_name: 'Zoho Corp',
        gl_account_id: 'gl-4541',
        gl_number: '4541',
        gl_short_name: 'Belföldi szállítók',
        dc_type: 'K',
        amount: 17343,
        foreign_amount: 45,
        currency: 'EUR',
        net_amount: 17343,
        vat_amount: 0,
        settled_amount: 0,
        remaining_amount: 17343,
        is_settled: false,
        match_count: 0,
        description: 'Monthly Subscription',
        status: 'GEPI_JAVASLAT',
        journal_code: 'SZ',
        journal_number: 0,
        import_key: null,
        all_lines: [
          {
            id: 'line-cost',
            sequence_number: 1,
            gl_account_id: 'gl-5299',
            gl_number: '5299',
            gl_short_name: 'Szolgáltatások költségei',
            dc_type: 'T',
            amount: 17343,
            foreign_amount: 45,
            vat_role: 'ALAP',
            vat_code: '0%',
            description: 'Monthly Subscription',
          },
          {
            id: 'line-payable',
            sequence_number: 2,
            gl_account_id: 'gl-4541',
            gl_number: '4541',
            gl_short_name: 'Belföldi szállítók',
            dc_type: 'K',
            amount: 17343,
            foreign_amount: 45,
            vat_role: 'NONE',
            vat_code: null,
            description: 'Monthly Subscription',
          },
        ],
      };

      const res = deriveItemForeignAmounts(item);
      expect(res.isForeign).toBe(true);
      expect(res.exchangeRate).toBe(385.4); // 17343 / 45
      expect(res.foreignGross).toBe(45);
      expect(res.foreignNet).toBe(45);
      expect(res.foreignVat).toBe(0);
      expect(res.foreignRemaining).toBe(45);
      expect(res.foreignSettled).toBe(0);
    });
  });

  describe('groupSubledgerItems', () => {
    it('groups foreign items and populates foreign fields on GroupedSubledgerInvoice', () => {
      const items: SubledgerItem[] = [
        {
          line_id: 'l-zoho',
          header_id: 'h-zoho',
          posting_date: '2026-01-01',
          document_date: '2026-01-01',
          due_date: '2026-01-09',
          document_id: '92771738',
          settlement_number: '92771738',
          partner_id: 'p-zoho',
          partner_name: 'Zoho Corp',
          gl_account_id: 'gl-4541',
          gl_number: '4541',
          gl_short_name: 'Szállítók',
          dc_type: 'K',
          amount: 17343,
          foreign_amount: 45,
          currency: 'EUR',
          net_amount: 17343,
          vat_amount: 0,
          settled_amount: 0,
          remaining_amount: 17343,
          is_settled: false,
          match_count: 0,
          description: 'Zoho Invoice',
          status: 'GEPI_JAVASLAT',
          journal_code: 'SZ',
          journal_number: 0,
          import_key: null,
          all_lines: [
            {
              id: 'l1',
              sequence_number: 1,
              gl_account_id: 'gl-5299',
              gl_number: '5299',
              gl_short_name: 'Költség',
              dc_type: 'T',
              amount: 17343,
              foreign_amount: 45,
              vat_role: 'ALAP',
            },
            {
              id: 'l2',
              sequence_number: 2,
              gl_account_id: 'gl-4541',
              gl_number: '4541',
              gl_short_name: 'Szállítók',
              dc_type: 'K',
              amount: 17343,
              foreign_amount: 45,
              vat_role: 'NONE',
            },
          ],
        },
      ];

      const grouped = groupSubledgerItems(items);
      expect(grouped).toHaveLength(1);
      const inv = grouped[0];
      expect(inv.currency).toBe('EUR');
      expect(inv.amount).toBe(17343); // HUF gross
      expect(inv.foreign_amount).toBe(45); // EUR gross
      expect(inv.foreign_net_amount).toBe(45);
      expect(inv.foreign_vat_amount).toBe(0);
      expect(inv.foreign_remaining_amount).toBe(45);
      expect(inv.foreign_settled_amount).toBe(0);
      expect(inv.exchange_rate).toBe(385.4);
    });
  });

  describe('formatSubledgerDescription', () => {
    it('shortens supplier debt settlement prefix', () => {
      expect(formatSubledgerDescription('Szállító tartozás kiegyenlítése - SZZJ-2026-3'))
        .toBe('száll.tart.rend: SZZJ-2026-3');
      expect(formatSubledgerDescription('Szállító tartozás kiegyenlítése: INV-100'))
        .toBe('száll.tart.rend: INV-100');
    });

    it('shortens customer claim settlement prefix', () => {
      expect(formatSubledgerDescription('Vevő követelés kiegyenlítése - VEV-2026-001'))
        .toBe('vevő köv.rend: VEV-2026-001');
    });

    it('shortens cash settlement prefixes', () => {
      expect(formatSubledgerDescription('Készpénzes szállítói kiegyenlítés - KP-01'))
        .toBe('száll.tart.rend (KP): KP-01');
      expect(formatSubledgerDescription('Utalásos számla KP-ban rendezve: SZZJ-2026-3'))
        .toBe('számla (KP): SZZJ-2026-3');
    });

    it('leaves standard invoice item descriptions untouched', () => {
      expect(formatSubledgerDescription('Adminisztratív szolgáltatás'))
        .toBe('Adminisztratív szolgáltatás');
      expect(formatSubledgerDescription('Ügyvédi munkadíj'))
        .toBe('Ügyvédi munkadíj');
    });

    it('handles null, undefined and empty strings safely', () => {
      expect(formatSubledgerDescription(null)).toBe('');
      expect(formatSubledgerDescription(undefined)).toBe('');
      expect(formatSubledgerDescription('')).toBe('');
      expect(formatSubledgerDescription('   ')).toBe('');
    });
  });
});

