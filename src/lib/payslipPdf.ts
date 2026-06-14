/**
 * Payslip PDF generator — Mt. 155. § (2) compliant
 * Generates a detailed payslip from actual payroll calculation data.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface PayslipPdfData {
  employeeName: string;
  period: string;
  grossSalary: number;
  szjaAmount: number;
  tbAmount: number;
  szochoAmount: number;
  netSalary: number;
  totalDeductions: number;
  taxCredits?: Record<string, unknown>;
  deductions?: Record<string, unknown>;
  cafeteriaTax?: Record<string, unknown>;
  companyName?: string;
}

const fmt = (n: number) => n.toLocaleString('hu-HU');

/**
 * jsPDF's built-in Helvetica font only supports Latin-1 (ISO 8859-1).
 * Hungarian ő/ű characters are Latin-2 (ISO 8859-2) and render as garbage.
 * This function replaces them with the closest Latin-1 equivalents.
 */
function hu(text: string): string {
  return text
    .replace(/ő/g, 'ö')
    .replace(/Ő/g, 'Ö')
    .replace(/ű/g, 'ü')
    .replace(/Ű/g, 'Ü');
}

function buildPayslipDoc(data: PayslipPdfData): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const margin = 16;

  // ── Header ──────────────────────────────────────────────
  doc.setFillColor(30, 58, 95); // dark navy
  doc.rect(0, 0, pw, 42, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(hu('BÉRJEGYZÉK'), margin, 18);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(hu('Mt. 155. § (2) szerinti havi bérjegyzék'), margin, 25);

  // Period badge
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(hu(`Időszak: ${data.period}`), pw - margin, 18, { align: 'right' });

  if (data.companyName) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(hu(data.companyName), pw - margin, 25, { align: 'right' });
  }

  // Employee name bar
  doc.setFillColor(240, 245, 250);
  doc.rect(0, 42, pw, 14, 'F');
  doc.setTextColor(30, 58, 95);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(hu(data.employeeName), margin, 51);

  let y = 64;

  // ── 1. Bruttó bér ──────────────────────────────────────
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(hu('BRUTTÓ BÉRELEMEK'), margin, y);
  y += 2;

  autoTable(doc, {
    startY: y,
    head: [[hu('Jogcím'), hu('Összeg (Ft)')]],
    body: [
      [hu('Alapbér'), fmt(data.grossSalary)],
    ],
    theme: 'plain',
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontSize: 8, fontStyle: 'bold', cellPadding: 3 },
    bodyStyles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: margin, right: margin },
    tableLineColor: [220, 220, 220],
    tableLineWidth: 0.2,
  });
  y = (doc as any).lastAutoTable.finalY + 3;

  // Gross total
  doc.setFillColor(59, 130, 246);
  doc.roundedRect(margin, y, pw - margin * 2, 10, 2, 2, 'F');
  doc.setTextColor(255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(hu('Bruttó bér összesen'), margin + 4, y + 7);
  doc.text(`${fmt(data.grossSalary)} Ft`, pw - margin - 4, y + 7, { align: 'right' });
  y += 16;

  // ── 2. Munkavállalói levonások ─────────────────────────
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(hu('MUNKAVÁLLALÓI LEVONÁSOK'), margin, y);
  y += 2;

  const deductionRows: string[][] = [
    [hu('Személyi jövedelemadó (SZJA) — 15%'), fmt(data.szjaAmount)],
    [hu('Társadalombiztosítási járulék (TB) — 18,5%'), fmt(data.tbAmount)],
  ];

  if (data.totalDeductions > 0) {
    deductionRows.push([hu('Egyéb levonások'), fmt(data.totalDeductions)]);
  }

  const totalWorkerDeductions = data.szjaAmount + data.tbAmount + data.totalDeductions;

  autoTable(doc, {
    startY: y,
    head: [[hu('Levonás jogcíme'), hu('Összeg (Ft)')]],
    body: deductionRows,
    theme: 'plain',
    headStyles: { fillColor: [239, 68, 68], textColor: 255, fontSize: 8, fontStyle: 'bold', cellPadding: 3 },
    bodyStyles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: margin, right: margin },
    tableLineColor: [220, 220, 220],
    tableLineWidth: 0.2,
  });
  y = (doc as any).lastAutoTable.finalY + 3;

  // Deduction total
  doc.setFillColor(239, 68, 68);
  doc.roundedRect(margin, y, pw - margin * 2, 10, 2, 2, 'F');
  doc.setTextColor(255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(hu('Levonások összesen'), margin + 4, y + 7);
  doc.text(hu(`– ${fmt(totalWorkerDeductions)} Ft`), pw - margin - 4, y + 7, { align: 'right' });
  y += 16;

  // ── 3. Nettó bér ───────────────────────────────────────
  doc.setFillColor(16, 185, 129); // emerald
  doc.roundedRect(margin, y, pw - margin * 2, 14, 2, 2, 'F');
  doc.setTextColor(255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(hu('NETTÓ BÉR'), margin + 4, y + 10);
  doc.text(hu(`${fmt(data.netSalary)} Ft`), pw - margin - 4, y + 10, { align: 'right' });
  y += 22;

  // ── 4. Munkáltatói közterhek ───────────────────────────
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(hu('MUNKÁLTATÓI KÖZTERHEK'), margin, y);
  y += 2;

  autoTable(doc, {
    startY: y,
    head: [[hu('Jogcím'), hu('Összeg (Ft)')]],
    body: [
      [hu('Szociális hozzájárulási adó (SZOCHO) — 13%'), fmt(data.szochoAmount)],
    ],
    theme: 'plain',
    headStyles: { fillColor: [107, 114, 128], textColor: 255, fontSize: 8, fontStyle: 'bold', cellPadding: 3 },
    bodyStyles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: margin, right: margin },
    tableLineColor: [220, 220, 220],
    tableLineWidth: 0.2,
  });
  y = (doc as any).lastAutoTable.finalY + 3;

  doc.setFillColor(107, 114, 128);
  doc.roundedRect(margin, y, pw - margin * 2, 10, 2, 2, 'F');
  doc.setTextColor(255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(hu('Teljes bérköltség'), margin + 4, y + 7);
  doc.text(`${fmt(data.grossSalary + data.szochoAmount)} Ft`, pw - margin - 4, y + 7, { align: 'right' });
  y += 18;

  // ── 5. Összesítő kártya ────────────────────────────────
  const summaryY = y;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, summaryY, pw - margin * 2, 36, 3, 3, 'S');

  doc.setTextColor(100, 100, 100);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(hu('ÖSSZESÍTŐ'), margin + 4, summaryY + 7);

  const col1x = margin + 4;
  const col2x = margin + (pw - margin * 2) / 3;
  const col3x = margin + 2 * (pw - margin * 2) / 3;

  doc.setTextColor(120, 120, 120);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(hu('Bruttó bér'), col1x, summaryY + 15);
  doc.text(hu('Levonások'), col2x, summaryY + 15);
  doc.text(hu('Nettó bér'), col3x, summaryY + 15);

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`${fmt(data.grossSalary)} Ft`, col1x, summaryY + 22);
  doc.text(hu(`– ${fmt(totalWorkerDeductions)} Ft`), col2x, summaryY + 22);
  doc.text(`${fmt(data.netSalary)} Ft`, col3x, summaryY + 22);

  // Percentage bars
  const barW = (pw - margin * 2) / 3 - 10;
  [col1x, col2x, col3x].forEach((cx, i) => {
    doc.setFillColor(230, 230, 230);
    doc.roundedRect(cx, summaryY + 26, barW, 3, 1, 1, 'F');
    const pct = i === 0 ? 1 : i === 1 ? (data.grossSalary > 0 ? totalWorkerDeductions / data.grossSalary : 0) : (data.grossSalary > 0 ? data.netSalary / data.grossSalary : 0);
    const colors = [[59, 130, 246], [239, 68, 68], [16, 185, 129]];
    doc.setFillColor(colors[i][0], colors[i][1], colors[i][2]);
    doc.roundedRect(cx, summaryY + 26, barW * Math.min(pct, 1), 3, 1, 1, 'F');
  });

  // ── Footer ─────────────────────────────────────────────
  const ph = doc.internal.pageSize.getHeight();
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, ph - 18, pw - margin, ph - 18);
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(hu(`Generálva: ${new Date().toLocaleString('hu-HU')} | Mt. 155. § (2) szerinti bérjegyzék`), pw / 2, ph - 12, { align: 'center' });

  return doc;
}

/**
 * Returns a Blob URL for previewing the payslip in an iframe.
 */
export function getPayslipPreviewUrl(data: PayslipPdfData): string {
  const doc = buildPayslipDoc(data);
  return doc.output('bloburl').toString();
}

/**
 * Downloads the payslip PDF.
 */
export function downloadPayslipPdf(filename: string, data: PayslipPdfData): void {
  const doc = buildPayslipDoc(data);
  doc.save(`${filename}.pdf`);
}
