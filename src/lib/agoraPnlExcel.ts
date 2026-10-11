/**
 * agoraPnlExcel.ts
 *
 * Hivatalos magyar Eredménykimutatás összköltség eljárással („A” változat)
 * Excel (.xlsx) Export az Agora / Novitax benchmark dokumentum alapján.
 */

import {
  buildAgoraPnlData,
  type AgoraPnlReportData,
  type BuildAgoraPnlOptions,
} from './agoraPnlData';

/**
 * Generálja és letölti az Eredménykimutatást .xlsx formátumban
 */
export async function exportAgoraPnlExcel(
  options: BuildAgoraPnlOptions
): Promise<void> {
  const { default: ExcelJS } = await import('exceljs');
  const data: AgoraPnlReportData = buildAgoraPnlData(options);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = data.branding || 'EaisyBill';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('Eredménykimutatás', {
    views: [{ showGridLines: true }],
  });

  // Oszlopszélességek beállítása
  ws.columns = [
    { key: 'line_num', width: 10 },
    { key: 'code', width: 10 },
    { key: 'name', width: 68 },
    { key: 'previous', width: 18 },
    { key: 'mod', width: 14 },
    { key: 'current', width: 22 },
  ];

  const companyHeaderStr = data.company.taxNumber
    ? `${data.company.name} ( ${data.company.taxNumber} )`
    : data.company.name;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 1. FEJLÉC SZEKCIÓ
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 1. Sor: Cég neve és Listaazonosító
  const row1 = ws.addRow({
    line_num: companyHeaderStr,
    current: `Listaazonosító: ${data.listId}`,
  });
  row1.font = { bold: true, size: 9 };
  ws.mergeCells('A1:D1');
  ws.mergeCells('E1:F1');
  row1.getCell('current').alignment = { horizontal: 'right' };

  // 2. Sor: Főcím
  const row2 = ws.addRow(['EREDMÉNYKIMUTATÁS ÖSSZKÖLTSÉG ELJÁRÁSSAL']);
  row2.font = { bold: true, size: 14, color: { argb: 'FF111827' } };
  row2.alignment = { horizontal: 'center' };
  ws.mergeCells('A2:F2');

  // 3. Sor: Időszak és Egység
  const row3 = ws.addRow({
    line_num: `Időszak: ${data.period}`,
    current: `Mértékegység: ${data.currency}`,
  });
  row3.font = { bold: true, size: 10, color: { argb: 'FF374151' } };
  ws.mergeCells('A3:D3');
  ws.mergeCells('E3:F3');
  row3.getCell('current').alignment = { horizontal: 'right' };

  // 4-8. Sorok: Részletes cégadatok
  const metaRows = [
    `Cím: ${data.company.address || '-'}`,
    `Adószám: ${data.company.taxNumber || '-'}`,
    `Statisztikai számjel: ${data.company.statisticalCode || '-'}`,
    `Cégjegyzék száma: ${data.company.registrationNumber || '-'}`,
    `Mérlegforduló napja: ${data.company.balanceSheetDate || '-'}`,
  ];
  metaRows.forEach(metaText => {
    const metaRow = ws.addRow([metaText]);
    metaRow.font = { size: 9, color: { argb: 'FF4B5563' } };
    const rIdx = ws.rowCount;
    ws.mergeCells(`A${rIdx}:F${rIdx}`);
  });

  ws.addRow([]); // Üres elválasztó sor

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 2. TÁBLÁZAT FEJLÉC
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const headRow = ws.addRow({
    line_num: 'Sorszám',
    code: 'Kód',
    name: 'Megnevezés',
    previous: 'Előző',
    mod: 'Mód',
    current: 'Tárgyév',
  });
  headRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  headRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F2937' }, // Dark slate
  };
  headRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headRow.height = 22;
  headRow.getCell('name').alignment = { vertical: 'middle', horizontal: 'left' };
  headRow.getCell('previous').alignment = { vertical: 'middle', horizontal: 'right' };
  headRow.getCell('mod').alignment = { vertical: 'middle', horizontal: 'right' };
  headRow.getCell('current').alignment = { vertical: 'middle', horizontal: 'right' };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 3. TÁBLÁZAT TÖRZS (48 SOR)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const numberFormat = '#,##0;[Red]-#,##0;""';

  data.rows.forEach(r => {
    const lineNumStr = String(r.lineNum).padStart(2, '0') + '.';
    const isCapital = r.isCapital;
    const isRoman = r.isRoman;
    const isSub = r.isSubItem;

    const row = ws.addRow({
      line_num: lineNumStr,
      code: r.code,
      name: isSub ? `     ${r.name}` : r.name,
      previous: r.displayPrevious !== 0 ? r.displayPrevious : null,
      mod: r.displayMod !== 0 ? r.displayMod : null,
      current: r.displayCurrent !== 0 ? r.displayCurrent : null,
    });

    // Számformátumok
    row.getCell('previous').numFmt = numberFormat;
    row.getCell('mod').numFmt = numberFormat;
    row.getCell('current').numFmt = numberFormat;

    row.getCell('line_num').alignment = { horizontal: 'center' };
    row.getCell('code').alignment = { horizontal: 'left' };

    // Főkategória stílusok
    if (isCapital) {
      row.font = { bold: true, size: 11, color: { argb: 'FF111827' } };
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE5E7EB' }, // Light gray
      };
      row.eachCell(cell => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF9CA3AF' } },
          bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } },
        };
      });
      row.height = 20;
    } else if (isRoman) {
      row.font = { bold: true, size: 9.5 };
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF9FAFB' },
      };
      row.height = 18;
    } else if (isSub) {
      row.font = { italic: true, size: 8.5, color: { argb: 'FF4B5563' } };
    } else {
      row.font = { size: 9 };
    }
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 4. LÁBLÉC ÉS ALÁÍRÁSI SZEKCIÓ
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ws.addRow([]); // Blank spacer
  ws.addRow([]);

  const signRow = ws.addRow({
    line_num: '',
    code: '',
    name: 'keltezés',
    previous: '',
    mod: '',
    current: 'a vállalkozás vezetője (képviselője)',
  });
  signRow.font = { italic: true, size: 9 };
  signRow.getCell('name').alignment = { horizontal: 'center' };
  signRow.getCell('current').alignment = { horizontal: 'center' };

  ws.addRow([]);

  const footerRow = ws.addRow({
    line_num: data.generatedDate,
    name: data.branding,
    current: `Regisztrálva: ${companyHeaderStr}`,
  });
  footerRow.font = { size: 8, color: { argb: 'FF6B7280' } };
  footerRow.getCell('current').alignment = { horizontal: 'right' };

  // Fagyasztás: első 10 fejléc sor rögzítése görgetéskor
  ws.views = [
    { state: 'frozen', xSplit: 0, ySplit: headRow.number, showGridLines: true },
  ];

  // Fájl mentése és letöltése
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);

  const safeComp = (data.company.name || 'Ceg').replace(/[^a-zA-Z0-9]/g, '_');
  const unitSuffix = data.inThousands ? '_ezer_huf' : '_huf';
  const filename = `Eredmenykimutatas_Agora_${safeComp}_${data.generatedDate.replace(/\./g, '')}${unitSuffix}.xlsx`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
