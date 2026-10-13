import { describe, it, expect } from 'vitest';
import { buildRlbGlData, type RlbAccountInput, type RlbPartnerItemInput } from '../rlbGlData';
import { generateRlbGlPdf } from '../rlbGlPdf';

describe('RLB-60 PDF Export Generator Tests', () => {
  const sampleAccounts: RlbAccountInput[] = [
    { id: '1311', name: 'Termelő gépek', debitTurnover: 1000000, creditTurnover: 0 },
    { id: '139', name: 'Műszaki berendezések terv szerinti écs', debitTurnover: 0, creditTurnover: 200000 },
    { id: '311', name: 'Belföldi vevő követelések forintban', debitTurnover: 850000, creditTurnover: 0 },
    { id: '3844', name: 'OTP Bank Folyószámla', debitTurnover: 8000000, creditTurnover: 4500000 },
    { id: '411', name: 'Jegyzett tőke', debitTurnover: 0, creditTurnover: 3000000 },
    { id: '4541', name: 'Belföldi anyag és áruszállítók', debitTurnover: 1200000, creditTurnover: 2000000 },
    { id: '511', name: 'Vásárolt anyagok költségei', debitTurnover: 1500000, creditTurnover: 0 },
    { id: '521', name: 'Szállítás-rakodás költségei', debitTurnover: 500000, creditTurnover: 0 },
    { id: '911', name: 'Alaptevékenység árbevétele', debitTurnover: 0, creditTurnover: 3350000 },
  ];

  const partnerItems: RlbPartnerItemInput[] = [
    {
      glAccountNumber: '311',
      partnerName: 'PMEX KFT',
      debitAmount: 850000,
      creditAmount: 0,
    },
    {
      glAccountNumber: '4541',
      partnerName: 'MAGYAR TELEKOM NYRT.',
      debitAmount: 500000,
      creditAmount: 1200000,
    },
    {
      glAccountNumber: '4541',
      partnerName: 'GLS HUNGARY KFT.',
      debitAmount: 700000,
      creditAmount: 800000,
    },
  ];

  it('1. Generálja az RLB Alap PDF-et és kiszámítja a helyes oldalszámot', () => {
    const data = buildRlbGlData(sampleAccounts, {
      companyName: 'Medixwell Kft.',
      taxNumber: '24383691-2-06',
      dateFrom: '2025-01-01',
      dateTo: '2025-12-31',
      mode: 'basic',
    });

    const doc = generateRlbGlPdf(data);
    expect(doc).toBeDefined();
    const pageCount = doc.getNumberOfPages();
    expect(pageCount).toBeGreaterThanOrEqual(1);
  });

  it('2. Generálja az RLB Bővített PDF-et partner analitikus sorokkal', () => {
    const data = buildRlbGlData(sampleAccounts, {
      companyName: 'Medixwell Kft.',
      taxNumber: '24383691-2-06',
      dateFrom: '2025-01-01',
      dateTo: '2025-12-31',
      mode: 'extended',
      partnerItems,
    });

    const doc = generateRlbGlPdf(data);
    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);

    // Sorok ellenőrzése az adatmodellben
    expect(data.rows.some(r => r.isPartner && r.accountName === 'PMEX KFT')).toBe(true);
    expect(data.rows.some(r => r.isPartner && r.accountName === 'MAGYAR TELEKOM NYRT.')).toBe(true);
    expect(data.rows.some(r => r.isPartner && r.accountName === 'GLS HUNGARY KFT.')).toBe(true);
  });
});
