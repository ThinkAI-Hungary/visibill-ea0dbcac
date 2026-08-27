/**
 * Accounty Bérszámfejtési Modul — Táppénz és Családtámogatási Bizonylatok
 *
 * Biztosítja a nyomtatható HTML alapú igazolások sablonjait táppénz, CSED, GYED,
 * terhességi táppénz és munkabaleseti jegyzőkönyv generálásához.
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
  bankAccount?: string;
}

interface LeaveInfo {
  startDate: string;
  endDate: string;
  days: number;
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
 * 1. Munkáltatói nyilatkozat / igazolás táppénz igényléséhez
 */
export function printSickLeaveStatement(
  company: CompanyInfo,
  employee: EmployeeInfo,
  leave: LeaveInfo,
  extra: { medicalCertNo?: string; doctorName?: string; notes?: string }
) {
  const html = `<!DOCTYPE html>
<html lang="hu">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 25mm 20mm; }
  body { font-family: Arial, sans-serif; font-size: 13px; line-height: 1.6; color: #333; }
  .title { text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 30px; margin-top: 10px; }
  .info-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
  .info-table td { padding: 6px 4px; vertical-align: top; }
  .info-table td.label { font-weight: bold; width: 35%; color: #555; }
  .body-text { margin-bottom: 25px; text-align: justify; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 50px; margin-top: 60px; }
  .sig-box { border-top: 1px solid #999; padding-top: 6px; text-align: center; font-size: 11px; }
  .footer { font-size: 9px; color: #888; text-align: center; margin-top: 80px; border-top: 1px dashed #ccc; padding-top: 10px; }
  .highlight-box { background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; margin-bottom: 20px; }
</style>
</head>
<body>
  <div class="title">FOGLALKOZTATÓI IGAZOLÁS TÁPPÉNZ IGÉNYLÉSHEZ</div>
  
  <div class="body-text">
    Alulírott <strong>${escapeHtml(company.name)}</strong> (székhely: ${escapeHtml(company.address)}, adószám: ${company.taxNumber}), mint foglalkoztató igazolom, hogy az alábbi munkavállaló keresőképtelensége miatti táppénz iránti igényét támogatjuk és a szükséges adatokat az alábbiak szerint tanúsítjuk:
  </div>

  <table class="info-table">
    <tr><td class="label">Munkavállaló neve:</td><td><strong>${escapeHtml(employee.name)}</strong></td></tr>
    <tr><td class="label">Születési helye, ideje:</td><td>${escapeHtml(employee.birthPlace || '–')}, ${employee.birthDate || '–'}</td></tr>
    <tr><td class="label">Anyja születési neve:</td><td>${escapeHtml(employee.mothersName)}</td></tr>
    <tr><td class="label">TAJ száma:</td><td>${employee.tajNumber}</td></tr>
    <tr><td class="label">Adóazonosító jele:</td><td>${employee.taxId}</td></tr>
    <tr><td class="label">Munkakör / FEOR kód:</td><td>${escapeHtml(employee.jobTitle)}</td></tr>
    <tr><td class="label">Kifizetési bankszámlaszám:</td><td>${employee.bankAccount || '–'}</td></tr>
  </table>

  <div class="highlight-box">
    <strong>Keresőképtelenség és távollét adatai:</strong>
    <table class="info-table" style="margin-bottom: 0; margin-top: 10px;">
      <tr><td class="label" style="width: 40%">Keresőképtelenség kezdete:</td><td>${leave.startDate}</td></tr>
      <tr><td class="label">Keresőképtelenség vége:</td><td>${leave.endDate}</td></tr>
      <tr><td class="label">Kieső munkanapok száma:</td><td>${leave.days} nap</td></tr>
      <tr><td class="label">Orvosi igazolás száma:</td><td>${escapeHtml(extra.medicalCertNo || '–')}</td></tr>
      <tr><td class="label">Kiállító orvos neve:</td><td>${escapeHtml(extra.doctorName || '–')}</td></tr>
    </table>
  </div>

  <div class="body-text">
    Igazoljuk, hogy a munkavállaló a fenti időszak alatt munkát nem végzett, munkabérben nem részesült (illetve kizárólag a törvény szerinti betegszabadság / táppénz illette meg). A levont járulékok és adóelőlegek a jogszabályoknak megfelelően elszámolásra és bevallásra kerülnek.
  </div>

  ${extra.notes ? `<div class="body-text" style="font-style: italic;"><strong>Megjegyzés:</strong> ${escapeHtml(extra.notes)}</div>` : ''}

  <div>Kelt: ${new Date().toLocaleDateString('hu-HU')}</div>

  <div class="signatures">
    <div class="sig-box">Foglalkoztató / Képviselő aláírása és bélyegzője</div>
    <div class="sig-box">Munkavállaló aláírása</div>
  </div>

  <div class="footer">Generálva az eaisybooks rendszerből. Készült a TB-ellátások igénylésére szolgáló eljárás keretében.</div>
</body>
</html>`;

  printHtml(html);
}

