/**
 * Bérjegyzék PDF generátor
 *
 * Bérjegyzék generálás HTML→print workflow-val (window.print() vagy iframe-based).
 * Nincs szükség extra dependency-re — natív böngésző PDF/print.
 */

export interface PayslipData {
  // Cég
  companyName: string;
  companyTaxNumber: string;
  companyAddress: string;

  // Foglalkoztatott
  employeeName: string;
  tajNumber: string;
  taxId: string;
  bankAccount: string;
  jobTitle: string;
  jobCode: string;

  // Időszak
  year: number;
  month: number;
  workDays: number;
  workedDays: number;
  overtimeHours: number;
  sickDays: number;
  leaveDays: number;

  // Jövedelmek
  baseSalary: number;
  supplements: number;
  bonuses: number;
  otherIncome: number;
  grossTotal: number;

  // Adó és járulék
  szjaBase: number;
  szjaAmount: number;
  tbAmount: number;
  szochoAmount: number; // munkáltatói (nem kerül a bérjegyzékbe, de info)

  // Kedvezmények
  familyCredit: number;
  under25Credit: number;
  newMotherCredit: number;
  firstMarriageCredit: number;
  personalDisabilityCredit: number;

  // Levonások
  garnishments: number;
  advances: number;
  otherDeductions: number;

  // Nettó
  netSalary: number;
}

const MONTHS_HU = [
  'Január', 'Február', 'Március', 'Április', 'Május', 'Június',
  'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December',
];

function fmt(n: number): string {
  return n.toLocaleString('hu-HU');
}

/**
 * Generate payslip HTML
 */
