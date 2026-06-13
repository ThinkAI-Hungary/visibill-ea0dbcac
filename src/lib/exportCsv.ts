/**
 * Generic export utility for Accounty pages.
 * Supports CSV (semicolon-delimited, UTF-8 BOM) and real XLSX via SheetJS.
 */
import * as XLSX from 'xlsx';

export type ExportFormat = 'csv' | 'xlsx';

export function exportToCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][]
) {
  exportData(filename, headers, rows, 'csv');
}

export function exportData(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
  format: ExportFormat = 'csv'
) {
  if (format === 'xlsx') {
    exportXlsx(filename, headers, rows);
  } else {
    exportCsvFile(filename, headers, rows);
  }
}

function exportCsvFile(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][]
) {
  const BOM = '\uFEFF';
  const headerLine = headers.map(h => `"${h}"`).join(';');
  const dataLines = rows.map(row =>
    row.map(cell => {
      if (cell == null) return '""';
      const str = String(cell).replace(/"/g, '""');
      return `"${str}"`;
    }).join(';')
  );

  const csv = BOM + [headerLine, ...dataLines].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `${filename}.csv`);
}

function exportXlsx(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][]
) {
  const wsData = [headers, ...rows.map(r => r.map(c => c ?? ''))];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Auto-size columns
  const colWidths = headers.map((h, i) => {
    const maxLen = Math.max(
      h.length,
      ...rows.map(r => String(r[i] ?? '').length)
    );
    return { wch: Math.min(maxLen + 2, 40) };
  });
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Adatok');
  const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbOut], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  triggerDownload(blob, `${filename}.xlsx`);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
