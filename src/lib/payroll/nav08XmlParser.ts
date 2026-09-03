/**
 * NAV 08 (2608 / 2508 / 2408) és ÁNYK XML Parser Motor
 * 
 * Támogatja:
 * 1. Hivatalos NAV ÁNYK XML formátumot (<nyomtatvanyok> -> <nyomtatvany> -> <mezok>)
 *    - 08A (Főlap, cégadatok, adószám, időszak, összesítők)
 *    - 08M (Egyéni biztosítotti lapok: személyes adatok, jogviszony, bérjövedelmek, járulékok)
 * 2. Szemantikus / Export XML formátumot (<Filing08>, <Tetelsor>, <Bevallas>)
 */

export interface Parsed08Employee {
  // Személyes adatok
  lastName: string;
  firstName: string;
  birthName?: string;
  birthDate?: string;
  birthPlace?: string;
  mothersName?: string;
  tajNumber: string;
  taxId: string;
  gender?: 'male' | 'female' | 'other';
  nationality?: string;

  // Jogviszony adatok
  jobCode: string;             // pl. '1101'
  employmentType: string;      // pl. 'munkaviszony'
  startDate: string;           // YYYY-MM-DD
  endDate?: string;
  weeklyHours: number;         // pl. 40
  feorCode?: string;           // pl. '2411'
  jobTitle?: string;
  baseSalary?: number;

  // Számfejtési eredmények az adott hónapra
  grossSalary: number;
  taxBase: number;
  szjaAmount: number;
  tbBase: number;
  tbAmount: number;
  szochoBase: number;
  szochoAmount: number;
  netSalary: number;
  totalDeductions: number;
  
  // Kedvezmények
  familyCreditUsed?: number;
  under25CreditUsed?: number;
  personalCreditUsed?: number;
  otherCreditsUsed?: number;

