import type { VatTemplateColumn, VatTemplateField, VatTemplateAlign, VatTemplateFormat, VatSampleRow } from '@/types/vatTemplate';
import Papa from 'papaparse';

export interface ParsedVatTemplateResult {
  name: string;
  columns: VatTemplateColumn[];
  sampleRows: VatSampleRow[];
  detectedRowCount: number;
  warnings: string[];
}

export const MAX_VAT_TEMPLATE_COLUMNS = 16;

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
 * Heuristically identifies which VAT field an uploaded column header represents
 */
export function inferVatField(headerName: string): { field: VatTemplateField; align: VatTemplateAlign; format?: VatTemplateFormat } {
  const norm = normalizeHeader(headerName);

  // 1. Specific Payable / Deductible amounts
  if (norm.includes('fizetendo') && (norm.includes('netto') || norm.includes('alap'))) {
    return { field: 'payableNetAmount', align: 'right', format: 'currency' };
  }
  if (norm.includes('fizetendo') && (norm.includes('afa') || norm.includes('ado'))) {
    return { field: 'payableVatAmount', align: 'right', format: 'currency' };
  }
  if (norm.includes('levonhato') && (norm.includes('netto') || norm.includes('alap'))) {
    return { field: 'deductibleNetAmount', align: 'right', format: 'currency' };
  }
  if (norm.includes('levonhato') && (norm.includes('afa') || norm.includes('ado'))) {
    return { field: 'deductibleVatAmount', align: 'right', format: 'currency' };
  }
  if (norm.includes('pozicio') || norm === 'afa egyenleg' || norm === 'netto afa') {
    return { field: 'netVatPosition', align: 'right', format: 'currency' };
  }

  // 2. VAT rate label (% or kulcs or szazalek or rate)
  if (
    headerName.includes('%') ||
    norm.includes('kulcs') ||
    norm.includes('szazalek') ||
    norm.includes('vat rate') ||
    norm.includes('tax rate') ||
    norm === 'rate'
  ) {
    return { field: 'vatRateLabel', align: 'center', format: 'text' };
  }

  // 3. Net amounts
  if (
    norm.includes('netto') ||
    norm.includes('adoalap') ||
    norm === 'alap' ||
    norm === 'net amount' ||
    norm === 'tax base'
  ) {
    if (norm.includes('fsz') || norm.includes('szamla') || norm.includes('fokonyv')) {
      return { field: 'netGlAccount', align: 'center', format: 'text' };
    }
    return { field: 'netAmount', align: 'right', format: 'currency' };
  }

  // 3. VAT amounts
  if (
    norm === 'afa' ||
    norm === 'afa osszeg' ||
    norm === 'adomentes' ||
    norm === 'felszamitott afa' ||
    norm === 'vat' ||
    norm === 'vat amount' ||
    norm === 'tax' ||
    norm === 'tax amount' ||
    (norm.includes('afa') && norm.includes('osszeg'))
  ) {
    if (norm.includes('fsz') || norm.includes('szamla') || norm.includes('fokonyv')) {
      return { field: 'vatGlAccount', align: 'center', format: 'text' };
    }
    return { field: 'vatAmount', align: 'right', format: 'currency' };
  }

  // 4. Gross amounts
  if (
    norm.includes('brutto') ||
    norm.includes('vegosszeg') ||
    norm === 'gross' ||
    norm === 'gross amount' ||
    norm === 'total' ||
    norm === 'osszesen'
  ) {
    if (norm.includes('fsz') || norm.includes('szamla') || norm.includes('fokonyv')) {
      return { field: 'grossGlAccount', align: 'center', format: 'text' };
    }
    return { field: 'grossAmount', align: 'right', format: 'currency' };
  }

  // 5. Tax return row code
  if (
    norm.includes('bev sor') ||
    norm.includes('bevallasi sor') ||
    norm.includes('nav sor') ||
    norm.includes('65 sor') ||
    norm.includes('return row') ||
    norm === 'sor'
  ) {
    return { field: 'returnRowCode', align: 'center', format: 'text' };
  }

  // 7. GL Accounts
  if (norm.includes('netto fsz') || norm.includes('koltseg fsz') || norm.includes('arbevetel fsz')) {
    return { field: 'netGlAccount', align: 'center', format: 'text' };
  }
  if (norm.includes('afa fsz') || norm.includes('afa fokonyv')) {
    return { field: 'vatGlAccount', align: 'center', format: 'text' };
  }
  if (norm.includes('brutto fsz') || norm.includes('partner fsz') || norm.includes('penzugyi fsz')) {
    return { field: 'grossGlAccount', align: 'center', format: 'text' };
  }

  // 8. Due date / Delivery date
  if (
    norm.includes('esedekesseg') ||
    norm.includes('teljesites') ||
    norm.includes('afa datum') ||
    norm.includes('datum') ||
    norm.includes('date')
  ) {
    return { field: 'vatDueDate', align: 'center', format: 'date' };
  }

  // 9. Invoice number
  if (
    norm.includes('bizonylat') ||
    norm.includes('szamlaszam') ||
    norm.includes('szamla sorszam') ||
    norm.includes('invoice') ||
    norm.includes('doc num')
  ) {
    return { field: 'invoiceNumber', align: 'left', format: 'text' };
  }

  // 10. Partner tax number / code
  if (
    norm.includes('adoszam') ||
    norm.includes('tax number') ||
    norm.includes('vat id') ||
    norm.includes('part kod') ||
    norm.includes('adosz')
  ) {
    return { field: 'partnerCode', align: 'center', format: 'text' };
  }

  // 11. Partner name
  if (
    norm.includes('partner') ||
    norm.includes('ugyfel') ||
    norm.includes('vevo') ||
    norm.includes('szallito') ||
    norm.includes('customer') ||
    norm.includes('vendor')
  ) {
    return { field: 'partnerName', align: 'left', format: 'text' };
  }

  // 12. Sorszám / Entry number
  if (norm === 'sorszam' || norm.includes('sor szam') || norm === 'tetel' || norm === 'no' || norm === 'nr') {
    return { field: 'entryNumber', align: 'center', format: 'text' };
  }

  // 13. Napló / Journal type
  if (norm.includes('naplo') || norm === 'irany' || norm === 'journal') {
    return { field: 'journalType', align: 'center', format: 'text' };
  }

  // 14. Megjegyzés / Description
  if (
    norm.includes('megjegyzes') ||
    norm.includes('szoveg') ||
    norm.includes('leiras') ||
    norm.includes('targy') ||
    norm.includes('description') ||
    norm.includes('comment')
  ) {
    return { field: 'description', align: 'left', format: 'text' };
  }

  // Default fallback
  return { field: 'custom', align: 'left', format: 'text' };
}

