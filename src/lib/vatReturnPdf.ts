/**
 * ÁFA Bevallás (2665) — PDF Export
 * Generates a print-ready HTML document mimicking the official NAV 2665 form.
 */

interface VatReturnPdfData {
  companyName: string;
  companyTaxNumber: string;
  companyAddress: string;
  periodYear: number;
  periodMonth: number;
  frequency: string; // 'H' | 'N'
  formRows: { row_number: string; label: string; section: string; has_base: boolean; has_tax: boolean; is_summary: boolean; sort_order: number }[];
  lines: { row_number: string; base_amount_rounded: number | null; tax_amount_rounded: number | null; is_calculated: boolean }[];
  mLines: { partner_name: string; partner_tax_number: string; invoice_count: number; base_amount_rounded: number; tax_amount_rounded: number; tax_5_amount: number; tax_18_amount: number; tax_27_amount: number }[];
}

const fmtEft = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return '';
  if (v === 0) return '0';
  return new Intl.NumberFormat('hu-HU').format(v);
};

const esc = (s: unknown): string => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const MONTHS = ['január','február','március','április','május','június','július','augusztus','szeptember','október','november','december'];

const SECTIONS = [
  { key: 'payable', title: 'I. A FIZETENDŐ ADÓ MEGÁLLAPÍTÁSA' },
  { key: 'detail', title: 'II. RÉSZLETEZŐ ADATOK' },
  { key: 'deductible', title: 'III. A LEVONHATÓ ADÓ MEGÁLLAPÍTÁSA' },
  { key: 'settlement', title: 'IV. ELSZÁMOLÁS' },
  { key: 'm_sheet', title: 'V. M-LAP ÖSSZESÍTŐ' },
];

