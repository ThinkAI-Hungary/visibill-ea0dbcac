/**
 * agoraPnlData.ts
 *
 * Hivatalos magyar Eredménykimutatás összköltség eljárással („A” változat)
 * adatfeldolgozó és kalkulációs motor a benchmark Novitax / Agora export
 * (tests/docs/eb0148/Eredménykimutatás_export.pdf) alapján.
 */

export interface AgoraPnlRowDefinition {
  lineNum: number;           // 1 .. 48
  code: string;              // '01.', '02.', 'I.', 'A.', 'X/1.', stb.
  name: string;              // Hivatalos törvényi megnevezés
  page: 1 | 2;               // 1: sorok 1-22, 2: sorok 23-48
  isRoman?: boolean;         // Római számmal jelölt főkategória
  isCapital?: boolean;       // Nagybetűs eredménykategória (A., B., C., D.)
  isSubItem?: boolean;       // "Ebből:" sor
  prefixes?: string[];       // Számlaszám prefixek (pl. ['91', '92'])
  formula?: number[];        // Összegző sor esetén az összeadandó sorszámok (pl. [1, 2] az I.-hez)
  formulaType?: 'operating' | 'financial' | 'preTax' | 'netProfit';
  isExpense?: boolean;       // Költség / ráfordítás jellegű sor
}

export interface AgoraPnlCalculatedRow {
  lineNum: number;
  code: string;
  name: string;
  page: 1 | 2;
  isRoman: boolean;
  isCapital: boolean;
  isSubItem: boolean;
  isTotal: boolean;
  rawCurrent: number;        // Nyers forint érték
  rawPrevious: number;       // Nyers előző évi forint érték
  rawMod: number;            // Nyers módosítás
  displayCurrent: number;    // Ezer HUF-ban (vagy HUF-ban) kerekítve
  displayPrevious: number;   // Ezer HUF-ban (vagy HUF-ban) kerekítve
  displayMod: number;        // Ezer HUF-ban (vagy HUF-ban) kerekítve
}

export interface AgoraPnlReportData {
  company: {
    name: string;
    address?: string;
    taxNumber?: string;
    statisticalCode?: string;
    registrationNumber?: string;
    balanceSheetDate?: string; // pl. '2026.12.31'
  };
  period: string;             // pl. '2026. 0 - 13 hó' vagy '2026.01.01 - 2026.12.31'
  currency: string;           // 'Ezer HUF' vagy 'HUF'
  inThousands: boolean;
  generatedDate: string;      // pl. '2026.09.30'
  listId: string;             // pl. '4629551188'
  branding: string;           // 'EaisyBill'
  rows: AgoraPnlCalculatedRow[];
  page1Rows: AgoraPnlCalculatedRow[];
  page2Rows: AgoraPnlCalculatedRow[];
}