/**
 * 2. Foglalkoztatói igazolás CSED/GYED ellátások igényléséhez
 */
export function printCsedGyedStatement(
  company: CompanyInfo,
  employee: EmployeeInfo,
  leave: LeaveInfo,
  extra: {
    benefitType: 'csed' | 'gyed';
    childName: string;
    childBirthDate: string;
    expectedDateOfDelivery?: string;
    expectedStartDate: string;
    notes?: string;
  }
) {
  const benefitLabel = extra.benefitType === 'csed' ? 'CSECSEMŐGONDOZÁSI DÍJ (CSED)' : 'GYERMEKGONDOZÁSI DÍJ (GYED)';
  const html = `<!DOCTYPE html>
<html lang="hu">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 25mm 20mm; }
  body { font-family: Arial, sans-serif; font-size: 13px; line-height: 1.6; color: #333; }
  .title { text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 30px; margin-top: 10px; }
  .info-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
  .info-table td { padding: 6px 4px; vertical-align: top; }
  .info-table td.label { font-weight: bold; width: 35%; color: #555; }
  .body-text { margin-bottom: 25px; text-align: justify; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 50px; margin-top: 60px; }
  .sig-box { border-top: 1px solid #999; padding-top: 6px; text-align: center; font-size: 11px; }
  .footer { font-size: 9px; color: #888; text-align: center; margin-top: 60px; border-top: 1px dashed #ccc; padding-top: 10px; }
  .highlight-box { background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px; border-radius: 6px; margin-bottom: 20px; }
</style>
</head>
<body>
  <div class="title">FOGLALKOZTATÓI IGAZOLÁS ${benefitLabel} IGÉNYLÉSHEZ</div>
  
  <div class="body-text">
    Igazoljuk, hogy <strong>${escapeHtml(employee.name)}</strong> nálunk áll biztosítási kötelezettséggel járó munkaviszonyban, és a megjelölt gyermekre vonatkozóan a nevezett családtámogatási ellátás igénylését a munkáltató részéről az alábbi adatokkal igazoljuk:
  </div>

  <table class="info-table">
    <tr><td class="label">Munkáltató megnevezése:</td><td><strong>${escapeHtml(company.name)}</strong></td></tr>
    <tr><td class="label">Adószám / Székhely:</td><td>${company.taxNumber} / ${escapeHtml(company.address)}</td></tr>
    <tr><td class="label">Biztosított munkavállaló neve:</td><td>${escapeHtml(employee.name)}</td></tr>
    <tr><td class="label">Születési név / Anyja neve:</td><td>${escapeHtml(employee.birthName || employee.name)} / ${escapeHtml(employee.mothersName)}</td></tr>
    <tr><td class="label">TAJ száma / Adóazonosítója:</td><td>${employee.tajNumber} / ${employee.taxId}</td></tr>
    <tr><td class="label">Jogviszony kezdete:</td><td>${employee.startDate || '–'}</td></tr>
  </table>

  <div class="highlight-box">
    <strong>Gyermek és ellátási igény adatai:</strong>
    <table class="info-table" style="margin-bottom: 0; margin-top: 10px;">
      <tr><td class="label" style="width: 40%">Gyermek neve:</td><td><strong>${escapeHtml(extra.childName)}</strong></td></tr>
      <tr><td class="label">Gyermek születési ideje:</td><td>${extra.childBirthDate}</td></tr>
      ${extra.expectedDateOfDelivery ? `<tr><td class="label">Szülés várható időpontja:</td><td>${extra.expectedDateOfDelivery}</td></tr>` : ''}
      <tr><td class="label">Ellátás igényelt kezdőnapja:</td><td><strong>${extra.expectedStartDate}</strong></td></tr>
    </table>
  </div>

  <div class="body-text">
    Kijelentjük, hogy a fent megjelölt munkavállaló a gyermek születését / szülési szabadságát megelőző két éven belül a szükséges biztosítási idővel rendelkezik, és a kért ellátás folyósítása alatt munkát nálunk személyesen nem végez.
  </div>

  ${extra.notes ? `<div class="body-text" style="font-style: italic;"><strong>Megjegyzés:</strong> ${escapeHtml(extra.notes)}</div>` : ''}

  <div>Kelt: ${new Date().toLocaleDateString('hu-HU')}</div>

  <div class="signatures">
    <div class="sig-box">Foglalkoztató / Képviselő aláírása és bélyegzője</div>
    <div class="sig-box">Igénylő (Munkavállaló) aláírása</div>
  </div>

  <div class="footer">Generálva az eaisybooks rendszerből. Készült a Magyar Államkincstár és az OEP hivatalos igazolási követelményeinek megfelelően.</div>
</body>
</html>`;

  printHtml(html);
}

