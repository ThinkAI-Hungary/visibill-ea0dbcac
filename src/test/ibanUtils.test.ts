import { describe, it, expect } from 'vitest';
import {
  detectAccountFormat,
  normalizeAccountNumber,
  validateGiro,
  validateIban,
  validateAccountNumber,
  formatIban,
  formatGiro,
  formatAccountOnType,
  detectBankFromAccountNumber,
  giroToIban,
  ibanToGiro,
} from '@/lib/ibanUtils';

describe('ibanUtils', () => {
  // Valid Hungarian 24-digit account with correct CDV
  // OTP (117) routing: 11773016 -> 1*9 + 1*7 + 7*3 + 7*1 + 3*9 + 0*7 + 1*3 + 6*1 = 9+7+21+7+27+0+3+6 = 80 % 10 = 0 (valid)
  // Account 1: 00000000 -> 0 (valid)
  // Account 2: 00000000 -> 0 (valid)
  const validGiro24 = '11773016-00000000-00000000';
  const validGiro16 = '11773016-00000000';

  describe('detectAccountFormat', () => {
    it('felismeri a belföldi számlaszámot', () => {
      expect(detectAccountFormat('11773016-00000000-00000000')).toBe('giro');
      expect(detectAccountFormat('1177301600000000')).toBe('giro');
    });

    it('felismeri a nemzetközi és magyar IBAN formátumot', () => {
      expect(detectAccountFormat('HU42 1177 3016 0000 0000 0000 0000')).toBe('iban');
      expect(detectAccountFormat('LT35 3500 0100 0123 4567')).toBe('iban');
      expect(detectAccountFormat('DE89 3704 0044 0532 0130 00')).toBe('iban');
    });

    it('üres vagy érvénytelen bemenetnél unknown-t ad', () => {
      expect(detectAccountFormat('')).toBe('unknown');
      expect(detectAccountFormat('   ')).toBe('unknown');
      expect(detectAccountFormat(null)).toBe('unknown');
    });
  });

  describe('normalizeAccountNumber', () => {
    it('eltávolítja a szóközöket és kötőjeleket, nagybetűsíti a szöveget', () => {
      expect(normalizeAccountNumber(' hu42 1177-3016-0000 ')).toBe('HU42117730160000');
      expect(normalizeAccountNumber('11773016-00000000-00000000')).toBe('117730160000000000000000');
    });
  });

  describe('validateGiro', () => {
    it('érvényesnek minősíti a helyes 16 és 24 jegyű magyar számlát', () => {
      expect(validateGiro(validGiro24).valid).toBe(true);
      expect(validateGiro(validGiro16).valid).toBe(true);
    });

    it('hibát dob rossz hosszúságra', () => {
      const res = validateGiro('11773016');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('16 vagy 24');
    });

    it('hibát dob érvénytelen CDV ellenőrző kódra', () => {
      // Megváltoztatjuk az utolsó számjegyet
      const res = validateGiro('11773017-00000000-00000000');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('ellenőrzőösszeg hibás');
    });
  });

  describe('giroToIban és ibanToGiro', () => {
    it('helyesen konvertál belföldi számlaszámot HUxx IBAN-ra', () => {
      const iban = giroToIban(validGiro24);
      expect(iban.startsWith('HU')).toBe(true);
      expect(iban.length).toBe(28);

      // Az előállított IBAN Modulo 97 tesztje
      const check = validateIban(iban);
      expect(check.valid).toBe(true);
      expect(check.country).toBe('HU');
    });

    it('helyesen nyeri vissza a belföldi számlaszámot magyar IBAN-ból', () => {
      const iban = giroToIban(validGiro24);
      const giro = ibanToGiro(iban);
      expect(giro).toBe('11773016-00000000-00000000');

      // 16 jegyű preferencia
      const giro16 = ibanToGiro(iban, true);
      expect(giro16).toBe('11773016-00000000');
    });

    it('nem-magyar IBAN-ra null-t ad vissza az ibanToGiro', () => {
      expect(ibanToGiro('DE89370400440532013000')).toBeNull();
    });
  });

  describe('validateIban', () => {
    it('érvényesnek minősíti a helyes magyar IBAN-t', () => {
      const iban = giroToIban(validGiro24);
      const res = validateIban(iban);
      expect(res.valid).toBe(true);
      expect(res.country).toBe('HU');
    });

    it('érvényesnek minősíti a valós európai IBAN-okat', () => {
      // Hivatalos teszt IBAN-ok (Modulo 97 valid)
      // Németország (22 char): DE89 3704 0044 0532 0130 00 -> 370400440532013000 + 1314 + 89
      expect(validateIban('DE89370400440532013000').valid).toBe(true);
      // Ausztria (20 char): AT61 1904 3002 3457 3201
      expect(validateIban('AT611904300234573201').valid).toBe(true);
    });

    it('hibát jelez rossz ellenőrző kódra', () => {
      const res = validateIban('DE89370400440532013001'); // Hibás utolsó jegy
      expect(res.valid).toBe(false);
      expect(res.error).toContain('ellenőrző kód nem egyezik');
    });

    it('hibát jelez hibás országos hosszúságra', () => {
      // Németországi IBAN-nak 22 karakternek kell lennie
      const res = validateIban('DE8937040044053201');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('pontosan 22 karakter');
    });
  });

  describe('detectBankFromAccountNumber', () => {
    it('felismeri a magyar bankokat belföldi számlából', () => {
      expect(detectBankFromAccountNumber('11773016-00000000')?.bankName).toBe('OTP Bank');
      expect(detectBankFromAccountNumber('11600006-00000000')?.bankName).toBe('Erste Bank');
      expect(detectBankFromAccountNumber('10400123-00000000')?.bankName).toBe('K&H Bank');
      expect(detectBankFromAccountNumber('12000000-00000000')?.bankName).toBe('Raiffeisen Bank');
      expect(detectBankFromAccountNumber('50400012-00000000')?.bankName).toBe('MBH Bank');
    });

    it('felismeri a magyar bankokat magyar IBAN-ból', () => {
      const otpIban = giroToIban('11773016-00000000-00000000');
      expect(detectBankFromAccountNumber(otpIban)?.bankName).toBe('OTP Bank');
    });

    it('felismeri a nemzetközi és fintech bankokat IBAN alapján', () => {
      // Revolut (Litvánia - 35000)
      expect(detectBankFromAccountNumber('LT353500010001234567')?.bankName).toBe('Revolut Bank');
      // Wise (Belgium - 967)
      expect(detectBankFromAccountNumber('BE00967000000000')?.bankName).toBe('Wise (TransferWise)');
      // N26 (Németország - 10011001)
      expect(detectBankFromAccountNumber('DE00100110010000000000')?.bankName).toBe('N26 Bank');
      // Bunq (Hollandia - BUNQ)
      expect(detectBankFromAccountNumber('NL00BUNQ0000000000')?.bankName).toBe('Bunq');
      // Deutsche Bank (Németország - 50070010)
      expect(detectBankFromAccountNumber('DE00500700100000000000')?.bankName).toBe('Deutsche Bank');
      // Erste Bank Österreich (Ausztria - 20111)
      expect(detectBankFromAccountNumber('AT002011100000000000')?.bankName).toBe('Erste Bank Österreich');
      // VÚB Banka (Szlovákia - 0200)
      expect(detectBankFromAccountNumber('SK0002000000000000000000')?.bankName).toBe('VÚB Banka');
      // Banca Transilvania (Románia - BTRL)
      expect(detectBankFromAccountNumber('RO00BTRL0000000000000000')?.bankName).toBe('Banca Transilvania');
    });

    it('ismeretlen külföldi IBAN esetén országos javaslatot ad', () => {
      const res = detectBankFromAccountNumber('FR1420041010050500013M02606');
      expect(res?.bankName).toContain('Franciaország');
      expect(res?.country).toBe('FR');
      expect(res?.isKnown).toBe(false);
    });
  });

  describe('formatAccountOnType', () => {
    it('számmal indulva GIRO kötőjelezést végez', () => {
      expect(formatAccountOnType('11773016')).toBe('11773016');
      expect(formatAccountOnType('1177301600000000')).toBe('11773016-00000000');
      expect(formatAccountOnType('117730160000000000000000')).toBe('11773016-00000000-00000000');
    });

    it('betűvel indulva IBAN 4-es blokkokat képez', () => {
      expect(formatAccountOnType('hu4211773016')).toBe('HU42 1177 3016');
      expect(formatAccountOnType('LT353500010001234567')).toBe('LT35 3500 0100 0123 4567');
    });
  });

  describe('validateAccountNumber', () => {
    it('átfogó validáció mindkét típusra sikeres valós adatokkal', () => {
      const giroRes = validateAccountNumber(validGiro24);
      expect(giroRes.valid).toBe(true);
      expect(giroRes.type).toBe('giro');
      expect(giroRes.bankName).toBe('OTP Bank');

      const ibanRes = validateAccountNumber(giroToIban(validGiro24));
      expect(ibanRes.valid).toBe(true);
      expect(ibanRes.type).toBe('iban');
      expect(ibanRes.bankName).toBe('OTP Bank');
    });
  });
});
