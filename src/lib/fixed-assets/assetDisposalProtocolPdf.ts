import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  normalizeHungarianForPdf,
  formatHungarianCurrency,
  formatHungarianDate,
} from '@/lib/documents/encoding/hungarianEncoding';
import type {
  DisposalCommittee,
  DisposalDetails,
  DisposalReasonType,
  DisposalStatus,
  DisposalWasteInfo,
} from '@/types/fixed-assets';

const hu = (text: string | null | undefined): string => normalizeHungarianForPdf(text || '');

export interface DisposalProtocolJournalLine {
  glNumber: string;
  dcType: 'T' | 'K';
  amount: number;
  description?: string;
}

export interface DisposalProtocolData {
  reasonType: DisposalReasonType;
  disposalStatus: DisposalStatus;

  companyName: string;
  companyAddress?: string;
  companyTaxNumber?: string;

  protocolNumber: string;
  /** A kivezetés (tervezett vagy tényleges) dátuma, ISO. */
  disposalDate: string;

  assetName: string;
  inventoryNumber: string;
  vtszTeszor?: string;
  activationDate?: string;
  locationNameAddress?: string;
  acquisitionValue: number;
  accumulatedDepreciation?: number;
  netBookValue?: number;

  /** Indoklás / műszaki ok. */
  reason?: string;
  committee?: DisposalCommittee | null;
  waste?: DisposalWasteInfo | null;
  details?: DisposalDetails | null;
  /** Dolgozó neve leltárhiány esetén (megjelenítéshez). */
  liableEmployeeName?: string;

  /** Jóváhagyás utáni könyvelési tételek (opcionális melléklet). */
  journalDocumentId?: string;
  journalLines?: DisposalProtocolJournalLine[];
}

export const DISPOSAL_PROTOCOL_TITLES: Record<DisposalReasonType, { title: string; footer: string }> = {
  sale: { title: 'ÉRTÉKESÍTÉSI KIVEZETÉSI JEGYZŐKÖNYV', footer: 'Értékesítési kivezetési jegyzőkönyv' },
  scrapping: { title: 'SELEJTEZÉSI JEGYZŐKÖNYV', footer: 'Selejtezési jegyzőkönyv' },
  inventory_shortage: { title: 'LELTÁRHIÁNY ÉS KÁRESET JEGYZŐKÖNYV', footer: 'Leltárhiány és káreset jegyzőkönyv' },
  donation: { title: 'TÉRÍTÉS NÉLKÜLI ÁTADÁS JEGYZŐKÖNYV', footer: 'Térítés nélküli átadás jegyzőkönyv' },
};

const STATUS_LABEL: Record<DisposalStatus, string> = {
  none: 'Nincs kezdeményezve',
  pending_approval: 'Jóváhagyásra vár',
  approved: 'Jóváhagyva és könyvelve',
  rejected: 'Elutasítva',
};

const dots = '.......................................................................';

