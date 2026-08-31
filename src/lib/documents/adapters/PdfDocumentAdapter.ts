/**
 * PDF Document Adapter for DocumentEngine.
 * Renders structured DocumentDescriptor instances into professional,
 * brand-consistent PDF files using lazily loaded jsPDF + autotable.
 */

import { DocumentDescriptor, TableSection, KeyValueSection, TextSection } from '../core/types';
import { loadPdfLibraries } from '../core/libraryLoader';
import { normalizeHungarianForPdf, formatHungarianDate } from '../encoding/hungarianEncoding';

export class PdfDocumentAdapter {
  /**
   * Renders a document descriptor into a jsPDF Blob.
   */
  public static async renderToBlob(descriptor: DocumentDescriptor): Promise<Blob> {
    const { jsPDF, autoTable } = await loadPdfLibraries();
    const orientation = descriptor.metadata.orientation || 'portrait';
    const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const themeColor: [number, number, number] = descriptor.metadata.themeColor || [15, 116, 103]; // #0f7467

    let currentY = 0;

    // 1. Render Header Bar
    doc.setFillColor(themeColor[0], themeColor[1], themeColor[2]);
    doc.rect(0, 0, pageWidth, 28, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(normalizeHungarianForPdf(descriptor.metadata.title), 14, 12);

    if (descriptor.metadata.subtitle) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text(normalizeHungarianForPdf(descriptor.metadata.subtitle), 14, 18);
    }

    // Right-aligned header metadata
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const dateStr = formatHungarianDate(descriptor.metadata.generatedAt || new Date());
    doc.text(`Kelt: ${dateStr}`, pageWidth - 14, 12, { align: 'right' });
    if (descriptor.metadata.period) {
      doc.text(normalizeHungarianForPdf(`Időszak: ${descriptor.metadata.period}`), pageWidth - 14, 18, { align: 'right' });
    }

    currentY = 34;

    // 2. Company Info Bar (if available)
    if (descriptor.metadata.companyName || descriptor.metadata.companyTaxNumber) {
      doc.setTextColor(50, 50, 50);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      const compName = descriptor.metadata.companyName || '';
      const taxNum = descriptor.metadata.companyTaxNumber ? ` (Adószám: ${descriptor.metadata.companyTaxNumber})` : '';
      doc.text(normalizeHungarianForPdf(`${compName}${taxNum}`), 14, currentY);
      currentY += 8;
    }

    // 3. Render Sections
    for (const section of descriptor.sections) {
      if (currentY > pageHeight - 35) {
        doc.addPage();
        currentY = 20;
      }

      if (section.type === 'key-value') {
        currentY = this.renderKeyValueSection(doc, section, currentY, pageWidth);
      } else if (section.type === 'table') {
        currentY = this.renderTableSection(doc, autoTable, section, currentY, themeColor);
      } else if (section.type === 'text') {
        currentY = this.renderTextSection(doc, section, currentY, pageWidth);
      }
    }

    // 4. Render Standard Footers on All Pages
    const totalPages = (doc.internal as any).getNumberOfPages ? (doc.internal as any).getNumberOfPages() : 1;
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setDrawColor(220, 220, 220);
      doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

      doc.setTextColor(140, 140, 140);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      const footerTitle = normalizeHungarianForPdf(descriptor.metadata.title);
      doc.text(
        `${footerTitle} | Visibill / eaisyBooks`,
        14,
        pageHeight - 7
      );
      doc.text(
        `${i}. / ${totalPages} oldal`,
        pageWidth - 14,
        pageHeight - 7,
        { align: 'right' }
      );
    }

    return doc.output('blob');
  }

  private static renderKeyValueSection(
    doc: any,
    section: KeyValueSection,
    startY: number,
    pageWidth: number
  ): number {
    let y = startY;

    if (section.title) {
      doc.setTextColor(15, 116, 103);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(normalizeHungarianForPdf(section.title), 14, y);
      y += 6;
    }

    const cols = section.columnsCount || 2;
    const colWidth = (pageWidth - 28) / cols;

    section.items.forEach((item, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const itemX = 14 + col * colWidth;
      const itemY = y + row * 6.5;

      doc.setTextColor(100, 100, 100);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text(normalizeHungarianForPdf(`${item.label}:`), itemX, itemY);

      doc.setTextColor(item.highlight ? 15 : 30, item.highlight ? 116 : 30, item.highlight ? 103 : 30);
      doc.setFont('helvetica', item.highlight ? 'bold' : 'normal');
      const valStr = normalizeHungarianForPdf(String(item.value ?? ''));
      doc.text(valStr, itemX + 38, itemY);
    });

    const totalRows = Math.ceil(section.items.length / cols);
    return y + totalRows * 6.5 + 6;
  }

  private static renderTableSection(
    doc: any,
    autoTable: any,
    section: TableSection,
    startY: number,
    themeColor: [number, number, number]
  ): number {
    let y = startY;

    if (section.title) {
      doc.setTextColor(15, 116, 103);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(normalizeHungarianForPdf(section.title), 14, y);
      y += 5;
    }

    const headers = section.headers || (section.columns ? section.columns.map(c => c.header) : []);
    const normalizedHeaders = headers.map(h => normalizeHungarianForPdf(h));

    const normalizedRows = section.rows.map(row =>
      row.map(cell => normalizeHungarianForPdf(cell == null ? '' : String(cell)))
    );

    autoTable(doc, {
      startY: y,
      head: [normalizedHeaders],
      body: normalizedRows,
      theme: 'striped',
      margin: { left: 14, right: 14 },
      headStyles: {
        fillColor: themeColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5,
      },
      styles: {
        fontSize: 8,
        cellPadding: 2,
        overflow: 'linebreak',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });

    return (doc as any).lastAutoTable.finalY + 8;
  }

  private static renderTextSection(
    doc: any,
    section: TextSection,
    startY: number,
    pageWidth: number
  ): number {
    let y = startY;

    if (section.title) {
      doc.setTextColor(15, 116, 103);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(normalizeHungarianForPdf(section.title), 14, y);
      y += 6;
    }

    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', section.style === 'signature' ? 'bold' : 'normal');
    doc.setFontSize(8.5);

    const lines = doc.splitTextToSize(normalizeHungarianForPdf(section.content), pageWidth - 28);
    doc.text(lines, 14, y);
    return y + lines.length * 5 + 6;
  }
}
