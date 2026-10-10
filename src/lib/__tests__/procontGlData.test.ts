import { describe, it, expect } from 'vitest';
import {
  buildProcontGlData,
  cleanAccountNumber,
  getAccountLevel,
  formatProcontPeriod,
  type ProcontAccountInput,
} from '../procontGlData';

describe('PROCONT Főkönyvi Kivonat Adatmodell & Egyezőség-számítás', () => {
  // Benchmark test data taken directly from tests/docs/eb0148/PRCNT FŐKÖNYV.pdf (PROCONT KFT 2026.01.01 - 2026.09.30)
  const procontSampleLeaves: ProcontAccountInput[] = [
    // Class 1
    { id: '1610', name: 'Befejezetlen beruházások', debitTurnover: 624399, creditTurnover: 0 },
    // Class 3
    { id: '3110', name: 'Belföldi követelések (forintban)', debitTurnover: 28445800, creditTurnover: 23369950 },
    { id: '3540', name: 'Egyéb adott előlegek', debitTurnover: 1050000, creditTurnover: 0 },
    { id: '3810', name: 'Pénztár', debitTurnover: 8179900, creditTurnover: 7819836 },
    { id: '3840', name: 'Elszámolási betétszámla', debitTurnover: 31806581, creditTurnover: 29605379 },
    { id: '3890', name: 'Átvezetési számla', debitTurnover: 0, creditTurnover: 3010000 },
    { id: '3891', name: 'Kompenzálás átvezetés', debitTurnover: 35000, creditTurnover: 35000 },
    { id: '3899', name: 'Átvezetési számla', debitTurnover: 0, creditTurnover: 90000 },
    // Class 4
    { id: '4510', name: 'Rövid lejáratú kölcsönök', debitTurnover: 0, creditTurnover: 350000 },
    { id: '4511', name: 'MERKANTIL BANK', debitTurnover: 672965, creditTurnover: 0 },
    { id: '4540', name: 'Belföldi szállítók', debitTurnover: 4320673, creditTurnover: 5029795 },
    { id: '4612', name: 'Kisvállalati adó', debitTurnover: 1838000, creditTurnover: 0 },
    { id: '4621', name: 'Személyi jövedelemadó elszámolása', debitTurnover: 3379880, creditTurnover: 2670475 },
    { id: '4661', name: 'Előzetesen felszámított ÁFA', debitTurnover: 885392, creditTurnover: 1536 },
    { id: '4671', name: 'Fizetendő általános forgalmi adó', debitTurnover: 135818, creditTurnover: 7784907 },
    { id: '4680', name: 'Általános forgalmi adó elszámolási sz.', debitTurnover: 5678000, creditTurnover: 0 },
    { id: '4692', name: 'Iparűzési adó elszámolási számla', debitTurnover: 481476, creditTurnover: 0 },
    { id: '4697', name: 'Gépjárműadó elszámolási számla', debitTurnover: 43500, creditTurnover: 0 },
    { id: '4710', name: 'Jövedelem elszámolási számla', debitTurnover: 21276565, creditTurnover: 18472949 },
    { id: '4721', name: 'Társadalombiztosítási járulék', debitTurnover: 3886120, creditTurnover: 3048117 },
    { id: '4728', name: 'Egyszer. folgalkozt (1000 Ft/nap)', debitTurnover: 74800, creditTurnover: 0 },
    { id: '4741', name: 'Késedelmi pótlék', debitTurnover: 12000, creditTurnover: 0 },
    { id: '4790', name: 'Különféle rövid lejáratú egyéb köt.', debitTurnover: 500000, creditTurnover: 0 },
    { id: '4910', name: 'Nyitómérleg számla', debitTurnover: 0, creditTurnover: 1014469 },
    // Class 5
    { id: '5110', name: 'Vásárolt anyagok költségei', debitTurnover: 590787, creditTurnover: 0 },
    { id: '5111', name: 'Egyéb anyagköltésg', debitTurnover: 24000, creditTurnover: 0 },
    { id: '5112', name: 'Nyomtatvány, irodaszer', debitTurnover: 145592, creditTurnover: 0 },
    { id: '5113', name: 'Üzemanyag', debitTurnover: 4124, creditTurnover: 0 },
    { id: '5120', name: 'Egy éven belül elhaszn.anyagi eszközök', debitTurnover: 94045, creditTurnover: 0 },
    { id: '5131', name: 'Rezsi költségek', debitTurnover: 311048, creditTurnover: 5689 },
    { id: '5220', name: 'Gép bérleti díj', debitTurnover: 72000, creditTurnover: 0 },
    { id: '5222', name: 'Ingatlanok bérleti és használati díja', debitTurnover: 1456644, creditTurnover: 0 },
    { id: '5229', name: 'Egyéb igénybe vett szolgáltatások költs.', debitTurnover: 1128553, creditTurnover: 0 },
    { id: '5240', name: 'Hirdetés, reklám, propaganda költségek', debitTurnover: 34801, creditTurnover: 0 },
    { id: '5292', name: 'Telefonköltség', debitTurnover: 66373, creditTurnover: 0 },
    { id: '5293', name: 'Internetköltség', debitTurnover: 66675, creditTurnover: 0 },
    { id: '5320', name: 'Pénzügyi, befektetési szolgáltatási díj', debitTurnover: 187746, creditTurnover: 0 },
    { id: '5330', name: 'Biztosítási díj', debitTurnover: 129589, creditTurnover: 0 },
    { id: '5410', name: 'Bérköltség', debitTurnover: 16536305, creditTurnover: 0 },
    { id: '5591', name: 'Egyéb személyi jellegű kifizetések', debitTurnover: 19603, creditTurnover: 0 },
    { id: '5621', name: 'Cafetéria szja', debitTurnover: 2384, creditTurnover: 0 },
    // Class 8
    { id: '8632', name: 'Szokásos mértékű bírságok, kamatok', debitTurnover: 50068, creditTurnover: 0 },
    { id: '8690', name: 'Különféle egyéb ráfordítások', debitTurnover: 35000, creditTurnover: 0 },
    { id: '8694', name: 'Le nem vonható Áfa', debitTurnover: 90850, creditTurnover: 0 },
    { id: '8722', name: 'Fizetendő kamatok és kamatjellegű ráf.', debitTurnover: 703534, creditTurnover: 0 },
    // Class 9
    { id: '9111', name: 'Belföldi értékesítés árbevétele átutalás', debitTurnover: 344843, creditTurnover: 22391939 },
    { id: '9112', name: 'Belföldi értékesítés árbevétele készpénz', debitTurnover: 158189, creditTurnover: 6440854 },
    { id: '9632', name: 'Kapott bírságok, kötbérek, fekbérek,kese', debitTurnover: 5069, creditTurnover: 0 },
    { id: '9670', name: 'Visszafizetési köt. nélkül kapott tám.', debitTurnover: 0, creditTurnover: 4014470 },
    { id: '9740', name: 'Egyéb kapott kamatok és kamat jell. bev', debitTurnover: 0, creditTurnover: 429323 },
    { id: '9790', name: 'Egyéb pénzügyi bevételek', debitTurnover: 0, creditTurnover: 3 },
  ];

  it('reproduces 100% of the Procont grand totals and reconciliation from the benchmark PDF', () => {
    const report = buildProcontGlData(procontSampleLeaves, {
      companyName: 'PROCONT KFT',
      dateFrom: '2026-01-01',
      dateTo: '2026-09-30',
    });

    // 1. Grand totals (ÖSSZESEN)
    expect(report.totals.turnoverDebit).toBe(135584691);
    expect(report.totals.turnoverCredit).toBe(135584691);
    expect(report.totals.balanceDebit).toBe(32768488);
    expect(report.totals.balanceCredit).toBe(32768488);

    // 2. Reconciliation: 1-4 számlaosztályok
    expect(report.reconciliation.classes1to4.turnoverDebit).toBe(113326869);
    expect(report.reconciliation.classes1to4.turnoverCredit).toBe(102302413);
    expect(report.reconciliation.classes1to4.balanceDebit).toBe(11024456);
    expect(report.reconciliation.classes1to4.balanceCredit).toBe(0);

    // 3. Reconciliation: 5-9 számlaosztályok
    expect(report.reconciliation.classes5to9.turnoverDebit).toBe(22257822);
    expect(report.reconciliation.classes5to9.turnoverCredit).toBe(33282278);
    expect(report.reconciliation.classes5to9.balanceDebit).toBe(0);
    expect(report.reconciliation.classes5to9.balanceCredit).toBe(11024456);

    // 4. Mathematical integrity proof
    expect(report.reconciliation.netDiff).toBe(0);
    expect(report.reconciliation.isBalanced).toBe(true);
  });

  it('correctly aggregates group 38 (Pénzeszközök) and class 3', () => {
    const report = buildProcontGlData(procontSampleLeaves);
    
    // Group 38
    const group38 = report.rows.find(r => r.accountNumber === '38');
    expect(group38).toBeDefined();
    expect(group38?.turnoverDebit).toBe(40021481);
    expect(group38?.turnoverCredit).toBe(40560215);
    expect(group38?.balanceDebit).toBe(0);
    expect(group38?.balanceCredit).toBe(538734);

    // Class 3
    const class3 = report.rows.find(r => r.accountNumber === '3');
    expect(class3).toBeDefined();
    expect(class3?.turnoverDebit).toBe(69517281);
    expect(class3?.turnoverCredit).toBe(63930165);
    expect(class3?.balanceDebit).toBe(5587116);
    expect(class3?.balanceCredit).toBe(0);
  });

  it('formats period strings correctly', () => {
    expect(formatProcontPeriod('2026-01-01', '2026-09-30')).toBe('2026.01.01. - 2026.09.30.');
    expect(formatProcontPeriod('2026-05-15')).toBe('2026.05.15.');
    expect(formatProcontPeriod()).toBe('');
  });

  it('determines account levels accurately', () => {
    expect(getAccountLevel('1')).toBe('class');
    expect(getAccountLevel('16')).toBe('group');
    expect(getAccountLevel('161')).toBe('subgroup');
    expect(getAccountLevel('1610')).toBe('leaf');
  });

  it('cleans account numbers properly', () => {
    expect(cleanAccountNumber('3110.')).toBe('3110');
    expect(cleanAccountNumber(' 454.0 ')).toBe('4540');
    expect(cleanAccountNumber(null as any)).toBe('');
  });

  it('filters out zero rows when excludeZeroRows is true', () => {
    const mixedAccounts: ProcontAccountInput[] = [
      { id: '1610', name: 'Aktív beruházás', debitTurnover: 1000, creditTurnover: 0 },
      { id: '1620', name: 'Inaktív beruházás', debitTurnover: 0, creditTurnover: 0 },
    ];

    const withZeros = buildProcontGlData(mixedAccounts, { excludeZeroRows: false });
    expect(withZeros.rows.some(r => r.accountNumber === '1620')).toBe(true);

    const withoutZeros = buildProcontGlData(mixedAccounts, { excludeZeroRows: true });
    expect(withoutZeros.rows.some(r => r.accountNumber === '1620')).toBe(false);
    expect(withoutZeros.rows.some(r => r.accountNumber === '1610')).toBe(true);
  });

  it('renders multi-page Procont PDF without crashing and calculates page count', async () => {
    const { generateProcontGlPdf } = await import('../procontGlPdf');
    const report = buildProcontGlData(procontSampleLeaves, {
      companyName: 'PROCONT KFT',
      dateFrom: '2026-01-01',
      dateTo: '2026-09-30',
    });

    const doc = generateProcontGlPdf(report);
    expect(doc).toBeDefined();
    const pageCount = (doc as any).internal.getNumberOfPages();
    expect(pageCount).toBeGreaterThanOrEqual(1);
  });
});