export function generateAssetDisposalProtocolPdf(data: DisposalProtocolData): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pw - margin * 2;
  const titles = DISPOSAL_PROTOCOL_TITLES[data.reasonType];

  let y = 14;

  const lastY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  const ensureSpace = (needed: number) => {
    if (y > ph - needed) {
      doc.addPage();
      y = 16;
    }
  };

  // ── Gazdálkodó adatai ──
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
  y = lastY() + 8;

  // ── Cím ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(24, 43, 73);
  doc.text(hu('TÁRGYI ESZKÖZ KIVEZETÉS'), pw / 2, y, { align: 'center' });
  y += 6;
  doc.setFontSize(12);
  doc.text(hu(titles.title), pw / 2, y, { align: 'center' });
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(60, 60, 60);
  doc.text(hu(`Jegyzőkönyv sorszáma: ${data.protocolNumber}`), pw / 2, y, { align: 'center' });
  y += 5;
  doc.text(hu(`Állapot: ${STATUS_LABEL[data.disposalStatus]}`), pw / 2, y, { align: 'center' });
  y += 7;
  doc.text(hu(`Kivezetés dátuma: ${formatHungarianDate(data.disposalDate)}`), margin, y);
  y += 8;

  const renderSectionHeader = (title: string) => {
    ensureSpace(40);
    doc.setFillColor(240, 244, 248);
    doc.rect(margin, y, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 58, 95);
    doc.text(hu(title), margin + 3, y + 5);
    doc.setTextColor(0);
    y += 8;
  };

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
    y = lastY() + 6;
  };

  const renderParagraph = (text: string) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(40, 40, 40);
    const split = doc.splitTextToSize(hu(text), contentWidth) as string[];
    ensureSpace(split.length * 4 + 10);
    doc.text(split, margin, y);
    y += split.length * 4 + 4;
  };

  // ── 1. Az eszköz adatai ──
  renderSectionHeader('1. A TÁRGYI ESZKÖZ AZONOSÍTÓ ÉS ÉRTÉKADATAI');
  const valueRows: Array<[string, string]> = [
    ['Eszköz megnevezése:', data.assetName],
    ['Leltári szám:', data.inventoryNumber],
    ['VTSZ / besorolási szám:', data.vtszTeszor || '-'],
    ['Üzembe helyezés (aktiválás) dátuma:', data.activationDate ? formatHungarianDate(data.activationDate) : '-'],
    ['Telephely / használat helye:', data.locationNameAddress || '-'],
    ['Bruttó (bekerülési) érték (Ft):', formatHungarianCurrency(data.acquisitionValue)],
  ];
  if (data.accumulatedDepreciation !== undefined) {
    valueRows.push(['Halmozott értékcsökkenés a kivezetés napjáig (Ft):', formatHungarianCurrency(data.accumulatedDepreciation)]);
  }
  if (data.netBookValue !== undefined) {
    valueRows.push(['Könyv szerinti nettó érték (Ft):', formatHungarianCurrency(data.netBookValue)]);
  }
  renderSectionTable(valueRows);

  // ── 2. Jogcím-specifikus rész ──
  if (data.reasonType === 'scrapping') {
    renderSectionHeader('2. SELEJTEZÉSI BIZOTTSÁG ÉS MŰSZAKI INDOKLÁS');
    const members = data.committee?.members?.filter((m) => m.trim()) ?? [];
    renderSectionTable([
      ['Bizottság elnöke:', data.committee?.chair || dots],
      ['Bizottság tagjai:', members.length > 0 ? members.map((m, i) => `${i + 1}. ${m}`).join('\n') : `1. ${dots}\n2. ${dots}`],
      ['Műszaki indok (elavulás, gazdaságtalan javítás, törés…):', data.details?.technical_reason || data.reason || dots],
    ]);

    renderSectionHeader('3. HULLADÉKKEZELÉSI / VESZÉLYES HULLADÉK ÁTADÁSI ADATOK');
    renderSectionTable([
      ['Veszélyes hulladék:', data.waste?.hazardous ? 'Igen' : 'Nem'],
      ['Átvevő hulladékkezelő:', data.waste?.handler || dots],
      ['Hulladékkód (EWC):', data.waste?.waste_code || '-'],
      ['Átadás dátuma:', data.waste?.handover_date ? formatHungarianDate(data.waste.handover_date) : dots],
    ]);
  } else if (data.reasonType === 'inventory_shortage') {
    renderSectionHeader('2. LELTÁRHIÁNY, FELELŐSSÉGVIZSGÁLAT ÉS TÉRÍTÉSI KÖTELEZETTSÉG');
    renderSectionTable([
      ['A hiány megállapításának körülményei:', data.reason || dots],
      ['Felelős dolgozó:', data.liableEmployeeName || dots],
      [
        'Követelt kártérítés (Ft):',
        data.details?.compensation_amount ? formatHungarianCurrency(data.details.compensation_amount) : 'Nincs megállapított térítési kötelezettség',
      ],
      ['Megjegyzés:', data.details?.notes || '-'],
    ]);
  } else if (data.reasonType === 'sale') {
    renderSectionHeader('2. ÉRTÉKESÍTÉS ADATAI');
    renderSectionTable([
      ['Vevő megnevezése:', data.details?.buyer_name || dots],
      ['Nettó eladási ár (Ft):', data.details?.sale_value ? formatHungarianCurrency(data.details.sale_value) : '-'],
      ['Megjegyzés / indoklás:', data.reason || '-'],
    ]);
  } else {
    renderSectionHeader('2. TÉRÍTÉS NÉLKÜLI ÁTADÁS ADATAI');
    renderSectionTable([
      ['Átvevő megnevezése:', data.details?.recipient_name || dots],
      ['Átadás indoka:', data.reason || dots],
      ['Megjegyzés:', data.details?.notes || '-'],
    ]);
  }

  // ── Könyvelési tételek (csak jóváhagyás után) ──
  if (data.journalLines && data.journalLines.length > 0) {
    ensureSpace(60);
    renderSectionHeader(`KÖNYVELÉSI TÉTELEK${data.journalDocumentId ? ` (${data.journalDocumentId})` : ''}`);
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      tableWidth: contentWidth,
      head: [[hu('Főkönyvi szám'), hu('T/K'), hu('Összeg (Ft)'), hu('Megjegyzés')]],
      body: data.journalLines.map((l) => [l.glNumber, l.dcType, formatHungarianCurrency(l.amount), hu(l.description || '')]),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1.8 },
      headStyles: { fillColor: [30, 58, 95] },
      columnStyles: { 1: { halign: 'center', cellWidth: 14 }, 2: { halign: 'right', cellWidth: 36 } },
    });
    y = lastY() + 6;
  }

  // ── Nyilatkozat ──
  const declaration: Record<DisposalReasonType, string> = {
    sale: 'Alulírottak megerősítjük, hogy a fent megjelölt tárgyi eszköz értékesítése megtörtént, az eszköz birtoka a vevőre átszállt. A kivezetés könyvelése kizárólag a vezetői / könyvelői jóváhagyás után történik.',
    scrapping:
      'Alulírott bizottság megvizsgálta a fent megjelölt tárgyi eszközt, és megállapította, hogy az rendeltetésszerű használatra alkalmatlan, javítása gazdaságtalan, ezért a selejtezést javasolja. A kivezetés könyvelése kizárólag a vezetői / könyvelői jóváhagyás után történik.',
    inventory_shortage:
      'Alulírottak megállapítjuk, hogy a fent megjelölt tárgyi eszköz a leltározás során nem volt fellelhető. A felelősség megállapítását és a térítési kötelezettség rögzítését követően az eszköz kivezetése jóváhagyás után könyvelhető.',
    donation:
      'Alulírottak megerősítjük, hogy a fent megjelölt tárgyi eszköz térítés nélküli átadása megtörtént. A kivezetés könyvelése kizárólag a vezetői / könyvelői jóváhagyás után történik.',
  };
  renderSectionHeader('NYILATKOZAT');
  renderParagraph(declaration[data.reasonType]);

  // ── Aláírások ──
  ensureSpace(70);
  renderSectionHeader('ALÁÍRÁSOK');
  y += 12;

  const col1X = margin + 35;
  const col2X = margin + 125;

  const signatureRow = (left: [string, string], right: [string, string]) => {
    doc.setDrawColor(160, 160, 160);
    doc.line(col1X - 30, y, col1X + 30, y);
    doc.line(col2X - 30, y, col2X + 30, y);
    y += 4;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0);
    doc.text(hu(left[0]), col1X, y, { align: 'center' });
    doc.text(hu(right[0]), col2X, y, { align: 'center' });
    y += 3.5;
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text(hu(left[1]), col1X, y, { align: 'center' });
    doc.text(hu(right[1]), col2X, y, { align: 'center' });
    doc.setTextColor(0);
    y += 18;
  };

  if (data.reasonType === 'scrapping') {
    signatureRow(['Bizottság elnöke', '(dátum, aláírás)'], ['Bizottság tagja', '(dátum, aláírás)']);
  } else if (data.reasonType === 'inventory_shortage') {
    signatureRow(['Leltározó / kezdeményező', '(dátum, aláírás)'], ['Felelős dolgozó', '(tudomásulvétel, aláírás)']);
  } else {
    signatureRow(['Átadó (kezdeményező)', '(dátum, aláírás)'], ['Átvevő', '(dátum, aláírás)']);
  }
  signatureRow(['Vezetői jóváhagyás', '(dátum, aláírás)'], ['Könyvelői jóváhagyás', '(dátum, aláírás)']);

  // ── Lábléc ──
  const totalPages = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(150, 150, 150);
    doc.text(hu(`${titles.footer} | Sorszám: ${data.protocolNumber} | Oldal: ${i} / ${totalPages}`), pw / 2, ph - 8, {
      align: 'center',
    });
  }

  return doc;
}

export function generateAssetDisposalProtocolBlob(data: DisposalProtocolData): Blob {
  return generateAssetDisposalProtocolPdf(data).output('blob');
}

export function buildDisposalProtocolFileName(reasonType: DisposalReasonType, inventoryNumber: string): string {
  const safeInv = inventoryNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  const prefix: Record<DisposalReasonType, string> = {
    sale: 'ertekesitesi_jegyzokonyv',
    scrapping: 'selejtezesi_jegyzokonyv',
    inventory_shortage: 'leltarhiany_jegyzokonyv',
    donation: 'terites_nelkuli_atadas_jegyzokonyv',
  };
  return `${prefix[reasonType]}_${safeInv}.pdf`;
}
