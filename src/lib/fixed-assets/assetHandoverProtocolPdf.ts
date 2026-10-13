import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  normalizeHungarianForPdf,
  formatHungarianCurrency,
  formatHungarianDate,
} from '@/lib/documents/encoding/hungarianEncoding';

const hu = (text: string | null | undefined): string => normalizeHungarianForPdf(text || '');

export interface AssetHandoverProtocolData {
  companyName: string;
  companyAddress?: string;
  companyTaxNumber?: string;

  protocolNumber: string;
  eventDate: string;

  // Asset details
  assetName: string;
  inventoryNumber: string;
  description?: string;
  vtszTeszor?: string;
  activationDate?: string;
  acquisitionValue?: number;

  // Transfer details
  oldLocationName?: string;
  newLocationName?: string;

  oldSubLocationName?: string;
  newSubLocationName?: string;

  oldCustodianName?: string;
  newCustodianName?: string;
  newCustodianEmail?: string;

  oldCostCenterName?: string;
  newCostCenterName?: string;

  projectName?: string;
  notes?: string;
}

export function generateAssetHandoverProtocolBlob(data: AssetHandoverProtocolData): Blob {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  const primaryColor: [number, number, number] = [26, 43, 76]; // deep navy
  const darkColor: [number, number, number] = [33, 37, 41];
  const mutedColor: [number, number, number] = [108, 117, 125];
  const tableHeaderBg: [number, number, number] = [240, 243, 248];

  let y = margin;

  // ── 1. Fejléc / Header ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...primaryColor);
  doc.text(hu('ESZKÖZ ÁTADÁS-ÁTVÉTELI ÉS FELELŐSŐRZÉSI NYILATKOZAT'), margin, y);

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...mutedColor);
  doc.text('FIXED ASSET HANDOVER & CUSTODY TRANSFER PROTOCOL', margin, y);

  // Jobb felső bizonylatszám doboz
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...primaryColor);
  const protocolText = `${hu('Iktatószám / No.')}: ${hu(data.protocolNumber)}`;
  doc.text(protocolText, pageWidth - margin, y - 5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...mutedColor);
  const dateFormatted = data.eventDate ? formatHungarianDate(data.eventDate) : '-';
  doc.text(`${hu('Kelt / Date')}: ${dateFormatted}`, pageWidth - margin, y, { align: 'right' });

  y += 8;
  doc.setDrawColor(218, 224, 233);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);

  y += 6;

  // ── 2. Cégadatok / Company Details ──
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.5, textColor: darkColor },
    body: [
      [
        { content: `${hu('Munkáltató / Átadó Cég (Company)')}:`, styles: { fontStyle: 'bold', cellWidth: 60 } },
        hu(data.companyName),
      ],
      [
        { content: `${hu('Székhely / Cím (Address)')}:`, styles: { fontStyle: 'bold' } },
        hu(data.companyAddress || '-'),
      ],
      [
        { content: `${hu('Adószám (Tax ID)')}:`, styles: { fontStyle: 'bold' } },
        hu(data.companyTaxNumber || '-'),
      ],
    ],
  });

  y = (doc as any).lastAutoTable.finalY + 4;

  // ── 3. Vagyontárgy adatai / Asset Details ──
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2, textColor: darkColor },
    headStyles: { fillColor: tableHeaderBg, textColor: primaryColor, fontStyle: 'bold' },
    head: [[{ content: hu('I. VAGYONTÁRGY ADATAI / ASSET PARTICULARS'), colSpan: 2 }]],
    body: [
      [
        { content: `${hu('Eszköz megnevezése / Asset Name')}:`, styles: { fontStyle: 'bold', cellWidth: 55 } },
        hu(data.assetName),
      ],
      [
        { content: `${hu('Leltári szám / Inventory Number')}:`, styles: { fontStyle: 'bold' } },
        hu(data.inventoryNumber),
      ],
      [
        { content: `${hu('Leírás / Típus (Description / Type)')}:`, styles: { fontStyle: 'bold' } },
        hu(data.description || '-'),
      ],
      [
        { content: `${hu('VTSZ / TESZOR kód')}:`, styles: { fontStyle: 'bold' } },
        hu(data.vtszTeszor || '-'),
      ],
      [
        { content: `${hu('Bekerülési bruttó érték / Acq. Value')}:`, styles: { fontStyle: 'bold' } },
        data.acquisitionValue != null ? formatHungarianCurrency(data.acquisitionValue) : '-',
      ],
      [
        { content: `${hu('Üzembe helyezés / Activation Date')}:`, styles: { fontStyle: 'bold' } },
        data.activationDate ? formatHungarianDate(data.activationDate) : '-',
      ],
    ],
  });

  y = (doc as any).lastAutoTable.finalY + 4;

  // ── 4. Átadási adatok / Transfer Details ──
  const transferRows: Array<[string, string, string]> = [];

  // Felelős személy
  if (data.newCustodianName || data.oldCustodianName) {
    transferRows.push([
      hu('Felelős munkavállaló / Custodian'),
      hu(data.oldCustodianName || 'Nincs kijelölve / None'),
      hu(data.newCustodianName || 'Nincs kijelölve / None'),
    ]);
  }

  // Telephely
  if (data.newLocationName || data.oldLocationName) {
    transferRows.push([
      hu('Telephely / Location'),
      hu(data.oldLocationName || '-'),
      hu(data.newLocationName || '-'),
    ]);
  }

  // Rész-helyszín / Tárolóhely
  if (data.newSubLocationName || data.oldSubLocationName) {
    transferRows.push([
      hu('Tárolóhely / Sub-Location / Room'),
      hu(data.oldSubLocationName || '-'),
      hu(data.newSubLocationName || '-'),
    ]);
  }

  // Költséghely
  if (data.newCostCenterName || data.oldCostCenterName) {
    transferRows.push([
      hu('Költséghely / Cost Center'),
      hu(data.oldCostCenterName || '-'),
      hu(data.newCostCenterName || '-'),
    ]);
  }

  if (transferRows.length === 0) {
    transferRows.push([
      hu('Áthelyezés / Transfer'),
      hu(data.oldLocationName || '-'),
      hu(data.newLocationName || '-'),
    ]);
  }

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2, textColor: darkColor },
    headStyles: { fillColor: tableHeaderBg, textColor: primaryColor, fontStyle: 'bold' },
    head: [
      [
        { content: hu('II. ÁTHELYEZÉS ÉS FELELŐSVÁLTÁS ADATAI / TRANSFER DETAILS'), colSpan: 3 },
      ],
      [
        hu('Megnevezés / Attribute'),
        hu('Korábbi állapot / Previous (Átadó)'),
        hu('Új állapot / New (Átvevő)'),
      ],
    ],
    body: transferRows,
  });

  y = (doc as any).lastAutoTable.finalY + 3;

  if (data.notes) {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.5, textColor: darkColor },
      body: [
        [
          { content: `${hu('Áthelyezés oka / Indoklás (Notes)')}:`, styles: { fontStyle: 'bold', cellWidth: 55 } },
          hu(data.notes),
        ],
      ],
    });
    y = (doc as any).lastAutoTable.finalY + 3;
  }

  // ── 5. Kétnyelvű Jogi és Felelősségi Záradék / Legal Clause ──
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 1.5, textColor: darkColor },
    headStyles: { fillColor: tableHeaderBg, textColor: primaryColor, fontStyle: 'bold', fontSize: 8 },
    head: [[hu('III. NYILATKOZAT ÉS FELELŐSŐRZÉSI KÖTELEZETTSÉGVÁLLALÁS / DECLARATION')]],
    body: [
      [
        hu(
          '1. Alulírott Átvevő a mai napon a fent megjelölt tárgyi eszközt rendeltetésszerű használatra alkalmas, ' +
          'működőképes állapotban, tartozékaival felelős őrzésre és személyes használatra átvettem.\n' +
          '2. Kijelentem, hogy az eszközt kizárólag munkaköri feladataim ellátása érdekében használom, megóvásáért ' +
          'anyagi és fegyelmi felelősséggel tartozom (Mt. 179. § szerinti megőrzési felelősség). Bármilyen rendellenességet, ' +
          'hibát, meghibásodást vagy sérülést a munkáltatónak haladéktalanul bejelentek.\n' +
          '3. Munkaviszonyom megszűnésekor, vagy a munkáltató első felhívására a munkaeszközt haladéktalanul, ' +
          'hiánytalanul az Átadó részére visszaszolgáltatom.'
        ),
      ],
      [
        '1. I, the undersigned Recipient, hereby declare having received the above asset today in good working and serviceable condition for custody and official use.\n' +
        '2. I agree to exercise due care, safeguard the asset, and assume full custody responsibility in accordance with applicable labor regulations. Any damage or technical defect will be reported immediately.\n' +
        '3. Upon termination of employment or the employer\'s first demand, I will immediately return the asset in complete condition.',
      ],
    ],
  });

  y = (doc as any).lastAutoTable.finalY + 12;

  // Ha kifutnánk az oldalról az aláírásokkal, új oldal
  if (y + 35 > pageHeight) {
    doc.addPage();
    y = margin + 15;
  }

  // ── 6. Aláírási blokk / Signatures ──
  const colWidth = contentWidth / 3;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...mutedColor);

  // Átadó
  doc.line(margin, y, margin + colWidth - 8, y);
  doc.text(hu('Átadó / Handed Over By'), margin + (colWidth - 8) / 2, y + 4, { align: 'center' });
  doc.text(hu(data.oldCustodianName || data.companyName), margin + (colWidth - 8) / 2, y + 8, { align: 'center' });

  // Átvevő
  const col2X = margin + colWidth;
  doc.line(col2X, y, col2X + colWidth - 8, y);
  doc.text(hu('Átvevő / Received By'), col2X + (colWidth - 8) / 2, y + 4, { align: 'center' });
  doc.text(hu(data.newCustodianName || 'Új Felelős / New Custodian'), col2X + (colWidth - 8) / 2, y + 8, { align: 'center' });

  // Cégvezető / Képviselő
  const col3X = margin + colWidth * 2;
  doc.line(col3X, y, col3X + colWidth - 8, y);
  doc.text(hu('Munkáltató képviseletében / Approved By'), col3X + (colWidth - 8) / 2, y + 4, { align: 'center' });
  doc.text(hu('Cégvezetés / Management'), col3X + (colWidth - 8) / 2, y + 8, { align: 'center' });

  // ── Lábléc / Footer ──
  doc.setFontSize(7);
  doc.setTextColor(...mutedColor);
  doc.text(
    hu(`VisiBill TÉNY Rendszer – ${data.protocolNumber} – 1 / 1 oldal`),
    pageWidth / 2,
    pageHeight - 6,
    { align: 'center' }
  );

  return doc.output('blob');
}

export function downloadAssetHandoverProtocolPdf(data: AssetHandoverProtocolData, customFilename?: string): void {
  const blob = generateAssetHandoverProtocolBlob(data);
  const cleanInv = data.inventoryNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStamp = data.eventDate || new Date().toISOString().split('T')[0];
  const filename = customFilename || `atadas_atveteli_nyilatkozat_${cleanInv}_${dateStamp}.pdf`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
