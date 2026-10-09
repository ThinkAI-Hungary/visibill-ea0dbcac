/**
 * Turizmusfejlesztési hozzájárulás bevallás (26TFEJLH) — PDF Export & Nyomtatás
 * Hivatalos NAV ÁNYK nyomtatvány replikája alapján készített dokumentum generáló.
 */

import { escapeXml } from './documents/encoding/xmlSanitizer';
import { createPreviewBlobUrl } from './documents/core/downloadHelper';

export interface TfejlhPdfData {
  companyName: string;
  companyTaxNumber: string;
  year: number;
  month: number;
  frequency: string; // 'H' | 'N' | 'E'
  baseEtkezohely: number;
  baseEtterem: number;
  baseSzallas: number;
  baseBusz: number;
  agentName?: string;
  agentPhone?: string;
  isSelfRevision?: boolean;
  isRepeatedSelfRevision?: boolean;
  selfRevisionTaxDiff?: number;
  selfRevisionSurcharge?: number;
}

const esc = (s: unknown): string => escapeXml(s);

const toEzer = (n: number | null | undefined): number => {
  if (!n) return 0;
  return Math.round(n / 1000);
};

const fmtEzer = (n: number | null | undefined): string => {
  if (n === null || n === undefined || isNaN(n)) return '0';
  const rounded = Math.round(n);
  return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

export function buildTfejlhHtml(data: TfejlhPdfData): string {
  const formCode = `${data.year % 100}TFEJLH`;
  const y = String(data.year);

  // Dates
  let startStr = `${y}0101`;
  let endStr = `${y}1231`;
  let periodLabel = `${data.year}. év`;

  if (data.frequency === 'H') {
    const m = String(data.month).padStart(2, '0');
    const lastDay = new Date(data.year, data.month, 0).getDate();
    startStr = `${y}${m}01`;
    endStr = `${y}${m}${String(lastDay).padStart(2, '0')}`;
    periodLabel = `${data.year}.${m}.01 - ${data.year}.${m}.${lastDay}`;
  } else if (data.frequency === 'N') {
    const startM = String((data.month - 1) * 3 + 1).padStart(2, '0');
    const endM = data.month * 3;
    const lastDay = new Date(data.year, endM, 0).getDate();
    startStr = `${y}${startM}01`;
    endStr = `${y}${String(endM).padStart(2, '0')}${String(lastDay).padStart(2, '0')}`;
    periodLabel = `${data.year}. Q${data.month}`;
  }

  // Company info fallback
  const compName = data.companyName || (data as any).selectedCompany?.name || '';
  const compTax = data.companyTaxNumber || (data as any).selectedCompany?.tax_number || '';

  // Tax number parts
  const cleanTax = compTax.replace(/[^0-9]/g, '');
  const taxPart1 = cleanTax.slice(0, 8);
  const taxPart2 = cleanTax.slice(8, 9);
  const taxPart3 = cleanTax.slice(9, 11);

  // Bases in thousand HUF
  const ezerEtkezohely = toEzer(data.baseEtkezohely);
  const ezerEtterem = toEzer(data.baseEtterem);
  const ezerSzallas = toEzer(data.baseSzallas);
  const ezerBusz = toEzer(data.baseBusz);
  const ezerTotalBase = ezerEtkezohely + ezerEtterem + ezerSzallas + ezerBusz;
  const ezerTaxPayable = Math.round(ezerTotalBase * 0.04);

  const ezerDiff = toEzer(data.selfRevisionTaxDiff);
  const ezerPotlek = toEzer(data.selfRevisionSurcharge);

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const printTimestamp = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())} ${pad(now.getHours())}.${pad(now.getMinutes())}.${pad(now.getSeconds())}`;

  const renderBoxes = (str: string, len: number) => {
    const padded = str.padEnd(len, ' ').slice(0, len);
    return `<span class="char-boxes">${padded.split('').map(ch => `<span class="char-box">${ch === ' ' ? '&nbsp;' : ch}</span>`).join('')}</span>`;
  };

  return `<!DOCTYPE html>
