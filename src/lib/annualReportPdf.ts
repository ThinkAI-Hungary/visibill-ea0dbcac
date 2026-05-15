interface AnnualReportData {
  companyName: string;
  companyAddress?: string;
  companyTaxNumber?: string;
  fiscalYear: number;
  representativeName: string;
  representativeRole: string;
  reportDate: string;
  frozenBsData: any[];
  frozenPnlData: any[];
  notesSections: { section_key: string; text: string; title?: string; is_custom?: boolean }[];
  notesTemplates: { section_key: string; section_title: string; default_text: string }[];
  netIncome: number;
  dividendAmount: number;
  retainedEarnings: number;
  dividendResolutionDate: string;
  // Dynamic table data
  assetMovement?: { total: number; active: number; disposed: number; totalAcquisition: number; activeAcquisition: number };
  salaryMetrics?: { headcount: number; totalWages: number; totalContrib: number; total: number };
  equityRows?: any[];
}

const fmt = (val: number) => new Intl.NumberFormat('hu-HU').format(Math.round(val / 1000));
const fmtFull = (val: number) => new Intl.NumberFormat('hu-HU').format(val);

/**
 * Smart filter: only keep rows that have non-zero balance, plus their parent letter/roman rows.
 * This prevents the PDF from showing 90+ empty rows.
 */
function filterRelevantRows(allRows: any[]): any[] {
  // Find all parent_ids that have at least one non-zero child
  const nonZeroIds = new Set<string>();
  const parentMap = new Map<string, string>();

  for (const r of allRows) {
    if (r.parent_id) parentMap.set(r.bs_structure_id, r.parent_id);
    const bal = Number(r.current_balance) || 0;
    const prior = Number(r.prior_year_balance) || 0;
    if (bal !== 0 || prior !== 0) {
      nonZeroIds.add(r.bs_structure_id);
      // Walk up the parent chain
      let pid = r.parent_id;
      while (pid) {
        nonZeroIds.add(pid);
        const parent = allRows.find((p: any) => p.bs_structure_id === pid);
        pid = parent?.parent_id || null;
      }
    }
  }

  // Also always keep total rows
  return allRows.filter((r: any) =>
    r.type === 'total' || nonZeroIds.has(r.bs_structure_id)
  );
}

