import * as XLSX from 'xlsx';

export type DetectedFormat = 'rlb_mytargyi' | 'rlb_osszesito' | 'generic';

export interface ParsedAssetImportItem {
  id: string; // Temporary client-side UUID for table keys
  rowNumber: number;
  inventoryNumber: string;
  isInventoryNumberGenerated: boolean;
  name: string;
  glAccountNumber: string | null;
  glAccountId?: string | null;
  acquisitionValue: number;
  residualValue: number;
  purchaseDate: string;
  activationDate: string;
  disposalDate: string | null;
  usefulLifeMonths: number;
  depreciationRatePercent: number;
  depreciationMethod: string;
  status: 'active' | 'disposed';
  costCenter: string | null;
  notes: string | null;
  // Extra fields from comprehensive reports
  accumulatedDepreciation?: number | null;
  netBookValue?: number | null;
  hasDbCollision?: boolean;
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface AssetImportParseResult {
  detectedFormat: DetectedFormat;
  formatName: string;
  totalRows: number;
  validRowsCount: number;
  disposedRowsCount: number;
  generatedInventoryNumbersCount: number;
  totalAcquisitionValue: number;
  items: ParsedAssetImportItem[];
  rawHeaders: string[];
}

export interface ParseOptions {
  includeDisposed?: boolean;
  autoGenerateMissingInventoryNumbers?: boolean;
  inventoryNumberPrefix?: string;
  knownGlAccounts?: Array<{ id: string; gl_number: string; short_name: string }>;
}

/**
 * Normalizes Hungarian numbers (e.g., "134 000", "134.000", "16,67", 134000)
 */
export function parseHungarianNumber(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (typeof val === 'string') {
    // Remove NBSP, regular spaces
    let clean = val.replace(/[\s\u00A0]/g, '');
    // If it's a dot thousand separator without comma, e.g. "134.000" or "1.234.567"
    if (/^\d{1,3}(\.\d{3})+$/.test(clean)) {
      clean = clean.replace(/\./g, '');
    } else if (clean.includes(',') && !clean.includes('.')) {
      clean = clean.replace(',', '.');
    } else if (clean.includes('.') && clean.includes(',')) {
      // European 1.234,56
      clean = clean.replace(/\./g, '').replace(',', '.');
    }
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

/**
 * Parses diverse Excel / text dates into ISO 'YYYY-MM-DD'
 */
export function parseExcelDate(val: any): string | null {
  if (val === null || val === undefined || val === '') return null;

  // 1. Excel serial number (e.g., 39265 = 2007-07-02)
  if (typeof val === 'number' && val > 1000 && val < 100000) {
    try {
      const parsed = XLSX.SSF.parse_date_code(val);
      if (parsed && parsed.y && parsed.m && parsed.d) {
        const y = parsed.y;
        const m = String(parsed.m).padStart(2, '0');
        const d = String(parsed.d).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    } catch {
      // Fallback
    }
  }

  // 2. String handling
  const str = String(val).trim();
  if (!str) return null;

  // Date formatted as dot notation (2007.07.02., 2007.7.2, 2007-07-02, 2007/07/02)
  const dotMatch = str.match(/(\d{4})[.\-/ ]+(\d{1,2})[.\-/ ]+(\d{1,2})/);
  if (dotMatch) {
    const y = dotMatch[1];
    const m = dotMatch[2].padStart(2, '0');
    const d = dotMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Fallback Date object parsing
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return null;
}

/**
 * Calculates useful life in months from annual depreciation rate percentage
 */
export function ratePercentToMonths(ratePercent: number): { months: number; method: string } {
  if (ratePercent >= 100) {
    return { months: 1, method: 'immediate' };
  }
  if (ratePercent === 0) {
    return { months: 0, method: 'none' };
  }
  if (ratePercent < 0 || isNaN(ratePercent)) {
    return { months: 83, method: 'linear' }; // 14.5% default fallback (~7 years)
  }

  const exactMonths = 12 / (ratePercent / 100);
  const roundedMonths = Math.max(1, Math.round(exactMonths));
  return { months: roundedMonths, method: 'linear' };
}

/**
 * Resolves GL account match from company's chart of accounts
 */
export function resolveGlAccount(
  rawAccount: string | null | undefined,
  glAccounts: Array<{ id: string; gl_number: string; short_name: string }> = []
): { glAccountNumber: string | null; glAccountId: string | null } {
  if (!rawAccount) return { glAccountNumber: null, glAccountId: null };
  const clean = String(rawAccount).trim().replace(/\D/g, '');
  if (!clean) return { glAccountNumber: null, glAccountId: null };

  // 1. Exact match
  const exact = glAccounts.find(g => g.gl_number.replace(/\D/g, '') === clean);
  if (exact) return { glAccountNumber: exact.gl_number, glAccountId: exact.id };

  // 2. Prefix 3-4 digit match (e.g. 143100 -> matches 143 or 1431)
  const p4 = clean.slice(0, 4);
  const match4 = glAccounts.find(g => g.gl_number.replace(/\D/g, '') === p4);
  if (match4) return { glAccountNumber: match4.gl_number, glAccountId: match4.id };

  const p3 = clean.slice(0, 3);
  const match3 = glAccounts.find(g => g.gl_number.replace(/\D/g, '') === p3);
  if (match3) return { glAccountNumber: match3.gl_number, glAccountId: match3.id };

  return { glAccountNumber: clean, glAccountId: null };
}

/**
 * Detects format based on worksheet headers and sheet name
 */
export function detectFormat(firstRows: any[][], sheetName: string): DetectedFormat {
  const allText = firstRows
    .slice(0, 5)
    .flat()
    .filter(Boolean)
    .map(String)
    .join(' ')
    .toLowerCase();

  // RLB MyTargyi detection
  if (
    allText.includes('mytargyi') ||
    (allText.includes('számlasz.') && allText.includes('bruttó össz.') && allText.includes('aktiválás')) ||
    (allText.includes('tárgyi eszközök') && allText.includes('%-os leír.'))
  ) {
    return 'rlb_mytargyi';
  }

  // RLB TE Összesítő detection
  if (
    sheetName.toLowerCase().includes('összesítő') ||
    allText.includes('sz. bruttó ny.') ||
    allText.includes('sz. écs. ny.') ||
    (allText.includes('kontírszám') && allText.includes('sz. nettó'))
  ) {
    return 'rlb_osszesito';
  }

  return 'generic';
}

/**
 * Main parser: Parses an ArrayBuffer or File containing an Excel or CSV file
 */
export function parseAssetImportData(
  data: ArrayBuffer | Uint8Array,
  options: ParseOptions = {}
): AssetImportParseResult {
  const {
    autoGenerateMissingInventoryNumbers = true,
    inventoryNumberPrefix = 'TE',
    knownGlAccounts = [],
  } = options;

  const workbook = XLSX.read(data, { type: 'array', cellDates: false });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false });

  if (rawRows.length === 0) {
    throw new Error('A feltöltött táblázat üres.');
  }

  const detectedFormat = detectFormat(rawRows, sheetName);
  let formatName = 'Általános táblázat';
  if (detectedFormat === 'rlb_mytargyi') formatName = 'RLB60 Törzskarton (MyTargyi)';
  if (detectedFormat === 'rlb_osszesito') formatName = 'RLB60 Tárgyi Eszköz Összesítő';

  // Find header row index
  let headerRowIndex = 0;
  if (detectedFormat === 'rlb_mytargyi' || detectedFormat === 'rlb_osszesito') {
    // In RLB exports, headers are typically at Row 3 (0-indexed: index 3)
    for (let r = 0; r < Math.min(8, rawRows.length); r++) {
      const rowStr = rawRows[r].filter(Boolean).map(String).join(' ').toLowerCase();
      if (
        rowStr.includes('megnevezés') ||
        rowStr.includes('megnevezes') ||
        rowStr.includes('számlasz.') ||
        rowStr.includes('kontírszám')
      ) {
        headerRowIndex = r;
        break;
      }
    }
  } else {
    // Generic: search for header row with name / megnevezés
    for (let r = 0; r < Math.min(5, rawRows.length); r++) {
      const rowStr = rawRows[r].filter(Boolean).map(String).join(' ').toLowerCase();
      if (rowStr.includes('megnevez') || rowStr.includes('név') || rowStr.includes('name')) {
        headerRowIndex = r;
        break;
      }
    }
  }

  const rawHeaders = (rawRows[headerRowIndex] || []).map(h => (h != null ? String(h).trim() : ''));
  const dataRows = rawRows.slice(headerRowIndex + 1);

  // Column index maps depending on format
  const items: ParsedAssetImportItem[] = [];
  let generatedCounter = 1;
  const currentYear = new Date().getFullYear();

  for (let idx = 0; idx < dataRows.length; idx++) {
    const row = dataRows[idx];
    if (!row || row.length === 0 || row.every(c => c === null || c === undefined || c === '')) {
      continue;
    }

    const rowNum = headerRowIndex + 2 + idx;
    let name = '';
    let rawInvNumber = '';
    let rawGl = '';
    let acquisitionVal = 0;
    let activationDate: string | null = null;
    let disposalDate: string | null = null;
    let ratePercent = 14.5;
    let costCenter: string | null = null;
    let notes: string | null = null;
    let accDep: number | null = null;
    let netVal: number | null = null;

    if (detectedFormat === 'rlb_mytargyi') {
      // Row format: [Kell, Számlasz., Megnevezés, Bruttó össz., Aktiválás, Utolsó écs., %-os leír., Kivezetés, Várható écs., Várható écs.2, Megjegyzés, Klth., Leltári szám]
      rawGl = row[1] != null ? String(row[1]) : '';
      name = row[2] != null ? String(row[2]).trim() : '';
      acquisitionVal = parseHungarianNumber(row[3]);
      activationDate = parseExcelDate(row[4]);
      const parsedRate = row[6] != null && String(row[6]).trim() !== '' ? parseHungarianNumber(row[6]) : null;
      ratePercent = parsedRate !== null ? parsedRate : 14.5;
      disposalDate = parseExcelDate(row[7]);
      notes = row[10] != null ? String(row[10]).trim() : null;
      costCenter = row[11] != null ? String(row[11]).trim() : null;
      rawInvNumber = row[12] != null ? String(row[12]).trim() : '';
    } else if (detectedFormat === 'rlb_osszesito') {
      // Row format: [Kontírszám, megnevezes, Aktiválás, Sz. bruttó ny., Sz. écs. ny., Sz. nettó ny., ..., Sz. bruttó záró, Sz. écs. záró, Sz. nettó záró, ..., Sz. écs. %, ..., Leltári szám, ..., klth, kivezetes]
      rawGl = row[0] != null ? String(row[0]) : '';
      name = row[1] != null ? String(row[1]).trim() : '';
      activationDate = parseExcelDate(row[2]);
      // Use záró (closing) if present, otherwise nyitó
      const bruttoZaro = parseHungarianNumber(row[10]);
      const bruttoNyito = parseHungarianNumber(row[3]);
      acquisitionVal = bruttoZaro || bruttoNyito;

      const ecsZaro = parseHungarianNumber(row[11]);
      const ecsNyito = parseHungarianNumber(row[4]);
      accDep = ecsZaro || ecsNyito || 0;

      const nettoZaro = parseHungarianNumber(row[12]);
      const nettoNyito = parseHungarianNumber(row[5]);
      netVal = nettoZaro || nettoNyito || 0;

      const parsedRate = row[27] != null && String(row[27]).trim() !== '' ? parseHungarianNumber(row[27]) : null;
      ratePercent = parsedRate !== null ? parsedRate : 14.5;
      rawInvNumber = row[33] != null ? String(row[33]).trim() : '';
      costCenter = row[37] != null ? String(row[37]).trim() : null;
      disposalDate = parseExcelDate(row[38]);
    } else {
      // Generic format by header name lookup
      const findCol = (terms: string[]): any => {
        const foundIdx = rawHeaders.findIndex(h => terms.some(t => h.toLowerCase().includes(t)));
        return foundIdx >= 0 ? row[foundIdx] : null;
      };

      name = String(findCol(['megnevezés', 'megnevezes', 'eszköz neve', 'név', 'name']) || '').trim();
      rawInvNumber = String(findCol(['leltári szám', 'leltáriszám', 'karton', 'azonosító', 'inventory']) || '').trim();
      rawGl = String(findCol(['főkönyv', 'számlasz', 'kontír', 'gl']) || '');
      acquisitionVal = parseHungarianNumber(findCol(['bekerülési', 'bruttó', 'érték', 'ar', 'value', 'price']));
      activationDate = parseExcelDate(findCol(['aktiválás', 'aktiválási', 'beszerzés', 'dátum', 'date']));
      disposalDate = parseExcelDate(findCol(['kivezetés', 'kivezetes', 'selejtezés', 'disposal']));
      const rawRateCol = findCol(['leírási kulcs', 'kulcs', 'écs %', 'rate', '%']);
      const parsedRate = rawRateCol != null && String(rawRateCol).trim() !== '' ? parseHungarianNumber(rawRateCol) : null;
      ratePercent = parsedRate !== null ? parsedRate : 14.5;
      costCenter = findCol(['költséghely', 'klth', 'cost center']) ? String(findCol(['költséghely', 'klth', 'cost center'])).trim() : null;
      notes = findCol(['megjegyzés', 'megjegyzes', 'leírás', 'notes']) ? String(findCol(['megjegyzés', 'megjegyzes', 'leírás', 'notes'])).trim() : null;
    }

    // Telek / Földterület (GL 121, 122) vagy név szerinti telek esetén az Sztv. szerint 0% az ÉCS
    if (rawGl.startsWith('121') || rawGl.startsWith('122') || name.toLowerCase().includes('telek')) {
      if (ratePercent === 0 || (rawGl.startsWith('121') && ratePercent === 14.5)) {
        ratePercent = 0;
      }
    }

    // Skip empty dummy rows (e.g. trailing summary rows without name and value)
    if (!name && acquisitionVal <= 0) {
      continue;
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    if (!name) {
      errors.push('Hiányzó eszköz megnevezés');
    }

    if (acquisitionVal <= 0) {
      warnings.push('A bekerülési érték 0 vagy negatív');
    }

    if (!activationDate) {
      activationDate = `${currentYear}-01-01`;
      warnings.push(`Hiányzó aktiválási dátum, alapértelmezett beállítva (${activationDate})`);
    }

    let isInventoryNumberGenerated = false;
    let finalInvNumber = rawInvNumber;
    if (!finalInvNumber) {
      if (autoGenerateMissingInventoryNumbers) {
        finalInvNumber = `${inventoryNumberPrefix}-${currentYear}-${String(generatedCounter++).padStart(4, '0')}`;
        isInventoryNumberGenerated = true;
      } else {
        errors.push('Hiányzó leltári szám');
      }
    }

    const { months: usefulLifeMonths, method: depreciationMethod } = ratePercentToMonths(ratePercent);
    const glResolution = resolveGlAccount(rawGl, knownGlAccounts);

    if (rawGl && !glResolution.glAccountId) {
      warnings.push(`A megadott főkönyvi szám (${rawGl}) nincs a számlatükörben, manuális párosítás ajánlott`);
    }

    const isDisposed = Boolean(disposalDate);

    items.push({
      id: `import-${idx}-${Date.now()}`,
      rowNumber: rowNum,
      inventoryNumber: finalInvNumber,
      isInventoryNumberGenerated,
      name: name || 'Névtelen eszköz',
      glAccountNumber: glResolution.glAccountNumber,
      glAccountId: glResolution.glAccountId,
      acquisitionValue: acquisitionVal,
      residualValue: 0,
      purchaseDate: activationDate,
      activationDate: activationDate,
      disposalDate: isDisposed ? disposalDate : null,
      usefulLifeMonths,
      depreciationRatePercent: ratePercent,
      depreciationMethod,
      status: isDisposed ? 'disposed' : 'active',
      costCenter,
      notes,
      accumulatedDepreciation: accDep,
      netBookValue: netVal,
      isValid: errors.length === 0,
      errors,
      warnings,
    });
  }

  const validRowsCount = items.filter(i => i.isValid).length;
  const disposedRowsCount = items.filter(i => i.status === 'disposed').length;
  const generatedInventoryNumbersCount = items.filter(i => i.isInventoryNumberGenerated).length;
  const totalAcquisitionValue = items.reduce((sum, i) => sum + (i.acquisitionValue || 0), 0);

  return {
    detectedFormat,
    formatName,
    totalRows: items.length,
    validRowsCount,
    disposedRowsCount,
    generatedInventoryNumbersCount,
    totalAcquisitionValue,
    items,
    rawHeaders,
  };
}

/**
 * Generates an empty, standard sample Excel template for users to download
 */
export function generateSampleAssetImportExcel(): Uint8Array {
  const sampleData = [
    {
      'Leltári szám': 'TE-2026-0001',
      'Eszköz megnevezése': 'Lenovo ThinkPad X1 Carbon laptop',
      'Bekerülési érték (Ft)': 450000,
      'Aktiválás dátuma': '2024-03-15',
      'Leírási kulcs (%)': 33.3,
      'Főkönyvi számlaszám': '144',
      'Maradványérték (Ft)': 0,
      'Költséghely': '1',
      'Megjegyzés': 'Fejlesztői munkaállomás',
    },
    {
      'Leltári szám': 'TE-2026-0002',
      'Eszköz megnevezése': 'Irodai íróasztal motoros emelővel',
      'Bekerülési érték (Ft)': 185000,
      'Aktiválás dátuma': '2023-09-01',
      'Leírási kulcs (%)': 14.5,
      'Főkönyvi számlaszám': '143',
      'Maradványérték (Ft)': 0,
      'Költséghely': '2',
      'Megjegyzés': 'Iroda bútor',
    },
    {
      'Leltári szám': 'TE-2026-0003',
      'Eszköz megnevezése': 'Mikrohullámú sütő (kisértékű)',
      'Bekerülési érték (Ft)': 48000,
      'Aktiválás dátuma': '2025-01-10',
      'Leírási kulcs (%)': 100,
      'Főkönyvi számlaszám': '143',
      'Maradványérték (Ft)': 0,
      'Költséghely': '1',
      'Megjegyzés': 'Azonnali 100% écs',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Tárgyi eszközök');
  const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Uint8Array(buffer);
}

