import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCustodianName, type FixedAsset } from '@/types/fixed-assets';

export type InventoryCheckStatus = 'found' | 'missing' | 'damaged' | 'scrap_candidate';

export interface InventoryItemReportRow {
  asset: FixedAsset;
  checkStatus: InventoryCheckStatus;
  notes?: string;
  physicalLocation?: string;
  physicalCustodian?: string;
}

export interface InventoryReportExportParams {
  companyName: string;
  companyTaxNumber?: string;
  companyAddress?: string;
  cutoffDate: string; // YYYY-MM-DD
  items: InventoryItemReportRow[];
  committeeMembers?: {
    taker?: string;      // Leltárfelvevő
    inspector?: string;  // Leltárellenőr
    approver?: string;   // Felelős vezető
  };
}

export const INVENTORY_STATUS_LABELS: Record<InventoryCheckStatus, string> = {
  found: 'Fellelve (Rendben)',
  missing: 'Hiányzik',
  damaged: 'Sérült / Javítandó',
  scrap_candidate: 'Selejtezendő',
};

function hu(text: string): string {
  if (!text) return '';
  return text
    .replace(/ő/g, 'ö').replace(/Ő/g, 'Ö')
    .replace(/ű/g, 'ü').replace(/Ű/g, 'Ü');
}

/**
 * Számviteli törvény (Sztv. 69. §) szerinti Analitikus Fordulónapi Leltárív exportálása Excel (.xlsx) formátumban.
 */
