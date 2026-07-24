/**
 * Accounty Bérszámfejtési Modul — Bizonylat és Igazolás Sablonok
 *
 * Biztosítja a nyomtatható HTML alapú igazolások, jelenléti ívek és bérkartonok sablonjait.
 */

interface CompanyInfo {
  name: string;
  taxNumber: string;
  address: string;
}

interface EmployeeInfo {
  name: string;
  birthName?: string;
  birthPlace?: string;
  birthDate?: string;
  mothersName?: string;
  tajNumber: string;
  taxId: string;
  address?: string;
  jobTitle?: string;
  startDate?: string;
}

function escapeHtml(str: string): string {
  if (!str) return '–';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function printHtml(html: string) {
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
 * 1. Foglalkoztatási Igazolás (Proof of Employment)
 */
export function printEmploymentCertificate(company: CompanyInfo, employee: EmployeeInfo) {
  const html = `<!DOCTYPE html>
<html lang="hu">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 25mm 20mm; }
  body { font-family: Arial, sans-serif; font-size: 13px; line-height: 1.6; color: #333; }
  .title { text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 30px; margin-top: 20px; }
  .section { margin-bottom: 20px; }
  .info-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  .info-table td { padding: 6px 4px; vertical-align: top; }
  .info-table td.label { font-weight: bold; width: 35%; color: #555; }
  .body-text { margin-bottom: 30px; text-align: justify; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 50px; margin-top: 60px; }
  .sig-box { border-top: 1px solid #999; padding-top: 6px; text-align: center; font-size: 11px; }
  .footer { font-size: 10px; color: #777; text-align: center; margin-top: 80px; }
</style>
</head>
<body>
  <div class="title">FOGLALKOZTATÁSI IGAZOLÁS</div>
  
  <div class="body-text">
    Alulírott <strong>${escapeHtml(company.name)}</strong> (székhely: ${escapeHtml(company.address)}, adószám: ${company.taxNumber}) mint munkáltató, igazolom, hogy az alábbi adatokkal rendelkező munkavállaló nálunk munkaviszonyban áll:
  </div>

  <table class="info-table">
    <tr><td class="label">Munkavállaló neve:</td><td>${escapeHtml(employee.name)}</td></tr>
    <tr><td class="label">Születési név:</td><td>${escapeHtml(employee.birthName || employee.name)}</td></tr>
    <tr><td class="label">Születési hely és idő:</td><td>${escapeHtml(employee.birthPlace || '–')}, ${employee.birthDate || '–'}</td></tr>
    <tr><td class="label">Anyja neve:</td><td>${escapeHtml(employee.mothersName)}</td></tr>
    <tr><td class="label">Adóazonosító jel:</td><td>${employee.taxId}</td></tr>
    <tr><td class="label">TAJ-szám:</td><td>${employee.tajNumber}</td></tr>
    <tr><td class="label">Lakcím:</td><td>${escapeHtml(employee.address || '–')}</td></tr>
    <tr><td class="label">Munkakör:</td><td>${escapeHtml(employee.jobTitle)}</td></tr>
    <tr><td class="label">Munkaviszony kezdete:</td><td>${employee.startDate || '–'}</td></tr>
  </table>

  <div class="body-text">
    A munkaviszony határozatlan időre szól és jelenleg is fennáll. Ez az igazolás a munkavállaló kérésére, személyes felhasználás céljából került kiállításra.
  </div>

  <div>Kelt: ${new Date().toLocaleDateString('hu-HU')}</div>

  <div class="signatures">
    <div class="sig-box">Munkáltató képviselője</div>
    <div class="sig-box">Munkavállaló</div>
  </div>

  <div class="footer">Generálva az eaisybooks rendszerből.</div>
</body>
</html>`;

  printHtml(html);
}

/**
 * 2. Munkáltatói Igazolás (Salary/Income Certificate)
 */
export function printIncomeCertificate(company: CompanyInfo, employee: EmployeeInfo, monthlyNetAverage: number) {
  const html = `<!DOCTYPE html>
<html lang="hu">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 25mm 20mm; }
  body { font-family: Arial, sans-serif; font-size: 13px; line-height: 1.6; }
  .title { text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 30px; }
  .info-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
  .info-table td { padding: 6px 4px; }
  .info-table td.label { font-weight: bold; width: 40%; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 50px; margin-top: 80px; }
  .sig-box { border-top: 1px solid #999; padding-top: 6px; text-align: center; }
</style>
</head>
<body>
  <div class="title">MUNKÁLTATÓI JÖVEDELEMIGAZOLÁS</div>
  
  <p>Igazoljuk, hogy <strong>${escapeHtml(employee.name)}</strong> nálunk áll alkalmazásban.</p>

  <table class="info-table">
    <tr><td class="label">Munkáltató neve:</td><td>${escapeHtml(company.name)}</td></tr>
    <tr><td class="label">Adószám:</td><td>${company.taxNumber}</td></tr>
    <tr><td class="label">Munkavállaló neve:</td><td>${escapeHtml(employee.name)}</td></tr>
    <tr><td class="label">Munkakör:</td><td>${escapeHtml(employee.jobTitle)}</td></tr>
    <tr><td class="label">Munkaviszony kezdete:</td><td>${employee.startDate || '–'}</td></tr>
    <tr><td class="label">Nettó átlagos havi munkabér (utolsó 3 hónap):</td><td><strong>${monthlyNetAverage.toLocaleString('hu-HU')} Ft</strong></td></tr>
  </table>

  <p>A munkavállaló munkabérét levonás, letiltás jelenleg nem terheli (vagy a jogszabályi keretek között letiltásra került).</p>

  <p style="margin-top: 40px;">Kelt: ${new Date().toLocaleDateString('hu-HU')}</p>

  <div class="signatures">
    <div class="sig-box">Munkáltató aláírása</div>
    <div class="sig-box">Pénzügyi felelős / Könyvelő</div>
  </div>
</body>
</html>`;

  printHtml(html);
}

/**
 * 3. Jelenléti ív sablon (Monthly Timesheet Template)
 */
export function printTimesheetTemplate(company: CompanyInfo, employee: EmployeeInfo, year: number, month: number) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthNames = ['Január', 'Február', 'Március', 'Április', 'Május', 'Június', 'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December'];
  
  let rowsHtml = '';
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const dayName = ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo'][dayOfWeek];

    rowsHtml += `
      <tr class="${isWeekend ? 'weekend' : ''}">
        <td class="center font-bold">${d}.</td>
        <td class="center">${dayName}</td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
      </tr>
    `;
  }

  const html = `<!DOCTYPE html>
<html lang="hu">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 10mm; }
  body { font-family: Arial, sans-serif; font-size: 11px; }
  .header { display: flex; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 8px; margin-bottom: 15px; }
  .title { font-size: 16px; font-weight: bold; text-align: center; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; }
  table th, table td { border: 1px solid #777; padding: 4px 6px; }
  table th { background: #f0f0f0; font-size: 10px; }
  .center { text-align: center; }
  .weekend { background-color: #f7f7f7; }
  .signatures { display: flex; justify-content: space-between; margin-top: 30px; font-size: 10px; }
  .sig-line { border-top: 1px solid #333; width: 200px; text-align: center; padding-top: 4px; }
</style>
</head>
<body>
  <div class="title">JELENLÉTI ÍV — ${year}. ${monthNames[month - 1]}</div>
  
  <div class="header">
    <div>
      <strong>Munkáltató:</strong> ${escapeHtml(company.name)}<br>
      <strong>Adószám:</strong> ${company.taxNumber}
    </div>
    <div>
      <strong>Munkavállaló:</strong> ${escapeHtml(employee.name)}<br>
      <strong>Munkakör:</strong> ${escapeHtml(employee.jobTitle || '–')}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 8%;">Nap</th>
        <th style="width: 8%;">Nap név</th>
        <th>Munkakezdés</th>
        <th>Munka vége</th>
        <th>Ledolgozott óra</th>
        <th>Szabadság (óra)</th>
        <th>Aláírás / Megjegyzés</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="signatures">
    <div class="sig-line">Munkavállaló aláírása</div>
    <div class="sig-line">Munkáltató / Ellenőrizte</div>
  </div>
</body>
</html>`;

  printHtml(html);
}

