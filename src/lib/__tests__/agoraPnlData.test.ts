import { describe, it, expect } from 'vitest';
import {
  buildAgoraPnlData,
  formatAgoraPnlNumber,
  AGORA_PNL_DEFINITIONS,
} from '../agoraPnlData';

describe('agoraPnlData calculation engine', () => {
  it('should define exactly 48 statutory rows with correct pagination', () => {
    expect(AGORA_PNL_DEFINITIONS).toHaveLength(48);
    const p1 = AGORA_PNL_DEFINITIONS.filter(r => r.page === 1);
    const p2 = AGORA_PNL_DEFINITIONS.filter(r => r.page === 2);
    expect(p1).toHaveLength(22);
    expect(p2).toHaveLength(26);
    expect(p1[21].code).toBe('A.');
    expect(p2[25].code).toBe('D.');
  });

  it('should format numbers with comma separation matching the benchmark PDF', () => {
    expect(formatAgoraPnlNumber(98007)).toBe('98,007');
    expect(formatAgoraPnlNumber(-580)).toBe('-580');
    expect(formatAgoraPnlNumber(41840)).toBe('41,840');
    expect(formatAgoraPnlNumber(0, true)).toBe('');
    expect(formatAgoraPnlNumber(0, false)).toBe('0');
  });

  it('should calculate the exact benchmark values from Agora Plusz Kft. sample data', () => {
    // Mock get_pnl_report response for Agora Plusz Kft.
    const mockPnlData = [
      {
        row_code: 'I.',
        name: 'Értékesítés nettó árbevétele',
        type: 'roman',
        balance: 98007000,
        gl_accounts: [
          { gl_number: '911', short_name: 'Belföldi árbevétel 27%', balance: 98007000 },
        ],
      },
      {
        row_code: 'III.',
        name: 'Egyéb bevételek',
        type: 'roman',
        balance: 100000,
        gl_accounts: [
          { gl_number: '963', short_name: 'Egyéb bevételek', balance: 100000 },
        ],
      },
      {
        row_code: 'IV.',
        name: 'Anyagjellegű ráfordítások',
        type: 'roman',
        balance: 5373000,
        gl_accounts: [
          { gl_number: '511', short_name: 'Anyagköltség', balance: 129000 },
          { gl_number: '521', short_name: 'Szállítási és rakodási ktg', balance: 3518000 },
          { gl_number: '531', short_name: 'Bankköltség', balance: 1726000 },
        ],
      },
      {
        row_code: 'V.',
        name: 'Személyi jellegű ráfordítások',
        type: 'roman',
        balance: 49502000,
        gl_accounts: [
          { gl_number: '541', short_name: 'Bérköltség', balance: 47600000 },
          { gl_number: '551', short_name: 'Személyi egyéb kifizetések', balance: 1902000 },
        ],
      },
      {
        row_code: 'VII.',
        name: 'Egyéb ráfordítások',
        type: 'roman',
        balance: 812000,
        gl_accounts: [
          { gl_number: '863', short_name: 'Egyéb ráfordítások', balance: 812000 },
        ],
      },
      {
        row_code: 'VIII.',
        name: 'Pénzügyi műveletek bevételei',
        type: 'roman',
        balance: 248000,
        gl_accounts: [
          { gl_number: '976', short_name: 'Pénzügyi egyéb bevételek', balance: 248000 },
        ],
      },
      {
        row_code: 'IX.',
        name: 'Pénzügyi műveletek ráfordításai',
        type: 'roman',
        balance: 828000,
        gl_accounts: [
          { gl_number: '872', short_name: 'Fizetendő kamatok', balance: 21000 },
          { gl_number: '876', short_name: 'Pénzügyi egyéb ráfordítások', balance: 807000 },
        ],
      },
    ];

    // Benchmark previous year numbers
    const prevYearMap = {
      1: 144259000, // 01. Belföldi
      3: 144259000, // I. Árbevétel
      7: 1798000,   // III. Egyéb bevétel
      9: 407000,    // 05. Anyagköltség
      10: 4157000,  // 06. Igénybe vett szolg.
      11: 1695000,  // 07. Egyéb szolg.
      14: 6259000,  // IV. Anyagjellegű
      15: 52750000, // 10. Bérköltség
      16: 2791000,  // 11. Személyi egyéb
      17: 1020000,  // 12. Bérjárulék
      18: 56561000, // V. Személyi jellegű
      19: 2616000,  // VI. ÉCS
      20: 3860000,  // VII. Egyéb ráfordítás
      22: 76761000, // A. Üzemi eredmény
      31: 219000,   // 17. Pénzügyi egyéb bev.
      33: 219000,   // VIII. Pénzügyi bevétel
      38: 7000,     // 20. Fizetett kamat
      41: 4378000,  // 22. Pénzügyi egyéb ráf.
      43: 4385000,  // IX. Pénzügyi ráfordítás
      44: -4166000, // B. Pénzügyi eredmény
      45: 72595000, // C. Adózás előtti
      46: 5172000,  // X. Adó
      48: 67423000, // D. Adózott eredmény
    };

    const result = buildAgoraPnlData({
      company: {
        name: 'Agora Plusz Kft.',
        address: '4400 Nyíregyháza Nyírfa utca 17',
        taxNumber: '11650908-2-15',
        statisticalCode: '11650908-6920-113-15',
        registrationNumber: '15-09-065091',
        balanceSheetDate: '2026.12.31',
      },
      pnlData: mockPnlData,
      prevYearMap,
      inThousands: true,
      branding: 'EaisyBill',
    });

    expect(result.rows).toHaveLength(48);

    // Verify Page 1 key summary rows
    const row01 = result.rows.find(r => r.lineNum === 1);
    expect(row01?.displayCurrent).toBe(98007);
    expect(row01?.displayPrevious).toBe(144259);

    const row03_I = result.rows.find(r => r.lineNum === 3);
    expect(row03_I?.displayCurrent).toBe(98007);
    expect(row03_I?.displayPrevious).toBe(144259);

    const row07_III = result.rows.find(r => r.lineNum === 7);
    expect(row07_III?.displayCurrent).toBe(100);
    expect(row07_III?.displayPrevious).toBe(1798);

    const row14_IV = result.rows.find(r => r.lineNum === 14);
    expect(row14_IV?.displayCurrent).toBe(5373);
    expect(row14_IV?.displayPrevious).toBe(6259);

    const row18_V = result.rows.find(r => r.lineNum === 18);
    expect(row18_V?.displayCurrent).toBe(49502);
    expect(row18_V?.displayPrevious).toBe(56561);

    const row22_A = result.rows.find(r => r.lineNum === 22);
    expect(row22_A?.code).toBe('A.');
    expect(row22_A?.displayCurrent).toBe(42420); // 98007 + 100 - 5373 - 49502 - 812 = 42420!
    expect(row22_A?.displayPrevious).toBe(76761);

    // Verify Page 2 key financial summary rows
    const row33_VIII = result.rows.find(r => r.lineNum === 33);
    expect(row33_VIII?.code).toBe('VIII.');
    expect(row33_VIII?.displayCurrent).toBe(248);
    expect(row33_VIII?.displayPrevious).toBe(219);

    const row43_IX = result.rows.find(r => r.lineNum === 43);
    expect(row43_IX?.code).toBe('IX.');
    expect(row43_IX?.displayCurrent).toBe(828); // 21 + 807 = 828
    expect(row43_IX?.displayPrevious).toBe(4385);

    const row44_B = result.rows.find(r => r.lineNum === 44);
    expect(row44_B?.code).toBe('B.');
    expect(row44_B?.displayCurrent).toBe(-580); // 248 - 828 = -580!
    expect(row44_B?.displayPrevious).toBe(-4166);

    const row45_C = result.rows.find(r => r.lineNum === 45);
    expect(row45_C?.code).toBe('C.');
    expect(row45_C?.displayCurrent).toBe(41840); // 42420 + (-580) = 41840!
    expect(row45_C?.displayPrevious).toBe(72595);

    const row48_D = result.rows.find(r => r.lineNum === 48);
    expect(row48_D?.code).toBe('D.');
    expect(row48_D?.displayCurrent).toBe(41840); // 41840 - 0 = 41840!
    expect(row48_D?.displayPrevious).toBe(67423);
  });

  it('renders 2-page Agora PDF without crashing and calculates page count', async () => {
    const { generateAgoraPnlPdf } = await import('../agoraPnlPdf');
    const reportData = buildAgoraPnlData({
      company: {
        name: 'Agora Plusz Kft.',
        address: '4400 Nyíregyháza Nyírfa utca 17',
        taxNumber: '11650908-2-15',
        statisticalCode: '11650908-6920-113-15',
        registrationNumber: '15-09-065091',
        balanceSheetDate: '2026.12.31',
      },
      pnlData: [],
      inThousands: true,
      branding: 'EaisyBill',
    });

    const doc = generateAgoraPnlPdf(reportData);
    expect(doc).toBeDefined();
    const pageCount = (doc as any).internal.getNumberOfPages();
    expect(pageCount).toBe(2);
  });

  it('exports Agora Excel file without crashing', async () => {
    const { exportAgoraPnlExcel } = await import('../agoraPnlExcel');
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const removeSpy = vi.spyOn(document.body, 'removeChild');

    await exportAgoraPnlExcel({
      company: {
        name: 'Agora Plusz Kft.',
        taxNumber: '11650908-2-15',
      },
      pnlData: [],
      inThousands: true,
      branding: 'EaisyBill',
    });

    expect(appendSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  }, 15000);
});

