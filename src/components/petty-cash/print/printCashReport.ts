import { format } from 'date-fns';
import type { CashReport, PettyCashEntry, DenominationSheet, CashClosingProtocol } from '../types';
import { fmtBalance, fmtAmount } from '../types';

interface PrintCashReportParams {
  report: CashReport;
  registerName: string;
  companyName: string;
  companyTaxNumber?: string;
  companyAddress?: string;
  entries: (PettyCashEntry & { partner?: { name: string; tax_number: string } })[];
  denominationSheet?: DenominationSheet | null;
  protocol?: CashClosingProtocol | null;
}

export function printCashReport({
  report,
  registerName,
  companyName,
  companyTaxNumber,
  companyAddress,
  entries,
  denominationSheet,
  protocol,
}: PrintCashReportParams) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('A felugró ablakok tiltva vannak a böngészőben. Engedélyezd a nyomtatvány megtekintéséhez!');
    return;
  }

  const cur = report.currency || 'HUF';
  let runningBalance = report.opening_balance;

  const rowsHtml = entries.map((entry, idx) => {
    const isIncome = Number(entry.amount) > 0;
    const isExpense = Number(entry.amount) < 0;
    const amt = Number(entry.amount);
    runningBalance += amt;

    return `
      <tr class="${entry.status === 'cancelled' ? 'cancelled' : ''}">
        <td class="center font-mono">${entry.line_no || idx + 1}</td>
        <td class="center font-mono">${entry.entry_date}</td>
        <td class="center">${isIncome ? '<span class="green font-bold">BPB</span>' : '<span class="red font-bold">KPB</span>'}</td>
        <td class="font-mono">${entry.legal_title || 'Általános tétel'}</td>
        <td>
          <div class="font-bold">${entry.partner?.name || '—'}</div>
          ${entry.description ? `<div class="subtext">${entry.description}</div>` : ''}
        </td>
        <td class="center font-mono">${entry.gl_contra_account || '—'}</td>
        <td class="right font-mono text-bold green">${isIncome ? fmtBalance(amt, cur) : ''}</td>
        <td class="right font-mono text-bold red">${isExpense ? fmtBalance(Math.abs(amt), cur) : ''}</td>
        <td class="right font-mono text-bold">${fmtBalance(runningBalance, cur)}</td>
      </tr>
    `;
  }).join('');

  const denomRowsHtml = denominationSheet?.rows?.filter(r => r.count > 0).map(r => `
    <tr>
      <td class="font-mono">${fmtBalance(r.denomination, cur)}</td>
      <td class="center font-mono">${r.count} db</td>
      <td class="right font-mono font-bold">${fmtBalance(r.subtotal, cur)}</td>
    </tr>
  `).join('') || '<tr><td colspan="3" class="center muted">Nincs rögzített címletjegyzék.</td></tr>';

  const html = `<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="utf-8">
  <title>Pénztárjelentés - ${report.report_number || 'Nyomtatvány'}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm 10mm 12mm 10mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; font-size: 10px; color: #0f172a; margin: 0; padding: 15px; }
    .header-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    .header-table td { vertical-align: top; }
    h1 { font-size: 16px; margin: 0 0 2px 0; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; }
    .company-title { font-size: 13px; font-weight: bold; margin-bottom: 2px; }
    .subtext { color: #64748b; font-size: 9px; }
    .kpi-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; }
    .kpi-table td { padding: 6px 10px; border-right: 1px solid #e2e8f0; }
    .kpi-table td:last-child { border-right: none; }
    .kpi-label { font-size: 9px; color: #64748b; text-transform: uppercase; }
    .kpi-val { font-size: 12px; font-weight: bold; font-family: monospace; }
    
    table.data-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    table.data-table th { background: #e2e8f0; border: 1px solid #cbd5e1; padding: 4px 6px; text-align: left; font-size: 9px; text-transform: uppercase; }
    table.data-table td { border: 1px solid #e2e8f0; padding: 4px 6px; font-size: 9.5px; }
    .cancelled { text-decoration: line-through; opacity: 0.5; background: #f1f5f9; }
    
    .right { text-align: right; }
    .center { text-align: center; }
    .green { color: #15803d; }
    .red { color: #b91c1c; }
    .font-mono { font-family: "SFMono-Regular", Consolas, Menlo, monospace; }
    .font-bold { font-weight: 700; }
    
    .footer-section { width: 100%; display: flex; gap: 15px; margin-top: 15px; page-break-inside: avoid; }
    .box { border: 1px solid #cbd5e1; padding: 8px 10px; border-radius: 4px; background: #ffffff; flex: 1; }
    .box-title { font-weight: bold; font-size: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px; text-transform: uppercase; color: #334155; }
    
    .signatures { width: 100%; display: flex; justify-content: space-between; margin-top: 25px; page-break-inside: avoid; }
    .sig-line { width: 28%; text-align: center; border-top: 1px solid #475569; padding-top: 5px; font-size: 9px; color: #334155; }
    
    .hash-bar { margin-top: 15px; padding-top: 8px; border-top: 1px dashed #cbd5e1; font-family: monospace; font-size: 8px; color: #64748b; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <!-- Fejléc -->
  <table class="header-table">
    <tr>
      <td style="width: 50%;">
        <div class="company-title">${companyName}</div>
        ${companyAddress ? `<div class="subtext">Székhely: ${companyAddress}</div>` : ''}
        ${companyTaxNumber ? `<div class="subtext">Adószám: ${companyTaxNumber}</div>` : ''}
        <div class="subtext">Pénztár: <strong>${registerName}</strong> (${cur})</div>
      </td>
      <td style="width: 50%; text-align: right;">
        <h1>Időszaki Pénztárjelentés</h1>
        <div style="font-size: 13px; font-weight: bold; font-family: monospace; color: #0f172a;">
          ${report.report_number || 'PISZKOZAT'} ${report.version > 1 ? `(v${report.version} Helyesbített)` : ''}
        </div>
        <div class="subtext">Időszak: <strong>${report.period_start} – ${report.period_end}</strong></div>
        <div class="subtext">Kiállítva: ${format(new Date(), 'yyyy.MM.dd. HH:mm')}</div>
      </td>
    </tr>
  </table>

  <!-- Egyenleg Levezetés -->
  <table class="kpi-table">
    <tr>
      <td>
        <div class="kpi-label">Nyitó készpénzállomány</div>
        <div class="kpi-val">${fmtBalance(report.opening_balance, cur)}</div>
      </td>
      <td>
        <div class="kpi-label">Időszaki bevételek (+)</div>
        <div class="kpi-val green">+${fmtBalance(report.total_in, cur)}</div>
      </td>
      <td>
        <div class="kpi-label">Időszaki kiadások (-)</div>
        <div class="kpi-val red">-${fmtBalance(report.total_out, cur)}</div>
      </td>
      <td>
        <div class="kpi-label">Pénztárkönyv szerinti záró</div>
        <div class="kpi-val">${fmtBalance(report.closing_balance_book, cur)}</div>
      </td>
      <td style="background: #eef2ff;">
        <div class="kpi-label" style="color: #4338ca;">Tényleges záróállomány</div>
        <div class="kpi-val" style="color: #4338ca;">${fmtBalance(report.closing_balance_actual ?? report.closing_balance_book, cur)}</div>
      </td>
      ${report.difference ? `
        <td style="background: #fff1f2;">
          <div class="kpi-label" style="color: #b91c1c;">Eltérés</div>
          <div class="kpi-val red">${fmtBalance(report.difference, cur)}</div>
        </td>
      ` : ''}
    </tr>
  </table>

  <!-- Tételek Táblázata -->
  <table class="data-table">
    <thead>
      <tr>
        <th class="center" style="width: 25px;">Sor</th>
        <th class="center" style="width: 65px;">Dátum</th>
        <th class="center" style="width: 35px;">Típus</th>
        <th style="width: 140px;">Jogcím</th>
        <th>Partner / Szöveges leírás</th>
        <th class="center" style="width: 55px;">Ellensz.</th>
        <th class="right" style="width: 85px;">Bevétel (+)</th>
        <th class="right" style="width: 85px;">Kiadás (-)</th>
        <th class="right" style="width: 95px;">Futó egyenleg</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="9" class="center" style="padding: 20px;">Ebben az időszakban nem volt pénztári tétel.</td></tr>'}
    </tbody>
  </table>

  <!-- Alsó szekció: Címletjegyzék & Zárási jegyzőkönyv -->
  <div class="footer-section">
    <!-- Címletjegyzék -->
    <div class="box" style="flex: 1.2;">
      <div class="box-title">Címletjegyzék (Tényleges számlálás)</div>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 1px solid #e2e8f0; font-size: 8.5px; color: #64748b;">
            <th style="text-align: left;">Címlet</th>
            <th class="center">Mennyiség</th>
            <th class="right">Érték</th>
          </tr>
        </thead>
        <tbody>
          ${denomRowsHtml}
        </tbody>
        <tfoot>
          <tr style="border-top: 1px solid #cbd5e1; font-weight: bold;">
            <td colspan="2">Összesen:</td>
            <td class="right font-mono">${fmtBalance(denominationSheet?.total_amount ?? report.closing_balance_actual ?? report.closing_balance_book, cur)}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Zárási jegyzőkönyv & Eltérés -->
    <div class="box" style="flex: 1.8;">
      <div class="box-title">Zárási Jegyzőkönyv (Sztv. 165–168. §)</div>
      <div style="line-height: 1.4; font-size: 9px;">
        <div>A pénztár tényleges záró készpénzállománya a címletjegyzék alapján: <strong>${fmtBalance(report.closing_balance_actual ?? report.closing_balance_book, cur)}</strong>.</div>
        <div>Pénztárkönyv szerinti záró egyenleg: <strong>${fmtBalance(report.closing_balance_book, cur)}</strong>.</div>
        <div>Megállapított eltérés: <strong>${report.difference && report.difference !== 0 ? fmtBalance(report.difference, cur) : '0 Ft (Nincs eltérés)'}</strong>.</div>
        ${protocol?.difference_reason ? `<div style="margin-top: 4px; padding: 3px 5px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 3px;"><strong>Eltérés indoklása:</strong> ${protocol.difference_reason}</div>` : ''}
        ${protocol?.action ? `<div style="margin-top: 3px;"><strong>Elrendelt intézkedés:</strong> ${protocol.action === 'booked_as_shortage' ? 'Pénztári hiányként lekönyvelve (3681)' : protocol.action === 'booked_as_surplus' ? 'Pénztári többletként lekönyvelve (4791)' : protocol.action}</div>` : ''}
        ${report.notes ? `<div style="margin-top: 4px; color: #475569;"><em>Megjegyzés: ${report.notes}</em></div>` : ''}
      </div>
    </div>
  </div>

  <!-- Aláírások -->
  <div class="signatures">
    <div class="sig-line">
      <div>Készítette (Pénztáros)</div>
      <div class="subtext">Sztv. 167. § (1) i)</div>
    </div>
    <div class="sig-line">
      <div>Pénztári Ellenőr</div>
      <div class="subtext">Szakmai és formai ellenőrzés</div>
    </div>
    <div class="sig-line">
      <div>Utalványozó / Cégvezető</div>
      <div class="subtext">Jóváhagyás</div>
    </div>
  </div>

  <!-- Sértetlenségi hash és azonosító -->
  <div class="hash-bar">
    <div>Szigorú számadású számviteli bizonylat • Rendszer: eaisybill Házipénztár Modul (v1.0)</div>
    <div>${report.content_hash ? `SHA-256 HASH: ${report.content_hash}` : 'IDŐSZAKI PÉNZTÁRZÁRÓ ÍV'}</div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 250);
    };
  </script>
</body>
</html>`;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
}
