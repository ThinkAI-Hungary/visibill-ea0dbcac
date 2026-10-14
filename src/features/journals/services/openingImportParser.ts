import * as XLSX from 'xlsx';

export interface ParsedOpeningLine {
  gl_number: string;
  dc_type: 'T' | 'K';
  amount: number;
  description: string;
  partner_name?: string;
  document_id?: string;
  due_date?: string;
}

export interface ParsedOpeningInvoice {
  type: 'customer' | 'supplier';
  gl_number: string;
  partner_name: string;
  document_id: string;
  amount: number;
  currency: string;
  due_date?: string;
  posting_date?: string;
}

export interface OpeningImportReport {
  format: 'minimax' | 'generic_csv' | 'generic_excel' | 'json';
  formatName: string;
  currency: string;
  suggestedDate?: string;
  suggestedYear?: number;
  totalDebit: number;
  totalCredit: number;
  imbalance: number;
  isBalanced: boolean;
  aggregatedItems: ParsedOpeningLine[];
  detailedItems: ParsedOpeningLine[];
  subledgerInvoices: ParsedOpeningInvoice[];
  rawRowCount: number;
}

/**
 * Converts an Excel serial date number (e.g. 46023) to an ISO string (YYYY-MM-DD).
 */
export function excelSerialToIsoDate(serial: any): string {
  if (typeof serial === 'string') {
    const trimmed = serial.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(trimmed)) {
      const [d, m, y] = trimmed.split('.');
      return `${y}-${m}-${d}`;
    }
    const parsedNum = parseFloat(trimmed);
    if (!isNaN(parsedNum) && parsedNum > 20000 && parsedNum < 80000) {
      serial = parsedNum;
    } else {
      return '';
    }
  }

  if (typeof serial === 'number' && !isNaN(serial) && serial > 0) {
    const utcDays = Math.floor(serial - 25569);
    const utcValue = utcDays * 86400;
    const dateInfo = new Date(utcValue * 1000);
    if (!isNaN(dateInfo.getTime())) {
      return dateInfo.toISOString().split('T')[0];
    }
  }
  return '';
}

/**
 * Cleans monetary string or number representation into a standard float.
 */
export function parseAmount(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).trim().replace(/\s/g, '').replace(',', '.');
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Checks if a parsed sheet matches the Minimax Croatian advanced journal format.
 */
function isMinimaxFormat(headers: string[]): boolean {
  const normalized = headers.map(h => h.trim().toLowerCase());
  const hasKonto = normalized.some(h => h === 'konto' || h.includes('konto'));
  const hasDuguje = normalized.some(h => h.includes('duguje'));
  const hasPotrazuje = normalized.some(h => h.includes('potražuje') || h.includes('potrazuje'));
  return hasKonto && hasDuguje && hasPotrazuje;
}

/**
 * Parses Minimax Croatian opening Excel rows.
 */
