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
  iban?: string;
  paymentMethod?: string;
  jobTitle: string;
  jobCode: string;
  weeklyHours?: number;

  // Időszak
  year: number;
  month: number;
  workDays: number;
  workedDays: number;
  overtimeHours: number;
  sickDays: number;
  leaveDays: number;

  // Szabadság és betegszabadság egyenleg
  leaveBalance?: {
    annualTotal: number;
    takenCurrent: number;
    takenPrevious?: number;
    remaining: number;
  };
  sickLeaveBalance?: {
    annualTotal: number;
    takenCurrent: number;
    takenPrevious?: number;
    remaining: number;
  };

  // Jövedelmek
  baseSalary: number;
  supplements: number;
  bonuses: number;
  serviceCharge?: number;
  homeOffice?: number;
  commuteReimbursement?: number;
  otherIncome: number;
  grossTotal: number;
  workedHours?: number;

  // Részletezett pótlékok
  overtime50Amount?: number;
  overtime100Amount?: number;
  shift30Amount?: number;
  night15Amount?: number;

  // Adó és járulék
  szjaBase: number;
  szjaAmount: number;
  tbAmount: number;
  szochoAmount: number; // munkáltatói
  taxRegime?: 'TAO' | 'KIVA' | 'SZJA';
  employerTaxRate?: number;
  employerTaxAmount?: number;
  employerTaxName?: string;

  // Kedvezmények
  familyCredit: number;
  under25Credit: number;
  newMotherCredit: number;
  firstMarriageCredit: number;
  personalDisabilityCredit: number;

  // Levonások
  garnishments: number;
  garnishmentCaseNumber?: string;
  advances: number;
  pensionFund?: number;
  healthFund?: number;
  otherDeductions: number;

  // Göngyölt adatok (YTD)
  ytd?: {
    gross: number;
    szja: number;
    tb: number;
    net: number;
  };

  // Nettó
  netSalary: number;
}

const MONTHS_HU = [
  'Január', 'Február', 'Március', 'Április', 'Május', 'Június',
  'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December',
];

function fmt(n: number): string {
  return Math.round(n).toLocaleString('hu-HU');
}

/**
 * Generate single payslip HTML block
 */