export const AGORA_PNL_DEFINITIONS: AgoraPnlRowDefinition[] = [
  // ── 1. OLDAL (Sorok 01. – 22.) ──
  { lineNum: 1, code: '01.', name: 'Belföldi értékesítés nettó árbevétele', page: 1, prefixes: ['91', '92'] },
  { lineNum: 2, code: '02.', name: 'Exportértékesítés nettó árbevétele', page: 1, prefixes: ['93', '94'] },
  { lineNum: 3, code: 'I.', isRoman: true, name: 'Értékesítés nettó árbevétele (01+02)', page: 1, formula: [1, 2] },
  { lineNum: 4, code: '03.', name: 'Saját termelésű készletek állományváltozása', page: 1, prefixes: ['581', '582'] },
  { lineNum: 5, code: '04.', name: 'Saját előállítású eszközök aktivált értéke', page: 1, prefixes: ['583', '584'] },
  { lineNum: 6, code: 'II.', isRoman: true, name: 'Aktivált saját teljesítmények értéke (+-03+04)', page: 1, formula: [4, 5] },
  { lineNum: 7, code: 'III.', isRoman: true, name: 'Egyéb bevételek', page: 1, prefixes: ['96', '98'] },
  { lineNum: 8, code: '', isSubItem: true, name: 'Ebből: visszaírt értékvesztés', page: 1, prefixes: ['966'] },
  { lineNum: 9, code: '05.', isExpense: true, name: 'Anyagköltség', page: 1, prefixes: ['51'] },
  { lineNum: 10, code: '06.', isExpense: true, name: 'Igénybe vett szolgáltatások értéke', page: 1, prefixes: ['52'] },
  { lineNum: 11, code: '07.', isExpense: true, name: 'Egyéb szolgáltatások értéke', page: 1, prefixes: ['53'] },
  { lineNum: 12, code: '08.', isExpense: true, name: 'Eladott áruk beszerzési értéke', page: 1, prefixes: ['814'] },
  { lineNum: 13, code: '09.', isExpense: true, name: 'Eladott (közvetített) szolgáltatások értéke', page: 1, prefixes: ['815'] },
  { lineNum: 14, code: 'IV.', isRoman: true, isExpense: true, name: 'Anyagjellegű ráfordítások (05+06+07+08+09)', page: 1, formula: [9, 10, 11, 12, 13] },
  { lineNum: 15, code: '10.', isExpense: true, name: 'Bérköltség', page: 1, prefixes: ['54'] },
  { lineNum: 16, code: '11.', isExpense: true, name: 'Személyi jellegű egyéb kifizetések', page: 1, prefixes: ['55'] },
  { lineNum: 17, code: '12.', isExpense: true, name: 'Bérjárulékok', page: 1, prefixes: ['56'] },
  { lineNum: 18, code: 'V.', isRoman: true, isExpense: true, name: 'Személyi jellegű ráfordítások (10+11+12)', page: 1, formula: [15, 16, 17] },
  { lineNum: 19, code: 'VI.', isRoman: true, isExpense: true, name: 'Értékcsökkenési leírás', page: 1, prefixes: ['57', '83'] },
  { lineNum: 20, code: 'VII.', isRoman: true, isExpense: true, name: 'Egyéb ráfordítások', page: 1, prefixes: ['86', '84', '85', '88'] },
  { lineNum: 21, code: '', isSubItem: true, isExpense: true, name: 'Ebből: értékvesztés', page: 1, prefixes: ['866'] },
  { lineNum: 22, code: 'A.', isCapital: true, name: 'ÜZEMI (ÜZLETI) TEVÉKENYSÉG EREDMÉNYE (I+-II+III-IV-V-VI-VII)', page: 1, formulaType: 'operating' },

  // ── 2. OLDAL (Sorok 23. – 48.) ──
  { lineNum: 23, code: '13.', name: 'Kapott (járó) osztalék és részesedés', page: 2, prefixes: ['971'] },
  { lineNum: 24, code: '', isSubItem: true, name: 'Ebből: kapcsolt vállalkozástól kapott', page: 2, prefixes: ['9711'] },
  { lineNum: 25, code: '14.', name: 'Részesedésekből származó bev., árf. nyereségek', page: 2, prefixes: ['972'] },
  { lineNum: 26, code: '', isSubItem: true, name: 'Ebből: kapcsolt vállalkozástól kapott', page: 2, prefixes: ['9721'] },
  { lineNum: 27, code: '15.', name: 'Befektetett pénzügyi eszközökből (értékp.,kölcs.) szárm. bev., árf.ny', page: 2, prefixes: ['973'] },
  { lineNum: 28, code: '', isSubItem: true, name: 'Ebből: kapcsolt vállalkozástól kapott', page: 2, prefixes: ['9731'] },
  { lineNum: 29, code: '16.', name: 'Egyéb kapott (járó) kamatok és kamatjellegű bevételek', page: 2, prefixes: ['974'] },
  { lineNum: 30, code: '', isSubItem: true, name: 'Ebből: kapcsolt vállalkozástól kapott', page: 2, prefixes: ['9741'] },
  { lineNum: 31, code: '17.', name: 'Pénzügyi műveletek egyéb bevételei', page: 2, prefixes: ['975', '976', '977', '978', '979'] },
  { lineNum: 32, code: '', isSubItem: true, name: 'Ebből: értékelési különbözet', page: 2, prefixes: ['9763'] },
  { lineNum: 33, code: 'VIII.', isRoman: true, name: 'Pénzügyi műveletek bevételei (13+14+15+16+17)', page: 2, formula: [23, 25, 27, 29, 31] },
  { lineNum: 34, code: '18.', isExpense: true, name: 'Részesedésekből származó ráf., árfolyamveszteségek', page: 2, prefixes: ['875', '871'] },
  { lineNum: 35, code: '', isSubItem: true, isExpense: true, name: 'Ebből: kapcsolt vállalkozásnak adott', page: 2, prefixes: ['8751', '8711'] },
  { lineNum: 36, code: '19.', isExpense: true, name: 'Befektetett pénzügyi eszközökből (értékp., kölcs.) szárm. ráf., árf.v.', page: 2, prefixes: ['872'] },
  { lineNum: 37, code: '', isSubItem: true, isExpense: true, name: 'Ebből: kapcsolt vállalkozásnak adott', page: 2, prefixes: ['8721'] },
  { lineNum: 38, code: '20.', isExpense: true, name: 'Fizetendő (fizetett) kamatok és kamatjellegű ráfordítások', page: 2, prefixes: ['8722', '873'] },
  { lineNum: 39, code: '', isSubItem: true, isExpense: true, name: 'Ebből: kapcsolt vállalkozásnak adott', page: 2, prefixes: ['8721'] },
  { lineNum: 40, code: '21.', isExpense: true, name: 'Részesed., értékpapírok, tartósan adott kölcs., bankbetétek értékv.', page: 2, prefixes: ['874'] },
  { lineNum: 41, code: '22.', isExpense: true, name: 'Pénzügyi műveletek egyéb ráfordításai', page: 2, prefixes: ['876', '877', '878', '879'] },
  { lineNum: 42, code: '', isSubItem: true, isExpense: true, name: 'Ebből: értékelési különbözet', page: 2, prefixes: ['8763'] },
  { lineNum: 43, code: 'IX.', isRoman: true, isExpense: true, name: 'Pénzügyi műveletek ráfordításai (18+19+-20+21+22)', page: 2, formula: [34, 36, 38, 40, 41] },
  { lineNum: 44, code: 'B.', isCapital: true, name: 'PÉNZÜGYI MŰVELETEK EREDMÉNYE (VIII-IX)', page: 2, formulaType: 'financial' },
  { lineNum: 45, code: 'C.', isCapital: true, name: 'ADÓZÁS ELŐTTI EREDMÉNY (+-A+-B)', page: 2, formulaType: 'preTax' },
  { lineNum: 46, code: 'X.', isRoman: true, isExpense: true, name: 'Adófizetési kötelezettség', page: 2, prefixes: ['891', '896', '89'] },
  { lineNum: 47, code: 'X/1.', isRoman: true, name: 'Halasztott adókülönbözet (±)', page: 2, prefixes: ['892'] },
  { lineNum: 48, code: 'D.', isCapital: true, name: 'ADÓZOTT EREDMÉNY (+-C-X-X/1)', page: 2, formulaType: 'netProfit' },
];

