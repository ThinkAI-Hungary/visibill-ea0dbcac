import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { normalizeHungarianForPdf, formatHungarianCurrency, formatHungarianDate } from './documents/encoding/hungarianEncoding';

const hu = (text: string | null | undefined): string => normalizeHungarianForPdf(text || '');

export interface GlAccountCardPdfData {
  companyName: string;
  companyTaxNumber?: string;
  companyAddress?: string;
  glNumber: string;
  glShortName: string;
  dateFrom: string;
  dateTo: string;
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  items: Array<{
    posting_date: string;
    document_date?: string;
    document_id: string;
    journal_code: string;
    contra_gl_number: string;
    contra_gl_name?: string;
    partner_name?: string;
    description: string;
    debit_amount: number;
    credit_amount: number;
    running_balance: number;
  }>;
}

export interface BalanceConfirmationPdfData {
  companyName: string;
  companyAddress?: string;
  companyTaxNumber?: string;
  partnerName: string;
  partnerAddress?: string;
  partnerTaxNumber?: string;
  statementDate: string;
  totalOpenBalance: number;
  invoices: Array<{
    document_id: string;
    issue_date: string;
    due_date: string;
    original_amount: number;
    open_amount: number;
    overdue_days: number;
  }>;
}

// ── 1. Főkönyvi Karton PDF Generálás ─────────────────────────────────────────
export function generateGlAccountCardPdf(data: GlAccountCardPdfData): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' }); // Landscape format for 9 columns
  const pw = doc.internal.pageSize.getWidth(); // 297
  const ph = doc.internal.pageSize.getHeight(); // 210
  const margin = 12;
  const contentWidth = pw - margin * 2; // 273

  let y = 12;

  // Header Bar
  doc.setFillColor(24, 43, 73);
  doc.rect(0, 0, pw, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(hu(`FŐKÖNYVI KARTON — ${data.glNumber} ${data.glShortName}`), margin, 11);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(hu(data.companyName), margin, 17);
  doc.text(hu(`Időszak: ${formatHungarianDate(data.dateFrom)} – ${formatHungarianDate(data.dateTo)}`), pw - margin, 11, { align: 'right' });
  doc.text(hu(`Generálva: ${new Date().toLocaleString('hu-HU')}`), pw - margin, 17, { align: 'right' });
  doc.setTextColor(0);

  y = 28;

  // Summary Banner Cards
  const cardW = (contentWidth - 12) / 4; // 4 cards
  const fmt = (n: number) => formatHungarianCurrency(n);

  const cards = [
    { label: 'Nyitó egyenleg', val: fmt(data.openingBalance), bg: [241, 245, 249], fg: [51, 65, 85] },
    { label: 'Időszaki Tartozik (T)', val: fmt(data.totalDebit), bg: [254, 243, 199], fg: [180, 83, 9] },
    { label: 'Időszaki Követel (K)', val: fmt(data.totalCredit), bg: [224, 242, 254], fg: [3, 105, 161] },
    { label: 'Záró egyenleg', val: fmt(data.closingBalance), bg: [220, 252, 231], fg: [21, 128, 61] },
  ];

  cards.forEach((c, i) => {
    const cx = margin + i * (cardW + 4);
    doc.setFillColor(c.bg[0], c.bg[1], c.bg[2]);
    doc.roundedRect(cx, y, cardW, 14, 2, 2, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(hu(c.label), cx + 4, y + 5);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(c.fg[0], c.fg[1], c.fg[2]);
    doc.text(hu(c.val), cx + 4, y + 11);
  });

  y += 18;

  // Detailed Table
  const bodyRows = data.items.map(item => [
    formatHungarianDate(item.posting_date),
    hu(item.document_id),
    hu(item.journal_code),
    hu(item.contra_gl_number),
    hu(item.partner_name || '-'),
    hu(item.description),
    item.debit_amount > 0 ? formatHungarianCurrency(item.debit_amount) : '-',
    item.credit_amount > 0 ? formatHungarianCurrency(item.credit_amount) : '-',
    formatHungarianCurrency(item.running_balance),
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    head: [[
      hu('Dátum'), hu('Bizonylatszám'), hu('Napló'), hu('Ellenszámla'), hu('Partner'), hu('Megjegyzés / Szöveg'), hu('Tartozik (Ft)'), hu('Követel (Ft)'), hu('Göngyölt egyenleg')
    ]],
    body: bodyRows,
    theme: 'grid',
    headStyles: { fillColor: [24, 43, 73], textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, cellPadding: 1.5 },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 32, fontStyle: 'bold' },
      2: { cellWidth: 14, halign: 'center' },
      3: { cellWidth: 24, fontStyle: 'bold' },
      4: { cellWidth: 38 },
      5: { cellWidth: 65 },
      6: { cellWidth: 26, halign: 'right' },
      7: { cellWidth: 26, halign: 'right' },
      8: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (d) => {
      if (d.section === 'body' && d.row.raw[1] === 'NYITÓ') {
        d.cell.styles.fillColor = [241, 245, 249];
        d.cell.styles.fontStyle = 'bold';
      }
    },
  });

  // Footer on all pages
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(150);
    doc.text(
      hu(`Főkönyvi Karton | Számla: ${data.glNumber} | Oldal: ${i} / ${totalPages} | Számviteli törvény (2000. évi C. tv.) szerinti nyilvántartás`),
      pw / 2,
      ph - 6,
      { align: 'center' }
    );
  }

  return doc;
}