export function generatePayslipBlockHtml(data: PayslipData, isMultiPage = false): string {
  const totalCredits = data.familyCredit + data.under25Credit + data.newMotherCredit
    + data.firstMarriageCredit + data.personalDisabilityCredit;
  const totalDeductions = data.garnishments + data.advances + (data.pensionFund || 0) + (data.healthFund || 0) + data.otherDeductions;
  const homeOfficeAmount = data.homeOffice || 0;
  const commuteAmount = data.commuteReimbursement || 0;

  const isKiva = data.taxRegime === 'KIVA';
  const employerTax = data.employerTaxAmount !== undefined 
    ? data.employerTaxAmount 
    : (isKiva ? Math.round(data.grossTotal * 0.10) : data.szochoAmount);
  const totalCost = data.grossTotal + employerTax;

  return `
<div class="payslip"${isMultiPage ? ' style="page-break-after: always; break-after: page;"' : ''}>
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
      <div class="info-row"><span class="label">Heti munkaidő</span><span class="value">${data.weeklyHours || 40} óra</span></div>
      <div class="info-row"><span class="label">Bankszámla</span><span class="value">${data.bankAccount}</span></div>
      ${data.iban ? `<div class="info-row"><span class="label">Nemzetközi IBAN</span><span class="value font-mono">${data.iban}</span></div>` : `<div class="info-row"><span class="label">Kifizetés módja</span><span class="value">${data.paymentMethod || 'Átutalás'}</span></div>`}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Munkaidő és távollétek</div>
    <div class="info-grid">
      <div class="info-row"><span class="label">Munkanapok (naptári)</span><span class="value">${data.workDays}</span></div>
      <div class="info-row"><span class="label">Ledolgozott napok</span><span class="value">${data.workedDays}</span></div>
      ${data.workedHours && data.workedHours > 0 ? `<div class="info-row"><span class="label">Ledolgozott munkaórák</span><span class="value">${data.workedHours} óra</span></div>` : ''}
      <div class="info-row"><span class="label">Túlóra</span><span class="value">${data.overtimeHours} óra</span></div>
      <div class="info-row"><span class="label">Betegszabadság</span><span class="value">${data.sickDays} nap</span></div>
      <div class="info-row"><span class="label">Szabadság</span><span class="value">${data.leaveDays} nap</span></div>
    </div>
  </div>

  ${(data.leaveBalance || data.sickLeaveBalance) ? `
  <div class="section">
    <div class="section-title">Szabadság és betegszabadság egyenleg</div>
    <div class="leave-balance-container">
      ${data.leaveBalance ? `
      <div class="balance-card">
        <div class="balance-title">Éves szabadságkeret</div>
        <div class="balance-grid">
          <div><span>Keret:</span> <strong>${data.leaveBalance.annualTotal} nap</strong></div>
          <div><span>Tárgyhóban:</span> <strong>${data.leaveBalance.takenCurrent} nap</strong></div>
          <div><span>Korábbi:</span> <strong>${data.leaveBalance.takenPrevious || 0} nap</strong></div>
          <div><span>Fennmaradó:</span> <strong class="highlight-val">${data.leaveBalance.remaining} nap</strong></div>
        </div>
      </div>
      ` : ''}
      ${data.sickLeaveBalance ? `
      <div class="balance-card">
        <div class="balance-title">Betegszabadság (Mt. 15 nap)</div>
        <div class="balance-grid">
          <div><span>Keret:</span> <strong>${data.sickLeaveBalance.annualTotal} nap</strong></div>
          <div><span>Tárgyhóban:</span> <strong>${data.sickLeaveBalance.takenCurrent} nap</strong></div>
          <div><span>Korábbi:</span> <strong>${data.sickLeaveBalance.takenPrevious || 0} nap</strong></div>
          <div><span>Fennmaradó:</span> <strong class="highlight-val">${data.sickLeaveBalance.remaining} nap</strong></div>
        </div>
      </div>
      ` : ''}
    </div>
  </div>
  ` : ''}

  <div class="section">
    <div class="section-title">Jövedelem és levonások</div>
    <table>
      <thead>
        <tr><th>Megnevezés</th><th class="right">Összeg (Ft)</th></tr>
      </thead>
      <tbody>
        <tr><td>Alapbér</td><td class="right">${fmt(data.baseSalary)}</td></tr>
        ${data.overtime50Amount && data.overtime50Amount > 0 ? `<tr><td>Túlóra pótlék (50%)</td><td class="right">${fmt(data.overtime50Amount)}</td></tr>` : ''}
        ${data.overtime100Amount && data.overtime100Amount > 0 ? `<tr><td>Túlóra pótlék (100%)</td><td class="right">${fmt(data.overtime100Amount)}</td></tr>` : ''}
        ${data.shift30Amount && data.shift30Amount > 0 ? `<tr><td>Műszakpótlék (30%)</td><td class="right">${fmt(data.shift30Amount)}</td></tr>` : ''}
        ${data.night15Amount && data.night15Amount > 0 ? `<tr><td>Éjszakai pótlék (15%)</td><td class="right">${fmt(data.night15Amount)}</td></tr>` : ''}
        ${(!data.overtime50Amount && !data.overtime100Amount && !data.shift30Amount && !data.night15Amount && data.supplements > 0) ? `<tr><td>Pótlékok</td><td class="right">${fmt(data.supplements)}</td></tr>` : ''}
        ${data.bonuses > 0 ? `<tr><td>Prémium / jutalom</td><td class="right">${fmt(data.bonuses)}</td></tr>` : ''}
        ${data.serviceCharge && data.serviceCharge > 0 ? `<tr><td>Felszolgálási díj (SZJA- és SZOCHO-mentes)</td><td class="right positive">+${fmt(data.serviceCharge)}</td></tr>` : ''}
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
        ${homeOfficeAmount > 0 ? `
        <tr><td></td><td></td></tr>
        <tr><td>Home Office költségtérítés (Adómentes)</td><td class="right positive">+${fmt(homeOfficeAmount)}</td></tr>
        ` : ''}
        ${commuteAmount > 0 ? `
        <tr><td></td><td></td></tr>
        <tr><td>Munkába járás költségtérítés (Adómentes)</td><td class="right positive">+${fmt(commuteAmount)}</td></tr>
        ` : ''}
        ${totalDeductions > 0 ? `
        <tr><td></td><td></td></tr>
        ${data.garnishments > 0 ? `<tr><td>Letiltás${data.garnishmentCaseNumber ? ` (${escHtml(data.garnishmentCaseNumber)})` : ''}</td><td class="right negative">-${fmt(data.garnishments)}</td></tr>` : ''}
        ${data.advances > 0 ? `<tr><td>Munkabérelőleg törlesztés</td><td class="right negative">-${fmt(data.advances)}</td></tr>` : ''}
        ${data.pensionFund && data.pensionFund > 0 ? `<tr><td>Önkéntes nyugdíjpénztári tagdíj</td><td class="right negative">-${fmt(data.pensionFund)}</td></tr>` : ''}
        ${data.healthFund && data.healthFund > 0 ? `<tr><td>Egészségpénztári tagdíj</td><td class="right negative">-${fmt(data.healthFund)}</td></tr>` : ''}
        ${data.otherDeductions > 0 ? `<tr><td>Egyéb levonás</td><td class="right negative">-${fmt(data.otherDeductions)}</td></tr>` : ''}
        ` : ''}
      </tbody>
    </table>
  </div>

  <div class="net-box">
    <div>
      <span class="label">NETTÓ KIFIZETÉS</span>
      <div style="font-size: 10px; opacity: 0.9; margin-top: 2px;">
        ${data.iban ? `IBAN: ${escHtml(data.iban)}` : `Számlaszám: ${escHtml(data.bankAccount)}`}
      </div>
    </div>
    <span class="amount">${fmt(data.netSalary)} Ft</span>
  </div>

  ${data.ytd ? `
  <div class="section" style="margin-top: 18px;">
    <div class="section-title">Éves göngyölt adatok (YTD tárgyév)</div>
    <div class="info-grid">
      <div class="info-row"><span class="label">YTD Bruttó bér</span><span class="value">${fmt(data.ytd.gross)} Ft</span></div>
      <div class="info-row"><span class="label">YTD Levont SZJA</span><span class="value">${fmt(data.ytd.szja)} Ft</span></div>
      <div class="info-row"><span class="label">YTD Levont TB járulék</span><span class="value">${fmt(data.ytd.tb)} Ft</span></div>
      <div class="info-row"><span class="label">YTD Kifizetett nettó</span><span class="value">${fmt(data.ytd.net)} Ft</span></div>
    </div>
  </div>
  ` : ''}

  <div class="section" style="margin-top: 18px;">
    <div class="section-title">Munkáltatói közterhek (tájékoztató)</div>
    <div class="info-grid">
      ${isKiva ? `
        <div class="info-row"><span class="label">KIVA kötelezettség (10%)</span><span class="value">${fmt(employerTax)} Ft</span></div>
        <div class="info-row"><span class="label">Teljes bérköltség (KIVA-val)</span><span class="value">${fmt(totalCost)} Ft</span></div>
      ` : `
        <div class="info-row"><span class="label">SZOCHO (13%)</span><span class="value">${fmt(data.szochoAmount)} Ft</span></div>
        <div class="info-row"><span class="label">Teljes bérköltség</span><span class="value">${fmt(totalCost)} Ft</span></div>
      `}
    </div>
    ${isKiva ? `
      <div style="font-size: 9px; color: #64748b; margin-top: 5px; padding-left: 9px; font-style: italic;">
        * A munkáltató a kisvállalati adó (KIVA) alanya. A személyi jellegű kifizetések után 10% KIVA fizetendő, SZOCHO mentes.
      </div>
    ` : ''}
  </div>

  <div class="stamp-area">
    <div class="box">Munkáltató cégszerű aláírása / pecsétje</div>
    <div class="box">Foglalkoztatott aláírása (Átvétel kelte: ____________)</div>
  </div>

  <div class="footer">
    Ez a bérjegyzék a foglalkoztatott személyes adatait tartalmazza, kezelése bizalmas. · Generálva: ${new Date().toISOString().slice(0, 10)} · eaisyBooks Bérszámfejtés
  </div>
</div>`;
}

