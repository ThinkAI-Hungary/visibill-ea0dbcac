/**
 * PROCONT Főkönyvi Kivonat — A4 Formátumhű PDF Export
 * 
 * A tests/docs/eb0148/PRCNT FŐKÖNYV.pdf alapján készített hivatalos,
 * A4 álló formátumú, többoldalas PDF generáló.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  normalizeHungarianForPdf,
  formatHungarianNumber,
} from './documents/encoding/hungarianEncoding';
import {
  buildProcontGlData,
  type ProcontGlData,
  type ProcontAccountInput,
  type ProcontBuildOptions,
} from './procontGlData';

const hu = (text: unknown): string => normalizeHungarianForPdf(text || '');

/**
 * Generates the jsPDF document conforming to the PROCONT FŐKÖNYVI KIVONAT layout.
 */
export function generateProcontGlPdf(data: ProcontGlData): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pw = doc.internal.pageSize.getWidth(); // 210mm
  const ph = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 12;
  const contentWidth = pw - margin * 2; // 186mm

  // Header height and table start position
  const headerHeight = 33; // mm

  // Header printer function called on every page
  const printHeader = (pdfDoc: jsPDF) => {
    pdfDoc.setTextColor(0, 0, 0);

    // 1. Top left: Company Name (PROCONT KFT)
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.setFontSize(10.5);
    pdfDoc.text(hu(data.companyName.toUpperCase()), margin, 11);

    // 2. Center: FŐKÖNYVI KIVONAT
    pdfDoc.setFontSize(13);
    pdfDoc.text(hu('FŐKÖNYVI KIVONAT'), pw / 2, 17, { align: 'center' });

    // 3. Center subtitle: Date Range (2026.01.01. - 2026.09.30.)
    pdfDoc.setFontSize(9.5);
    pdfDoc.text(hu(data.formattedPeriod), pw / 2, 22, { align: 'center' });

    // 4. Top left subtext: Nyitó tételekkel
    pdfDoc.setFont('helvetica', 'italic');
    pdfDoc.setFontSize(8.5);
    pdfDoc.text(hu('Nyitó tételekkel'), margin, 27);
  };

  // 2. Build Table Rows
  const bodyRows: any[] = [];
  const fmtNum = (val: number) => (val === 0 ? '0' : formatHungarianNumber(val, 0));

  data.rows.forEach(r => {
    bodyRows.push({
      isClass: r.level === 'class',
      isGroup: r.level === 'group' || r.level === 'subgroup',
      isLeaf: r.level === 'leaf',
      data: [
        r.accountNumber,
        hu(r.accountName),
        fmtNum(r.turnoverDebit),
        fmtNum(r.turnoverCredit),
        fmtNum(r.balanceDebit),
        fmtNum(r.balanceCredit),
      ],
    });
  });

  // Grand Total Row (Összesen:)
  bodyRows.push({
    isTotal: true,
    data: [
      hu('Összesen:'),
      '',
      fmtNum(data.totals.turnoverDebit),
      fmtNum(data.totals.turnoverCredit),
      fmtNum(data.totals.balanceDebit),
      fmtNum(data.totals.balanceCredit),
    ],
  });

  // Section Header: EGYEZŐSÉG SZÁMÍTÁS
  bodyRows.push({
    isReconciliationHeader: true,
    data: [
      hu('EGYEZŐSÉG SZÁMÍTÁS'),
      '',
      '',
      '',
      '',
      '',
    ],
  });

  // Row 1: 1 - 4 számlaosztályok
  bodyRows.push({
    isReconciliationRow: true,
    data: [
      hu('1 - 4 számlaosztályok'),
      '',
      fmtNum(data.reconciliation.classes1to4.turnoverDebit),
      fmtNum(data.reconciliation.classes1to4.turnoverCredit),
      fmtNum(data.reconciliation.classes1to4.balanceDebit),
      fmtNum(data.reconciliation.classes1to4.balanceCredit),
    ],
  });

  // Row 2: 5 - 9 számlaosztályok
  bodyRows.push({
    isReconciliationRow: true,
    data: [
      hu('5 - 9 számlaosztályok'),
      '',
      fmtNum(data.reconciliation.classes5to9.turnoverDebit),
      fmtNum(data.reconciliation.classes5to9.turnoverCredit),
      fmtNum(data.reconciliation.classes5to9.balanceDebit),
      fmtNum(data.reconciliation.classes5to9.balanceCredit),
    ],
  });

  // 3. Render Table using autoTable
  autoTable(doc, {
    startY: headerHeight,
    margin: { top: headerHeight, bottom: 12, left: margin, right: margin },
    tableWidth: contentWidth,
    head: [
      [
        { content: hu('Főkönyvi\nszám'), rowSpan: 2, styles: { valign: 'middle', halign: 'left', fontStyle: 'bold' } },
        { content: hu('Megnevezés'), rowSpan: 2, styles: { valign: 'middle', halign: 'left', fontStyle: 'bold' } },
        { content: hu('Forgalom'), colSpan: 2, styles: { halign: 'center', fontStyle: 'bold' } },
        { content: hu('Egyenleg'), colSpan: 2, styles: { halign: 'center', fontStyle: 'bold' } },
      ],
      [
        { content: hu('Tartozik'), styles: { halign: 'center', fontStyle: 'bold' } },
        { content: hu('Követel'), styles: { halign: 'center', fontStyle: 'bold' } },
        { content: hu('Tartozik'), styles: { halign: 'center', fontStyle: 'bold' } },
        { content: hu('Követel'), styles: { halign: 'center', fontStyle: 'bold' } },
      ],
    ],
    body: bodyRows.map(r => r.data),
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: { top: 1.3, bottom: 1.3, left: 1.5, right: 1.5 },
      lineColor: [190, 190, 190],
      lineWidth: 0.1,
      textColor: [0, 0, 0],
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
      halign: 'left',
    },
    columnStyles: {
      0: { cellWidth: 22, halign: 'left' },
      1: { cellWidth: 76, halign: 'left' },
      2: { cellWidth: 22, halign: 'right' },
      3: { cellWidth: 22, halign: 'right' },
      4: { cellWidth: 22, halign: 'right' },
      5: { cellWidth: 22, halign: 'right' },
    },
    didDrawPage: (_dataHook) => {
      // Print header on every page above the table start area (0mm - 30mm)
      printHeader(doc);
    },
    didParseCell: (hookData) => {
      const rowIndex = hookData.row.index;
      const meta = bodyRows[rowIndex];
      if (!meta) return;

      // Class Level: Light gray shaded row, bold font
      if (meta.isClass) {
        hookData.cell.styles.fillColor = [240, 240, 240];
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.textColor = [0, 0, 0];
      }
      // Group Level: Bold text
      else if (meta.isGroup) {
        hookData.cell.styles.fillColor = [255, 255, 255];
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.textColor = [0, 0, 0];
      }
      // Total Row: Darker gray background, bold font, bold border
      else if (meta.isTotal) {
        hookData.cell.styles.fillColor = [230, 230, 230];
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.textColor = [0, 0, 0];
        hookData.cell.styles.lineColor = [0, 0, 0];
        hookData.cell.styles.lineWidth = 0.25;
        if (hookData.column.index === 0) {
          hookData.cell.colSpan = 2;
        }
      }
      // EGYEZŐSÉG SZÁMÍTÁS Section Header
      else if (meta.isReconciliationHeader) {
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.fontSize = 8.5;
        hookData.cell.styles.textColor = [0, 0, 0];
        hookData.cell.styles.fillColor = [255, 255, 255];
        hookData.cell.styles.lineWidth = 0; // Seamless section title
        if (hookData.column.index === 0) {
          hookData.cell.colSpan = 6;
        }
      }
      // EGYEZŐSÉG SZÁMÍTÁS Rows
      else if (meta.isReconciliationRow) {
        hookData.cell.styles.fontStyle = 'normal';
        hookData.cell.styles.textColor = [0, 0, 0];
        hookData.cell.styles.fillColor = [255, 255, 255];
        if (hookData.column.index === 0) {
          hookData.cell.colSpan = 2;
        }
      }
    },
  });

  // 4. Page numbering footer (e.g. "1. oldal", "2. oldal")
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(50, 50, 50);
    doc.text(hu(`${i}. oldal`), pw / 2, ph - 6, { align: 'center' });
  }

  return doc;
}

/**
 * Triggers client-side download of the PROCONT Főkönyvi Kivonat PDF.
 */
export function downloadProcontGlPdf(
  inputAccounts: ProcontAccountInput[],
  options: ProcontBuildOptions = {}
): void {
  const data = buildProcontGlData(inputAccounts, options);
  const doc = generateProcontGlPdf(data);

  const safeComp = (data.companyName || 'Ceg').replace(/[^a-zA-Z0-9]/g, '_');
  const period = data.formattedPeriod.replace(/[^a-zA-Z0-9]/g, '_') || 'idoszak';
  const zeroSuffix = options.excludeZeroRows ? '_0_nelkul' : '';
  const filename = `Procont_Fokonyvi_Kivonat_${safeComp}_${period}${zeroSuffix}.pdf`;

  doc.save(filename);
}
