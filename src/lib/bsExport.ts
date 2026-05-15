import ExcelJS from 'exceljs';

export const exportBsExcel = async (
  assets: any[],
  liabilities: any[],
  totalAssets: number,
  totalLiabilities: number,
  inThousands: boolean,
  companyName: string = 'Vállalkozás'
) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Visibill';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Mérleg', {
    views: [{ showGridLines: false }],
    properties: {
      outlineProperties: {
        summaryBelow: false,
        summaryRight: false,
      }
    }
  });

  // Set Columns
  worksheet.columns = [
    { header: 'Sor', key: 'sor', width: 10 },
    { header: 'Megnevezés', key: 'nev', width: 55 },
    { header: 'Előző év', key: 'elozo', width: 15 },
    { header: 'Módosítások', key: 'modositas', width: 15 },
    { header: `Tárgyév (${inThousands ? 'Ezer Ft' : 'Ft'})`, key: 'targy', width: 18 },
  ];

  // Style header
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F2937' },
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 25;

  const formatValue = (val: number) => {
    return inThousands ? Math.round(val / 1000) : val;
  };

  const numberFormat = '#,##0';

  const addRow = (row: any) => {
    const isLetter = row.type === 'letter';
    const isRoman = row.type === 'roman';
    const isArabic = row.type === 'arabic';
    const isTotal = row.type === 'total';

    const indent = isRoman ? '   ' : isArabic ? '      ' : '';

    const excelRow = worksheet.addRow({
      sor: row.row_code || '',
      nev: `${indent}${row.name}`,
      elozo: formatValue(Number(row.prior_year_balance) || 0),
      modositas: formatValue(Number(row.prior_year_adjustment) || 0),
      targy: formatValue(row.computedBalance || 0),
    });

    excelRow.getCell('elozo').numFmt = numberFormat;
    excelRow.getCell('modositas').numFmt = numberFormat;
    excelRow.getCell('targy').numFmt = numberFormat;
    excelRow.getCell('sor').alignment = { horizontal: 'center' };

    if (isTotal) {
      excelRow.font = { bold: true, size: 12 };
      excelRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE8F5E9' },
      };
      excelRow.eachCell((cell) => {
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF2E7D32' } },
          bottom: { style: 'medium', color: { argb: 'FF2E7D32' } },
        };
      });
    } else if (isLetter) {
      excelRow.font = { bold: true, size: 11 };
      excelRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F4F6' },
      };
      excelRow.eachCell((cell) => {
        cell.border = { top: { style: 'thin', color: { argb: 'FFD1D5DB' } } };
      });
    } else if (isRoman) {
      excelRow.font = { bold: true };
    }

    // GL drill-down accounts
    if (isArabic && row.gl_accounts) {
      const glAccounts = (row.gl_accounts as any[]) || [];
      for (const gl of glAccounts) {
        if (!gl.gl_account_id) continue;
        const glRow = worksheet.addRow({
          sor: '',
          nev: `         [${gl.gl_number}] ${gl.short_name}`,
          elozo: null,
          modositas: null,
          targy: formatValue(gl.balance || 0),
        });
        glRow.font = { italic: true, color: { argb: 'FF4B5563' }, size: 10 };
        glRow.getCell('targy').numFmt = numberFormat;
        glRow.outlineLevel = 1;

        // 2nd-level: individual transactions under this GL account
        if (gl.transactions && Array.isArray(gl.transactions)) {
          for (const tx of gl.transactions) {
            const txDate = tx.date ? new Date(tx.date).toLocaleDateString('hu-HU') : '';
            const txRow = worksheet.addRow({
              sor: '',
              nev: `              ${txDate} | ${tx.partner_name || ''} | ${tx.description || ''}`,
              elozo: null,
              modositas: null,
              targy: formatValue(Number(tx.amount) || 0),
            });
            txRow.font = { size: 9, color: { argb: 'FF6B7280' } };
            txRow.getCell('targy').numFmt = numberFormat;
            txRow.outlineLevel = 2;
          }
        }
      }
    }
  };

  // Add Assets
  for (const row of assets) addRow(row);

  // Separator row
  const sepRow = worksheet.addRow({ sor: '', nev: '', elozo: null, modositas: null, targy: null });
  sepRow.height = 8;
  sepRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE5E7EB' },
  };

  // Add Liabilities
  for (const row of liabilities) addRow(row);

  // Freeze header
  worksheet.views = [
    { state: 'frozen', xSplit: 0, ySplit: 1, showGridLines: false }
  ];

  // Generate file
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);

  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const filename = `Merleg_${companyName.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.xlsx`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
