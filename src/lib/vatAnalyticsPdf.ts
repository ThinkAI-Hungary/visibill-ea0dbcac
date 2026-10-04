import jsPDF from 'jspdf';
import autoTable, { RowInput } from 'jspdf-autotable';
import { normalizeHungarianForPdf, formatHungarianNumber } from './documents/encoding/hungarianEncoding';
import type { VatCollectorGroup } from './glExport';

const hu = (text: string | null | undefined): string => normalizeHungarianForPdf(text || '');

export interface VatAnalyticsPdfOptions {
  groups: VatCollectorGroup[];
  companyName: string;
  companyTaxNumber?: string;
  year?: number | string;
  dateFrom: string;
  dateTo: string;
  targetCurrency?: string;
  viewMode?: 'collector' | 'row';
  journalMap?: Map<string, string>;
}

/**
 * Formats a numeric amount for Hungarian accounting listing.
 * Negative numbers are prefixed with a minus sign and thousand-separated with spaces (e.g. -26 177).
 */
function fmtAmount(value: number): string {
  const rounded = Math.round(value);
  if (rounded === 0) return '0';
  const isNegative = rounded < 0;
  const absStr = Math.abs(rounded).toString();
  const withSpaces = absStr.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return isNegative ? `-${withSpaces}` : withSpaces;
}

/**
 * Formats VAT rate label (e.g. 27%-os, 5%-os, mentes, FAD).
 */
function fmtVatRate(code?: string | null, vatRate?: string | null, vatAmount?: number | null): string {
  if (vatAmount === 0 || code === 'AAM' || code === 'TAM' || code === 'EXP' || code === 'ÁHK' || code === 'AHK') {
    return 'mentes';
  }
  if (code === 'FAD') {
    return '27%-os';
  }
  if (code === '25' || code === '27' || vatRate?.includes('27') || vatRate?.includes('25')) {
    return '27%-os';
  }
  if (code === '18' || vatRate?.includes('18')) {
    return '18%-os';
  }
  if (code === '05' || vatRate?.includes('5')) {
    return '5%-os';
  }
  if (code === '13' || vatRate?.includes('13')) {
    return '13%-os';
  }
  return code || '-';
}

/**
 * Formats date into standard YYYY.MM.DD format.
 */
function fmtDate(d?: string | null): string {
  if (!d) return '';
  return d.substring(0, 10).replace(/-/g, '.');
}

/**
 * Resolves a clean group title matching the RLB-60 standard.
 */
function resolveGroupTitle(group: VatCollectorGroup, isRowMode: boolean): string {
  if (isRowMode) {
    const code = group.code.trim();
    if (code === 'nem_szerepel' || code === 'none' || code === 'NEM') {
      return 'Nem szerepel a bevallásban';
    }
    if (group.label) {
      if (group.label.includes('—')) {
        const parts = group.label.split('—');
        const rowPart = parts[0].replace(/sor/gi, '').replace(/\./g, '').trim();
        const descPart = parts.slice(1).join('—').trim();
        return `${rowPart} - ${descPart}`;
      }
      if (group.label.toLowerCase().includes('sor')) {
        return group.label;
      }
      return `${code} - ${group.label}`;
    }
    return `${code} - sor`;
  }
  return `Gyűjtőkód: ${group.code} — ${group.label}`;
}

/**
 * Generates an RLB-60 standard compliant VAT Analytics PDF report (A4 Portrait).
 */
