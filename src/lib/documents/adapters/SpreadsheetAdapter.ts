/**
 * Spreadsheet Document Adapter for DocumentEngine.
 * Handles CSV and XLSX generation.
 */

import { DocumentDescriptor, TableSection } from '../core/types';
import { loadSpreadsheetLibraries } from '../core/libraryLoader';
import { sanitizeCsvCell } from '../encoding/hungarianEncoding';

export class SpreadsheetAdapter {
  /**
   * Generates a standard UTF-8 CSV string with BOM for Hungarian Excel compatibility.
   */
  public static renderToCsv(descriptor: DocumentDescriptor): string {
    const lines: string[] = [];

    // Header metadata lines
    if (descriptor.metadata.title) {
      lines.push(sanitizeCsvCell(descriptor.metadata.title));
    }
    if (descriptor.metadata.companyName) {
      lines.push(sanitizeCsvCell(`Cég: ${descriptor.metadata.companyName}`));
    }
    if (descriptor.metadata.period) {
      lines.push(sanitizeCsvCell(`Időszak: ${descriptor.metadata.period}`));
    }
    if (lines.length > 0) {
      lines.push(''); // Empty line separator
    }

    for (const section of descriptor.sections) {
      if (section.type === 'table') {
        if (section.title) {
          lines.push(sanitizeCsvCell(section.title));
        }

        const headers = section.headers || (section.columns ? section.columns.map(c => c.header) : []);
        if (headers.length > 0) {
          lines.push(headers.map(h => sanitizeCsvCell(h)).join(';'));
        }

        for (const row of section.rows) {
          lines.push(row.map(cell => sanitizeCsvCell(cell == null ? '' : cell)).join(';'));
        }

        if (section.footers && section.footers.length > 0) {
          for (const footer of section.footers) {
            lines.push(`${sanitizeCsvCell(footer.label)};${sanitizeCsvCell(footer.value)}`);
          }
        }

        lines.push(''); // Section separator
      } else if (section.type === 'key-value') {
        if (section.title) {
          lines.push(sanitizeCsvCell(section.title));
        }
        for (const item of section.items) {
          lines.push(`${sanitizeCsvCell(item.label)};${sanitizeCsvCell(item.value)}`);
        }
        lines.push('');
      }
    }

    return lines.join('\r\n');
  }

  /**
   * Generates an XLSX file using lazily loaded XLSX library.
   */
  public static async renderToXlsxBlob(descriptor: DocumentDescriptor): Promise<Blob> {
    const XLSX = await loadSpreadsheetLibraries();
    const wb = XLSX.utils.book_new();

    const tableSections = descriptor.sections.filter(s => s.type === 'table') as TableSection[];

    if (tableSections.length === 0) {
      // Create a basic key-value sheet
      const rows: any[][] = [];
      rows.push([descriptor.metadata.title]);
      rows.push([`Cég: ${descriptor.metadata.companyName || ''}`]);
      rows.push([`Időszak: ${descriptor.metadata.period || ''}`]);
      rows.push([]);

      for (const section of descriptor.sections) {
        if (section.type === 'key-value') {
          rows.push([section.title || 'Adatok']);
          section.items.forEach(it => rows.push([it.label, it.value]));
          rows.push([]);
        }
      }

      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Adatok');
    } else {
      tableSections.forEach((section, idx) => {
        const rows: any[][] = [];
        const headers = section.headers || (section.columns ? section.columns.map(c => c.header) : []);
        if (headers.length > 0) {
          rows.push(headers);
        }
        section.rows.forEach(r => rows.push(r));

        const sheetName = (section.title || `Tábla ${idx + 1}`).slice(0, 31).replace(/[\\/*?:[\]]/g, '');
        const ws = XLSX.utils.aoa_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, sheetName || `Sheet${idx + 1}`);
      });
    }

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
}
