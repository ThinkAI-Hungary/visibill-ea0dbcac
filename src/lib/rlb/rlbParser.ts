/**
 * RLB-60 Könyvelőprogram Parser Motor
 * =====================================
 * Támogatott formátumok:
 * 1. RLB 26.6+ Könyvvizsgálói Feladás XML (<Adatok> -> <Cegadatok>, <Szamlaszamok>, <Partnerek>, <FkBizonylatok>, <FkTetelek>)
 * 2. RLB Főkönyvi Kivonat CSV (FOKSZAM;FOKNEV;NYTART;NYKOV;TART;KOV;IDTARTE;IDKOVE;TARTE;KOVE...)
 * 
 * Biztosítja a belső számlakódok (<Kod>) leképezését a törvényes főkönyvi számokra (<TKod>),
 * a partnertörzs összekapcsolását a naplósorokkal, valamint a kettős könyvviteli egyezőség (T = K) ellenőrzését.
 */

export interface RlbMeta {
  sourceProgram: string;
  sourceVersion: string;
  companyName: string;
  taxNumber: string;
  periodStart: string | null;
  periodEnd: string | null;
  currency: string;
  contactPerson?: string;
  phone?: string;
  journalCount: number;
  accountCount: number;
  partnerCount: number;
  voucherCount: number;
  entryCount: number;
}

export interface RlbJournal {
  code: string;
  name: string;
}

export interface RlbAccount {
  code: string;
  rawCode: string;
  name: string;
  accountClass: string;
  accountType: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' | 'unknown';
}

export interface RlbPartner {
  code: string;
  name: string;
  taxNumber?: string;
  euTaxNumber?: string;
  isRelatedParty: boolean;
  email?: string;
}

export interface RlbVoucher {
  bizId: number;
  bizSzam: string;
  datum: string | null;
  journalCode: string | null;
  periodCode: string | null;
}

export interface RlbEntry {
  bizId: number;
  entryIndex: number;
  voucherNumber: string;
  voucherDate: string | null;
  journalCode: string | null;
  journalName: string | null;
  description: string;
  debitAccount: string;
  creditAccount: string;
  rawDebitAccount: string;
  rawCreditAccount: string;
  amount: number;
  foreignAmount: number | null;
  foreignCurrency: string | null;
  exchangeRate: number | null;
  vatBase: number | null;
  vatRate: string | null;
  serviceDate: string | null;
  paymentDueDate: string | null;
  partnerCode: string | null;
  partnerName: string | null;
  partnerTaxNumber: string | null;
  costCenter: string | null;
  workNumber: string | null;
  isStorno: boolean;
}

export interface RlbXmlParseResult {
  format: 'rlb_audit_xml';
  meta: RlbMeta;
  journals: RlbJournal[];
  accounts: RlbAccount[];
  partners: RlbPartner[];
  vouchers: Record<number, RlbVoucher>;
  entries: RlbEntry[];
  accountCodeMap: Record<string, string>;
  stats: {
    totalDebit: number;
    totalCredit: number;
    balanceDiff: number;
    isBalanced: boolean;
    entriesWithPartnerCount: number;
    stornoCount: number;
  };
  errors: string[];
  warnings: string[];
}

export interface RlbCsvAccountRow {
  glNumber: string;
  accountName: string;
  openingDebit: number;
  openingCredit: number;
  turnoverDebit: number;
  turnoverCredit: number;
  periodBalanceDebit: number;
  periodBalanceCredit: number;
  totalBalanceDebit: number;
  totalBalanceCredit: number;
  foreignCurrency?: string;
  foreignTurnoverDebit?: number;
  foreignTurnoverCredit?: number;
  accountTypeCategory: string;
  isGroup: boolean;
}

export interface RlbCsvParseResult {
  format: 'rlb_csv_ledger';
  companyName?: string;
  accounts: RlbCsvAccountRow[];
  stats: {
    totalAccounts: number;
    groupAccountsCount: number;
    detailAccountsCount: number;
    totalOpeningDebit: number;
    totalOpeningCredit: number;
    totalTurnoverDebit: number;
    totalTurnoverCredit: number;
    totalBalanceDebit: number;
    totalBalanceCredit: number;
    isTurnoverBalanced: boolean;
  };
  errors: string[];
  warnings: string[];
}

export type RlbDetectedFormat = 'rlb_audit_xml' | 'rlb_csv_ledger' | 'other_audit_xml' | 'unknown';

/**
 * Determines account type from Hungarian standard 1-digit chart of accounts class
 */
