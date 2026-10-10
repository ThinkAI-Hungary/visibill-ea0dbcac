import ExcelJS from 'exceljs';
import { supabase } from '@/integrations/supabase/client';
import {
  generateMkvkAuditXml,
  downloadMkvkAuditXml,
  getMkvkAuditXmlFileName,
  type MkvkAuditXmlRawData,
} from './mkvkAuditXmlGenerator';

export interface AuditorGlLine {
  line_id: string;
  header_id: string;
  journal_code: string;
  journal_number: number | null;
  accounting_date: string;
  document_date: string;
  due_date: string;
  gl_account_number: string;
  gl_account_name: string;
  dc_type: 'T' | 'K';
  amount: number;
  currency: string;
  foreign_amount: number | null;
  exchange_rate: number | null;
  partner_tax_number: string | null;
  partner_name: string | null;
  cost_center: string;
  job_code: string;
  project_id: string;
  grant_id: string;
  description: string;
  created_by: string;
}

export interface AuditorGlSummary {
  total_lines: number;
  total_debit: number;
  total_credit: number;
  is_balanced: boolean;
  imbalance_diff: number;
}

export interface AuditorGlExportData {
  company: {
    id: string;
    name: string;
    tax_number: string;
  };
  period: {
    date_from: string;
    date_to: string;
    include_opening: boolean;
    include_closing: boolean;
  };
  summary: AuditorGlSummary;
  lines: AuditorGlLine[];
}

export interface SubsequentSettlementItem {
  invoice_id: string;
  invoice_number: string;
  direction: 'AR' | 'AP';
  partner_name: string;
  partner_tax_number: string;
  issue_date: string;
  due_date: string;
  fulfillment_date: string;
  open_amount_dec31: number;
  currency: string;
  subsequent_settled_amount: number;
  first_settlement_date: string | null;
  last_settlement_date: string | null;
  settlement_method: 'BANK' | 'CASH' | 'OTHER' | 'NONE';
  settlement_percentage: number;
  settlement_status: 'SETTLED' | 'PARTIALLY_SETTLED' | 'UNSETTLED';
}

export interface SubsequentSettlementsReport {
  fiscal_year: number;
  year_end_date: string;
  cutoff_date: string;
  summary: {
    total_receivables_open_dec31: number;
    settled_receivables_subsequent: number;
    receivables_settlement_rate: number;
    total_payables_open_dec31: number;
    settled_payables_subsequent: number;
    payables_settlement_rate: number;
  };
  items: SubsequentSettlementItem[];
}

export interface AuditExportStalenessInfo {
  has_export: boolean;
  export_id?: string;
  last_export_version?: string;
  last_export_at?: string;
  file_hash_sha256?: string;
  is_stale: boolean;
  stale_detected_at?: string;
  modified_entries_count?: number;
  last_activity_at?: string;
}

export interface AuditExportRecord {
  id: string;
  company_id: string;
  fiscal_year: number;
  period_from: string;
  period_to: string;
  version_label: string;
  export_format: string;
  package_type: string;
  file_name: string;
  file_hash_sha256: string;
  total_lines: number;
  total_debit: number;
  total_credit: number;
  metadata?: Record<string, unknown>;
  is_stale: boolean;
  stale_detected_at?: string | null;
  exported_by?: string | null;
  created_at: string;
}

/**
 * Fetch 20-column GL Journal Export from DB
 */
export async function fetchAuditorGlData(
  companyId: string,
  dateFrom: string,
  dateTo: string,
  includeOpening: boolean = true,
  includeClosing: boolean = false
): Promise<AuditorGlExportData> {
  const { data, error } = await supabase.rpc('get_auditor_gl_journal_export', {
    p_company_id: companyId,
    p_date_from: dateFrom,
    p_date_to: dateTo,
    p_include_opening: includeOpening,
    p_include_closing: includeClosing,
  });

  if (error) {
    throw new Error(`Nem sikerült betölteni a könyvvizsgálói főkönyvi adatokat: ${error.message}`);
  }

  return data as unknown as AuditorGlExportData;
}

/**
 * Fetch ISA 560 Subsequent Cash Settlements Report
 */