/**
 * Parses an Excel (.xlsx/.xls) or CSV file and extracts proposed VAT analytics view template columns and sample preview rows
 */
export async function parseVatTemplateFile(file: File, customTemplateName?: string): Promise<ParsedVatTemplateResult> {
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
      if (values.some((v) => v.trim() !== '')) {
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
    const filledCells = rawRows[i].filter((c) => c && c.trim().length > 0);
    if (filledCells.length >= 2) {
      headerRowIndex = i;
      break;
    }
  }

  const rawHeaders = rawRows[headerRowIndex];
  const columns: VatTemplateColumn[] = [];
  const usedKeys = new Set<string>();

  rawHeaders.forEach((headerText, idx) => {
    const trimmed = (headerText || '').trim();
    if (!trimmed) return;

    const { field, align, format } = inferVatField(trimmed);
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
      width:
        field === 'partnerName'
          ? '1.2fr'
          : field === 'description'
          ? '180px'
          : field === 'invoiceNumber'
          ? '140px'
          : field === 'vatDueDate'
          ? '115px'
          : field === 'netAmount' || field === 'vatAmount' || field === 'grossAmount'
          ? '130px'
          : '100px',
      required: field === 'invoiceNumber' || field === 'partnerName' || field === 'netAmount' || field === 'vatAmount',
    });
  });

  // Verification checks: ensure basic identity & financial columns exist
  const hasInvoiceNumber = columns.some((c) => c.field === 'invoiceNumber' || c.field === 'entryNumber');
  const hasPartner = columns.some((c) => c.field === 'partnerName' || c.field === 'partnerCode');

  if (!hasInvoiceNumber) {
    warnings.push('Nem azonosítottunk egyértelmű „Bizonylatszám” oszlopot. Az első oszlop hozzárendelve bizonylatszámként.');
    if (columns.length > 0) {
      columns[0].field = 'invoiceNumber';
      columns[0].align = 'left';
    } else {
      columns.unshift({
        id: 'invoiceNumber',
        key: 'invoiceNumber',
        label: 'Bizonylatszám',
        align: 'left',
        field: 'invoiceNumber',
        width: '140px',
        required: true,
      });
    }
  }

  if (!hasPartner) {
    warnings.push('Nem azonosítottunk egyértelmű „Partner neve” oszlopot. A második oszlop hozzárendelve partnerként.');
    if (columns.length > 1) {
      columns[1].field = 'partnerName';
      columns[1].align = 'left';
      columns[1].width = '1.2fr';
    } else {
      columns.push({
        id: 'partnerName',
        key: 'partnerName',
        label: 'Partner neve',
        align: 'left',
        field: 'partnerName',
        width: '1.2fr',
        required: true,
      });
    }
  }

  const hasFinancial = columns.some(
    (c) =>
      c.field === 'netAmount' ||
      c.field === 'vatAmount' ||
      c.field === 'grossAmount' ||
      c.field === 'payableNetAmount' ||
      c.field === 'deductibleNetAmount'
  );

  if (!hasFinancial) {
    warnings.push('Nem találtunk ÁFA összegoszlopokat. Hozzáadtuk a „Nettó összeg” és „ÁFA összeg” oszlopokat.');
    columns.push(
      {
        id: 'netAmount',
        key: 'netAmount',
        label: 'Nettó összeg',
        align: 'right',
        field: 'netAmount',
        format: 'currency',
        width: '130px',
        required: true,
      },
      {
        id: 'vatAmount',
        key: 'vatAmount',
        label: 'ÁFA összeg',
        align: 'right',
        field: 'vatAmount',
        format: 'currency',
        width: '130px',
        required: true,
      }
    );
  }

  // Guard against extreme column counts (> MAX_VAT_TEMPLATE_COLUMNS)
  if (columns.length > MAX_VAT_TEMPLATE_COLUMNS) {
    const excess = columns.length - MAX_VAT_TEMPLATE_COLUMNS;
    warnings.push(
      `A sablonban legfeljebb ${MAX_VAT_TEMPLATE_COLUMNS} oszlop támogatott az optimális felületi és export megjelenítéshez. Az első ${MAX_VAT_TEMPLATE_COLUMNS} oszlop került beolvasásra, a további ${excess} oszlop figyelmen kívül maradt.`
    );
    columns.length = MAX_VAT_TEMPLATE_COLUMNS;
  }

  // Extract up to 5 sample rows from the remaining rows
  const sampleRows: VatSampleRow[] = [];
  const dataRows = rawRows.slice(headerRowIndex + 1);

  for (let i = 0; i < Math.min(dataRows.length, 5); i++) {
    const row = dataRows[i];
    if (!row || row.every((c) => !c || c.trim() === '')) continue;

    let sampleEntryNumber: string | undefined;
    let sampleJournalType: string | undefined;
    let sampleVatDueDate: string | undefined;
    let sampleInvoiceNumber = '';
    let samplePartnerCode: string | undefined;
    let samplePartnerName = '';
    let sampleDescription: string | undefined;
    let sampleVatRateLabel: string | undefined;
    let sampleNetAmount = 0;
    let sampleVatAmount = 0;
    let sampleGrossAmount = 0;
    let sampleReturnRowCode: string | undefined;
    let sampleNetGlAccount: string | undefined;
    let sampleVatGlAccount: string | undefined;
    let sampleGrossGlAccount: string | undefined;

    columns.forEach((col, colIdx) => {
      const cellVal = row[colIdx]?.trim() || '';
      const numVal = parseFloat(cellVal.replace(/[^\d.-]/g, '')) || 0;

      switch (col.field) {
        case 'entryNumber':
          sampleEntryNumber = cellVal || `SZ26/000${i + 1}`;
          break;
        case 'journalType':
          sampleJournalType = cellVal || (i % 2 === 0 ? 'szállító' : 'vevő');
          break;
        case 'vatDueDate':
          sampleVatDueDate = cellVal || `2026-03-${10 + i * 2}`;
          break;
        case 'invoiceNumber':
          sampleInvoiceNumber = cellVal || `SZ-2026/${100 + i}`;
          break;
        case 'partnerCode':
          samplePartnerCode = cellVal || `1234567${i}-2-41`;
          break;
        case 'partnerName':
          samplePartnerName = cellVal || `Minta Partner Kft. ${i + 1}`;
          break;
        case 'description':
          sampleDescription = cellVal || `Gazdasági esemény ${i + 1}`;
          break;
        case 'vatRateLabel':
          sampleVatRateLabel = cellVal || '27%-os';
          break;
        case 'netAmount':
        case 'payableNetAmount':
        case 'deductibleNetAmount':
          sampleNetAmount = numVal || (i + 1) * 50000;
          break;
        case 'vatAmount':
        case 'payableVatAmount':
        case 'deductibleVatAmount':
          sampleVatAmount = numVal || Math.round(((i + 1) * 50000) * 0.27);
          break;
        case 'grossAmount':
          sampleGrossAmount = numVal || Math.round(((i + 1) * 50000) * 1.27);
          break;
        case 'returnRowCode':
          sampleReturnRowCode = cellVal || (i % 2 === 0 ? '64' : '01');
          break;
        case 'netGlAccount':
          sampleNetGlAccount = cellVal || (i % 2 === 0 ? '529T' : '911K');
          break;
        case 'vatGlAccount':
          sampleVatGlAccount = cellVal || (i % 2 === 0 ? '466T' : '467K');
          break;
        case 'grossGlAccount':
          sampleGrossGlAccount = cellVal || (i % 2 === 0 ? '4541K' : '311T');
          break;
      }
    });

    if (!sampleGrossAmount) {
      sampleGrossAmount = sampleNetAmount + sampleVatAmount;
    }

    sampleRows.push({
      id: `parsed_sample_${i + 1}`,
      entryNumber: sampleEntryNumber || `SZ26/000${i + 1}`,
      journalType: sampleJournalType || 'szállító',
      vatDueDate: sampleVatDueDate || `2026-03-${10 + i * 2}`,
      invoiceNumber: sampleInvoiceNumber || `SZ-2026/${100 + i}`,
      partnerCode: samplePartnerCode || `1234567${i}-2-41`,
      partnerName: samplePartnerName || `Minta Partner Kft. ${i + 1}`,
      description: sampleDescription || 'Beszerzés / Értékesítés',
      vatRateLabel: sampleVatRateLabel || '27%-os',
      netAmount: sampleNetAmount,
      vatAmount: sampleVatAmount,
      grossAmount: sampleGrossAmount,
      returnRowCode: sampleReturnRowCode || '64',
      netGlAccount: sampleNetGlAccount,
      vatGlAccount: sampleVatGlAccount,
      grossGlAccount: sampleGrossGlAccount,
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
