/**
 * NAV 08-as bevallás XML generátor
 * 
 * A '08-as havi bevallás a foglalkoztató által levont jövedelmekről és közteher-
 * fizetési kötelezettségekről szól. Ez a generátor a payroll kalkuláció
 * eredményeiből épít XML-t a NAV Online Bevallás rendszer formátumában.
 * 
 * Hivatkozás: NAV '08 bevallás kitöltési útmutató 2026
 */

export interface Filing08Data {
  // Cég adatok
  companyName: string;
  companyTaxNumber: string;  // 8+1+2 formátum
  companyAddress: string;

  // Időszak
  year: number;
  month: number;

  // Összesítő sor
  totalGrossSalary: number;
  totalSzja: number;
  totalTb: number;
  totalSzocho: number;
  totalEho: number;

  // Egyéni sorok
  employees: Filing08EmployeeLine[];

  // Metaadatok
  filingType: 'normal' | 'correction' | 'self_revision';
  submittedBy: string;
  submittedAt: string;
}

export interface Filing08EmployeeLine {
  tajNumber: string;
  taxId: string;
  lastName: string;
  firstName: string;
  birthDate: string;
  mothersName: string;

  // Jogviszony
  jobCode: string;          // pl. '1101'
  insuranceStart: string;   // YYYY-MM-DD
  insuranceEnd?: string;
  weeklyHours: number;

  // Jövedelmek
  grossSalary: number;
  taxBase: number;          // SZJA alap
  szjaAmount: number;
  tbBase: number;           // TB alap
  tbAmount: number;
  szochoBase: number;       // SZOCHO alap
  szochoAmount: number;

  // Kedvezmények
  familyCreditUsed: number;
  under25CreditUsed: number;
  newMotherCreditUsed: number;
  szochoCreditUsed: number;

  // Nettó
  netSalary: number;
}

/**
 * Generate NAV 08 filing XML
 */
