/**
 * Bank Journal Resolver service (EB-0257).
 * Matches bank statements / transactions to the correct bank journal (acc_journals)
 * based on bank account number, company bank accounts, currency, and bank name.
 */

export interface BankMatchCriteria {
  accountNumber?: string | null;
  currency?: string | null;
  bankName?: string | null;
  description?: string | null;
}

export interface BankJournalEntity {
  id: string;
  code: string;
  name: string;
  type?: string | null;
  currency?: string | null;
  bank_account_number?: string | null;
  connected_gl_account?: string | null;
  is_system_locked?: boolean | null;
}

export interface CompanyBankAccountEntity {
  id: string;
  bank_name?: string | null;
  account_number: string;
  currency?: string | null;
  journal_id?: string | null;
  gl_account_id?: string | null;
}

/**
 * Sanitizes a bank account number by stripping dashes, spaces, dots, and converting to lowercase.
 */
export function sanitizeAccountNumber(accountNum?: string | null): string {
  if (!accountNum) return '';
  return accountNum.replace(/[-\s./]/g, '').trim().toLowerCase();
}

/**
 * Resolves the matching bank journal given transaction/statement details.
 */
export function resolveBankJournal(
  criteria: BankMatchCriteria,
  journals: BankJournalEntity[],
  companyBankAccounts: CompanyBankAccountEntity[] = []
): BankJournalEntity | null {
  const bankJournals = journals.filter(j => j.type === 'BANK' || j.code.startsWith('B') || (j.code.length === 3 && j.code.startsWith('2')));
  if (bankJournals.length === 0) return null;

  const targetAccSanitized = sanitizeAccountNumber(criteria.accountNumber);
  const targetCurrency = (criteria.currency || 'HUF').toUpperCase();
  const descLower = (criteria.description || '').toLowerCase();
  const descSanitized = descLower.replace(/[-\s./]/g, '');

  // 1. Direct match on acc_journals.bank_account_number
  if (targetAccSanitized) {
    const directMatch = bankJournals.find(j => {
      const jSanitized = sanitizeAccountNumber(j.bank_account_number);
      return jSanitized && (jSanitized === targetAccSanitized || jSanitized.includes(targetAccSanitized) || targetAccSanitized.includes(jSanitized));
    });
    if (directMatch) return directMatch;
  }

  // 2. Match via company_bank_accounts linked to journal_id
  if (targetAccSanitized && companyBankAccounts.length > 0) {
    const matchedCba = companyBankAccounts.find(cba => {
      const cbaSanitized = sanitizeAccountNumber(cba.account_number);
      return cbaSanitized && (cbaSanitized === targetAccSanitized || cbaSanitized.includes(targetAccSanitized) || targetAccSanitized.includes(cbaSanitized));
    });
    if (matchedCba?.journal_id) {
      const j = bankJournals.find(bj => bj.id === matchedCba.journal_id);
      if (j) return j;
    }
  }

  // 3. Search account numbers embedded inside the statement description / transaction text
  if (descSanitized) {
    const descMatch = bankJournals.find(j => {
      const jSanitized = sanitizeAccountNumber(j.bank_account_number);
      return jSanitized && jSanitized.length >= 8 && descSanitized.includes(jSanitized);
    });
    if (descMatch) return descMatch;

    const cbaDescMatch = companyBankAccounts.find(cba => {
      const cbaSanitized = sanitizeAccountNumber(cba.account_number);
      return cbaSanitized && cbaSanitized.length >= 8 && descSanitized.includes(cbaSanitized);
    });
    if (cbaDescMatch?.journal_id) {
      const j = bankJournals.find(bj => bj.id === cbaDescMatch.journal_id);
      if (j) return j;
    }
  }

  // 4. Currency + Bank Name matching keywords
  const bankKeywords = ['otp', 'kh', 'k&h', 'erste', 'revolut', 'cib', 'raiffeisen', 'mbh', 'unicredit', 'binx', 'wise', 'oberbank', 'paypal'];
  const searchBankName = (criteria.bankName || '').toLowerCase();

  const keywordMatch = bankJournals.find(j => {
    if (j.currency && j.currency.toUpperCase() !== targetCurrency) return false;
    const jNameLower = (j.name || '').toLowerCase();
    const jCodeLower = (j.code || '').toLowerCase();

    return bankKeywords.some(kw => {
      const matchesSearch = searchBankName.includes(kw) || descLower.includes(kw) || (kw === 'kh' && descLower.includes('k&h'));
      const matchesJournal = jNameLower.includes(kw) || jCodeLower.includes(kw) || (kw === 'kh' && jNameLower.includes('k&h'));
      return matchesSearch && matchesJournal;
    });
  });
  if (keywordMatch) return keywordMatch;

  // 5. Match bank journal by matching currency
  const currencyMatch = bankJournals.find(j => (j.currency || 'HUF').toUpperCase() === targetCurrency);
  if (currencyMatch) return currencyMatch;

  // 6. Default to first bank journal or B1 / 201
  const defaultBank = bankJournals.find(j => j.code === 'B1' || j.code === '201') || bankJournals[0];
  return defaultBank || null;
}
