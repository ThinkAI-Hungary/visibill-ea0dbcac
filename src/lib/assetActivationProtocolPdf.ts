import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { normalizeHungarianForPdf, formatHungarianCurrency, formatHungarianDate } from './documents/encoding/hungarianEncoding';

const hu = (text: string | null | undefined): string => normalizeHungarianForPdf(text || '');

export interface AssetProtocolData {
  // Cég adatok
  companyName: string;
  companyAddress?: string;
  companyTaxNumber?: string;

  // Jegyzőkönyv meta
  protocolNumber: string;
  protocolCity?: string;
  protocolDate: string; // YYYY.MM.DD.
  activatedByName: string;
  technicalReceiverName?: string;

  // 1. Azonosító adatok
  assetName: string;
  assetTypeManufacturer?: string;
  serialNumber?: string;
  vtszTeszor?: string;
  inventoryNumber: string;
  quantity?: number;
  locationNameAddress?: string;

  // 2. Beszerzési adatok
  supplierName?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  invoiceNetAmount?: number;
  receiptDate?: string;
  acquisitionSource?: string;

  // 3. Aktiválási adatok
  activationDate: string;
  acquisitionValue: number;
  incidentalCost?: number;
  nonDeductibleVat?: number;
  glAccountNumber?: string;
  glAccountName?: string;
  accountingVoucherNumber?: string;

  // 4. Értékcsökkenési adatok
  depreciationStartDate: string;
  depreciationMethodLabel: string;
  depreciationRateAnnual?: string;
  usefulLifeYears?: string;
  residualValue?: number;
  depreciationGlAccount?: string;
  taoRatePercent?: number;
}