/**
 * Shared CSS for single payslip and bulk printing
 */
const PAYSLIP_BASE_CSS = `
  @page { size: A4; margin: 12mm; }
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
    padding-bottom: 14px;
    margin-bottom: 16px;
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
  
  .section { margin-bottom: 14px; }
  .section-title {
    font-family: 'Outfit', sans-serif;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #0f7467;
    margin-bottom: 6px;
    border-left: 3px solid #0f7467;
    padding-left: 6px;
  }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5px 24px; padding-left: 9px; }
  .info-row { display: flex; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 2px; }
  .info-row .label { color: #64748b; }
  .info-row .value { font-weight: 600; color: #334155; font-family: 'Courier New', Courier, monospace; }
  
  .leave-balance-container {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    padding-left: 9px;
  }
  .balance-card {
    background-color: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 8px 12px;
  }
  .balance-title {
    font-size: 10px;
    font-weight: 700;
    color: #334155;
    margin-bottom: 4px;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 2px;
  }
  .balance-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 3px 10px;
    font-size: 10px;
    color: #64748b;
  }
  .balance-grid strong {
    color: #1e293b;
    font-family: 'Courier New', Courier, monospace;
  }
  .balance-grid strong.highlight-val {
    color: #0f7467;
  }

  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  table th {
    font-family: 'Outfit', sans-serif;
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #475569;
    text-align: left;
    padding: 6px 10px;
    background-color: #f1f5f9;
    border-bottom: 2px solid #e2e8f0;
  }
  table th.right { text-align: right; }
  table td { padding: 5px 10px; border-bottom: 1px solid #e2e8f0; color: #334155; font-size: 10.5px; }
  table td.right { text-align: right; font-family: 'Courier New', Courier, monospace; font-weight: 600; }
  table td.negative { color: #dc2626; }
  table td.positive { color: #16a34a; }
  table tr.total { border-top: 2px solid #cbd5e1; background-color: #f8fafc; }
  table tr.total td { font-weight: 700; font-size: 11px; padding: 7px 10px; color: #1e293b; }
  
  .net-box {
    background: linear-gradient(135deg, #0f7467 0%, #0d6459 100%);
    color: #fff;
    padding: 14px 20px;
    border-radius: 10px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 14px;
    box-shadow: 0 4px 12px rgba(15,116,103,0.15);
  }
  .net-box .label { font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 0.5px; }
  .net-box .amount { font-size: 22px; font-weight: 800; font-family: 'Outfit', sans-serif; }
  
  .footer {
    margin-top: 22px;
    font-size: 9px;
    color: #94a3b8;
    text-align: center;
    border-top: 1px solid #e2e8f0;
    padding-top: 8px;
  }
  .stamp-area { margin-top: 28px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
  .stamp-area .box { border-top: 1px solid #cbd5e1; padding-top: 6px; text-align: center; font-size: 9px; color: #64748b; }
  @page { size: A4; margin: 12mm; }
  @media print {
    body {
      padding: 0 !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .payslip {
      page-break-after: always;
      break-after: page;
    }
  }
`;

