import { describe, it, expect } from 'vitest';
import {
  buildRlbGlData,
  cleanAccountNumber,
  compareRlbAccounts,
  calculateAccountBalance,
  type RlbAccountInput,
  type RlbPartnerItemInput,
} from '../rlbGlData';

describe('RLB-60 Főkönyvi Kivonat Data Model & Aggregator', () => {
  const sampleAccounts: RlbAccountInput[] = [
    // 1. Befektetett eszközök
    { id: '1311', name: 'Termelő gépek', debitTurnover: 1000000, creditTurnover: 0 },
    { id: '139', name: 'Műszaki berendezések terv szerinti écs', debitTurnover: 0, creditTurnover: 200000 },

    // 3. Követelések (Vevők)
    { id: '311', name: 'Belföldi vevő követelések forintban', debitTurnover: 850000, creditTurnover: 0 },
    { id: '3844', name: 'OTP Bank Folyószámla', debitTurnover: 8000000, creditTurnover: 4500000 },

    // 4. Források (Szállítók & Tőke)
    { id: '411', name: 'Jegyzett tőke', debitTurnover: 0, creditTurnover: 3000000 },
    { id: '4541', name: 'Belföldi anyag és áruszállítók', debitTurnover: 1200000, creditTurnover: 2000000 },

    // 5. Költségek
    { id: '511', name: 'Vásárolt anyagok költségei', debitTurnover: 1500000, creditTurnover: 0 },
    { id: '521', name: 'Szállítás-rakodás költségei', debitTurnover: 500000, creditTurnover: 0 },

    // 9. Árbevétel
    { id: '911', name: 'Alaptevékenység árbevétele', debitTurnover: 0, creditTurnover: 3350000 },
  ];

  it('1. Tisztítja a számlaszámokat és helyesen rendezi a hierarchiát', () => {
    expect(cleanAccountNumber(' 454.1 ')).toBe('4541');
    expect(cleanAccountNumber('311-01')).toBe('31101');

    const accounts = ['4541', '1', '13', '311', '1311', '139', '4'];
    const sorted = accounts.sort(compareRlbAccounts);
    expect(sorted).toEqual(['1', '13', '1311', '139', '311', '4', '4541']);
  });

  it('2. Helyesen számítja az egyenlegeket eszköz, forrás, költség és bevétel számlákra', () => {
    // Eszköz (3-as): T: 100, K: 40 => Egyenleg T: 60, K: 0
    const assetBal = calculateAccountBalance('311', 100, 40);
    expect(assetBal.balanceDebit).toBe(60);
    expect(assetBal.balanceCredit).toBe(0);

    // Forrás (4-es): T: 20, K: 100 => Egyenleg T: 0, K: 80
    const liabilityBal = calculateAccountBalance('4541', 20, 100);
    expect(liabilityBal.balanceDebit).toBe(0);
    expect(liabilityBal.balanceCredit).toBe(80);

    // Költség (5-ös): T: 150, K: 0 => Egyenleg T: 150, K: 0
    const costBal = calculateAccountBalance('511', 150, 0);
    expect(costBal.balanceDebit).toBe(150);
    expect(costBal.balanceCredit).toBe(0);

    // Bevétel (9-es): T: 0, K: 300 => Egyenleg T: 0, K: 300
    const revBal = calculateAccountBalance('911', 0, 300);
    expect(revBal.balanceDebit).toBe(0);
    expect(revBal.balanceCredit).toBe(300);
  });

  it('3. Alap (Basic) sablon felépítése hierarchiával és mérlegegyezőséggel', () => {
    const data = buildRlbGlData(sampleAccounts, {
      companyName: 'Medixwell Kft.',
      taxNumber: '24383691-2-06',
      dateFrom: '2025-01-01',
      dateTo: '2025-12-31',
      mode: 'basic',
    });

    expect(data.companyName).toBe('Medixwell Kft.');
    expect(data.formattedPeriod).toBe('Időszak: 2025.01.01-2025.12.31');
    expect(data.mode).toBe('basic');

    // Nincsenek partner szintű sorok Alap módban
    const partnerRows = data.rows.filter(r => r.isPartner);
    expect(partnerRows.length).toBe(0);

    // Ellenőrizzük az 1-es számlaosztály aggregált adatait
    const rowClass1 = data.rows.find(r => r.accountNumber === '1');
    expect(rowClass1).toBeDefined();
    expect(rowClass1?.turnoverDebit).toBe(1000000);
    expect(rowClass1?.turnoverCredit).toBe(200000);
    expect(rowClass1?.balanceDebit).toBe(800000);

    // Ellenőrizzük az 1-4 vs 5-9 záró összesítést
    expect(data.classSummary.classes1to4.turnoverDebit).toBe(1000000 + 850000 + 8000000 + 1200000);
    expect(data.classSummary.classes1to4.turnoverCredit).toBe(200000 + 4500000 + 3000000 + 2000000);

    // Mindösszesen egyezőség
    expect(data.classSummary.grandTotal.turnoverDebit).toBe(data.classSummary.grandTotal.turnoverCredit);
    expect(data.classSummary.grandTotal.isBalanced).toBe(true);
  });

  it('4. Bővített (Extended) sablon partner-analitikával a 311 és 4541 alatt', () => {
    const partnerItems: RlbPartnerItemInput[] = [
      {
        glAccountNumber: '311',
        partnerName: 'PMEX KFT',
        partnerTaxNumber: '11111111-2-11',
        debitAmount: 850000,
        creditAmount: 0,
      },
      {
        glAccountNumber: '4541',
        partnerName: 'MAGYAR TELEKOM NYRT.',
        partnerTaxNumber: '22222222-2-22',
        debitAmount: 500000,
        creditAmount: 1200000,
      },
      {
        glAccountNumber: '4541',
        partnerName: 'GLS HUNGARY KFT.',
        partnerTaxNumber: '33333333-2-33',
        debitAmount: 700000,
        creditAmount: 800000,
      },
    ];

    const data = buildRlbGlData(sampleAccounts, {
      companyName: 'Medixwell Kft.',
      mode: 'extended',
      partnerItems,
    });

    expect(data.mode).toBe('extended');

    // Partner sorok léteznek
    const partnerRows = data.rows.filter(r => r.isPartner);
    expect(partnerRows.length).toBe(3);

    // 311 partner ellenőrzése
    const pmexRow = partnerRows.find(r => r.accountName === 'PMEX KFT');
    expect(pmexRow).toBeDefined();
    expect(pmexRow?.accountNumber).toBe('3110000001');
    expect(pmexRow?.turnoverDebit).toBe(850000);
    expect(pmexRow?.turnoverCredit).toBe(0);
    expect(pmexRow?.balanceDebit).toBe(850000);

    // 4541 partnerek ellenőrzése
    const telekomRow = partnerRows.find(r => r.accountName === 'MAGYAR TELEKOM NYRT.');
    expect(telekomRow).toBeDefined();
    expect(telekomRow?.accountNumber).toMatch(/^4541000000[12]$/);
    expect(telekomRow?.turnoverDebit).toBe(500000);
    expect(telekomRow?.turnoverCredit).toBe(1200000);
    expect(telekomRow?.balanceCredit).toBe(700000);
  });

  it('5. 0-ás sorok szűrése (excludeZeroRows)', () => {
    const accountsWithZero = [
      ...sampleAccounts,
      { id: '3841', name: 'K&H Bank (üres)', debitTurnover: 0, creditTurnover: 0 },
    ];

    const dataWithZero = buildRlbGlData(accountsWithZero, { excludeZeroRows: false });
    expect(dataWithZero.rows.some(r => r.accountNumber === '3841')).toBe(true);

    const dataWithoutZero = buildRlbGlData(accountsWithZero, { excludeZeroRows: true });
    expect(dataWithoutZero.rows.some(r => r.accountNumber === '3841')).toBe(false);
  });
});