<html lang="hu">
<head>
<meta charset="UTF-8">
<title>${formCode} — ${esc(data.companyName)} (${esc(periodLabel)})</title>
<style>
  @page { size: A4 portrait; margin: 10mm 12mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    font-size: 8.5pt;
    color: #111;
    line-height: 1.25;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page-container {
    width: 100%;
    max-width: 820px;
    margin: 0 auto;
    border: 2px solid #000;
    padding: 12px 16px;
    background: #fff;
  }

  /* HEADER */
  .header-grid {
    display: grid;
    grid-template-columns: 180px 1fr;
    border: 2px solid #000;
    margin-bottom: 8px;
  }
  .header-left {
    border-right: 2px solid #000;
    padding: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }
  .header-left img {
    height: 44px;
    width: auto;
    margin-bottom: 4px;
  }
  .header-left .nav-title {
    font-size: 7.5pt;
    font-weight: bold;
    text-transform: uppercase;
  }
  .header-right {
    padding: 10px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  .header-right .form-code {
    font-family: monospace;
    font-size: 22pt;
    font-weight: 900;
    margin-right: 12px;
  }
  .header-right .form-title {
    font-size: 16pt;
    font-weight: 900;
    letter-spacing: 1px;
  }
  .header-right .form-subtitle {
    font-size: 10pt;
    font-weight: bold;
    margin-top: 4px;
  }
  .header-subbar {
    grid-column: span 2;
    border-top: 1px solid #000;
    background: #f7f7f7;
    text-align: center;
    padding: 3px 0;
    font-size: 8.5pt;
    font-weight: 500;
  }

  /* SECTION WRAPPERS */
  .section-row {
    display: flex;
    border: 2px solid #000;
    margin-bottom: 8px;
  }
  .section-sidebar {
    width: 26px;
    background: #f0f0f0;
    border-right: 2px solid #000;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 8.5pt;
    writing-mode: vertical-lr;
    transform: rotate(180deg);
    padding: 8px 0;
    letter-spacing: 1px;
    text-align: center;
  }
  .section-content {
    flex: 1;
    padding: 8px 10px;
  }

  /* CHAR BOXES */
  .char-boxes {
    display: inline-flex;
    border-top: 1px solid #000;
    border-bottom: 1px solid #000;
    border-left: 1px solid #000;
    background: #fff;
    vertical-align: middle;
  }
  .char-box {
    display: inline-block;
    width: 14px;
    height: 18px;
    border-right: 1px solid #000;
    text-align: center;
    line-height: 18px;
    font-family: monospace;
    font-size: 9.5pt;
    font-weight: bold;
  }

  .grid-cols-3 {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
  }
  .field-label {
    font-size: 7.5pt;
    color: #444;
    margin-bottom: 2px;
    display: block;
  }
  .line-field {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-top: 4px;
    border-top: 1px solid #e0e0e0;
    margin-top: 4px;
  }
  .line-field .label {
    font-size: 8.5pt;
    font-weight: bold;
    min-width: 75px;
  }
  .line-field .underline-val {
    flex: 1;
    border-bottom: 1px solid #000;
    font-weight: bold;
    padding: 1px 4px;
    font-size: 9pt;
  }

  /* TABLE */
  .tfejlh-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 8.5pt;
  }
  .tfejlh-table th {
    background: #f7f7f7;
    border-bottom: 2px solid #000;
    border-right: 1px solid #000;
    padding: 5px 6px;
    font-weight: bold;
  }
  .tfejlh-table th:last-child {
    border-right: none;
  }
  .tfejlh-table td {
    border-bottom: 1px solid #000;
    border-right: 1px solid #000;
    padding: 5px 6px;
    vertical-align: middle;
  }
  .tfejlh-table td:last-child {
    border-right: none;
  }
  .tfejlh-table .ssz {
    text-align: center;
    font-family: monospace;
    font-weight: bold;
    width: 28px;
  }
  .tfejlh-table .adonem {
    text-align: center;
    font-family: monospace;
    font-weight: bold;
    width: 60px;
  }
  .tfejlh-table .num-col {
    text-align: right;
    font-family: monospace;
    font-weight: bold;
    font-size: 9.5pt;
    width: 110px;
  }
  .tfejlh-table .subtext {
    font-size: 6.5pt;
    font-family: sans-serif;
    color: #666;
    font-weight: normal;
  }
  .total-row {
    background: #f0f0f0;
    font-weight: bold;
    border-top: 2px solid #000;
  }
  .total-row td {
    font-size: 9.5pt;
    padding: 6px;
  }

  /* FOOTER */
  .footer-bar {
    display: flex;
    justify-content: space-between;
    font-family: monospace;
    font-size: 7.5pt;
    color: #444;
    padding-top: 4px;
  }
</style>
</head>
<body>

<div class="page-container">
  <!-- 1. HEADER -->
  <div class="header-grid">
    <div class="header-left">
      <img src="/magyarorszag_cimere_bw.svg" alt="Magyarország Címere" />
      <div class="nav-title">Nemzeti Adó- és Vámhivatal</div>
    </div>
    <div class="header-right">
      <div style="display: flex; align-items: baseline; justify-content: center;">
        <span class="form-code">${formCode}</span>
        <span class="form-title">BEVALLÁS</span>
      </div>
      <div class="form-subtitle">a turizmusfejlesztési hozzájárulásról</div>
    </div>
    <div class="header-subbar">
      Benyújtandó az állami adó- és vámhatósághoz
    </div>
  </div>

  <!-- 2. SECTION (B): AZONOSÍTÁS -->
  <div class="section-row">
    <div class="section-sidebar">AZONOSÍTÁS (B)</div>
    <div class="section-content">
      <div class="grid-cols-3">
        <div>
          <span class="field-label">Adózó adószáma</span>
          <div>
            ${renderBoxes(taxPart1, 8)} - ${renderBoxes(taxPart2, 1)} - ${renderBoxes(taxPart3, 2)}
          </div>
        </div>
        <div>
          <span class="field-label">Adózó adóazonosító jele</span>
          <div>${renderBoxes('', 10)}</div>
        </div>
        <div>
          <span class="field-label">Hibásnak minősített bevallás vonalkódja</span>
          <div style="border: 1px solid #000; height: 18px; width: 100%;">&nbsp;</div>
        </div>
      </div>

      <div style="margin-top: 4px;">
        <span class="field-label">Jogelőd adószáma</span>
        <div>
          ${renderBoxes('', 8)} - ${renderBoxes('', 1)} - ${renderBoxes('', 2)}
        </div>
      </div>

      <div class="line-field">
        <span class="label">Adózó neve</span>
        <div class="underline-val">${esc(compName.toUpperCase())}</div>
      </div>

      <div class="line-field" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="font-size: 8.5pt;">Ügyintéző neve</span>
          <div class="underline-val">${esc(data.agentName || '')}</div>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="font-size: 8.5pt;">telefonszáma</span>
          <div class="underline-val" style="font-family: monospace;">${esc(data.agentPhone || '')}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- 3. SECTION (C): BEVALLÁSI IDŐSZAK -->
  <div class="section-row">
    <div class="section-sidebar">(C)</div>
    <div class="section-content">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <span class="field-label">Bevallási időszak</span>
          <div>
            ${renderBoxes(startStr, 8)}
            <span style="font-weight: bold; margin: 0 4px;">-</span>
            ${renderBoxes(endStr, 8)}
          </div>
          <div style="font-size: 6.5pt; color: #666; margin-top: 2px;">
            <span style="margin-right: 48px;">év&nbsp;&nbsp;&nbsp;&nbsp;hó&nbsp;&nbsp;naptól</span>
            <span>év&nbsp;&nbsp;&nbsp;&nbsp;hó&nbsp;&nbsp;napig</span>
          </div>
        </div>

        <div style="border: 1px solid #ccc; padding: 4px 8px; font-size: 8pt; display: flex; align-items: center; gap: 6px;">
          <span>A bevallás az előtársasági időszakot is magában foglalja</span>
          <div style="border: 1px solid #000; width: 14px; height: 14px;"></div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 6px; border-top: 1px solid #e0e0e0; padding-top: 4px;">
        <div style="border: 1px solid #ddd; padding: 2px 4px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 7.5pt;">Bevallás jellege</span>
          <div style="border: 1px solid #000; width: 16px; height: 16px; text-align: center; font-family: monospace; font-weight: bold;">${data.isSelfRevision ? 'O' : ''}</div>
        </div>
        <div style="border: 1px solid #ddd; padding: 2px 4px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 7.5pt;">Bevallás típusa</span>
          <div style="border: 1px solid #000; width: 16px; height: 16px; text-align: center; font-family: monospace; font-weight: bold;"></div>
        </div>
        <div style="border: 1px solid #ddd; padding: 2px 4px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 7.5pt;">Bevallás fajtája</span>
          <div style="border: 1px solid #000; width: 16px; height: 16px; text-align: center; font-family: monospace; font-weight: bold;"></div>
        </div>
        <div style="border: 1px solid #ddd; padding: 2px 4px; display: flex; justify-content: space-between; align-items: center; background: #fafafa;">
          <span style="font-size: 7.5pt;">Bevallás gyakorisága</span>
          <div style="border: 1px solid #000; width: 16px; height: 16px; text-align: center; font-family: monospace; font-weight: bold;">${data.frequency}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- 4. SECTION (D): TÁBLÁZAT -->
  <div class="section-row">
    <div class="section-sidebar">(D)</div>
    <div class="section-content" style="padding: 0;">
      <table class="tfejlh-table">
        <thead>
          <tr>
            <th class="ssz">Ssz.</th>
            <th>Megnevezés</th>
            <th class="adonem">Adónemkód</th>
            <th class="num-col">Hozzájárulás alapja<br><span class="subtext">a)</span></th>
            <th class="num-col">Hozzájárulás<br><span class="subtext">b)</span></th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="ssz">1.</td>
            <td>Étkezőhelyi vendéglátásban az étel- és a helyben készített, nem alkoholtartalmú italforgalom</td>
            <td class="adonem">310</td>
            <td class="num-col"><div>${fmtEzer(ezerEtkezohely)}</div><div class="subtext">ezer</div></td>
            <td class="num-col" style="background:#fbfbfb;"></td>
          </tr>
          <tr>
            <td class="ssz">5.</td>
            <td>Étterem, cukrászda vendéglátással kapcsolatos szolgáltatásai</td>
            <td class="adonem">310</td>
            <td class="num-col"><div>${fmtEzer(ezerEtterem)}</div><div class="subtext">ezer</div></td>
            <td class="num-col" style="background:#fbfbfb;"></td>
          </tr>
          <tr>
            <td class="ssz">2.</td>
            <td>Kereskedelmi szálláshely-szolgáltatás</td>
            <td class="adonem">310</td>
            <td class="num-col"><div>${fmtEzer(ezerSzallas)}</div><div class="subtext">ezer</div></td>
            <td class="num-col" style="background:#fbfbfb;"></td>
          </tr>
          <tr>
            <td class="ssz">3.</td>
            <td>„Hop on hop off” jellegű menetrend szerinti buszos városnéző turisztikai szolgáltatás</td>
            <td class="adonem">310</td>
            <td class="num-col"><div>${fmtEzer(ezerBusz)}</div><div class="subtext">ezer</div></td>
            <td class="num-col" style="background:#fbfbfb;"></td>
          </tr>
          <tr class="total-row">
            <td class="ssz">4.</td>
            <td>Turizmusfejlesztési hozzájárulás összesen</td>
            <td class="adonem">310</td>
            <td class="num-col" style="background:#fff;">
              <div style="font-size: 11pt; font-weight: 900;">${fmtEzer(ezerTotalBase)}</div>
              <div class="subtext">ezer</div>
            </td>
            <td class="num-col" style="background:#fff;">
              <div style="font-size: 11pt; font-weight: 900; color: #9c4221;">${fmtEzer(ezerTaxPayable)}</div>
              <div class="subtext">ezer</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- 5. SECTION (E): ÖNELLENŐRZÉS -->
  <div class="section-row">
    <div class="section-sidebar">(E)</div>
    <div class="section-content" style="padding: 0;">
      <div style="padding: 4px 8px; background: #f7f7f7; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #000;">
        <span style="font-weight: bold; font-size: 8.5pt;">Önellenőrzés</span>
        <div style="display: flex; align-items: center; gap: 6px; font-size: 7.5pt;">
          <span>Ismételt önellenőrzés jelölése (x)</span>
          <div style="border: 1px solid #000; width: 14px; height: 14px; text-align: center; font-weight: bold;">${data.isRepeatedSelfRevision ? 'X' : ''}</div>
        </div>
      </div>
      <div style="text-align: center; font-size: 7.5pt; font-weight: bold; background: #eee; padding: 2px 0; border-bottom: 1px solid #000;">
        Az adatokat EZER FORINTBAN kell megadni
      </div>
      <table class="tfejlh-table">
        <thead>
          <tr>
            <th class="ssz">Ssz.</th>
            <th>Megnevezés</th>
            <th class="adonem">Adónemkód</th>
            <th class="num-col">Adókötelezettség változása (+/-)<br><span class="subtext">a)</span></th>
            <th class="num-col">Önellenőrzési pótlék összege<br><span class="subtext">b)</span></th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="ssz">11.</td>
            <td>Turizmusfejlesztési hozzájárulás</td>
            <td class="adonem">310</td>
            <td class="num-col">
              ${data.isSelfRevision ? `<div>${fmtEzer(ezerDiff)}</div><div class="subtext">ezer</div>` : ''}
            </td>
            <td class="num-col" style="background:#fbfbfb;"></td>
          </tr>
          <tr>
            <td class="ssz">12.</td>
            <td>Önellenőrzési pótlék összege</td>
            <td class="adonem">215</td>
            <td class="num-col" style="background:#fbfbfb;"></td>
            <td class="num-col">
              ${data.isSelfRevision ? `<div>${fmtEzer(ezerPotlek)}</div><div class="subtext">ezer</div>` : ''}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- 6. FOOTER -->
  <div class="footer-bar">
    <div>Ny.v.:3.0 A nyomtatvány papír alapon nem küldhető be!</div>
    <div>Nyomtatva: ${printTimestamp}</div>
  </div>
</div>

<script>
  window.onload = function() {
    window.print();
  };
</script>
</body>
</html>`;
}

export function generateTfejlhPdf(data: TfejlhPdfData) {
  const html = buildTfejlhHtml(data);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
}

export function generateTfejlhPreviewUrl(data: TfejlhPdfData): string {
  const html = buildTfejlhHtml(data);
  return createPreviewBlobUrl(html, 'text/html;charset=utf-8');
}
