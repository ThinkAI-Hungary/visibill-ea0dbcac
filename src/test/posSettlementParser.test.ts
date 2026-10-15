import { describe, it, expect } from 'vitest';
import {
  isOtpPosSettlementText,
  parseOtpPosLines,
  generateVirtualBankTransactions,
  cleanPosAmount,
  formatPosDate,
} from '@/features/transactions/services/posSettlementParser';

describe('posSettlementParser', () => {
  it('cleanPosAmount parses spaces and formatted numbers', () => {
    expect(cleanPosAmount('273 650')).toBe(273650);
    expect(cleanPosAmount('4 926')).toBe(4926);
    expect(cleanPosAmount('0')).toBe(0);
    expect(cleanPosAmount('-15 000')).toBe(-15000);
  });

  it('formatPosDate converts dot formatted dates to dashes', () => {
    expect(formatPosDate('2026.07.17')).toBe('2026-07-17');
    expect(formatPosDate('2026.08.31.')).toBe('2026-08-31');
  });

  it('isOtpPosSettlementText identifies AMEX and Standard POS', () => {
    const amexSample = 'OTP Bank Nyrt. AMEX ELFOGADÓI TÉTELES ELSZÁMOLÓ LISTA Kereskedõ kód: 29476';
    const posSample = 'OTP Bank Nyrt. ELFOGADÓI TÉTELES ELSZÁMOLÓ LISTA Kereskedő kód: 29476';
    const regularBank = 'OTP Bank Nyrt. Bankszámlakivonat Számlavezető fiók: 1010';

    expect(isOtpPosSettlementText(amexSample)).toBe(true);
    expect(isOtpPosSettlementText(posSample)).toBe(true);
    expect(isOtpPosSettlementText(regularBank)).toBe(false);
  });

  it('parses AMEX settlement list and generates balanced 3-legged virtual bank transactions', () => {
    const lines: string[][] = [
      ['OTP Bank Nyrt.', 'Feldolgozás dátuma: 2026.07.20', 'Készült: 2026.07.20 09:42:29', 'Kereskedõ kód: 29476'],
      ['AMEX ELFOGADÓI TÉTELES ELSZÁMOLÓ LISTA'],
      ['Számlaszám: HU2810104105-14684500-08001001', 'Elszámolás devizaneme: HUF', 'Elszámolási idõszak: 2026.07.14 - 2026.07.20'],
      ['Üzlet neve: JANKOVICH HOTEL', 'POS azonosító: 00037219'],
      ['2026.07.17', '2607180000278815', '4F', '866494', '375699*2009', '273 650', '4 926', '268 724'],
      ['Term össz: 1 db 273 650 4 926 268 724'],
    ];

    const summary = parseOtpPosLines(lines);

    expect(summary.isAmex).toBe(true);
    expect(summary.merchantCode).toBe('29476');
    expect(summary.accountNumber).toBe('HU2810104105-14684500-08001001');
    expect(summary.periodFrom).toBe('2026-07-14');
    expect(summary.periodTo).toBe('2026-07-20');
    expect(summary.processingDate).toBe('2026-07-20');
    expect(summary.posTerminalId).toBe('00037219');
    expect(summary.storeName).toBe('JANKOVICH HOTEL');
    expect(summary.itemCount).toBe(1);
    expect(summary.totalGross).toBe(273650);
    expect(summary.totalFee).toBe(4926);
    expect(summary.totalNet).toBe(268724);

    const txs = generateVirtualBankTransactions(summary);
    expect(txs.length).toBe(3);

    // 1. Gross Inflow
    const grossTx = txs.find(t => t.leg_type === 'GROSS_INFLOW')!;
    expect(grossTx.amount).toBe(273650);
    expect(grossTx.transaction_date).toBe('2026-07-17');
    expect(grossTx.bank_name).toBe('OTP AMEX');
    expect(grossTx.account_number).toBe('POS-00037219');
    expect(grossTx.description).toContain('866494');

    // 2. Fee Outflow
    const feeTx = txs.find(t => t.leg_type === 'FEE_OUTFLOW')!;
    expect(feeTx.amount).toBe(-4926);
    expect(feeTx.transaction_date).toBe('2026-07-20');
    expect(feeTx.type).toBe('banki költség');

    // 3. Transfer Outflow
    const trfTx = txs.find(t => t.leg_type === 'NET_TRANSFER_OUTFLOW')!;
    expect(trfTx.amount).toBe(-268724);
    expect(trfTx.transaction_date).toBe('2026-07-20');
    expect(trfTx.type).toBe('átvezetés');

    // Net balance in virtual bank must be exactly 0 (Self-clearing!)
    const totalBalanceChange = txs.reduce((sum, t) => sum + t.amount, 0);
    expect(totalBalanceChange).toBe(0);
  });

  it('parses multi-item Standard OTP POS settlement with exact self-clearing balance', () => {
    const lines: string[][] = [
      ['OTP Bank Nyrt.', 'Feldolgozás dátuma: 2026.08.31', 'Kereskedõ kód: 29476'],
      ['ELFOGADÓI TÉTELES ELSZÁMOLÓ LISTA'],
      ['Számlaszám: HU2810104105-14684500-08001001', 'Elszámolás devizaneme: HUF', 'Elszámolási idõszak: 2026.08.25 - 2026.08.31'],
      ['Üzlet neve: JANKOVICH HOTEL', 'POS azonosító: 00037219'],
      ['2026.08.24', '2608250000527560', '20', '434271', '544537*8764', '50 500', '0', '0', '808', '808', '49 692'],
      ['2026.08.24', '2608250003846693', '39', '054445', '481690*9898', '386 802', '0', '0', '3 868', '3 868', '382 934'],
    ];

    const summary = parseOtpPosLines(lines);
    expect(summary.isAmex).toBe(false);
    expect(summary.itemCount).toBe(2);
    expect(summary.totalGross).toBe(50500 + 386802);
    expect(summary.totalFee).toBe(808 + 3868);
    expect(summary.totalNet).toBe(49692 + 382934);

    const txs = generateVirtualBankTransactions(summary);
    // 2 gross items + 1 fee outflow + 1 net transfer outflow = 4 transactions
    expect(txs.length).toBe(4);

    const totalBalanceChange = txs.reduce((sum, t) => sum + t.amount, 0);
    expect(totalBalanceChange).toBe(0);
  });
});
