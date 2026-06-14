/**
 * Document-specific PDF generators for each Accounty output document type.
 * Each generator creates a professional, realistic document PDF.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/** jsPDF Helvetica only supports Latin-1. Hungarian ő/ű are Latin-2. */
function hu(text: string): string {
  return text.replace(/ő/g, 'ö').replace(/Ő/g, 'Ö').replace(/ű/g, 'ü').replace(/Ű/g, 'Ü');
}

const fmt = (n: number) => n.toLocaleString('hu-HU');

interface DocContext {
  companyName: string;
  period: string;
  calculations: {
    gross_salary: number;
    net_salary: number;
    szja_amount: number;
    tb_amount: number;
    szocho_amount: number;
    total_deductions: number;
    cafeteria_tax: any;
    metadata: any;
  }[];
}

function addDocHeader(doc: jsPDF, title: string, companyName: string, period: string, color: [number, number, number]) {
  const pw = doc.internal.pageSize.getWidth();
  // Header bar
  doc.setFillColor(color[0], color[1], color[2]);
  doc.rect(0, 0, pw, 36, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(hu(title), 16, 16);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(hu(companyName), 16, 24);
  doc.text(hu(`Időszak: ${period}`), pw - 16, 16, { align: 'right' });
  doc.text(hu(`Generálva: ${new Date().toLocaleDateString('hu-HU')}`), pw - 16, 24, { align: 'right' });
  doc.setTextColor(0, 0, 0);
}

function addFooter(doc: jsPDF, title: string) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  doc.setDrawColor(200, 200, 200);
  doc.line(16, ph - 16, pw - 16, ph - 16);
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(hu(`${title} | Generálva: ${new Date().toLocaleString('hu-HU')}`), pw / 2, ph - 10, { align: 'center' });
  doc.setTextColor(0);
}

function addSignatureBlock(doc: jsPDF, y: number) {
  const pw = doc.internal.pageSize.getWidth();
  const sigY = Math.min(y + 20, doc.internal.pageSize.getHeight() - 40);

  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(16, sigY, 80, sigY);
  doc.line(pw - 80, sigY, pw - 16, sigY);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text(hu('Munkáltató aláírása, bélyegző'), 48, sigY + 5, { align: 'center' });
  doc.text(hu('Keltezés'), pw - 48, sigY + 5, { align: 'center' });

  // P.H. circle
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.5);
  doc.circle(48, sigY - 12, 8, 'S');
  doc.setFontSize(7);
  doc.text('P.H.', 48, sigY - 11, { align: 'center' });
  doc.setTextColor(0);
}

