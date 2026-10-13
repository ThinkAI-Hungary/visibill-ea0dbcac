import type { VatViewTemplate } from '@/types/vatTemplate';

export interface VatJournalExportItem {
  id: string;
  entryNumber: string;
  journalType: 'szállító' | 'vevő' | 'pénztár' | 'vegyes';
  vatDueDate: string;
  invoiceNumber: string;
  partnerCode: string;
  partnerName: string;
  description: string;
  projectCode?: string;
  vatRateLabel: string;
  netAmount: number;
  netGlAccount: string;
  vatAmount: number;
  vatGlAccount: string;
  grossAmount: number;
  grossGlAccount: string;
  returnRowCode: string;
  taxReturnRow?: string;
}

export function getVatItemFieldValue(
  item: VatJournalExportItem,
  field: string,
  negativeExpenses: boolean
): { text: string; num: number; isNumeric: boolean } {
  const isExpense = item.journalType === 'szállító' || item.journalType === 'pénztár';
  const sign = negativeExpenses && isExpense ? -1 : 1;

  switch (field) {
    case 'entryNumber':
      return { text: item.entryNumber || '', num: 0, isNumeric: false };
    case 'journalType':
      return { text: item.journalType || '', num: 0, isNumeric: false };
    case 'vatDueDate':
      return { text: item.vatDueDate || '', num: 0, isNumeric: false };
    case 'invoiceNumber':
      return { text: item.invoiceNumber || '', num: 0, isNumeric: false };
    case 'partnerCode':
      return { text: item.partnerCode || '', num: 0, isNumeric: false };
    case 'partnerName':
      return { text: item.partnerName || '', num: 0, isNumeric: false };
    case 'description':
      return { text: item.description || '', num: 0, isNumeric: false };
    case 'vatRateLabel':
      return { text: item.vatRateLabel || '', num: 0, isNumeric: false };
    case 'netAmount': {
      const val = item.netAmount * sign;
      return { text: String(val), num: val, isNumeric: true };
    }
    case 'vatAmount': {
      const val = item.vatAmount * sign;
      return { text: String(val), num: val, isNumeric: true };
    }
    case 'grossAmount': {
      const val = item.grossAmount * sign;
      return { text: String(val), num: val, isNumeric: true };
    }
    case 'returnRowCode':
      return { text: item.returnRowCode || item.taxReturnRow || '', num: 0, isNumeric: false };
    case 'netGlAccount':
      return { text: item.netGlAccount || '', num: 0, isNumeric: false };
    case 'vatGlAccount':
      return { text: item.vatGlAccount || '', num: 0, isNumeric: false };
    case 'grossGlAccount':
      return { text: item.grossGlAccount || '', num: 0, isNumeric: false };
    case 'payableNetAmount': {
      const isOutbound = item.journalType === 'vevő';
      return isOutbound ? { text: String(item.netAmount), num: item.netAmount, isNumeric: true } : { text: '', num: 0, isNumeric: false };
    }
    case 'payableVatAmount': {
      const isOutbound = item.journalType === 'vevő';
      return isOutbound ? { text: String(item.vatAmount), num: item.vatAmount, isNumeric: true } : { text: '', num: 0, isNumeric: false };
    }
    case 'deductibleNetAmount': {
      const isInbound = item.journalType === 'szállító' || item.journalType === 'pénztár';
      return isInbound ? { text: String(item.netAmount), num: item.netAmount, isNumeric: true } : { text: '', num: 0, isNumeric: false };
    }
    case 'deductibleVatAmount': {
      const isInbound = item.journalType === 'szállító' || item.journalType === 'pénztár';
      return isInbound ? { text: String(item.vatAmount), num: item.vatAmount, isNumeric: true } : { text: '', num: 0, isNumeric: false };
    }
    case 'netVatPosition': {
      const isOutbound = item.journalType === 'vevő';
      const isInbound = item.journalType === 'szállító' || item.journalType === 'pénztár';
      const val = isOutbound ? item.vatAmount : isInbound ? -item.vatAmount : 0;
      return { text: String(val), num: val, isNumeric: true };
    }
    default:
      return { text: '', num: 0, isNumeric: false };
  }
}

/**
 * Exports VAT journal items to Microsoft Excel (.xlsx) using the columns from the active VatViewTemplate
 */
