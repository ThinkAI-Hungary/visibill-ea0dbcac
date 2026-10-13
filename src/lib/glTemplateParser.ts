import type { GlTemplateColumn, GlTemplateField, GlTemplateAlign, GlTemplateFormat, GlSampleRow } from '@/types/glTemplate';
import Papa from 'papaparse';

export interface ParsedTemplateResult {
  name: string;
  columns: GlTemplateColumn[];
  sampleRows: GlSampleRow[];
  detectedRowCount: number;
  warnings: string[];
}

export const MAX_GL_TEMPLATE_COLUMNS = 16;

/**
 * Normalizes string for fuzzy keyword comparison
 */
function normalizeHeader(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Heuristically identifies which GL field an uploaded column header represents
 */
export function inferGlField(headerName: string): { field: GlTemplateField; align: GlTemplateAlign; format?: GlTemplateFormat } {
  const norm = normalizeHeader(headerName);

  // 1. Debit turnover / Tartozik forgalom
  if (
    (norm.includes('forgalom') && (norm.includes('tartozik') || norm.includes(' t ') || norm.endsWith(' t'))) ||
    norm === 'forgalom t' || norm === 'tartozik forgalom'
  ) {
    return { field: 'debitTurnover', align: 'right', format: 'currency' };
  }

  // 2. Credit turnover / Követel forgalom
  if (
    (norm.includes('forgalom') && (norm.includes('kovetel') || norm.includes(' k ') || norm.endsWith(' k'))) ||
    norm === 'forgalom k' || norm === 'kovetel forgalom'
  ) {
    return { field: 'creditTurnover', align: 'right', format: 'currency' };
  }

  // 3. Balance Debit / Tartozik Egyenleg
  if (
    (norm.includes('egyenleg') && (norm.includes('tartozik') || norm.includes(' t ') || norm.endsWith(' t'))) ||
    norm === 'egyenleg t' || norm === 'tartozik egyenleg'
  ) {
    return { field: 'balanceDebit', align: 'right', format: 'currency' };
  }

  // 4. Balance Credit / Követel Egyenleg
  if (
    (norm.includes('egyenleg') && (norm.includes('kovetel') || norm.includes(' k ') || norm.endsWith(' k'))) ||
    norm === 'egyenleg k' || norm === 'kovetel egyenleg'
  ) {
    return { field: 'balanceCredit', align: 'right', format: 'currency' };
  }

  // 5. General / Total Balance
  if (norm.includes('egyenleg') || norm.includes('balance') || norm.includes('zaro') || norm.includes('osszesitett')) {
    return { field: 'balance', align: 'right', format: 'currency' };
  }

  // 6. Standalone Tartozik / Követel
  if (norm === 'tartozik' || norm === 't' || norm === 'debit') {
    return { field: 'debitTurnover', align: 'right', format: 'currency' };
  }
  if (norm === 'kovetel' || norm === 'k' || norm === 'credit') {
    return { field: 'creditTurnover', align: 'right', format: 'currency' };
  }

  // 7. GL Account number / ID
  if (
    norm.includes('fokonyv') ||
    norm.includes('szamlaszam') ||
    norm.includes('fok szam') ||
    norm.includes('szamla szam') ||
    norm.includes('konto') ||
    (norm.includes('account') && !norm.includes('name') && !norm.includes('nev')) ||
    norm === 'szamla' ||
    norm === 'kod' ||
    norm === 'code'
  ) {
    return { field: 'id', align: 'center', format: 'text' };
  }

  // 8. Partner
  if (norm.includes('partner') || norm.includes('ugyfel') || norm.includes('vevo') || norm.includes('szallito') || norm.includes('customer') || norm.includes('vendor')) {
    return { field: 'partner', align: 'left', format: 'text' };
  }

  // 9. Invoice / Document number
  if (norm.includes('bizonylat') || norm.includes('szamlasor') || norm.includes('dokumentum') || norm.includes('invoice')) {
    return { field: 'invoiceNumber', align: 'left', format: 'text' };
  }

  // 10. Date
  if (norm.includes('datum') || norm.includes('kelt') || norm.includes('teljesites') || norm.includes('date')) {
    return { field: 'date', align: 'center', format: 'date' };
  }

  // 11. Name / Description
  if (norm.includes('megnevezes') || norm.includes('nev') || norm.includes('name') || norm.includes('leiras') || norm.includes('description') || norm.includes('title')) {
    return { field: 'name', align: 'left', format: 'text' };
  }

  // Default fallback
  return { field: 'custom', align: 'left', format: 'text' };
}

/**
 * Parses an Excel (.xlsx/.xls) or CSV file and extracts proposed GL view template columns and sample preview rows
 */
export async function parseGlTemplateFile(file: File, customTemplateName?: string): Promise<ParsedTemplateResult> {
  const fileName = file.name;
  const warnings: string[] = [];
  const baseName = fileName.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
  const defaultTemplateName = customTemplateName?.trim() || (baseName.charAt(0).toUpperCase() + baseName.slice(1));

  let rawRows: string[][] = [];

  if (fileName.toLowerCase().endsWith('.csv')) {
    const text = await file.text();
    const parsed = Papa.parse<string[]>(text, {
      skipEmptyLines: true,
    });
    rawRows = parsed.data;
  } else {
    // Parse XLSX using ExcelJS
    const { default: ExcelJS } = await import('exceljs');
    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error('A feltöltött munkafüzet nem tartalmaz munkalapokat.');
    }

    worksheet.eachRow((row) => {
      const values: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        const val = cell.value;
        if (val === null || val === undefined) {
          values.push('');
        } else if (typeof val === 'object' && 'result' in val) {
          values.push(String((val as any).result ?? ''));
        } else if (typeof val === 'object' && 'text' in val) {
          values.push(String((val as any).text ?? ''));
        } else {
          values.push(String(val));
        }
      });
      if (values.some(v => v.trim() !== '')) {
        rawRows.push(values);
      }
    });
  }

  if (rawRows.length === 0) {
    throw new Error('A megadott mintafájl üres vagy nem tartalmaz beolvasható adatokat.');
  }

  // Find the header row (first row with at least 2 non-empty values)
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
    const filledCells = rawRows[i].filter(c => c && c.trim().length > 0);
    if (filledCells.length >= 2) {
      headerRowIndex = i;
      break;
    }
  }

  const rawHeaders = rawRows[headerRowIndex];
  const columns: GlTemplateColumn[] = [];
  const usedKeys = new Set<string>();

  rawHeaders.forEach((headerText, idx) => {
    const trimmed = (headerText || '').trim();
    if (!trimmed) return;

    const { field, align, format } = inferGlField(trimmed);
    let key = field !== 'custom' ? field : `col_${idx + 1}`;
    if (usedKeys.has(key)) {
      key = `${key}_${idx + 1}`;
    }
    usedKeys.add(key);

    columns.push({
      id: key,
      key,
      label: trimmed,
      align,
      field,
      format,
      width: field === 'name' ? '1fr' : field === 'id' ? '110px' : '160px',
      required: field === 'id' || field === 'name',
    });
  });

  // Verification checks: ensure basic GL identity columns are covered
  const hasId = columns.some(c => c.field === 'id');
  const hasName = columns.some(c => c.field === 'name');

  if (!hasId) {
    warnings.push('Nem azonosítottunk egyértelmű „Főkönyvi szám” oszlopot. Az első oszlop hozzárendelve főkönyvi számként.');
    if (columns.length > 0) {
      columns[0].field = 'id';
      columns[0].align = 'center';
    } else {
      columns.unshift({
        id: 'gl_number',
        key: 'gl_number',
        label: 'Fők. szám',
        align: 'center',
        field: 'id',
        width: '110px',
        required: true,
      });
    }
  }

  if (!hasName) {
    warnings.push('Nem azonosítottunk egyértelmű „Megnevezés” oszlopot. A második oszlop hozzárendelve megnevezésként.');
    if (columns.length > 1) {
      columns[1].field = 'name';
      columns[1].align = 'left';
      columns[1].width = '1fr';
    } else {
      columns.push({
        id: 'name',
        key: 'name',
        label: 'Megnevezés',
        align: 'left',
        field: 'name',
        width: '1fr',
        required: true,
      });
    }
  }

  const hasFinancial = columns.some(c => 
    c.field === 'balance' || 
    c.field === 'balanceDebit' || 
    c.field === 'balanceCredit' || 
    c.field === 'debitTurnover' || 
    c.field === 'creditTurnover'
  );

  if (!hasFinancial) {
    warnings.push('Nem találtunk forgalmi vagy egyenleg oszlopot. Hozzáadtunk egy alapértelmezett „Összesített Egyenleg” oszlopot.');
    columns.push({
      id: 'balance',
      key: 'balance',
      label: 'Összesített Egyenleg',
      align: 'right',
      field: 'balance',
      format: 'currency',
      width: '180px',
    });
  }

  // Guard against extreme column counts (> MAX_GL_TEMPLATE_COLUMNS)
  if (columns.length > MAX_GL_TEMPLATE_COLUMNS) {
    const excess = columns.length - MAX_GL_TEMPLATE_COLUMNS;
    warnings.push(
      `A sablonban legfeljebb ${MAX_GL_TEMPLATE_COLUMNS} oszlop támogatott az optimális felületi és export megjelenítéshez. Az első ${MAX_GL_TEMPLATE_COLUMNS} oszlop került beolvasásra, a további ${excess} oszlop figyelmen kívül maradt.`
    );
    columns.length = MAX_GL_TEMPLATE_COLUMNS;
  }

  // Extract up to 5 sample rows from the remaining rows
  const sampleRows: GlSampleRow[] = [];
  const dataRows = rawRows.slice(headerRowIndex + 1);

  for (let i = 0; i < Math.min(dataRows.length, 5); i++) {
    const row = dataRows[i];
    if (!row || row.every(c => !c || c.trim() === '')) continue;

    let sampleId = '';
    let sampleName = '';
    let sampleBalance = 0;
    let sampleDebitTurnover: number | undefined;
    let sampleCreditTurnover: number | undefined;
    let sampleBalanceDebit: number | undefined;
    let sampleBalanceCredit: number | undefined;
    let samplePartner: string | undefined;
    let sampleInvoiceNumber: string | undefined;
    let sampleDate: string | undefined;

    columns.forEach((col, colIdx) => {
      const cellVal = row[colIdx]?.trim() || '';
      const numVal = parseFloat(cellVal.replace(/[^\d.-]/g, '')) || 0;

      switch (col.field) {
        case 'id':
          sampleId = cellVal || `1${i + 1}1`;
          break;
        case 'name':
          sampleName = cellVal || `Minta tétel ${i + 1}`;
          break;
        case 'balance':
          sampleBalance = numVal;
          break;
        case 'debitTurnover':
          sampleDebitTurnover = numVal;
          break;
        case 'creditTurnover':
          sampleCreditTurnover = numVal;
          break;
        case 'balanceDebit':
          sampleBalanceDebit = numVal;
          break;
        case 'balanceCredit':
          sampleBalanceCredit = numVal;
          break;
        case 'partner':
          samplePartner = cellVal;
          break;
        case 'invoiceNumber':
          sampleInvoiceNumber = cellVal;
          break;
        case 'date':
          sampleDate = cellVal;
          break;
      }
    });

    sampleRows.push({
      id: sampleId || `${i + 1}00`,
      name: sampleName || `Minta számlaszám ${i + 1}`,
      balance: sampleBalance,
      debitTurnover: sampleDebitTurnover,
      creditTurnover: sampleCreditTurnover,
      balanceDebit: sampleBalanceDebit,
      balanceCredit: sampleBalanceCredit,
      partner: samplePartner,
      invoiceNumber: sampleInvoiceNumber,
      date: sampleDate,
      depth: 1,
      isRoot: false,
    });
  }

  return {
    name: defaultTemplateName,
    columns,
    sampleRows,
    detectedRowCount: dataRows.length,
    warnings,
  };
}
