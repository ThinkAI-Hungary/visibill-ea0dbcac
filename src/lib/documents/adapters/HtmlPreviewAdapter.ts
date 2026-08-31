/**
 * HTML Preview and Print Adapter for DocumentEngine.
 * Generates standalone, printable HTML documents.
 */

import { DocumentDescriptor } from '../core/types';
import { escapeXml } from '../encoding/xmlSanitizer';
import { formatHungarianDate } from '../encoding/hungarianEncoding';

export class HtmlPreviewAdapter {
  /**
   * Generates a complete standalone HTML document with embedded CSS.
   */
  public static renderToHtml(descriptor: DocumentDescriptor): string {
    const raw = descriptor.rawPayload || {};
    if (raw.customHtml) {
      return raw.customHtml;
    }

    const dateStr = formatHungarianDate(descriptor.metadata.generatedAt || new Date());
    const title = escapeXml(descriptor.metadata.title);
    const company = escapeXml(descriptor.metadata.companyName || '');
    const period = escapeXml(descriptor.metadata.period || '');

    const sectionsHtml = descriptor.sections.map(section => {
      if (section.type === 'table') {
        const headers = section.headers || (section.columns ? section.columns.map(c => c.header) : []);
        const thHtml = headers.map(h => `<th>${escapeXml(h)}</th>`).join('');
        const rowsHtml = section.rows.map(r => {
          const cellsHtml = r.map(c => `<td>${escapeXml(c)}</td>`).join('');
          return `<tr>${cellsHtml}</tr>`;
        }).join('');

        let footersHtml = '';
        if (section.footers && section.footers.length > 0) {
          const fCells = section.footers.map(f => `<tr><td colspan="${headers.length - 1 || 1}" style="font-weight:bold;text-align:right;">${escapeXml(f.label)}</td><td style="font-weight:bold;">${escapeXml(f.value)}</td></tr>`).join('');
          footersHtml = `<tfoot>${fCells}</tfoot>`;
        }

        return `
        <div class="section">
          ${section.title ? `<h3 class="section-title">${escapeXml(section.title)}</h3>` : ''}
          <table>
            <thead><tr>${thHtml}</tr></thead>
            <tbody>${rowsHtml}</tbody>
            ${footersHtml}
          </table>
        </div>`;
      }

      if (section.type === 'key-value') {
        const itemsHtml = section.items.map(it => `
          <div class="kv-item ${it.highlight ? 'highlight' : ''}">
            <span class="kv-label">${escapeXml(it.label)}:</span>
            <span class="kv-value">${escapeXml(it.value)}</span>
          </div>`).join('');
        return `
        <div class="section">
          ${section.title ? `<h3 class="section-title">${escapeXml(section.title)}</h3>` : ''}
          <div class="kv-grid">${itemsHtml}</div>
        </div>`;
      }

      if (section.type === 'text') {
        return `
        <div class="section ${section.style || ''}">
          ${section.title ? `<h3 class="section-title">${escapeXml(section.title)}</h3>` : ''}
          <p>${escapeXml(section.content).replace(/\n/g, '<br/>')}</p>
        </div>`;
      }

      if (section.type === 'html') {
        return section.html;
      }

      return '';
    }).join('\n');

    return `<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@600;700&display=swap');
    
    @page { size: A4 portrait; margin: 15mm 12mm 15mm 12mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Inter', sans-serif;
      font-size: 11px;
      line-height: 1.4;
      color: #1e293b;
      background: #ffffff;
      margin: 0;
      padding: 24px;
    }
    .no-print { display: block; margin-bottom: 20px; }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
    .btn-print {
      background: #0f7467;
      color: white;
      border: none;
      border-radius: 6px;
      padding: 8px 16px;
      font-weight: 600;
      cursor: pointer;
    }
    .header-bar {
      background: #0f7467;
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .doc-title { font-family: 'Outfit', sans-serif; font-size: 18px; font-weight: 700; margin: 0; }
    .doc-meta { font-size: 10px; opacity: 0.9; text-align: right; }
    .section { margin-bottom: 20px; }
    .section-title {
      font-family: 'Outfit', sans-serif;
      font-size: 12px;
      font-weight: 700;
      color: #0f7467;
      border-bottom: 1.5px solid #e2e8f0;
      padding-bottom: 4px;
      margin-bottom: 8px;
    }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 10px; }
    th { background: #f8fafc; color: #475569; font-weight: 600; text-align: left; padding: 6px 8px; border-bottom: 2px solid #cbd5e1; }
    td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; }
    tr:nth-child(even) td { background: #f8fafc; }
    .kv-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px; }
    .kv-item { display: flex; justify-content: space-between; padding: 4px 8px; background: #f8fafc; border-radius: 4px; }
    .kv-item.highlight { background: #e6f4f1; font-weight: 600; color: #0f7467; }
    .kv-label { color: #64748b; }
    .footer { margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 9px; color: #94a3b8; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <div class="no-print">
    <button class="btn-print" onclick="window.print()">📄 Nyomtatás / Mentés PDF-ként</button>
  </div>

  <div class="header-bar">
    <div>
      <h1 class="doc-title">${title}</h1>
      ${company ? `<div style="font-size:11px;margin-top:2px;">${company}</div>` : ''}
    </div>
    <div class="doc-meta">
      <div>Kelt: ${dateStr}</div>
      ${period ? `<div>Időszak: ${period}</div>` : ''}
    </div>
  </div>

  ${sectionsHtml}

  <div class="footer">
    <div>${title} — eaisybill-prod</div>
    <div>Generálva: ${dateStr}</div>
  </div>
</body>
</html>`;
  }
}
