/**
 * Accounty Bérszámfejtési Modul — NAV ÁNYK XML Generátor
 *
 * Támogatott nyomtatványok:
 * - 2608 (Havi járulékbevallás)
 * - 2658 (EV havi járulékbevallás)
 * - T1041 (Biztosítottak bejelentése)
 * - T1042E (EFO alkalmi munka bejelentése)
 */

export interface XmlExportEmployeeData {
  lastName: string;
  firstName: string;
  birthName: string;
  birthPlace: string;
  birthDate: string;
  mothersName: string;
  tajNumber: string;
  taxId: string;
  grossSalary: number;
  szjaAmount: number;
  tbAmount: number;
  tbPension?: number;
  tbHealthNature?: number;
  tbHealthCash?: number;
  tbLabor?: number;
  minBaseDiff?: number;
  minBaseEmployerContribution?: number;
  insuredDays?: number;
  suspensionDays?: number;
  szochoAmount: number;
  netSalary: number;
}

export interface XmlExportCompanyData {
  name: string;
  taxNumber: string;
  address: string;
  kshNumber?: string;
}

export interface XmlExportFilingData {
  year: number;
  month: number;
  company: XmlExportCompanyData;
  employees: XmlExportEmployeeData[];
}

/**
 * Helper to download raw XML string as a file
 */
