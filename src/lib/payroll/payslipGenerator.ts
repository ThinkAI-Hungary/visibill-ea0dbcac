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
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 15mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Inter', -apple-system, sans-serif;
    font-size: 11px;
    color: #1e293b;
    line-height: 1.5;
    background-color: #ffffff;
    -webkit-font-smoothing: antialiased;
  }
  .payslip { max-width: 700px; margin: 0 auto; padding: 10px; }
  
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 16px;
    margin-bottom: 20px;
  }
  .brand-logo-container {
    display: inline-flex;
    flex-direction: column;
    align-items: flex-start;
  }
  .brand-logo {
    font-family: 'Outfit', sans-serif;
    font-size: 22px;
    font-weight: 500;
    color: #1e293b;
    letter-spacing: -0.5px;
    line-height: 1.2;
  }
  .brand-logo .highlight {
    color: #0f7467;
    font-weight: 800;
  }
  .brand-logo-sub { font-size: 9px; font-weight: 600; color: #64748b; margin-top: 3px; text-transform: uppercase; letter-spacing: 0.5px; }

  .header h1 {
    font-family: 'Outfit', sans-serif;
    font-size: 18px;
    font-weight: 800;
    color: #0f7467;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .header .period { font-size: 12px; color: #64748b; text-align: right; }
  .header .period strong { color: #1e293b; font-size: 14px; font-family: 'Outfit', sans-serif; }
  
  .section { margin-bottom: 18px; }
  .section-title {
    font-family: 'Outfit', sans-serif;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #0f7467;
    margin-bottom: 8px;
    border-left: 3px solid #0f7467;
    padding-left: 6px;
  }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; padding-left: 9px; }
  .info-row { display: flex; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 2px; }
  .info-row .label { color: #64748b; }
  .info-row .value { font-weight: 600; color: #334155; font-family: 'Courier New', Courier, monospace; }
  
  table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
  table th {
    font-family: 'Outfit', sans-serif;
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #475569;
    text-align: left;
    padding: 8px 10px;
    background-color: #f1f5f9;
    border-bottom: 2px solid #e2e8f0;
  }
  table th.right { text-align: right; }
  table td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; color: #334155; }
  table td.right { text-align: right; font-family: 'Courier New', Courier, monospace; font-weight: 600; }
  table td.negative { color: #dc2626; }
  table td.positive { color: #16a34a; }
  table tr.total { border-top: 2px solid #cbd5e1; background-color: #f8fafc; }
  table tr.total td { font-weight: 700; font-size: 11px; padding: 8px 10px; color: #1e293b; }
  
  .net-box {
    background: linear-gradient(135deg, #0f7467 0%, #0d6459 100%);
    color: #fff;
    padding: 16px 20px;
    border-radius: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 20px;
    box-shadow: 0 4px 12px rgba(15,116,103,0.15);
  }
  .net-box .label { font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 0.5px; }
  .net-box .amount { font-size: 22px; font-weight: 800; font-family: 'Outfit', sans-serif; }
  
  .footer {
    margin-top: 28px;
    font-size: 9px;
    color: #94a3b8;
    text-align: center;
    border-top: 1px solid #e2e8f0;
    padding-top: 10px;
  }
  .stamp-area { margin-top: 36px; display: grid; grid-template-columns: 1fr 1fr; gap: 60px; }
  .stamp-area .box { border-top: 1px solid #cbd5e1; padding-top: 6px; text-align: center; font-size: 9px; color: #64748b; }
  @page { size: A4; margin: 0; }
  @media print {
    body {
      padding: 20mm 15mm !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }
</style>
</head>
<body>
<div class="payslip">
  <div class="header">
    <div>
      <div class="brand-logo-container">
        <div class="brand-logo">
          e<span class="highlight">ai</span>sy<span class="highlight">Books</span>
        </div>
        <div class="brand-logo-sub">Bérszámfejtés</div>
      </div>
      <div style="font-size:11px; color:#1e293b; font-weight: 600; margin-top:10px;">${escHtml(data.companyName)}</div>
      <div style="font-size:10px; color:#64748b; margin-top:2px;">Adószám: ${escHtml(data.companyTaxNumber)} · Székhely: ${escHtml(data.companyAddress)}</div>
    </div>
    <div class="period">
      <h1>Bérjegyzék</h1>
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

  <div class="section" style="margin-top: 20px;">
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
    Ez a bérjegyzék a foglalkoztatott személyes adatait tartalmazza, kezelése bizalmas. · Generálva: ${new Date().toISOString().slice(0, 10)} · eaisybooks Bérszámfejtés
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
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  // Use hidden iframe to avoid popup blockers
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  iframe.style.opacity = '0';
  document.body.appendChild(iframe);

  iframe.src = url;
  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.print();
      // Cleanup after print dialog closes
      setTimeout(() => {
        document.body.removeChild(iframe);
        URL.revokeObjectURL(url);
      }, 1000);
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
