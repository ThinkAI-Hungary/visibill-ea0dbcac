import { describe, it, expect } from 'vitest';
import {
  JOURNAL_CATEGORIES,
  JournalCategoryKey,
  getJournalCategory,
  isJournalSystemLocked,
  isJournalCoreSystem,
  MNB_CURRENCIES,
} from '@/lib/journalUtils';
import {
  resolveBankJournal,
  sanitizeAccountNumber,
  BankJournalEntity,
  CompanyBankAccountEntity,
} from '@/features/journals/services/bankJournalResolver';

describe('EB-0257 - Journal Categorization and Utilities', () => {
  it('correctly defines all standard journal categories with order and display codes', () => {
    expect(JOURNAL_CATEGORIES).toHaveLength(7);
    const keys = JOURNAL_CATEGORIES.map(c => c.key);
    expect(keys).toEqual(['ALL', 'OPENING', 'BANK', 'PETTY_CASH', 'INVOICE', 'MIXED', 'CLOSING']);

    const categoryMap = Object.fromEntries(JOURNAL_CATEGORIES.map(c => [c.key, c]));
    expect(categoryMap.OPENING.codeRange).toBe('101');
    expect(categoryMap.BANK.codeRange).toBe('201..253');
    expect(categoryMap.PETTY_CASH.codeRange).toBe('301..351');
    expect(categoryMap.INVOICE.codeRange).toBe('401..552');
    expect(categoryMap.MIXED.codeRange).toBe('601..605');
    expect(categoryMap.CLOSING.codeRange).toBe('901');
  });

  it('categorizes journals accurately by code prefix or journal type', () => {
    // 1. Nyitó (101, NY)
    expect(getJournalCategory({ code: '101', type: 'OPENING' })).toBe('OPENING');
    expect(getJournalCategory({ code: 'NY', type: 'GENERAL' })).toBe('OPENING');
    expect(getJournalCategory({ code: '100', name: 'Nyitó napló' })).toBe('OPENING');

    // 2. Bankok (201..253, BANK, B1)
    expect(getJournalCategory({ code: '201', type: 'BANK' })).toBe('BANK');
    expect(getJournalCategory({ code: '253', type: 'BANK' })).toBe('BANK');
    expect(getJournalCategory({ code: 'B1', type: 'BANK' })).toBe('BANK');

    // 3. Pénztárak (301..351, PETTY_CASH, P1)
    expect(getJournalCategory({ code: '301', type: 'PETTY_CASH' })).toBe('PETTY_CASH');
    expect(getJournalCategory({ code: '351', type: 'PETTY_CASH' })).toBe('PETTY_CASH');
    expect(getJournalCategory({ code: 'P1', type: 'PETTY_CASH' })).toBe('PETTY_CASH');

    // 4. Számlák (401..552, CUSTOMER, SUPPLIER, SZ, V)
    expect(getJournalCategory({ code: '401', type: 'CUSTOMER' })).toBe('INVOICE');
    expect(getJournalCategory({ code: '501', type: 'SUPPLIER' })).toBe('INVOICE');
    expect(getJournalCategory({ code: 'SZ', type: 'CUSTOMER' })).toBe('INVOICE');
    expect(getJournalCategory({ code: 'V', type: 'SUPPLIER' })).toBe('INVOICE');

    // 5. Vegyesek (601..605, MIXED, VE)
    expect(getJournalCategory({ code: '601', type: 'MIXED' })).toBe('MIXED');
    expect(getJournalCategory({ code: '603', type: 'MIXED' })).toBe('MIXED');
    expect(getJournalCategory({ code: '605', type: 'MIXED' })).toBe('MIXED');
    expect(getJournalCategory({ code: 'VE', type: 'MIXED' })).toBe('MIXED');

    // 6. Záró (901, CLOSING, Z)
    expect(getJournalCategory({ code: '901', type: 'CLOSING' })).toBe('CLOSING');
    expect(getJournalCategory({ code: 'Z', type: 'CLOSING' })).toBe('CLOSING');
  });

  it('correctly locks system automated journals (603, 605, 901) and explicit flags', () => {
    // Implicit lock by code
    expect(isJournalSystemLocked({ code: '603', name: 'Árfolyamkülönbözet' })).toBe(true);
    expect(isJournalSystemLocked({ code: '605', name: 'Tárgyi eszköz értékcsökkenés' })).toBe(true);
    expect(isJournalSystemLocked({ code: '901', name: 'Záró napló' })).toBe(true);

    // Explicit lock by database column
    expect(isJournalSystemLocked({ code: 'CUSTOM_SYS', is_system_locked: true })).toBe(true);

    // Regular editable journals should NOT be locked
    expect(isJournalSystemLocked({ code: '101', is_system_locked: false })).toBe(false);
    expect(isJournalSystemLocked({ code: '201', is_system_locked: false })).toBe(false);
    expect(isJournalSystemLocked({ code: '301', is_system_locked: false })).toBe(false);
    expect(isJournalSystemLocked({ code: '401', is_system_locked: false })).toBe(false);
    expect(isJournalSystemLocked({ code: '601', is_system_locked: false })).toBe(false);
  });

  it('correctly protects core system journals from deletion with isJournalCoreSystem', () => {
    // Fundamental system journals that cannot be deleted
    expect(isJournalCoreSystem({ code: 'NY', name: 'Nyitó tételek' })).toBe(true);
    expect(isJournalCoreSystem({ code: 'SZ', name: 'Szállító számlák' })).toBe(true);
    expect(isJournalCoreSystem({ code: 'V', name: 'Vevő számlák' })).toBe(true);
    expect(isJournalCoreSystem({ code: 'VE', name: 'Vegyes tételek' })).toBe(true);
    expect(isJournalCoreSystem({ code: 'Z', name: 'Záró tételek' })).toBe(true);
    expect(isJournalCoreSystem({ code: 'BÉR', name: 'Bérfeladás' })).toBe(true);
    expect(isJournalCoreSystem({ code: 'BER', name: 'Bérfeladás' })).toBe(true);
    expect(isJournalCoreSystem({ code: '603', name: 'Árfolyamkülönbözet' })).toBe(true);

    // Custom or secondary user journals that can be deleted when empty
    expect(isJournalCoreSystem({ code: 'B1', name: 'K&H bank HUF' })).toBe(false);
    expect(isJournalCoreSystem({ code: 'B2', name: 'K&H bank EUR' })).toBe(false);
    expect(isJournalCoreSystem({ code: 'B3', name: 'OTP bank HUF' })).toBe(false);
    expect(isJournalCoreSystem({ code: 'P1', name: 'Házipénztár HUF' })).toBe(false);
    expect(isJournalCoreSystem({ code: 'VE2', name: 'Egyéb vegyes' })).toBe(false);
  });

  it('supports all 24 official MNB currencies specified in EB-0257', () => {
    expect(MNB_CURRENCIES).toHaveLength(24);
    const currencyCodes = MNB_CURRENCIES.map(c => c.code);
    expect(currencyCodes).toContain('HUF');
    expect(currencyCodes).toContain('EUR');
    expect(currencyCodes).toContain('USD');
    expect(currencyCodes).toContain('GBP');
    expect(currencyCodes).toContain('CHF');
  });
});

