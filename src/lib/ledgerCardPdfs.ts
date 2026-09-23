import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { normalizeHungarianForPdf, formatHungarianCurrency, formatHungarianNumber, formatHungarianDate } from './documents/encoding/hungarianEncoding';

const hu = (text: string | null | undefined): string => normalizeHungarianForPdf(text || '');
const formatFx = (amount: number, curr: string): string => `${formatHungarianNumber(amount, 2)} ${curr}`;

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
  hasForeignCurrency?: boolean;
  foreignCurrency?: string;
  foreignOpeningBalance?: number;
  totalForeignDebit?: number;
  totalForeignCredit?: number;
  foreignClosingBalance?: number;
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
    foreign_amount?: number | null;
    foreign_currency?: string | null;
    foreign_running_balance?: number | null;
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
  currencySummaries?: Array<{ currency: string; openBalance: number }>;
  invoices: Array<{
    document_id: string;
    issue_date: string;
    due_date: string;
    original_amount: number;
    open_amount: number;
    overdue_days: number;
    foreign_amount?: number | null;
    currency?: string | null;
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
  const cardH = data.hasForeignCurrency ? 18 : 14;

  const cards = [
    { 
      label: 'Nyitó egyenleg', 
      val: fmt(data.openingBalance), 
      fx: (data.hasForeignCurrency && data.foreignOpeningBalance != null && data.foreignOpeningBalance !== 0) 
        ? `(${formatFx(data.foreignOpeningBalance, data.foreignCurrency || 'EUR')})` 
        : null,
      bg: [241, 245, 249], 
      fg: [51, 65, 85] 
    },
    { 
      label: 'Időszaki Tartozik (T)', 
      val: fmt(data.totalDebit), 
      fx: (data.hasForeignCurrency && data.totalForeignDebit != null && data.totalForeignDebit > 0)
        ? `(+${formatFx(data.totalForeignDebit, data.foreignCurrency || 'EUR')})`
        : null,
      bg: [254, 243, 199], 
      fg: [180, 83, 9] 
    },
    { 
      label: 'Időszaki Követel (K)', 
      val: fmt(data.totalCredit), 
      fx: (data.hasForeignCurrency && data.totalForeignCredit != null && data.totalForeignCredit > 0)
        ? `(-${formatFx(data.totalForeignCredit, data.foreignCurrency || 'EUR')})`
        : null,
      bg: [224, 242, 254], 
      fg: [3, 105, 161] 
    },
    { 
      label: 'Záró egyenleg', 
      val: fmt(data.closingBalance), 
      fx: (data.hasForeignCurrency && data.foreignClosingBalance != null)
        ? `(${formatFx(data.foreignClosingBalance, data.foreignCurrency || 'EUR')})`
        : null,
      bg: [220, 252, 231], 
      fg: [21, 128, 61] 
    },
  ];

  cards.forEach((c, i) => {
    const cx = margin + i * (cardW + 4);
    doc.setFillColor(c.bg[0], c.bg[1], c.bg[2]);
    doc.roundedRect(cx, y, cardW, cardH, 2, 2, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(hu(c.label), cx + 4, y + 4.5);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(c.fg[0], c.fg[1], c.fg[2]);
    doc.text(hu(c.val), cx + 4, y + 10);
    if (c.fx) {
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(c.fg[0], c.fg[1], c.fg[2]);
      doc.text(hu(c.fx), cx + 4, y + 15);
    }
  });

  y += cardH + 4;

  // Detailed Table
  const bodyRows = data.items.map(item => {
    const hasItemFx = item.foreign_amount != null && item.foreign_currency && item.foreign_currency !== 'HUF';
    const deb = item.debit_amount > 0 
      ? (hasItemFx ? `${formatHungarianCurrency(item.debit_amount)}\n(+${formatFx(Number(item.foreign_amount), item.foreign_currency!)})` : formatHungarianCurrency(item.debit_amount))
      : '-';
    const cred = item.credit_amount > 0 
      ? (hasItemFx ? `${formatHungarianCurrency(item.credit_amount)}\n(-${formatFx(Number(item.foreign_amount), item.foreign_currency!)})` : formatHungarianCurrency(item.credit_amount))
      : '-';
    const run = item.foreign_running_balance != null && data.hasForeignCurrency
      ? `${formatHungarianCurrency(item.running_balance)}\n(${formatFx(Number(item.foreign_running_balance), data.foreignCurrency || 'EUR')})`
      : formatHungarianCurrency(item.running_balance);

    return [
      formatHungarianDate(item.posting_date),
      hu(item.document_id),
      hu(item.journal_code),
      hu(item.contra_gl_number),
      hu(item.partner_name || '-'),
      hu(item.description),
      deb,
      cred,
      run,
    ];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    head: [[
      hu('Dátum'), hu('Bizonylatszám'), hu('Napló'), hu('Ellenszámla'), hu('Partner'), hu('Megjegyzés / Szöveg'), hu('Tartozik'), hu('Követel'), hu('Göngyölt egyenleg')
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
  const tableRows = data.invoices.map(inv => {
    const hasFx = inv.foreign_amount != null && inv.currency && inv.currency !== 'HUF';
    const origStr = hasFx 
      ? `${formatHungarianCurrency(inv.original_amount)}\n(${formatFx(Number(inv.foreign_amount), inv.currency!)})`
      : formatHungarianCurrency(inv.original_amount);
    const openStr = hasFx 
      ? `${formatHungarianCurrency(inv.open_amount)}\n(${formatFx(Number(inv.foreign_amount), inv.currency!)})`
      : formatHungarianCurrency(inv.open_amount);

    return [
      hu(inv.document_id),
      formatHungarianDate(inv.issue_date),
      formatHungarianDate(inv.due_date),
      origStr,
      openStr,
      inv.overdue_days > 0 ? hu(`${inv.overdue_days} nap`) : hu('Lejáraton belüli'),
    ];
  });

  const fxFootList = (data.currencySummaries || [])
    .filter(s => s.currency !== 'HUF' && s.openBalance !== 0)
    .map(s => `${formatFx(s.openBalance, s.currency)}`)
    .join(', ');

  const footOpenStr = fxFootList 
    ? `${formatHungarianCurrency(data.totalOpenBalance)}\n(${fxFootList})`
    : formatHungarianCurrency(data.totalOpenBalance);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    head: [[hu('Bizonylatszám'), hu('Kelt'), hu('Esedékesség'), hu('Eredeti bruttó'), hu('Nyitott egyenleg'), hu('Lejárat')]],
    body: tableRows,
    foot: [[hu('Összesen nyitott egyenleg:'), '', '', '', footOpenStr, '']],
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