export function downloadXmlFile(xmlContent: string, fileName: string) {
  const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * 2608-as havi adó- és járulékbevallás XML generátor
 */
export function generate2608Xml(data: XmlExportFilingData) {
  const { year, month, company, employees } = data;
  const monthStr = month.toString().padStart(2, '0');
  
  let xml = `<?xml version="1.0" encoding="utf-8"?>
<nyomtatvanyok xmlns="http://www.nav.gov.hu/anyk/nyomtatvany">
  <nyomtatvany>
    <fejlec>
      <azonosito>${year.toString().slice(2)}08</azonosito>
      <verzio>1.0</verzio>
    </fejlec>
    <adatok>
      <cegadatok>
        <adoszam>${company.taxNumber}</adoszam>
        <nev>${company.name}</nev>
        <cim>${company.address}</cim>
      </cegadatok>
      <idoszak>
        <tol>${year}-${monthStr}-01</tol>
        <ig>${year}-${monthStr}-${new Date(year, month, 0).getDate()}</ig>
      </idoszak>
      <alkalmazottak>
`;

  employees.forEach((emp, idx) => {
    const tbPension = emp.tbPension ?? Math.round(emp.tbAmount * (10 / 18.5));
    const tbHealthNature = emp.tbHealthNature ?? Math.round(emp.tbAmount * (4 / 18.5));
    const tbHealthCash = emp.tbHealthCash ?? Math.round(emp.tbAmount * (3 / 18.5));
    const tbLabor = emp.tbLabor ?? Math.round(emp.tbAmount * (1.5 / 18.5));

    xml += `        <alkalmazott id="${idx + 1}">
          <szemelyes>
            <viselt_nev>${emp.lastName} ${emp.firstName}</viselt_nev>
            <szuletesi_nev>${emp.birthName || `${emp.lastName} ${emp.firstName}`}</szuletesi_nev>
            <szuletesi_hely>${emp.birthPlace || ''}</szuletesi_hely>
            <szuletesi_datum>${emp.birthDate || ''}</szuletesi_datum>
            <anyja_neve>${emp.mothersName || ''}</anyja_neve>
            <tajszam>${emp.tajNumber || ''}</tajszam>
            <adoazonosito>${emp.taxId || ''}</adoazonosito>
          </szemelyes>
          <szamfejtes>
            <brutto>${emp.grossSalary}</brutto>
            <szja>${emp.szjaAmount}</szja>
            <tb_jarulek>${emp.tbAmount}</tb_jarulek>
            <tb_nyugdij>${tbPension}</tb_nyugdij>
            <tb_termeszetbeni>${tbHealthNature}</tb_termeszetbeni>
            <tb_penzbeli>${tbHealthCash}</tb_penzbeli>
            <tb_munkaeropiaci>${tbLabor}</tb_munkaeropiaci>
            ${emp.minBaseEmployerContribution ? `<min_jarulekalap_kulonbozet>${emp.minBaseDiff || 0}</min_jarulekalap_kulonbozet><min_alap_munkaltatoi_tb>${emp.minBaseEmployerContribution}</min_alap_munkaltatoi_tb>` : ''}
            <szocho>${emp.szochoAmount}</szocho>
            <netto>${emp.netSalary}</netto>
            <biztositasi_napok>${emp.insuredDays ?? 30}</biztositasi_napok>
            <szuneteles_napok>${emp.suspensionDays ?? 0}</szuneteles_napok>
          </szamfejtes>
        </alkalmazott>
`;
  });

  xml += `      </alkalmazottak>
    </adatok>
  </nyomtatvany>
</nyomtatvanyok>`;

  downloadXmlFile(xml, `NAV_2608_${year}_${monthStr}_${company.name.replace(/\s+/g, '_')}.xml`);
}

/**
 * 2658-as EV járulékbevallás XML generátor
 */
export function generate2658Xml(data: { year: number; month: number; company: XmlExportCompanyData; calculation: any }) {
  const { year, month, company, calculation } = data;
  const monthStr = month.toString().padStart(2, '0');

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<nyomtatvanyok xmlns="http://www.nav.gov.hu/anyk/nyomtatvany">
  <nyomtatvany>
    <fejlec>
      <azonosito>${year.toString().slice(2)}58</azonosito>
      <verzio>1.0</verzio>
    </fejlec>
    <adatok>
      <vallalkozo>
        <adoszam>${company.taxNumber}</adoszam>
        <nev>${company.name}</nev>
        <cim>${company.address}</cim>
      </vallalkozo>
      <idoszak>
        <tol>${year}-${monthStr}-01</tol>
        <ig>${year}-${monthStr}-${new Date(year, month, 0).getDate()}</ig>
      </idoszak>
      <szamfejtes>
        <tb_alap>${calculation.gross_salary || 0}</tb_alap>
        <tb_amount>${calculation.tb_amount || 0}</tb_amount>
        <szocho_alap>${calculation.gross_salary || 0}</szocho_alap>
        <szocho_amount>${calculation.szocho_amount || 0}</szocho_amount>
      </szamfejtes>
    </adatok>
  </nyomtatvany>
</nyomtatvanyok>`;

  downloadXmlFile(xml, `NAV_2658_${year}_${monthStr}_${company.name.replace(/\s+/g, '_')}.xml`);
}

export interface XmlExport08EItem {
  employee: {
    lastName: string;
    firstName: string;
    birthName?: string;
    motherName?: string;
    birthPlace?: string;
    birthDate?: string;
    taxId: string;
    tajNumber: string;
    citizenship?: string;
  };
  changeCode: string; // '01' (kezdet), '02' (megszűnés), '03' - '08'
  jobCode: string; // '1101', '1115'
  jobSerialNumber?: number;
  feorCode: string;
  weeklyHours: number;
  effectiveDate: string;
  endDate?: string;
  isPensioner?: boolean;
}

/**
 * 08E (korábban T1041) biztosítotti be/kijelentő és változásbejelentő XML generátor
 */
export function generate08EXml(data: { company: XmlExportCompanyData; items: XmlExport08EItem[]; year?: number }) {
  const { company, items, year = new Date().getFullYear() } = data;
  const year2 = year.toString().slice(2);

  let xml = `<?xml version="1.0" encoding="utf-8"?>
<nyomtatvanyok xmlns="http://www.nav.gov.hu/anyk/nyomtatvany">
  <nyomtatvany>
    <fejlec>
      <azonosito>${year2}08E</azonosito>
      <verzio>1.0</verzio>
    </fejlec>
    <adatok>
      <foglalkoztato>
        <adoszam>${company.taxNumber}</adoszam>
        <nev>${company.name}</nev>
        <cim>${company.address || ''}</cim>
      </foglalkoztato>
      <bejelentesek>
`;

  items.forEach((item, idx) => {
    xml += `        <bejelentes id="${idx + 1}">
          <valtozaskod>${item.changeCode}</valtozaskod>
          <jogviszonysorszam>${item.jobSerialNumber || 1}</jogviszonysorszam>
          <jogviszony_kod>${item.jobCode || '1101'}</jogviszony_kod>
          <feor_kod>${item.feorCode || '4112'}</feor_kod>
          <heti_munkaido>${item.weeklyHours || 40}</heti_munkaido>
          <hatalyba_lepes>${item.effectiveDate}</hatalyba_lepes>
          ${item.endDate ? `<jogviszony_vege>${item.endDate}</jogviszony_vege>` : ''}
          ${item.isPensioner ? `<nyugdijas>1</nyugdijas>` : ''}
          <biztositott>
            <viselt_nev>${item.employee.lastName} ${item.employee.firstName}</viselt_nev>
            <szuletesi_nev>${item.employee.birthName || `${item.employee.lastName} ${item.employee.firstName}`}</szuletesi_nev>
            <anyja_neve>${item.employee.motherName || ''}</anyja_neve>
            <szuletesi_hely>${item.employee.birthPlace || ''}</szuletesi_hely>
            <szuletesi_datum>${item.employee.birthDate || ''}</szuletesi_datum>
            <tajszam>${item.employee.tajNumber || ''}</tajszam>
            <adoazonosito>${item.employee.taxId || ''}</adoazonosito>
            <allampolgarsag>${item.employee.citizenship || 'HUN'}</allampolgarsag>
          </biztositott>
        </bejelentes>
`;
  });

  xml += `      </bejelentesek>
    </adatok>
  </nyomtatvany>
</nyomtatvanyok>`;

  downloadXmlFile(xml, `NAV_08E_${year}_${company.name.replace(/\s+/g, '_')}.xml`);
}

/**
 * T1041-es biztosítotti be/kijelentő lap XML generátor (kompatibilitásként a 08E-re továbbítva)
 */
export function generateT1041Xml(data: { company: XmlExportCompanyData; employee: any; action: 'bejelentes' | 'kijelentes'; date: string }) {
  const { company, employee, action, date } = data;
  
  const item: XmlExport08EItem = {
    employee: {
      lastName: employee.last_name || '',
      firstName: employee.first_name || '',
      birthName: employee.birth_name || `${employee.last_name || ''} ${employee.first_name || ''}`,
      motherName: employee.mother_name || '',
      birthPlace: employee.birth_place || '',
      birthDate: employee.birth_date || '',
      taxId: employee.tax_id || '',
      tajNumber: employee.taj_number || '',
    },
    changeCode: action === 'bejelentes' ? '01' : '02',
    jobCode: employee.job_code || '1101',
    jobSerialNumber: employee.job_serial_number || 1,
    feorCode: employee.feor_code || '4112',
    weeklyHours: employee.weekly_hours || 40,
    effectiveDate: date,
    endDate: action === 'kijelentes' ? date : undefined,
  };

  generate08EXml({ company, items: [item] });
}

/**
 * T1042E-es EFO alkalmi munka bejelentő lap XML generátor
 */
export function generateT1042EXml(data: { company: XmlExportCompanyData; employee: any; date: string; daysCount: number }) {
  const { company, employee, date, daysCount } = data;

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<nyomtatvanyok xmlns="http://www.nav.gov.hu/anyk/nyomtatvany">
  <nyomtatvany>
    <fejlec>
      <azonosito>T1042E</azonosito>
      <verzio>1.0</verzio>
    </fejlec>
    <adatok>
      <foglalkoztato>
        <adoszam>${company.taxNumber}</adoszam>
        <nev>${company.name}</nev>
      </foglalkoztato>
      <efo_bejelentes>
        <nev>${employee.last_name} ${employee.first_name}</nev>
        <adoazonosito>${employee.tax_id || ''}</adoazonosito>
        <tajszam>${employee.taj_number || ''}</tajszam>
        <datum>${date}</datum>
        <napok_szama>${daysCount}</napok_szama>
        <efo_tipus>alkalmi_munka</efo_tipus>
      </efo_bejelentes>
    </adatok>
  </nyomtatvany>
</nyomtatvanyok>`;

  downloadXmlFile(xml, `NAV_T1042E_${employee.last_name}_${employee.first_name}_${date}.xml`);
}
