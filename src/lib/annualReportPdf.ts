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
const esc = (s: unknown): string => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function renderAssetMovementTable(am: any): string {
  return `
    <table style="width:80%;border-collapse:collapse;font-size:9.5px;margin:10px 0 6px 11px;font-family:'Inter',sans-serif;">
      <thead><tr style="background:#f1f5f9;border-bottom:2px solid #e2e8f0;">
        <th style="padding:6px 8px;text-align:left;font-family:'Outfit',sans-serif;font-size:9px;color:#475569;font-weight:600;text-transform:uppercase;">Mutató</th>
        <th style="padding:6px 8px;text-align:right;font-family:'Outfit',sans-serif;font-size:9px;color:#475569;font-weight:600;text-transform:uppercase;">Érték</th>
      </tr></thead>
      <tbody>
        <tr><td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;color:#334155;">Összes eszköz (db)</td><td style="padding:5px 8px;text-align:right;border-bottom:1px solid #e2e8f0;font-variant-numeric:tabular-nums;color:#334155;font-weight:600;">${am.total}</td></tr>
        <tr><td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;color:#334155;">Aktív eszközök</td><td style="padding:5px 8px;text-align:right;border-bottom:1px solid #e2e8f0;font-variant-numeric:tabular-nums;color:#334155;font-weight:600;">${am.active}</td></tr>
        <tr><td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;color:#334155;">Kivezetett eszközök</td><td style="padding:5px 8px;text-align:right;border-bottom:1px solid #e2e8f0;font-variant-numeric:tabular-nums;color:#334155;font-weight:600;">${am.disposed}</td></tr>
        <tr style="font-weight:700;background:#f8fafc;"><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;color:#334155;">Bruttó érték összesen</td><td style="padding:6px 8px;text-align:right;border-bottom:1px solid #e2e8f0;font-variant-numeric:tabular-nums;color:#0f7467;">${fmtFull(am.totalAcquisition)} Ft</td></tr>
        <tr><td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;color:#334155;">Aktív eszközök bruttó értéke</td><td style="padding:5px 8px;text-align:right;border-bottom:1px solid #e2e8f0;font-variant-numeric:tabular-nums;color:#334155;font-weight:600;">${fmtFull(am.activeAcquisition)} Ft</td></tr>
      </tbody>
    </table>`;
}

function renderEquityChangesTable(equityRows: any[]): string {
  const eqRows = equityRows.map((r: any) => `
    <tr>
      <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-family:monospace;font-size:8px;color:#64748b;">${r.row_code || ''}</td>
      <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;color:#334155;">${r.name || ''}</td>
      <td style="padding:5px 8px;text-align:right;border-bottom:1px solid #e2e8f0;font-variant-numeric:tabular-nums;color:#334155;">${fmt(Number(r.prior_year_balance) || 0)} E</td>
      <td style="padding:5px 8px;text-align:right;border-bottom:1px solid #e2e8f0;font-variant-numeric:tabular-nums;color:#334155;font-weight:600;">${fmt(Number(r.current_balance) || 0)} E</td>
    </tr>`).join('');
  return `
    <table style="width:90%;border-collapse:collapse;font-size:9.5px;margin:10px 0 6px 11px;font-family:'Inter',sans-serif;">
      <thead><tr style="background:#f1f5f9;border-bottom:2px solid #e2e8f0;">
        <th style="padding:6px 8px;text-align:left;font-family:'Outfit',sans-serif;font-size:9px;color:#475569;font-weight:600;text-transform:uppercase;width:36px;">Sor</th>
        <th style="padding:6px 8px;text-align:left;font-family:'Outfit',sans-serif;font-size:9px;color:#475569;font-weight:600;text-transform:uppercase;">Megnevezés</th>
        <th style="padding:6px 8px;text-align:right;font-family:'Outfit',sans-serif;font-size:9px;color:#475569;font-weight:600;text-transform:uppercase;width:80px;">Előző év</th>
        <th style="padding:6px 8px;text-align:right;font-family:'Outfit',sans-serif;font-size:9px;color:#475569;font-weight:600;text-transform:uppercase;width:80px;">Tárgyév</th>
      </tr></thead>
      <tbody>${eqRows}</tbody>
    </table>`;
}

