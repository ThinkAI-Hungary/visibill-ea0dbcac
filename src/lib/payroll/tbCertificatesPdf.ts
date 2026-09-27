/**
 * Accounty TB Modul — Törvényi TB és Munkáltatói Igazolások PDF generátor (Tbj. / Mt. / Ebtv.)
 *
 * 1. Tbj. 74. § szerinti Nyilvántartásba vételi igazolás (belépéskor) + munkavállalói átvételi elismervény
 * 2. Tbj. 50. § szerinti Járulékigazolás (kilépéskor és év végén) tételes 4-es TB bontással
 * 3. 2024+ Egységes Munkáltatói Igazolás a munkaviszony megszűnésekor (Mt. 80. § (2))
 * 4. Foglalkoztatói igazolás TB pénzbeli ellátás iránti kérelemhez (táppénz, CSED, GYED) nem-kifizetőhelyi cégeknek
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function hu(text: string): string {
  if (!text) return '';
  return text.replace(/ő/g, 'ö').replace(/Ő/g, 'Ö').replace(/ű/g, 'ü').replace(/Ű/g, 'Ü');
}

const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString('hu-HU');

const fmtDate = (d: string | Date | null | undefined): string => {
  if (!d) return '–';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString('hu-HU');
};

export interface CompanyData {
  name: string;
  taxNumber: string;
  address?: string;
  registrationNumber?: string;
  kshNumber?: string;
}

export interface EmployeeData {
  name: string;
  birthName?: string;
  motherName?: string;
  birthPlace?: string;
  birthDate?: string;
  taxId: string;
  tajNumber: string;
  address?: string;
}

export interface EmploymentDetails {
  startDate: string;
  endDate?: string | null;
  jobTitle: string;
  feorCode: string;
  jobCode: string;
  jobSerialNumber?: number;
  weeklyHours: number;
  baseSalary: number;
  receiptNumber08E?: string | null;
  filingDate08E?: string | null;
}

export interface RegistrationCertificateData {
  company: CompanyData;
  employee: EmployeeData;
  employment: EmploymentDetails;
  issueDate?: string;
}

export interface ContributionCertificateData {
  company: CompanyData;
  employee: EmployeeData;
  employment: EmploymentDetails;
  year: number;
  periodText?: string;
  insuredDays: number;
  suspensionDays?: number;
  suspensionDetails?: string;
  grossContributionBase: number;
  totalTbContribution: number;
  tbPension: number;
  tbHealthNature: number;
  tbHealthCash: number;
  tbLabor: number;
  familyCreditClaimed?: number;
  minBaseEmployerDifference?: number;
  sickLeaveDaysUsed: number;
  tappenzDays?: number;
  issueDate?: string;
}

export interface UnifiedEmploymentCertificateData {
  company: CompanyData;
  employee: EmployeeData;
  employment: EmploymentDetails;
  terminationReason: string;
  terminationLegalRef?: string;
  averageSalary: number;
  vacationAnnualDays: number;
  vacationUsedDays: number;
  vacationCompensatedDays: number;
  vacationCompensationAmount: number;
  garnishmentsText?: string;
  sickLeaveDaysUsed: number;
  severanceAmount?: number;
  issueDate?: string;
}

export interface EmployerMedicalClaimData {
  company: CompanyData;
  employee: EmployeeData;
  employment: EmploymentDetails;
  claimType: 'tappenz' | 'baleseti_tappenz' | 'csed' | 'gyed';
  incapacityStart: string;
  incapacityEnd?: string;
  diagnosisCode?: string;
  sickLeaveDaysUsedInYear: number;
  monthlyWages: Array<{
    period: string;
    grossBase: number;
    workedDays: number;
  }>;
  bankAccountNumber?: string;
  issueDate?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Tbj. 74. § szerinti Nyilvántartásba vételi igazolás
// ─────────────────────────────────────────────────────────────────────────────

export function generateRegistrationCertificatePdf(data: RegistrationCertificateData): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const today = data.issueDate ? fmtDate(data.issueDate) : new Date().toLocaleDateString('hu-HU');

  // Header band
  doc.setFillColor(15, 118, 110);
  doc.rect(0, 0, pw, 22, 'F');
  doc.setTextColor(255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(hu('NYILVÁNTARTÁSBA VÉTELI IGAZOLÁS ÉS ÁTVÉTELI ELISMERVÉNY'), 16, 12);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(hu('Tbj. 74. § (1) bek. & Art. 50. § / 08E bejelentés'), pw - 16, 12, { align: 'right' });
  doc.text(hu('A biztosítási jogviszony létrejöttéről a munkavállaló részére'), 16, 18);

  // Subheader notice
  doc.setTextColor(60);
  doc.setFontSize(8);
  doc.text(
    hu('A foglalkoztató a Tbj. 74. § (1) bekezdése alapján köteles a biztosított részére a nyilvántartásba vételről igazolást kiadni 3 munkanapon belül.'),
    16, 30
  );

  autoTable(doc, {
    startY: 34,
    head: [[hu('1. FOGLALKOZTATÓ (MUNKÁLTATÓ) ADATAI'), '']],
    body: [
      [hu('Foglalkoztató megnevezése:'), hu(data.company.name)],
      [hu('Adószáma:'), data.company.taxNumber || '–'],
      [hu('Székhelye:'), hu(data.company.address || '–')],
      [hu('KSH törzsszáma / Cégjegyzékszáma:'), hu(data.company.kshNumber || data.company.registrationNumber || '–')],
    ],
    theme: 'plain',
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 118, 110], fontSize: 8.5, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, cellPadding: 1.8 },
    columnStyles: { 0: { cellWidth: 65, fontStyle: 'bold', textColor: 80 }, 1: { textColor: 20 } },
    margin: { left: 16, right: 16 },
  });

  const lastY1 = (doc as any).lastAutoTable.finalY;

  autoTable(doc, {
    startY: lastY1 + 4,
    head: [[hu('2. BIZTOSÍTOTT (MUNKAVÁLLALÓ) SZEMÉLYI ADATAI'), '']],
    body: [
      [hu('Viselt név:'), hu(data.employee.name)],
      [hu('Születési név:'), hu(data.employee.birthName || data.employee.name)],
      [hu('Anyja születési neve:'), hu(data.employee.motherName || '–')],
      [hu('Születési hely és idő:'), hu(`${data.employee.birthPlace || '–'}, ${fmtDate(data.employee.birthDate)}`)],
      [hu('Adóazonosító jel:'), data.employee.taxId || '–'],
      [hu('TAJ szám:'), data.employee.tajNumber || '–'],
      [hu('Lakcím / Tartózkodási hely:'), hu(data.employee.address || '–')],
    ],
    theme: 'plain',
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 118, 110], fontSize: 8.5, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, cellPadding: 1.8 },
    columnStyles: { 0: { cellWidth: 65, fontStyle: 'bold', textColor: 80 }, 1: { textColor: 20 } },
    margin: { left: 16, right: 16 },
  });

  const lastY2 = (doc as any).lastAutoTable.finalY;

  autoTable(doc, {
    startY: lastY2 + 4,
    head: [[hu('3. BIZTOSÍTÁSI JOGVISZONY ÉS ELEKTRONIKUS BEJELENTÉS (08E) ADATAI'), '']],
    body: [
      [hu('Biztosítási jogviszony kezdete:'), fmtDate(data.employment.startDate)],
      [hu('Jogviszony törvényi kódja:'), `${data.employment.jobCode} (${hu(data.employment.jobCode === '1115' ? 'Tartós megbízási jogviszony' : 'Munkaviszony')})`],
      [hu('Jogviszony sorszáma:'), String(data.employment.jobSerialNumber || 1)],
      [hu('Munkakör megnevezése és FEOR-08 kódja:'), hu(`${data.employment.jobTitle} (FEOR: ${data.employment.feorCode})`)],
      [hu('Heti munkaidő mértéke:'), `${data.employment.weeklyHours} óra/hét`],
      [hu('Alapbér / Megbízási díj (havi):'), `${fmt(data.employment.baseSalary)} Ft`],
      [hu('NAV 08E elektronikus bejelentés státusza:'), hu(data.employment.receiptNumber08E ? 'Beadva és visszaigazolva' : 'Előkészítve / Beadási határidőben')],
      [hu('NAV iktatószám / Nyugtaazonosító:'), data.employment.receiptNumber08E || hu('Elektronikus feladás alatt')],
      [hu('Bejelentés időpontja:'), fmtDate(data.employment.filingDate08E) || today],
    ],
    theme: 'grid',
    headStyles: { fillColor: [15, 118, 110], textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 0: { cellWidth: 70, fontStyle: 'bold' }, 1: { fontStyle: 'normal' } },
    margin: { left: 16, right: 16 },
  });

  const lastY3 = (doc as any).lastAutoTable.finalY;

  // Legal declaration box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.rect(16, lastY3 + 6, pw - 32, 22, 'FD');
  doc.setFontSize(7.5);
  doc.setTextColor(50);
  doc.setFont('helvetica', 'normal');
  const declText = hu(
    'Foglalkoztatói igazolás: Alulírott foglalkoztató kijelentem és igazolom, hogy a fent nevezett biztosított adatait az adózás rendjéről szóló 2017. évi CL. törvény 50. §-ában, valamint a Tbj. 74. § (1) bekezdésében előírtaknak megfelelően a Nemzeti Adó- és Vámhivatal felé a jogviszony kezdetéig elektronikus úton bejelentettem, és a nyilvántartásba vételről jelen igazolást a munkavállaló részére átadtam.'
  );
  doc.text(doc.splitTextToSize(declText, pw - 40), 20, lastY3 + 12);

  // Signatures
  const sigY = lastY3 + 36;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30);

  doc.text(hu(`Kelt: ${today}`), 16, sigY);

  // Employer signature
  doc.line(16, sigY + 20, 85, sigY + 20);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(hu('Foglalkoztató (Munkáltató) cégszerű aláírása'), 16, sigY + 24);

  // Employee receipt acknowledgment
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(hu('MUNKAVÁLLALÓI ÁTVÉTELI ELISMERVÉNY:'), pw / 2 + 10, sigY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(hu('A fenti igazolás egy eredeti példányát a mai napon átvettem.'), pw / 2 + 10, sigY + 6);
  doc.line(pw / 2 + 10, sigY + 20, pw - 16, sigY + 20);
  doc.text(hu('Munkavállaló (Biztosított) aláírása'), pw / 2 + 10, sigY + 24);

  return doc;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Tbj. 50. § szerinti Járulékigazolás (kilépéskor / év végén)
// ─────────────────────────────────────────────────────────────────────────────

export function generateContributionCertificatePdf(data: ContributionCertificateData): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const today = data.issueDate ? fmtDate(data.issueDate) : new Date().toLocaleDateString('hu-HU');

  // Header band
  doc.setFillColor(15, 118, 110);
  doc.rect(0, 0, pw, 22, 'F');
  doc.setTextColor(255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(hu('IGAZOLÁS A BIZTOSÍTÁSI JOGVISZONYRÓL ÉS A LEVONT JÁRULÉKOKRÓL'), 16, 12);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(hu('Tbj. 50. § (1)-(2) bek. szerinti hivatalos igazolás'), pw - 16, 12, { align: 'right' });
  doc.text(hu(`Elszámolási időszak: ${data.year}. év ${data.periodText || ''}`), 16, 18);

  // Parties info card
  autoTable(doc, {
    startY: 28,
    head: [[hu('FOGLALKOZTATÓ ÉS BIZTOSÍTOTT ADATAI'), '']],
    body: [
      [hu('Foglalkoztató (Munkáltató):'), hu(`${data.company.name} (Adószám: ${data.company.taxNumber})`)],
      [hu('Biztosított neve és születési neve:'), hu(`${data.employee.name} (szül.: ${data.employee.birthName || data.employee.name})`)],
      [hu('Anyja neve, születési hely/idő:'), hu(`${data.employee.motherName || '–'}, ${data.employee.birthPlace || '–'} ${fmtDate(data.employee.birthDate)}`)],
      [hu('Adóazonosító jel / TAJ szám:'), `${data.employee.taxId} / ${data.employee.tajNumber}`],
      [hu('Biztosítási jogviszony időtartama:'), `${fmtDate(data.employment.startDate)} – ${data.employment.endDate ? fmtDate(data.employment.endDate) : 'fennáll'}`],
      [hu('Biztosításban töltött napok száma:'), `${data.insuredDays} naptári nap`],
      [hu('Szünetelési időszak(ok) napjai:'), `${data.suspensionDays || 0} nap (${hu(data.suspensionDetails || 'nem volt szünetelés')})`],
    ],
    theme: 'plain',
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 118, 110], fontSize: 8.5, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, cellPadding: 1.8 },
    columnStyles: { 0: { cellWidth: 70, fontStyle: 'bold', textColor: 80 }, 1: { textColor: 20 } },
    margin: { left: 16, right: 16 },
  });

  const lastY1 = (doc as any).lastAutoTable.finalY;

  // 4-way statutory contribution table
  autoTable(doc, {
    startY: lastY1 + 4,
    head: [[hu('TÁRSADALOMBIZTOSÍTÁSI JÁRULÉKOK TÉTELES BONTÁSA (Tbj.)'), hu('ÖSSZEG (FT)')]],
    body: [
      [hu('1. Járulékalapot képező bruttó jövedelem összesen'), fmt(data.grossContributionBase)],
      [hu('2. Levont 18,5% Társadalombiztosítási járulék összesen'), fmt(data.totalTbContribution)],
      [hu('   - ebből 10% Nyugdíjbiztosítási járulék'), fmt(data.tbPension)],
      [hu('   - ebből 4% Természetbeni egészségbiztosítási járulék'), fmt(data.tbHealthNature)],
      [hu('   - ebből 3% Pénzbeli egészségbiztosítási járulék'), fmt(data.tbHealthCash)],
      [hu('   - ebből 1,5% Munkaerőpiaci járulék'), fmt(data.tbLabor)],
      [hu('3. Érvényesített családi járulékkedvezmény'), fmt(data.familyCreditClaimed || 0)],
      [hu('4. Minimális járulékalap (Tbj. 27. § (2)) munkáltatói különbözete'), fmt(data.minBaseEmployerDifference || 0)],
      [hu('5. Tárgyévben igénybe vett betegszabadság (15 napos keretből)'), `${data.sickLeaveDaysUsed} nap`],
      [hu('6. Igénybe vett táppénzes napok száma a tárgyévben'), `${data.tappenzDays || 0} nap`],
    ],
    theme: 'grid',
    headStyles: { fillColor: [15, 118, 110], textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, cellPadding: 2.2 },
    columnStyles: { 0: { cellWidth: 125 }, 1: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: 16, right: 16 },
    didParseCell: (hookData) => {
      if (hookData.section === 'body' && (hookData.row.index === 0 || hookData.row.index === 1)) {
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.fillColor = [248, 250, 252];
      }
    }
  });

  const lastY2 = (doc as any).lastAutoTable.finalY;

  // Legal note
  doc.setFontSize(7.5);
  doc.setTextColor(80);
  doc.setFont('helvetica', 'normal');
  const note = hu(
    'A Tbj. 50. § (1) és (2) bekezdése alapján kiadott igazolás hitelesen tanúsítja a tárgyévben levont és a NAV felé megvallott járulékok összegét. A természetbeni és pénzbeli egészségbiztosítási, valamint nyugdíjbiztosítási járulékbontás megfelel a 2608-as adó- és járulékbevallás M-lapjain szereplő adattartalomnak.'
  );
  doc.text(doc.splitTextToSize(note, pw - 32), 16, lastY2 + 8);

  // Signatures
  const sigY = lastY2 + 28;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30);
  doc.text(hu(`Kelt: ${today}`), 16, sigY);

  doc.line(16, sigY + 20, 85, sigY + 20);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(hu('Foglalkoztató cégszerű aláírása és bélyegzője'), 16, sigY + 24);

  doc.line(pw - 85, sigY + 20, pw - 16, sigY + 20);
  doc.text(hu('Biztosított (Munkavállaló) átvevő aláírása'), pw - 85, sigY + 24);

  return doc;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. 2024+ Egységes Munkáltatói Igazolás a munkaviszony megszűnésekor
// ─────────────────────────────────────────────────────────────────────────────

export function generateUnifiedEmploymentCertificatePdf(data: UnifiedEmploymentCertificateData): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const today = data.issueDate ? fmtDate(data.issueDate) : new Date().toLocaleDateString('hu-HU');

  // Header band
  doc.setFillColor(15, 118, 110);
  doc.rect(0, 0, pw, 22, 'F');
  doc.setTextColor(255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(hu('EGYSÉGES MUNKÁLTATÓI IGAZOLÁS'), 16, 12);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(hu('Mt. 80. § (2) bek. (2024-től hatályos egységes okirat)'), pw - 16, 12, { align: 'right' });
  doc.text(hu('A munkaviszony megszűnésekor kiadandó hivatalos igazolás'), 16, 18);

  autoTable(doc, {
    startY: 28,
    head: [[hu('A MUNKAVISZONY ÉS A FELEK ADATAI'), '']],
    body: [
      [hu('Munkáltató neve és adószáma:'), hu(`${data.company.name} (${data.company.taxNumber})`)],
      [hu('Munkavállaló neve és születési neve:'), hu(`${data.employee.name} (${data.employee.birthName || data.employee.name})`)],
      [hu('Anyja születési neve:'), hu(data.employee.motherName || '–')],
      [hu('Születési hely és idő:'), hu(`${data.employee.birthPlace || '–'}, ${fmtDate(data.employee.birthDate)}`)],
      [hu('Adóazonosító jel / TAJ szám:'), `${data.employee.taxId} / ${data.employee.tajNumber}`],
      [hu('Munkaviszony időtartama:'), `${fmtDate(data.employment.startDate)} – ${fmtDate(data.employment.endDate)}`],
      [hu('Munkakör és FEOR kód:'), hu(`${data.employment.jobTitle} (FEOR: ${data.employment.feorCode})`)],
      [hu('Heti munkaidő / Foglalkoztatás jellege:'), `${data.employment.weeklyHours} óra/hét (${data.employment.weeklyHours === 40 ? 'teljes' : 'részmunkaidő'})`],
    ],
    theme: 'plain',
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 118, 110], fontSize: 8.5, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, cellPadding: 1.8 },
    columnStyles: { 0: { cellWidth: 70, fontStyle: 'bold', textColor: 80 }, 1: { textColor: 20 } },
    margin: { left: 16, right: 16 },
  });

  const lastY1 = (doc as any).lastAutoTable.finalY;

  autoTable(doc, {
    startY: lastY1 + 4,
    head: [[hu('TÖRVÉNYI RENDELKEZÉSEK ÉS ELSZÁMOLÁSI TÉTELEK (Mt. 80. §)'), hu('ÉRTÉK / NYILATKOZAT')]],
    body: [
      [hu('Munkaviszony megszűnésének módja:'), hu(data.terminationReason)],
      [hu('Megszűnés jogszabályi hivatkozása:'), hu(data.terminationLegalRef || 'Mt. 64. § (1) bek.')],
      [hu('Irányadó átlagkereset (távolléti díj):'), `${fmt(data.averageSalary)} Ft/hó`],
      [hu('Tárgyévi szabadságkeret és igénybevétel:'), hu(`${data.vacationAnnualDays} napból ${data.vacationUsedDays} nap kiadva`)],
      [hu('Megváltott szabadságnapok és összege:'), `${data.vacationCompensatedDays} nap — ${fmt(data.vacationCompensationAmount)} Ft`],
      [hu('Tárgyévben igénybe vett betegszabadság:'), `${data.sickLeaveDaysUsed} nap (15 napos keretből)`],
      [hu('Végkielégítés megállapítása:'), data.severanceAmount && data.severanceAmount > 0 ? `${fmt(data.severanceAmount)} Ft` : hu('Nem került megállapításra (0 Ft)')],
      [hu('Munkabért terhelő tartozás, letiltás:'), hu(data.garnishmentsText || 'A munkavállaló munkabérét végrehajtói letiltás vagy egyéb tartozás NEM terheli.')],
      [hu('Versenytilalmi / tanulmányi kötelezettség:'), hu('Nem terheli a munkavállalót')],
    ],
    theme: 'grid',
    headStyles: { fillColor: [15, 118, 110], textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, cellPadding: 2.2 },
    columnStyles: { 0: { cellWidth: 75, fontStyle: 'bold' }, 1: { fontStyle: 'normal' } },
    margin: { left: 16, right: 16 },
  });

  const lastY2 = (doc as any).lastAutoTable.finalY;

  // Closing text & Signatures
  doc.setFontSize(7.5);
  doc.setTextColor(80);
  doc.setFont('helvetica', 'normal');
  doc.text(
    hu('A munka törvénykönyvéről szóló 2012. évi I. törvény 80. § (2) bekezdése alapján jelen okirat hitelesen tanúsítja a munkaviszony megszűnésének adatait és az elszámolás tényeit.'),
    16, lastY2 + 8
  );

  const sigY = lastY2 + 26;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30);
  doc.text(hu(`Kelt: ${today}`), 16, sigY);

  doc.line(16, sigY + 18, 85, sigY + 18);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(hu('Munkáltató cégszerű aláírása'), 16, sigY + 22);

  doc.line(pw - 85, sigY + 18, pw - 16, sigY + 18);
  doc.text(hu('Munkavállaló átvevő aláírása'), pw - 85, sigY + 22);

  return doc;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Foglalkoztatói igazolás TB pénzbeli ellátás iránti kérelemhez
// ─────────────────────────────────────────────────────────────────────────────

export function generateEmployerMedicalClaimPdf(data: EmployerMedicalClaimData): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const today = data.issueDate ? fmtDate(data.issueDate) : new Date().toLocaleDateString('hu-HU');

  const claimTitles: Record<string, string> = {
    tappenz: 'TÁPPÉNZ IRÁNTI KÉRELEM',
    baleseti_tappenz: 'BALESETI TÁPPÉNZ IRÁNTI KÉRELEM',
    csed: 'CSECSEMŐGONDDOZÁSI DÍJ (CSED) IRÁNTI KÉRELEM',
    gyed: 'GYERMEKGONDOZÁSI DÍJ (GYED) IRÁNTI KÉRELEM',
  };

  // Header band
  doc.setFillColor(15, 118, 110);
  doc.rect(0, 0, pw, 22, 'F');
  doc.setTextColor(255);
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.text(hu('FOGLALKOZTATÓI IGAZOLÁS TB PÉNZBELI ELLÁTÁS IRÁNTI KÉRELEMHEZ'), 16, 12);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(hu('Ebtv. vhr. (Kormányhivatal Egészségbiztosítási Főosztálya részére)'), pw - 16, 12, { align: 'right' });
  doc.text(hu(`Igényelt ellátás: ${claimTitles[data.claimType] || data.claimType.toUpperCase()}`), 16, 18);

  autoTable(doc, {
    startY: 28,
    head: [[hu('1. FOGLALKOZTATÓ ÉS BIZTOSÍTOTT ADATAI'), '']],
    body: [
      [hu('Foglalkoztató neve / székhelye:'), hu(`${data.company.name}, ${data.company.address || '–'}`)],
      [hu('Foglalkoztató adószáma:'), data.company.taxNumber],
      [hu('Foglalkoztató TB minősége:'), hu('NEM TB-kifizetőhely (kormányhivatali elbírálás)')],
      [hu('Biztosított neve és születési neve:'), hu(`${data.employee.name} (${data.employee.birthName || data.employee.name})`)],
      [hu('Anyja születési neve:'), hu(data.employee.motherName || '–')],
      [hu('Születési hely és idő:'), hu(`${data.employee.birthPlace || '–'}, ${fmtDate(data.employee.birthDate)}`)],
      [hu('TAJ szám / Adóazonosító:'), `${data.employee.tajNumber} / ${data.employee.taxId}`],
      [hu('Biztosítási jogviszony kezdete:'), fmtDate(data.employment.startDate)],
      [hu('Munkakör és FEOR kód:'), hu(`${data.employment.jobTitle} (${data.employment.feorCode})`)],
      [hu('Heti munkaidő mértéke:'), `${data.employment.weeklyHours} óra/hét`],
    ],
    theme: 'plain',
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 118, 110], fontSize: 8.5, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.8, cellPadding: 1.6 },
    columnStyles: { 0: { cellWidth: 65, fontStyle: 'bold', textColor: 80 }, 1: { textColor: 20 } },
    margin: { left: 16, right: 16 },
  });

  const lastY1 = (doc as any).lastAutoTable.finalY;

  autoTable(doc, {
    startY: lastY1 + 3,
    head: [[hu('2. KERESŐKÉPTELENSÉG ÉS BETEGSZABADSÁG ADATAI'), '']],
    body: [
      [hu('Keresőképtelenség kezdő napja:'), fmtDate(data.incapacityStart)],
      [hu('Keresőképtelenség utolsó napja:'), data.incapacityEnd ? fmtDate(data.incapacityEnd) : hu('Folyamatosan fennáll')],
      [hu('Orvosi igazolás szerinti kód / jelleg:'), hu(data.diagnosisCode || 'Általános betegség')],
      [hu('Tárgyévben igénybe vett betegszabadság:'), hu(`${data.sickLeaveDaysUsedInYear} nap a 15 munkanapos törvényi keretből`)],
      [hu('Betegszabadság keret állapota:'), hu(data.sickLeaveDaysUsedInYear >= 15 ? 'Kimerítve — táppénz az 1. naptól jár' : `Még ${15 - data.sickLeaveDaysUsedInYear} munkanap van hátra`)],
      [hu('Biztosított folyósítási bankszámlaszáma:'), data.bankAccountNumber || hu('Munkavállaló nyilvántartott számlaszáma')],
    ],
    theme: 'grid',
    headStyles: { fillColor: [15, 118, 110], textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.8, cellPadding: 1.8 },
    columnStyles: { 0: { cellWidth: 70, fontStyle: 'bold' }, 1: { fontStyle: 'normal' } },
    margin: { left: 16, right: 16 },
  });

  const lastY2 = (doc as any).lastAutoTable.finalY;

  // Monthly breakdown of contributory wages for calculating benefit rate
  const wageRows = (data.monthlyWages || []).map(w => [
    w.period,
    `${w.workedDays} nap`,
    `${fmt(w.grossBase)} Ft`,
  ]);

  if (wageRows.length === 0) {
    wageRows.push([hu('Irányadó időszaki havi átlag'), '22 nap', `${fmt(data.employment.baseSalary)} Ft`]);
  }

  autoTable(doc, {
    startY: lastY2 + 3,
    head: [[hu('3. IRÁNYADÓ IDŐSZAKI TB JÁRULÉKALAPOT KÉPEZŐ JÖVEDELMEK'), hu('LEDOLGOZOTT IDŐ'), hu('BRUTTÓ JÁRULÉKALAP')]],
    body: wageRows,
    theme: 'grid',
    headStyles: { fillColor: [15, 118, 110], textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.8, cellPadding: 1.8 },
    columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 40, halign: 'center' }, 2: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: 16, right: 16 },
  });

  const lastY3 = (doc as any).lastAutoTable.finalY;

  doc.setFontSize(7.5);
  doc.setTextColor(80);
  doc.setFont('helvetica', 'normal');
  doc.text(
    hu('A foglalkoztató büntetőjogi felelőssége tudatában igazolja, hogy a közölt jövedelem- és távolléti adatok a hiteles könyvelési nyilvántartással és a benyújtott 08-as bevallásokkal megegyeznek.'),
    16, lastY3 + 8
  );

  const sigY = lastY3 + 24;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30);
  doc.text(hu(`Kelt: ${today}`), 16, sigY);

  doc.line(16, sigY + 18, 85, sigY + 18);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(hu('Foglalkoztató (Munkáltató) cégszerű aláírása és bélyegzője'), 16, sigY + 22);

  return doc;
}

// ─────────────────────────────────────────────────────────────────────────────
// Segédfüggvények letöltéshez és megnyitáshoz
// ─────────────────────────────────────────────────────────────────────────────

export function downloadPdf(doc: jsPDF, filename: string): void {
  doc.save(filename);
}

export function previewPdfInNewTab(doc: jsPDF): void {
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}