/**
 * Generate full HTML document wrapping payslip blocks
 */
export function generatePayslipHtml(data: PayslipData): string {
  return `<!DOCTYPE html>
<html lang="hu">
<head>
<meta charset="UTF-8">
<title>Bérjegyzék - ${data.employeeName} - ${data.year}. ${MONTHS_HU[data.month - 1]}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
${PAYSLIP_BASE_CSS}
</style>
</head>
<body>
  ${generatePayslipBlockHtml(data)}
</body>
</html>`;
}

/**
 * Open single payslip in print dialog
 */
export function printPayslip(data: PayslipData): void {
  const html = generatePayslipHtml(data);
  printHtmlInIframe(html);
}

/**
 * Open ALL payslips in a single multi-page print dialog
 */
export function printAllPayslips(dataList: PayslipData[]): void {
  if (!dataList || dataList.length === 0) return;

  const first = dataList[0];
  const combinedBlocksHtml = dataList
    .map((data, idx) => generatePayslipBlockHtml(data, idx < dataList.length - 1))
    .join('');

  const fullHtml = `<!DOCTYPE html>
<html lang="hu">
<head>
<meta charset="UTF-8">
<title>Bérjegyzékek Összesen - ${first.year}. ${MONTHS_HU[first.month - 1]}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
${PAYSLIP_BASE_CSS}
</style>
</head>
<body>
  ${combinedBlocksHtml}
</body>
</html>`;

  printHtmlInIframe(fullHtml);
}

function printHtmlInIframe(html: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);

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