/**
 * 3. Orvosi igazolás terhesség miatti táppénzhez (9-es kód - Veszélyeztetett terhesség)
 */
export function printPregnancySickLeaveStatement(
  company: CompanyInfo,
  employee: EmployeeInfo,
  leave: LeaveInfo,
  extra: { medicalCertNo: string; obgynName: string; expectedDeliveryDate: string; notes?: string }
) {
  const html = `<!DOCTYPE html>
<html lang="hu">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 25mm 20mm; }
  body { font-family: Arial, sans-serif; font-size: 13px; line-height: 1.6; color: #333; }
  .title { text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 30px; margin-top: 10px; }
  .info-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
  .info-table td { padding: 6px 4px; vertical-align: top; }
  .info-table td.label { font-weight: bold; width: 35%; color: #555; }
  .body-text { margin-bottom: 25px; text-align: justify; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 50px; margin-top: 60px; }
  .sig-box { border-top: 1px solid #999; padding-top: 6px; text-align: center; font-size: 11px; }
  .footer { font-size: 9px; color: #888; text-align: center; margin-top: 80px; border-top: 1px dashed #ccc; padding-top: 10px; }
  .highlight-box { background-color: #fffaf0; border: 1px solid #feebc8; padding: 12px; border-radius: 6px; margin-bottom: 20px; }
</style>
</head>
<body>
  <div class="title">MUNKÁLTATÓI IGAZOLÁS VESZÉLYEZTETETT VÁRANDÓSSÁG MIATTI TÁPPÉNZHEZ</div>
  
  <div class="body-text">
    Ezúton igazoljuk, hogy az alább megjelölt várandós munkavállaló egészségi állapota, valamint terhességének veszélyeztetettsége miatt munkavégzési kötelezettsége alól felmentésre került, és részére orvosilag indokolt <strong>9-es kódú (terhesség/szülés miatti) keresőképtelenségi táppénz</strong> elszámolását kezdeményezzük.
  </div>

  <table class="info-table">
    <tr><td class="label">Foglalkoztató megnevezése:</td><td><strong>${escapeHtml(company.name)}</strong></td></tr>
    <tr><td class="label">Adószám / Székhely:</td><td>${company.taxNumber} / ${escapeHtml(company.address)}</td></tr>
    <tr><td class="label">Munkavállaló neve:</td><td><strong>${escapeHtml(employee.name)}</strong></td></tr>
    <tr><td class="label">TAJ száma / Adóazonosítója:</td><td>${employee.tajNumber} / ${employee.taxId}</td></tr>
    <tr><td class="label">Munkakör:</td><td>${escapeHtml(employee.jobTitle)}</td></tr>
  </table>

  <div class="highlight-box">
    <strong>Orvosi és keresőképtelenségi adatok (9-es kód):</strong>
    <table class="info-table" style="margin-bottom: 0; margin-top: 10px;">
      <tr><td class="label" style="width: 45%">Orvosi igazolás / napló száma:</td><td><strong>${escapeHtml(extra.medicalCertNo)}</strong></td></tr>
      <tr><td class="label">Kezelő nőgyógyász orvos neve:</td><td>${escapeHtml(extra.obgynName)}</td></tr>
      <tr><td class="label">Várható szülés időpontja:</td><td><strong>${extra.expectedDeliveryDate}</strong></td></tr>
      <tr><td class="label">Keresőképtelen állomány kezdete:</td><td>${leave.startDate}</td></tr>
      <tr><td class="label">Keresőképtelen állomány vége:</td><td>${leave.endDate}</td></tr>
    </table>
  </div>

  <div class="body-text">
    A munkáltató tudomásul veszi az orvosi szakvéleményben foglaltakat. A munkavállaló a jelzett keresőképtelenség ideje alatt a munkahelyén munkát nem végez, részére rendelkezésre állási és munkavégzési kötelezettség a jelzett időszakban nem áll fenn.
  </div>

  ${extra.notes ? `<div class="body-text" style="font-style: italic;"><strong>Megjegyzés:</strong> ${escapeHtml(extra.notes)}</div>` : ''}

  <div>Kelt: ${new Date().toLocaleDateString('hu-HU')}</div>

  <div class="signatures">
    <div class="sig-box">Foglalkoztató képviselője (aláírás és bélyegző)</div>
    <div class="sig-box">Munkavállaló aláírása</div>
  </div>

  <div class="footer">Generálva az eaisybooks rendszerből. Megfelel az Szja tv. és az egészségbiztosítási ellátásokról szóló jogszabályoknak.</div>
</body>
</html>`;

  printHtml(html);
}