function buildVatReturnHtml(data: VatReturnPdfData): string {
  const lineMap = new Map(data.lines.map(l => [l.row_number, l]));
  const periodLabel = data.frequency === 'H'
    ? `${data.periodYear}. ${MONTHS[data.periodMonth - 1]} hó`
    : `${data.periodYear}. ${Math.ceil(data.periodMonth / 3)}. negyedév`;

  const renderSection = (sectionKey: string) => {
    const rows = data.formRows.filter(r => r.section === sectionKey);
    if (rows.length === 0) return '';

    return rows.map(row => {
      const line = lineMap.get(row.row_number);
      const baseVal = line?.base_amount_rounded;
      const taxVal = line?.tax_amount_rounded;
      const isSummary = row.is_summary;

      return `<tr class="${isSummary ? 'summary-row' : ''} ${!line ? 'empty-row' : ''}">
        <td class="row-num">${esc(row.row_number)}.</td>
        <td class="row-label">${esc(row.label)}</td>
        <td class="row-val">${row.has_base ? fmtEft(baseVal) : ''}</td>
        <td class="row-val">${row.has_tax ? fmtEft(taxVal) : ''}</td>
      </tr>`;
    }).join('\n');
  };

  const mLapHtml = () => {
    if (!data.mLines.length) return '<p class="no-data">Nincs belföldi levonható számla az időszakban.</p>';
    return `
      <table class="m-table">
        <thead>
          <tr>
            <th>Partner neve</th>
            <th>Adószám</th>
            <th class="num">Számlák</th>
            <th class="num">Adóalap (eFt)</th>
            <th class="num">ÁFA (eFt)</th>
          </tr>
        </thead>
        <tbody>
          ${data.mLines.map(ml => `
            <tr>
              <td>${esc(ml.partner_name)}</td>
              <td class="mono">${esc(ml.partner_tax_number)}</td>
              <td class="num">${ml.invoice_count}</td>
              <td class="num">${fmtEft(ml.base_amount_rounded)}</td>
              <td class="num">${fmtEft(ml.tax_amount_rounded)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
  };

  return `<!DOCTYPE html>
<html lang="hu">
<head>
<meta charset="UTF-8">
<title>ÁFA Bevallás 2665 — ${esc(periodLabel)}</title>
<style>
  @page { size: A4; margin: 15mm 12mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    font-size: 9pt;
    color: #1a1a1a;
    line-height: 1.35;
    background: #fff;
  }
  .page { page-break-after: always; }
  .page:last-child { page-break-after: auto; }

  /* HEADER */
  .form-header {
    border: 2px solid #1a365d;
    padding: 12px 16px;
    margin-bottom: 14px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .form-header h1 {
    font-size: 14pt;
    font-weight: 800;
    color: #1a365d;
    letter-spacing: -0.3px;
  }
  .form-header .form-number {
    font-size: 20pt;
    font-weight: 900;
    color: #1a365d;
    letter-spacing: 2px;
  }
  .form-header .period-info {
    font-size: 10pt;
    color: #4a5568;
    margin-top: 3px;
  }

  /* COMPANY INFO */
  .company-info {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 20px;
    padding: 8px 12px;
    margin-bottom: 14px;
    border: 1px solid #cbd5e0;
    border-radius: 3px;
    font-size: 8.5pt;
  }
  .company-info .label { color: #718096; }
  .company-info .value { font-weight: 600; }

  /* SECTION HEADERS */
  .section-header {
    background: #1a365d;
    color: white;
    padding: 5px 10px;
    font-weight: 700;
    font-size: 9pt;
    margin-top: 10px;
    margin-bottom: 0;
    letter-spacing: 0.3px;
  }

  /* TABLE */
  table.main-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 8px;
    font-size: 8pt;
  }
  table.main-table th {
    background: #edf2f7;
    border: 1px solid #cbd5e0;
    padding: 4px 6px;
    text-align: center;
    font-weight: 700;
    font-size: 7.5pt;
    color: #2d3748;
  }
  table.main-table td {
    border: 1px solid #e2e8f0;
    padding: 3px 6px;
    vertical-align: top;
  }
  .row-num {
    width: 36px;
    text-align: center;
    font-weight: 700;
    font-family: 'Courier New', monospace;
    font-size: 8pt;
    color: #2b6cb0;
  }
  .row-label { font-size: 7.5pt; line-height: 1.25; }
  .row-val {
    width: 80px;
    text-align: right;
    font-family: 'Courier New', monospace;
    font-size: 8.5pt;
    font-weight: 500;
  }
  .summary-row td {
    background: #ebf8ff !important;
    font-weight: 700 !important;
    border-top: 2px solid #2b6cb0;
  }
  .summary-row .row-num { color: #c53030; }
  .empty-row td { color: #a0aec0; }

  /* M-LAP TABLE */
  table.m-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 8pt;
    margin-top: 4px;
  }
  table.m-table th {
    background: #edf2f7;
    border: 1px solid #cbd5e0;
    padding: 4px 6px;
    font-weight: 700;
    font-size: 7.5pt;
    text-align: left;
  }
  table.m-table td {
    border: 1px solid #e2e8f0;
    padding: 3px 6px;
  }
  .num { text-align: right !important; font-family: 'Courier New', monospace; }
  .mono { font-family: 'Courier New', monospace; font-size: 7.5pt; }
  .no-data { color: #a0aec0; font-style: italic; padding: 8px; }

  /* FOOTER */
  .form-footer {
    margin-top: 24px;
    border-top: 1px solid #cbd5e0;
    padding-top: 10px;
    display: flex;
    justify-content: space-between;
    font-size: 8pt;
    color: #718096;
  }
  .signature-line {
    width: 180px;
    border-top: 1px solid #1a1a1a;
    text-align: center;
    padding-top: 4px;
    margin-top: 40px;
    font-size: 8pt;
  }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>

<!-- PAGE 1: Header + Payable -->
<div class="page">
  <div class="form-header">
    <div>
      <h1>ÁLTALÁNOS FORGALMI ADÓ BEVALLÁS</h1>
      <div class="period-info">Bevallási időszak: <strong>${esc(periodLabel)}</strong></div>
    </div>
    <div style="text-align:right;">
      <div class="form-number">2665</div>
      <div style="font-size:7.5pt;color:#718096;">NAV nyomtatvány</div>
    </div>
  </div>

  <div class="company-info">
    <div><span class="label">Adózó neve:</span> <span class="value">${esc(data.companyName)}</span></div>
    <div><span class="label">Adószám:</span> <span class="value">${esc(data.companyTaxNumber || '—')}</span></div>
    <div><span class="label">Székhely:</span> <span class="value">${esc(data.companyAddress || '—')}</span></div>
    <div><span class="label">Bevallás típusa:</span> <span class="value">${data.frequency === 'H' ? 'Havi' : 'Negyedéves'}</span></div>
  </div>

  ${SECTIONS.filter(s => s.key === 'payable').map(sec => `
    <div class="section-header">${esc(sec.title)}</div>
    <table class="main-table">
      <thead>
        <tr><th style="width:36px;">Sor</th><th>Megnevezés</th><th style="width:80px;">Adóalap (eFt)</th><th style="width:80px;">Adó (eFt)</th></tr>
      </thead>
      <tbody>${renderSection(sec.key)}</tbody>
    </table>
  `).join('')}
</div>

<!-- PAGE 2: Detail + Deductible -->
<div class="page">
  ${SECTIONS.filter(s => s.key === 'detail' || s.key === 'deductible').map(sec => `
    <div class="section-header">${sec.title}</div>
    <table class="main-table">
      <thead>
        <tr><th style="width:36px;">Sor</th><th>Megnevezés</th><th style="width:80px;">Adóalap (eFt)</th><th style="width:80px;">Adó (eFt)</th></tr>
      </thead>
      <tbody>${renderSection(sec.key)}</tbody>
    </table>
  `).join('')}
</div>

<!-- PAGE 3: Settlement + M-Lap -->
<div class="page">
  ${SECTIONS.filter(s => s.key === 'settlement').map(sec => `
    <div class="section-header">${sec.title}</div>
    <table class="main-table">
      <thead>
        <tr><th style="width:36px;">Sor</th><th>Megnevezés</th><th style="width:80px;">Adóalap (eFt)</th><th style="width:80px;">Adó (eFt)</th></tr>
      </thead>
      <tbody>${renderSection(sec.key)}</tbody>
    </table>
  `).join('')}

  <div class="section-header">V. M-LAP — BELFÖLDI ÖSSZESÍTŐ JELENTÉS</div>
  ${mLapHtml()}

  ${SECTIONS.filter(s => s.key === 'm_sheet').map(sec => `
    <div class="section-header" style="margin-top:10px;">M-LAP ÖSSZESÍTŐ SOROK</div>
    <table class="main-table">
      <thead>
        <tr><th style="width:36px;">Sor</th><th>Megnevezés</th><th style="width:80px;">Adóalap (eFt)</th><th style="width:80px;">Adó (eFt)</th></tr>
      </thead>
      <tbody>${renderSection(sec.key)}</tbody>
    </table>
  `).join('')}

  <div class="form-footer">
    <div>
      <div>Kelt: .............................................</div>
    </div>
    <div>
      <div class="signature-line">az adózó vagy képviselője aláírása</div>
    </div>
  </div>
</div>

</body>
</html>`;
}

export const generateVatReturnPdf = (data: VatReturnPdfData) => {
  const html = buildVatReturnHtml(data);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
};

export const generateVatReturnPreviewUrl = (data: VatReturnPdfData): string => {
  const html = buildVatReturnHtml(data);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  return URL.createObjectURL(blob);
};
