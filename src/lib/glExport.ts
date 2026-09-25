export interface GLRow {
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
  debitTurnover?: number;
  creditTurnover?: number;
  hasAccountChildren?: boolean;
}

export interface GlExportTotals {
  turnoverDebit?: number;
  turnoverCredit?: number;
  balanceDebit?: number;
  balanceCredit?: number;
}

export interface GlExportOptions {
  excludeZeroRows?: boolean;
}

export const exportGlExcel = async (
  processedRows: GLRow[],
  companyName: string = 'Vállalkozás',
  footerTotal: number | GlExportTotals = 0,
  dateBasis?: 'kibocsatas' | 'teljesites',
  dateFrom?: string,
  dateTo?: string,
  options?: GlExportOptions
) => {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'eaisybill';
  workbook.created = new Date();

  const excludeZero = options?.excludeZeroRows ?? false;
  const rowsToExport = excludeZero
    ? processedRows.filter(row => Math.abs(row.balance || 0) > 0.001)
    : processedRows;

  const basisLabel = dateBasis === 'teljesites' ? 'Teljesítés dátuma' : 'Kibocsátás kelte';
  const worksheet = workbook.addWorksheet(excludeZero ? 'Főkönyvi Kivonat (0 nélkül)' : 'Főkönyvi Kivonat', {
    views: [{ showGridLines: false }],
    properties: {
      outlineProperties: {
        summaryBelow: false,
        summaryRight: false,
      }
    }
  });

  // Set 6 Columns: 2 identification columns + 4 financial columns
  worksheet.columns = [
    { key: 'gl_number', width: 24 },
    { key: 'name', width: 55 },
    { key: 'turnover_debit', width: 18 },
    { key: 'turnover_credit', width: 18 },
    { key: 'balance_debit', width: 18 },
    { key: 'balance_credit', width: 18 },
  ];

  // Header Row 1: Main groups
  const row1 = worksheet.addRow({
    gl_number: `Főkönyvi szám / Dátum (${basisLabel})`,
    name: 'Megnevezés',
    turnover_debit: 'Forgalom',
    turnover_credit: '',
    balance_debit: 'Egyenleg',
    balance_credit: '',
  });

  // Header Row 2: Sub-columns (Tartozik / Követel)
  const row2 = worksheet.addRow({
    gl_number: '',
    name: '',
    turnover_debit: 'Tartozik',
    turnover_credit: 'Követel',
    balance_debit: 'Tartozik',
    balance_credit: 'Követel',
  });

  // Merging cells for hierarchical header
  worksheet.mergeCells('A1:A2');
  worksheet.mergeCells('B1:B2');
  worksheet.mergeCells('C1:D1');
  worksheet.mergeCells('E1:F1');

  // Style Header Row 1
  row1.height = 26;
  row1.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  row1.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F2937' },
  };
  row1.alignment = { vertical: 'middle', horizontal: 'center' };

  // Style Header Row 2
  row2.height = 22;
  row2.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  row2.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF374151' },
  };
  row2.alignment = { vertical: 'middle', horizontal: 'center' };

  const cellA1 = worksheet.getCell('A1');
  cellA1.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  const cellB1 = worksheet.getCell('B1');
  cellB1.alignment = { vertical: 'middle', horizontal: 'left' };

  const numberFormat = '#,##0.00';

  // Add Data
  for (const row of rowsToExport) {
    if (row.isItem) {
      // Transaction item row
      const dateStr = row.date ? row.date.substring(0, 10).replace(/-/g, '.') : '';
      const partnerStr = row.partner ? `${row.partner} - ` : '';

      const isDebit = row.balance > 0;
      const isCredit = row.balance < 0;
      const absVal = Math.abs(row.balance);

      const txRow = worksheet.addRow({
        gl_number: dateStr,
        name: `${partnerStr}${row.name}`,
        turnover_debit: isDebit ? row.balance : null,
        turnover_credit: isCredit ? absVal : null,
        balance_debit: isDebit ? row.balance : null,
        balance_credit: isCredit ? absVal : null,
      });

      txRow.font = { italic: true, color: { argb: 'FF6B7280' }, size: 9 };
      txRow.outlineLevel = 2;
      txRow.getCell('turnover_debit').numFmt = numberFormat;
      txRow.getCell('turnover_credit').numFmt = numberFormat;
      txRow.getCell('balance_debit').numFmt = numberFormat;
      txRow.getCell('balance_credit').numFmt = numberFormat;
      txRow.getCell('name').alignment = { indent: 2 };
      txRow.getCell('gl_number').alignment = { indent: 1 };
    } else {
      // GL Account row
      const isHeader = row.hasChildren;
      const isLevel0 = row.depth === 0 || row.isRoot;

      const debitTurnoverVal = (row.debitTurnover !== undefined && row.debitTurnover > 0.001)
        ? row.debitTurnover
        : (!row.hasChildren && !row.hasAccountChildren && row.balance > 0 ? row.balance : null);

      const creditTurnoverVal = (row.creditTurnover !== undefined && row.creditTurnover > 0.001)
        ? row.creditTurnover
        : (!row.hasChildren && !row.hasAccountChildren && row.balance < 0 ? Math.abs(row.balance) : null);

      const balanceDebitVal = row.balance > 0.001 ? row.balance : null;
      const balanceCreditVal = row.balance < -0.001 ? Math.abs(row.balance) : null;

      const excelRow = worksheet.addRow({
        gl_number: row.id,
        name: row.name,
        turnover_debit: debitTurnoverVal,
        turnover_credit: creditTurnoverVal,
        balance_debit: balanceDebitVal,
        balance_credit: balanceCreditVal,
      });

      excelRow.getCell('turnover_debit').numFmt = numberFormat;
      excelRow.getCell('turnover_credit').numFmt = numberFormat;
      excelRow.getCell('balance_debit').numFmt = numberFormat;
      excelRow.getCell('balance_credit').numFmt = numberFormat;

      if (row.depth !== undefined) {
        excelRow.outlineLevel = row.depth;
      }

      if (isLevel0) {
        excelRow.font = { bold: true, size: 11, color: { argb: 'FF111827' } };
        excelRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF3F4F6' },
        };
      } else if (isHeader) {
        excelRow.font = { bold: true, size: 10, color: { argb: 'FF374151' } };
      } else {
        excelRow.font = { size: 10, color: { argb: 'FF4B5563' } };
      }
    }
  }

  // Calculate totals
  const totals: GlExportTotals = typeof footerTotal === 'object' && footerTotal !== null
    ? {
        turnoverDebit: footerTotal.turnoverDebit ?? 0,
        turnoverCredit: footerTotal.turnoverCredit ?? 0,
        balanceDebit: footerTotal.balanceDebit ?? 0,
        balanceCredit: footerTotal.balanceCredit ?? 0,
      }
    : (() => {
        const leaves = rowsToExport.filter(r => !r.isItem && !r.hasChildren);
        const tDebit = leaves.filter(d => d.balance > 0).reduce((s, d) => s + d.balance, 0);
        const tCredit = leaves.filter(d => d.balance < 0).reduce((s, d) => s + Math.abs(d.balance), 0);
        return {
          turnoverDebit: tDebit,
          turnoverCredit: tCredit,
          balanceDebit: tDebit,
          balanceCredit: tCredit,
        };
      })();

  // Footer Total Row
  const footerRow = worksheet.addRow({
    gl_number: '',
    name: 'ÖSSZESEN',
    turnover_debit: totals.turnoverDebit,
    turnover_credit: totals.turnoverCredit,
    balance_debit: totals.balanceDebit,
    balance_credit: totals.balanceCredit,
  });

  footerRow.font = { bold: true, size: 11 };
  footerRow.getCell('turnover_debit').numFmt = numberFormat;
  footerRow.getCell('turnover_credit').numFmt = numberFormat;
  footerRow.getCell('balance_debit').numFmt = numberFormat;
  footerRow.getCell('balance_credit').numFmt = numberFormat;
  footerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE5E7EB' },
  };

  // Auto-fit column widths with safe minimums
  const minWidths: Record<string, number> = {
    gl_number: 24,
    name: 50,
    turnover_debit: 18,
    turnover_credit: 18,
    balance_debit: 18,
    balance_credit: 18,
  };

  worksheet.columns.forEach((column) => {
    const colKey = column.key || '';
    let maxLen = minWidths[colKey] || 15;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const val = cell.value ? cell.value.toString() : '';
      if (val.length > maxLen) {
        maxLen = Math.min(val.length + 3, 65);
      }
    });
    column.width = maxLen;
  });

  // Borders
  worksheet.eachRow((row, rowNumber) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      if (rowNumber === 1) {
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FF4B5563' } },
        };
      } else if (rowNumber === 2) {
        cell.border = {
          bottom: { style: 'medium', color: { argb: 'FF111827' } },
        };
      } else if (rowNumber === worksheet.rowCount) {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF9CA3AF' } },
          bottom: { style: 'double', color: { argb: 'FF111827' } },
        };
      } else {
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
      }
    });
  });

  // Freeze the top 2 header rows
  worksheet.views = [
    { state: 'frozen', xSplit: 0, ySplit: 2, showGridLines: false }
  ];

  // Generate the file
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);

  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const basisSuffix = dateBasis === 'teljesites' ? '_teljesites_alapjan' : '_kibocsatas_alapjan';
  const zeroSuffix = excludeZero ? '_0_nelkul' : '';
  const rangePart = (dateFrom && dateTo) ? `_${dateFrom}_${dateTo}` : (dateFrom ? `_${dateFrom}` : '');
  const filename = `Fokonyvikivonat_${companyName.replace(/[^a-zA-Z0-9]/g, '_')}${rangePart}${zeroSuffix}${basisSuffix}_${timestamp}.xlsx`;

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
  footerTotal: number | GlExportTotals = 0,
  dateBasis?: 'kibocsatas' | 'teljesites',
  dateFrom?: string,
  dateTo?: string,
  options?: GlExportOptions
) => {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'eaisybill';
  workbook.created = new Date();

  const excludeZero = options?.excludeZeroRows ?? false;
  const rowsToExport = excludeZero
    ? processedRows.filter(row => Math.abs(row.balance || 0) > 0.001)
    : processedRows;

  const basisLabel = dateBasis === 'teljesites' ? 'Teljesítés' : 'Kibocsátás';
  const ws = workbook.addWorksheet(excludeZero ? 'Analitikus Kivonat (0 nélkül)' : 'Analitikus Kivonat', {
    views: [{ showGridLines: false }],
  });

  ws.columns = [
    { header: 'Főkönyvi szám', key: 'gl_number', width: 16 },
    { header: 'Megnevezés', key: 'name', width: 50 },
    { header: 'Partner', key: 'partner', width: 28 },
    { header: `Dátum (${basisLabel})`, key: 'date', width: 18 },
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

  for (const row of rowsToExport) {
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

  // Resolve totals for footer
  const resolvedFooterBalance = typeof footerTotal === 'object' && footerTotal !== null
    ? ((footerTotal.balanceDebit ?? 0) - (footerTotal.balanceCredit ?? 0))
    : footerTotal;
  const resolvedDebit = typeof footerTotal === 'object' && footerTotal !== null && footerTotal.turnoverDebit !== undefined
    ? footerTotal.turnoverDebit
    : totalDebit;
  const resolvedCredit = typeof footerTotal === 'object' && footerTotal !== null && footerTotal.turnoverCredit !== undefined
    ? footerTotal.turnoverCredit
    : totalCredit;

  // Footer
  const totalRow = ws.addRow({
    gl_number: '',
    name: 'ÖSSZESEN',
    partner: '',
    date: '',
    debit: resolvedDebit,
    credit: resolvedCredit,
    balance: resolvedFooterBalance,
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
  const basisSuffix = dateBasis === 'teljesites' ? '_teljesites_alapjan' : '_kibocsatas_alapjan';
  const zeroSuffix = excludeZero ? '_0_nelkul' : '';
  const rangePart = (dateFrom && dateTo) ? `_${dateFrom}_${dateTo}` : (dateFrom ? `_${dateFrom}` : '');
  const filename = `Analitikus_Kivonat_${companyName.replace(/[^a-zA-Z0-9]/g, '_')}${rangePart}${zeroSuffix}${basisSuffix}_${timestamp}.xlsx`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// ── NAV ÁFA Gyűjtőkódos Analitika Export ──

export interface VatCollectorGroup {
  code: string;
  label: string;
  items: {
    id?: string;
    invoice_id?: string;
    code?: string;
    invoice_number: string;
    partner_name: string;
    fulfillment_date: string;
    vat_code?: string | null;
    gl_number?: string | null;
    partner_gl_number?: string | null;
    vat_gl_number?: string | null;
    direction?: string | null;
    is_customer_from_submitted?: boolean;
    net_amount: number;
    vat_amount: number;
    gross_amount: number;
  }[];
  total_net: number;
  total_vat: number;
  total_gross: number;
}

export const exportVatCollectorAnalyticsExcel = async (
  groups: VatCollectorGroup[],
  companyName: string = 'Vállalkozás',
  periodLabel: string = '',
  currency: string = 'HUF'
) => {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Visibill';
  workbook.created = new Date();

  const ws = workbook.addWorksheet(currency === 'EUR' ? 'PDV Analitika' : 'ÁFA Gyűjtőkód Analitika', {
    views: [{ showGridLines: false }],
  });

  ws.columns = [
    { header: currency === 'EUR' ? 'Zbirni kod PDV-a / Broj dokumenta' : 'ÁFA Gyűjtőkód / Bizonylatszám', key: 'col1', width: 34 },
    { header: currency === 'EUR' ? 'Naziv partnera' : 'Partner neve', key: 'col2', width: 35 },
    { header: currency === 'EUR' ? 'Smjer (Kupac/Dobavljač)' : 'Irány (Vevő/Szállító)', key: 'col_dir', width: 22 },
    { header: currency === 'EUR' ? 'Datum isporuke' : 'Teljesítés dátuma', key: 'col3', width: 18 },
    { header: currency === 'EUR' ? 'PDV oznaka' : 'ÁFA kód', key: 'col4', width: 14 },
    { header: currency === 'EUR' ? 'Konto' : 'Kontír (Főkönyv)', key: 'col5', width: 18 },
    { header: currency === 'EUR' ? 'Neto osnovica (EUR)' : `Nettó alap (${currency})`, key: 'net', width: 20 },
    { header: currency === 'EUR' ? 'Iznos PDV-a (EUR)' : `ÁFA összeg (${currency})`, key: 'vat', width: 20 },
    { header: currency === 'EUR' ? 'Bruto vrijednost (EUR)' : `Bruttó érték (${currency})`, key: 'gross', width: 20 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 28;

  const numFmt = '#,##0.00';
  let grandNet = 0;
  let grandVat = 0;
  let grandGross = 0;

  for (const group of groups) {
    const groupHeaderRow = ws.addRow({
      col1: `Gyűjtőkód: ${group.code} — ${group.label}`,
      col2: '',
      col_dir: '',
      col3: '',
      col4: '',
      col5: '',
      net: group.total_net,
      vat: group.total_vat,
      gross: group.total_gross,
    });

    groupHeaderRow.font = { bold: true, size: 11, color: { argb: 'FF1E40AF' } };
    groupHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
    groupHeaderRow.getCell('net').numFmt = numFmt;
    groupHeaderRow.getCell('vat').numFmt = numFmt;
    groupHeaderRow.getCell('gross').numFmt = numFmt;

    for (const item of group.items) {
      const itemRow = ws.addRow({
        col1: item.invoice_number,
        col2: item.partner_name,
        col_dir: currency === 'EUR'
          ? (item.direction === 'OUTBOUND' ? 'Izlazni (Kupac)' : (item.direction === 'INBOUND' ? 'Ulazni (Dobavljač)' : '-'))
          : (item.direction === 'OUTBOUND' ? 'Vevői (Kimenő)' : (item.direction === 'INBOUND' ? 'Szállítói (Bejövő)' : '-')),
        col3: item.fulfillment_date ? item.fulfillment_date.substring(0, 10).replace(/-/g, '.') : '-',
        col4: item.vat_code || '-',
        col5: item.gl_number || '-',
        net: item.net_amount,
        vat: item.vat_amount,
        gross: item.gross_amount,
      });

      itemRow.font = { size: 9, color: { argb: 'FF374151' } };
      itemRow.getCell('col1').alignment = { indent: 1 };
      itemRow.getCell('net').numFmt = numFmt;
      itemRow.getCell('vat').numFmt = numFmt;
      itemRow.getCell('gross').numFmt = numFmt;
    }

    grandNet += group.total_net;
    grandVat += group.total_vat;
    grandGross += group.total_gross;
  }

  // Grand Total Row
  const totalRow = ws.addRow({
    col1: currency === 'EUR' ? 'UKUPNO (PDV analitika)' : 'ÖSSZESEN (NAV ÁFA Analitika)',
    col2: '',
    col_dir: '',
    col3: '',
    col4: '',
    col5: '',
    net: grandNet,
    vat: grandVat,
    gross: grandGross,
  });

  totalRow.font = { bold: true, size: 11 };
  totalRow.getCell('net').numFmt = numFmt;
  totalRow.getCell('vat').numFmt = numFmt;
  totalRow.getCell('gross').numFmt = numFmt;
  totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);

  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const filename = `AFA_Gyujtokodos_Analitika_${companyName.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.xlsx`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
