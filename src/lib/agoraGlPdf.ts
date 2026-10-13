/**
 * AGORA (Novitax) Főkönyvi Kivonat — A4 Formátumhű PDF Export
 * 
 * A tests/docs/eb0148/FokonyviKivonat.pdf alapján készített hivatalos,
 * A4 álló formátumú, többoldalas PDF generáló kétszintes táblázatfejléccel
 * és a hivatalos 3-soros záró mérlegegyezőségi blokkal.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  normalizeHungarianForPdf,
  formatHungarianNumber,
} from './documents/encoding/hungarianEncoding';
import {
  buildAgoraGlData,
  type AgoraGlData,
  type AgoraBuildOptions,
} from './agoraGlData';
import type { ProcontAccountInput } from './procontGlData';

const hu = (text: unknown): string => normalizeHungarianForPdf(text || '');

/**
 * Generates the jsPDF document conforming to the AGORA / NOVITAX FŐKÖNYVI KIVONAT layout.
 */
export function generateAgoraGlPdf(data: AgoraGlData): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pw = doc.internal.pageSize.getWidth(); // 210mm
  const ph = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 10;
  const contentWidth = pw - margin * 2; // 190mm
  const headerHeight = 31; // mm

  const companyHeaderStr = data.taxNumber
    ? `${data.companyName} ( ${data.taxNumber} )`
    : data.companyName;

  // Header printer function called on every page
  const printHeader = (pdfDoc: jsPDF) => {
    pdfDoc.setTextColor(0, 0, 0);

    // 1. Top left: Company Name (+ Tax ID) with auto-scaling & maxWidth protection
    pdfDoc.setFont('helvetica', 'bold');
    let companyFontSize = 8.5;
    pdfDoc.setFontSize(companyFontSize);
    const maxHeaderCompanyWidth = pw - margin * 2 - 45; // leaves 45mm for Listaazonosító
    while (companyFontSize > 6 && pdfDoc.getTextWidth(hu(companyHeaderStr)) > maxHeaderCompanyWidth) {
      companyFontSize -= 0.5;
      pdfDoc.setFontSize(companyFontSize);
    }
    pdfDoc.text(hu(companyHeaderStr), margin, 8, { maxWidth: maxHeaderCompanyWidth });

    // 1. Top right: Listaazonosító
    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(8);
    pdfDoc.text(hu(`Listaazonosító: ${data.listId}`), pw - margin, 8, { align: 'right' });

    // Top divider line
    pdfDoc.setDrawColor(60, 60, 60);
    pdfDoc.setLineWidth(0.3);
    pdfDoc.line(margin, 9.5, pw - margin, 9.5);

    // 2. Center: FŐKÖNYVI KIVONAT
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.setFontSize(13);
    pdfDoc.text(hu('Főkönyvi kivonat'), pw / 2, 15, { align: 'center' });

    // 3. Center subtitle: Year (e.g. 2026)
    pdfDoc.setFontSize(11);
    pdfDoc.text(hu(data.year), pw / 2, 20.5, { align: 'center' });

    // 3. Right: Devizanem (e.g. Devizanem: HUF)
    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(8);
    pdfDoc.text(hu(`Devizanem: ${data.currency}`), pw - margin, 20.5, { align: 'right' });

    // 4. Left: Hónap (e.g. Hónap: 0 - 09 (Időszaki))
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.setFontSize(8);
    pdfDoc.text(hu(data.periodText), margin, 26);
  };

  // 2. Build Table Rows
  const bodyRows: any[] = [];
  const isHuf = (data.currency || 'HUF').toUpperCase() === 'HUF';
  const decimals = isHuf ? 0 : 2;
  const fmtNum = (val: number) => (val === 0 ? '0' : formatHungarianNumber(val, decimals));

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

  // Summary Rows (Page 4 style)
  // Row 1: 1 - 4 számlaosztályok összesen
  bodyRows.push({
    isSummaryRow: true,
    data: [
      hu('1 - 4 számlaosztályok összesen'),
      '',
      fmtNum(data.reconciliation.classes1to4.turnoverDebit),
      fmtNum(data.reconciliation.classes1to4.turnoverCredit),
      fmtNum(data.reconciliation.classes1to4.balanceDebit),
      data.reconciliation.classes1to4.balanceCredit > 0 ? fmtNum(data.reconciliation.classes1to4.balanceCredit) : '',
    ],
  });

  // Row 2: 5 - 9 számlaosztályok összesen
  bodyRows.push({
    isSummaryRow: true,
    data: [
      hu('5 - 9 számlaosztályok összesen'),
      '',
      fmtNum(data.reconciliation.classes5to9.turnoverDebit),
      fmtNum(data.reconciliation.classes5to9.turnoverCredit),
      data.reconciliation.classes5to9.balanceDebit > 0 ? fmtNum(data.reconciliation.classes5to9.balanceDebit) : '',
      fmtNum(data.reconciliation.classes5to9.balanceCredit),
    ],
  });

  // Row 3: 1 - 9 számlaosztályok összesen
  bodyRows.push({
    isSummaryRow: true,
    isGrandTotal: true,
    data: [
      hu('1 - 9 számlaosztályok összesen'),
      '',
      fmtNum(data.reconciliation.grandTotal.turnoverDebit),
      fmtNum(data.reconciliation.grandTotal.turnoverCredit),
      '',
      '',
    ],
  });

  // 3. Render Table using autoTable
  autoTable(doc, {
    startY: headerHeight,
    margin: { top: headerHeight, bottom: 12, left: margin, right: margin },
    tableWidth: contentWidth,
    head: [
      [
        { content: hu('Szla.'), rowSpan: 2, styles: { valign: 'middle', halign: 'left', fontStyle: 'bold' } },
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
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: { top: 0.9, bottom: 0.9, left: 1.2, right: 1.2 },
      lineColor: [220, 220, 220],
      lineWidth: 0.05,
      textColor: [0, 0, 0],
    },
    headStyles: {
      fillColor: [230, 230, 230],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      lineColor: [100, 100, 100],
      lineWidth: 0.15,
      halign: 'left',
    },
    columnStyles: {
      0: { cellWidth: 20, halign: 'left' },
      1: { cellWidth: 78, halign: 'left' },
      2: { cellWidth: 23, halign: 'right' },
      3: { cellWidth: 23, halign: 'right' },
      4: { cellWidth: 23, halign: 'right' },
      5: { cellWidth: 23, halign: 'right' },
    },
    didDrawPage: (_dataHook) => {
      printHeader(doc);
    },
    didParseCell: (hookData) => {
      const rowIndex = hookData.row.index;
      const meta = bodyRows[rowIndex];
      if (!meta) return;

      // Class Level: Gray shaded row, bold font
      if (meta.isClass) {
        hookData.cell.styles.fillColor = [225, 225, 225];
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.textColor = [0, 0, 0];
      }
      // Group Level: Bold text
      else if (meta.isGroup) {
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.textColor = [0, 0, 0];
      }
      // Summary Rows (1-4, 5-9, 1-9)
      else if (meta.isSummaryRow) {
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.textColor = [0, 0, 0];
        if (hookData.column.index === 0) {
          hookData.cell.colSpan = 2;
        }
        if (meta.isGrandTotal) {
          hookData.cell.styles.lineWidth = { top: 0.15, bottom: 0.15 };
          hookData.cell.styles.lineColor = [0, 0, 0];
        }
      }
    },
  });

  // 4. Page numbering & branding footer on every page
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Separator line
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(margin, ph - 8, pw - margin, ph - 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(50, 50, 50);

    // Left: Date
    doc.text(hu(data.exportDate), margin, ph - 4.5);

    // Center: Branding
    doc.text(hu(data.branding), pw / 2, ph - 4.5, { align: 'center' });

    // Right: Regisztrálva + Page (protected against overlapping center branding)
    const maxFooterRightWidth = (pw / 2) - margin - 5;
    doc.text(
      hu(`Regisztrálva: ${companyHeaderStr}   Lap: ${i}`),
      pw - margin,
      ph - 4.5,
      { align: 'right', maxWidth: maxFooterRightWidth }
    );
  }

  return doc;
}

/**
 * Triggers client-side download of the AGORA Főkönyvi Kivonat PDF.
 */
export function downloadAgoraGlPdf(
  inputAccounts: ProcontAccountInput[],
  options: AgoraBuildOptions = {}
): void {
  const data = buildAgoraGlData(inputAccounts, options);
  const doc = generateAgoraGlPdf(data);

  const safeComp = (data.companyName || 'Ceg').replace(/[^a-zA-Z0-9]/g, '_');
  const period = data.periodText.replace(/[^a-zA-Z0-9]/g, '_') || 'idoszak';
  const zeroSuffix = options.excludeZeroRows ? '_0_nelkul' : '';
  const filename = `A_Fokonyvi_Kivonat_${safeComp}_${data.year}_${period}${zeroSuffix}.pdf`;

  doc.save(filename);
}
