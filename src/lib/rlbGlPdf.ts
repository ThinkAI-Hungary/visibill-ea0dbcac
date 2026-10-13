/**
 * RLB-60 Főkönyvi Kivonat — A4 Formátumhű PDF Export Motor
 * 
 * A tests/docs/eb0148/Főkönyvi kivonat-alap. bankoknak is jó..pdf és
 * a tests/docs/eb0148/Főkönyvi kivonat-bővített-vevő-szállító- pl. könyvvizsgálónak.pdf
 * alapján készített hivatalos, A4 álló formátumú, többoldalas PDF generáló.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  normalizeHungarianForPdf,
  formatHungarianNumber,
} from './documents/encoding/hungarianEncoding';
import {
  buildRlbGlData,
  type RlbGlData,
  type RlbAccountInput,
  type RlbBuildOptions,
} from './rlbGlData';

const hu = (text: unknown): string => normalizeHungarianForPdf(text || '');

/**
 * Generates the jsPDF document conforming to the RLB-60 FŐKÖNYVI KIVONAT layout.
 */
export function generateRlbGlPdf(data: RlbGlData): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pw = doc.internal.pageSize.getWidth(); // 210mm
  const ph = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 10;
  const contentWidth = pw - margin * 2; // 190mm
  const headerHeight = 24; // mm

  const companyHeaderStr = data.taxNumber
    ? `${data.companyName} (${data.taxNumber}) - ${data.year || ''}`
    : `${data.companyName} - ${data.year || ''}`;

  // Header printer function called on every page
  const printHeader = (pdfDoc: jsPDF) => {
    // 1. Dark Top Banner Bar (RLB-60 style)
    const bannerY = 8;
    const bannerH = 7.5;
    pdfDoc.setFillColor(90, 95, 105); // Charcoal / slate gray
    pdfDoc.rect(margin, bannerY, contentWidth, bannerH, 'F');

    // 1.1 Left title: FŐKÖNYVI KIVONAT
    pdfDoc.setTextColor(255, 255, 255);
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.setFontSize(10.5);
    pdfDoc.text(hu('FŐKÖNYVI KIVONAT'), margin + 2.5, bannerY + 5.2);

    // 1.2 Right: Company Name + Tax ID + Year with auto-scaling
    let companyFontSize = 8.5;
    pdfDoc.setFontSize(companyFontSize);
    pdfDoc.setFont('helvetica', 'bold');
    const maxCompanyWidth = 110;
    while (companyFontSize > 6 && pdfDoc.getTextWidth(hu(companyHeaderStr)) > maxCompanyWidth) {
      companyFontSize -= 0.5;
      pdfDoc.setFontSize(companyFontSize);
    }
    pdfDoc.text(hu(companyHeaderStr), pw - margin - 2.5, bannerY + 5.2, { align: 'right' });

    // 2. Subtitle under banner: Period (e.g. Időszak: 2025.01.01-2025.12.31)
    pdfDoc.setTextColor(40, 40, 40);
    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(8.5);
    pdfDoc.text(hu(data.formattedPeriod || `Időszak: ${data.year}.01.01-${data.year}.12.31`), margin + 0.5, bannerY + bannerH + 4.5);
  };

  // 2. Prepare Body Rows
  const bodyRows: any[] = [];
  const fmtNum = (val: number) => (val === 0 ? '0' : formatHungarianNumber(val, 0));

  data.rows.forEach(r => {
    bodyRows.push({
      isClass: r.level === 'class',
      isGroup: r.level === 'group',
      isSubgroup: r.level === 'subgroup',
      isLeaf: r.level === 'leaf',
      isPartner: r.isPartner,
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

  // 1-4 számlaosztály összesen
  bodyRows.push({
    isClass1to4Total: true,
    data: [
      hu('1-4 számlaosztály összesen'),
      '',
      fmtNum(data.classSummary.classes1to4.turnoverDebit),
      fmtNum(data.classSummary.classes1to4.turnoverCredit),
      fmtNum(data.classSummary.classes1to4.balanceDebit),
      fmtNum(data.classSummary.classes1to4.balanceCredit),
    ],
  });

  // 5-9 számlaosztály összesen
  bodyRows.push({
    isClass5to9Total: true,
    data: [
      hu('5-9 számlaosztály összesen'),
      '',
      fmtNum(data.classSummary.classes5to9.turnoverDebit),
      fmtNum(data.classSummary.classes5to9.turnoverCredit),
      fmtNum(data.classSummary.classes5to9.balanceDebit),
      fmtNum(data.classSummary.classes5to9.balanceCredit),
    ],
  });

  // Mindösszesen (Grand Total)
  bodyRows.push({
    isGrandTotal: true,
    data: [
      hu('Mindösszesen'),
      '',
      fmtNum(data.classSummary.grandTotal.turnoverDebit),
      fmtNum(data.classSummary.grandTotal.turnoverCredit),
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
        { content: hu('Fők.szám'), rowSpan: 2, styles: { valign: 'middle', halign: 'left', fontStyle: 'bold' } },
        { content: hu('Megnevezés'), rowSpan: 2, styles: { valign: 'middle', halign: 'left', fontStyle: 'bold' } },
        { content: hu('Forgalom'), colSpan: 2, styles: { halign: 'center', fontStyle: 'bold' } },
        { content: hu('Egyenleg'), colSpan: 2, styles: { halign: 'center', fontStyle: 'bold' } },
      ],
      [
        { content: hu('Tartozik'), styles: { halign: 'right', fontStyle: 'bold' } },
        { content: hu('Követel'), styles: { halign: 'right', fontStyle: 'bold' } },
        { content: hu('Tartozik'), styles: { halign: 'right', fontStyle: 'bold' } },
        { content: hu('Követel'), styles: { halign: 'right', fontStyle: 'bold' } },
      ],
    ],
    body: bodyRows.map(r => r.data),
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: { top: 1.0, bottom: 1.0, left: 1.2, right: 1.2 },
      lineColor: [220, 220, 225],
      lineWidth: 0.05,
      textColor: [0, 0, 0],
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      lineColor: [60, 60, 60],
      lineWidth: { top: 0.35, bottom: 0.35 },
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 25, halign: 'left' },
      1: { cellWidth: 77, halign: 'left' },
      2: { cellWidth: 22, halign: 'right' },
      3: { cellWidth: 22, halign: 'right' },
      4: { cellWidth: 22, halign: 'right' },
      5: { cellWidth: 22, halign: 'right' },
    },
    didDrawPage: (dataHook) => {
      // 1. Print Header
      printHeader(doc);

      // 2. Print Footer
      const totalPages = doc.getNumberOfPages();
      const currentPage = dataHook.pageNumber;
      const footerY = ph - 6.5;

      // Divider line
      doc.setDrawColor(180, 180, 185);
      doc.setLineWidth(0.2);
      doc.line(margin, footerY - 2.5, pw - margin, footerY - 2.5);

      // Left: RLB layout info + page
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(90, 90, 90);
      doc.text(`EaisyBill — RLB-60 formátum (${data.mode === 'extended' ? 'Bővített' : 'Alap'})`, margin, footerY);
      doc.text(`${currentPage}. oldal`, pw / 2, footerY, { align: 'center' });

      // Right: generation timestamp + licensed company
      const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19).replace(/-/g, '.');
      doc.text(`${nowStr}  |  felhasználó: ${hu(data.companyName)}`, pw - margin, footerY, { align: 'right' });
    },
    didParseCell: (hookData) => {
      const rowIndex = hookData.row.index;
      const meta = bodyRows[rowIndex];
      if (!meta) return;

      // Class Header (Level 1, e.g. "1 BEFEKTETETT ESZKÖZÖK"): shaded gray background, bold font
      if (meta.isClass) {
        hookData.cell.styles.fillColor = [228, 231, 236]; // #e4e7ec
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.fontSize = 7.5;
        hookData.cell.styles.textColor = [15, 23, 42];
      }
      // Group Header (Level 2, e.g. "13 MŰSZAKI GÉPEK..."): bold font
      else if (meta.isGroup) {
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.textColor = [15, 23, 42];
      }
      // Partner Row (Level 5): subtle font
      else if (meta.isPartner) {
        hookData.cell.styles.fontSize = 7;
        hookData.cell.styles.textColor = [51, 65, 85];
        if (hookData.column.index === 1) {
          hookData.cell.styles.cellPadding = { top: 0.8, bottom: 0.8, left: 3.5, right: 1.2 };
        }
      }
      // 1-4 / 5-9 Class Summary Rows
      else if (meta.isClass1to4Total || meta.isClass5to9Total) {
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.fillColor = [241, 245, 249]; // #f1f5f9
        hookData.cell.styles.textColor = [15, 23, 42];
        if (hookData.column.index === 0) {
          hookData.cell.colSpan = 2;
        }
      }
      // Mindösszesen (Grand Total)
      else if (meta.isGrandTotal) {
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.fontSize = 8;
        hookData.cell.styles.fillColor = [228, 231, 236]; // #e4e7ec
        hookData.cell.styles.lineColor = [30, 41, 59];
        hookData.cell.styles.lineWidth = { top: 0.35, bottom: 0.35 };
        hookData.cell.styles.textColor = [0, 0, 0];
        if (hookData.column.index === 0) {
          hookData.cell.colSpan = 2;
        }
      }
    },
  });

  return doc;
}

/**
 * Convenience helper to build data and trigger PDF download directly in browser.
 */
export function downloadRlbGlPdf(
  accounts: RlbAccountInput[],
  options: RlbBuildOptions = {}
): void {
  const data = buildRlbGlData(accounts, options);
  const doc = generateRlbGlPdf(data);
  const cleanName = (options.companyName || 'vallalkozas').replace(/[^a-zA-Z0-9_\-]/g, '_');
  const modeSuffix = options.mode === 'extended' ? 'bovitett_vevo_szallito' : 'alap';
  const yearStr = options.dateFrom ? options.dateFrom.substring(0, 4) : new Date().getFullYear();
  const filename = `Fokonyvi_kivonat_${modeSuffix}_${cleanName}_${yearStr}.pdf`;
  doc.save(filename);
}
