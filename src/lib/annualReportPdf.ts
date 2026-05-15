import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface AnnualReportData {
  companyName: string;
  fiscalYear: number;
  representativeName: string;
  representativeRole: string;
  reportDate: string;
  frozenBsData: any[];
  frozenPnlData: any[];
  notesSections: { section_key: string; text: string }[];
  notesTemplates: { section_key: string; section_title: string; default_text: string }[];
  netIncome: number;
  dividendAmount: number;
  retainedEarnings: number;
  dividendResolutionDate: string;
}

const fmt = (val: number) => new Intl.NumberFormat('hu-HU').format(Math.round(val / 1000));

export const generateAnnualReportPdf = (data: AnnualReportData) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = 0;

  const addPage = () => { doc.addPage(); y = margin; };
  const checkPageBreak = (needed: number) => { if (y + needed > 270) addPage(); };

  // ═══════════════════════════════════════
  // PAGE 1: Cover
  // ═══════════════════════════════════════
  y = 80;
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('ÉVES BESZÁMOLÓ', pageWidth / 2, y, { align: 'center' });

  y += 20;
  doc.setFontSize(18);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.fiscalYear}. üzleti év`, pageWidth / 2, y, { align: 'center' });

  y += 30;
  doc.setFontSize(14);
  doc.text(data.companyName, pageWidth / 2, y, { align: 'center' });

  y += 50;
  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text(`Készítette: ${data.representativeName}`, pageWidth / 2, y, { align: 'center' });
  y += 7;
  doc.text(`Beosztás: ${data.representativeRole}`, pageWidth / 2, y, { align: 'center' });
  y += 7;
  doc.text(`Dátum: ${data.reportDate}`, pageWidth / 2, y, { align: 'center' });

  y += 30;
  doc.setFontSize(9);
  doc.text('Készült a Visibill rendszerrel', pageWidth / 2, y, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  // ═══════════════════════════════════════
  // PAGE 2: Table of Contents
  // ═══════════════════════════════════════
  addPage();
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('TARTALOMJEGYZÉK', margin, y);
  y += 15;

  const tocItems = ['1. Mérleg', '2. Eredménykimutatás', '3. Kiegészítő Melléklet', '4. Eredményfelosztás'];
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  tocItems.forEach(item => {
    doc.text(item, margin + 10, y);
    y += 10;
  });

  // ═══════════════════════════════════════
  // PAGE 3+: Balance Sheet
  // ═══════════════════════════════════════
  addPage();
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('1. MÉRLEG', margin, y);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  y += 6;
  doc.text(`${data.fiscalYear}. december 31. (Ezer Ft)`, margin, y);
  y += 8;

  if (data.frozenBsData && data.frozenBsData.length > 0) {
    // Assets
    const assets = data.frozenBsData.filter(r => r.section === 'assets' && r.type !== 'total');
    const liabilities = data.frozenBsData.filter(r => r.section === 'liabilities' && r.type !== 'total');

    const bsToRows = (rows: any[]) => rows
      .filter(r => r.type === 'letter' || r.type === 'arabic')
      .map(r => {
        const indent = r.type === 'arabic' ? '    ' : '';
        const style = r.type === 'letter' ? 'bold' : 'normal';
        return {
          cells: [
            r.row_code || '',
            `${indent}${r.name}`,
            fmt(Number(r.prior_year_balance) || 0),
            fmt(Number(r.current_balance) || 0),
          ],
          style
        };
      });

    const assetRows = bsToRows(assets);
    const liabRows = bsToRows(liabilities);

    // Assets table
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('ESZKÖZÖK (AKTÍVÁK)', margin, y);
    y += 5;

    autoTable(doc, {
      startY: y,
      head: [['Sor', 'Megnevezés', 'Előző év', 'Tárgyév']],
      body: assetRows.map(r => r.cells),
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2, font: 'helvetica' },
      headStyles: { fillColor: [31, 41, 55], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 15, halign: 'center' },
        1: { cellWidth: contentWidth - 55 },
        2: { cellWidth: 20, halign: 'right' },
        3: { cellWidth: 20, halign: 'right' },
      },
      didParseCell: (hookData: any) => {
        const rowIdx = hookData.row.index;
        if (rowIdx >= 0 && assetRows[rowIdx]?.style === 'bold') {
          hookData.cell.styles.fontStyle = 'bold';
          hookData.cell.styles.fillColor = [243, 244, 246];
        }
      },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
    checkPageBreak(40);

    // Liabilities table
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('FORRÁSOK (PASSZÍVÁK)', margin, y);
    y += 5;

    autoTable(doc, {
      startY: y,
      head: [['Sor', 'Megnevezés', 'Előző év', 'Tárgyév']],
      body: liabRows.map(r => r.cells),
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2, font: 'helvetica' },
      headStyles: { fillColor: [31, 41, 55], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 15, halign: 'center' },
        1: { cellWidth: contentWidth - 55 },
        2: { cellWidth: 20, halign: 'right' },
        3: { cellWidth: 20, halign: 'right' },
      },
      didParseCell: (hookData: any) => {
        const rowIdx = hookData.row.index;
        if (rowIdx >= 0 && liabRows[rowIdx]?.style === 'bold') {
          hookData.cell.styles.fontStyle = 'bold';
          hookData.cell.styles.fillColor = [243, 244, 246];
        }
      },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ═══════════════════════════════════════
  // P&L
  // ═══════════════════════════════════════
  addPage();
  y = margin;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('2. EREDMÉNYKIMUTATÁS', margin, y);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  y += 6;
  doc.text(`${data.fiscalYear}. január 1. - december 31. (Ezer Ft)`, margin, y);
  y += 8;

  if (data.frozenPnlData && data.frozenPnlData.length > 0) {
    const pnlRows = data.frozenPnlData
      .filter(r => r.type === 'capital' || r.type === 'roman')
      .map(r => {
        const style = r.type === 'capital' ? 'bold' : 'normal';
        const indent = r.type === 'roman' ? '    ' : '';
        return {
          cells: [
            r.row_code || '',
            `${indent}${r.name}`,
            fmt(Number(r.balance) * (Number(r.multiplier) || 1)),
          ],
          style
        };
      });

    autoTable(doc, {
      startY: y,
      head: [['Sor', 'Megnevezés', 'Tárgyév']],
      body: pnlRows.map(r => r.cells),
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2, font: 'helvetica' },
      headStyles: { fillColor: [31, 41, 55], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 15, halign: 'center' },
        1: { cellWidth: contentWidth - 35 },
        2: { cellWidth: 20, halign: 'right' },
      },
      didParseCell: (hookData: any) => {
        const rowIdx = hookData.row.index;
        if (rowIdx >= 0 && pnlRows[rowIdx]?.style === 'bold') {
          hookData.cell.styles.fontStyle = 'bold';
          hookData.cell.styles.fillColor = [243, 244, 246];
        }
      },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ═══════════════════════════════════════
  // Supplementary Notes
  // ═══════════════════════════════════════
  addPage();
  y = margin;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('3. KIEGÉSZÍTŐ MELLÉKLET', margin, y);
  y += 10;

  const templates = data.notesTemplates || [];
  for (const tmpl of templates) {
    checkPageBreak(30);
    const saved = data.notesSections?.find(s => s.section_key === tmpl.section_key);
    const text = saved?.text || tmpl.default_text;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(tmpl.section_title, margin, y);
    y += 6;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(text, contentWidth);
    for (const line of lines) {
      checkPageBreak(5);
      doc.text(line, margin, y);
      y += 4.5;
    }
    y += 6;
  }

  // ═══════════════════════════════════════
  // Dividend
  // ═══════════════════════════════════════
  if (data.netIncome > 0) {
    checkPageBreak(40);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('4. EREDMÉNYFELOSZTÁS', margin, y);
    y += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const divText = `A(z) ${data.companyName} taggyűlése ${data.dividendResolutionDate || '...'}-án megtartott ülésén a ${data.fiscalYear}. üzleti év ${new Intl.NumberFormat('hu-HU').format(data.netIncome)} Ft adózott eredményéből ${new Intl.NumberFormat('hu-HU').format(data.dividendAmount)} Ft osztalék kifizetéséről döntött. A fennmaradó ${new Intl.NumberFormat('hu-HU').format(data.retainedEarnings)} Ft az eredménytartalékba kerül.`;

    const divLines = doc.splitTextToSize(divText, contentWidth);
    for (const line of divLines) {
      doc.text(line, margin, y);
      y += 5;
    }

    y += 20;
    doc.setFontSize(10);
    doc.text('_________________________', margin + 10, y);
    doc.text('_________________________', pageWidth / 2 + 10, y);
    y += 5;
    doc.setFontSize(8);
    doc.text(data.representativeName || 'Képviselő', margin + 10, y);
    doc.text(data.representativeRole || 'ügyvezető', pageWidth / 2 + 10, y);
  }

  // ═══════════════════════════════════════
  // Footer on all pages
  // ═══════════════════════════════════════
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `${data.companyName} — ${data.fiscalYear}. évi beszámoló`,
      margin, 287
    );
    doc.text(`${i} / ${pageCount}`, pageWidth - margin, 287, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }

  // Save
  const timestamp = new Date().toISOString().slice(0, 10);
  doc.save(`Beszamolo_${data.companyName.replace(/[^a-zA-Z0-9]/g, '_')}_${data.fiscalYear}_${timestamp}.pdf`);
};