export interface BuildAgoraPnlOptions {
  company: {
    name: string;
    address?: string;
    taxNumber?: string;
    statisticalCode?: string;
    registrationNumber?: string;
    balanceSheetDate?: string;
  };
  pnlData: any[]; // get_pnl_report rows
  prevYearMap?: Record<string, number>;
  dateFrom?: string | null;
  dateTo?: string | null;
  inThousands?: boolean;
  branding?: string;
  listId?: string;
  generatedDate?: string;
}

/**
 * Összeállítja a 48 tételsoros hivatalos magyar Eredménykimutatást
 */
export function buildAgoraPnlData(options: BuildAgoraPnlOptions): AgoraPnlReportData {
  const inThousands = options.inThousands !== undefined ? options.inThousands : true;
  const branding = options.branding || 'EaisyBill';
  
  // Dátum formázások
  const today = new Date();
  const defaultGenDate = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;
  const generatedDate = options.generatedDate || defaultGenDate;
  
  // Időszak string felépítése (pl. '2026. 0 - 13 hó' vagy '2026.01.01 - 2026.12.31')
  let period = '2026. 0 - 13 hó';
  if (options.dateFrom && options.dateTo) {
    const fromYear = options.dateFrom.substring(0, 4);
    const toYear = options.dateTo.substring(0, 4);
    if (fromYear === toYear) {
      period = `${fromYear}. (${options.dateFrom.replace(/-/g, '.')} - ${options.dateTo.replace(/-/g, '.')})`;
    } else {
      period = `${options.dateFrom.replace(/-/g, '.')} - ${options.dateTo.replace(/-/g, '.')}`;
    }
  }

  // Mérlegfordulónap alapértelmezés (tárgyév dec. 31)
  const targetYear = options.dateTo ? options.dateTo.substring(0, 4) : String(today.getFullYear());
  const balanceSheetDate = options.company.balanceSheetDate || `${targetYear}.12.31`;

  // Egyedi listaazonosító generálása vagy átvétele
  const listId = options.listId || Math.abs(hashCode(`${options.company.taxNumber || ''}-${options.company.name}-${period}`)).toString().slice(0, 10);

  // 1. Összegyűjtjük a GL számlákat a pnlData-ból
  const glAccountsList: Array<{ gl_number: string; balance: number }> = [];
  const pnlSummaryMap: Record<string, { balance: number; multiplier: number }> = {};

  (options.pnlData || []).forEach(row => {
    if (row.row_code) {
      pnlSummaryMap[row.row_code] = {
        balance: Number(row.balance) || 0,
        multiplier: row.multiplier || 1,
      };
    }
    if (Array.isArray(row.gl_accounts)) {
      row.gl_accounts.forEach((gl: any) => {
        if (gl.gl_number) {
          glAccountsList.push({
            gl_number: String(gl.gl_number).trim(),
            balance: Number(gl.balance) || 0,
          });
        }
      });
    }
  });

  // Segédfüggvény: számlaszám prefixek szerinti összegzés
  const sumGlByPrefixes = (prefixes: string[], isExpense: boolean = false): number => {
    let sum = 0;
    glAccountsList.forEach(gl => {
      const match = prefixes.some(p => gl.gl_number.startsWith(p));
      if (match) {
        sum += gl.balance;
      }
    });
    // Költségek és ráfordítások a kimutatásban pozitív számként szerepelnek
    return isExpense ? Math.abs(sum) : sum;
  };

  // 2. Kiszámítjuk a 48 sor nyers értékeit
  const currentBalances: Record<number, number> = {};
  const prevBalances: Record<number, number> = {};
  const prevYearMap = options.prevYearMap || {};

  // Első menet: egyedi tételek kiszámítása a GL számlákból
  AGORA_PNL_DEFINITIONS.forEach(def => {
    if (def.prefixes && def.prefixes.length > 0) {
      const glSum = sumGlByPrefixes(def.prefixes, !!def.isExpense);
      currentBalances[def.lineNum] = glSum;
    } else {
      currentBalances[def.lineNum] = 0;
    }
    prevBalances[def.lineNum] = 0;
  });

  // Ha bizonyos kategóriákban nem voltak tételes GL-ek hozzárendelve, 
  // de a pnlData főkategória tartalmaz összeget, fallback-elünk a fő tételre:
  if (currentBalances[1] === 0 && currentBalances[2] === 0 && pnlSummaryMap['I.']) {
    currentBalances[1] = pnlSummaryMap['I.'].balance;
  }
  if (currentBalances[7] === 0 && pnlSummaryMap['III.']) {
    currentBalances[7] = pnlSummaryMap['III.'].balance;
  }
  if (currentBalances[19] === 0 && pnlSummaryMap['VI.']) {
    currentBalances[19] = Math.abs(pnlSummaryMap['VI.'].balance);
  }
  if (currentBalances[20] === 0 && pnlSummaryMap['VII.']) {
    currentBalances[20] = Math.abs(pnlSummaryMap['VII.'].balance);
  }
  if (currentBalances[46] === 0 && pnlSummaryMap['X.']) {
    currentBalances[46] = Math.abs(pnlSummaryMap['X.'].balance);
  }

  // 3. Összegző formulák kiértékelése
  // Sor 03: I. = 01 + 02
  currentBalances[3] = (currentBalances[1] || 0) + (currentBalances[2] || 0);
  // Sor 06: II. = 03 + 04
  currentBalances[6] = (currentBalances[4] || 0) + (currentBalances[5] || 0);
  // Sor 14: IV. = 05 + 06 + 07 + 08 + 09
  currentBalances[14] = (currentBalances[9] || 0) + (currentBalances[10] || 0) + (currentBalances[11] || 0) + (currentBalances[12] || 0) + (currentBalances[13] || 0);
  // Sor 18: V. = 10 + 11 + 12
  currentBalances[18] = (currentBalances[15] || 0) + (currentBalances[16] || 0) + (currentBalances[17] || 0);
  // Sor 22: A. = I ± II + III - IV - V - VI - VII
  currentBalances[22] = (currentBalances[3] || 0) + (currentBalances[6] || 0) + (currentBalances[7] || 0) 
    - (currentBalances[14] || 0) - (currentBalances[18] || 0) - (currentBalances[19] || 0) - (currentBalances[20] || 0);

  // Sor 33: VIII. = 13 + 14 + 15 + 16 + 17
  currentBalances[33] = (currentBalances[23] || 0) + (currentBalances[25] || 0) + (currentBalances[27] || 0) + (currentBalances[29] || 0) + (currentBalances[31] || 0);
  // Sor 43: IX. = 18 + 19 + 20 + 21 + 22
  currentBalances[43] = (currentBalances[34] || 0) + (currentBalances[36] || 0) + (currentBalances[38] || 0) + (currentBalances[40] || 0) + (currentBalances[41] || 0);
  // Sor 44: B. = VIII - IX
  currentBalances[44] = (currentBalances[33] || 0) - (currentBalances[43] || 0);
  // Sor 45: C. = A ± B
  currentBalances[45] = (currentBalances[22] || 0) + (currentBalances[44] || 0);
  // Sor 48: D. = C - X - X/1
  currentBalances[48] = (currentBalances[45] || 0) - (currentBalances[46] || 0) - (currentBalances[47] || 0);

  // Előző évi adatok leképezése, ha léteznek a prevYearMap-ben
  // (A prevYearMap kódjai: I., II., III., IV., V., VI., VII., A., VIII., IX., B., C., X., D.)
  if (prevYearMap['I.']) {
    prevBalances[1] = prevYearMap['I.']; // fallback ha nincs alábontás
    prevBalances[3] = prevYearMap['I.'];
  }
  if (prevYearMap['II.']) prevBalances[6] = prevYearMap['II.'];
  if (prevYearMap['III.']) prevBalances[7] = prevYearMap['III.'];
  if (prevYearMap['IV.']) {
    prevBalances[10] = prevYearMap['IV.']; // fallback alábontás
    prevBalances[14] = prevYearMap['IV.'];
  }
  if (prevYearMap['V.']) {
    prevBalances[15] = prevYearMap['V.'];
    prevBalances[18] = prevYearMap['V.'];
  }
  if (prevYearMap['VI.']) prevBalances[19] = prevYearMap['VI.'];
  if (prevYearMap['VII.']) prevBalances[20] = prevYearMap['VII.'];
  if (prevYearMap['A.']) prevBalances[22] = prevYearMap['A.'];
  if (prevYearMap['VIII.']) {
    prevBalances[31] = prevYearMap['VIII.'];
    prevBalances[33] = prevYearMap['VIII.'];
  }
  if (prevYearMap['IX.']) {
    prevBalances[41] = prevYearMap['IX.'];
    prevBalances[43] = prevYearMap['IX.'];
  }
  if (prevYearMap['B.']) prevBalances[44] = prevYearMap['B.'];
  if (prevYearMap['C.']) prevBalances[45] = prevYearMap['C.'];
  if (prevYearMap['X.']) prevBalances[46] = prevYearMap['X.'];
  if (prevYearMap['D.']) prevBalances[48] = prevYearMap['D.'];

  // Ha a prevYearMap közvetlenül sorszámokkal vagy benchmark adatokkal érkezik
  Object.keys(prevYearMap).forEach(key => {
    const num = parseInt(key, 10);
    if (!isNaN(num) && num >= 1 && num <= 48) {
      prevBalances[num] = prevYearMap[key];
    }
  });

  // Kerekítés segédfüggvény
  const roundValue = (val: number): number => {
    if (!val) return 0;
    return inThousands ? Math.round(val / 1000) : Math.round(val);
  };

  // 4. Létrehozzuk a feldolgozott sorokat
  const rows: AgoraPnlCalculatedRow[] = AGORA_PNL_DEFINITIONS.map(def => {
    const rawCurr = currentBalances[def.lineNum] || 0;
    const rawPrev = prevBalances[def.lineNum] || 0;
    const rawMod = 0;

    return {
      lineNum: def.lineNum,
      code: def.code,
      name: def.name,
      page: def.page,
      isRoman: !!def.isRoman,
      isCapital: !!def.isCapital,
      isSubItem: !!def.isSubItem,
      isTotal: !!def.isRoman || !!def.isCapital,
      rawCurrent: rawCurr,
      rawPrevious: rawPrev,
      rawMod,
      displayCurrent: roundValue(rawCurr),
      displayPrevious: roundValue(rawPrev),
      displayMod: roundValue(rawMod),
    };
  });

  return {
    company: {
      name: options.company.name,
      address: options.company.address || '',
      taxNumber: options.company.taxNumber || '',
      statisticalCode: options.company.statisticalCode || '',
      registrationNumber: options.company.registrationNumber || '',
      balanceSheetDate,
    },
    period,
    currency: inThousands ? 'Ezer HUF' : 'HUF',
    inThousands,
    generatedDate,
    listId,
    branding,
    rows,
    page1Rows: rows.filter(r => r.page === 1),
    page2Rows: rows.filter(r => r.page === 2),
  };
}

/**
 * Szám formázása a benchmark PDF szerint (pl. '98,007', '-580', üres ha 0)
 */
export function formatAgoraPnlNumber(val: number, allowBlankZero: boolean = true): string {
  if (val === 0 && allowBlankZero) return '';
  return new Intl.NumberFormat('en-US').format(val); // en-US standard vesszős ezreselválasztót ad, pont ahogy a benchmarkban
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash;
}
