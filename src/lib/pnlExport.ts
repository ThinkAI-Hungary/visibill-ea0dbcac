import ExcelJS from 'exceljs';

export const exportPnlExcel = async (
  processedData: any[],
  dbItems: any[] | null | undefined,
  inThousands: boolean,
  companyName: string = 'Vállalkozás'
) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Visibill';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Eredménykimutatás', {
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
    { header: 'Megnevezés', key: 'nev', width: 60 },
    { header: 'Előző Év', key: 'elozo', width: 15 },
    { header: `Tárgyidőszak (${inThousands ? 'Ezer Ft' : 'Ft'})`, key: 'targy', width: 20 },
  ];

  // Style the header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F2937' }, // Dark gray
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 25;

  // Formatting helper
  const formatValue = (val: number) => {
    const finalVal = inThousands ? Math.round(val / 1000) : val;
    return finalVal; // Return raw number for Excel
  };

  const numberFormat = inThousands ? '#,##0' : '#,##0';

  // Add Data
  for (const row of processedData) {
    const isCapital = row.type === 'capital';
    const isRoman = row.type === 'roman';
    
    // Add the main PnL row
    const pnlRow = worksheet.addRow({
      sor: row.row_code,
      nev: row.name,
      elozo: null,
      targy: formatValue(row.displayBalance)
    });

    // Style PnL Row
    pnlRow.getCell('targy').numFmt = numberFormat;
    pnlRow.getCell('sor').alignment = { horizontal: 'center' };
    
    if (isCapital) {
      pnlRow.font = { bold: true, size: 12 };
      pnlRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F4F6' } // Light gray
      };
      // Top border for capital rows
      pnlRow.eachCell((cell) => {
        cell.border = { top: { style: 'thin', color: { argb: 'FFD1D5DB' } } };
      });
    } else if (isRoman) {
      pnlRow.font = { bold: true };
    }

    // Process GL Accounts and Transactions if it's a roman row
    if (isRoman && row.gl_accounts && row.gl_accounts.length > 0) {
      for (const gl of row.gl_accounts) {
        // Add GL Account row
        const glRow = worksheet.addRow({
          sor: '',
          nev: `   [${gl.gl_number}] ${gl.short_name}`,
          elozo: null,
          targy: formatValue(gl.balance * (row.multiplier || 1))
        });
        
        glRow.font = { italic: true, color: { argb: 'FF4B5563' } };
        glRow.getCell('targy').numFmt = numberFormat;
        glRow.outlineLevel = 1;

        // Process specific transactions
        const items = dbItems?.filter(i => i.gl_account_id === gl.gl_account_id) || [];
        for (const item of items) {
          const dateStr = item.item_date ? item.item_date.substring(0, 10).replace(/-/g, '.') : '';
          const partnerStr = item.partner ? `${item.partner} - ` : '';
          const descStr = item.description || '';
          
          const txRow = worksheet.addRow({
            sor: '',
            nev: `      • ${dateStr} | ${partnerStr}${descStr}`,
            elozo: null,
            targy: formatValue(item.amount * (row.multiplier || 1))
          });

          txRow.font = { size: 10, color: { argb: 'FF6B7280' } };
          txRow.getCell('targy').numFmt = numberFormat;
          txRow.outlineLevel = 2;
          
          // Subtly color transaction rows
          txRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF9FAFB' } // Very light gray
          };
        }
      }
    }
  }

  // Freeze the top row
  worksheet.views = [
    { state: 'frozen', xSplit: 0, ySplit: 1, showGridLines: false }
  ];

  // Generate the file
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const filename = `Eredmenykimutatas_${companyName.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.xlsx`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