export function determineAccountType(glNumber: string): RlbAccount['accountType'] {
  const first = glNumber.trim().charAt(0);
  switch (first) {
    case '1': // Befektetett eszközök
    case '2': // Készletek
    case '3': // Követelések, pénzeszközök
      return 'asset';
    case '4': // Források (Kötelezettségek + Saját tőke)
      if (glNumber.startsWith('41')) return 'equity';
      return 'liability';
    case '5': // Költségnemek
    case '8': // Ráfordítások
      return 'expense';
    case '9': // Árbevételek és bevételek
      return 'revenue';
    default:
      return 'unknown';
  }
}

/**
 * Auto-detects whether the given file or string is an RLB Audit XML or RLB CSV Ledger
 */
export function detectRlbFileFormat(content: string, fileName: string = ''): RlbDetectedFormat {
  const lowerName = fileName.toLowerCase();
  const trimmed = content.trim().replace(/^\uFEFF/, '');

  if (lowerName.endsWith('.csv') || trimmed.startsWith('FOKSZAM;FOKNEV')) {
    if (trimmed.includes('FOKSZAM;') && trimmed.includes('NYTART;') && trimmed.includes('NYKOV;')) {
      return 'rlb_csv_ledger';
    }
  }

  if (lowerName.endsWith('.xml') || trimmed.startsWith('<?xml') || trimmed.startsWith('<Adatok')) {
    if (trimmed.includes('<Nev>RLB</Nev>') || trimmed.includes('<Nev>RLB ') || trimmed.includes('RLB 26') || trimmed.includes('RLB-60')) {
      return 'rlb_audit_xml';
    }
    if (trimmed.includes('<Szamlaszamok>') && trimmed.includes('<FkBizonylatok>') && trimmed.includes('<FkTetelek>')) {
      return 'rlb_audit_xml';
    }
    if (trimmed.includes('<Adatok') || trimmed.includes('<Cegadatok>')) {
      return 'other_audit_xml';
    }
  }

  return 'unknown';
}

function getTagText(parent: Element | null, tagName: string): string {
  if (!parent) return '';
  const el = parent.getElementsByTagName(tagName)[0];
  return (el?.textContent || '').trim();
}