export async function exportInventoryReportXlsx(params: InventoryReportExportParams): Promise<void> {
  const { companyName, companyTaxNumber, companyAddress, cutoffDate, items, committeeMembers } = params;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'VisiBill TÉNY';
  workbook.lastModifiedBy = 'VisiBill TÉNY';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet('Leltárív', {
    pageSetup: {
      orientation: 'landscape',
      paperSize: 9, // A4
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
    views: [{ state: 'frozen', ySplit: 7 }],
  });

  // ── Fejléc metaadatok ──
  worksheet.mergeCells('A1:L1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'ANALITIKUS TÁRGYI ESZKÖZ FORDULÓNAPI LELTÁRÍV (Sztv. 69. §)';
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF1A2A44' } };
  titleCell.alignment = { horizontal: 'left', vertical: 'middle' };

  worksheet.mergeCells('A2:F2');
  worksheet.getCell('A2').value = `Munkáltató / Cég: ${companyName}${companyTaxNumber ? ` | Adószám: ${companyTaxNumber}` : ''}`;
  worksheet.getCell('A2').font = { name: 'Calibri', size: 10, bold: true };

  worksheet.mergeCells('A3:F3');
  worksheet.getCell('A3').value = `Székhely: ${companyAddress || '-'}`;
  worksheet.getCell('A3').font = { name: 'Calibri', size: 9, color: { argb: 'FF555555' } };

  worksheet.mergeCells('A4:F4');
  worksheet.getCell('A4').value = `Leltár fordulónapja: ${cutoffDate} | Készült: ${new Date().toISOString().split('T')[0]}`;
  worksheet.getCell('A4').font = { name: 'Calibri', size: 9, italic: true };

  // Üres sor
  worksheet.addRow([]);

  // ── Táblázat Fejlécek ──
  const headers = [
    'Ssz.',
    'Leltári szám',
    'Megnevezés',
    'Aktiválás dátuma',
    'Bruttó beszerzési érték (Ft)',
    'Halmozott terv sz. ÉCS (Ft)',
    'Könyv szerinti nettó érték (Ft)',
    'Telephely',
    'Tárolóhely',
    'Felelős személy',
    'Leltári állapot',
    'Megjegyzés / Eltérés',
  ];

  const headerRow = worksheet.addRow(headers);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1A2A44' }, // navy blue
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      bottom: { style: 'medium', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
    };
  });

  // Oszlop szélességek
  const colWidths = [6, 16, 32, 14, 20, 20, 20, 18, 18, 20, 18, 25];
  colWidths.forEach((w, idx) => {
    worksheet.getColumn(idx + 1).width = w;
  });

  // ── Adatsorok feltöltése ──
  let totalGross = 0;
  let totalDepr = 0;
  let totalNet = 0;

  items.forEach((item, index) => {
    const asset = item.asset;
    const gross = Number(asset.acquisition_value || 0);
    const depr = Number(asset.accumulated_depreciation || 0);
    const net = Number(asset.net_book_value ?? Math.max(0, gross - depr));

    totalGross += gross;
    totalDepr += depr;
    totalNet += net;

    const locName = item.physicalLocation || asset.location?.name || '-';
    const subLocName = asset.sub_location?.name || '-';
    const custName = item.physicalCustodian || formatCustodianName(asset.custodian) || '-';
    const statusLabel = INVENTORY_STATUS_LABELS[item.checkStatus] || item.checkStatus;

    const row = worksheet.addRow([
      index + 1,
      asset.inventory_number,
      asset.name,
      asset.activation_date || '-',
      gross,
      depr,
      net,
      locName,
      subLocName,
      custName,
      statusLabel,
      item.notes || '',
    ]);

    row.height = 20;

    // Igazítások és számformátumok
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(2).font = { name: 'Consolas', size: 9 };
    row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };

    [5, 6, 7].forEach((colIdx) => {
      const cell = row.getCell(colIdx);
      cell.numFmt = '#,##0" Ft"';
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      cell.font = { name: 'Calibri', size: 9.5 };
    });

    [8, 9, 10].forEach((colIdx) => {
      row.getCell(colIdx).alignment = { horizontal: 'left', vertical: 'middle' };
    });

    // Státusz színezése
    const statusCell = row.getCell(11);
    statusCell.alignment = { horizontal: 'center', vertical: 'middle' };
    if (item.checkStatus === 'missing') {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEBEB' } };
      statusCell.font = { color: { argb: 'FFD32F2F' }, bold: true };
    } else if (item.checkStatus === 'damaged' || item.checkStatus === 'scrap_candidate') {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF4E5' } };
      statusCell.font = { color: { argb: 'FFED6C02' }, bold: true };
    } else {
      statusCell.font = { color: { argb: 'FF2E7D32' } };
    }

    row.getCell(12).alignment = { horizontal: 'left', vertical: 'middle' };

    // Keretek
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        right: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      };
    });
  });

  // ── Összesítő sor ──
  const summaryRow = worksheet.addRow([
    '',
    'ÖSSZESEN:',
    `${items.length} db vagyontárgy`,
    '',
    totalGross,
    totalDepr,
    totalNet,
    '',
    '',
    '',
    '',
    '',
  ]);

  summaryRow.height = 24;
  summaryRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Calibri', size: 10, bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4F8' } };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF000000' } },
      bottom: { style: 'double', color: { argb: 'FF000000' } },
    };
    if ([5, 6, 7].includes(colNumber)) {
      cell.numFmt = '#,##0" Ft"';
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    }
  });

  // ── Aláírási záradék blokk ──
  worksheet.addRow([]);
  worksheet.addRow([]);
  const certRow1 = worksheet.addRow(['', 'A leltárfelvétel a valóságnak megfelelően, a Számviteli Törvény előírásai szerint történt.']);
  certRow1.getCell(2).font = { italic: true, size: 9 };

  worksheet.addRow([]);
  worksheet.addRow([]);

  const sigRow = worksheet.addRow([
    '',
    `........................................`,
    '',
    `........................................`,
    '',
    '',
    `........................................`,
  ]);
  sigRow.font = { bold: true };

  const namesRow = worksheet.addRow([
    '',
    committeeMembers?.taker ? `${committeeMembers.taker}\n(Leltárfelvevő)` : '(Leltárfelvevő)',
    '',
    committeeMembers?.inspector ? `${committeeMembers.inspector}\n(Leltárellenőr)` : '(Leltárellenőr)',
    '',
    '',
    committeeMembers?.approver ? `${committeeMembers.approver}\n(Felelős vezető)` : '(Felelős vezető)',
  ]);
  namesRow.font = { size: 9 };

  // Fájl mentése böngészőben
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeCompany = companyName.replace(/[^a-zA-Z0-9_-]/g, '_');
  a.download = `targyi_eszkoz_leltariv_${safeCompany}_${cutoffDate}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Számviteli törvény (Sztv. 69. §) szerinti Analitikus Leltárív generálása PDF dokumentumként (A4 Landscape).
 */
export function generateInventoryReportPdf(params: InventoryReportExportParams): jsPDF {
  const { companyName, companyTaxNumber, companyAddress, cutoffDate, items, committeeMembers } = params;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pw = doc.internal.pageSize.getWidth();  // 297 mm
  const ph = doc.internal.pageSize.getHeight(); // 210 mm
  const margin = 14;

  const primaryColor: [number, number, number] = [26, 43, 76];
  const darkColor: [number, number, number] = [33, 37, 41];
  const mutedColor: [number, number, number] = [108, 117, 125];

  let y = margin;

  // ── Fejléc ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...primaryColor);
  doc.text(hu('ANALITIKUS TÁRGYI ESZKÖZ LELTÁRÍV'), margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...mutedColor);
  doc.text(hu('A Számviteli Törvény (Sztv. 69. §) szerinti fordulónapi analitikus leltár'), margin, y + 4.5);

  // Jobb felső metaadatok
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...darkColor);
  doc.text(`${hu('Fordulónap')}: ${cutoffDate}`, pw - margin, y, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${hu('Készült')}: ${new Date().toISOString().split('T')[0]}`, pw - margin, y + 4.5, { align: 'right' });

  y += 9;
  doc.setDrawColor(218, 224, 233);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pw - margin, y);

  y += 5;

  // Céginformációk sor
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...primaryColor);
  doc.text(hu(`Munkáltató: ${companyName}`), margin, y);

  if (companyTaxNumber || companyAddress) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...mutedColor);
    const subText = [companyTaxNumber ? `Adószám: ${companyTaxNumber}` : '', companyAddress ? `Székhely: ${companyAddress}` : '']
      .filter(Boolean)
      .join(' | ');
    doc.text(hu(subText), margin, y + 3.8);
    y += 4;
  }

  y += 5;

  // ── Táblázat adatok előkészítése ──
  let totalGross = 0;
  let totalDepr = 0;
  let totalNet = 0;

  const tableBody = items.map((item, idx) => {
    const a = item.asset;
    const gross = Number(a.acquisition_value || 0);
    const depr = Number(a.accumulated_depreciation || 0);
    const net = Number(a.net_book_value ?? Math.max(0, gross - depr));

    totalGross += gross;
    totalDepr += depr;
    totalNet += net;

    const loc = item.physicalLocation || a.location?.name || '-';
    const subLoc = a.sub_location?.name || '-';
    const cust = item.physicalCustodian || formatCustodianName(a.custodian) || '-';
    const statusLabel = INVENTORY_STATUS_LABELS[item.checkStatus] || item.checkStatus;

    return [
      String(idx + 1),
      a.inventory_number,
      hu(a.name),
      a.activation_date || '-',
      `${gross.toLocaleString('hu-HU')} Ft`,
      `${depr.toLocaleString('hu-HU')} Ft`,
      `${net.toLocaleString('hu-HU')} Ft`,
      hu(loc),
      hu(subLoc),
      hu(cust),
      hu(statusLabel),
      hu(item.notes || ''),
    ];
  });

  // Összesítő sor hozzáadása
  tableBody.push([
    '',
    hu('ÖSSZESEN:'),
    `${items.length} db tétel`,
    '',
    `${totalGross.toLocaleString('hu-HU')} Ft`,
    `${totalDepr.toLocaleString('hu-HU')} Ft`,
    `${totalNet.toLocaleString('hu-HU')} Ft`,
    '',
    '',
    '',
    '',
    '',
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 1.5,
      textColor: darkColor,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
      2: { cellWidth: 46 },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 24, halign: 'right' },
      5: { cellWidth: 24, halign: 'right' },
      6: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
      7: { cellWidth: 22 },
      8: { cellWidth: 20 },
      9: { cellWidth: 22 },
      10: { cellWidth: 20, halign: 'center' },
      11: { cellWidth: 19 },
    },
    head: [[
      'Ssz.',
      hu('Leltári szám'),
      hu('Megnevezés'),
      hu('Aktiválás'),
      hu('Bruttó érték'),
      hu('Halmozott ÉCS'),
      hu('Nettó érték'),
      hu('Telephely'),
      hu('Tárolóhely'),
      hu('Felelős'),
      hu('Állapot'),
      hu('Megjegyzés'),
    ]],
    body: tableBody,
    didParseCell: (data) => {
      // Összesítő sor kiemelése
      if (data.row.index === tableBody.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [240, 244, 248];
      }
    },
  });

  // ── Aláírási záradék és nyilatkozat ──
  let finalY = (doc as any).lastAutoTable.finalY + 8;

  // Ha nem fér el az aláírás a lapon, nyitunk egy új lapot
  if (finalY > ph - 45) {
    doc.addPage();
    finalY = margin + 10;
  }

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(...mutedColor);
  doc.text(
    hu('A leltárfelvétel a valóságnak megfelelően történt. A leltározott eszközök a megjelölt telephelyeken és felelősök birtokában fellelésre kerültek.'),
    margin,
    finalY
  );

  finalY += 12;

  // 3 Aláírási doboz
  const sigWidth = 70;
  const colGap = (pw - margin * 2 - sigWidth * 3) / 2;

  const signers = [
    { title: 'Leltárfelvevő', name: committeeMembers?.taker || '' },
    { title: 'Leltárellenőr', name: committeeMembers?.inspector || '' },
    { title: 'Felelős vezető (Jóváhagyó)', name: committeeMembers?.approver || '' },
  ];

  signers.forEach((signer, idx) => {
    const x = margin + idx * (sigWidth + colGap);
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.4);
    doc.line(x, finalY + 10, x + sigWidth, finalY + 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...darkColor);
    doc.text(hu(signer.name || '........................................'), x + sigWidth / 2, finalY + 9, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...mutedColor);
    doc.text(hu(signer.title), x + sigWidth / 2, finalY + 14, { align: 'center' });
  });

  // ── Oldalszámozás láblécben ──
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      hu(`Analitikus Leltárív | ${companyName} | Fordulónap: ${cutoffDate} | Oldal: ${i} / ${totalPages}`),
      pw / 2,
      ph - 6,
      { align: 'center' }
    );
  }

  return doc;
}

export function generateInventoryReportPdfBlob(params: InventoryReportExportParams): Blob {
  return generateInventoryReportPdf(params).output('blob');
}

export function exportInventoryReportPdf(params: InventoryReportExportParams): void {
  const blob = generateInventoryReportPdfBlob(params);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeCompany = params.companyName.replace(/[^a-zA-Z0-9_-]/g, '_');
  a.download = `targyi_eszkoz_leltariv_${safeCompany}_${params.cutoffDate}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
