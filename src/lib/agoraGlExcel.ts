/**
 * AGORA (Novitax) Főkönyvi Kivonat — Excel (.xlsx) Export
 * 
 * A tests/docs/eb0148/FokonyviKivonat.pdf mintája alapján generált
 * formázott Excel munkafüzet kétszintes fejléccel és a Novitax stílusú
 * 3-soros záró mérlegegyezőségi blokkal.
 */

import {
  buildAgoraGlData,
  type AgoraGlData,
  type AgoraBuildOptions,
} from './agoraGlData';
import type { ProcontAccountInput } from './procontGlData';

/**
 * Generates and triggers client-side download of the AGORA Főkönyvi Kivonat in Excel format.
 */
export async function exportAgoraGlExcel(
  inputAccounts: ProcontAccountInput[],
  options: AgoraBuildOptions = {}
): Promise<void> {
  const { default: ExcelJS } = await import('exceljs');
  const data: AgoraGlData = buildAgoraGlData(inputAccounts, options);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = data.branding || 'EaisyBill';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('Főkönyvi kivonat', {
    views: [{ showGridLines: true }],
  });

  // Set column widths
  ws.columns = [
    { key: 'account_number', width: 14 },
    { key: 'account_name', width: 50 },
    { key: 'turnover_debit', width: 18 },
    { key: 'turnover_credit', width: 18 },
    { key: 'balance_debit', width: 18 },
    { key: 'balance_credit', width: 18 },
  ];

  const companyHeaderStr = data.taxNumber
    ? `${data.companyName} ( ${data.taxNumber} )`
    : data.companyName;

  // 1. Document Title Section
  // Row 1: Company + List ID
  const rowTop = ws.addRow({
    account_number: companyHeaderStr,
    balance_credit: `Listaazonosító: ${data.listId}`,
  });
  rowTop.font = { bold: true, size: 10 };
  ws.mergeCells(`A1:C1`);
  ws.mergeCells(`D1:F1`);
  rowTop.getCell('balance_credit').alignment = { horizontal: 'right' };

  // Row 2: Document Title
  const rowTitle = ws.addRow(['FŐKÖNYVI KIVONAT']);
  rowTitle.font = { bold: true, size: 14 };
  rowTitle.alignment = { horizontal: 'center' };
  ws.mergeCells(`A2:F2`);

  // Row 3: Year & Currency
  const rowYear = ws.addRow({
    account_number: data.year,
    balance_credit: `Devizanem: ${data.currency}`,
  });
  rowYear.font = { bold: true, size: 11 };
  ws.mergeCells(`A3:E3`);
  rowYear.getCell('account_number').alignment = { horizontal: 'center' };
  rowYear.getCell('balance_credit').alignment = { horizontal: 'right' };

  // Row 4: Period Text (Hónap: 0 - 09 (Időszaki))
  const rowPeriod = ws.addRow([data.periodText]);
  rowPeriod.font = { bold: true, size: 9.5, color: { argb: 'FF1F2937' } };
  ws.mergeCells(`A4:F4`);

  ws.addRow([]); // Blank spacer row

  // 2. Two-Tier Table Header
  const headerStartRowIndex = ws.rowCount + 1; // e.g. row 6

  // Tier 1 Header
  const rowH1 = ws.addRow({
    account_number: 'Szla.',
    account_name: 'Megnevezés',
    turnover_debit: 'Forgalom',
    turnover_credit: '',
    balance_debit: 'Egyenleg',
    balance_credit: '',
  });

  // Tier 2 Header
  const rowH2 = ws.addRow({
    account_number: '',
    account_name: '',
    turnover_debit: 'Tartozik',
    turnover_credit: 'Követel',
    balance_debit: 'Tartozik',
    balance_credit: 'Követel',
  });

  // Merge header cells
  ws.mergeCells(`A${headerStartRowIndex}:A${headerStartRowIndex + 1}`);
  ws.mergeCells(`B${headerStartRowIndex}:B${headerStartRowIndex + 1}`);
  ws.mergeCells(`C${headerStartRowIndex}:D${headerStartRowIndex}`);
  ws.mergeCells(`E${headerStartRowIndex}:F${headerStartRowIndex}`);

  // Style Header Rows
  [rowH1, rowH2].forEach(r => {
    r.font = { bold: true, size: 9.5 };
    r.alignment = { vertical: 'middle', horizontal: 'center' };
    r.eachCell(cell => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE5E7EB' },
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF9CA3AF' } },
        bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } },
        left: { style: 'thin', color: { argb: 'FF9CA3AF' } },
        right: { style: 'thin', color: { argb: 'FF9CA3AF' } },
      };
    });
  });

  rowH1.getCell('account_number').alignment = { vertical: 'middle', horizontal: 'left' };
  rowH1.getCell('account_name').alignment = { vertical: 'middle', horizontal: 'left' };

  // 3. Body Rows
  const isHuf = (data.currency || 'HUF').toUpperCase() === 'HUF';
  const numFmt = isHuf ? '#,##0' : '#,##0.00';

  data.rows.forEach(r => {
    const isClass = r.level === 'class';
    const isGroup = r.level === 'group';

    const row = ws.addRow({
      account_number: r.accountNumber,
      account_name: r.accountName,
      turnover_debit: r.turnoverDebit,
      turnover_credit: r.turnoverCredit,
      balance_debit: r.balanceDebit,
      balance_credit: r.balanceCredit,
    });

    row.getCell('turnover_debit').numFmt = numFmt;
    row.getCell('turnover_credit').numFmt = numFmt;
    row.getCell('balance_debit').numFmt = numFmt;
    row.getCell('balance_credit').numFmt = numFmt;

    if (isClass) {
      row.font = { bold: true, size: 9.5 };
      row.eachCell(cell => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE5E7EB' }, // Light gray class banner
        };
      });
    } else if (isGroup) {
      row.font = { bold: true, size: 9 };
    } else {
      row.font = { size: 9 };
    }
  });

  ws.addRow([]); // Blank spacer row

  // 4. Summary Rows (Page 4 style)
  // Row 1: 1 - 4 számlaosztályok összesen
  const r14Index = ws.rowCount + 1;
  const row14 = ws.addRow({
    account_number: '1 - 4 számlaosztályok összesen',
    account_name: '',
    turnover_debit: data.reconciliation.classes1to4.turnoverDebit,
    turnover_credit: data.reconciliation.classes1to4.turnoverCredit,
    balance_debit: data.reconciliation.classes1to4.balanceDebit > 0 ? data.reconciliation.classes1to4.balanceDebit : null,
    balance_credit: data.reconciliation.classes1to4.balanceCredit > 0 ? data.reconciliation.classes1to4.balanceCredit : null,
  });
  ws.mergeCells(`A${r14Index}:B${r14Index}`);
  row14.font = { bold: true, size: 9.5 };
  row14.getCell('turnover_debit').numFmt = numFmt;
  row14.getCell('turnover_credit').numFmt = numFmt;
  row14.getCell('balance_debit').numFmt = numFmt;
  row14.getCell('balance_credit').numFmt = numFmt;

  // Row 2: 5 - 9 számlaosztályok összesen
  const r59Index = ws.rowCount + 1;
  const row59 = ws.addRow({
    account_number: '5 - 9 számlaosztályok összesen',
    account_name: '',
    turnover_debit: data.reconciliation.classes5to9.turnoverDebit,
    turnover_credit: data.reconciliation.classes5to9.turnoverCredit,
    balance_debit: data.reconciliation.classes5to9.balanceDebit > 0 ? data.reconciliation.classes5to9.balanceDebit : null,
    balance_credit: data.reconciliation.classes5to9.balanceCredit > 0 ? data.reconciliation.classes5to9.balanceCredit : null,
  });
  ws.mergeCells(`A${r59Index}:B${r59Index}`);
  row59.font = { bold: true, size: 9.5 };
  row59.getCell('turnover_debit').numFmt = numFmt;
  row59.getCell('turnover_credit').numFmt = numFmt;
  row59.getCell('balance_debit').numFmt = numFmt;
  row59.getCell('balance_credit').numFmt = numFmt;

  // Row 3: 1 - 9 számlaosztályok összesen
  const rTotalIndex = ws.rowCount + 1;
  const rowTotal = ws.addRow({
    account_number: '1 - 9 számlaosztályok összesen',
    account_name: '',
    turnover_debit: data.reconciliation.grandTotal.turnoverDebit,
    turnover_credit: data.reconciliation.grandTotal.turnoverCredit,
    balance_debit: null,
    balance_credit: null,
  });
  ws.mergeCells(`A${rTotalIndex}:B${rTotalIndex}`);
  rowTotal.font = { bold: true, size: 10 };
  rowTotal.getCell('turnover_debit').numFmt = numFmt;
  rowTotal.getCell('turnover_credit').numFmt = numFmt;

  rowTotal.eachCell(cell => {
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF1F2937' } },
      bottom: { style: 'double', color: { argb: 'FF1F2937' } },
    };
  });

  // Footer branding row
  ws.addRow([]);
  const footerRow = ws.addRow([
    `${data.exportDate} | ${data.branding || 'EaisyBill'} | Regisztrálva: ${companyHeaderStr}`,
  ]);
  footerRow.font = { italic: true, size: 8, color: { argb: 'FF6B7280' } };
  ws.mergeCells(`A${ws.rowCount}:F${ws.rowCount}`);

  // 5. Generate buffer and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const safeComp = (data.companyName || 'Ceg').replace(/[^a-zA-Z0-9]/g, '_');
  const period = data.periodText.replace(/[^a-zA-Z0-9]/g, '_') || 'idoszak';
  const zeroSuffix = options.excludeZeroRows ? '_0_nelkul' : '';
  const filename = `A_Fokonyvi_Kivonat_${safeComp}_${data.year}_${period}${zeroSuffix}.xlsx`;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