export function generateAssetActivationProtocolPdf(data: AssetProtocolData): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth(); // 210
  const ph = doc.internal.pageSize.getHeight(); // 297
  const margin = 15;
  const contentWidth = pw - margin * 2; // 180

  let y = 14;

  // ── Fejléc Box: Gazdálkodó adatai ──
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    head: [],
    body: [
      [hu('Gazdálkodó (cég) neve:'), hu(data.companyName)],
      [hu('Székhelye:'), hu(data.companyAddress || '-')],
      [hu('Adószáma:'), hu(data.companyTaxNumber || '-')],
    ],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2, textColor: [40, 40, 40] },
    columnStyles: {
      0: { cellWidth: 55, fontStyle: 'bold', fillColor: [248, 249, 250] },
      1: { cellWidth: contentWidth - 55 },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // ── Cím & Jegyzőkönyv adatai ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(24, 43, 73);
  doc.text(hu('TÁRGYI ESZKÖZ'), pw / 2, y, { align: 'center' });
  y += 6;
  doc.setFontSize(12);
  doc.text(hu('ÜZEMBE HELYEZÉSI (AKTIVÁLÁSI) JEGYZŐKÖNYV'), pw / 2, y, { align: 'center' });
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(60, 60, 60);
  doc.text(hu(`Jegyzőkönyv sorszáma: ${data.protocolNumber}`), pw / 2, y, { align: 'center' });
  y += 7;

  const cityStr = data.protocolCity ? `${data.protocolCity}, ` : '';
  const dateFormatted = formatHungarianDate(data.protocolDate || data.activationDate);
  doc.text(hu(`Készült (hely, dátum): ${cityStr}${dateFormatted}`), margin, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.text(hu('Jelen vannak (név, beosztás):'), margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.text(hu(`1. ${data.activatedByName} (Aktiváló)`), margin, y);
  doc.text(hu(`2. ${data.technicalReceiverName || '.......................................................................'}`), margin + 85, y);
  y += 8;

  // Helper for section headers
  const renderSectionHeader = (title: string) => {
    doc.setFillColor(240, 244, 248);
    doc.rect(margin, y, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 58, 95);
    doc.text(hu(title), margin + 3, y + 5);
    doc.setTextColor(0);
    y += 8;
  };

  // Helper for table sections
  const renderSectionTable = (body: Array<[string, string]>) => {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      tableWidth: contentWidth,
      head: [],
      body: body.map(([k, v]) => [hu(k), hu(v)]),
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2, textColor: [30, 30, 30] },
      columnStyles: {
        0: { cellWidth: 70, fontStyle: 'bold', fillColor: [248, 249, 250] },
        1: { cellWidth: contentWidth - 70 },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  };

  // ── 1. A TÁRGYI ESZKÖZ AZONOSÍTÓ ADATAI ──
  renderSectionHeader('1. A TÁRGYI ESZKÖZ AZONOSÍTÓ ADATAI');
  renderSectionTable([
    ['Eszköz megnevezése:', data.assetName],
    ['Típusa, gyártója:', data.assetTypeManufacturer || '-'],
    ['Gyári szám / azonosító:', data.serialNumber || data.inventoryNumber],
    ['VTSZ / besorolási szám:', data.vtszTeszor || '-'],
    ['Leltári szám:', data.inventoryNumber],
    ['Mennyiség (db):', `${data.quantity || 1} db`],
    ['Üzembe helyezés / használat helye (költséghely):', data.locationNameAddress || '-'],
  ]);

  // ── 2. BESZERZÉSRE VONATKOZÓ ADATOK ──
  renderSectionHeader('2. BESZERZÉSRE VONATKOZÓ ADATOK');
  renderSectionTable([
    ['Szállító (kivitelező) megnevezése:', data.supplierName || '-'],
    ['Számla száma:', data.invoiceNumber || '-'],
    ['Számla kelte:', data.invoiceDate ? formatHungarianDate(data.invoiceDate) : '-'],
    ['Számla szerinti nettó érték (Ft):', data.invoiceNetAmount ? formatHungarianCurrency(data.invoiceNetAmount) : formatHungarianCurrency(data.acquisitionValue)],
    ['Átvétel (teljesítés) kelte:', data.receiptDate ? formatHungarianDate(data.receiptDate) : formatHungarianDate(data.invoiceDate || data.activationDate)],
    ['Beszerzés forrása (saját / hitel / pályázat):', data.acquisitionSource || 'Saját forrás'],
  ]);

  // Check page height - add new page if remaining height is low
  if (y > ph - 80) {
    doc.addPage();
    y = 16;
  }

  // ── 3. ÜZEMBE HELYEZÉSRE (AKTIVÁLÁSRA) VONATKOZÓ ADATOK ──
  renderSectionHeader('3. ÜZEMBE HELYEZÉSRE (AKTIVÁLÁSRA) VONATKOZÓ ADATOK');
  renderSectionTable([
    ['Üzembe helyezés (aktiválás) időpontja:', formatHungarianDate(data.activationDate)],
    ['Aktivált (bekerülési) bruttó érték (Ft):', formatHungarianCurrency(data.acquisitionValue)],
    ['Ebből járulékos költségek (szállítás, szerelés stb.) (Ft):', formatHungarianCurrency(data.incidentalCost || 0)],
    ['Le nem vonható áfa a bekerülési értékben (Ft):', formatHungarianCurrency(data.nonDeductibleVat || 0)],
    ['Eszköz főkönyvi száma:', data.glAccountNumber ? `${data.glAccountNumber} - ${data.glAccountName || ''}` : '-'],
    ['Könyvelési bizonylat száma:', data.accountingVoucherNumber || data.invoiceNumber || '-'],
  ]);

  if (y > ph - 80) {
    doc.addPage();
    y = 16;
  }

  // ── 4. TERV SZERINTI ÉRTÉKCSÖKKENÉS ADATAI ──
  renderSectionHeader('4. TERV SZERINTI ÉRTÉKCSÖKKENÉS ADATAI');
  renderSectionTable([
    ['Értékcsökkenési leírás kezdete:', formatHungarianDate(data.depreciationStartDate || data.activationDate)],
    ['Leírási mód:', data.depreciationMethodLabel],
    ['Leírási kulcs (% / év):', data.depreciationRateAnnual || '-'],
    ['Várható használati idő (év):', data.usefulLifeYears ? `${data.usefulLifeYears} év` : '-'],
    ['Maradványérték (Ft):', formatHungarianCurrency(data.residualValue || 0)],
    ['Értékcsökkenés főkönyvi száma:', data.depreciationGlAccount || '5711 - Tárgyi eszközök értékcsökkenési leírása'],
    ['Adótörvény szerinti écs-kulcs (%):', data.taoRatePercent ? `${data.taoRatePercent}%` : '-'],
  ]);

  if (y > ph - 90) {
    doc.addPage();
    y = 16;
  }

  // ── 5. NYILATKOZAT ──
  renderSectionHeader('5. NYILATKOZAT');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(40, 40, 40);
  const declarationText = 'Alulírottak kijelentjük, hogy a fent megjelölt tárgyi eszköz a rendeltetésszerű használatra alkalmas, az üzemszerű működés műszaki, technikai, jogi és hatósági feltételei biztosítottak, az eszközt a vállalkozási tevékenységhez ténylegesen használatba vettük. Az eszköz a mai nappal a beruházások (befejezetlen beruházás) számláról a tárgyi eszközök közé átvezetésre, aktiválásra kerül.';
  const splitDeclaration = doc.splitTextToSize(hu(declarationText), contentWidth);
  doc.text(splitDeclaration, margin, y);
  y += splitDeclaration.length * 4 + 4;

  // ── 6. MELLÉKLETEK ──
  renderSectionHeader('6. MELLÉKLETEK');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(hu('[X] Szállítói számla másolata     [  ] Átadás-átvételi jegyzőkönyv     [  ] Hatósági engedély(ek)'), margin, y);
  y += 5;
  doc.text(hu('[  ] Üzembe helyezési műszaki dokumentáció     [  ] Egyéb: ................................................................'), margin, y);
  y += 10;

  if (y > ph - 50) {
    doc.addPage();
    y = 16;
  }

  // ── 7. ALÁÍRÁSOK ──
  renderSectionHeader('7. ALÁÍRÁSOK');
  y += 12;

  const col1X = margin + 35;
  const col2X = margin + 125;

  // Row 1 Signatures
  doc.setDrawColor(160, 160, 160);
  doc.line(col1X - 30, y, col1X + 30, y);
  doc.line(col2X - 30, y, col2X + 30, y);
  y += 4;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(hu('Üzembe helyezést elrendelő'), col1X, y, { align: 'center' });
  doc.text(hu('Üzembe helyezésért felelős'), col2X, y, { align: 'center' });
  y += 3.5;
  doc.setFontSize(7.5);
  doc.setTextColor(120, 120, 120);
  doc.text(hu('(vezető) aláírása'), col1X, y, { align: 'center' });
  doc.text(hu('(műszaki átvevő) aláírása'), col2X, y, { align: 'center' });
  doc.setTextColor(0);
  y += 18;

  // Row 2 Signatures
  doc.line(col1X - 30, y, col1X + 30, y);
  doc.line(col2X - 30, y, col2X + 30, y);
  y += 4;
  doc.setFontSize(8);
  doc.text(hu('Könyvelés részére átvette'), col1X, y, { align: 'center' });
  doc.text(hu('Nyilvántartásba vette'), col2X, y, { align: 'center' });
  y += 3.5;
  doc.setFontSize(7.5);
  doc.setTextColor(120, 120, 120);
  doc.text(hu('(dátum, aláírás)'), col1X, y, { align: 'center' });
  doc.text(hu('(dátum, aláírás)'), col2X, y, { align: 'center' });
  doc.setTextColor(0);

  // Footer on all pages
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(150, 150, 150);
    doc.text(
      hu(`Tárgyi Eszköz Aktiválási Jegyzőkönyv | Sorszám: ${data.protocolNumber} | Oldal: ${i} / ${totalPages}`),
      pw / 2,
      ph - 8,
      { align: 'center' }
    );
  }

  return doc;
}

export function generateAssetActivationProtocolBlob(data: AssetProtocolData): Blob {
  const doc = generateAssetActivationProtocolPdf(data);
  return doc.output('blob');
}