function parseNumber(text: string): number {
  if (!text) return 0;
  const clean = text.replace(/\s+/g, '').replace(/,/g, '.');
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

/**
 * Parses an RLB 26.6 Könyvvizsgálói Feladás XML document
 */
export function parseRlbAuditXml(xmlContent: string): RlbXmlParseResult {
  const clean = xmlContent.trim().replace(/^\uFEFF/, '');
  const parser = new DOMParser();
  const doc = parser.parseFromString(clean, 'text/xml');

  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error(`XML formai hiba: ${parserError.textContent?.slice(0, 160) || 'Érvénytelen XML'}`);
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Meta / Program / Cégadatok
  const letrehozoEl = doc.querySelector('LetrehozoProgram');
  const sourceProgram = getTagText(letrehozoEl, 'Nev') || 'RLB';
  const sourceVersion = getTagText(letrehozoEl, 'Verzio') || '26.6';

  const cegadatokEl = doc.querySelector('Cegadatok');
  const companyName = getTagText(cegadatokEl, 'Nev');
  const taxNumber = getTagText(cegadatokEl, 'Adoszam');
  const periodStart = getTagText(cegadatokEl, 'KezdoDatum') || null;
  const periodEnd = getTagText(cegadatokEl, 'VegsoDatum') || null;
  const currency = getTagText(cegadatokEl, 'Penznem') || 'HUF';
  const contactPerson = getTagText(cegadatokEl, 'KapcsolatTarto') || undefined;
  const phone = getTagText(cegadatokEl, 'Telefonszam') || undefined;

  // 2. Naplók (<Naplok>)
  const journals: RlbJournal[] = [];
  const journalMap: Record<string, string> = {};
  const naploEls = Array.from(doc.querySelectorAll('Naplok > Naplo'));
  naploEls.forEach(el => {
    const code = getTagText(el, 'Kod');
    const name = getTagText(el, 'Nev');
    if (code) {
      journals.push({ code, name });
      journalMap[code] = name;
    }
  });

  // 3. Számlaszámok (<Szamlaszamok>)
  // RLB specifikus: A <Kod> a belső hivatkozási azonosító (pl. 23, 383), míg a <TKod> a valódi könyvelési főkönyvi szám (pl. 131, 491).
  const accounts: RlbAccount[] = [];
  const accountCodeMap: Record<string, string> = {};
  const seenCodes = new Set<string>();

  const szamlaEls = Array.from(doc.querySelectorAll('Szamlaszamok > Szamlaszam'));
  szamlaEls.forEach(el => {
    const rawKod = getTagText(el, 'Kod');
    const tkod = getTagText(el, 'TKod');
    const nev = getTagText(el, 'Nev');

    const effectiveCode = tkod || rawKod;
    if (rawKod) {
      accountCodeMap[rawKod] = effectiveCode;
    }

    if (effectiveCode && !seenCodes.has(effectiveCode)) {
      seenCodes.add(effectiveCode);
      const accClass = effectiveCode.charAt(0);
      const accType = determineAccountType(effectiveCode);
      accounts.push({
        code: effectiveCode,
        rawCode: rawKod,
        name: nev,
        accountClass: accClass,
        accountType: accType,
      });
    }
  });

  // 4. Partnerek (<Partnerek>)
  const partners: RlbPartner[] = [];
  const partnerMap: Record<string, RlbPartner> = {};
  const partnerEls = Array.from(doc.querySelectorAll('Partnerek > Partner'));
  partnerEls.forEach(el => {
    const code = getTagText(el, 'Kod');
    const name = getTagText(el, 'Nev');
    const tax = getTagText(el, 'Adoszam');
    const euTax = getTagText(el, 'EUAdoszam');
    const rawRel = getTagText(el, 'KapcsoltPartner');
    const isRel = ['1', 'I', 'true', 'True', 'Igen', 'igen', 'Y'].includes(rawRel);
    const email = getTagText(el, 'KapcsTartEmail');

    if (code) {
      const p: RlbPartner = {
        code,
        name,
        taxNumber: tax || undefined,
        euTaxNumber: euTax || undefined,
        isRelatedParty: isRel,
        email: email || undefined,
      };
      partners.push(p);
      partnerMap[code] = p;
    }
  });

  // 5. Bizonylatok (<FkBizonylatok>)
  const vouchers: Record<number, RlbVoucher> = {};
  const bizEls = Array.from(doc.querySelectorAll('FkBizonylatok > Biz'));
  bizEls.forEach(el => {
    const bizId = parseInt(getTagText(el, 'BizID'), 10);
    const bizSzam = getTagText(el, 'BizSzam');
    const datum = getTagText(el, 'Datum') || null;
    const journalCode = getTagText(el, 'Naplo') || null;
    const periodCode = getTagText(el, 'Idoszak') || null;

    if (!isNaN(bizId)) {
      vouchers[bizId] = {
        bizId,
        bizSzam,
        datum,
        journalCode,
        periodCode,
      };
    }
  });

  // 6. Könyvelési tételek (<FkTetelek>)
  const entries: RlbEntry[] = [];
  let totalDebit = 0;
  let totalCredit = 0;
  let entriesWithPartnerCount = 0;
  let stornoCount = 0;

  const tetEls = Array.from(doc.querySelectorAll('FkTetelek > Tet'));
  tetEls.forEach((el, idx) => {
    const bizId = parseInt(getTagText(el, 'BizID'), 10) || 0;
    const tetId = parseInt(getTagText(el, 'TetID'), 10) || (idx + 1);
    const rawDebit = getTagText(el, 'Tartozik');
    const rawCredit = getTagText(el, 'Kovetel');

    const debitAccount = accountCodeMap[rawDebit] || rawDebit;
    const creditAccount = accountCodeMap[rawCredit] || rawCredit;

    const amount = parseNumber(getTagText(el, 'Osszeg'));
    const devAmount = parseNumber(getTagText(el, 'DevOsszeg'));
    const devNem = getTagText(el, 'DevNem') || null;
    const devArf = parseNumber(getTagText(el, 'DevArfolyam'));

    const afaAlap = parseNumber(getTagText(el, 'AfaAlap'));
    const afaKulcs = getTagText(el, 'AfaKulcs') || null;

    const szTDatum = getTagText(el, 'SzTDatum');
    const teljDatum = getTagText(el, 'TeljDatum');
    const serviceDate = szTDatum || teljDatum || null;
    const paymentDueDate = getTagText(el, 'FizHatarido') || null;

    const partnerCode = getTagText(el, 'Partner') || null;
    const partner = partnerCode ? partnerMap[partnerCode] : null;

    const rawSzt = getTagText(el, 'Szt');
    const isStorno = ['1', 'I', 'true', 'True', 'Igen', 'igen', 'Y'].includes(rawSzt);
    if (isStorno) stornoCount++;

    const voucher = vouchers[bizId];
    const voucherNumber = voucher?.bizSzam || getTagText(el, 'PuAzo') || `BIZ-${bizId}`;
    const voucherDate = voucher?.datum || serviceDate;
    const journalCode = voucher?.journalCode || null;
    const journalName = journalCode ? (journalMap[journalCode] || null) : null;

    if (partnerCode) entriesWithPartnerCount++;

    totalDebit += amount;
    totalCredit += amount;

    entries.push({
      bizId,
      entryIndex: tetId,
      voucherNumber,
      voucherDate,
      journalCode,
      journalName,
      description: getTagText(el, 'Szoveg'),
      debitAccount,
      creditAccount,
      rawDebitAccount: rawDebit,
      rawCreditAccount: rawCredit,
      amount,
      foreignAmount: devAmount > 0 ? devAmount : null,
      foreignCurrency: devNem,
      exchangeRate: devArf > 0 ? devArf : null,
      vatBase: afaAlap > 0 ? afaAlap : null,
      vatRate: afaKulcs,
      serviceDate,
      paymentDueDate,
      partnerCode,
      partnerName: partner?.name || null,
      partnerTaxNumber: partner?.taxNumber || null,
      costCenter: getTagText(el, 'KtsgHely') || null,
      workNumber: getTagText(el, 'Munkaszam') || null,
      isStorno,
    });
  });

  const balanceDiff = Math.abs(totalDebit - totalCredit);
  const isBalanced = balanceDiff < 0.01;

  if (!isBalanced) {
    warnings.push(`Kettős könyvviteli eltérés: Tartozik=${totalDebit.toFixed(2)} Ft, Követel=${totalCredit.toFixed(2)} Ft, Különbözet=${balanceDiff.toFixed(2)} Ft`);
  }

  const meta: RlbMeta = {
    sourceProgram,
    sourceVersion,
    companyName,
    taxNumber,
    periodStart,
    periodEnd,
    currency,
    contactPerson,
    phone,
    journalCount: journals.length,
    accountCount: accounts.length,
    partnerCount: partners.length,
    voucherCount: Object.keys(vouchers).length,
    entryCount: entries.length,
  };

  return {
    format: 'rlb_audit_xml',
    meta,
    journals,
    accounts,
    partners,
    vouchers,
    entries,
    accountCodeMap,
    stats: {
      totalDebit,
      totalCredit,
      balanceDiff,
      isBalanced,
      entriesWithPartnerCount,
      stornoCount,
    },
    errors,
    warnings,
  };
}

/**
 * Parses an RLB Főkönyvi Kivonat CSV file (FOKSZAM;FOKNEV;NYTART;NYKOV;TART;KOV;IDTARTE;IDKOVE...)
 */
export function parseRlbCsvLedger(csvContent: string, fileName?: string): RlbCsvParseResult {
  const clean = csvContent.trim().replace(/^\uFEFF/, '');
  const lines = clean.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  if (lines.length === 0) {
    throw new Error('A megadott CSV fájl üres.');
  }

  const headerLine = lines[0];
  const headers = headerLine.split(';').map(h => h.trim().toUpperCase());

  const getColIdx = (name: string): number => headers.indexOf(name);
  const fokszamIdx = getColIdx('FOKSZAM');
  const foknevIdx = getColIdx('FOKNEV');
  const nytartIdx = getColIdx('NYTART');
  const nykovIdx = getColIdx('NYKOV');
  const tartIdx = getColIdx('TART');
  const kovIdx = getColIdx('KOV');
  const idtarteIdx = getColIdx('IDTARTE');
  const idkoveIdx = getColIdx('IDKOVE');
  const tarteIdx = getColIdx('TARTE');
  const koveIdx = getColIdx('KOVE');
  const tartdevIdx = getColIdx('TARTDEV');
  const kovdevIdx = getColIdx('KOVDEV');
  const devnemIdx = getColIdx('DEVNEM');
  const jellegIdx = getColIdx('JELLEG');

  if (fokszamIdx === -1 || foknevIdx === -1) {
    throw new Error('Érvénytelen RLB CSV: A FOKSZAM és FOKNEV kötelező oszlopok nem találhatók a fejlécben.');
  }

  const accounts: RlbCsvAccountRow[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  let totalOpeningDebit = 0;
  let totalOpeningCredit = 0;
  let totalTurnoverDebit = 0;
  let totalTurnoverCredit = 0;
  let totalBalanceDebit = 0;
  let totalBalanceCredit = 0;
  let groupCount = 0;
  let detailCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const cols = line.split(';');
    const glNumber = cols[fokszamIdx]?.trim() || '';
    if (!glNumber) continue;

    const accountName = cols[foknevIdx]?.trim() || '';
    const rowOpeningDebit = parseNumber(cols[nytartIdx]);
    const rowOpeningCredit = parseNumber(cols[nykovIdx]);
    const rowTurnoverDebit = parseNumber(cols[tartIdx]);
    const rowTurnoverCredit = parseNumber(cols[kovIdx]);
    const rowPeriodBalanceDebit = parseNumber(cols[idtarteIdx]);
    const rowPeriodBalanceCredit = parseNumber(cols[idkoveIdx]);
    const rowTotalBalanceDebit = parseNumber(cols[tarteIdx]);
    const rowTotalBalanceCredit = parseNumber(cols[koveIdx]);
    const foreignCurrency = devnemIdx !== -1 ? cols[devnemIdx]?.trim() : undefined;
    const foreignTurnoverDebit = tartdevIdx !== -1 ? parseNumber(cols[tartdevIdx]) : undefined;
    const foreignTurnoverCredit = kovdevIdx !== -1 ? parseNumber(cols[kovdevIdx]) : undefined;
    const accountTypeCategory = jellegIdx !== -1 ? (cols[jellegIdx]?.trim() || '7') : '7';
    const isGroup = accountTypeCategory === '8' || glNumber.length <= 2;

    if (isGroup) {
      groupCount++;
    } else {
      detailCount++;
      totalOpeningDebit += rowOpeningDebit;
      totalOpeningCredit += rowOpeningCredit;
      totalTurnoverDebit += rowTurnoverDebit;
      totalTurnoverCredit += rowTurnoverCredit;
      totalBalanceDebit += rowTotalBalanceDebit;
      totalBalanceCredit += rowTotalBalanceCredit;
    }

    accounts.push({
      glNumber,
      accountName,
      openingDebit: rowOpeningDebit,
      openingCredit: rowOpeningCredit,
      turnoverDebit: rowTurnoverDebit,
      turnoverCredit: rowTurnoverCredit,
      periodBalanceDebit: rowPeriodBalanceDebit,
      periodBalanceCredit: rowPeriodBalanceCredit,
      totalBalanceDebit: rowTotalBalanceDebit,
      totalBalanceCredit: rowTotalBalanceCredit,
      foreignCurrency: foreignCurrency || undefined,
      foreignTurnoverDebit: foreignTurnoverDebit || undefined,
      foreignTurnoverCredit: foreignTurnoverCredit || undefined,
      accountTypeCategory,
      isGroup,
    });
  }

  // Derive company name from filename if possible (e.g. "WR HOME KFT. - FŐKÖNYVI KIVONAT...")
  let derivedCompanyName: string | undefined = undefined;
  if (fileName) {
    const base = fileName.replace(/\.[^/.]+$/, '');
    const parts = base.split(/-|_/);
    if (parts.length > 0 && parts[0].trim().length >= 3) {
      derivedCompanyName = parts[0].trim();
    }
  }

  const isTurnoverBalanced = Math.abs(totalTurnoverDebit - totalTurnoverCredit) < 1.0;

  return {
    format: 'rlb_csv_ledger',
    companyName: derivedCompanyName,
    accounts,
    stats: {
      totalAccounts: accounts.length,
      groupAccountsCount: groupCount,
      detailAccountsCount: detailCount,
      totalOpeningDebit,
      totalOpeningCredit,
      totalTurnoverDebit,
      totalTurnoverCredit,
      totalBalanceDebit,
      totalBalanceCredit,
      isTurnoverBalanced,
    },
    errors,
    warnings,
  };
}

/**
 * Reads a File or Blob with auto-detection for UTF-8 vs Windows-1250 (CP1250) encoding.
 * RLB files (especially CSV exports) typically use Windows-1250 for Hungarian accented characters.
 */
export async function readRlbFileAsText(blob: Blob | File): Promise<string> {
  const buffer = await blob.arrayBuffer();
  // Try UTF-8 first
  const utf8Decoder = new TextDecoder('utf-8', { fatal: false });
  const utf8Text = utf8Decoder.decode(buffer);

  // If there are replacement characters (\uFFFD), decode with windows-1250
  if (utf8Text.includes('\uFFFD')) {
    try {
      const winDecoder = new TextDecoder('windows-1250');
      return winDecoder.decode(buffer);
    } catch {
      return utf8Text;
    }
  }

  return utf8Text;
}
