import ExcelJS from 'exceljs';

interface GLRow {
  id: string;
  name: string;
  balance: number;
  hasChildren?: boolean;
  cid: string;
  isItem?: boolean;
  itemType?: string;
  partner?: string | null;
  date?: string | null;
  depth?: number;
  isRoot?: boolean;
}

export const exportGlExcel = async (
  processedRows: GLRow[],
  companyName: string = 'Vállalkozás',
  footerTotal: number = 0
) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'eaisybill';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Főkönyvi Kivonat', {
    views: [{ showGridLines: false }],
    properties: {
      outlineProperties: {
        summaryBelow: false,
        summaryRight: false,
      }
    }
  });

  // Set Columns
  worksheet.columns = [
    { header: 'Főkönyvi szám', key: 'gl_number', width: 18 },
    { header: 'Megnevezés', key: 'name', width: 60 },
    { header: 'Összesített Egyenleg', key: 'balance', width: 22 },
  ];

  // Style the header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F2937' },
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 25;

  const numberFormat = '#,##0.00';

  // Add Data
  for (const row of processedRows) {
    // Skip hidden rows - only show visible ones
    if (row.isItem) {
      // Transaction item row
      const dateStr = row.date ? row.date.substring(0, 10).replace(/-/g, '.') : '';
      const partnerStr = row.partner ? `${row.partner} - ` : '';

      const txRow = worksheet.addRow({
        gl_number: dateStr,
        name: `      • ${partnerStr}${row.name}`,
        balance: row.balance,
      });

      txRow.font = { size: 10, color: { argb: 'FF6B7280' } };
      txRow.getCell('balance').numFmt = numberFormat;
      txRow.outlineLevel = Math.min((row.depth || 0), 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

      txRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF9FAFB' },
      };
    } else {
      // GL account row
      const indent = '   '.repeat(row.depth || 0);

      const glRow = worksheet.addRow({
        gl_number: row.id,
        name: `${indent}${row.name}`,
        balance: row.balance,
      });

      glRow.getCell('balance').numFmt = numberFormat;
      glRow.getCell('gl_number').alignment = { horizontal: 'center' };

      const level = Math.min((row.depth || 0), 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
      if (level > 0) {
        glRow.outlineLevel = level;
      }

      if (row.isRoot) {
        glRow.font = { bold: true, size: 11 };
        glRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF3F4F6' },
        };
        glRow.eachCell((cell) => {
          cell.border = { top: { style: 'thin', color: { argb: 'FFD1D5DB' } } };
        });
      } else if (row.hasChildren) {
        glRow.font = { bold: true };
      }
    }
  }

  // Footer total row
  const totalRow = worksheet.addRow({
    gl_number: '',
    name: 'ÖSSZESEN',
    balance: footerTotal,
  });
  totalRow.font = { bold: true, size: 12 };
  totalRow.getCell('balance').numFmt = numberFormat;
  totalRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8F5E9' },
  };
  totalRow.eachCell((cell) => {
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF2E7D32' } },
      bottom: { style: 'medium', color: { argb: 'FF2E7D32' } },
    };
  });

  // Freeze the top row
  worksheet.views = [
    { state: 'frozen', xSplit: 0, ySplit: 1, showGridLines: false }
  ];

  // Generate the file
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);

  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const filename = `Fokonyvikivonat_${companyName.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.xlsx`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// ── F6: Analytical Ledger Export (Tartozik / Követel bontás) ──

export const exportGlAnalyticalExcel = async (
  processedRows: GLRow[],
  companyName: string = 'Vállalkozás',
  footerTotal: number = 0
) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'eaisybill';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('Analitikus Kivonat', {
    views: [{ showGridLines: false }],
  });

  ws.columns = [
    { header: 'Főkönyvi szám', key: 'gl_number', width: 16 },
    { header: 'Megnevezés', key: 'name', width: 50 },
    { header: 'Partner', key: 'partner', width: 28 },
    { header: 'Dátum', key: 'date', width: 14 },
    { header: 'Tartozik', key: 'debit', width: 18 },
    { header: 'Követel', key: 'credit', width: 18 },
    { header: 'Egyenleg', key: 'balance', width: 18 },
  ];

  // Header style
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 28;

  const numFmt = '#,##0.00';
  let totalDebit = 0;
  let totalCredit = 0;

  for (const row of processedRows) {
    const debit = row.balance > 0 ? row.balance : 0;
    const credit = row.balance < 0 ? Math.abs(row.balance) : 0;

    if (row.isItem) {
      const dateStr = row.date ? row.date.substring(0, 10).replace(/-/g, '.') : '';
      const r = ws.addRow({
        gl_number: '',
        name: `  • ${row.name}`,
        partner: row.partner || '',
        date: dateStr,
        debit: debit || '',
        credit: credit || '',
        balance: row.balance,
      });
      r.font = { size: 9, color: { argb: 'FF6B7280' } };
      r.getCell('debit').numFmt = numFmt;
      r.getCell('credit').numFmt = numFmt;
      r.getCell('balance').numFmt = numFmt;
      r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } };
      // Items are counted in their parent's totals, don't double-count
    } else {
      const indent = '  '.repeat(row.depth || 0);
      const r = ws.addRow({
        gl_number: row.id,
        name: `${indent}${row.name}`,
        partner: '',
        date: '',
        debit: debit || '',
        credit: credit || '',
        balance: row.balance,
      });
      r.getCell('gl_number').alignment = { horizontal: 'center' };
      r.getCell('debit').numFmt = numFmt;
      r.getCell('credit').numFmt = numFmt;
      r.getCell('balance').numFmt = numFmt;

      if (row.isRoot) {
        r.font = { bold: true, size: 11 };
        r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
        r.eachCell(c => { c.border = { top: { style: 'thin', color: { argb: 'FFD1D5DB' } } }; });
        // Sum root-level debit/credit for footer
        totalDebit += debit;
        totalCredit += credit;
      } else if (row.hasChildren) {
        r.font = { bold: true };
      }
    }
  }

  // Footer
  const totalRow = ws.addRow({
    gl_number: '',
    name: 'ÖSSZESEN',
    partner: '',
    date: '',
    debit: totalDebit,
    credit: totalCredit,
    balance: footerTotal,
  });
  totalRow.font = { bold: true, size: 11 };
  totalRow.getCell('debit').numFmt = numFmt;
  totalRow.getCell('credit').numFmt = numFmt;
  totalRow.getCell('balance').numFmt = numFmt;
  totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
  totalRow.eachCell(c => {
    c.border = {
      top: { style: 'medium', color: { argb: 'FF2E7D32' } },
      bottom: { style: 'medium', color: { argb: 'FF2E7D32' } },
    };
  });

  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1, showGridLines: false }];

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);

  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const filename = `Analitikus_Kivonat_${companyName.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.xlsx`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
