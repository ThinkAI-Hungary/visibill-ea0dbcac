import { describe, it, expect } from 'vitest';
import {
  DEFAULT_JOURNAL_FILTER_CRITERIA,
  getActiveFilterCount,
  getActiveFilterChips,
  filterJournalEntries,
  matchesStringPattern,
  JournalFilterCriteria,
} from '../journalFilterUtils';

describe('journalFilterUtils', () => {
  describe('matchesStringPattern', () => {
    it('handles EXACT matching', () => {
      expect(matchesStringPattern('3111', '3111', 'EXACT')).toBe(true);
      expect(matchesStringPattern('31110', '3111', 'EXACT')).toBe(false);
      expect(matchesStringPattern('311', '3111', 'EXACT')).toBe(false);
    });

    it('handles STARTS_WITH matching', () => {
      expect(matchesStringPattern('311100', '311', 'STARTS_WITH')).toBe(true);
      expect(matchesStringPattern('454100', '311', 'STARTS_WITH')).toBe(false);
    });

    it('handles CONTAINS matching', () => {
      expect(matchesStringPattern('E-TXLG-2025-282', 'TXLG', 'CONTAINS')).toBe(true);
      expect(matchesStringPattern('E-TXLG-2025-282', '2026', 'CONTAINS')).toBe(false);
    });
  });

  describe('getActiveFilterCount & getActiveFilterChips', () => {
    it('returns 0 for default criteria', () => {
      expect(getActiveFilterCount(DEFAULT_JOURNAL_FILTER_CRITERIA)).toBe(0);
      expect(getActiveFilterChips(DEFAULT_JOURNAL_FILTER_CRITERIA)).toHaveLength(0);
    });

    it('detects active filters when criteria change', () => {
      const criteria: JournalFilterCriteria = {
        ...DEFAULT_JOURNAL_FILTER_CRITERIA,
        fokonyviSzam: '311',
        bizonylatszam: 'INV-123',
        journalScope: 'ALL',
      };
      expect(getActiveFilterCount(criteria)).toBe(3);
      const chips = getActiveFilterChips(criteria);
      expect(chips.some(c => c.id === 'fokonyv')).toBe(true);
      expect(chips.some(c => c.id === 'bizonylatszam')).toBe(true);
      expect(chips.some(c => c.id === 'journalScope')).toBe(true);
    });
  });

  describe('filterJournalEntries', () => {
    const mockEntries: any[] = [
      {
        id: 'entry-1',
        document_id: 'E-TXLG-2025-282',
        document_date: '2025-09-09',
        posting_date: '2025-09-09',
        status: 'KONYVELT',
        journal_number: 10,
        currency: 'HUF',
        description: 'Vevői számla könyvelése',
        partner: { name: 'TAXOLOGY Kft.' },
        journal: { code: 'V' },
        lines: [
          { dc_type: 'T', amount: 100000, gl_account: { gl_number: '3111', short_name: 'Belföldi követelések' } },
          { dc_type: 'K', amount: 78740, gl_account: { gl_number: '9111', short_name: 'Árbevétel' } },
          { dc_type: 'K', amount: 21260, gl_account: { gl_number: '4671', short_name: 'Fizetendő ÁFA' } },
        ],
      },
      {
        id: 'entry-2',
        document_id: 'SZ-2026-004',
        document_date: '2026-01-10',
        posting_date: '2026-01-15',
        status: 'KEZI_PISZKOZAT',
        journal_number: 45,
        currency: 'EUR',
        description: 'Beszállítói költségszámla',
        partner: { name: 'Alpha Logistics Gmbh' },
        journal: { code: 'SZ' },
        lines: [
          { dc_type: 'T', amount: 50000, gl_account: { gl_number: '5211', short_name: 'Szállítási költség' } },
          { dc_type: 'K', amount: 50000, gl_account: { gl_number: '4541', short_name: 'Szállítói kötelezettség' } },
        ],
      },
      {
        id: 'entry-3',
        document_id: 'SZTORNO-001',
        document_date: '2026-02-01',
        posting_date: '2026-02-01',
        status: 'SZTORNOZOTT',
        journal_number: 80,
        currency: 'HUF',
        description: 'Hibás tétel sztornója',
        partner: { name: 'Beta Partner' },
        journal: { code: 'V' },
        lines: [
          { dc_type: 'T', amount: 20000, gl_account: { gl_number: '3111', short_name: 'Belföldi követelés' } },
          { dc_type: 'K', amount: 20000, gl_account: { gl_number: '9111', short_name: 'Árbevétel' } },
        ],
      },
    ];

    it('returns active non-storno entries with default criteria', () => {
      const res = filterJournalEntries(mockEntries, DEFAULT_JOURNAL_FILTER_CRITERIA);
      expect(res.map(e => e.id)).toEqual(['entry-1', 'entry-2']);
    });

    it('filters by GL number STARTS_WITH (e.g. 311)', () => {
      const criteria: JournalFilterCriteria = {
        ...DEFAULT_JOURNAL_FILTER_CRITERIA,
        fokonyviSzam: '311',
        fokonyviSzamMatch: 'STARTS_WITH',
      };
      const res = filterJournalEntries(mockEntries, criteria);
      expect(res.map(e => e.id)).toEqual(['entry-1']);
    });

    it('filters by GL number EXACT (e.g. 4541)', () => {
      const criteria: JournalFilterCriteria = {
        ...DEFAULT_JOURNAL_FILTER_CRITERIA,
        fokonyviSzam: '4541',
        fokonyviSzamMatch: 'EXACT',
      };
      const res = filterJournalEntries(mockEntries, criteria);
      expect(res.map(e => e.id)).toEqual(['entry-2']);
    });

    it('filters by partner name CONTAINS (e.g. "logistics")', () => {
      const criteria: JournalFilterCriteria = {
        ...DEFAULT_JOURNAL_FILTER_CRITERIA,
        partnerNev: 'logistics',
        partnerNevMatch: 'CONTAINS',
      };
      const res = filterJournalEntries(mockEntries, criteria);
      expect(res.map(e => e.id)).toEqual(['entry-2']);
    });

    it('filters by journal number range (e.g. 40 to 60)', () => {
      const criteria: JournalFilterCriteria = {
        ...DEFAULT_JOURNAL_FILTER_CRITERIA,
        naplosorszamTol: '40',
        naplosorszamIg: '60',
      };
      const res = filterJournalEntries(mockEntries, criteria);
      expect(res.map(e => e.id)).toEqual(['entry-2']);
    });

    it('filters by date range (teljesitesTol and teljesitesIg)', () => {
      const criteria: JournalFilterCriteria = {
        ...DEFAULT_JOURNAL_FILTER_CRITERIA,
        teljesitesTol: '2026-01-01',
        teljesitesIg: '2026-01-31',
      };
      const res = filterJournalEntries(mockEntries, criteria);
      expect(res.map(e => e.id)).toEqual(['entry-2']);
    });

    it('filters by currency (e.g. EUR)', () => {
      const criteria: JournalFilterCriteria = {
        ...DEFAULT_JOURNAL_FILTER_CRITERIA,
        devizanem: 'EUR',
      };
      const res = filterJournalEntries(mockEntries, criteria);
      expect(res.map(e => e.id)).toEqual(['entry-2']);
    });

    it('filters by direction (e.g. only Vevő számlák)', () => {
      const criteria: JournalFilterCriteria = {
        ...DEFAULT_JOURNAL_FILTER_CRITERIA,
        vevoSzamlak: true,
        szallitoSzamlak: false,
      };
      const res = filterJournalEntries(mockEntries, criteria);
      expect(res.map(e => e.id)).toEqual(['entry-1']);
    });

    it('returns Szállító entries when ONLY szallitoSzamlak is checked and all other options are unchecked', () => {
      const criteria: JournalFilterCriteria = {
        ...DEFAULT_JOURNAL_FILTER_CRITERIA,
        vevoSzamlak: false,
        szallitoSzamlak: true,
        bankPenztar: false,
        vegyesNaplo: false,
        statusKonyvelt: false,
        statusPiszkozat: false,
        statusSztorno: false,
      };
      const res = filterJournalEntries(mockEntries, criteria);
      expect(res.map(e => e.id)).toEqual(['entry-2']);
    });

    it('includes storno when statusSztorno is true', () => {
      const criteria: JournalFilterCriteria = {
        ...DEFAULT_JOURNAL_FILTER_CRITERIA,
        statusSztorno: true,
      };
      const res = filterJournalEntries(mockEntries, criteria);
      expect(res.map(e => e.id)).toContain('entry-3');
    });

    it('returns ONLY storno entries when statusSztorno is the sole checked status', () => {
      const criteria: JournalFilterCriteria = {
        ...DEFAULT_JOURNAL_FILTER_CRITERIA,
        statusKonyvelt: false,
        statusPiszkozat: false,
        statusSztorno: true,
      };
      const res = filterJournalEntries(mockEntries, criteria);
      expect(res.map(e => e.id)).toEqual(['entry-3']);
    });
  });
});