describe('EB-0257 - Bank Journal Resolver and Account Sanitization', () => {
  it('sanitizes bank account numbers across formats and whitespace', () => {
    expect(sanitizeAccountNumber('11773016-00000000-00000000')).toBe('117730160000000000000000');
    expect(sanitizeAccountNumber('HU42 1177 3016 0000 0000 0000 0000')).toBe('hu42117730160000000000000000');
    expect(sanitizeAccountNumber(' 10400126-50526780-68871003 ')).toBe('104001265052678068871003');
    expect(sanitizeAccountNumber(null)).toBe('');
    expect(sanitizeAccountNumber(undefined)).toBe('');
  });

  const mockJournals: BankJournalEntity[] = [
    {
      id: 'j-bank-otp-huf',
      code: '201',
      name: 'OTP HUF Főszámla',
      type: 'BANK',
      currency: 'HUF',
      bank_account_number: '11773016-00000000-00000000',
    },
    {
      id: 'j-bank-kh-eur',
      code: '202',
      name: 'K&H Devizaszámla EUR',
      type: 'BANK',
      currency: 'EUR',
      bank_account_number: '10400126-50526780-68871003',
    },
    {
      id: 'j-bank-revolut-usd',
      code: '203',
      name: 'Revolut USD',
      type: 'BANK',
      currency: 'USD',
      bank_account_number: 'LT123456789012345678',
    },
    {
      id: 'j-bank-fallback-b1',
      code: 'B1',
      name: 'Általános Banknapló',
      type: 'BANK',
      currency: 'HUF',
      bank_account_number: null,
    },
  ];

  const mockCompanyBankAccounts: CompanyBankAccountEntity[] = [
    {
      id: 'cba-1',
      bank_name: 'OTP Bank',
      account_number: '11773016-00000000-00000000',
      currency: 'HUF',
      journal_id: 'j-bank-otp-huf',
    },
    {
      id: 'cba-2',
      bank_name: 'K&H Bank',
      account_number: '10400126-50526780-68871003',
      currency: 'EUR',
      journal_id: 'j-bank-kh-eur',
    },
  ];

  it('matches bank journal directly by acc_journals.bank_account_number', () => {
    const resolved = resolveBankJournal(
      { accountNumber: '11773016-00000000-00000000' },
      mockJournals,
      mockCompanyBankAccounts
    );
    expect(resolved).not.toBeNull();
    expect(resolved?.id).toBe('j-bank-otp-huf');
  });

  it('matches bank journal when account number has different dash/space formatting', () => {
    const resolved = resolveBankJournal(
      { accountNumber: '10400126 50526780 68871003' },
      mockJournals,
      mockCompanyBankAccounts
    );
    expect(resolved).not.toBeNull();
    expect(resolved?.id).toBe('j-bank-kh-eur');
  });

  it('resolves bank journal through company_bank_accounts mapping', () => {
    const journalsWithoutAccNum: BankJournalEntity[] = [
      { id: 'j-mapped-1', code: '201', name: 'OTP Számla', type: 'BANK', currency: 'HUF', bank_account_number: null },
    ];
    const cba: CompanyBankAccountEntity[] = [
      { id: 'cba-m1', bank_name: 'OTP', account_number: '11700000-11111111-22222222', currency: 'HUF', journal_id: 'j-mapped-1' },
    ];

    const resolved = resolveBankJournal(
      { accountNumber: '11700000-11111111-22222222' },
      journalsWithoutAccNum,
      cba
    );
    expect(resolved).not.toBeNull();
    expect(resolved?.id).toBe('j-mapped-1');
  });

  it('resolves bank journal embedded in statement transaction description', () => {
    const resolved = resolveBankJournal(
      {
        accountNumber: null,
        description: 'GIRO Átutalás jóváírás számlára: 10400126-50526780-68871003 Kolos Transport Kft.',
      },
      mockJournals,
      mockCompanyBankAccounts
    );
    expect(resolved).not.toBeNull();
    expect(resolved?.id).toBe('j-bank-kh-eur');
  });

  it('resolves bank journal using bank name keyword and currency', () => {
    const resolved = resolveBankJournal(
      {
        bankName: 'Revolut Bank',
        currency: 'USD',
        description: 'Revolut Business exchange USD',
      },
      mockJournals,
      mockCompanyBankAccounts
    );
    expect(resolved).not.toBeNull();
    expect(resolved?.id).toBe('j-bank-revolut-usd');
  });

  it('falls back gracefully to matching currency when account number is not provided', () => {
    const resolved = resolveBankJournal(
      { currency: 'EUR', description: 'Ismeretlen jóváírás' },
      mockJournals,
      mockCompanyBankAccounts
    );
    expect(resolved).not.toBeNull();
    expect(resolved?.id).toBe('j-bank-kh-eur');
  });
});