// ─── INCOME CERTIFICATE ──────────────────────────────────────────────
export function generateCertificatePdf(ctx: DocContext, employeeIndex: number): string {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const calc = ctx.calculations[employeeIndex] || ctx.calculations[0];
  if (!calc) return doc.output('bloburl').toString();

  const meta = calc.metadata as any;
  const empName = meta?.employee_name || 'Ismeretlen';

  addDocHeader(doc, 'Jövedelemigazolás', ctx.companyName, ctx.period, [22, 163, 74]); // green

  let y = 46;

  // Title
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(hu('JÖVEDELEMIGAZOLÁS'), pw / 2, y, { align: 'center' });
  y += 10;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(hu('Alulírott munkáltató igazolom, hogy az alábbi munkavállaló cégünknél munkaviszonyban áll,'), pw / 2, y, { align: 'center' });
  y += 5;
  doc.text(hu('és jövedelme a következők szerint alakult:'), pw / 2, y, { align: 'center' });
  y += 12;

  // Employee info section
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(16, y, pw - 32, 30, 3, 3, 'F');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 95);
  doc.text(hu('Munkavállaló adatai'), 22, y + 8);
  doc.setTextColor(0);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const infoLeft = [
    { label: 'Név:', value: empName },
    { label: 'Azonosító:', value: meta?.employee_id || '–' },
  ];
  const infoRight = [
    { label: 'Munkakör:', value: meta?.position || 'Alkalmazott' },
    { label: 'Belépés:', value: meta?.start_date || '–' },
  ];

  infoLeft.forEach((item, i) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(hu(item.label), 22, y + 16 + i * 6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text(hu(item.value), 55, y + 16 + i * 6);
  });
  infoRight.forEach((item, i) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(hu(item.label), pw / 2 + 10, y + 16 + i * 6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text(hu(item.value), pw / 2 + 45, y + 16 + i * 6);
  });
  y += 38;

  // Income table
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 95);
  doc.text(hu('Jövedelemadatok'), 16, y);
  doc.setTextColor(0);
  y += 3;

  autoTable(doc, {
    startY: y,
    head: [[hu('Jogcím'), hu('Összeg (Ft)')]],
    body: [
      [hu('Havi bruttó munkabér'), fmt(calc.gross_salary || 0)],
      [hu('SZJA (15%)'), `– ${fmt(calc.szja_amount || 0)}`],
      [hu('TB járulék (18,5%)'), `– ${fmt(calc.tb_amount || 0)}`],
      [hu('Egyéb levonások'), `– ${fmt(calc.total_deductions || 0)}`],
      [hu('Havi nettó jövedelem'), fmt(calc.net_salary || 0)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [22, 163, 74], textColor: 255, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: 16, right: 16 },
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index === 4) {
        data.cell.styles.fillColor = [220, 252, 231];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Annual estimate
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(hu(`Becsült éves bruttó jövedelem: ${fmt((calc.gross_salary || 0) * 12)} Ft`), 16, y);
  y += 5;
  doc.text(hu(`Becsült éves nettó jövedelem: ${fmt((calc.net_salary || 0) * 12)} Ft`), 16, y);
  y += 5;

  // Legal notice
  y += 5;
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(hu('Jelen igazolás a munkavállaló kérésére, az Mt. 80. § (2) bekezdése alapján került kiállításra.'), 16, y);
  y += 4;
  doc.text(hu('Az igazolás kiadásának napján érvényes adatokat tartalmazza.'), 16, y);
  doc.setTextColor(0);

  addSignatureBlock(doc, y + 5);
  addFooter(doc, hu('Jövedelemigazolás'));
  return doc.output('bloburl').toString();
}

// ─── TRANSFER LIST ───────────────────────────────────────────────────
export function generateTransferPdf(ctx: DocContext): string {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();

  addDocHeader(doc, 'Bér utalási lista', ctx.companyName, ctx.period, [16, 185, 129]); // emerald

  let y = 44;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 95);
  doc.text(hu('Átutalandó munkabérek'), 16, y);
  doc.setTextColor(0);
  y += 3;

  const rows = ctx.calculations.map(c => {
    const meta = c.metadata as any;
    return [
      hu(meta?.employee_name || '–'),
      hu(meta?.bank_account || '–'),
      fmt(c.net_salary || 0),
    ];
  });

  const totalNet = ctx.calculations.reduce((s, c) => s + (c.net_salary || 0), 0);

  autoTable(doc, {
    startY: y,
    head: [[hu('Munkavállaló'), hu('Bankszámlaszám'), hu('Nettó bér (Ft)')]],
    body: rows,
    foot: [[hu('Összesen'), '', fmt(totalNet)]],
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129], textColor: 255, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9 },
    footStyles: { fillColor: [220, 252, 231], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 10 },
    columnStyles: { 2: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: 16, right: 16 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(hu(`Utalandó tételek száma: ${ctx.calculations.length} db`), 16, y);
  y += 5;
  doc.text(hu(`Utalás tervezett napja: ${new Date().toLocaleDateString('hu-HU')}`), 16, y);

  addSignatureBlock(doc, y + 5);
  addFooter(doc, hu('Bér utalási lista'));
  return doc.output('bloburl').toString();
}

// ─── CASH PAYMENT LIST ───────────────────────────────────────────────
export function generateCashPaymentPdf(ctx: DocContext): string {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();

  addDocHeader(doc, hu('Készpénzes kifizetési lista'), ctx.companyName, ctx.period, [245, 158, 11]); // amber

  let y = 44;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 95);
  doc.text(hu('Készpénzben kifizetendő munkabérek'), 16, y);
  doc.setTextColor(0);
  y += 3;

  const rows = ctx.calculations.map(c => {
    const meta = c.metadata as any;
    return [
      hu(meta?.employee_name || '–'),
      fmt(c.net_salary || 0),
      new Date().toLocaleDateString('hu-HU'),
      '', // signature placeholder
    ];
  });

  const totalNet = ctx.calculations.reduce((s, c) => s + (c.net_salary || 0), 0);

  autoTable(doc, {
    startY: y,
    head: [[hu('Munkavállaló'), hu('Kifizetendő (Ft)'), hu('Kifizetés dátuma'), hu('Átvételi aláírás')]],
    body: rows,
    foot: [[hu('Összesen'), fmt(totalNet), '', '']],
    theme: 'grid',
    headStyles: { fillColor: [245, 158, 11], textColor: 255, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9, minCellHeight: 12 },
    footStyles: { fillColor: [254, 243, 199], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 10 },
    columnStyles: {
      1: { halign: 'right', fontStyle: 'bold' },
      3: { cellWidth: 40 },
    },
    margin: { left: 16, right: 16 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(hu('A munkavállaló az átvételi aláírással igazolja a készpénz átvételét.'), 16, y);
  doc.setTextColor(0);

  addSignatureBlock(doc, y + 5);
  addFooter(doc, hu('Készpénzes kifizetési lista'));
  return doc.output('bloburl').toString();
}

// ─── GARNISHMENT LIST ────────────────────────────────────────────────
export function generateGarnishmentPdf(ctx: DocContext): string {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();

  addDocHeader(doc, hu('Letiltások jegyzéke'), ctx.companyName, ctx.period, [239, 68, 68]); // red

  let y = 44;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 95);
  doc.text(hu('Munkabérből történő levonások'), 16, y);
  doc.setTextColor(0);
  y += 3;

  const hasAnyDeduction = ctx.calculations.some(c => (c.total_deductions || 0) > 0);

  const rows = ctx.calculations.map(c => {
    const meta = c.metadata as any;
    const hasDed = (c.total_deductions || 0) > 0;
    return [
      hu(meta?.employee_name || '–'),
      hasDed ? hu('Letiltás') : hu('Nincs aktív letiltás'),
      hasDed ? fmt(c.total_deductions || 0) : '0',
      hasDed ? hu('Folyamatos') : '–',
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [[hu('Munkavállaló'), hu('Levonás típusa'), hu('Havi összeg (Ft)'), hu('Státusz')]],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: [239, 68, 68], textColor: 255, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 2: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: 16, right: 16 },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 1) {
        const val = data.cell.raw as string;
        if (val && val.includes('Nincs')) {
          data.cell.styles.textColor = [150, 150, 150];
          data.cell.styles.fontStyle = 'italic';
        }
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  if (!hasAnyDeduction) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 163, 74);
    doc.text(hu('Nincs aktív letiltás a munkavállalók esetében.'), pw / 2, y, { align: 'center' });
    doc.setTextColor(0);
    y += 8;
  }

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(hu('A letiltások az Mt. 161. § és a Vht. alapján kerültek végrehajtásra.'), 16, y);
  doc.setTextColor(0);

  addSignatureBlock(doc, y + 5);
  addFooter(doc, hu('Letiltások jegyzéke'));
  return doc.output('bloburl').toString();
}

// ─── CAFETERIA ALLOCATION ────────────────────────────────────────────
export function generateCafeteriaPdf(ctx: DocContext): string {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();

  addDocHeader(doc, hu('Cafeteria feltöltési lista'), ctx.companyName, ctx.period, [139, 92, 246]); // violet

  let y = 44;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 95);
  doc.text(hu('SZÉP kártya feltöltések'), 16, y);
  doc.setTextColor(0);
  y += 3;

  const rows = ctx.calculations.map(c => {
    const meta = c.metadata as any;
    const cafTax = c.cafeteria_tax as any;
    const hasCafData = cafTax && typeof cafTax === 'object' && Object.keys(cafTax).length > 0;
    const amount = hasCafData ? (cafTax?.amount || 0) : Math.round((c.gross_salary || 0) * 0.05);
    return [
      hu(meta?.employee_name || '–'),
      hu(hasCafData ? (cafTax?.type || 'SZÉP kártya') : 'Vendéglátás'),
      hu(meta?.szep_card_number || '–'),
      fmt(amount),
    ];
  });

  const totalCaf = rows.reduce((s, r) => s + parseInt(String(r[3]).replace(/\s/g, '').replace(',', '.')) || 0, 0);

  autoTable(doc, {
    startY: y,
    head: [[hu('Munkavállaló'), hu('Zseb típusa'), hu('Kártyaszám'), hu('Összeg (Ft)')]],
    body: rows,
    foot: [[hu('Összesen'), '', '', fmt(ctx.calculations.reduce((s, c) => {
      const cafTax = c.cafeteria_tax as any;
      const hasCafData = cafTax && typeof cafTax === 'object' && Object.keys(cafTax).length > 0;
      return s + (hasCafData ? (cafTax?.amount || 0) : Math.round((c.gross_salary || 0) * 0.05));
    }, 0))]],
    theme: 'grid',
    headStyles: { fillColor: [139, 92, 246], textColor: 255, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9 },
    footStyles: { fillColor: [237, 233, 254], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 10 },
    columnStyles: { 3: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: 16, right: 16 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(hu('A cafeteria juttatás a Szja tv. 71. § alapján adómentes keretösszeg erejéig.'), 16, y);
  doc.setTextColor(0);

  addSignatureBlock(doc, y + 5);
  addFooter(doc, hu('Cafeteria feltöltési lista'));
  return doc.output('bloburl').toString();
}

// ─── EMPLOYER SUMMARY ────────────────────────────────────────────────
export function generateSummaryPdf(ctx: DocContext): string {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();

  addDocHeader(doc, hu('Munkáltatói összesítő'), ctx.companyName, ctx.period, [100, 116, 139]); // slate

  let y = 44;
  
  const totalGross = ctx.calculations.reduce((s, c) => s + (c.gross_salary || 0), 0);
  const totalSzja = ctx.calculations.reduce((s, c) => s + (c.szja_amount || 0), 0);
  const totalTb = ctx.calculations.reduce((s, c) => s + (c.tb_amount || 0), 0);
  const totalSzocho = ctx.calculations.reduce((s, c) => s + (c.szocho_amount || 0), 0);
  const totalNet = ctx.calculations.reduce((s, c) => s + (c.net_salary || 0), 0);
  const totalDeductions = ctx.calculations.reduce((s, c) => s + (c.total_deductions || 0), 0);
  const totalCost = totalGross + totalSzocho;

  // Summary cards
  const cards = [
    { label: hu('Létszám'), value: hu(`${ctx.calculations.length} fő`), color: [59, 130, 246] },
    { label: hu('Bruttó bérek'), value: `${fmt(totalGross)} Ft`, color: [59, 130, 246] },
    { label: hu('Nettó bérek'), value: `${fmt(totalNet)} Ft`, color: [16, 185, 129] },
    { label: hu('Teljes bérköltség'), value: `${fmt(totalCost)} Ft`, color: [100, 116, 139] },
  ];

  const cardW = (pw - 32 - 12) / 4;
  cards.forEach((card, i) => {
    const cx = 16 + i * (cardW + 4);
    doc.setFillColor(card.color[0], card.color[1], card.color[2]);
    doc.roundedRect(cx, y, cardW, 22, 2, 2, 'F');
    doc.setTextColor(255);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(card.label, cx + 4, y + 8);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(card.value, cx + 4, y + 17);
  });
  doc.setTextColor(0);
  y += 30;

  // Detailed breakdown
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 95);
  doc.text(hu('Részletes bontás'), 16, y);
  doc.setTextColor(0);
  y += 3;

  autoTable(doc, {
    startY: y,
    head: [[hu('Tétel'), hu('Összeg (Ft)'), hu('Megjegyzés')]],
    body: [
      [hu('Bruttó bérek összesen'), fmt(totalGross), `${ctx.calculations.length} ${hu('fő')}`],
      [hu('Munkáltatót terhelő SZOCHO (13%)'), fmt(totalSzocho), ''],
      [hu('Munkavállalók SZJA (15%)'), fmt(totalSzja), hu('Levont')],
      [hu('Munkavállalók TB járulék (18,5%)'), fmt(totalTb), hu('Levont')],
      [hu('Egyéb levonások'), fmt(totalDeductions), ''],
      [hu('Nettó bérek összesen'), fmt(totalNet), hu('Utalandó')],
    ],
    foot: [[hu('Teljes bérköltség (bruttó + SZOCHO)'), fmt(totalCost), '']],
    theme: 'grid',
    headStyles: { fillColor: [100, 116, 139], textColor: 255, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9 },
    footStyles: { fillColor: [226, 232, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 10 },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: 16, right: 16 },
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index === 5) {
        data.cell.styles.fillColor = [220, 252, 231];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // Per-employee table
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 95);
  doc.text(hu('Munkavállalónkénti bontás'), 16, y);
  doc.setTextColor(0);
  y += 3;

  autoTable(doc, {
    startY: y,
    head: [[hu('Munkavállaló'), hu('Bruttó'), hu('SZJA'), hu('TB'), hu('Nettó')]],
    body: ctx.calculations.map(c => {
      const meta = c.metadata as any;
      return [
        hu(meta?.employee_name || '–'),
        fmt(c.gross_salary || 0),
        fmt(c.szja_amount || 0),
        fmt(c.tb_amount || 0),
        fmt(c.net_salary || 0),
      ];
    }),
    theme: 'striped',
    headStyles: { fillColor: [71, 85, 105], textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 16, right: 16 },
  });

  addSignatureBlock(doc, (doc as any).lastAutoTable.finalY + 5);
  addFooter(doc, hu('Munkáltatói összesítő'));
  return doc.output('bloburl').toString();
}
