import { describe, it, expect } from 'vitest';
import { suggestNextJournalCode } from '@/components/journals/CreateJournalModal';
import { resolveBankJournal, doBankAccountsMatch } from '@/features/journals/services/bankJournalResolver';
import { isJournalSystemLocked, CORE_JOURNAL_CODES, CODE_TO_KEY, SHORT_CODE_TO_KEY } from '@/lib/journalUtils';

describe('NAPLÓ EXTENDED - Point 1: Code Recommendation Engine', () => {
  it('suggests sequential bank codes B1, B2, B3...', () => {
    expect(suggestNextJournalCode('BANK', [])).toBe('B1');
    expect(suggestNextJournalCode('BANK', [{ code: 'B1' }])).toBe('B2');
    expect(suggestNextJournalCode('BANK', [{ code: 'B1' }, { code: 'B2' }])).toBe('B3');
    expect(suggestNextJournalCode('BANK', [{ code: 'B1' }, { code: 'B5' }])).toBe('B6');
  });

  it('suggests sequential petty cash codes P1, P2, P3...', () => {
    expect(suggestNextJournalCode('PETTY_CASH', [])).toBe('P1');
    expect(suggestNextJournalCode('PETTY_CASH', [{ code: 'P1' }])).toBe('P2');
    expect(suggestNextJournalCode('PETTY_CASH', [{ code: 'P1' }, { code: 'P2' }])).toBe('P3');
  });

  it('suggests VF then VD then V for Customer invoices', () => {
    expect(suggestNextJournalCode('CUSTOMER', [])).toBe('VF');
    expect(suggestNextJournalCode('CUSTOMER', [{ code: 'VF' }])).toBe('VD');
    expect(suggestNextJournalCode('CUSTOMER', [{ code: 'VF' }, { code: 'VD' }])).toBe('V');
  });

  it('suggests SZF then SZD then SZ for Supplier invoices', () => {
    expect(suggestNextJournalCode('SUPPLIER', [])).toBe('SZF');
    expect(suggestNextJournalCode('SUPPLIER', [{ code: 'SZF' }])).toBe('SZD');
    expect(suggestNextJournalCode('SUPPLIER', [{ code: 'SZF' }, { code: 'SZD' }])).toBe('SZ');
  });

  it('suggests dedicated system journals TE, ARF, ELH, BER in order', () => {
    expect(suggestNextJournalCode('SYSTEM', [])).toBe('TE');
    expect(suggestNextJournalCode('SYSTEM', [{ code: 'TE' }])).toBe('ARF');
    expect(suggestNextJournalCode('SYSTEM', [{ code: 'TE' }, { code: 'ARF' }])).toBe('ELH');
    expect(suggestNextJournalCode('SYSTEM', [{ code: 'TE' }, { code: 'ARF' }, { code: 'ELH' }])).toBe('BER');
    expect(suggestNextJournalCode('SYSTEM', [{ code: 'TE' }, { code: 'ARF' }, { code: 'ELH' }, { code: 'BER' }])).toBe('SYS1');
  });

  it('suggests VE then V1, V2 for Mixed journals', () => {
    expect(suggestNextJournalCode('MIXED', [])).toBe('VE');
    expect(suggestNextJournalCode('MIXED', [{ code: 'VE' }])).toBe('V1');
    expect(suggestNextJournalCode('MIXED', [{ code: 'VE' }, { code: 'V1' }])).toBe('V2');
  });
});

