/**
 * RLB-60 Főkönyvi Kivonat — Excel (.xlsx) Export Motor
 * 
 * A tests/docs/eb0148/Főkönyvi kivonat-alap. bankoknak is jó..pdf és
 * a tests/docs/eb0148/Főkönyvi kivonat-bővített-vevő-szállító- pl. könyvvizsgálónak.pdf
 * alapján generált formázott Excel munkafüzet kétszintes fejléccel és mérlegegyezőségi összesítéssel.
 */

import {
  buildRlbGlData,
  type RlbGlData,
  type RlbAccountInput,
  type RlbBuildOptions,
} from './rlbGlData';

/**
 * Generates and triggers client-side download of the RLB-60 Főkönyvi Kivonat in Excel format.
 */
export async function exportRlbGlExcel(
  inputAccounts: RlbAccountInput[],
  options: RlbBuildOptions = {}
): Promise<void> {
  const { default: ExcelJS } = await import('exceljs');
  const data: RlbGlData = buildRlbGlData(inputAccounts, options);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Visibill / eaisyBooks';
  workbook.created = new Date();

  const sheetName = data.mode === 'extended' ? 'RLB Bővített kivonat' : 'RLB Alap kivonat';
  const ws = workbook.addWorksheet(sheetName, {
    views: [{ showGridLines: true }],
  });

  // Set column widths
  ws.columns = [
    { key: 'account_number', width: 22 },
    { key: 'account_name', width: 55 },
    { key: 'turnover_debit', width: 18 },
    { key: 'turnover_credit', width: 18 },
    { key: 'balance_debit', width: 18 },
    { key: 'balance_credit', width: 18 },
  ];

  // 1. Top Banner Row (Dark Slate / Charcoal)
  const rowBanner = ws.addRow(['FŐKÖNYVI KIVONAT', '', '', '', '', data.taxNumber ? `${data.companyName} (${data.taxNumber}) - ${data.year}` : `${data.companyName} - ${data.year}`]);
  ws.mergeCells(`A1:D1`);
  ws.mergeCells(`E1:F1`);

  rowBanner.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
  rowBanner.alignment = { vertical: 'middle' };
  rowBanner.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
  rowBanner.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };

  for (let c = 1; c <= 6; c++) {
    rowBanner.getCell(c).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF475569' }, // Slate-600
    };
  }

  // 2. Subtitle: Period
  const rowPeriod = ws.addRow([data.formattedPeriod || `Időszak: ${data.year}.01.01-${data.year}.12.31`]);
  rowPeriod.font = { bold: false, size: 10, color: { argb: 'FF334155' } };

  ws.addRow([]); // Blank spacer

  // 3. Two-Tier Table Header
  const headerStartRowIndex = ws.rowCount + 1; // row 4

  const rowH1 = ws.addRow({
    account_number: 'Fők.szám',
    account_name: 'Megnevezés',
    turnover_debit: 'Forgalom',
    turnover_credit: '',
    balance_debit: 'Egyenleg',
    balance_credit: '',
  });

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
        fgColor: { argb: 'FFF1F5F9' },
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });
  });

  // 4. Data Rows
  const numFmt = '#,##0;(#,##0);"-"';

  data.rows.forEach(r => {
    const row = ws.addRow({
      account_number: r.accountNumber,
      account_name: (r.isPartner ? '    ' : '') + r.accountName,
      turnover_debit: r.turnoverDebit || 0,
      turnover_credit: r.turnoverCredit || 0,
      balance_debit: r.balanceDebit || 0,
      balance_credit: r.balanceCredit || 0,
    });

    // Formatting numbers
    [3, 4, 5, 6].forEach(colIndex => {
      const cell = row.getCell(colIndex);
      cell.numFmt = numFmt;
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    });

    row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };

    // Row styles based on level
    if (r.level === 'class') {
      row.font = { bold: true, size: 10 };
      for (let c = 1; c <= 6; c++) {
        row.getCell(c).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE2E8F0' }, // #E2E8F0 light slate
        };
      }
    } else if (r.level === 'group') {
      row.font = { bold: true, size: 9.5 };
    } else if (r.isPartner) {
      row.font = { italic: false, size: 8.5, color: { argb: 'FF475569' } };
    } else {
      row.font = { size: 9 };
    }
  });

  // 5. Total Rows (1-4, 5-9, Mindösszesen)
  const addSummaryRow = (title: string, d: number, c: number, bd: number, bc: number, isGrand = false) => {
    const curIndex = ws.rowCount + 1;
    const row = ws.addRow({
      account_number: title,
      account_name: '',
      turnover_debit: d,
      turnover_credit: c,
      balance_debit: isGrand ? '' : bd,
      balance_credit: isGrand ? '' : bc,
    });

    ws.mergeCells(`A${curIndex}:B${curIndex}`);

    [3, 4, 5, 6].forEach(colIndex => {
      const cell = row.getCell(colIndex);
      if (typeof cell.value === 'number') {
        cell.numFmt = numFmt;
      }
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    });

    row.font = { bold: true, size: isGrand ? 10.5 : 10 };

    const bgColor = isGrand ? 'FFCBD5E1' : 'FFF1F5F9';
    for (let col = 1; col <= 6; col++) {
      row.getCell(col).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: bgColor },
      };
      row.getCell(col).border = {
        top: { style: isGrand ? 'medium' : 'thin', color: { argb: 'FF475569' } },
        bottom: { style: isGrand ? 'double' : 'thin', color: { argb: 'FF475569' } },
      };
    }
  };

  addSummaryRow(
    '1-4 számlaosztály összesen',
    data.classSummary.classes1to4.turnoverDebit,
    data.classSummary.classes1to4.turnoverCredit,
    data.classSummary.classes1to4.balanceDebit,
    data.classSummary.classes1to4.balanceCredit
  );

  addSummaryRow(
    '5-9 számlaosztály összesen',
    data.classSummary.classes5to9.turnoverDebit,
    data.classSummary.classes5to9.turnoverCredit,
    data.classSummary.classes5to9.balanceDebit,
    data.classSummary.classes5to9.balanceCredit
  );

  addSummaryRow(
    'Mindösszesen',
    data.classSummary.grandTotal.turnoverDebit,
    data.classSummary.grandTotal.turnoverCredit,
    0,
    0,
    true
  );

  // Trigger browser download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  const cleanName = (options.companyName || 'vallalkozas').replace(/[^a-zA-Z0-9_\-]/g, '_');
  const modeSuffix = data.mode === 'extended' ? 'bovitett_vevo_szallito' : 'alap';
  const yearStr = options.dateFrom ? options.dateFrom.substring(0, 4) : new Date().getFullYear();
  anchor.download = `Fokonyvi_kivonat_${modeSuffix}_${cleanName}_${yearStr}.xlsx`;
  anchor.click();
  window.URL.revokeObjectURL(url);
}