function parseMinimaxRows(rows: any[]): OpeningImportReport {
  let detectedCurrency = 'EUR';
  let suggestedDate = '';
  let suggestedYear: number | undefined;

  let totalDebit = 0;
  let totalCredit = 0;

  const detailedItems: ParsedOpeningLine[] = [];
  const subledgerInvoices: ParsedOpeningInvoice[] = [];

  // Konto aggregation map: Konto -> { debit: number, credit: number, descriptions: Set<string> }
  const kontoMap = new Map<string, { debit: number; credit: number; sampleDesc: string; partner?: string }>();

  for (const r of rows) {
    const kontoRaw = r['Konto'] || r['konto'];
    if (!kontoRaw) continue;
    const konto = String(kontoRaw).trim();

    const curr = r['Skraćenica novčane jedinice'] || r['Valuta'] || r['valuta'];
    if (curr && typeof curr === 'string' && curr.trim().length > 0) {
      detectedCurrency = curr.trim().toUpperCase();
    }

    const datumTem = r['Datum tem.'] || r['datum tem.'] || r['Datum'];
    if (datumTem && !suggestedDate) {
      suggestedDate = excelSerialToIsoDate(datumTem);
      if (suggestedDate) {
        suggestedYear = parseInt(suggestedDate.substring(0, 4), 10);
      }
    }

    // Amounts
    const dugujeDom = parseAmount(r['Iznos duguje u domaćoj novčanoj jedinici']);
    const potrazujeDom = parseAmount(r['Iznos potražuje u domaćoj novčanoj jedinici']);
    const dugujeOrig = parseAmount(r['Iznos duguje u originalnoj novčanoj jedinici.']);
    const potrazujeOrig = parseAmount(r['Iznos potražuje u originalnoj novčanoj jedinici.']);

    // Prefer domestic amount if present and nonzero, otherwise original
    const debit = dugujeDom !== 0 ? dugujeDom : dugujeOrig;
    const credit = potrazujeDom !== 0 ? potrazujeDom : potrazujeOrig;

    totalDebit += debit;
    totalCredit += credit;

    const desc = (r['Opis knjiženja'] || r['Opis'] || 'Nyitó tétel').toString().trim();
    const partner = (r['Stranka'] || r['Partner'] || '').toString().trim();
    const docId = (r['Veza za plaćanje'] || r['Dokument'] || '').toString().trim();
    const dueDateRaw = r['Datum dospijeća'];
    const dueDate = dueDateRaw ? excelSerialToIsoDate(dueDateRaw) : undefined;
    const postingDateRaw = r['Datum knjiženja'];
    const postingDate = postingDateRaw ? excelSerialToIsoDate(postingDateRaw) : undefined;

    // Determine dc_type for this specific row
    let rowDc: 'T' | 'K' = 'T';
    let rowAmount = 0;
    if (debit !== 0) {
      rowDc = 'T';
      rowAmount = debit;
    } else if (credit !== 0) {
      rowDc = 'K';
      rowAmount = credit;
    }

    if (rowAmount !== 0) {
      detailedItems.push({
        gl_number: konto,
        dc_type: rowDc,
        amount: Math.abs(rowAmount),
        description: desc + (partner ? ` (${partner})` : ''),
        partner_name: partner || undefined,
        document_id: docId || undefined,
        due_date: dueDate,
      });
    }

    // Sub-ledger open invoice extraction:
    // Accounts 1200 / 1210: Customer open invoices (Kupci)
    // Accounts 2200: Vendor open invoices (Dobavljači)
    if (konto.startsWith('120') || konto.startsWith('121')) {
      const invAmount = Math.abs(debit !== 0 ? debit : credit);
      if (invAmount > 0) {
        subledgerInvoices.push({
          type: 'customer',
          gl_number: konto,
          partner_name: partner || 'Ismeretlen vevő',
          document_id: desc.startsWith('IR:') ? desc.split(';')[0].replace('IR:', '') : (docId || desc),
          amount: invAmount,
          currency: detectedCurrency,
          due_date: dueDate,
          posting_date: postingDate,
        });
      }
    } else if (konto.startsWith('220')) {
      const invAmount = Math.abs(credit !== 0 ? credit : debit);
      if (invAmount > 0) {
        subledgerInvoices.push({
          type: 'supplier',
          gl_number: konto,
          partner_name: partner || 'Ismeretlen szállító',
          document_id: desc.startsWith('UR:') ? desc.split(';')[0].replace('UR:', '') : (docId || desc),
          amount: invAmount,
          currency: detectedCurrency,
          due_date: dueDate,
          posting_date: postingDate,
        });
      }
    }

    // Accumulate for aggregated mode
    const existing = kontoMap.get(konto) || { debit: 0, credit: 0, sampleDesc: desc, partner: partner };
    existing.debit += debit;
    existing.credit += credit;
    if (!existing.sampleDesc || existing.sampleDesc === 'Nyitó tétel') {
      existing.sampleDesc = desc;
    }
    kontoMap.set(konto, existing);
  }

  // Build aggregated items
  const aggregatedItems: ParsedOpeningLine[] = [];
  for (const [konto, agg] of kontoMap.entries()) {
    const net = agg.debit - agg.credit;
    if (Math.abs(net) < 0.001) continue; // zero balance account

    const dc_type: 'T' | 'K' = net > 0 ? 'T' : 'K';
    const amount = Math.abs(net);

    aggregatedItems.push({
      gl_number: konto,
      dc_type,
      amount: Math.round(amount * 100) / 100,
      description: `Nyitó egyenleg (${konto})`,
    });
  }

  // Sort aggregated items by account number naturally
  aggregatedItems.sort((a, b) => a.gl_number.localeCompare(b.gl_number, undefined, { numeric: true }));

  const imbalance = Math.abs(totalDebit - totalCredit);

  return {
    format: 'minimax',
    formatName: 'Minimax (Horvát Napredni pregled knjiženja)',
    currency: detectedCurrency,
    suggestedDate: suggestedDate || (suggestedYear ? `${suggestedYear}-01-01` : undefined),
    suggestedYear,
    totalDebit: Math.round(totalDebit * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
    imbalance: Math.round(imbalance * 100) / 100,
    isBalanced: imbalance < 0.01,
    aggregatedItems,
    detailedItems,
    subledgerInvoices,
    rawRowCount: rows.length,
  };
}

/**
 * Parses generic CSV or Excel rows (Hungarian/English column naming).
 */
/**
 * Normalizes header or column string into a lowercase ASCII token with underscores.
 * Strips accents (á->a, ő->o, etc.) and punctuation.
 */
export function normalizeKey(str: string): string {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Checks if a value indicates a Credit (Követel / K / C / Potražuje) side.
 */
export function isCreditIndicator(val: any): boolean {
  if (val === null || val === undefined) return false;
  const s = String(val).trim().toUpperCase();
  const normalized = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return (
    s === 'K' ||
    s === 'C' ||
    normalized.startsWith('KOVETEL') ||
    normalized.startsWith('CREDIT') ||
    normalized.startsWith('POTRAZUJE') ||
    normalized === 'CR' ||
    normalized === 'KREDIT'
  );
}

/**
 * Checks if a value indicates a Debit (Tartozik / T / D / Duguje) side.
 */
export function isDebitIndicator(val: any): boolean {
  if (val === null || val === undefined) return false;
  const s = String(val).trim().toUpperCase();
  const normalized = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return (
    s === 'T' ||
    s === 'D' ||
    normalized.startsWith('TARTOZIK') ||
    normalized.startsWith('DEBIT') ||
    normalized.startsWith('DUGUJE') ||
    normalized === 'DR' ||
    normalized === 'DEB'
  );
}

/**
 * Splits CSV text into headers and row objects, handling delimiters, BOM, and quotes.
 */
export function parseCsvContent(text: string): { headers: string[]; rows: any[] } {
  const cleanText = text.replace(/^\uFEFF/, '').trim();
  const rawLines = cleanText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (rawLines.length < 2) {
    throw new Error('A fájlnak legalább egy fejlécet és egy adatsort tartalmaznia kell.');
  }

  // Detect delimiter from first line (; or \t or ,)
  const firstLine = rawLines[0];
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  let delimiter = ';';
  if (tabCount > semicolonCount && tabCount > commaCount) delimiter = '\t';
  else if (commaCount > semicolonCount) delimiter = ',';

  const splitRow = (rowStr: string): string[] => {
    const res: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < rowStr.length; i++) {
      const ch = rowStr[i];
      if (ch === '"') {
        if (inQuotes && rowStr[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        res.push(cur.trim().replace(/^"|"$/g, ''));
        cur = '';
      } else {
        cur += ch;
      }
    }
    res.push(cur.trim().replace(/^"|"$/g, ''));
    return res;
  };

  const headers = splitRow(rawLines[0]);
  const rows: any[] = [];
  for (let i = 1; i < rawLines.length; i++) {
    const cols = splitRow(rawLines[i]);
    if (cols.length === 0 || (cols.length === 1 && cols[0] === '')) continue;
    const rowObj: any = {};
    headers.forEach((h, idx) => {
      rowObj[h] = cols[idx] !== undefined ? cols[idx] : '';
    });
    rows.push(rowObj);
  }
  return { headers, rows };
}

/**
 * Parses generic CSV or Excel rows (Hungarian/English column naming).
 */
export function parseGenericRows(rows: any[], format: 'generic_csv' | 'generic_excel'): OpeningImportReport {
  const items: ParsedOpeningLine[] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  for (const row of rows) {
    const keys = Object.keys(row);
    if (keys.length === 0) continue;

    const normKeys = keys.map(k => ({ original: k, norm: normalizeKey(k) }));

    // Account detection
    const glMatch = normKeys.find(k => /szamla|fokonyv|fksz|gl|account|konto/i.test(k.norm));
    let gl_number = glMatch ? String(row[glMatch.original]).trim() : String(row[keys[0]]).trim();
    gl_number = gl_number.replace(/\s*-\s*$/, '').replace(/\s*-\s*/g, '-');

    // DC detection
    const dcMatch = normKeys.find(k => 
      /^(irany|jel|dc|t_k|tartozik_kovetel|side|oldal)$/i.test(k.norm) || 
      /^(t|k|t_per_k)$/i.test(k.norm)
    );
    const dcRaw = dcMatch ? row[dcMatch.original] : null;

    // Amount detection
    const egyenlegMatch = normKeys.find(k => /^(egyenleg|net_balance|closing_balance|zaro_egyenleg)$/i.test(k.norm));
    const amtMatch = normKeys.find(k => /^(osszeg|amount|balance|ertek)$/i.test(k.norm));
    const debitMatch = normKeys.find(k => /^(tartozik|debit|duguje|zt)$/i.test(k.norm));
    const creditMatch = normKeys.find(k => /^(kovetel|credit|potrazuje|zk)$/i.test(k.norm));

    let dc_type: 'T' | 'K' = 'T';
    let amount = 0;

    if (egyenlegMatch && row[egyenlegMatch.original] !== undefined && row[egyenlegMatch.original] !== null && String(row[egyenlegMatch.original]).trim() !== '') {
      const bal = parseAmount(row[egyenlegMatch.original]);
      if (Math.abs(bal) > 0.001) {
        if (dcRaw && isCreditIndicator(dcRaw)) {
          dc_type = 'K';
          amount = Math.abs(bal);
        } else if (dcRaw && isDebitIndicator(dcRaw)) {
          dc_type = 'T';
          amount = Math.abs(bal);
        } else {
          dc_type = bal >= 0 ? 'T' : 'K';
          amount = Math.abs(bal);
        }
      }
    } else if (debitMatch && creditMatch) {
      const d = parseAmount(row[debitMatch.original]);
      const c = parseAmount(row[creditMatch.original]);
      if (d > 0) {
        dc_type = 'T';
        amount = d;
      } else if (c > 0) {
        dc_type = 'K';
        amount = c;
      }
    } else if (amtMatch) {
      const rawAmt = parseAmount(row[amtMatch.original]);
      if (dcRaw && isCreditIndicator(dcRaw)) {
        dc_type = 'K';
        amount = Math.abs(rawAmt);
      } else if (dcRaw && isDebitIndicator(dcRaw)) {
        dc_type = 'T';
        amount = Math.abs(rawAmt);
      } else if (rawAmt < 0) {
        dc_type = 'K';
        amount = Math.abs(rawAmt);
      } else {
        dc_type = 'T';
        amount = rawAmt;
      }
    } else if (keys.length >= 3) {
      // Positional fallback: col 0 = gl, col 1 = dc, col 2 = amount
      const dRaw = row[keys[1]];
      if (isCreditIndicator(dRaw)) {
        dc_type = 'K';
      } else {
        dc_type = 'T';
      }
      amount = Math.abs(parseAmount(row[keys[2]]));
    }

    // Description
    const descMatch = normKeys.find(k => /^(leiras|megnevezes|desc|name|nev|szoveg)$/i.test(k.norm));
    const description = descMatch ? String(row[descMatch.original]).trim() : 'Nyitó egyenleg';

    if (gl_number && amount > 0) {
      items.push({ gl_number, dc_type, amount, description });
      if (dc_type === 'T') totalDebit += amount;
      else totalCredit += amount;
    }
  }

  const imbalance = Math.abs(totalDebit - totalCredit);

  return {
    format,
    formatName: format === 'generic_csv' ? 'Szabványos CSV formátum' : 'Szabványos Excel táblázat',
    currency: 'HUF',
    totalDebit: Math.round(totalDebit * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
    imbalance: Math.round(imbalance * 100) / 100,
    isBalanced: imbalance < 0.01,
    aggregatedItems: items,
    detailedItems: items,
    subledgerInvoices: [],
    rawRowCount: rows.length,
  };
}

/**
 * Main parser entry point: parses File (Excel, CSV, JSON) into structured OpeningImportReport.
 */
export async function parseOpeningFile(file: File): Promise<OpeningImportReport> {
  const fileName = file.name.toLowerCase();

  // 1. JSON
  if (fileName.endsWith('.json')) {
    const text = await file.text();
    const json = JSON.parse(text);
    if (!Array.isArray(json)) {
      throw new Error('A JSON fájlnak tömböt kell tartalmaznia.');
    }
    return parseGenericRows(json, 'generic_csv');
  }

  // 2. Excel (.xlsx, .xls, .xml)
  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.xml')) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('Az Excel fájl nem tartalmaz munkalapokat.');
    }

    // Find Minimax sheet if exists, otherwise first sheet
    const targetSheetName = workbook.SheetNames.find(n => n.toLowerCase() === 'minimax') || workbook.SheetNames[0];
    const sheet = workbook.Sheets[targetSheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rows.length === 0) {
      throw new Error('Az Excel munkalap nem tartalmaz feldolgozható sorokat.');
    }

    const headers = Object.keys(rows[0] || {});
    if (isMinimaxFormat(headers)) {
      return parseMinimaxRows(rows);
    }

    return parseGenericRows(rows, 'generic_excel');
  }

  // 3. CSV / TXT
  const text = await file.text();
  const { headers, rows } = parseCsvContent(text);

  if (isMinimaxFormat(headers)) {
    return parseMinimaxRows(rows);
  }

  return parseGenericRows(rows, 'generic_csv');
}