describe('NAPLÓ EXTENDED - Point 2: Smart Bank Routing & IBAN/BBAN Matching', () => {
  it('correctly matches Hungarian IBAN to BBAN account numbers', () => {
    const iban = 'HU42 1170 1004 2001 4589 0000 0000';
    const bban = '11701004-20014589';
    expect(doBankAccountsMatch(iban, bban)).toBe(true);
    expect(doBankAccountsMatch(bban, iban)).toBe(true);
  });

  it('resolves bank journal via direct company_bank_account_id link', () => {
    const mockJournals = [
      { id: 'j-b1', code: 'B1', type: 'BANK', currency: 'HUF', company_bank_account_id: 'cba-otp' },
      { id: 'j-b2', code: 'B2', type: 'BANK', currency: 'EUR', company_bank_account_id: 'cba-kh' },
    ];
    const mockBankAccounts = [
      { id: 'cba-otp', account_number: '11701004-20014589-00000000', currency: 'HUF', journal_id: 'j-b1' },
      { id: 'cba-kh', account_number: '10400123-50526789-00000000', currency: 'EUR', journal_id: 'j-b2' },
    ];

    const result = resolveBankJournal(
      { accountNumber: 'HU42 1170 1004 2001 4589 0000 0000', currency: 'HUF' },
      mockJournals,
      mockBankAccounts
    );

    expect(result).toBeDefined();
    expect(result?.id).toBe('j-b1');
    expect(result?.code).toBe('B1');
  });

  it('resolves bank journal when account number matches journal bank_account_number directly', () => {
    const mockJournals = [
      { id: 'j-b1', code: 'B1', type: 'BANK', currency: 'HUF', bank_account_number: '11701004-20014589' },
      { id: 'j-b2', code: 'B2', type: 'BANK', currency: 'HUF', bank_account_number: '12001008-88888888' },
    ];

    const result = resolveBankJournal(
      { accountNumber: '12001008-88888888', currency: 'HUF' },
      mockJournals,
      []
    );

    expect(result?.id).toBe('j-b2');
    expect(result?.code).toBe('B2');
  });

  it('falls back to currency matching if account number is unknown', () => {
    const mockJournals = [
      { id: 'j-b1', code: 'B1', type: 'BANK', currency: 'HUF' },
      { id: 'j-b2', code: 'B2', type: 'BANK', currency: 'EUR' },
      { id: 'j-b3', code: 'B3', type: 'BANK', currency: 'USD' },
    ];

    const result = resolveBankJournal(
      { accountNumber: '99999999-99999999', currency: 'USD' },
      mockJournals,
      []
    );

    expect(result?.id).toBe('j-b3');
    expect(result?.code).toBe('B3');
  });
});

describe('NAPLÓ EXTENDED - Point 3: Domestic vs Foreign Invoice Journal Separation', () => {
  it('correctly maps VF, VD, SZF, SZD in CODE_TO_KEY, SHORT_CODE_TO_KEY and CORE_JOURNAL_CODES', () => {
    expect(CODE_TO_KEY['VF']).toBe('VF');
    expect(CODE_TO_KEY['VD']).toBe('VD');
    expect(CODE_TO_KEY['SZF']).toBe('SZF');
    expect(CODE_TO_KEY['SZD']).toBe('SZD');

    expect(SHORT_CODE_TO_KEY['VF']).toBe('vevo_belfoldi');
    expect(SHORT_CODE_TO_KEY['VD']).toBe('vevo_deviza');
    expect(SHORT_CODE_TO_KEY['SZF']).toBe('szallito_belfoldi');
    expect(SHORT_CODE_TO_KEY['SZD']).toBe('szallito_deviza');

    expect(CORE_JOURNAL_CODES).toContain('VF');
    expect(CORE_JOURNAL_CODES).toContain('VD');
    expect(CORE_JOURNAL_CODES).toContain('SZF');
    expect(CORE_JOURNAL_CODES).toContain('SZD');
  });
});

describe('NAPLÓ EXTENDED - Point 5: Dedicated System Journals & System Lock', () => {
  it('identifies TE, ARF, ELH, BER as system locked journals', () => {
    expect(isJournalSystemLocked({ code: 'TE' })).toBe(true);
    expect(isJournalSystemLocked({ code: 'ARF' })).toBe(true);
    expect(isJournalSystemLocked({ code: 'ELH' })).toBe(true);
    expect(isJournalSystemLocked({ code: 'BER' })).toBe(true);
    expect(isJournalSystemLocked({ code: '603' })).toBe(true);
    expect(isJournalSystemLocked({ code: '901' })).toBe(true);

    // Regular manual journals must not be system locked
    expect(isJournalSystemLocked({ code: 'B1' })).toBe(false);
    expect(isJournalSystemLocked({ code: 'P1' })).toBe(false);
    expect(isJournalSystemLocked({ code: 'VF' })).toBe(false);
    expect(isJournalSystemLocked({ code: 'VD' })).toBe(false);
    expect(isJournalSystemLocked({ code: 'SZF' })).toBe(false);
    expect(isJournalSystemLocked({ code: 'SZD' })).toBe(false);
    expect(isJournalSystemLocked({ code: 'VE' })).toBe(false);
  });
});