export const generateAnnualReportPdf = (data: AnnualReportData) => {
  const allBs = data.frozenBsData || [];
  const assets = filterRelevantRows(allBs.filter((r: any) => r.section === 'assets'));
  const liabilities = filterRelevantRows(allBs.filter((r: any) => r.section === 'liabilities'));
  const pnlRows = (data.frozenPnlData || []).filter((r: any) => {
    if (r.type === 'capital') return true; // always show category headers
    const bal = Number(r.balance || 0) * Number(r.multiplier || 1);
    return bal !== 0;
  });

  // Compute BS totals
  const totalAssets = allBs.find((r: any) => r.section === 'assets' && r.type === 'total');
  const totalLiab = allBs.find((r: any) => r.section === 'liabilities' && r.type === 'total');

  const bsTableHtml = (rows: any[], title: string, totalRow: any) => {
    if (!rows.length) return `<p style="color:#999;font-style:italic;">Nincs adat</p>`;
    const trs = rows.filter(r => r.type !== 'total').map(r => {
      const isLetter = r.type === 'letter';
      const isRoman = r.type === 'roman';
      const bgStyle = isLetter
        ? 'font-weight:700;background:#f0fdf4;'
        : isRoman ? 'font-weight:600;' : '';
      const indent = isRoman ? 'padding-left:20px;' : r.type === 'arabic' ? 'padding-left:36px;' : '';
      const fs = r.type === 'arabic' ? 'font-size:9px;' : '';
      return `<tr style="${bgStyle}${fs}">
        <td style="width:36px;text-align:center;padding:3px 4px;border-bottom:1px solid #e5e7eb;color:#6b7280;">${r.row_code || ''}</td>
        <td style="${indent}padding:3px 6px;border-bottom:1px solid #e5e7eb;">${r.name || ''}</td>
        <td style="width:80px;text-align:right;padding:3px 6px;border-bottom:1px solid #e5e7eb;font-variant-numeric:tabular-nums;">${fmt(Number(r.prior_year_balance) || 0)}</td>
        <td style="width:80px;text-align:right;padding:3px 6px;border-bottom:1px solid #e5e7eb;font-variant-numeric:tabular-nums;">${fmt(Number(r.current_balance) || 0)}</td>
      </tr>`;
    }).join('');

    // Total row
    const totalTr = totalRow ? `<tr style="font-weight:700;background:#1f2937;color:white;">
      <td style="padding:5px 6px;" colspan="2">${totalRow.name || title}</td>
      <td style="width:80px;text-align:right;padding:5px 6px;font-variant-numeric:tabular-nums;">${fmt(Number(totalRow.prior_year_balance) || 0)}</td>
      <td style="width:80px;text-align:right;padding:5px 6px;font-variant-numeric:tabular-nums;">${fmt(Number(totalRow.current_balance) || 0)}</td>
    </tr>` : '';

    return `
      <h3 style="margin:18px 0 6px;color:#1f2937;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;border-left:3px solid #10b981;padding-left:8px;">${title}</h3>
      <table style="width:100%;border-collapse:collapse;font-size:10px;font-family:'Inter',sans-serif;">
        <thead><tr style="background:#f9fafb;border-bottom:2px solid #d1d5db;">
          <th style="width:36px;padding:5px 4px;text-align:center;color:#6b7280;font-size:9px;">Sor</th>
          <th style="padding:5px 6px;text-align:left;color:#6b7280;font-size:9px;">Megnevezés</th>
          <th style="width:80px;padding:5px 6px;text-align:right;color:#6b7280;font-size:9px;">Előző év</th>
          <th style="width:80px;padding:5px 6px;text-align:right;color:#6b7280;font-size:9px;">Tárgyév</th>
        </tr></thead>
        <tbody>${trs}${totalTr}</tbody>
      </table>`;
  };

  const pnlTableHtml = () => {
    if (!pnlRows.length) return '<p style="color:#999;font-style:italic;">Nincs adat</p>';
    const trs = pnlRows.map(r => {
      const isCap = r.type === 'capital';
      const bgStyle = isCap ? 'font-weight:700;background:#f0fdf4;' : '';
      const indent = !isCap ? 'padding-left:24px;' : '';
      const fs = !isCap ? 'font-size:9px;' : '';
      const val = Number(r.balance || 0) * Number(r.multiplier || 1);
      return `<tr style="${bgStyle}${fs}">
        <td style="width:36px;text-align:center;padding:3px 4px;border-bottom:1px solid #e5e7eb;color:#6b7280;">${r.row_code || ''}</td>
        <td style="${indent}padding:3px 6px;border-bottom:1px solid #e5e7eb;">${r.name || ''}</td>
        <td style="width:80px;text-align:right;padding:3px 6px;border-bottom:1px solid #e5e7eb;font-variant-numeric:tabular-nums;">${fmt(val)}</td>
      </tr>`;
    }).join('');
    return `
      <table style="width:100%;border-collapse:collapse;font-size:10px;font-family:'Inter',sans-serif;">
        <thead><tr style="background:#f9fafb;border-bottom:2px solid #d1d5db;">
          <th style="width:36px;padding:5px 4px;text-align:center;color:#6b7280;font-size:9px;">Sor</th>
          <th style="padding:5px 6px;text-align:left;color:#6b7280;font-size:9px;">Megnevezés</th>
          <th style="width:80px;padding:5px 6px;text-align:right;color:#6b7280;font-size:9px;">Tárgyév (E Ft)</th>
        </tr></thead>
        <tbody>${trs}</tbody>
      </table>`;
  };

  // ── Variable replacement for notes templates ──
  const replaceVars = (text: string): string => {
    // Compute financial metrics from frozen data
    const bs = data.frozenBsData || [];
    const equityTotal = bs.filter((r: any) => r.section === 'liabilities' && (r.row_code || '').startsWith('D') && r.type === 'letter')
      .reduce((a: number, r: any) => a + Number(r.current_balance || 0), 0);
    const equityPrior = bs.filter((r: any) => r.section === 'liabilities' && (r.row_code || '').startsWith('D') && r.type === 'letter')
      .reduce((a: number, r: any) => a + Number(r.prior_year_balance || 0), 0);
    const totalAssetVal = bs.filter((r: any) => r.section === 'assets' && r.type === 'total')
      .reduce((a: number, r: any) => a + Number(r.current_balance || 0), 0);
    const currentAssetsVal = bs.filter((r: any) => r.section === 'assets' && (r.row_code || '').startsWith('B') && r.type === 'letter')
      .reduce((a: number, r: any) => a + Number(r.current_balance || 0), 0);
    const shortTermLiab = bs.filter((r: any) => r.section === 'liabilities' && (r.row_code || '').startsWith('F') && r.type === 'letter')
      .reduce((a: number, r: any) => a + Number(r.current_balance || 0), 0);
    const roe = equityTotal > 0 ? ((data.netIncome / equityTotal) * 100).toFixed(1) : '0.0';
    const liquidity = shortTermLiab > 0 ? (currentAssetsVal / shortTermLiab).toFixed(2) : 'N/A';
    const liquidityEval = Number(liquidity) >= 1.3 ? 'biztonsággal fedezik' : Number(liquidity) >= 1.0 ? 'éppen fedezik' : 'nem fedezik';

    const vars: Record<string, string> = {
      '[Cégnév]': data.companyName || '___',
      '[Székhely]': data.companyAddress || '___',
      '[Adószám]': data.companyTaxNumber || '___',
      '[Tárgyév]': String(data.fiscalYear),
      '[Tárgyév+1]': String(data.fiscalYear + 1),
      '[Képviselő neve]': data.representativeName || '___',
      '[Képviselő beosztása]': data.representativeRole || 'ügyvezető',
      '[Saját tőke]': fmt(equityTotal),
      '[Saját tőke változás]': equityTotal >= equityPrior ? 'növekedett' : 'csökkent',
      '[Mérlegfőösszeg]': fmt(totalAssetVal),
      '[ROE]': roe,
      '[Likviditás]': liquidity,
      '[Likviditás értékelés]': liquidityEval,
      '[Adózott eredmény]': fmt(data.netIncome || 0),
      '[Osztalék]': fmt(data.dividendAmount || 0),
      '[Eredménytartalék]': fmt(data.retainedEarnings || 0),
    };
    let result = text;
    for (const [key, val] of Object.entries(vars)) {
      result = result.replaceAll(key, val);
    }
    return result;
  };

  const notesHtml = () => {
    const templates = data.notesTemplates || [];
    // DB templates
    const templateHtml = templates.map(tmpl => {
      const saved = data.notesSections?.find(s => s.section_key === tmpl.section_key);
      const rawText = saved?.text || tmpl.default_text || '';
      const text = replaceVars(rawText).replace(/\n/g, '<br>');

      // Build dynamic table HTML for specific sections
      let dynamicTableHtml = '';

      // TENY asset movement table
      if (tmpl.section_key === 'asset_movement' && data.assetMovement) {
        const am = data.assetMovement;
        dynamicTableHtml = `
          <table style="width:80%;border-collapse:collapse;font-size:9.5px;margin:10px 0 6px 11px;">
            <thead><tr style="background:#f0fdf4;border-bottom:2px solid #d1d5db;">
              <th style="padding:5px 8px;text-align:left;font-size:9px;color:#6b7280;">Mutató</th>
              <th style="padding:5px 8px;text-align:right;font-size:9px;color:#6b7280;">Érték</th>
            </tr></thead>
            <tbody>
              <tr><td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;">Összes eszköz (db)</td><td style="padding:4px 8px;text-align:right;border-bottom:1px solid #e5e7eb;">${am.total}</td></tr>
              <tr><td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;">Aktív eszközök</td><td style="padding:4px 8px;text-align:right;border-bottom:1px solid #e5e7eb;">${am.active}</td></tr>
              <tr><td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;">Kivezetett eszközök</td><td style="padding:4px 8px;text-align:right;border-bottom:1px solid #e5e7eb;">${am.disposed}</td></tr>
              <tr style="font-weight:600;"><td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;">Bruttó érték összesen</td><td style="padding:4px 8px;text-align:right;border-bottom:1px solid #e5e7eb;">${fmtFull(am.totalAcquisition)} Ft</td></tr>
              <tr><td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;">Aktív eszközök bruttó értéke</td><td style="padding:4px 8px;text-align:right;border-bottom:1px solid #e5e7eb;">${fmtFull(am.activeAcquisition)} Ft</td></tr>
            </tbody>
          </table>`;
      }

      // Equity changes table
      if (tmpl.section_key === 'equity_changes' && data.equityRows && data.equityRows.length > 0) {
        const eqRows = data.equityRows.map((r: any) => `
          <tr>
            <td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:8px;">${r.row_code || ''}</td>
            <td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;">${r.name || ''}</td>
            <td style="padding:4px 8px;text-align:right;border-bottom:1px solid #e5e7eb;font-variant-numeric:tabular-nums;">${fmt(Number(r.prior_year_balance) || 0)} E</td>
            <td style="padding:4px 8px;text-align:right;border-bottom:1px solid #e5e7eb;font-variant-numeric:tabular-nums;">${fmt(Number(r.current_balance) || 0)} E</td>
          </tr>`).join('');
        dynamicTableHtml = `
          <table style="width:90%;border-collapse:collapse;font-size:9.5px;margin:10px 0 6px 11px;">
            <thead><tr style="background:#f0fdf4;border-bottom:2px solid #d1d5db;">
              <th style="padding:5px 8px;text-align:left;font-size:9px;color:#6b7280;">Sor</th>
              <th style="padding:5px 8px;text-align:left;font-size:9px;color:#6b7280;">Megnevezés</th>
              <th style="padding:5px 8px;text-align:right;font-size:9px;color:#6b7280;">Előző év</th>
              <th style="padding:5px 8px;text-align:right;font-size:9px;color:#6b7280;">Tárgyév</th>
            </tr></thead>
            <tbody>${eqRows}</tbody>
          </table>`;
      }

      // Salary/headcount table
      if (tmpl.section_key === 'employee_info' && data.salaryMetrics) {
        const sm = data.salaryMetrics;
        dynamicTableHtml = `
          <table style="width:80%;border-collapse:collapse;font-size:9.5px;margin:10px 0 6px 11px;">
            <thead><tr style="background:#f0fdf4;border-bottom:2px solid #d1d5db;">
              <th style="padding:5px 8px;text-align:left;font-size:9px;color:#6b7280;">Mutató</th>
              <th style="padding:5px 8px;text-align:right;font-size:9px;color:#6b7280;">Érték</th>
            </tr></thead>
            <tbody>
              <tr><td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;">Átlagos létszám</td><td style="padding:4px 8px;text-align:right;border-bottom:1px solid #e5e7eb;">${sm.headcount} fő</td></tr>
              <tr><td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;">Bérköltség</td><td style="padding:4px 8px;text-align:right;border-bottom:1px solid #e5e7eb;">${fmtFull(sm.totalWages)} Ft</td></tr>
              <tr><td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;">Bérjárulékok</td><td style="padding:4px 8px;text-align:right;border-bottom:1px solid #e5e7eb;">${fmtFull(sm.totalContrib)} Ft</td></tr>
              <tr style="font-weight:600;"><td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;">Összes személyi jellegű ráfordítás</td><td style="padding:4px 8px;text-align:right;border-bottom:1px solid #e5e7eb;">${fmtFull(sm.total)} Ft</td></tr>
            </tbody>
          </table>`;
      }

      // Remove placeholder markers like [AUTOMATIKUS TÁBLÁZAT...] from text
      const cleanText = text.replace(/\[AUTOMATIKUS TÁBLÁZAT[^\]]*\]/g, '');

      return `
        <div style="margin-bottom:18px;page-break-inside:avoid;">
          <h3 style="margin:0 0 4px;color:#1f2937;font-size:12px;border-left:3px solid #10b981;padding-left:8px;">${tmpl.section_title}</h3>
          <p style="margin:0;font-size:9.5px;line-height:1.6;color:#374151;padding-left:11px;">${cleanText}</p>
          ${dynamicTableHtml}
        </div>`;
    }).join('');

    // Custom sections added by user
    const customSections = (data.notesSections || []).filter(s => (s as any).is_custom);
    const customHtml = customSections.map(s => {
      const text = replaceVars(s.text || '').replace(/\n/g, '<br>');
      return `
        <div style="margin-bottom:18px;page-break-inside:avoid;">
          <h3 style="margin:0 0 4px;color:#1f2937;font-size:12px;border-left:3px solid #6366f1;padding-left:8px;">${(s as any).title || 'Egyéni szekció'}</h3>
          <p style="margin:0;font-size:9.5px;line-height:1.6;color:#374151;padding-left:11px;">${text}</p>
        </div>`;
    }).join('');

    return templateHtml + customHtml;
  };

  const dividendHtml = () => {
    if (!data.netIncome || data.netIncome <= 0) return '';
    return `
      <div style="page-break-before:always;padding-top:30px;">
        <h2 style="color:#1f2937;font-size:15px;border-bottom:2px solid #1f2937;padding-bottom:5px;margin-bottom:16px;">4. EREDMÉNYFELOSZTÁS</h2>
        <table style="width:55%;border-collapse:collapse;font-size:10.5px;margin-bottom:20px;">
          <tr><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">Adózott eredmény</td><td style="text-align:right;padding:6px 8px;border-bottom:1px solid #e5e7eb;font-weight:700;">${fmtFull(data.netIncome)} Ft</td></tr>
          <tr><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">Osztalék</td><td style="text-align:right;padding:6px 8px;border-bottom:1px solid #e5e7eb;">${fmtFull(data.dividendAmount)} Ft</td></tr>
          <tr style="font-weight:700;"><td style="padding:6px 8px;border-bottom:2px solid #1f2937;">Eredménytartalékba</td><td style="text-align:right;padding:6px 8px;border-bottom:2px solid #1f2937;">${fmtFull(data.retainedEarnings)} Ft</td></tr>
        </table>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:14px 16px;max-width:520px;margin-bottom:30px;">
          <p style="font-size:9.5px;line-height:1.7;color:#374151;font-style:italic;margin:0;">
            „A(z) ${data.companyName} taggyűlése ${data.dividendResolutionDate || '...'}-án megtartott
            ülésén a ${data.fiscalYear}. üzleti év ${fmtFull(data.netIncome)} Ft
            adózott eredményéből ${fmtFull(data.dividendAmount)} Ft osztalék
            kifizetéséről döntött. A fennmaradó ${fmtFull(data.retainedEarnings)} Ft
            az eredménytartalékba kerül."
          </p>
        </div>
        <div style="margin-top:50px;">
          <div style="display:inline-block;text-align:center;">
            <div style="width:200px;border-top:1px solid #374151;padding-top:6px;font-size:10px;">${data.representativeName || 'Képviselő'}</div>
            <div style="font-size:9px;color:#6b7280;margin-top:2px;">${data.representativeRole || 'ügyvezető'}</div>
          </div>
        </div>
      </div>`;
  };

  const html = `<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="UTF-8">
  <title>Beszámoló — ${data.companyName} — ${data.fiscalYear}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    @page { size: A4; margin: 18mm 16mm; }
    @media print {
      body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .no-print { display: none !important; }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', -apple-system, 'Segoe UI', sans-serif; color: #1f2937; font-size: 10.5px; line-height: 1.5; }
    table { font-variant-numeric: tabular-nums; }

    .cover { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; text-align: center; page-break-after: always; background: linear-gradient(180deg, #ffffff 0%, #f9fafb 100%); }
    .cover-accent { width: 50px; height: 3px; background: linear-gradient(90deg, #10b981, #059669); border-radius: 2px; margin-bottom: 28px; }
    .cover-title { font-size: 28px; font-weight: 700; color: #111827; letter-spacing: 3px; text-transform: uppercase; }
    .cover-year { font-size: 18px; color: #6b7280; margin-top: 8px; font-weight: 500; }
    .cover-divider { width: 30px; height: 1px; background: #d1d5db; margin: 24px auto; }
    .cover-company { font-size: 16px; font-weight: 600; color: #374151; }
    .cover-meta { margin-top: 40px; font-size: 10px; color: #9ca3af; line-height: 2; }
    .cover-badge { margin-top: 60px; font-size: 8px; color: #d1d5db; letter-spacing: 2px; text-transform: uppercase; }

    .section { page-break-before: always; padding-top: 10px; }
    .section-title { font-size: 15px; font-weight: 700; color: #111827; border-bottom: 2px solid #111827; padding-bottom: 5px; margin-bottom: 14px; letter-spacing: 0.5px; }
    .section-subtitle { font-size: 10px; color: #9ca3af; margin-bottom: 14px; }

    .print-btn { position: fixed; top: 16px; right: 16px; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; z-index: 1000; box-shadow: 0 4px 14px rgba(16,185,129,0.3); transition: transform 0.15s; }
    .print-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(16,185,129,0.4); }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">📄 Nyomtatás / Mentés PDF-ként</button>

  <!-- COVER -->
  <div class="cover">
    <div class="cover-accent"></div>
    <div class="cover-title">Éves Beszámoló</div>
    <div class="cover-year">${data.fiscalYear}. üzleti év</div>
    <div class="cover-divider"></div>
    <div class="cover-company">${data.companyName}</div>
    <div class="cover-meta">
      Készítette: ${data.representativeName}<br>
      Beosztás: ${data.representativeRole}<br>
      Kelt: ${data.reportDate}
    </div>
    <div class="cover-badge">Generálta: Visibill</div>
  </div>

  <!-- BALANCE SHEET -->
  <div class="section">
    <h2 class="section-title">1. MÉRLEG</h2>
    <p class="section-subtitle">${data.fiscalYear}. december 31. — adatok ezer forintban (E Ft)</p>
    ${bsTableHtml(assets, 'Eszközök (Aktívák)', totalAssets)}
    <div style="height:16px;"></div>
    ${bsTableHtml(liabilities, 'Források (Passzívák)', totalLiab)}
  </div>

  <!-- P&L -->
  <div class="section">
    <h2 class="section-title">2. EREDMÉNYKIMUTATÁS</h2>
    <p class="section-subtitle">${data.fiscalYear}. január 1. – december 31. — adatok ezer forintban (E Ft)</p>
    ${pnlTableHtml()}
  </div>

  <!-- NOTES -->
  <div class="section">
    <h2 class="section-title">3. KIEGÉSZÍTŐ MELLÉKLET</h2>
    ${notesHtml()}
  </div>

  <!-- DIVIDEND -->
  ${dividendHtml()}

</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
};
