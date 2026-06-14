/**
 * PDF export utility for Accounty pages.
 * Uses jspdf + jspdf-autotable for clean, formal table-based documents.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface PdfExportOptions {
  title: string;
  subtitle?: string;
  companyName?: string;
  period?: string;
  headers: string[];
  rows: (string | number)[][];
  footer?: { label: string; value: string };
  orientation?: 'portrait' | 'landscape';
}

/**
 * jsPDF Helvetica only supports Latin-1. Hungarian ő/ű are Latin-2.
 */
function hu(text: string): string {
  return text.replace(/ő/g, 'ö').replace(/Ő/g, 'Ö').replace(/ű/g, 'ü').replace(/Ű/g, 'Ü');
}

export function exportPdf(filename: string, options: PdfExportOptions) {
  const doc = new jsPDF({ orientation: options.orientation || 'portrait', unit: 'mm', format: 'a4' });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(hu(options.title), pageWidth / 2, 20, { align: 'center' });

  if (options.subtitle) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(hu(options.subtitle), pageWidth / 2, 27, { align: 'center' });
  }

  // Company / period info
  let yPos = options.subtitle ? 34 : 30;
  if (options.companyName || options.period) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const meta: string[] = [];
    if (options.companyName) meta.push(`Ceg: ${hu(options.companyName)}`);
    if (options.period) meta.push(`Idoszak: ${hu(options.period)}`);
    doc.text(meta.join('  |  '), pageWidth / 2, yPos, { align: 'center' });
    yPos += 4;
  }

  // Separator line
  doc.setDrawColor(200, 200, 200);
  doc.line(14, yPos, pageWidth - 14, yPos);
  yPos += 4;

  // Auto table
  autoTable(doc, {
    startY: yPos,
    head: [options.headers.map(h => hu(String(h)))],
    body: options.rows.map(r => r.map(c => hu(String(c ?? '')))),
    theme: 'striped',
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => {
      // Footer with page number
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(150);
      doc.text(
        `${options.title} | Generalva: ${new Date().toLocaleDateString('hu-HU')} | Oldal ${data.pageNumber}/${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 8,
        { align: 'center' }
      );
    },
  });

  // Optional summary footer row
  if (options.footer) {
    const finalY = (doc as any).lastAutoTable?.finalY || yPos + 20;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(options.footer.label, 14, finalY + 8);
    doc.text(options.footer.value, pageWidth - 14, finalY + 8, { align: 'right' });
  }

  doc.save(`${filename}.pdf`);
}

/**
 * Returns a Blob URL for previewing the PDF instead of downloading it.
 */
export function getPdfBlobUrl(options: PdfExportOptions): string {
  const doc = new jsPDF({ orientation: options.orientation || 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(options.title, pageWidth / 2, 20, { align: 'center' });

  if (options.subtitle) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(options.subtitle, pageWidth / 2, 27, { align: 'center' });
  }

  let yPos = options.subtitle ? 34 : 30;
  if (options.companyName || options.period) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const meta: string[] = [];
    if (options.companyName) meta.push(`Ceg: ${options.companyName}`);
    if (options.period) meta.push(`Idoszak: ${options.period}`);
    doc.text(meta.join('  |  '), pageWidth / 2, yPos, { align: 'center' });
    yPos += 4;
  }

  doc.setDrawColor(200, 200, 200);
  doc.line(14, yPos, pageWidth - 14, yPos);
  yPos += 4;

  autoTable(doc, {
    startY: yPos,
    head: [options.headers.map(h => hu(String(h)))],
    body: options.rows.map(r => r.map(c => hu(String(c ?? '')))),
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(150);
      doc.text(`${options.title} | Generalva: ${new Date().toLocaleDateString('hu-HU')} | Oldal ${data.pageNumber}/${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
    },
  });

  if (options.footer) {
    const finalY = (doc as any).lastAutoTable?.finalY || yPos + 20;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(options.footer.label, 14, finalY + 8);
    doc.text(options.footer.value, pageWidth - 14, finalY + 8, { align: 'right' });
  }

  return doc.output('bloburl').toString();
}

/**
 * Generate a simple receipt/confirmation PDF (for workflow receipts, etc.)
 */
export function exportReceiptPdf(filename: string, data: { title: string; fields: { label: string; value: string }[] }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(hu(data.title), pw / 2, 30, { align: 'center' });

  doc.setDrawColor(59, 130, 246);
  doc.setLineWidth(0.5);
  doc.line(pw / 2 - 30, 34, pw / 2 + 30, 34);

  let y = 50;
  doc.setFontSize(10);
  for (const field of data.fields) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(hu(field.label), 30, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text(hu(field.value), pw - 30, y, { align: 'right' });
    y += 8;
  }

  // Stamp-like footer
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150);
  doc.text(hu(`Generálva: ${new Date().toLocaleString('hu-HU')}`), pw / 2, doc.internal.pageSize.getHeight() - 15, { align: 'center' });

  doc.save(`${filename}.pdf`);
}