// ── 2. Egyenlegközlő Levél PDF Generálás ────────────────────────────────────
export function generateBalanceConfirmationPdf(data: BalanceConfirmationPdfData): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' }); // Portrait
  const pw = doc.internal.pageSize.getWidth(); // 210
  const ph = doc.internal.pageSize.getHeight(); // 297
  const margin = 15;
  const contentWidth = pw - margin * 2; // 180

  let y = 16;

  // Company Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30, 58, 95);
  doc.text(hu(data.companyName), margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80);
  if (data.companyAddress) { doc.text(hu(`Székhely: ${data.companyAddress}`), margin, y); y += 4; }
  if (data.companyTaxNumber) { doc.text(hu(`Adószám: ${data.companyTaxNumber}`), margin, y); y += 4; }
  y += 6;

  // Title Box
  doc.setFillColor(240, 244, 248);
  doc.rect(margin, y, contentWidth, 14, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(24, 43, 73);
  doc.text(hu('EGYENLEGKÖZLŐ LEVÉL'), pw / 2, y + 9, { align: 'center' });
  y += 20;

  // Partner Box
  doc.setDrawColor(200);
  doc.roundedRect(margin, y, contentWidth, 24, 2, 2, 'S');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text(hu('Címzett (Partner adatai):'), margin + 4, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(hu(data.partnerName), margin + 4, y + 12);
  if (data.partnerAddress) doc.text(hu(`Cím: ${data.partnerAddress}`), margin + 4, y + 17);
  if (data.partnerTaxNumber) doc.text(hu(`Adószám: ${data.partnerTaxNumber}`), margin + 95, y + 17);
  y += 30;

  // Introductory Text
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(hu(`Tisztelt Partnerünk!`), margin, y);
  y += 5;
  const intro = `Tájékoztatjuk, hogy nyilvántartásunk szerint ${formatHungarianDate(data.statementDate)} fordulónappal cégünknél az alábbi nyitott számlák és egyenlegek szerepelnek az Önök felé:`;
  const splitIntro = doc.splitTextToSize(hu(intro), contentWidth);
  doc.text(splitIntro, margin, y);
  y += splitIntro.length * 4.5 + 4;

  // Open Items Table
  const tableRows = data.invoices.map(inv => [
    hu(inv.document_id),
    formatHungarianDate(inv.issue_date),
    formatHungarianDate(inv.due_date),
    formatHungarianCurrency(inv.original_amount),
    formatHungarianCurrency(inv.open_amount),
    inv.overdue_days > 0 ? hu(`${inv.overdue_days} nap`) : hu('Lejáraton belüli'),
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    head: [[hu('Bizonylatszám'), hu('Kelt'), hu('Esedékesség'), hu('Eredeti bruttó (Ft)'), hu('Nyitott egyenleg (Ft)'), hu('Lejárat')]],
    body: tableRows,
    foot: [[hu('Összesen nyitott egyenleg:'), '', '', '', formatHungarianCurrency(data.totalOpenBalance), '']],
    theme: 'grid',
    headStyles: { fillColor: [24, 43, 73], textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8.5 },
    footStyles: { fillColor: [240, 244, 248], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 9.5 },
    columnStyles: {
      3: { halign: 'right' },
      4: { halign: 'right', fontStyle: 'bold' },
      5: { halign: 'center' },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // Confirmation Response Block
  doc.setDrawColor(180);
  doc.roundedRect(margin, y, contentWidth, 38, 2, 2, 'S');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(hu('PARTNER VISSZAIGAZOLÁSA:'), margin + 4, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(hu('[  ] A fenti egyenleget elfogadom, a nyilvántartásunkkal megegyezik.'), margin + 4, y + 13);
  doc.text(hu('[  ] A fenti egyenleggel nem értek egyet. Az eltérés oka: ................................................................'), margin + 4, y + 20);

  doc.line(margin + 10, y + 32, margin + 70, y + 32);
  doc.line(margin + 110, y + 32, margin + 170, y + 32);
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(hu('Dátum'), margin + 40, y + 35, { align: 'center' });
  doc.text(hu('Cégszerű aláírás, bélyegző'), margin + 140, y + 35, { align: 'center' });

  // Footer
  doc.setFontSize(7.5);
  doc.setTextColor(150);
  doc.text(hu(`Egyenlegközlő levél | ${data.companyName} | Kérjük, az aláírt igazolást 8 napon belül visszaküldeni szíveskedjenek.`), pw / 2, ph - 8, { align: 'center' });

  return doc;
}