export function generatePayslipHtml(data: PayslipData): string {
  const totalCredits = data.familyCredit + data.under25Credit + data.newMotherCredit
    + data.firstMarriageCredit + data.personalDisabilityCredit;
  const totalDeductions = data.garnishments + data.advances + data.otherDeductions;

  return `<!DOCTYPE html>
<html lang="hu">
<head>
<meta charset="UTF-8">
<title>Bérjegyzék - ${data.employeeName} - ${data.year}. ${MONTHS_HU[data.month - 1]}</title>
<style>
  @page { size: A4; margin: 15mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1a1a2e; line-height: 1.5; }
  .payslip { max-width: 700px; margin: 0 auto; padding: 20px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #2d3436; padding-bottom: 12px; margin-bottom: 16px; }
  .header h1 { font-size: 20px; font-weight: 800; letter-spacing: -0.5px; color: #2d3436; }
  .header .period { font-size: 13px; color: #636e72; text-align: right; }
  .header .period strong { color: #2d3436; font-size: 15px; }
  .section { margin-bottom: 14px; }
  .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #636e72; margin-bottom: 6px; border-bottom: 1px solid #dfe6e9; padding-bottom: 3px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; }
  .info-row { display: flex; justify-content: space-between; }
  .info-row .label { color: #636e72; }
  .info-row .value { font-weight: 600; font-family: 'Consolas', 'Courier New', monospace; }
  table { width: 100%; border-collapse: collapse; }
  table th { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #636e72; text-align: left; padding: 6px 8px; border-bottom: 2px solid #dfe6e9; }
  table th.right { text-align: right; }
  table td { padding: 5px 8px; border-bottom: 1px solid #f1f2f6; }
  table td.right { text-align: right; font-family: 'Consolas', 'Courier New', monospace; font-weight: 600; }
  table td.negative { color: #d63031; }
  table td.positive { color: #00b894; }
  table tr.total { border-top: 2px solid #2d3436; }
  table tr.total td { font-weight: 800; font-size: 12px; padding: 8px; }
  .net-box { background: #2d3436; color: #fff; padding: 16px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; margin-top: 16px; }
  .net-box .label { font-size: 14px; font-weight: 600; }
  .net-box .amount { font-size: 24px; font-weight: 800; font-family: 'Consolas', 'Courier New', monospace; }
  .footer { margin-top: 24px; font-size: 9px; color: #b2bec3; text-align: center; border-top: 1px solid #dfe6e9; padding-top: 8px; }
  .stamp-area { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 60px; }
  .stamp-area .box { border-top: 1px solid #636e72; padding-top: 4px; text-align: center; font-size: 9px; color: #636e72; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="payslip">
  <div class="header">
    <div>
      <h1>BÉRJEGYZÉK</h1>
      <div style="font-size:11px; color:#636e72; margin-top:4px;">${escHtml(data.companyName)}</div>
      <div style="font-size:10px; color:#b2bec3;">${escHtml(data.companyTaxNumber)} · ${escHtml(data.companyAddress)}</div>
    </div>
    <div class="period">
      <strong>${data.year}. ${MONTHS_HU[data.month - 1]}</strong><br>
      Kiadás dátuma: ${new Date().toLocaleDateString('hu-HU')}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Foglalkoztatott adatai</div>
    <div class="info-grid">
      <div class="info-row"><span class="label">Név</span><span class="value">${escHtml(data.employeeName)}</span></div>
      <div class="info-row"><span class="label">Munkakör</span><span class="value">${escHtml(data.jobTitle)}</span></div>
      <div class="info-row"><span class="label">TAJ-szám</span><span class="value">${data.tajNumber}</span></div>
      <div class="info-row"><span class="label">Jogviszonykód</span><span class="value">${data.jobCode}</span></div>
      <div class="info-row"><span class="label">Adóazonosító</span><span class="value">${data.taxId}</span></div>
      <div class="info-row"><span class="label">Bankszámla</span><span class="value">${data.bankAccount}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Munkaidő</div>
    <div class="info-grid">
      <div class="info-row"><span class="label">Munkanapok (naptári)</span><span class="value">${data.workDays}</span></div>
      <div class="info-row"><span class="label">Ledolgozott napok</span><span class="value">${data.workedDays}</span></div>
      <div class="info-row"><span class="label">Túlóra</span><span class="value">${data.overtimeHours} óra</span></div>
      <div class="info-row"><span class="label">Betegszabadság</span><span class="value">${data.sickDays} nap</span></div>
      <div class="info-row"><span class="label">Szabadság</span><span class="value">${data.leaveDays} nap</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Jövedelem és levonások</div>
    <table>
      <thead>
        <tr><th>Megnevezés</th><th class="right">Összeg (Ft)</th></tr>
      </thead>
      <tbody>
        <tr><td>Alapbér</td><td class="right">${fmt(data.baseSalary)}</td></tr>
        ${data.supplements > 0 ? `<tr><td>Pótlékok</td><td class="right">${fmt(data.supplements)}</td></tr>` : ''}
        ${data.bonuses > 0 ? `<tr><td>Prémium / jutalom</td><td class="right">${fmt(data.bonuses)}</td></tr>` : ''}
        ${data.otherIncome > 0 ? `<tr><td>Egyéb jövedelem</td><td class="right">${fmt(data.otherIncome)}</td></tr>` : ''}
        <tr class="total"><td>Bruttó bér</td><td class="right">${fmt(data.grossTotal)}</td></tr>
        <tr><td></td><td></td></tr>
        <tr><td>SZJA (15%)</td><td class="right negative">-${fmt(data.szjaAmount)}</td></tr>
        <tr><td>TB járulék (18.5%)</td><td class="right negative">-${fmt(data.tbAmount)}</td></tr>
        ${totalCredits > 0 ? `
        <tr><td></td><td></td></tr>
        ${data.familyCredit > 0 ? `<tr><td>Családi kedvezmény</td><td class="right positive">+${fmt(data.familyCredit)}</td></tr>` : ''}
        ${data.under25Credit > 0 ? `<tr><td>25 év alattiak kedvezménye</td><td class="right positive">+${fmt(data.under25Credit)}</td></tr>` : ''}
        ${data.newMotherCredit > 0 ? `<tr><td>30 év alatti anyák kedvezménye</td><td class="right positive">+${fmt(data.newMotherCredit)}</td></tr>` : ''}
        ${data.firstMarriageCredit > 0 ? `<tr><td>Első házasok kedvezménye</td><td class="right positive">+${fmt(data.firstMarriageCredit)}</td></tr>` : ''}
        ${data.personalDisabilityCredit > 0 ? `<tr><td>Személyi kedvezmény</td><td class="right positive">+${fmt(data.personalDisabilityCredit)}</td></tr>` : ''}
        ` : ''}
        ${totalDeductions > 0 ? `
        <tr><td></td><td></td></tr>
        ${data.garnishments > 0 ? `<tr><td>Letiltás</td><td class="right negative">-${fmt(data.garnishments)}</td></tr>` : ''}
        ${data.advances > 0 ? `<tr><td>Előleg visszavonás</td><td class="right negative">-${fmt(data.advances)}</td></tr>` : ''}
        ${data.otherDeductions > 0 ? `<tr><td>Egyéb levonás</td><td class="right negative">-${fmt(data.otherDeductions)}</td></tr>` : ''}
        ` : ''}
      </tbody>
    </table>
  </div>

  <div class="net-box">
    <span class="label">NETTÓ KIFIZETÉS</span>
    <span class="amount">${fmt(data.netSalary)} Ft</span>
  </div>

  <div class="section" style="margin-top: 16px;">
    <div class="section-title">Munkáltatói közterhek (tájékoztató)</div>
    <div class="info-grid">
      <div class="info-row"><span class="label">SZOCHO (13%)</span><span class="value">${fmt(data.szochoAmount)} Ft</span></div>
      <div class="info-row"><span class="label">Teljes bérköltség</span><span class="value">${fmt(data.grossTotal + data.szochoAmount)} Ft</span></div>
    </div>
  </div>

  <div class="stamp-area">
    <div class="box">Munkáltató aláírása / pecsétje</div>
    <div class="box">Foglalkoztatott aláírása</div>
  </div>

  <div class="footer">
    Ez a bérjegyzék a foglalkoztatott személyes adatait tartalmazza, kezelése bizalmas. · Generálva: ${new Date().toISOString().slice(0, 10)} · Accounty Bérszámfejtés
  </div>
</div>
</body>
</html>`;
}

/**
 * Open payslip in print dialog (generates PDF via browser)
 */
export function printPayslip(data: PayslipData): void {
  const html = generatePayslipHtml(data);
  const printWindow = window.open('', '_blank', 'width=800,height=1100');
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
  // Wait for rendering, then trigger print
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 300);
  };
}

/**
 * Download payslip as HTML file
 */
export function downloadPayslipHtml(data: PayslipData): void {
  const html = generatePayslipHtml(data);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `berjegyzek_${data.employeeName.replace(/\s/g, '_')}_${data.year}_${String(data.month).padStart(2, '0')}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

// Helper
function escHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
