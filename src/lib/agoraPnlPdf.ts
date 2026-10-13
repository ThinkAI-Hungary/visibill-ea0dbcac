/**
 * agoraPnlPdf.ts
 *
 * Hivatalos magyar Eredménykimutatás összköltség eljárással („A” változat)
 * A4 álló formátumú, 2 oldalas formátumhű PDF generáló jsPDF-fel a benchmark
 * Novitax / Agora dokumentum (tests/docs/eb0148/Eredménykimutatás_export.pdf) alapján.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { normalizeHungarianForPdf } from './documents/encoding/hungarianEncoding';
import {
  buildAgoraPnlData,
  formatAgoraPnlNumber,
  type AgoraPnlReportData,
  type BuildAgoraPnlOptions,
  type AgoraPnlCalculatedRow,
} from './agoraPnlData';

const hu = (text: unknown): string => normalizeHungarianForPdf(text || '');

/**
 * Generálja a 2 oldalas formátumhű Eredménykimutatás PDF dokumentumot
 */
export function generateAgoraPnlPdf(data: AgoraPnlReportData): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pw = doc.internal.pageSize.getWidth(); // 210 mm
  const ph = doc.internal.pageSize.getHeight(); // 297 mm
  const margin = 10; // mm
  const contentWidth = pw - margin * 2; // 190 mm

  const companyHeaderStr = data.company.taxNumber
    ? `${data.company.name} ( ${data.company.taxNumber} )`
    : data.company.name;

  /**
   * Fejléc kirajzolása mindkét oldalon
   */
  const printHeader = (pdfDoc: jsPDF, pageNum: number) => {
    pdfDoc.setTextColor(0, 0, 0);

    // 1. Legfelső sor: Cég neve (bal) és Listaazonosító (jobb)
    pdfDoc.setFont('helvetica', 'bold');
    let compFontSize = 8;
    pdfDoc.setFontSize(compFontSize);
    const maxCompWidth = contentWidth - 45;
    while (compFontSize > 6 && pdfDoc.getTextWidth(hu(companyHeaderStr)) > maxCompWidth) {
      compFontSize -= 0.5;
      pdfDoc.setFontSize(compFontSize);
    }
    pdfDoc.text(hu(companyHeaderStr), margin, 7.5, { maxWidth: maxCompWidth });

    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(7.5);
    pdfDoc.text(hu(`Listaazonosító: ${data.listId}`), pw - margin, 7.5, { align: 'right' });

    // Felső vékony elválasztó vonal
    pdfDoc.setDrawColor(80, 80, 80);
    pdfDoc.setLineWidth(0.25);
    pdfDoc.line(margin, 9, pw - margin, 9);

    // 2. Főcím középen
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.setFontSize(11);
    pdfDoc.text(hu('Eredménykimutatás összköltség eljárással'), pw / 2, 14.5, { align: 'center' });

    // 3. Cégadatok blokk (Bal oldal)
    pdfDoc.setFontSize(7);
    const labelX = margin;
    const valueX = margin + 32;
    let curY = 19;
    const lineSpacing = 3.6;

    const companyLabels = [
      { label: 'Cég:', value: data.company.name },
      { label: 'Cím:', value: data.company.address || '-' },
      { label: 'Adószám:', value: data.company.taxNumber || '-' },
      { label: 'Statisztikai számjel:', value: data.company.statisticalCode || '-' },
      { label: 'Cégjegyzék száma:', value: data.company.registrationNumber || '-' },
      { label: 'Mérlegforduló napja:', value: data.company.balanceSheetDate || '-' },
    ];

    companyLabels.forEach(item => {
      pdfDoc.setFont('helvetica', 'normal');
      pdfDoc.text(hu(item.label), labelX, curY);
      pdfDoc.setFont('helvetica', 'bold');
      pdfDoc.text(hu(item.value), valueX, curY, { maxWidth: 90 });
      curY += lineSpacing;
    });

    // 4. Időszak és Oldalszám blokk (Jobb oldal)
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.setFontSize(8);
    pdfDoc.text(hu(data.period), pw - margin, 19, { align: 'right' });

    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(8);
    pdfDoc.text(hu(String(pageNum)), pw - margin, 26, { align: 'right' });

    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.setFontSize(8);
    pdfDoc.text(hu(data.currency), pw - margin, 37, { align: 'right' });
  };

  /**
   * Aláírási és keltezési mező kirajzolása az oldal alján
   */
  const printSignatureBlock = (pdfDoc: jsPDF) => {
    const signY = ph - 17;
    pdfDoc.setDrawColor(120, 120, 120);
    pdfDoc.setLineWidth(0.2);

    // Bal: keltezés
    pdfDoc.line(margin + 15, signY, margin + 55, signY);
    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(7);
    pdfDoc.text(hu('keltezés'), margin + 35, signY + 3.5, { align: 'center' });

    // Jobb: a vállalkozás vezetője
    pdfDoc.line(pw - margin - 65, signY, pw - margin - 15, signY);
    pdfDoc.text(hu('a vállalkozás vezetője (képviselője)'), pw - margin - 40, signY + 3.5, { align: 'center' });
  };

  /**
   * Lábléc elválasztó vonal és branding
   */
  const printFooterBar = (pdfDoc: jsPDF, pageNum: number) => {
    pdfDoc.setDrawColor(180, 180, 180);
    pdfDoc.setLineWidth(0.2);
    pdfDoc.line(margin, ph - 8, pw - margin, ph - 8);

    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(7);
    pdfDoc.setTextColor(60, 60, 60);

    // Bal: Dátum
    pdfDoc.text(hu(data.generatedDate), margin, ph - 4.5);

    // Közép: EaisyBill
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.text(hu(data.branding), pw / 2, ph - 4.5, { align: 'center' });

    // Jobb: Regisztrálva + Lap
    pdfDoc.setFont('helvetica', 'normal');
    const maxRightWidth = (pw / 2) - margin - 5;
    pdfDoc.text(
      hu(`Regisztrálva: ${companyHeaderStr}   Lap: ${pageNum}`),
      pw - margin,
      ph - 4.5,
      { align: 'right', maxWidth: maxRightWidth }
    );
  };

  /**
   * Táblázat sorok előállítása autoTable formátumban
   */
  const buildTableRows = (rows: AgoraPnlCalculatedRow[]) => {
    return rows.map(r => {
      const lineNumStr = String(r.lineNum).padStart(2, '0') + '.';
      const codeStr = r.code;
      const nameStr = r.isSubItem ? `   ${r.name}` : r.name;
      const elozoStr = formatAgoraPnlNumber(r.displayPrevious, true);
      const modStr = formatAgoraPnlNumber(r.displayMod, true);
      const targyStr = formatAgoraPnlNumber(r.displayCurrent, true);

      return {
        isCapital: r.isCapital,
        isRoman: r.isRoman,
        isSubItem: r.isSubItem,
        data: [lineNumStr, codeStr, hu(nameStr), elozoStr, modStr, targyStr],
      };
    });
  };

  const tableHead = [
    [
      { content: hu('Sorszám'), styles: { halign: 'left' as const, fontStyle: 'bold' as const } },
      { content: hu('Kód'), styles: { halign: 'left' as const, fontStyle: 'bold' as const } },
      { content: hu('Megnevezés'), styles: { halign: 'left' as const, fontStyle: 'bold' as const } },
      { content: hu('Előző'), styles: { halign: 'right' as const, fontStyle: 'bold' as const } },
      { content: hu('Mód'), styles: { halign: 'right' as const, fontStyle: 'bold' as const } },
      { content: hu('Tárgyév'), styles: { halign: 'right' as const, fontStyle: 'bold' as const } },
    ],
  ];

  const columnStyles: any = {
    0: { cellWidth: 14, halign: 'left' },   // Sorszám (01. - 48.)
    1: { cellWidth: 12, halign: 'left' },   // Kód (01.-22., I.-X., A.-D.)
    2: { cellWidth: 96, halign: 'left' },   // Megnevezés
    3: { cellWidth: 22, halign: 'right' },  // Előző
    4: { cellWidth: 16, halign: 'right' },  // Mód
    5: { cellWidth: 30, halign: 'right' },  // Tárgyév
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 1. OLDAL KIRAJZOLÁSA (Sorok 01. – 22.)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  printHeader(doc, 1);

  const page1MetaRows = buildTableRows(data.page1Rows);
  autoTable(doc, {
    startY: 42,
    margin: { left: margin, right: margin, bottom: 24 },
    tableWidth: contentWidth,
    head: tableHead,
    body: page1MetaRows.map(r => r.data),
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 7.2,
      cellPadding: { top: 1.1, bottom: 1.1, left: 1, right: 1 },
      lineColor: [210, 210, 210],
      lineWidth: 0.05,
      textColor: [0, 0, 0],
    },
    headStyles: {
      fillColor: [235, 235, 235],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      lineColor: [120, 120, 120],
      lineWidth: 0.15,
      fontSize: 7.5,
    },
    columnStyles,
    didParseCell: (hookData) => {
      const rowIndex = hookData.row.index;
      const meta = page1MetaRows[rowIndex];
      if (!meta) return;

      if (meta.isCapital) {
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.fillColor = [240, 240, 240];
        hookData.cell.styles.lineColor = [80, 80, 80];
        hookData.cell.styles.lineWidth = { top: 0.15, bottom: 0.15 };
      } else if (meta.isRoman) {
        hookData.cell.styles.fontStyle = 'bold';
      } else if (meta.isSubItem) {
        hookData.cell.styles.fontStyle = 'italic';
        hookData.cell.styles.textColor = [50, 50, 50];
      }
    },
  });

  printSignatureBlock(doc);
  printFooterBar(doc, 1);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 2. OLDAL KIRAJZOLÁSA (Sorok 23. – 48.)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  doc.addPage('a4', 'portrait');
  printHeader(doc, 2);

  const page2MetaRows = buildTableRows(data.page2Rows);
  autoTable(doc, {
    startY: 42,
    margin: { left: margin, right: margin, bottom: 24 },
    tableWidth: contentWidth,
    head: tableHead,
    body: page2MetaRows.map(r => r.data),
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 7.2,
      cellPadding: { top: 1.1, bottom: 1.1, left: 1, right: 1 },
      lineColor: [210, 210, 210],
      lineWidth: 0.05,
      textColor: [0, 0, 0],
    },
    headStyles: {
      fillColor: [235, 235, 235],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      lineColor: [120, 120, 120],
      lineWidth: 0.15,
      fontSize: 7.5,
    },
    columnStyles,
    didParseCell: (hookData) => {
      const rowIndex = hookData.row.index;
      const meta = page2MetaRows[rowIndex];
      if (!meta) return;

      if (meta.isCapital) {
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.fillColor = [240, 240, 240];
        hookData.cell.styles.lineColor = [80, 80, 80];
        hookData.cell.styles.lineWidth = { top: 0.15, bottom: 0.15 };
      } else if (meta.isRoman) {
        hookData.cell.styles.fontStyle = 'bold';
      } else if (meta.isSubItem) {
        hookData.cell.styles.fontStyle = 'italic';
        hookData.cell.styles.textColor = [50, 50, 50];
      }
    },
  });

  printSignatureBlock(doc);
  printFooterBar(doc, 2);

  return doc;
}

/**
 * Közvetlen letöltést indító segédfüggvény a böngészőben
 */
export function downloadAgoraPnlPdf(options: BuildAgoraPnlOptions): void {
  const data = buildAgoraPnlData(options);
  const doc = generateAgoraPnlPdf(data);

  const safeComp = (data.company.name || 'Ceg').replace(/[^a-zA-Z0-9]/g, '_');
  const unitSuffix = data.inThousands ? '_ezer_huf' : '_huf';
  const filename = `Eredmenykimutatas_A_valtozat_${safeComp}_${data.generatedDate.replace(/\./g, '')}${unitSuffix}.pdf`;

  doc.save(filename);
}