export async function fetchSubsequentSettlements(
  companyId: string,
  fiscalYear: number,
  cutoffDate?: string
): Promise<SubsequentSettlementsReport> {
  const { data, error } = await supabase.rpc('get_subsequent_settlements_report', {
    p_company_id: companyId,
    p_fiscal_year: fiscalYear,
    p_cutoff_date: cutoffDate || null,
  });

  if (error) {
    throw new Error(`Nem sikerült betölteni az utólagos pénzügyi rendezések kimutatását: ${error.message}`);
  }

  return data as unknown as SubsequentSettlementsReport;
}

/**
 * Check export staleness for the company and fiscal year
 */
export async function checkAuditExportStaleness(
  companyId: string,
  fiscalYear: number
): Promise<AuditExportStalenessInfo> {
  const { data, error } = await supabase.rpc('check_audit_export_staleness', {
    p_company_id: companyId,
    p_fiscal_year: fiscalYear,
  });

  if (error) {
    throw new Error(`Hiba az export integritás ellenőrzése során: ${error.message}`);
  }

  return data as unknown as AuditExportStalenessInfo;
}

/**
 * Fetch existing snapshots/exports for the company and year
 */
export async function fetchAuditExportHistory(
  companyId: string,
  fiscalYear: number
): Promise<AuditExportRecord[]> {
  const { data, error } = await supabase
    .from('accounty_audit_exports')
    .select('*')
    .eq('company_id', companyId)
    .eq('fiscal_year', fiscalYear)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []) as AuditExportRecord[];
}

/**
 * Compute SHA-256 checksum from bytes or string
 */