function renderSalaryMetricsTable(sm: any): string {
  return `
    <table style="width:80%;border-collapse:collapse;font-size:9.5px;margin:10px 0 6px 11px;font-family:'Inter',sans-serif;">
      <thead><tr style="background:#f1f5f9;border-bottom:2px solid #e2e8f0;">
        <th style="padding:6px 8px;text-align:left;font-family:'Outfit',sans-serif;font-size:9px;color:#475569;font-weight:600;text-transform:uppercase;">Mutató</th>
        <th style="padding:6px 8px;text-align:right;font-family:'Outfit',sans-serif;font-size:9px;color:#475569;font-weight:600;text-transform:uppercase;">Érték</th>
      </tr></thead>
      <tbody>
        <tr><td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;color:#334155;">Átlagos létszám</td><td style="padding:5px 8px;text-align:right;border-bottom:1px solid #e2e8f0;font-variant-numeric:tabular-nums;color:#334155;font-weight:600;">${sm.headcount} fő</td></tr>
        <tr><td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;color:#334155;">Bérköltség</td><td style="padding:5px 8px;text-align:right;border-bottom:1px solid #e2e8f0;font-variant-numeric:tabular-nums;color:#334155;font-weight:600;">${fmtFull(sm.totalWages)} Ft</td></tr>
        <tr><td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;color:#334155;">Bérjárulékok</td><td style="padding:5px 8px;text-align:right;border-bottom:1px solid #e2e8f0;font-variant-numeric:tabular-nums;color:#334155;font-weight:600;">${fmtFull(sm.totalContrib)} Ft</td></tr>
        <tr style="font-weight:700;background:#f8fafc;"><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;color:#334155;">Összes személyi jellegű ráfordítás</td><td style="padding:6px 8px;text-align:right;border-bottom:1px solid #e2e8f0;font-variant-numeric:tabular-nums;color:#0f7467;">${fmtFull(sm.total)} Ft</td></tr>
      </tbody>
    </table>`;
}

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