export function generateVatAnalyticsPdf(options: VatAnalyticsPdfOptions): jsPDF {
  const {
    groups,
    companyName,
    companyTaxNumber,
    year,
    dateFrom,
    dateTo,
    viewMode = 'row',
    journalMap = new Map<string, string>(),
  } = options;

  const isRowMode = viewMode === 'row';
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pw = doc.internal.pageSize.getWidth(); // 210 mm
  const ph = doc.internal.pageSize.getHeight(); // 297 mm
  const margin = 8;
  const contentWidth = pw - margin * 2; // 194 mm

  // Header Banner Dimensions
  const bannerY = 8;
  const bannerH = 8.5;

  const drawHeaderOnFirstPage = () => {
    // 1. Dark Grey Top Header Banner
    doc.setFillColor(115, 115, 115);
    doc.rect(margin, bannerY, contentWidth, bannerH, 'F');

    // Title on the left
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.5);
    const mainTitle = isRowMode ? 'ÁFA LISTA BEVALLÁSI SORONKÉNT' : 'ÁFA LISTA GYŰJTŐKÓDONKÉNT';
    doc.text(hu(mainTitle), margin + 3, bannerY + 5.8);

    // Company, Tax Number & Year on the right
    doc.setFontSize(8.5);
    const companyHeader = `${companyName}${companyTaxNumber ? ` (${companyTaxNumber})` : ''}${year ? ` - ${year}` : ''}`;
    doc.text(hu(companyHeader), pw - margin - 3, bannerY + 5.8, { align: 'right' });

    // 2. Subheader: Date Filter
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    const filterText = `Dátum szerinti szűkítés: ${fmtDate(dateFrom)} - ${fmtDate(dateTo)}`;
    doc.text(hu(filterText), margin, bannerY + 13.5);

    // Subheader divider line
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.line(margin, bannerY + 15.5, pw - margin, bannerY + 15.5);
  };

  drawHeaderOnFirstPage();

  // Table Body construction
  const tableBody: RowInput[] = [];
  let grandNet = 0;
  let grandVat = 0;
  let grandGross = 0;

  groups.forEach((group) => {
    const groupTitle = resolveGroupTitle(group, isRowMode);

    // Group Header Row
    tableBody.push([
      {
        content: hu(groupTitle),
        colSpan: 10,
        styles: {
          fontStyle: 'bold',
          fontSize: 8,
          textColor: [20, 20, 20],
          fillColor: [255, 255, 255],
          cellPadding: { top: 2.5, bottom: 1.5, left: 1, right: 1 },
          halign: 'left',
        },
      },
    ]);

    let groupSignedNet = 0;
    let groupSignedVat = 0;
    let groupSignedGross = 0;

    group.items.forEach((item, itemIdx) => {
      const isOutbound = item.direction === 'OUTBOUND';
      const directionLabel = isOutbound ? 'bev' : 'kia';

      // Accounting sign convention matching RLB: Outbound is positive (+), Inbound is negative (-)
      const itemNet = (item as any).effective_net != null ? (item as any).effective_net : item.net_amount;
      const itemVat = (item as any).effective_vat != null ? (item as any).effective_vat : item.vat_amount;
      const itemGross = (item as any).effective_gross != null ? (item as any).effective_gross : item.gross_amount;

      const signedNet = isOutbound ? itemNet : -itemNet;
      const signedVat = isOutbound ? itemVat : -itemVat;
      const signedGross = isOutbound ? itemGross : -itemGross;

      groupSignedNet += signedNet;
      groupSignedVat += signedVat;
      groupSignedGross += signedGross;

      // Journal entry sequence lookup
      const invNumNorm = (item.invoice_number || '').trim().toUpperCase();
      const naploRef = journalMap.get(invNumNorm) || '';

      // Partner name + item description
      const lineDesc = (item as any).line_description || '';
      const partnerText = lineDesc
        ? `${item.partner_name}-${lineDesc}`
        : item.partner_name;

      const vatRateLabel = fmtVatRate(item.code, (item as any).vat_rate, item.vat_amount);

      // Zebra striping: alternate row backgrounds
      const isEven = itemIdx % 2 === 0;
      const rowBgColor: [number, number, number] = isEven ? [239, 239, 239] : [255, 255, 255];

      tableBody.push([
        { content: hu(naploRef), styles: { halign: 'left', fillColor: rowBgColor } },
        { content: fmtDate(item.fulfillment_date), styles: { halign: 'center', fillColor: rowBgColor } },
        { content: hu(item.invoice_number), styles: { halign: 'left', fillColor: rowBgColor } },
        { content: hu(partnerText), styles: { halign: 'left', fillColor: rowBgColor } },
        { content: '', styles: { halign: 'center', fillColor: rowBgColor } }, // Msz.
        { content: directionLabel, styles: { halign: 'center', fillColor: rowBgColor } },
        { content: hu(vatRateLabel), styles: { halign: 'center', fillColor: rowBgColor } },
        { content: fmtAmount(signedNet), styles: { halign: 'right', fillColor: rowBgColor } },
        { content: fmtAmount(signedVat), styles: { halign: 'right', fillColor: rowBgColor } },
        { content: fmtAmount(signedGross), styles: { halign: 'right', fillColor: rowBgColor } },
      ]);
    });

    // Group Subtotal Row
    tableBody.push([
      {
        content: '',
        colSpan: 7,
        styles: {
          fillColor: [255, 255, 255],
          cellPadding: { top: 1.5, bottom: 2, left: 1, right: 1 },
          lineWidth: { top: 0.2, bottom: 0.2, left: 0, right: 0 },
          lineColor: [100, 100, 100],
        },
      },
      {
        content: fmtAmount(groupSignedNet),
        styles: {
          halign: 'right',
          fontStyle: 'bold',
          fontSize: 7.5,
          fillColor: [255, 255, 255],
          lineWidth: { top: 0.2, bottom: 0.2, left: 0, right: 0 },
          lineColor: [100, 100, 100],
        },
      },
      {
        content: fmtAmount(groupSignedVat),
        styles: {
          halign: 'right',
          fontStyle: 'bold',
          fontSize: 7.5,
          fillColor: [255, 255, 255],
          lineWidth: { top: 0.2, bottom: 0.2, left: 0, right: 0 },
          lineColor: [100, 100, 100],
        },
      },
      {
        content: fmtAmount(groupSignedGross),
        styles: {
          halign: 'right',
          fontStyle: 'bold',
          fontSize: 7.5,
          fillColor: [255, 255, 255],
          lineWidth: { top: 0.2, bottom: 0.2, left: 0, right: 0 },
          lineColor: [100, 100, 100],
        },
      },
    ]);

    grandNet += groupSignedNet;
    grandVat += groupSignedVat;
    grandGross += groupSignedGross;
  });

  // Grand Total Row (Összesen:)
  tableBody.push([
    {
      content: hu('Összesen:'),
      colSpan: 7,
      styles: {
        halign: 'right',
        fontStyle: 'bold',
        fontSize: 8.5,
        fillColor: [255, 255, 255],
        cellPadding: { top: 2.5, bottom: 2.5, left: 1, right: 2 },
        lineWidth: { top: 0.3, bottom: 0.4, left: 0, right: 0 },
        lineColor: [50, 50, 50],
      },
    },
    {
      content: fmtAmount(grandNet),
      styles: {
        halign: 'right',
        fontStyle: 'bold',
        fontSize: 8.5,
        fillColor: [255, 255, 255],
        cellPadding: { top: 2.5, bottom: 2.5, left: 1, right: 1 },
        lineWidth: { top: 0.3, bottom: 0.4, left: 0, right: 0 },
        lineColor: [50, 50, 50],
      },
    },
    {
      content: fmtAmount(grandVat),
      styles: {
        halign: 'right',
        fontStyle: 'bold',
        fontSize: 8.5,
        fillColor: [255, 255, 255],
        cellPadding: { top: 2.5, bottom: 2.5, left: 1, right: 1 },
        lineWidth: { top: 0.3, bottom: 0.4, left: 0, right: 0 },
        lineColor: [50, 50, 50],
      },
    },
    {
      content: fmtAmount(grandGross),
      styles: {
        halign: 'right',
        fontStyle: 'bold',
        fontSize: 8.5,
        fillColor: [255, 255, 255],
        cellPadding: { top: 2.5, bottom: 2.5, left: 1, right: 1 },
        lineWidth: { top: 0.3, bottom: 0.4, left: 0, right: 0 },
        lineColor: [50, 50, 50],
      },
    },
  ]);

  // Render Table via jspdf-autotable
  autoTable(doc, {
    startY: bannerY + 18,
    margin: { left: margin, right: margin, top: 18, bottom: 15 },
    head: [[
      hu('Naplósorsz.'),
      hu('ÁFA es.'),
      hu('Biz.szám'),
      hu('Partner - szöveg'),
      hu('Msz.'),
      hu('B/K'),
      hu('Áfa%'),
      hu('Nettó'),
      hu('Áfa'),
      hu('Bruttó'),
    ]],
    body: tableBody,
    theme: 'plain',
    tableWidth: contentWidth,
    headStyles: {
      fillColor: [115, 115, 115],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
      cellPadding: { top: 1.5, bottom: 1.5, left: 1, right: 1 },
      lineWidth: 0.1,
      lineColor: [180, 180, 180],
    },
    styles: {
      font: 'helvetica',
      fontSize: 7,
      textColor: [30, 30, 30],
      cellPadding: { top: 1.2, bottom: 1.2, left: 1, right: 1 },
      overflow: 'linebreak',
    },
    columnStyles: {
      0: { cellWidth: 17, halign: 'left' },    // Naplósorsz.
      1: { cellWidth: 16, halign: 'center' },  // ÁFA es.
      2: { cellWidth: 25, halign: 'left' },    // Biz.szám
      3: { cellWidth: 56, halign: 'left' },    // Partner - szöveg
      4: { cellWidth: 8, halign: 'center' },   // Msz.
      5: { cellWidth: 8, halign: 'center' },   // B/K
      6: { cellWidth: 12, halign: 'center' },  // Áfa%
      7: { cellWidth: 17, halign: 'right' },   // Nettó
      8: { cellWidth: 16, halign: 'right' },   // Áfa
      9: { cellWidth: 19, halign: 'right' },   // Bruttó
    },
    didDrawPage: (data) => {
      // Draw subheader on subsequent pages
      if (data.pageNumber > 1) {
        doc.setFillColor(115, 115, 115);
        doc.rect(margin, 6, contentWidth, 7, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        const mainTitle = isRowMode ? 'ÁFA LISTA BEVALLÁSI SORONKÉNT' : 'ÁFA LISTA GYŰJTŐKÓDONKÉNT';
        doc.text(hu(mainTitle), margin + 3, 11);
        doc.setFontSize(8);
        const companyHeader = `${companyName}${companyTaxNumber ? ` (${companyTaxNumber})` : ''}${year ? ` - ${year}` : ''}`;
        doc.text(hu(companyHeader), pw - margin - 3, 11, { align: 'right' });
      }

      // ── Footer Bar ───────────────────────────────────────────
      const footerBarY = ph - 13;
      doc.setFillColor(115, 115, 115);
      doc.rect(margin, footerBarY, contentWidth, 2.6, 'F');

      // Center link / branding
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(255, 255, 255);
      doc.text('www.visibill.hu', pw / 2, footerBarY + 1.8, { align: 'center' });

      // Page numbering on the right of the bar
      doc.text(hu(`${data.pageNumber}. oldal`), pw - margin - 2, footerBarY + 1.8, { align: 'right' });

      // Below bar: generation date and user licence
      const bottomTextY = footerBarY + 5.5;
      const now = new Date();
      const dateHu = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

      doc.setFontSize(6.5);
      doc.setTextColor(90, 90, 90);
      doc.setFont('helvetica', 'normal');
      doc.text(dateHu, pw - margin, bottomTextY, { align: 'right' });
      doc.text(hu(`a program jogos felhasználója: ${companyName}`), pw - margin, bottomTextY + 3.2, { align: 'right' });

      // Left branding mark
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 100, 100);
      doc.text('visibill', margin, bottomTextY + 1);
    },
  });

  return doc;
}

/**
 * Convenience helper to download the VAT Analytics PDF directly.
 */
export function downloadVatAnalyticsPdf(options: VatAnalyticsPdfOptions, filename?: string): void {
  const doc = generateVatAnalyticsPdf(options);
  const cleanFilename = filename || (
    options.viewMode === 'row'
      ? `AFA_lista_bevallasi_soronkent_${options.year || ''}_${options.dateFrom}_${options.dateTo}.pdf`
      : `AFA_lista_gyujtokodonkent_${options.year || ''}_${options.dateFrom}_${options.dateTo}.pdf`
  );
  doc.save(cleanFilename);
}