/**
 * 4. Bérkarton (Annual Payroll Ledger)
 */
export function printAnnualLedger(company: CompanyInfo, employee: EmployeeInfo, year: number, monthlyCalcs: any[]) {
  let rowsHtml = '';
  let totalGross = 0;
  let totalSzja = 0;
  let totalTb = 0;
  let totalNet = 0;

  for (let m = 1; m <= 12; m++) {
    const calc = monthlyCalcs.find(c => c.month === m) || { gross_salary: 0, szja_amount: 0, tb_amount: 0, net_salary: 0 };
    totalGross += calc.gross_salary || 0;
    totalSzja += calc.szja_amount || 0;
    totalTb += calc.tb_amount || 0;
    totalNet += calc.net_salary || 0;

    rowsHtml += `
      <tr>
        <td class="center font-bold">${m}. hónap</td>
        <td class="right">${(calc.gross_salary || 0).toLocaleString('hu-HU')} Ft</td>
        <td class="right">${(calc.szja_amount || 0).toLocaleString('hu-HU')} Ft</td>
        <td class="right">${(calc.tb_amount || 0).toLocaleString('hu-HU')} Ft</td>
        <td class="right font-bold text-green-700">${(calc.net_salary || 0).toLocaleString('hu-HU')} Ft</td>
      </tr>
    `;
  }

  const html = `<!DOCTYPE html>
<html lang="hu">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 15mm; }
  body { font-family: Arial, sans-serif; font-size: 12px; }
  .title { font-size: 18px; font-weight: bold; text-align: center; margin-bottom: 20px; }
  .details-box { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; border: 1px solid #ccc; padding: 15px; border-radius: 8px; }
  table { width: 100%; border-collapse: collapse; margin-top: 15px; }
  table th, table td { border: 1px solid #aaa; padding: 8px; }
  table th { background: #f4f4f4; }
  .right { text-align: right; font-family: monospace; }
  .center { text-align: center; }
  .total-row { background: #eef2f7; font-weight: bold; }
</style>
</head>
<body>
  <div class="title">ÉVES BÉRKARTON — ${year}</div>

  <div class="details-box">
    <div>
      <strong>Cég:</strong> ${escapeHtml(company.name)}<br>
      <strong>Adószám:</strong> ${company.taxNumber}<br>
      <strong>Cím:</strong> ${escapeHtml(company.address)}
    </div>
    <div>
      <strong>Munkavállaló:</strong> ${escapeHtml(employee.name)}<br>
      <strong>TAJ szám:</strong> ${employee.tajNumber}<br>
      <strong>Adóazonosító:</strong> ${employee.taxId}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Időszak</th>
        <th class="right">Bruttó bér</th>
        <th class="right">SZJA levonás</th>
        <th class="right">TB járulék</th>
        <th class="right">Nettó bér</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
      <tr class="total-row">
        <td>Összesen</td>
        <td class="right">${totalGross.toLocaleString('hu-HU')} Ft</td>
        <td class="right">${totalSzja.toLocaleString('hu-HU')} Ft</td>
        <td class="right">${totalTb.toLocaleString('hu-HU')} Ft</td>
        <td class="right text-green-800">${totalNet.toLocaleString('hu-HU')} Ft</td>
      </tr>
    </tbody>
  </table>
</body>
</html>`;

  printHtml(html);
}