/**
 * 4. Jegyzőkönyv munkahelyi / üzemi balesetről
 */
export function printWorkplaceAccidentReport(
  company: CompanyInfo,
  employee: EmployeeInfo,
  extra: {
    accidentDate: string;
    accidentTime: string;
    location: string;
    description: string;
    injuryDetails: string;
    witnesses?: string;
    safetyEquipment?: string;
    notes?: string;
  }
) {
  const html = `<!DOCTYPE html>
<html lang="hu">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 20mm 15mm; }
  body { font-family: Arial, sans-serif; font-size: 11px; line-height: 1.5; color: #333; }
  .title { text-align: center; font-size: 16px; font-weight: bold; margin-bottom: 20px; }
  .table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
  .table th, .table td { border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: top; }
  .table th { background-color: #f1f5f9; text-align: left; font-weight: bold; width: 30%; }
  .section-title { font-size: 12px; font-weight: bold; margin-top: 15px; margin-bottom: 8px; color: #1e293b; border-bottom: 1px solid #cbd5e1; padding-bottom: 2px; }
  .body-text { margin-bottom: 15px; text-align: justify; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 40px; }
  .sig-box { border-top: 1px solid #999; padding-top: 6px; text-align: center; font-size: 9px; }
  .footer { font-size: 8px; color: #888; text-align: center; margin-top: 40px; }
</style>
</head>
<body>
  <div class="title">JEGYZŐKÖNYV MUNKAHELYI / ÜZEMI BALESETRŐL</div>
  
  <div class="section-title">1. A munkaadó (foglalkoztató) adatai</div>
  <table class="table">
    <tr><th>Foglalkoztató neve:</th><td>${escapeHtml(company.name)}</td></tr>
    <tr><th>Székhely:</th><td>${escapeHtml(company.address)}</td></tr>
    <tr><th>Adószáma:</th><td>${company.taxNumber}</td></tr>
  </table>

  <div class="section-title">2. A sérült munkavállaló személyi adatai</div>
  <table class="table">
    <tr><th>Sérült neve:</th><td><strong>${escapeHtml(employee.name)}</strong></td></tr>
    <tr><th>Születési név / Anyja neve:</th><td>${escapeHtml(employee.birthName || employee.name)} / ${escapeHtml(employee.mothersName)}</td></tr>
    <tr><th>Születési hely, idő:</th><td>${escapeHtml(employee.birthPlace || '–')}, ${employee.birthDate || '–'}</td></tr>
    <tr><th>TAJ szám / Adóazonosító:</th><td>${employee.tajNumber} / ${employee.taxId}</td></tr>
    <tr><th>Lakcím:</th><td>${escapeHtml(employee.address || '–')}</td></tr>
    <tr><th>Munkakör:</th><td>${escapeHtml(employee.jobTitle || '–')}</td></tr>
  </table>

  <div class="section-title">3. A baleset körülményei és leírása</div>
  <table class="table">
    <tr><th>Időpont:</th><td><strong>${extra.accidentDate} ${extra.accidentTime}</strong></td></tr>
    <tr><th>Helyszín:</th><td>${escapeHtml(extra.location)}</td></tr>
    <tr><th>A baleset leírása (hogyan történt):</th><td>${escapeHtml(extra.description)}</td></tr>
    <tr><th>Alkalmazott egyéni védőeszközök:</th><td>${escapeHtml(extra.safetyEquipment || 'Nem volt szükséges / előírva')}</td></tr>
    <tr><th>Szemtanúk adatai:</th><td>${escapeHtml(extra.witnesses || 'Nem volt szemtanú')}</td></tr>
  </table>

  <div class="section-title">4. Sérülés leírása és orvosi ellátás</div>
  <table class="table">
    <tr><th>Sérülés jellege és testrész:</th><td>${escapeHtml(extra.injuryDetails)}</td></tr>
    <tr><th>Orvosi ellátás adatai (intézmény/orvos):</th><td>Elsősegélyben részesült / Orvosi igazolás csatolva</td></tr>
  </table>

  ${extra.notes ? `
  <div class="section-title">5. Egyéb megjegyzések</div>
  <div class="body-text">${escapeHtml(extra.notes)}</div>
  ` : ''}

  <div class="body-text" style="margin-top: 20px;">
    Jelen jegyzőkönyv a valóságnak megfelelően, a felek együttes jelenlétében került felvételre. A sérült tájékoztatást kapott a baleset üzemi jellegének megállapításával kapcsolatos jogairól.
  </div>

  <div class="signatures">
    <div class="sig-box">Sérült munkavállaló aláírása</div>
    <div class="sig-box">Munkavédelmi felelős / Foglalkoztató</div>
    <div class="sig-box">Szemtanú(k) / Jegyzőkönyvvezető</div>
  </div>

  <div class="footer">Generálva az eaisybooks rendszerből. Készült a munkavédelemről szóló 1993. évi XCIII. törvény előírásai alapján.</div>
</body>
</html>`;

  printHtml(html);
}