  // Validációs jelölők
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface Parsed08Document {
  companyName: string;
  companyTaxNumber: string;
  year: number;
  month: number;
  filingType: string; // '2608', '2508', '2408', 'semantic'
  totalGrossSalary: number;
  totalSzja: number;
  totalTb: number;
  totalSzocho: number;
  totalNetSalary: number;
  employeeCount: number;
  employees: Parsed08Employee[];
  rawXml?: string;
  parseErrors: string[];
}

/**
 * Normalizálja a TAJ számot (szóközök, kötőjelek eltávolítása, 9 számjegy ellenőrzés)
 */
export function cleanTaj(taj: string | null | undefined): string {
  if (!taj) return '';
  return taj.replace(/[\s-]/g, '').trim();
}

/**
 * Normalizálja az adóazonosító jelet (10 számjegy)
 */
export function cleanTaxId(taxId: string | null | undefined): string {
  if (!taxId) return '';
  return taxId.replace(/[\s-]/g, '').trim();
}

/**
 * Normalizálja a dátum stringet ISO (YYYY-MM-DD) formátumra
 */
export function normalizeDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const clean = dateStr.trim();
  // Ha YYYYMMDD formátum (pl. 20260115)
  if (/^\d{8}$/.test(clean)) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`;
  }
  // Ha YYMMDD formátum (pl. 240715 -> 2024-07-15, 980512 -> 1998-05-12)
  if (/^\d{6}$/.test(clean)) {
    const yy = parseInt(clean.slice(0, 2), 10);
    const yyyy = yy > 50 ? 1900 + yy : 2000 + yy;
    return `${yyyy}-${clean.slice(2, 4)}-${clean.slice(4, 6)}`;
  }
  // Ha YYYY.MM.DD vagy DD.MM.YYYY vagy YYYY-MM-DD vagy DD/MM/YYYY
  const parts = clean.split(/[.\-/]/).map(p => p.trim());
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY.MM.DD
      const y = parts[0];
      const m = parts[1].padStart(2, '0');
      const d = parts[2].padStart(2, '0');
      return `${y}-${m}-${d}`;
    } else if (parts[2].length === 4) {
      // DD.MM.YYYY (Magyar szabvány)
      const y = parts[2];
      const m = parts[1].padStart(2, '0');
      const d = parts[0].padStart(2, '0');
      return `${y}-${m}-${d}`;
    } else {
      const y = parts[0].padStart(4, '20');
      const m = parts[1].padStart(2, '0');
      const d = parts[2].padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  return clean;
}

/**
 * Automatikus magyar karakterkódolás-javító (Mojibake detector & healer).
 * Javítja az ISO-8859-2, Windows-1250 és UTF-8 közötti téves dekódolásokból
 * fakadó hibás karaktereket a teljes 18-magánhangzós magyar ábécében.
 */
export function repairHungarianMojibake(str: string | null | undefined): string {
  if (!str) return '';
  return str
    // á / Á
    .replace(/ĂĄ/g, 'á').replace(/\u0102\u0104/g, 'á')
    .replace(/Ă\u00A1/g, 'á').replace(/\u0102\u02C7/g, 'á').replace(/Ã¡/g, 'á')
    .replace(/Ă\u0081/g, 'Á').replace(/Ã\u0081/g, 'Á')
    // é / É
    .replace(/ĂŠ/g, 'é').replace(/\u0102\u0160/g, 'é')
    .replace(/Ă\u00A9/g, 'é').replace(/Ã©/g, 'é')
    .replace(/Ă\u0089/g, 'É').replace(/Ă‰/g, 'É').replace(/\u0102\u2030/g, 'É').replace(/Ã\u0089/g, 'É')
    // í / Í
    .replace(/Ă­/g, 'í').replace(/\u0102\u00AD/g, 'í')
    .replace(/Ă\u00AD/g, 'í').replace(/Ã­/g, 'í')
    .replace(/Ă\u008D/g, 'Í').replace(/Ã\u008D/g, 'Í')
    // ó / Ó
    .replace(/Ăł/g, 'ó').replace(/\u0102\u0142/g, 'ó')
    .replace(/Ă\u00B3/g, 'ó').replace(/Ã³/g, 'ó')
    .replace(/Ă\u0093/g, 'Ó').replace(/\u0102\u201C/g, 'Ó').replace(/Ã\u0093/g, 'Ó')
    // ö / Ö
    .replace(/Ăś/g, 'ö').replace(/\u0102\u015B/g, 'ö')
    .replace(/Ă¶/g, 'ö').replace(/Ă\u00B6/g, 'ö').replace(/Ã¶/g, 'ö')
    .replace(/Ă\u0096/g, 'Ö').replace(/\u0102\u2013/g, 'Ö').replace(/Ã\u0096/g, 'Ö')
    // ő / Ő
    .replace(/Ĺ‘/g, 'ő').replace(/\u0139\u2018/g, 'ő').replace(/Ĺ\u0091/g, 'ő').replace(/\u0139\u0091/g, 'ő').replace(/Å\u0091/g, 'ő')
    .replace(/Ĺ\u0090/g, 'Ő').replace(/\u0139\u0090/g, 'Ő').replace(/ĹŤ/g, 'Ő').replace(/\u0139\u0164/g, 'Ő').replace(/Å\u0090/g, 'Ő')
    // ú / Ú
    .replace(/Ăş/g, 'ú').replace(/\u0102\u015F/g, 'ú')
    .replace(/Ă\u00BA/g, 'ú').replace(/Ãº/g, 'ú')
    .replace(/Ă\u009A/g, 'Ú').replace(/\u0102\u0161/g, 'Ú').replace(/Ã\u009A/g, 'Ú')
    // ü / Ü
    .replace(/Ăź/g, 'ü').replace(/\u0102\u017A/g, 'ü')
    .replace(/Ă\u00BC/g, 'ü').replace(/Ã¼/g, 'ü')
    .replace(/Ă\u009C/g, 'Ü').replace(/\u0102\u0153/g, 'Ü').replace(/Ã\u009C/g, 'Ü')
    // ű / Ű
    .replace(/Ĺ±/g, 'ű').replace(/\u0139\u00B1/g, 'ű').replace(/Ĺ\u00B1/g, 'ű').replace(/Ĺą/g, 'ű').replace(/\u0139\u0105/g, 'ű').replace(/Å±/g, 'ű')
    .replace(/Ĺ\u00B0/g, 'Ű').replace(/\u0139\u00B0/g, 'Ű').replace(/ĹĄ/g, 'Ű').replace(/\u0139\u0104/g, 'Ű').replace(/Å°/g, 'Ű');
}

/**
 * Szöveg megtisztítása felesleges szóközöktől és ékezet-javítással
 */
export function cleanText(val: string | null | undefined): string {
  if (!val) return '';
  return repairHungarianMojibake(val.trim());
}

/**
 * Intelligens fájlolvasó (UTF-8, ISO-8859-2 / Latin-2 és Windows-1250 támogatással)
 */
export async function readTextFileWithEncoding(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const utf8Text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);

  // Ha az XML fejléc ISO-8859-2 vagy windows-1250 kódolást deklarál
  if (/encoding\s*=\s*["'](iso-8859-2|latin2)["']/i.test(utf8Text)) {
    try {
      return new TextDecoder('iso-8859-2').decode(buffer);
    } catch {
      return utf8Text;
    }
  }
  if (/encoding\s*=\s*["'](windows-1250|cp1250)["']/i.test(utf8Text)) {
    try {
      return new TextDecoder('windows-1250').decode(buffer);
    } catch {
      return utf8Text;
    }
  }

  return utf8Text;
}

/**
 * Biztosítja a szám érték konverziót
 */
function parseNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const clean = String(val).replace(/\s/g, '').replace(/,/g, '.');
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : Math.round(n);
}

/**
 * ÁNYK mezők Map-be rendezése egy <nyomtatvany> elementből
 */
function extractAnykFields(formElem: Element): Map<string, string> {
  const map = new Map<string, string>();
  const mezok = formElem.getElementsByTagName('mezo');
  for (let i = 0; i < mezok.length; i++) {
    const m = mezok[i];
    const name = m.getAttribute('nev') ||
                 m.getAttribute('eazon') ||
                 m.getAttribute('azonosito') ||
                 m.getAttribute('id') ||
                 m.getAttribute('name') || '';
    const val = cleanText(m.textContent || '');
    if (name) {
      map.set(name.toUpperCase(), val);
    }
  }
  return map;
}

/**
 * Szemantikus XML parse-olása (<Filing08>, <Tetelsor>, <Bevallas>, stb.)
 */
function parseSemanticXml(doc: Document): Parsed08Document | null {
  const root = doc.documentElement;
  const isFiling = root.tagName.toLowerCase().includes('filing') ||
                   root.tagName.toLowerCase().includes('bevallas') ||
                   doc.querySelector('Tetelsor, Biztositott, Employee, Alkalmazott') !== null;

  if (!isFiling) return null;

  // Cég adatok
  const getTxt = (selector: string) => {
    const el = doc.querySelector(selector);
    return el?.textContent?.trim() || '';
  };

  const companyName = getTxt('companyName, Cegnev, VallalkozasNeve') || '';
  const companyTaxNumber = getTxt('companyTaxNumber, Adoszam, TaxNumber') || '';
  const year = parseInt(getTxt('year, Ev, Year')) || new Date().getFullYear();
  const month = parseInt(getTxt('month, Ho, Month, Honap')) || (new Date().getMonth() + 1);

  const rowElements = doc.querySelectorAll('Tetelsor, Biztositott, Employee, Alkalmazott, Dolgozo, Sor');
  const employees: Parsed08Employee[] = [];

  rowElements.forEach(row => {
    const getRowTxt = (selector: string) => {
      const el = row.querySelector(selector);
      return el?.textContent?.trim() || '';
    };

    const lastName = getRowTxt('Vezeteknev, lastName, Csaladinev, Last_Name') || '';
    const firstName = getRowTxt('Keresztnev, firstName, First_Name') || '';
    const fullName = getRowTxt('Nev, Name, employee_name') || '';

    let lName = lastName;
    let fName = firstName;
    if (!lName && !fName && fullName) {
      const parts = fullName.trim().split(/\s+/);
      lName = parts[0] || '';
      fName = parts.slice(1).join(' ') || '';
    }

    const tajNumber = cleanTaj(getRowTxt('TAJ, tajNumber, TajSzam, TAJ_Number'));
    const taxId = cleanTaxId(getRowTxt('Adoazonosito, taxId, Tax_Id, AdoazonositoJel'));
    const birthDate = normalizeDate(getRowTxt('SzuletesiDatum, birthDate, Szuletesi_Datum'));
    const birthPlace = getRowTxt('SzuletesiHely, birthPlace');
    const mothersName = getRowTxt('AnyjaNeve, mothersName, Anyja_Neve');
    const jobCode = getRowTxt('JogviszonykodT1041, Jogviszonykod, jobCode') || '1101';
    const feorCode = getRowTxt('FEOR, feorCode, FEOR_Kod') || '';
    const weeklyHours = parseNumber(getRowTxt('HetiMunkaido, weeklyHours, Heti_Ora')) || 40;
    const startDate = normalizeDate(getRowTxt('BiztositasKezdete, startDate, KezdoDatum, Belepes')) || `${year}-01-01`;
    const endDate = normalizeDate(getRowTxt('BiztositasVege, endDate, ZaroDatum')) || undefined;

    // Összegek
    const grossSalary = parseNumber(getRowTxt('BruttoJovedelem, grossSalary, Brutto_Ber, Alapber'));
    const taxBase = parseNumber(getRowTxt('SZJAAlap, taxBase')) || grossSalary;
    const szjaAmount = parseNumber(getRowTxt('SZJAOsszeg, szjaAmount, SZJA'));
    const tbBase = parseNumber(getRowTxt('TBAlap, tbBase')) || grossSalary;
    const tbAmount = parseNumber(getRowTxt('TBJarulekOsszeg, tbAmount, TB'));
    const szochoBase = parseNumber(getRowTxt('SZOCHOAlap, szochoBase')) || grossSalary;
    const szochoAmount = parseNumber(getRowTxt('SZOCHOOsszeg, szochoAmount, SZOCHO'));
    const familyCredit = parseNumber(getRowTxt('familyCreditUsed, CsaladiKedvezmeny'));
    const under25Credit = parseNumber(getRowTxt('under25CreditUsed, IfjusagiKedvezmeny'));

    let netSalary = parseNumber(getRowTxt('NettoJovedelem, netSalary, Netto_Ber'));
    const totalDeductions = szjaAmount + tbAmount;
    if (!netSalary && grossSalary) {
      netSalary = Math.max(0, grossSalary - totalDeductions);
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    if (!lName || !fName) errors.push('A dolgozó neve hiányzik');
    if (!tajNumber && !taxId) errors.push('TAJ-szám vagy adóazonosító megadása kötelező');
    if (tajNumber && tajNumber.length !== 9) warnings.push('TAJ formátum nem 9 számjegy');
    if (taxId && taxId.length !== 10) warnings.push('Adóazonosító formátum nem 10 számjegy');

    employees.push({
      lastName: lName,
      firstName: fName,
      birthDate,
      birthPlace,
      mothersName,
      tajNumber,
      taxId,
      jobCode,
      employmentType: 'munkaviszony',
      startDate,
      endDate,
      weeklyHours,
      feorCode,
      baseSalary: grossSalary,
      grossSalary,
      taxBase,
      szjaAmount,
      tbBase,
      tbAmount,
      szochoBase,
      szochoAmount,
      netSalary,
      totalDeductions,
      familyCreditUsed: familyCredit,
      under25CreditUsed: under25Credit,
      valid: errors.length === 0,
      errors,
      warnings,
    });
  });

  const totalGross = employees.reduce((s, e) => s + e.grossSalary, 0);
  const totalSzja = employees.reduce((s, e) => s + e.szjaAmount, 0);
  const totalTb = employees.reduce((s, e) => s + e.tbAmount, 0);
  const totalSzocho = employees.reduce((s, e) => s + e.szochoAmount, 0);
  const totalNet = employees.reduce((s, e) => s + e.netSalary, 0);

  return {
    companyName,
    companyTaxNumber,
    year,
    month,
    filingType: 'semantic',
    totalGrossSalary: totalGross,
    totalSzja,
    totalTb,
    totalSzocho,
    totalNetSalary: totalNet,
    employeeCount: employees.length,
    employees,
    parseErrors: [],
  };
}

/**
 * Segédfüggvény: keresés adott tagek között egy elemen belül névtér-függetlenül
 */
function findTagText(parent: Element | Document | null | undefined, tagNames: string[]): string {
  if (!parent) return '';
  for (const tag of tagNames) {
    // 1. getElementsByTagName (teljesen névtér-független)
    const els = parent.getElementsByTagName(tag);
    if (els && els.length > 0) {
      const txt = els[0].textContent?.trim();
      if (txt) return txt;
    }
    // 2. querySelector fallback
    try {
      const el = parent.querySelector(tag);
      if (el && el.textContent?.trim()) return el.textContent.trim();
    } catch {
      // Selector szintaktikai hiba elnyelése
    }
  }
  return '';
}

/**
 * NAV ÁNYK Nyomtatvány XML parse-olása (2608, 2508, 2408)
 */
function parseAnykXml(doc: Document): Parsed08Document | null {
  // Névtér-függetlenül keressük a nyomtatvany tageket
  let nyomtatvanyok = Array.from(doc.getElementsByTagName('nyomtatvany'));
  if (nyomtatvanyok.length === 0) {
    nyomtatvanyok = Array.from(doc.querySelectorAll('nyomtatvany'));
  }
  if (nyomtatvanyok.length === 0) return null;

  let filingType = '2608';
  let companyName = '';
  let companyTaxNumber = '';
  let year = new Date().getFullYear();
  let month = 0; // 0 = még nem detektált
  const parseErrors: string[] = [];

  const employees: Parsed08Employee[] = [];

  nyomtatvanyok.forEach(nyom => {
    const infoEls = nyom.getElementsByTagName('nyomtatvanyinformacio');
    const info = infoEls.length > 0 ? infoEls[0] : nyom.querySelector('nyomtatvanyinformacio');
    const azonosito = (findTagText(info, ['nyomtatvanyazonosito']) || '').toUpperCase();
    const fields = extractAnykFields(nyom);

    // Évszám meghatározása az azonosítóból (pl. 2608A -> 2026, 2508A -> 2025)
    if (azonosito.startsWith('2608')) { filingType = '2608'; year = 2026; }
    else if (azonosito.startsWith('2508')) { filingType = '2508'; year = 2025; }
    else if (azonosito.startsWith('2408')) { filingType = '2408'; year = 2024; }

    // Megjegyzésből időszak keresés (pl. "01. hó")
    const megjegyzes = findTagText(info, ['megjegyzes']);
    if (megjegyzes) {
      const matchHo = megjegyzes.match(/(\d{1,2})\.\s*hó/i) || megjegyzes.match(/(\d{1,2})\s*hó/i);
      if (matchHo) {
        const parsedHo = parseInt(matchHo[1], 10);
        if (!isNaN(parsedHo) && parsedHo >= 1 && parsedHo <= 12 && month === 0) {
          month = parsedHo;
        }
      }
    }

    // Főlap (08A): Cégadatok és Időszak
    if (azonosito.endsWith('A') || azonosito.includes('08A')) {
      const adozoEl = info ? (info.getElementsByTagName('adozo')[0] || info.querySelector('adozo')) : null;
      const adozoNev = findTagText(adozoEl, ['nev', 'name']);
      const adozoAdoszam = findTagText(adozoEl, ['adoszam', 'taxnumber']);

      companyName = adozoNev ||
                    fields.get('0A0001C013A') ||
                    fields.get('0101B') ||
                    fields.get('CEGNEV') ||
                    fields.get('NEV') ||
                    companyName;

      companyTaxNumber = adozoAdoszam ||
                         fields.get('0A0001C002A') ||
                         fields.get('0101C') ||
                         fields.get('ADOSZAM') ||
                         companyTaxNumber;
      
      const idoszakEl = info ? (info.getElementsByTagName('idoszak')[0] || info.querySelector('idoszak')) : null;
      const idoszakTol = findTagText(idoszakEl, ['tol']) ||
                         fields.get('0A0001C027A') ||
                         fields.get('0101D') ||
                         fields.get('IDOSZAK_TOL') ||
                         fields.get('IDOSZAK_METTOL') ||
                         fields.get('BEVALLASI_IDOSZAK_METTOL') ||
                         '';

      if (idoszakTol) {
        const norm = normalizeDate(idoszakTol);
        const parts = norm.split('-');
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (!isNaN(y) && y >= 2000 && y <= 2100) year = y;
        if (!isNaN(m) && m >= 1 && m <= 12) month = m;
      }

      const hoField = fields.get('HONAP') || fields.get('HO') || fields.get('0101E');
      if (hoField) {
        const parsedHo = parseInt(hoField, 10);
        if (!isNaN(parsedHo) && parsedHo >= 1 && parsedHo <= 12) month = parsedHo;
      }
    }

    // M-lap (08M): Egyéni dolgozói lap
    if (azonosito.endsWith('M') || azonosito.includes('08M')) {
      // 1. Munkavállaló tag a nyomtatvanyinformacio-ban (pl. <munkavallalo><nev>...</nev></munkavallalo>)
      const munkavallaloEl = info ? (info.getElementsByTagName('munkavallalo')[0] || info.querySelector('munkavallalo')) : null;
      const infoNev = findTagText(munkavallaloEl, ['nev', 'name']);
      const infoAdoazonosito = findTagText(munkavallaloEl, ['adoazonosito', 'taxid']);

      // 2. Személyes adatok mezői (ÁNYK 08M: 0A lap eazon kódok és szemantikus nevek)
      let lastName = fields.get('0A0001C017A') || fields.get('VEZETEKNEV') || fields.get('M_VEZETEKNEV') || '';
      let firstName = fields.get('0A0001C018A') || fields.get('KERESZTNEV') || fields.get('M_KERESZTNEV') || '';
      
      const fullName = fields.get('M001A') || fields.get('M001') || fields.get('NEV') || infoNev || '';
      if ((!lastName || !firstName) && fullName) {
        const parts = fullName.trim().split(/\s+/);
        if (!lastName) lastName = parts[0] || '';
        if (!firstName) firstName = parts.slice(1).join(' ') || '';
      }

      const birthLastName = fields.get('0A0001C022A') || '';
      const birthFirstName = fields.get('0A0001C023A') || '';
      const birthName = (birthLastName || birthFirstName) ? `${birthLastName} ${birthFirstName}`.trim() : undefined;

      const motherLastName = fields.get('0A0001C024A') || '';
      const motherFirstName = fields.get('0A0001C025A') || '';
      const mothersName = fields.get('M006') ||
                          fields.get('ANYJA_NEVE') ||
                          ((motherLastName || motherFirstName) ? `${motherLastName} ${motherFirstName}`.trim() : undefined);

      const birthPlace = fields.get('0A0001C026A') || fields.get('M005') || fields.get('SZUL_HELY') || '';
      const birthDate = normalizeDate(
        fields.get('0A0001C027A') ||
        fields.get('M004') ||
        fields.get('SZUL_DATUM') ||
        fields.get('SZULETESI_DATUM') ||
        ''
      );

      const tajNumber = cleanTaj(
        fields.get('0A0001D001A') ||
        fields.get('M002') ||
        fields.get('TAJ') ||
        fields.get('TAJ_SZAM') ||
        ''
      );

      const taxId = cleanTaxId(
        fields.get('0A0001C007A') ||
        fields.get('M003') ||
        fields.get('ADOAZONOSITO') ||
        fields.get('ADO_AZON') ||
        infoAdoazonosito ||
        ''
      );

      // Időszak kinyerése az M-lapból, ha a főlapból nem volt elérhető
      const mIdoszakEl = info ? (info.getElementsByTagName('idoszak')[0] || info.querySelector('idoszak')) : null;
      const mIdoszakTol = findTagText(mIdoszakEl, ['tol']) ||
                          fields.get('0A0001E001A') ||
                          fields.get('0F0001C001A') ||
                          fields.get('M0404') ||
                          fields.get('BIZT_KEZDET') ||
                          '';
      if (mIdoszakTol && month === 0) {
        const norm = normalizeDate(mIdoszakTol);
        const parts = norm.split('-');
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (!isNaN(y) && y >= 2000 && y <= 2100) year = y;
        if (!isNaN(m) && m >= 1 && m <= 12) month = m;
      }

      // 3. Jogviszony adatok (08M 0F lap az ÁNYK-ban)
      const rawJobCode = fields.get('0F0001C004A') ||
                         fields.get('M0401') ||
                         fields.get('JOGVISZONYKOD') ||
                         fields.get('ALK_MIN') ||
                         '1101';
      // ÁNYK 08 kód '20' = heti 36 órát elérő munkaviszony (T1041-ben 1101)
      const jobCode = rawJobCode === '20' ? '1101' : rawJobCode;

      const feorCode = fields.get('0F0001D0520AA') || fields.get('M0402') || fields.get('FEOR') || '';
      const weeklyHours = parseNumber(fields.get('0F0001D0524AA') || fields.get('M0403') || fields.get('HETI_ORA') || 40);
      const effectiveMonth = month > 0 ? month : (new Date().getMonth() + 1);
      const startDate = normalizeDate(
        fields.get('0F0001C005A') ||
        fields.get('0F0001C001A') ||
        fields.get('0A0001E001A') ||
        fields.get('M0404') ||
        fields.get('BIZT_KEZDET') ||
        `${year}-${String(effectiveMonth).padStart(2, '0')}-01`
      );
      const endDate = normalizeDate(
        fields.get('0F0001C002A') ||
        fields.get('0A0001E002A') ||
        fields.get('M0405') ||
        fields.get('BIZT_VEGE')
      ) || undefined;

      // 4. Jövedelmek és közterhek
      const grossSalary = parseNumber(
        fields.get('0B0001D0270DA') ||
        fields.get('0B0001D0288DA') ||
        fields.get('0I0001D0626CA') ||
        fields.get('M0406') ||
        fields.get('BRUTTO_BER') ||
        fields.get('ALAPBER') ||
        fields.get('M04_BER')
      );

      const taxBase = parseNumber(
        fields.get('0C0001C0324BA') ||
        fields.get('0C0001C0325BA') ||
        fields.get('M0501') ||
        fields.get('SZJA_ALAP') ||
        grossSalary
      );

      const szjaAmount = parseNumber(
        fields.get('0C0001D0330BA') ||
        fields.get('0C0001D0331BA') ||
        fields.get('M0502') ||
        fields.get('LEVONT_SZJA') ||
        fields.get('SZJA')
      );

      const tbBase = parseNumber(
        fields.get('0I0001D0626CA') ||
        fields.get('0I0001D0634CA') ||
        fields.get('M0601') ||
        fields.get('TB_ALAP') ||
        grossSalary
      );

      let tbAmount = parseNumber(
        fields.get('0I0001D0629CA') ||
        fields.get('0I0001D0633CA') ||
        fields.get('M0602') ||
        fields.get('LEVONT_TB') ||
        fields.get('TB')
      );
      if (!tbAmount && grossSalary > 0) {
        // Törvényes 18,5% TB járulék kalkuláció ha nincs külön kitöltve
        tbAmount = Math.round(tbBase * 0.185);
      }

      const szochoBase = parseNumber(
        fields.get('0I0001D0634CA') ||
        fields.get('M0701') ||
        fields.get('SZOCHO_ALAP') ||
        grossSalary
      );

      let szochoAmount = parseNumber(
        fields.get('M0702') ||
        fields.get('SZOCHO_OSSZEG') ||
        fields.get('SZOCHO')
      );
      if (!szochoAmount && szochoBase > 0) {
        // 13% SZOCHO kalkuláció
        szochoAmount = Math.round(szochoBase * 0.13);
      }

      const familyCredit = parseNumber(fields.get('M0503') || fields.get('CSALADI_KEDV'));
      const under25Credit = parseNumber(
        fields.get('0C0001C0319BA') ||
        fields.get('M0504') ||
        fields.get('25_EV_ALATTI_KEDV')
      );

      const totalDeductions = szjaAmount + tbAmount;
      const netSalary = Math.max(0, grossSalary - totalDeductions);

      const errors: string[] = [];
      const warnings: string[] = [];
      if (!lastName && !firstName) errors.push('Név hiányzik');
      if (!tajNumber && !taxId) errors.push('TAJ szám vagy adóazonosító kötelező');

      employees.push({
        lastName,
        firstName,
        birthName,
        birthDate,
        birthPlace,
        mothersName,
        tajNumber,
        taxId,
        jobCode,
        employmentType: 'munkaviszony',
        startDate,
        endDate,
        weeklyHours: weeklyHours || 40,
        feorCode,
        baseSalary: grossSalary,
        grossSalary,
        taxBase,
        szjaAmount,
        tbBase,
        tbAmount,
        szochoBase,
        szochoAmount,
        netSalary,
        totalDeductions,
        familyCreditUsed: familyCredit,
        under25CreditUsed: under25Credit,
        valid: errors.length === 0,
        errors,
        warnings,
      });
    }
  });

  // Ha a hónap még mindig 0, állítsuk az aktuális hónapra
  const finalMonth = month > 0 ? month : (new Date().getMonth() + 1);

  const totalGross = employees.reduce((s, e) => s + e.grossSalary, 0);
  const totalSzja = employees.reduce((s, e) => s + e.szjaAmount, 0);
  const totalTb = employees.reduce((s, e) => s + e.tbAmount, 0);
  const totalSzocho = employees.reduce((s, e) => s + e.szochoAmount, 0);
  const totalNet = employees.reduce((s, e) => s + e.netSalary, 0);

  return {
    companyName,
    companyTaxNumber,
    year,
    month: finalMonth,
    filingType,
    totalGrossSalary: totalGross,
    totalSzja,
    totalTb,
    totalSzocho,
    totalNetSalary: totalNet,
    employeeCount: employees.length,
    employees,
    parseErrors,
  };
}

/**
 * Fő belépési pont: XML szöveg feldolgozása
 */
export function parseFiling08Xml(xmlContent: string): Parsed08Document {
  const clean = xmlContent.trim().replace(/^\uFEFF/, '');
  const parser = new DOMParser();
  const doc = parser.parseFromString(clean, 'text/xml');

  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    return {
      companyName: '',
      companyTaxNumber: '',
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
      filingType: 'unknown',
      totalGrossSalary: 0,
      totalSzja: 0,
      totalTb: 0,
      totalSzocho: 0,
      totalNetSalary: 0,
      employeeCount: 0,
      employees: [],
      rawXml: clean,
      parseErrors: ['Érvénytelen XML struktúra: ' + (parserError.textContent?.slice(0, 150) || 'Parse error')],
    };
  }

  // 1. Próbáljuk ÁNYK nyomtatványként
  const anykResult = parseAnykXml(doc);
  if (anykResult && anykResult.employees.length > 0) {
    anykResult.rawXml = clean;
    return anykResult;
  }

  // 2. Próbáljuk szemantikus XML formátumként
  const semanticResult = parseSemanticXml(doc);
  if (semanticResult && semanticResult.employees.length > 0) {
    semanticResult.rawXml = clean;
    return semanticResult;
  }

  // 3. Ha egyik sem talált dolgozókat, de van érvényes XML
  return {
    companyName: anykResult?.companyName || semanticResult?.companyName || '',
    companyTaxNumber: anykResult?.companyTaxNumber || semanticResult?.companyTaxNumber || '',
    year: anykResult?.year || semanticResult?.year || new Date().getFullYear(),
    month: anykResult?.month || semanticResult?.month || (new Date().getMonth() + 1),
    filingType: 'empty',
    totalGrossSalary: 0,
    totalSzja: 0,
    totalTb: 0,
    totalSzocho: 0,
    totalNetSalary: 0,
    employeeCount: 0,
    employees: [],
    rawXml: clean,
    parseErrors: ['A megadott XML fájlban nem találhatók 08M dolgozói lapok vagy tételelemek.'],
  };
}