export async function computeSha256Hex(data: ArrayBuffer | Uint8Array | string): Promise<string> {
  let buffer: ArrayBuffer;
  if (typeof data === 'string') {
    buffer = new TextEncoder().encode(data).buffer;
  } else if (data instanceof Uint8Array) {
    buffer = data.buffer;
  } else {
    buffer = data;
  }

  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Save export snapshot record into accounty_audit_exports
 */
export async function saveAuditExportSnapshot(
  companyId: string,
  params: {
    fiscalYear: number;
    periodFrom: string;
    periodTo: string;
    versionLabel: string;
    exportFormat: string;
    packageType: string;
    fileName: string;
    fileHashSha256: string;
    totalLines: number;
    totalDebit: number;
    totalCredit: number;
    metadata?: Record<string, unknown>;
  }
): Promise<AuditExportRecord> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('accounty_audit_exports')
    .insert({
      company_id: companyId,
      fiscal_year: params.fiscalYear,
      period_from: params.periodFrom,
      period_to: params.periodTo,
      version_label: params.versionLabel,
      export_format: params.exportFormat,
      package_type: params.packageType,
      file_name: params.fileName,
      file_hash_sha256: params.fileHashSha256,
      total_lines: params.totalLines,
      total_debit: params.totalDebit,
      total_credit: params.totalCredit,
      metadata: params.metadata || {},
      is_stale: false,
      exported_by: user?.id || null,
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Nem sikerült elmenteni a pillanatképet: ${error.message}`);
  }

  return data as AuditExportRecord;
}

/**
 * Generate formatted Excel (.xlsx) file for 20-column GL Journal
 */
export async function generateAuditorGlExcel(
  companyName: string,
  taxNumber: string,
  period: { from: string; to: string },
  lines: AuditorGlLine[],
  summary: AuditorGlSummary
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Visibill eaisyBooks Auditor Engine';
  workbook.lastModifiedBy = 'Visibill';
  workbook.created = new Date();

  // --- Sheet 1: 20-Column General Ledger Journal ---
  const sheet = workbook.addWorksheet('Főkönyvi napló', {
    views: [{ state: 'frozen', ySplit: 4 }],
    pageSetup: { orientation: 'landscape', fitToPage: true },
  });

  // Title & Metadata rows
  sheet.mergeCells('A1:T1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = `KÖNYVVIZSGÁLÓI FŐKÖNYVI KIVONAT ÉS KARTON — ${companyName} (Adószám: ${taxNumber})`;
  titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F172A' }, // Slate 900
  };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getRow(1).height = 34;

  sheet.mergeCells('A2:T2');
  const subtitleCell = sheet.getCell('A2');
  subtitleCell.value = `Vizsgált időszak: ${period.from} – ${period.to} | Tételszám: ${lines.length} | Tartozik: ${summary.total_debit.toLocaleString('hu-HU')} Ft | Követel: ${summary.total_credit.toLocaleString('hu-HU')} Ft | Egyezőség: ${summary.is_balanced ? 'EGYEZIK (0 Ft diff)' : 'KÜLÖNBÖZET: ' + summary.imbalance_diff.toLocaleString('hu-HU') + ' Ft'}`;
  subtitleCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF334155' } };
  subtitleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF1F5F9' },
  };
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.getRow(2).height = 24;

  // Empty separator row 3
  sheet.getRow(3).height = 6;

  // Header Row 4 - The 20 Standard Columns
  const headers = [
    { header: 'Naplókód', key: 'journal_code', width: 12 },
    { header: 'Könyvelési sorszám', key: 'journal_number', width: 18 },
    { header: 'Könyvelés dátuma', key: 'accounting_date', width: 16 },
    { header: 'Bizonylat kelte', key: 'document_date', width: 16 },
    { header: 'Esedékesség', key: 'due_date', width: 16 },
    { header: 'Főkönyvi számlaszám', key: 'gl_account_number', width: 20 },
    { header: 'Számla megnevezése', key: 'gl_account_name', width: 28 },
    { header: 'T/K', key: 'dc_type', width: 8 },
    { header: 'Összeg (HUF)', key: 'amount', width: 18 },
    { header: 'Pénznem', key: 'currency', width: 10 },
    { header: 'Deviza összeg', key: 'foreign_amount', width: 16 },
    { header: 'Árfolyam', key: 'exchange_rate', width: 12 },
    { header: 'Partner adószáma', key: 'partner_tax_number', width: 20 },
    { header: 'Partner neve', key: 'partner_name', width: 30 },
    { header: 'Költséghely', key: 'cost_center', width: 16 },
    { header: 'Munkaszám', key: 'job_code', width: 14 },
    { header: 'Projekt kód', key: 'project_id', width: 16 },
    { header: 'Pályázati azonosító', key: 'grant_id', width: 20 },
    { header: 'Szöveges leírás', key: 'description', width: 35 },
    { header: 'Rögzítő felhasználó', key: 'created_by', width: 22 },
  ];

  const headerRow = sheet.getRow(4);
  headers.forEach((h, idx) => {
    const colNumber = idx + 1;
    sheet.getColumn(colNumber).width = h.width;
    const cell = headerRow.getCell(colNumber);
    cell.value = h.header;
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' }, // Blue 900
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF0F172A' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
    };
  });
  headerRow.height = 28;

  // Insert line rows
  lines.forEach((l, index) => {
    const rowNum = index + 5;
    const row = sheet.getRow(rowNum);

    row.getCell(1).value = l.journal_code;
    row.getCell(2).value = l.journal_number ?? '';
    row.getCell(3).value = l.accounting_date;
    row.getCell(4).value = l.document_date;
    row.getCell(5).value = l.due_date;
    row.getCell(6).value = l.gl_account_number;
    row.getCell(7).value = l.gl_account_name;
    row.getCell(8).value = l.dc_type;
    row.getCell(9).value = l.amount;
    row.getCell(10).value = l.currency;
    row.getCell(11).value = l.foreign_amount ?? '';
    row.getCell(12).value = l.exchange_rate ?? '';
    row.getCell(13).value = l.partner_tax_number ?? '';
    row.getCell(14).value = l.partner_name ?? '';
    row.getCell(15).value = l.cost_center ?? '';
    row.getCell(16).value = l.job_code ?? '';
    row.getCell(17).value = l.project_id ?? '';
    row.getCell(18).value = l.grant_id ?? '';
    row.getCell(19).value = l.description ?? '';
    row.getCell(20).value = l.created_by ?? '';

    // Alignments & formats
    row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(2).alignment = { horizontal: 'center' };
    row.getCell(3).alignment = { horizontal: 'center' };
    row.getCell(4).alignment = { horizontal: 'center' };
    row.getCell(5).alignment = { horizontal: 'center' };
    row.getCell(6).alignment = { horizontal: 'left' };
    row.getCell(8).alignment = { horizontal: 'center' };
    row.getCell(9).numFmt = '#,##0.00';
    row.getCell(9).alignment = { horizontal: 'right' };
    row.getCell(10).alignment = { horizontal: 'center' };
    row.getCell(11).numFmt = '#,##0.00';
    row.getCell(11).alignment = { horizontal: 'right' };
    row.getCell(12).numFmt = '#,##0.0000';
    row.getCell(12).alignment = { horizontal: 'right' };

    // T/K text colors
    if (l.dc_type === 'T') {
      row.getCell(8).font = { bold: true, color: { argb: 'FF15803D' } }; // Green 700
    } else {
      row.getCell(8).font = { bold: true, color: { argb: 'FFB91C1C' } }; // Red 700
    }

    // Zebra striping
    if (index % 2 === 1) {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8FAFC' }, // Slate 50
      };
    }
  });

  // Summary Row at the bottom
  const lastRowNum = lines.length + 5;
  const summaryRow = sheet.getRow(lastRowNum);
  summaryRow.getCell(6).value = 'ÖSSZESEN:';
  summaryRow.getCell(6).font = { bold: true };
  summaryRow.getCell(6).alignment = { horizontal: 'right' };

  summaryRow.getCell(9).value = {
    formula: `SUM(I5:I${lastRowNum - 1})`,
    result: summary.total_debit,
  };
  summaryRow.getCell(9).numFmt = '#,##0.00';
  summaryRow.getCell(9).font = { bold: true };
  summaryRow.getCell(9).alignment = { horizontal: 'right' };

  summaryRow.border = {
    top: { style: 'thin' },
    bottom: { style: 'double' },
  };

  // --- Sheet 2: Audit Control Sheet ---
  const controlSheet = workbook.addWorksheet('Ellenőrző lap');
  controlSheet.columns = [
    { header: 'Paraméter / Metrika', key: 'key', width: 35 },
    { header: 'Érték', key: 'value', width: 45 },
  ];
  controlSheet.addRow({ key: 'Vállalkozás neve', value: companyName });
  controlSheet.addRow({ key: 'Adószám', value: taxNumber });
  controlSheet.addRow({ key: 'Időszak kezdete', value: period.from });
  controlSheet.addRow({ key: 'Időszak vége', value: period.to });
  controlSheet.addRow({ key: 'Generálás időpontja', value: new Date().toISOString() });
  controlSheet.addRow({ key: 'Könyvelési tételek száma', value: lines.length });
  controlSheet.addRow({ key: 'Tartozik forgalom összesen (HUF)', value: summary.total_debit });
  controlSheet.addRow({ key: 'Követel forgalom összesen (HUF)', value: summary.total_credit });
  controlSheet.addRow({ key: 'Különbözet (HUF)', value: summary.imbalance_diff });
  controlSheet.addRow({
    key: 'Kettős könyvviteli egyezőség',
    value: summary.is_balanced ? 'HIBA ÉS KÜLÖNBÖZET MENTES' : 'FIGYELEM: ELTÉRÉS DETEKTÁLVA',
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Generate UTF-8 BOM CSV with semicolon separator
 */
export function generateAuditorGlCsv(lines: AuditorGlLine[]): string {
  const headers = [
    'Naplokod',
    'Konyvelesi_sorszam',
    'Konyveles_datuma',
    'Bizonylat_kelte',
    'Esedekesseg',
    'Fokonyvi_szamlaszam',
    'Szamla_megnevezese',
    'TK',
    'Osszeg_HUF',
    'Penznem',
    'Deviza_osszeg',
    'Arfolyam',
    'Partner_adoszama',
    'Partner_neve',
    'Koltseghely',
    'Munkaszam',
    'Projekt_kod',
    'Palyazati_azonosito',
    'Szoveges_leiras',
    'Rogzito_felhasznalo',
  ];

  const escapeCsv = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    const str = String(val).replace(/"/g, '""');
    if (str.includes(';') || str.includes('\n') || str.includes('"')) {
      return `"${str}"`;
    }
    return str;
  };

  const rows = lines.map((l) => [
    escapeCsv(l.journal_code),
    escapeCsv(l.journal_number),
    escapeCsv(l.accounting_date),
    escapeCsv(l.document_date),
    escapeCsv(l.due_date),
    escapeCsv(l.gl_account_number),
    escapeCsv(l.gl_account_name),
    escapeCsv(l.dc_type),
    escapeCsv(l.amount),
    escapeCsv(l.currency),
    escapeCsv(l.foreign_amount),
    escapeCsv(l.exchange_rate),
    escapeCsv(l.partner_tax_number),
    escapeCsv(l.partner_name),
    escapeCsv(l.cost_center),
    escapeCsv(l.job_code),
    escapeCsv(l.project_id),
    escapeCsv(l.grant_id),
    escapeCsv(l.description),
    escapeCsv(l.created_by),
  ]);

  // UTF-8 BOM prefix
  const bom = '\uFEFF';
  return bom + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
}

/**
 * Generate formatted Excel for ISA 560 Subsequent Cash Settlements Report
 */
export async function generateSubsequentSettlementsExcel(
  companyName: string,
  fiscalYear: number,
  report: SubsequentSettlementsReport
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Visibill ISA 560 Auditor Engine';

  const sheet = workbook.addWorksheet('ISA 560 Fordulónap utáni', {
    views: [{ state: 'frozen', ySplit: 4 }],
  });

  sheet.mergeCells('A1:L1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = `ISA 560: MÉRLERGFORDULÓNAP UTÁNI PÉNZÜGYI RENDEZÉSEK — ${companyName} (${fiscalYear}. üzleti év)`;
  titleCell.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F766E' }, // Teal 700
  };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getRow(1).height = 32;

  sheet.mergeCells('A2:L2');
  const subCell = sheet.getCell('A2');
  subCell.value = `Mérlegfordulónap: ${report.year_end_date} | Vizsgálati zárónap: ${report.cutoff_date} | Vevőkövetelés rendezési arány: ${report.summary.receivables_settlement_rate}% | Szállítói kötelezettség rendezési arány: ${report.summary.payables_settlement_rate}%`;
  subCell.font = { name: 'Segoe UI', size: 10, italic: true };
  subCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF0FDFA' },
  };
  subCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.getRow(2).height = 24;

  sheet.getRow(3).height = 6;

  const headers = [
    { header: 'Irány', width: 10 },
    { header: 'Számlaszám', width: 22 },
    { header: 'Partner neve', width: 30 },
    { header: 'Adószám', width: 18 },
    { header: 'Kelt', width: 14 },
    { header: 'Esedékesség', width: 14 },
    { header: 'Nyitott összeg (Dec 31)', width: 22 },
    { header: 'Fordulónap után rendezett', width: 24 },
    { header: 'Első fizetés', width: 14 },
    { header: 'Utolsó fizetés', width: 14 },
    { header: 'Rendezési %', width: 14 },
    { header: 'Audit státusz', width: 20 },
  ];

  const headerRow = sheet.getRow(4);
  headers.forEach((h, idx) => {
    sheet.getColumn(idx + 1).width = h.width;
    const cell = headerRow.getCell(idx + 1);
    cell.value = h.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF115E59' }, // Teal 800
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  headerRow.height = 26;

  report.items.forEach((item, index) => {
    const row = sheet.getRow(index + 5);
    row.getCell(1).value = item.direction === 'AR' ? 'Vevő (AR)' : 'Szállító (AP)';
    row.getCell(2).value = item.invoice_number;
    row.getCell(3).value = item.partner_name;
    row.getCell(4).value = item.partner_tax_number;
    row.getCell(5).value = item.issue_date;
    row.getCell(6).value = item.due_date;
    row.getCell(7).value = item.open_amount_dec31;
    row.getCell(8).value = item.subsequent_settled_amount;
    row.getCell(9).value = item.first_settlement_date || '-';
    row.getCell(10).value = item.last_settlement_date || '-';
    row.getCell(11).value = `${item.settlement_percentage}%`;
    row.getCell(12).value =
      item.settlement_status === 'SETTLED'
        ? 'Teljesen rendezett'
        : item.settlement_status === 'PARTIALLY_SETTLED'
        ? 'Részben rendezett'
        : 'Rendezetlen / Kétes';

    row.getCell(7).numFmt = '#,##0.00 Ft';
    row.getCell(8).numFmt = '#,##0.00 Ft';
    row.getCell(7).alignment = { horizontal: 'right' };
    row.getCell(8).alignment = { horizontal: 'right' };
    row.getCell(11).alignment = { horizontal: 'center' };
    row.getCell(12).alignment = { horizontal: 'center' };

    if (item.settlement_status === 'SETTLED') {
      row.getCell(12).font = { bold: true, color: { argb: 'FF15803D' } };
    } else if (item.settlement_status === 'PARTIALLY_SETTLED') {
      row.getCell(12).font = { bold: true, color: { argb: 'FFD97706' } };
    } else {
      row.getCell(12).font = { bold: true, color: { argb: 'FFDC2626' } };
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Trigger file download helper
 */
export function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Re-export MKVK Audit XML utilities for full zero-redundancy integration
 */
export { generateMkvkAuditXml, downloadMkvkAuditXml, getMkvkAuditXmlFileName };