export function generateFiling08Xml(data: Filing08Data): string {
  const periodStr = `${data.year}${String(data.month).padStart(2, '0')}`;
  const taxNumParts = parseTaxNumber(data.companyTaxNumber);

  const employeeLines = data.employees.map((emp, idx) => {
    const lineNum = String(idx + 1).padStart(3, '0');
    return `
    <Tetelsor sorszam="${lineNum}">
      <Szemelyadatok>
        <TAJ>${formatTaj(emp.tajNumber)}</TAJ>
        <Adoazonosito>${emp.taxId}</Adoazonosito>
        <Vezeteknev>${escapeXml(emp.lastName)}</Vezeteknev>
        <Keresztnev>${escapeXml(emp.firstName)}</Keresztnev>
        <SzuletesiDatum>${emp.birthDate}</SzuletesiDatum>
        <AnyjaNeve>${escapeXml(emp.mothersName)}</AnyjaNeve>
      </Szemelyadatok>
      <Jogviszony>
        <JogviszonykodT1041>${emp.jobCode}</JogviszonykodT1041>
        <BiztositasKezdete>${emp.insuranceStart}</BiztositasKezdete>
        ${emp.insuranceEnd ? `<BiztositasVege>${emp.insuranceEnd}</BiztositasVege>` : ''}
        <HetiMunkaido>${emp.weeklyHours}</HetiMunkaido>
      </Jogviszony>
      <Jovedelmek>
        <BruttoJovedelem>${Math.round(emp.grossSalary)}</BruttoJovedelem>
        <SZJAAlap>${Math.round(emp.taxBase)}</SZJAAlap>
        <SZJAOsszeg>${Math.round(emp.szjaAmount)}</SZJAOsszeg>
        <TBAlap>${Math.round(emp.tbBase)}</TBAlap>
        <TBJarulekOsszeg>${Math.round(emp.tbAmount)}</TBJarulekOsszeg>
        <SZOCHOAlap>${Math.round(emp.szochoBase)}</SZOCHOAlap>
        <SZOCHOOsszeg>${Math.round(emp.szochoAmount)}</SZOCHOOsszeg>
      </Jovedelmek>
      <Kedvezmenyek>
        <CsaladiKedvezmeny>${Math.round(emp.familyCreditUsed)}</CsaladiKedvezmeny>
        <Alatti25Kedvezmeny>${Math.round(emp.under25CreditUsed)}</Alatti25Kedvezmeny>
        <UjanyaKedvezmeny>${Math.round(emp.newMotherCreditUsed)}</UjanyaKedvezmeny>
        <SZOCHOKedvezmeny>${Math.round(emp.szochoCreditUsed)}</SZOCHOKedvezmeny>
      </Kedvezmenyek>
      <Netto>${Math.round(emp.netSalary)}</Netto>
    </Tetelsor>`;
  }).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NAV08Bevallas xmlns="http://nav.gov.hu/bevallas/08/${data.year}" verzio="2026.1">
  <BevallasAdatok>
    <BevallasIdoszak>${periodStr}</BevallasIdoszak>
    <BevallasTipus>${data.filingType === 'correction' ? 'H' : data.filingType === 'self_revision' ? 'O' : 'M'}</BevallasTipus>
    <BenyujtasDatuma>${data.submittedAt.slice(0, 10)}</BenyujtasDatuma>
  </BevallasAdatok>
  <FoglalkoztatoAdatok>
    <Nev>${escapeXml(data.companyName)}</Nev>
    <Adoszam>${taxNumParts.base}</Adoszam>
    <AfaKod>${taxNumParts.vat}</AfaKod>
    <MegyeKod>${taxNumParts.county}</MegyeKod>
    <Cim>${escapeXml(data.companyAddress)}</Cim>
  </FoglalkoztatoAdatok>
  <Osszesito>
    <OsszBruttoJovedelem>${Math.round(data.totalGrossSalary)}</OsszBruttoJovedelem>
    <OsszSZJA>${Math.round(data.totalSzja)}</OsszSZJA>
    <OsszTBJarultek>${Math.round(data.totalTb)}</OsszTBJarultek>
    <OsszSZOCHO>${Math.round(data.totalSzocho)}</OsszSZOCHO>
    <OsszEHO>${Math.round(data.totalEho)}</OsszEHO>
    <FoglalkoztatottakSzama>${data.employees.length}</FoglalkoztatottakSzama>
  </Osszesito>
  <Tetelsorok>${employeeLines}
  </Tetelsorok>
  <Benyujto>
    <Nev>${escapeXml(data.submittedBy)}</Nev>
    <Datum>${data.submittedAt}</Datum>
  </Benyujto>
</NAV08Bevallas>`;

  return xml;
}

/**
 * Generate M30 annual individual income report XML
 */
export function generateM30Xml(params: {
  year: number;
  companyName: string;
  companyTaxNumber: string;
  employees: {
    tajNumber: string;
    taxId: string;
    lastName: string;
    firstName: string;
    birthDate: string;
    mothersName: string;
    totalGross: number;
    totalSzja: number;
    totalTb: number;
    totalNet: number;
    monthsWorked: number;
  }[];
}): string {
  const lines = params.employees.map((emp, idx) => `
    <Igazolas sorszam="${idx + 1}">
      <TAJ>${formatTaj(emp.tajNumber)}</TAJ>
      <Adoazonosito>${emp.taxId}</Adoazonosito>
      <Nev>${escapeXml(emp.lastName)} ${escapeXml(emp.firstName)}</Nev>
      <SzuletesiDatum>${emp.birthDate}</SzuletesiDatum>
      <AnyjaNeve>${escapeXml(emp.mothersName)}</AnyjaNeve>
      <EvesBruttoJovedelem>${Math.round(emp.totalGross)}</EvesBruttoJovedelem>
      <EvesSZJA>${Math.round(emp.totalSzja)}</EvesSZJA>
      <EvesTBJarultek>${Math.round(emp.totalTb)}</EvesTBJarultek>
      <EvesNettoJovedelem>${Math.round(emp.totalNet)}</EvesNettoJovedelem>
      <MunkaviszonyHonapok>${emp.monthsWorked}</MunkaviszonyHonapok>
    </Igazolas>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<M30Igazolas xmlns="http://nav.gov.hu/bevallas/m30/${params.year}" verzio="2026.1">
  <Ev>${params.year}</Ev>
  <Foglalkoztato>
    <Nev>${escapeXml(params.companyName)}</Nev>
    <Adoszam>${params.companyTaxNumber}</Adoszam>
  </Foglalkoztato>
  <Igazolasok>${lines}
  </Igazolasok>
</M30Igazolas>`;
}

// ── Helpers ──

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatTaj(taj: string): string {
  const digits = taj.replace(/\D/g, '');
  return digits.length === 9 ? `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}` : digits;
}

function parseTaxNumber(taxNum: string): { base: string; vat: string; county: string } {
  const clean = taxNum.replace(/[-\s]/g, '');
  return {
    base: clean.slice(0, 8),
    vat: clean.slice(8, 9) || '1',
    county: clean.slice(9, 11) || '02',
  };
}

/**
 * Download XML as file
 */
export function downloadXml(xml: string, filename: string): void {
  const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
