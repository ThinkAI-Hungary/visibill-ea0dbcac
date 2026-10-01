import {
  checkGlAccountCurrencyMatch,
  checkJournalCurrencyMatch,
  filterBankJournalsForAdd,
  filterBankJournalsForEdit,
} from '../BankAccountsTab';

describe('BankAccountsTab - Currency Match & Safeguards (Blind Spot 1)', () => {
  describe('checkGlAccountCurrencyMatch', () => {
    it('approves matching HUF bank account with 384* GL accounts', () => {
      expect(checkGlAccountCurrencyMatch('384', 'HUF').isMatch).toBe(true);
      expect(checkGlAccountCurrencyMatch('3841', 'HUF').isMatch).toBe(true);
      expect(checkGlAccountCurrencyMatch('384.10', 'HUF').isMatch).toBe(true);
      expect(checkGlAccountCurrencyMatch('3842', undefined).isMatch).toBe(true);
    });

    it('warns when a HUF bank account is paired with a deviza (386*) or valuta (382*) GL account', () => {
      const res386 = checkGlAccountCurrencyMatch('3861', 'HUF');
      expect(res386.isMatch).toBe(false);
      expect(res386.warning).toContain('384-es elszámolási számla ajánlott');

      const res382 = checkGlAccountCurrencyMatch('3821', 'HUF');
      expect(res382.isMatch).toBe(false);
      expect(res382.warning).toContain('devizaszámla / valuta számla');
    });

    it('approves matching foreign currency bank accounts (EUR, USD, GBP, CHF) with 386* GL accounts', () => {
      expect(checkGlAccountCurrencyMatch('3861', 'EUR').isMatch).toBe(true);
      expect(checkGlAccountCurrencyMatch('3862', 'USD').isMatch).toBe(true);
      expect(checkGlAccountCurrencyMatch('386.01', 'GBP').isMatch).toBe(true);
      expect(checkGlAccountCurrencyMatch('386', 'CHF').isMatch).toBe(true);
    });

    it('warns when a foreign currency bank account is paired with a HUF (384*) GL account', () => {
      const resEur = checkGlAccountCurrencyMatch('3841', 'EUR');
      expect(resEur.isMatch).toBe(false);
      expect(resEur.warning).toContain('EUR devizanemű');
      expect(resEur.warning).toContain('386-os devizaszámla ajánlott');

      const resUsd = checkGlAccountCurrencyMatch('3842', 'USD');
      expect(resUsd.isMatch).toBe(false);
      expect(resUsd.warning).toContain('USD devizanemű');
    });

    it('handles null or empty GL numbers gracefully', () => {
      expect(checkGlAccountCurrencyMatch(null, 'HUF').isMatch).toBe(true);
      expect(checkGlAccountCurrencyMatch(undefined, 'EUR').isMatch).toBe(true);
      expect(checkGlAccountCurrencyMatch('', 'HUF').isMatch).toBe(true);
    });

    it('enforces database dedicated currency matching when configured in gl_accounts', () => {
      // Direct DB match
      expect(checkGlAccountCurrencyMatch('3861', 'EUR', 'EUR', true).isMatch).toBe(true);
      expect(checkGlAccountCurrencyMatch('3841', 'HUF', 'HUF', false).isMatch).toBe(true);

      // Dedicated currency mismatch
      const mismatch = checkGlAccountCurrencyMatch('3861', 'EUR', 'USD', true);
      expect(mismatch.isMatch).toBe(false);
      expect(mismatch.warning).toContain('eltér a főkönyvi szám dedikált devizanemétől');

      // Non-multicurrency GL account paired with foreign bank account
      const notMulti = checkGlAccountCurrencyMatch('3899', 'EUR', null, false);
      expect(notMulti.isMatch).toBe(false);
      expect(notMulti.warning).toContain('kizárólag forintos tételek könyvelésére van beállítva');
    });
  });

  describe('checkJournalCurrencyMatch', () => {
    it('approves when journal has identical currency', () => {
      expect(checkJournalCurrencyMatch('HUF', 'HUF').isMatch).toBe(true);
      expect(checkJournalCurrencyMatch('EUR', 'EUR').isMatch).toBe(true);
      expect(checkJournalCurrencyMatch('USD', 'USD').isMatch).toBe(true);
    });

    it('approves when journal has no specific currency defined (universal journal)', () => {
      expect(checkJournalCurrencyMatch(null, 'HUF').isMatch).toBe(true);
      expect(checkJournalCurrencyMatch(undefined, 'EUR').isMatch).toBe(true);
      expect(checkJournalCurrencyMatch('', 'USD').isMatch).toBe(true);
    });

    it('warns when journal currency differs from bank account currency', () => {
      const resHufEur = checkJournalCurrencyMatch('HUF', 'EUR');
      expect(resHufEur.isMatch).toBe(false);
      expect(resHufEur.warning).toContain('HUF');
      expect(resHufEur.warning).toContain('EUR');

      const resEurHuf = checkJournalCurrencyMatch('EUR', 'HUF');
      expect(resEurHuf.isMatch).toBe(false);
      expect(resEurHuf.warning).toContain('EUR');
      expect(resEurHuf.warning).toContain('HUF');
    });
  });

  describe('filterBankJournalsForAdd and filterBankJournalsForEdit (Inactive Journal Handling)', () => {
    const sampleJournals = [
      { id: 'j1', code: 'B1', name: 'K&H HUF', currency: 'HUF', is_active: true },
      { id: 'j2', code: 'B2', name: 'K&H EUR', currency: 'EUR', is_active: true },
      { id: 'j3', code: 'B3', name: 'Régi OTP HUF', currency: 'HUF', is_active: false },
      { id: 'j4', code: 'B4', name: 'Megszűnt VÚB EUR', currency: 'EUR', is_active: false },
    ];

    it('filterBankJournalsForAdd excludes all inactive journals', () => {
      const result = filterBankJournalsForAdd(sampleJournals, 'HUF');
      expect(result.map(j => j.code)).toEqual(['B1', 'B2']);
      expect(result.some(j => j.is_active === false)).toBe(false);
    });

    it('filterBankJournalsForEdit includes the currently assigned inactive journal but excludes other inactive ones', () => {
      // Editing an account currently linked to j3 (inactive B3)
      const result = filterBankJournalsForEdit(sampleJournals, 'j3', 'HUF');
      const codes = result.map(j => j.code);

      // Should include B1, B2 (active) and B3 (current inactive), but NOT B4 (other inactive)
      expect(codes).toContain('B1');
      expect(codes).toContain('B2');
      expect(codes).toContain('B3');
      expect(codes).not.toContain('B4');

      // Active journals should appear before inactive ones
      const b3Index = codes.indexOf('B3');
      expect(b3Index).toBe(codes.length - 1); // B3 is last because it is inactive
    });

    it('filterBankJournalsForEdit excludes all inactive journals when current account has no journal assigned', () => {
      const result = filterBankJournalsForEdit(sampleJournals, null, 'HUF');
      expect(result.map(j => j.code)).toEqual(['B1', 'B2']);
    });
  });
});
