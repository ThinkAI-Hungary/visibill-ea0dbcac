import { describe, it, expect } from 'vitest';
import {
  buildAgoraGlData,
  formatAgoraPeriod,
  getAgoraAccountLevel,
  type AgoraBuildOptions,
} from '../agoraGlData';
import type { ProcontAccountInput } from '../procontGlData';

describe('AGORA (Novitax) Főkönyvi Kivonat Adatmodell & Mérlegegyezőség', () => {
  // Benchmark test data taken directly from tests/docs/eb0148/FokonyviKivonat.pdf (Agora Plusz Kft. 2026.09.30)
  const agoraSampleLeaves: ProcontAccountInput[] = [
    // Class 1 (Total: T: 47,532,050, K: 7,850,998)
    { id: '1131', name: 'Vagyoni értékű jogok', debitTurnover: 28000, creditTurnover: 0 },
    { id: '1139', name: 'Vagyoni értékű jogok terv sz.értékcsökk.', debitTurnover: 0, creditTurnover: 28000 },
    { id: '1141', name: 'Szellemi termékek', debitTurnover: 15000000, creditTurnover: 0 },
    { id: '1149', name: 'Szellemi termékek terv sz. értékcsökk.', debitTurnover: 0, creditTurnover: 1495890 },
    { id: '1231', name: 'Épületek', debitTurnover: 26200000, creditTurnover: 0 },
    { id: '1239', name: 'Épületek terv szerinti értékcsökkenése', debitTurnover: 0, creditTurnover: 1747145 },
    { id: '1261', name: 'Ingatlanhoz kapcs. vagyoni ért. jogok', debitTurnover: 816000, creditTurnover: 0 },
    { id: '1269', name: 'Ingatlanhoz kapcs.v.ért.jog terv.sz.écs.', debitTurnover: 0, creditTurnover: 381493 },
    { id: '1311', name: 'Termelő gépek, berendezések, gyártóeszk.', debitTurnover: 1641269, creditTurnover: 0 },
    { id: '1319', name: 'Termelő gépek, berendezések terv sz. écs', debitTurnover: 0, creditTurnover: 1641269 },
    { id: '1411', name: 'Üzemi gépek, berendezések, felszerelések', debitTurnover: 428298, creditTurnover: 0 },
    { id: '1419', name: 'Üzemi gépek, berendezések terv sz. écs.', debitTurnover: 0, creditTurnover: 278298 },
    { id: '1431', name: 'Irodai, igazgatási berendezések', debitTurnover: 3183483, creditTurnover: 0 },
    { id: '1439', name: 'Irodai, igazgatási ber. terv sz. écs.', debitTurnover: 0, creditTurnover: 2043903 },
    { id: '1611', name: 'Befejezetlen beruházások', debitTurnover: 235000, creditTurnover: 235000 },

    // Class 3 (Total: T: 557,255,871, K: 360,114,696)
    { id: '311', name: 'Belföldi követelések', debitTurnover: 154608284, creditTurnover: 134679439 },
    { id: '352', name: 'Beruházásokra adott előlegek', debitTurnover: 35000000, creditTurnover: 0 },
    { id: '3613', name: 'Egyéb követelés munkavállalókkal szemben', debitTurnover: 83286, creditTurnover: 83286 },
    { id: '36151', name: 'Kuknyóné Szalontai Évának adott kölcsön', debitTurnover: 23023672, creditTurnover: 0 },
    { id: '3643', name: 'Agora Trans-F Air Kft-nek adott kölcsön', debitTurnover: 10954050, creditTurnover: 0 },
    { id: '3644', name: 'Agora Family Bt-nek adott pü. segítség', debitTurnover: 3200000, creditTurnover: 0 },
    { id: '3645', name: 'Agora Transzpark Kft-nek adott pü. segít', debitTurnover: 16188000, creditTurnover: 0 },
    { id: '3647', name: 'Ügyvezető Kft. részére - adott kölcsön', debitTurnover: 1149000, creditTurnover: 0 },
    { id: '3685', name: 'Eltérő időszaki levonható áfa', debitTurnover: 648, creditTurnover: 648 },
    { id: '369', name: 'IKTATÁS', debitTurnover: 439890, creditTurnover: 0 },
    { id: '3811', name: 'Pénztár számla', debitTurnover: 8934696, creditTurnover: 876995 },
    { id: '3821', name: 'Valutapénztár számla - EUR', debitTurnover: 1156200, creditTurnover: 0 },
    { id: '3841', name: 'MBH - HUF 10104459-48609800-01004000', debitTurnover: 132556764, creditTurnover: 132556764 },
    { id: '3862', name: 'MBH - EUR 10104459-48609800-01005300', debitTurnover: 119021661, creditTurnover: 40990841 },
    { id: '3892', name: 'Bank-bank forgalom átvezetési számla', debitTurnover: 37251119, creditTurnover: 37251119 },
    { id: '391', name: 'Bevételek aktív időbeli elhatárolása', debitTurnover: 12126057, creditTurnover: 12126057 },
    { id: '392', name: 'Költségek, ráfordítások aktív időbeli e.', debitTurnover: 1562544, creditTurnover: 1549547 },

    // Class 4 (Total: T: 619,658,406, K: 814,640,335)
    { id: '411', name: 'Jegyzett tőke', debitTurnover: 0, creditTurnover: 3000000 },
    { id: '413101', name: 'Eredménytartalék TAO időszaki', debitTurnover: 1910125, creditTurnover: 0 },
    { id: '413112', name: 'Eredménytartalék 2015', debitTurnover: 0, creditTurnover: 1910125 },
    { id: '413201', name: 'Eredménytartalék 2017', debitTurnover: 6044399, creditTurnover: 6044399 },
    { id: '413202', name: 'Eredménytartalék 2018', debitTurnover: 868034, creditTurnover: 868034 },
    { id: '413203', name: 'Eredménytartalék 2019', debitTurnover: 3862445, creditTurnover: 3862445 },
    { id: '413204', name: 'Eredménytartalék 2020', debitTurnover: 17529463, creditTurnover: 17529463 },
    { id: '413205', name: 'Eredménytartalék 2021', debitTurnover: 4252090, creditTurnover: 4252090 },
    { id: '413206', name: 'Eredménytartalék 2022', debitTurnover: 5530809, creditTurnover: 5530809 },
    { id: '413207', name: 'Eredménytartalék 2023', debitTurnover: 26261140, creditTurnover: 26261140 },
    { id: '413208', name: 'Eredménytartalék 2024', debitTurnover: 35651620, creditTurnover: 57775075 },
    { id: '413209', name: 'Eredménytartalék 2025', debitTurnover: 0, creditTurnover: 67423371 },
    { id: '419', name: 'Adózott eredmény', debitTurnover: 67423371, creditTurnover: 67423371 },
    { id: '4415', name: 'GINOP 8.3.5-18-B MFB hitel hosszú rész', debitTurnover: 0, creditTurnover: 1961560 },
    { id: '4515', name: 'GINOP 8.3.5-18-B MFB hitel rövidrész', debitTurnover: 1471149, creditTurnover: 1635924 },
    { id: '4521', name: 'Negatív bank - MNB folyószámla hitel', debitTurnover: 25630286, creditTurnover: 25690228 },
    { id: '454', name: 'Szállítók', debitTurnover: 4615078, creditTurnover: 6597432 },
    { id: '4617', name: 'Kisvállalati adó', debitTurnover: 4473000, creditTurnover: 1427000 },
    { id: '4621', name: 'Munkáltatói levont szja', debitTurnover: 0, creditTurnover: 6935677 },
    { id: '4622', name: 'Kifizetői szja', debitTurnover: 0, creditTurnover: 11328 },
    { id: '46291', name: 'Munkáltatói levont szja befizetés', debitTurnover: 7629000, creditTurnover: 693000 },
    { id: '46292', name: 'Kifizetői szja befizetés', debitTurnover: 10000, creditTurnover: 2000 },
    { id: '4661', name: 'Előzetesen felszámított áfa', debitTurnover: 789403, creditTurnover: 6069 },
    { id: '467', name: 'Fizetendő általános forgalmi adó', debitTurnover: 0, creditTurnover: 29736007 },
    { id: '468', name: 'Áfa pénzügyi elszámolási számla', debitTurnover: 29021000, creditTurnover: 3123000 },
    { id: '4691', name: 'Építmény adó elszámolási számla', debitTurnover: 234000, creditTurnover: 0 },
    { id: '46951', name: 'Iparűzési adó elsz. számla - Nyíregyháza', debitTurnover: 1787084, creditTurnover: 277882 },
    { id: '46952', name: 'Iparűzési adó elsz. számla - Napkor', debitTurnover: 774605, creditTurnover: 774605 },
    { id: '46972', name: 'Pótlék - Napkor', debitTurnover: 4880, creditTurnover: 0 },
    { id: '471', name: 'Jövedelem elszámolási számla', debitTurnover: 49344453, creditTurnover: 49344453 },
    { id: '47331', name: 'Biztosított TB járuléka', debitTurnover: 0, creditTurnover: 8894294 },
    { id: '47332', name: 'Biztosított TB jár. bef.', debitTurnover: 9839000, creditTurnover: 945000 },
    { id: '4791', name: 'Alapítókkal szembeni kötelezettségek', debitTurnover: 0, creditTurnover: 100000000 },
    { id: '4799', name: 'Egyéb befizetési kötelezettségek', debitTurnover: 0, creditTurnover: 2582 },
    { id: '482', name: 'Költségek,ráford. passzív időbeli elhat.', debitTurnover: 52494, creditTurnover: 52494 },
    { id: '491', name: 'Nyitómérleg számla', debitTurnover: 214649478, creditTurnover: 214649478 },
    { id: '493', name: 'Adózott eredmény elszámolása', debitTurnover: 100000000, creditTurnover: 100000000 },

    // Class 5 (Total: T: 55,294,069, K: 418,939)
    { id: '5131', name: 'Nyomtatvány, irodaszer beszerzés', debitTurnover: 122500, creditTurnover: 0 },
    { id: '5132', name: 'Víz, csatornadíjak', debitTurnover: 6878, creditTurnover: 0 },
    { id: '5221', name: 'Bérleti díj ktg.', debitTurnover: 240000, creditTurnover: 240000 },
    { id: '523', name: 'Javítási, karbantartási költségek', debitTurnover: 16000, creditTurnover: 0 },
    { id: '524', name: 'Hirdetés, reklám-propaganda költség', debitTurnover: 28674, creditTurnover: 0 },
    { id: '525', name: 'Oktatási, továbbképzési költségek', debitTurnover: 70810, creditTurnover: 0 },
    { id: '5271', name: 'Posta ktg.', debitTurnover: 4395, creditTurnover: 0 },
    { id: '5272', name: 'Telefon ktg.', debitTurnover: 129653, creditTurnover: 9108 },
    { id: '5273', name: 'Internet ktg.', debitTurnover: 418976, creditTurnover: 29886 },
    { id: '528', name: 'Szakkönyv, folyóirat, napilap beszerzés', debitTurnover: 56528, creditTurnover: 51632 },
    { id: '5294', name: 'Érdekvédelmi szervezetek tagdíja', debitTurnover: 67000, creditTurnover: 0 },
    { id: '5296', name: 'Takarítás, szemétszállítás díja', debitTurnover: 16281, creditTurnover: 5427 },
    { id: '5298', name: 'Vagyonvédelmi szolgáltatás díja', debitTurnover: 40500, creditTurnover: 13500 },
    { id: '5299', name: 'Egyéb igénybe vett szolgáltatás', debitTurnover: 2814261, creditTurnover: 35229 },
    { id: '531', name: 'Hatósági igazgatási díjak (illetékek)', debitTurnover: 18000, creditTurnover: 0 },
    { id: '532', name: 'Pénzügyi szolg-i díjak, bankköltségek', debitTurnover: 1207400, creditTurnover: 8089 },
    { id: '533', name: 'Biztosítási díjak', debitTurnover: 514279, creditTurnover: 5989 },
    { id: '5411', name: 'Alapbérek, törzsbérek', debitTurnover: 40446034, creditTurnover: 0 },
    { id: '5412', name: 'Kiegészítő fizetések', debitTurnover: 7154153, creditTurnover: 0 },
    { id: '5511', name: 'Betegszabadság', debitTurnover: 477102, creditTurnover: 0 },
    { id: '55121', name: 'Gépkocsi költségtérítések', debitTurnover: 1266443, creditTurnover: 0 },
    { id: '5533', name: 'Egyéb természetbeni juttatások', debitTurnover: 38080, creditTurnover: 0 },
    { id: '5542', name: 'Kulturális szolgáltatás', debitTurnover: 128794, creditTurnover: 20079 },
    { id: '5571', name: 'Kifizetőt terhelő juttatások utáni szja', debitTurnover: 11328, creditTurnover: 0 },

    // Class 8 (Total: T: 1,642,597, K: 2,613)
    { id: '86324', name: 'Késedelmi kamatok', debitTurnover: 228, creditTurnover: 0 },
    { id: '86329', name: 'Előző évek ráfordításai(ADÓALAP Növelő)', debitTurnover: 245427, creditTurnover: 0 },
    { id: '8694', name: 'Kerekítési különbözet egyéb ráfordítás', debitTurnover: 5, creditTurnover: 0 },
    { id: '8696', name: 'Nem a cég érdekében felmerült költség', debitTurnover: 2613, creditTurnover: 2613 },
    { id: '8698', name: 'Követelés bejelentés díja', debitTurnover: 102870, creditTurnover: 0 },
    { id: '8699', name: 'Könyvelési-bérszámfejt. hiba miatti kárt', debitTurnover: 463195, creditTurnover: 0 },
    { id: '8722', name: 'Fizetendő kamatok, kamatjell. ráford.', debitTurnover: 20827, creditTurnover: 0 },
    { id: '8762', name: 'Köv.köt.-ek pü. rendezett árfolyamveszt.', debitTurnover: 807432, creditTurnover: 0 },

    // Class 9 (Total: T: 12,126,057, K: 110,481,469)
    { id: '921', name: 'Számviteli szolgáltatás árbevétele', debitTurnover: 12126057, creditTurnover: 110133333 },
    { id: '96912', name: 'Különféle egyéb bevételek', debitTurnover: 0, creditTurnover: 100000 },
    { id: '9694', name: 'Kerekítési különbözet egyéb bevételként', debitTurnover: 0, creditTurnover: 7 },
    { id: '9762', name: 'Köv,köt.-ek pü. rendezett árf.nyeresége', debitTurnover: 0, creditTurnover: 248129 },
  ];

  it('reproduces 100% of the Agora grand totals and reconciliation from the benchmark PDF', () => {
    const report = buildAgoraGlData(agoraSampleLeaves, {
      companyName: 'Agora Plusz Kft.',
      taxNumber: '11650908-2-15',
      dateFrom: '2026-01-01',
      dateTo: '2026-09-30',
      year: '2026',
      currency: 'HUF',
      branding: 'EaisyBill',
    });

    expect(report.companyName).toBe('Agora Plusz Kft.');
    expect(report.taxNumber).toBe('11650908-2-15');
    expect(report.year).toBe('2026');
    expect(report.currency).toBe('HUF');
    expect(report.periodText).toBe('Hónap: 0 - 09 (Időszaki)');
    expect(report.branding).toBe('EaisyBill');

    // 1 - 4 számlaosztályok összesen (from Page 4 of PDF: T: 1,224,446,327 | K: 1,182,606,029 | Egyenleg T: 41,840,298)
    expect(report.reconciliation.classes1to4.turnoverDebit).toBe(1224446327);
    expect(report.reconciliation.classes1to4.turnoverCredit).toBe(1182606029);
    expect(report.reconciliation.classes1to4.balanceDebit).toBe(41840298);
    expect(report.reconciliation.classes1to4.balanceCredit).toBe(0);

    // 5 - 9 számlaosztályok összesen (from Page 4 of PDF: T: 69,062,723 | K: 110,903,021 | Egyenleg K: 41,840,298)
    expect(report.reconciliation.classes5to9.turnoverDebit).toBe(69062723);
    expect(report.reconciliation.classes5to9.turnoverCredit).toBe(110903021);
    expect(report.reconciliation.classes5to9.balanceDebit).toBe(0);
    expect(report.reconciliation.classes5to9.balanceCredit).toBe(41840298);

    // 1 - 9 számlaosztályok összesen (from Page 4 of PDF: T: 1,293,509,050 | K: 1,293,509,050)
    expect(report.reconciliation.grandTotal.turnoverDebit).toBe(1293509050);
    expect(report.reconciliation.grandTotal.turnoverCredit).toBe(1293509050);
    expect(report.reconciliation.isBalanced).toBe(true);

    // Check class 1 roll-up values
    const class1 = report.rows.find(r => r.accountNumber === '1');
    expect(class1).toBeDefined();
    expect(class1?.turnoverDebit).toBe(47532050);
    expect(class1?.turnoverCredit).toBe(7850998);
    expect(class1?.balanceDebit).toBe(39681052);
    expect(class1?.balanceCredit).toBe(0);
  });

  it('correctly formats Agora period strings', () => {
    expect(formatAgoraPeriod('2026-01-01', '2026-09-30')).toBe('Hónap: 0 - 09 (Időszaki)');
    expect(formatAgoraPeriod('2026-05-01', '2026-11-30')).toBe('Hónap: 05 - 11 (Időszaki)');
    expect(formatAgoraPeriod()).toBe('Hónap: 0 - 12 (Időszaki)');
  });

  it('correctly maps account levels', () => {
    expect(getAgoraAccountLevel('1')).toBe('class');
    expect(getAgoraAccountLevel('11')).toBe('group');
    expect(getAgoraAccountLevel('113')).toBe('subgroup');
    expect(getAgoraAccountLevel('1131')).toBe('leaf');
    expect(getAgoraAccountLevel('36151')).toBe('leaf');
  });

  it('handles zero rows exclusion correctly', () => {
    const mixedAccounts: ProcontAccountInput[] = [
      { id: '111', name: 'Aktív számla', debitTurnover: 1000, creditTurnover: 0 },
      { id: '112', name: 'Üres számla', debitTurnover: 0, creditTurnover: 0 },
    ];
    const withZeros = buildAgoraGlData(mixedAccounts, { excludeZeroRows: false });
    const withoutZeros = buildAgoraGlData(mixedAccounts, { excludeZeroRows: true });

    expect(withZeros.rows.some(r => r.accountNumber === '112')).toBe(true);
    expect(withoutZeros.rows.some(r => r.accountNumber === '112')).toBe(false);
  });

  it('renders multi-page Agora PDF without crashing and calculates page count', async () => {
    const { generateAgoraGlPdf } = await import('../agoraGlPdf');
    const report = buildAgoraGlData(agoraSampleLeaves, {
      companyName: 'Agora Plusz Kft.',
      taxNumber: '11650908-2-15',
      dateFrom: '2026-01-01',
      dateTo: '2026-09-30',
      branding: 'EaisyBill',
    });

    const doc = generateAgoraGlPdf(report);
    expect(doc).toBeDefined();
    const pageCount = (doc as any).internal.getNumberOfPages();
    expect(pageCount).toBeGreaterThanOrEqual(2);
  });

  it('exports Agora Excel file without crashing', async () => {
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const removeSpy = vi.spyOn(document.body, 'removeChild');

    const { exportAgoraGlExcel } = await import('../agoraGlExcel');
    await exportAgoraGlExcel(agoraSampleLeaves, {
      companyName: 'Agora Plusz Kft.',
      taxNumber: '11650908-2-15',
      dateFrom: '2026-01-01',
      dateTo: '2026-09-30',
      branding: 'EaisyBill',
    });

    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(appendSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
  });

  it('preserves 2 decimal cents for foreign currencies (e.g. EUR)', () => {
    const eurLeaves: ProcontAccountInput[] = [
      { id: '3111', name: 'Külföldi vevők (EUR)', debitTurnover: 1250.75, creditTurnover: 250.25 },
      { id: '9111', name: 'Értékesítés nettó árbevétele (EUR)', debitTurnover: 0, creditTurnover: 1000.50 },
    ];

    const report = buildAgoraGlData(eurLeaves, {
      currency: 'EUR',
      companyName: 'Euro Trading Ltd.',
    });

    const leaf3111 = report.rows.find(r => r.accountNumber === '3111')!;
    expect(leaf3111.turnoverDebit).toBe(1250.75);
    expect(leaf3111.turnoverCredit).toBe(250.25);
    expect(leaf3111.balanceDebit).toBe(1000.50);

    expect(report.reconciliation.classes1to4.turnoverDebit).toBe(1250.75);
    expect(report.reconciliation.classes1to4.balanceDebit).toBe(1000.50);
    expect(report.reconciliation.classes5to9.balanceCredit).toBe(1000.50);
    expect(report.reconciliation.isBalanced).toBe(true);
  });

  it('renders Agora PDF with a very long company name without crashing or overflowing', async () => {
    const { generateAgoraGlPdf } = await import('../agoraGlPdf');
    const longName = 'Nagyon Hosszú Nevű Nemzetközi Kereskedelmi és Logisztikai Szolgáltató Korlátolt Felelősségű Társaság';
    const report = buildAgoraGlData(agoraSampleLeaves, {
      companyName: longName,
      taxNumber: '99887766-2-42',
      currency: 'EUR',
      branding: 'EaisyBill',
    });

    const doc = generateAgoraGlPdf(report);
    expect(doc).toBeDefined();
    expect((doc as any).internal.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });
});



