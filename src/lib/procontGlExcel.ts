/**
 * PROCONT Főkönyvi Kivonat — Excel (.xlsx) Export
 * 
 * A tests/docs/eb0148/PRCNT FŐKÖNYV.pdf mintája alapján generált
 * formázott Excel munkafüzet kétszintes fejléccel és Egyezőség Számítás blokkal.
 */

import {
  buildProcontGlData,
  type ProcontGlData,
  type ProcontAccountInput,
  type ProcontBuildOptions,
} from './procontGlData';

/**
 * Generates and triggers client-side download of the PROCONT Főkönyvi Kivonat in Excel format.
 */
export async function exportProcontGlExcel(
  inputAccounts: ProcontAccountInput[],
  options: ProcontBuildOptions = {}
): Promise<void> {
  const { default: ExcelJS } = await import('exceljs');
  const data: ProcontGlData = buildProcontGlData(inputAccounts, options);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Visibill / eaisyBooks';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('Főkönyvi kivonat', {
    views: [{ showGridLines: true }],
  });

  // Set column widths
  ws.columns = [
    { key: 'account_number', width: 18 },
    { key: 'account_name', width: 48 },
    { key: 'turnover_debit', width: 18 },
    { key: 'turnover_credit', width: 18 },
    { key: 'balance_debit', width: 18 },
    { key: 'balance_credit', width: 18 },
  ];

  // 1. Document Title Section
  const rowCompany = ws.addRow([data.companyName.toUpperCase()]);
  rowCompany.font = { bold: true, size: 12 };

  const rowTitle = ws.addRow(['FŐKÖNYVI KIVONAT']);
  rowTitle.font = { bold: true, size: 14 };

  const rowPeriod = ws.addRow([data.formattedPeriod]);
  rowPeriod.font = { bold: true, size: 11, color: { argb: 'FF374151' } };

  const rowOpening = ws.addRow(['Nyitó tételekkel']);
  rowOpening.font = { italic: true, size: 9, color: { argb: 'FF6B7280' } };

  ws.addRow([]); // Blank spacer row

  // 2. Two-Tier Table Header
  const headerStartRowIndex = ws.rowCount + 1; // e.g. row 6

  // Tier 1 Header
  const rowH1 = ws.addRow({
    account_number: 'Főkönyvi szám',
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
    r.font = { bold: true, size: 10 };
    r.alignment = { vertical: 'middle', horizontal: 'center' };
    r.eachCell(cell => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F4F6' },
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      };
    });
  });

  rowH1.getCell('account_number').alignment = { vertical: 'middle', horizontal: 'left' };
  rowH1.getCell('account_name').alignment = { vertical: 'middle', horizontal: 'left' };

  // 3. Body Rows
  const numFmt = '#,##0';

  data.rows.forEach(r => {
    const isClass = r.level === 'class';
    const isGroup = r.level === 'group' || r.level === 'subgroup';

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
      row.font = { bold: true, size: 10 };
      row.eachCell(cell => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE5E7EB' }, // Light gray class banner
        };
      });
    } else if (isGroup) {
      row.font = { bold: true, size: 9.5 };
    } else {
      row.font = { size: 9 };
    }
  });

  // 4. Grand Total Row (Összesen:)
  const totalRowIndex = ws.rowCount + 1;
  const totalRow = ws.addRow({
    account_number: 'Összesen:',
    account_name: '',
    turnover_debit: data.totals.turnoverDebit,
    turnover_credit: data.totals.turnoverCredit,
    balance_debit: data.totals.balanceDebit,
    balance_credit: data.totals.balanceCredit,
  });

  ws.mergeCells(`A${totalRowIndex}:B${totalRowIndex}`);
  totalRow.font = { bold: true, size: 10.5 };
  totalRow.getCell('turnover_debit').numFmt = numFmt;
  totalRow.getCell('turnover_credit').numFmt = numFmt;
  totalRow.getCell('balance_debit').numFmt = numFmt;
  totalRow.getCell('balance_credit').numFmt = numFmt;

  totalRow.eachCell(cell => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD1D5DB' },
    };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF374151' } },
      bottom: { style: 'medium', color: { argb: 'FF374151' } },
    };
  });

  ws.addRow([]); // Blank spacer row

  // 5. EGYEZŐSÉG SZÁMÍTÁS Section
  const reconTitleRow = ws.addRow(['EGYEZŐSÉG SZÁMÍTÁS']);
  reconTitleRow.font = { bold: true, size: 11 };

  // Row: 1 - 4 számlaosztályok
  const r14Index = ws.rowCount + 1;
  const row14 = ws.addRow({
    account_number: '1 - 4 számlaosztályok',
    account_name: '',
    turnover_debit: data.reconciliation.classes1to4.turnoverDebit,
    turnover_credit: data.reconciliation.classes1to4.turnoverCredit,
    balance_debit: data.reconciliation.classes1to4.balanceDebit,
    balance_credit: data.reconciliation.classes1to4.balanceCredit,
  });
  ws.mergeCells(`A${r14Index}:B${r14Index}`);
  row14.font = { bold: false, size: 9.5 };
  row14.getCell('turnover_debit').numFmt = numFmt;
  row14.getCell('turnover_credit').numFmt = numFmt;
  row14.getCell('balance_debit').numFmt = numFmt;
  row14.getCell('balance_credit').numFmt = numFmt;

  // Row: 5 - 9 számlaosztályok
  const r59Index = ws.rowCount + 1;
  const row59 = ws.addRow({
    account_number: '5 - 9 számlaosztályok',
    account_name: '',
    turnover_debit: data.reconciliation.classes5to9.turnoverDebit,
    turnover_credit: data.reconciliation.classes5to9.turnoverCredit,
    balance_debit: data.reconciliation.classes5to9.balanceDebit,
    balance_credit: data.reconciliation.classes5to9.balanceCredit,
  });
  ws.mergeCells(`A${r59Index}:B${r59Index}`);
  row59.font = { bold: false, size: 9.5 };
  row59.getCell('turnover_debit').numFmt = numFmt;
  row59.getCell('turnover_credit').numFmt = numFmt;
  row59.getCell('balance_debit').numFmt = numFmt;
  row59.getCell('balance_credit').numFmt = numFmt;

  // 6. Generate buffer and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);

  const safeComp = (data.companyName || 'Ceg').replace(/[^a-zA-Z0-9]/g, '_');
  const period = data.formattedPeriod.replace(/[^a-zA-Z0-9]/g, '_') || 'idoszak';
  const zeroSuffix = options.excludeZeroRows ? '_0_nelkul' : '';
  const filename = `Procont_Fokonyvi_Kivonat_${safeComp}_${period}${zeroSuffix}.xlsx`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
