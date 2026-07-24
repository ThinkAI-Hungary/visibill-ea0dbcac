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
  szochoAmount: number;
  netSalary: number;
}

export interface XmlExportCompanyData {
  name: string;
  taxNumber: string;
  address: string;
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
function downloadXmlFile(xmlContent: string, fileName: string) {
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
            <szocho>${emp.szochoAmount}</szocho>
            <netto>${emp.netSalary}</netto>
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

/**
 * T1041-es biztosítotti be/kijelentő lap XML generátor
 */
export function generateT1041Xml(data: { company: XmlExportCompanyData; employee: any; action: 'bejelentes' | 'kijelentes'; date: string }) {
  const { company, employee, action, date } = data;
  
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<nyomtatvanyok xmlns="http://www.nav.gov.hu/anyk/nyomtatvany">
  <nyomtatvany>
    <fejlec>
      <azonosito>T1041</azonosito>
      <verzio>1.0</verzio>
    </fejlec>
    <adatok>
      <foglalkoztato>
        <adoszam>${company.taxNumber}</adoszam>
        <nev>${company.name}</nev>
      </foglalkoztato>
      <bejelentes>
        <tipus>${action === 'bejelentes' ? 'U' : 'W'}</tipus> <!-- U: Uj biztosított, W: Kijelentés -->
        <biztosított>
          <viselt_nev>${employee.last_name} ${employee.first_name}</viselt_nev>
          <tajszam>${employee.taj_number || ''}</tajszam>
          <adoazonosito>${employee.tax_id || ''}</adoazonosito>
          <szuletesi_datum>${employee.birth_date || ''}</szuletesi_datum>
          <jogviszony_kezdete>${action === 'bejelentes' ? date : ''}</jogviszony_kezdete>
          <jogviszony_vege>${action === 'kijelentes' ? date : ''}</jogviszony_vege>
        </biztosított>
      </bejelentes>
    </adatok>
  </nyomtatvany>
</nyomtatvanyok>`;

  downloadXmlFile(xml, `NAV_T1041_${action}_${employee.last_name}_${employee.first_name}.xml`);
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