function buildAnnualReportHtml(data: AnnualReportData): string {
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
        ? 'font-weight:700;background:#f8fafc;'
        : isRoman ? 'font-weight:600;' : '';
      const indent = isRoman ? 'padding-left:20px;' : r.type === 'arabic' ? 'padding-left:36px;' : '';
      const fs = r.type === 'arabic' ? 'font-size:9px;' : '';
      return `<tr style="${bgStyle}${fs}">
        <td style="width:36px;text-align:center;padding:5px 4px;border-bottom:1px solid #e2e8f0;color:#64748b;">${r.row_code || ''}</td>
        <td style="${indent}padding:5px 6px;border-bottom:1px solid #e2e8f0;color:#334155;">${r.name || ''}</td>
        <td style="width:80px;text-align:right;padding:5px 6px;border-bottom:1px solid #e2e8f0;font-variant-numeric:tabular-nums;color:#334155;">${fmt(Number(r.prior_year_balance) || 0)}</td>
        <td style="width:80px;text-align:right;padding:5px 6px;border-bottom:1px solid #e2e8f0;font-variant-numeric:tabular-nums;color:#334155;">${fmt(Number(r.current_balance) || 0)}</td>
      </tr>`;
    }).join('');

    // Total row
    const totalTr = totalRow ? `<tr style="font-weight:700;background:#f1f5f9;color:#1e293b;border-top:2px solid #cbd5e1;border-bottom:2px solid #cbd5e1;">
      <td style="padding:6px 6px;" colspan="2">${totalRow.name || title}</td>
      <td style="width:80px;text-align:right;padding:6px 6px;font-variant-numeric:tabular-nums;">${fmt(Number(totalRow.prior_year_balance) || 0)}</td>
      <td style="width:80px;text-align:right;padding:6px 6px;font-variant-numeric:tabular-nums;">${fmt(Number(totalRow.current_balance) || 0)}</td>
    </tr>` : '';

    return `
      <h3 style="margin:20px 0 8px;color:#0f7467;font-family:'Outfit',sans-serif;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;border-left:3px solid #0f7467;padding-left:8px;">${title}</h3>
      <table style="width:100%;border-collapse:collapse;font-size:10px;font-family:'Inter',sans-serif;">
        <thead><tr style="background:#f1f5f9;border-bottom:2px solid #e2e8f0;">
          <th style="width:36px;padding:6px 4px;text-align:center;color:#475569;font-family:'Outfit',sans-serif;font-size:9px;font-weight:600;text-transform:uppercase;">Sor</th>
          <th style="padding:6px 6px;text-align:left;color:#475569;font-family:'Outfit',sans-serif;font-size:9px;font-weight:600;text-transform:uppercase;">Megnevezés</th>
          <th style="width:80px;padding:6px 6px;text-align:right;color:#475569;font-family:'Outfit',sans-serif;font-size:9px;font-weight:600;text-transform:uppercase;">Előző év</th>
          <th style="width:80px;padding:6px 6px;text-align:right;color:#475569;font-family:'Outfit',sans-serif;font-size:9px;font-weight:600;text-transform:uppercase;">Tárgyév</th>
        </tr></thead>
        <tbody>${trs}${totalTr}</tbody>
      </table>`;
  };

  const pnlTableHtml = () => {
    if (!pnlRows.length) return '<p style="color:#999;font-style:italic;">Nincs adat</p>';
    const trs = pnlRows.map(r => {
      const isCap = r.type === 'capital';
      const bgStyle = isCap ? 'font-weight:700;background:#f8fafc;' : '';
      const indent = !isCap ? 'padding-left:24px;' : '';
      const fs = !isCap ? 'font-size:9px;' : '';
      const val = Number(r.balance || 0) * Number(r.multiplier || 1);
      return `<tr style="${bgStyle}${fs}">
        <td style="width:36px;text-align:center;padding:5px 4px;border-bottom:1px solid #e2e8f0;color:#64748b;">${r.row_code || ''}</td>
        <td style="${indent}padding:5px 6px;border-bottom:1px solid #e2e8f0;color:#334155;">${r.name || ''}</td>
        <td style="width:80px;text-align:right;padding:5px 6px;border-bottom:1px solid #e2e8f0;font-variant-numeric:tabular-nums;color:#334155;">${fmt(val)}</td>
      </tr>`;
    }).join('');
    return `
      <table style="width:100%;border-collapse:collapse;font-size:10px;font-family:'Inter',sans-serif;">
        <thead><tr style="background:#f1f5f9;border-bottom:2px solid #e2e8f0;">
          <th style="width:36px;padding:6px 4px;text-align:center;color:#475569;font-family:'Outfit',sans-serif;font-size:9px;font-weight:600;text-transform:uppercase;">Sor</th>
          <th style="padding:6px 6px;text-align:left;color:#475569;font-family:'Outfit',sans-serif;font-size:9px;font-weight:600;text-transform:uppercase;">Megnevezés</th>
          <th style="width:80px;padding:6px 6px;text-align:right;color:#475569;font-family:'Outfit',sans-serif;font-size:9px;font-weight:600;text-transform:uppercase;">Tárgyév (E Ft)</th>
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

    const assetTable = data.assetMovement ? renderAssetMovementTable(data.assetMovement) : '<p style="font-size:9.5px;color:#999;font-style:italic;">Tárgyi eszköz adatok nem érhetők el.</p>';

    const equityTable = data.equityRows && data.equityRows.length > 0 ? renderEquityChangesTable(data.equityRows) : '<p style="font-size:9.5px;color:#999;font-style:italic;">Saját tőke adatok nem érhetők el.</p>';

    const salaryTable = data.salaryMetrics ? renderSalaryMetricsTable(data.salaryMetrics) : '<p style="font-size:9.5px;color:#999;font-style:italic;">Foglalkoztatotti adatok nem érhetők el.</p>';

    const vars: Record<string, string> = {
      '[Cégnév]': esc(data.companyName || '___'),
      '[Székhely]': esc(data.companyAddress || '___'),
      '[Adószám]': esc(data.companyTaxNumber || '___'),
      '[Tárgyév]': String(data.fiscalYear),
      '[Tárgyév+1]': String(data.fiscalYear + 1),
      '[Képviselő neve]': esc(data.representativeName || '___'),
      '[Képviselő beosztása]': esc(data.representativeRole || 'ügyvezető'),
      '[Saját tőke]': fmt(equityTotal),
      '[Saját tőke változás]': equityTotal >= equityPrior ? 'növekedett' : 'csökkent',
      '[Mérlegfőösszeg]': fmt(totalAssetVal),
      '[ROE]': roe,
      '[Likviditás]': liquidity,
      '[Likviditás értékelés]': liquidityEval,
      '[Adózott eredmény]': fmt(data.netIncome || 0),
      '[Osztalék]': fmt(data.dividendAmount || 0),
      '[Eredménytartalék]': fmt(data.retainedEarnings || 0),
      '[AUTOMATIKUS TÁBLÁZAT - TENY MODULBÓL]': assetTable,
      '[AUTOMATIKUS TÁBLÁZAT - MÉRLEG D. SOROKBÓL]': equityTable,
      '[AUTOMATIKUS TÁBLÁZAT - FOGLALKOZTATOTTI ADATOK]': salaryTable,
    };
    // B10 FIX: Don't esc() the text body — it may contain intentional HTML from
    // the Rich Text Editor (<b>, <i>, <ul>, <li>, <br>, <p>, etc.).
    // Only escape the variable VALUES (already done above with esc()).
    // Sanitize: strip dangerous tags (script, iframe, etc.) but keep formatting.
    let result = text
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '');
    for (const [key, val] of Object.entries(vars)) {
      result = result.split(key).join(val);
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

      // Build dynamic table HTML for specific sections (fallback - only if not already replaced inline!)
      let dynamicTableHtml = '';

      // TENY asset movement table
      if (tmpl.section_key === 'asset_movement' && data.assetMovement && !rawText.includes('[AUTOMATIKUS TÁBLÁZAT - TENY MODULBÓL]')) {
        dynamicTableHtml = renderAssetMovementTable(data.assetMovement);
      }

      // Equity changes table
      if (tmpl.section_key === 'equity_changes' && data.equityRows && data.equityRows.length > 0 && !rawText.includes('[AUTOMATIKUS TÁBLÁZAT - MÉRLEG D. SOROKBÓL]')) {
        dynamicTableHtml = renderEquityChangesTable(data.equityRows);
      }

      // Salary/headcount table
      if (tmpl.section_key === 'employee_info' && data.salaryMetrics && !rawText.includes('[AUTOMATIKUS TÁBLÁZAT - FOGLALKOZTATOTTI ADATOK]')) {
        dynamicTableHtml = renderSalaryMetricsTable(data.salaryMetrics);
      }

      // Remove placeholder markers like [AUTOMATIKUS TÁBLÁZAT...] from text if they weren't replaced (should be none, but just in case)
      const cleanText = text.replace(/\[AUTOMATIKUS TÁBLÁZAT[^\]]*\]/g, '');

      // B10: Use the RTE HTML directly (don't wrap in <p> — it may contain <p>, <ul>, <ol> etc.)
      return `
        <div style="margin-bottom:18px;page-break-inside:avoid;">
          <h3 style="margin:0 0 4px;color:#0f7467;font-family:'Outfit',sans-serif;font-size:12px;border-left:3px solid #0f7467;padding-left:8px;">${esc(tmpl.section_title)}</h3>
          <div style="margin:0;font-size:9.5px;line-height:1.6;color:#374151;padding-left:11px;">${cleanText}</div>
          ${dynamicTableHtml}
        </div>`;
    }).join('');

    // Custom sections added by user
    const customSections = (data.notesSections || []).filter(s => (s as any).is_custom);
    const customHtml = customSections.map(s => {
      const text = replaceVars(s.text || '').replace(/\n/g, '<br>');
      return `
        <div style="margin-bottom:18px;page-break-inside:avoid;">
          <h3 style="margin:0 0 4px;color:#4f46e5;font-family:'Outfit',sans-serif;font-size:12px;border-left:3px solid #4f46e5;padding-left:8px;">${esc((s as any).title || 'Egyéni szekció')}</h3>
          <p style="margin:0;font-size:9.5px;line-height:1.6;color:#374151;padding-left:11px;">${text}</p>
        </div>`;
    }).join('');

    return templateHtml + customHtml;
  };

  const dividendHtml = () => {
    if (!data.netIncome || data.netIncome <= 0) return '';
    return `
      <div style="page-break-before:always;padding-top:30px;">
        <h2 style="color:#0f7467;font-family:'Outfit',sans-serif;font-size:15px;border-bottom:2px solid #e2e8f0;padding-bottom:6px;margin-bottom:16px;text-transform:uppercase;letter-spacing:0.5px;">4. EREDMÉNYFELOSZTÁS</h2>
        <table style="width:55%;border-collapse:collapse;font-size:10.5px;margin-bottom:20px;font-family:'Inter',sans-serif;">
          <tr><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;color:#334155;">Adózott eredmény</td><td style="text-align:right;padding:6px 8px;border-bottom:1px solid #e2e8f0;font-weight:700;font-variant-numeric:tabular-nums;color:#334155;">${fmtFull(data.netIncome)} Ft</td></tr>
          <tr><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;color:#334155;">Osztalék</td><td style="text-align:right;padding:6px 8px;border-bottom:1px solid #e2e8f0;font-weight:700;font-variant-numeric:tabular-nums;color:#334155;">${fmtFull(data.dividendAmount)} Ft</td></tr>
          <tr style="font-weight:700;background:#f8fafc;"><td style="padding:6px 8px;border-bottom:2px solid #cbd5e1;color:#1e293b;">Eredménytartalékba</td><td style="text-align:right;padding:6px 8px;border-bottom:2px solid #cbd5e1;font-variant-numeric:tabular-nums;color:#0f7467;">${fmtFull(data.retainedEarnings)} Ft</td></tr>
        </table>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #4f46e5;border-radius:12px;padding:16px 20px;max-width:520px;margin-bottom:30px;">
          <p style="font-size:9.5px;line-height:1.7;color:#334155;font-style:italic;margin:0;">
            „A(z) ${data.companyName} taggyűlése ${data.dividendResolutionDate || '...'}-án megtartott
            ülésén a ${data.fiscalYear}. üzleti év ${fmtFull(data.netIncome)} Ft
            adózott eredményéből ${fmtFull(data.dividendAmount)} Ft osztalék
            kifizetéséről döntött. A fennmaradó ${fmtFull(data.retainedEarnings)} Ft
            az eredménytartalékba kerül."
          </p>
        </div>
        <div style="margin-top:50px;">
          <div style="display:inline-block;text-align:center;">
            <div style="width:200px;border-top:1px solid #cbd5e1;padding-top:8px;font-family:'Outfit',sans-serif;font-size:10px;font-weight:600;color:#1e293b;">${data.representativeName || 'Képviselő'}</div>
            <div style="font-size:9px;color:#64748b;margin-top:2px;">${data.representativeRole || 'ügyvezető'}</div>
          </div>
        </div>
      </div>`;
  };

  const html = `<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="UTF-8">
  <title>Beszámoló — ${esc(data.companyName)} — ${data.fiscalYear}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    @page { size: A4; margin: 0; }
    @media print {
      body {
        padding: 20mm 15mm !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .no-print { display: none !important; }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { font-family: 'Inter', -apple-system, sans-serif; color: #1e293b; font-size: 10.5px; line-height: 1.5; background-color: #ffffff !important; -webkit-font-smoothing: antialiased; }
    table { font-variant-numeric: tabular-nums; }
    td, th { color: #334155; }
    tr { background-color: transparent; }

    .brand-logo {
      font-family: 'Outfit', sans-serif;
      font-size: 28px;
      font-weight: 500;
      color: #1e293b;
      letter-spacing: -0.5px;
      line-height: 1;
      display: inline-flex;
      align-items: center;
    }
    .brand-logo .highlight {
      color: #0f7467;
      font-weight: 800;
    }

    .cover { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; text-align: center; page-break-after: always; background: radial-gradient(circle at 50% 50%, #ffffff 0%, #f8fafc 100%); }
    .cover-title { font-family: 'Outfit', sans-serif; font-size: 32px; font-weight: 800; color: #0f7467; letter-spacing: 2px; text-transform: uppercase; margin-top: 20px; }
    .cover-year { font-family: 'Outfit', sans-serif; font-size: 18px; color: #64748b; margin-top: 8px; font-weight: 500; }
    .cover-divider { width: 40px; height: 1px; background: #cbd5e1; margin: 28px auto; }
    .cover-company { font-family: 'Outfit', sans-serif; font-size: 18px; font-weight: 700; color: #1e293b; }
    .cover-meta { margin-top: 48px; font-size: 11px; color: #64748b; line-height: 2; font-weight: 500; }
    .cover-badge { margin-top: 80px; font-family: 'Outfit', sans-serif; font-size: 9px; font-weight: 600; color: #94a3b8; letter-spacing: 2px; text-transform: uppercase; }

    .section { page-break-before: always; padding-top: 10px; }
    .section-title { font-family: 'Outfit', sans-serif; font-size: 16px; font-weight: 700; color: #0f7467; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 14px; letter-spacing: 0.5px; }
    .section-subtitle { font-size: 10px; color: #64748b; margin-bottom: 14px; font-weight: 500; }

    .print-btn { position: fixed; top: 16px; right: 16px; background: linear-gradient(135deg, #0f7467, #0d6459); color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; z-index: 1000; box-shadow: 0 4px 12px rgba(15,116,103,0.15); transition: all 0.2s ease; }
    .print-btn:hover { background: linear-gradient(135deg, #0d6459, #0b534a); box-shadow: 0 6px 16px rgba(15,116,103,0.25); transform: translateY(-1px); }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">📄 Nyomtatás / Mentés PDF-ként</button>

  <!-- COVER -->
  <div class="cover">
    <div class="brand-logo" style="margin-bottom: 24px;">
      e<span class="highlight">ai</span>sy<span class="highlight">Books</span>
    </div>
    <div class="cover-title">Éves Beszámoló</div>
    <div class="cover-year">${data.fiscalYear}. üzleti év</div>
    <div class="cover-divider"></div>
    <div class="cover-company">${esc(data.companyName)}</div>
    <div class="cover-meta">
      Készítette: ${esc(data.representativeName)}<br>
      Beosztás: ${esc(data.representativeRole)}<br>
      Kelt: ${esc(data.reportDate)}
    </div>
    <div class="cover-badge">Generálta: eaisybooks.hu</div>
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

  return html;
}

export const generateAnnualReportPdf = (data: AnnualReportData) => {
  const html = buildAnnualReportHtml(data);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
};

/**
 * Returns the generated HTML as a blob URL for live preview in an iframe.
 */
export const generateAnnualReportPreviewUrl = (data: AnnualReportData): string => {
  const html = buildAnnualReportHtml(data);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  return URL.createObjectURL(blob);
};