export async function exportVatJournalExcel(
  items: VatJournalExportItem[],
  companyName: string = 'Vállalkozás',
  template: VatViewTemplate,
  periodLabel: string = '',
  negativeExpenses: boolean = true
) {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'eaisybill';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('ÁFA Analitika', {
    views: [{ showGridLines: true }],
  });

  const columns = template.columns || [];

  // Title section
  worksheet.addRow([companyName]);
  worksheet.getCell('A1').font = { size: 14, bold: true, color: { argb: 'FF1E293B' } };

  worksheet.addRow([`ÁFA Analitika — ${periodLabel}`]);
  worksheet.getCell('A2').font = { size: 11, bold: true, color: { argb: 'FF475569' } };

  worksheet.addRow([`Alkalmazott sablon: ${template.name}`]);
  worksheet.getCell('A3').font = { size: 9, italic: true, color: { argb: 'FF64748B' } };

  worksheet.addRow([]); // Blank spacer row

  // Table Header Row (Row 5)
  const headerRowValues = columns.map((c) => c.label);
  const headerRow = worksheet.addRow(headerRowValues);
  headerRow.height = 24;

  headerRow.eachCell((cell, colNumber) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F766E' }, // Teal 700
    };
    cell.font = {
      bold: true,
      color: { argb: 'FFFFFFFF' },
      size: 10,
    };
    const colDef = columns[colNumber - 1];
    cell.alignment = {
      vertical: 'middle',
      horizontal: colDef?.align || 'left',
      wrapText: true,
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF0F766E' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });

  // Data Rows
  items.forEach((item, index) => {
    const rowValues = columns.map((col) => {
      const fieldData = getVatItemFieldValue(item, col.field, negativeExpenses);
      return fieldData.isNumeric ? fieldData.num : fieldData.text;
    });

    const dataRow = worksheet.addRow(rowValues);
    dataRow.height = 20;

    dataRow.eachCell((cell, colNumber) => {
      const colDef = columns[colNumber - 1];
      const isEven = index % 2 === 1;

      if (isEven) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' },
        };
      }

      cell.font = { size: 9.5 };
      cell.alignment = {
        vertical: 'middle',
        horizontal: colDef?.align || 'left',
      };

      if (colDef?.format === 'currency') {
        cell.numFmt = '#,##0" Ft"';
      }

      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });
  });

  // Summary Totals Row
  const totalRowValues = columns.map((col, idx) => {
    if (idx === 0) return 'ÖSSZESEN';
    if (col.format === 'currency' || col.field === 'netAmount' || col.field === 'vatAmount' || col.field === 'grossAmount' || col.field === 'payableNetAmount' || col.field === 'payableVatAmount' || col.field === 'deductibleNetAmount' || col.field === 'deductibleVatAmount' || col.field === 'netVatPosition') {
      const sum = items.reduce((acc, it) => acc + getVatItemFieldValue(it, col.field, negativeExpenses).num, 0);
      return sum;
    }
    return '';
  });

  const totalsRow = worksheet.addRow(totalRowValues);
  totalsRow.height = 22;
  totalsRow.eachCell((cell, colNumber) => {
    const colDef = columns[colNumber - 1];
    cell.font = { bold: true, size: 10 };
    cell.alignment = {
      vertical: 'middle',
      horizontal: colDef?.align || 'left',
    };
    if (colDef?.format === 'currency' || typeof cell.value === 'number') {
      cell.numFmt = '#,##0" Ft"';
    }
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF0F766E' } },
      bottom: { style: 'double', color: { argb: 'FF0F766E' } },
    };
  });

  // Auto-fit column widths
  columns.forEach((col, idx) => {
    const sheetCol = worksheet.getColumn(idx + 1);
    let baseWidth = 14;
    if (col.field === 'partnerName') baseWidth = 28;
    else if (col.field === 'description') baseWidth = 24;
    else if (col.field === 'invoiceNumber') baseWidth = 18;
    else if (col.format === 'currency') baseWidth = 16;
    else if (col.align === 'center') baseWidth = 12;

    sheetCol.width = Math.max(baseWidth, col.label.length + 3);
  });

  // Generate buffer and trigger browser download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeCompany = companyName.replace(/[^a-zA-Z0-9_-]/g, '_');
  a.download = `afa_analitika_${safeCompany}_${periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exports VAT journal items to CSV formatted per active template
 */
export function exportVatJournalCsv(
  items: VatJournalExportItem[],
  companyName: string = 'Vállalkozás',
  template: VatViewTemplate,
  periodLabel: string = '',
  negativeExpenses: boolean = true
) {
  const columns = template.columns || [];
  const headers = columns.map((c) => c.label);

  const rows = items.map((it) => {
    return columns.map((col) => {
      const fieldData = getVatItemFieldValue(it, col.field, negativeExpenses);
      if (fieldData.isNumeric) {
        return fieldData.num;
      }
      return `"${fieldData.text.replace(/"/g, '""')}"`;
    });
  });

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeCompany = companyName.replace(/[^a-zA-Z0-9_-]/g, '_');
  link.setAttribute('download', `afa_analitika_${safeCompany}_${periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
