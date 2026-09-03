import { describe, it, expect } from 'vitest';
import {
  cleanTaj,
  cleanTaxId,
  normalizeDate,
  parseFiling08Xml,
  type Parsed08Document,
} from '@/lib/payroll/nav08XmlParser';
import {
  buildReconstructionPlan,
  preparePayrollCalculationRecord,
} from '@/lib/payroll/payrollReconstructionEngine';
import type { PayrollEmployee, PayrollEmployment, PayrollCycle } from '@/hooks/usePayrollData';

describe('nav08XmlParser', () => {
  describe('Utility functions', () => {
    it('cleanTaj removes spaces and dashes', () => {
      expect(cleanTaj('123 456 789')).toBe('123456789');
      expect(cleanTaj('123-456-789')).toBe('123456789');
      expect(cleanTaj(null)).toBe('');
      expect(cleanTaj(undefined)).toBe('');
    });

    it('cleanTaxId removes whitespace', () => {
      expect(cleanTaxId('8765432109 ')).toBe('8765432109');
      expect(cleanTaxId(null)).toBe('');
    });

    it('normalizeDate handles various date formats', () => {
      expect(normalizeDate('20260115')).toBe('2026-01-15');
      expect(normalizeDate('2026.03.20')).toBe('2026-03-20');
      expect(normalizeDate('2026-05-01')).toBe('2026-05-01');
      expect(normalizeDate('15.03.1985')).toBe('1985-03-15');
      expect(normalizeDate('22/07/1990')).toBe('1990-07-22');
      expect(normalizeDate(null)).toBe('');
    });

    it('readTextFileWithEncoding handles UTF-8 files', async () => {
      const { readTextFileWithEncoding } = await import('@/lib/payroll/nav08XmlParser');
      const blob = new Blob(['Árvíztűrő tükörfúrógép'], { type: 'text/plain;charset=utf-8' });
      const file = new File([blob], 'test.txt', { type: 'text/plain' });
      const result = await readTextFileWithEncoding(file);
      expect(result).toBe('Árvíztűrő tükörfúrógép');
    });
  });

  describe('Semantic XML Parsing', () => {
    it('successfully parses semantic 08 filing XML', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Filing08>
  <companyName>Ván Iroda Kft.</companyName>
  <companyTaxNumber>11032773-2-03</companyTaxNumber>
  <year>2026</year>
  <month>1</month>
  <Tetelsor sorszam="001">
    <Szemelyadatok>
      <TAJ>123 456 789</TAJ>
      <Adoazonosito>8765432109</Adoazonosito>
      <Vezeteknev>Nagy</Vezeteknev>
      <Keresztnev>Anna</Keresztnev>
      <SzuletesiDatum>1985-03-15</SzuletesiDatum>
      <AnyjaNeve>Kovács Éva</AnyjaNeve>
    </Szemelyadatok>
    <Jogviszony>
      <JogviszonykodT1041>1101</JogviszonykodT1041>
      <BiztositasKezdete>2026-01-02</BiztositasKezdete>
      <HetiMunkaido>40</HetiMunkaido>
      <FEOR>2411</FEOR>
    </Jogviszony>
    <Jovedelmek>
      <BruttoJovedelem>450000</BruttoJovedelem>
      <SZJAAlap>450000</SZJAAlap>
      <SZJAOsszeg>67500</SZJAOsszeg>
      <TBAlap>450000</TBAlap>
      <TBJarulekOsszeg>83250</TBJarulekOsszeg>
      <SZOCHOAlap>450000</SZOCHOAlap>
      <SZOCHOOsszeg>58500</SZOCHOOsszeg>
      <NettoJovedelem>299250</NettoJovedelem>
    </Jovedelmek>
  </Tetelsor>
</Filing08>`;

      const doc = parseFiling08Xml(xml);

      expect(doc.companyName).toBe('Ván Iroda Kft.');
      expect(doc.companyTaxNumber).toBe('11032773-2-03');
      expect(doc.year).toBe(2026);
      expect(doc.month).toBe(1);
      expect(doc.employeeCount).toBe(1);
      expect(doc.totalGrossSalary).toBe(450000);
      expect(doc.totalSzja).toBe(67500);
      expect(doc.totalTb).toBe(83250);
      expect(doc.totalSzocho).toBe(58500);
      expect(doc.totalNetSalary).toBe(299250);

      const emp = doc.employees[0];
      expect(emp.lastName).toBe('Nagy');
      expect(emp.firstName).toBe('Anna');
      expect(emp.tajNumber).toBe('123456789');
      expect(emp.taxId).toBe('8765432109');
      expect(emp.jobCode).toBe('1101');
      expect(emp.feorCode).toBe('2411');
      expect(emp.weeklyHours).toBe(40);
      expect(emp.grossSalary).toBe(450000);
      expect(emp.valid).toBe(true);
    });
  });

  describe('ÁNYK 2608 XML Parsing', () => {
    it('successfully parses official NAV ÁNYK 2608 XML format', () => {
      const anykXml = `<?xml version="1.0" encoding="UTF-8"?>
<nyomtatvanyok>
  <nyomtatvany>
    <nyomtatvanyinformacio>
      <nyomtatvanyazonosito>2608A</nyomtatvanyazonosito>
    </nyomtatvanyinformacio>
    <mezok>
      <mezo nev="0101B">Ván Iroda Kft.</mezo>
      <mezo nev="0101C">11032773-2-03</mezo>
      <mezo nev="0101D">2026.02.01</mezo>
    </mezok>
  </nyomtatvany>
  <nyomtatvany>
    <nyomtatvanyinformacio>
      <nyomtatvanyazonosito>2608M</nyomtatvanyazonosito>
    </nyomtatvanyinformacio>
    <mezok>
      <mezo nev="VEZETEKNEV">Kiss</mezo>
      <mezo nev="KERESZTNEV">Béla</mezo>
      <mezo nev="TAJ">987654321</mezo>
      <mezo nev="ADOAZONOSITO">1234567890</mezo>
      <mezo nev="SZUL_DATUM">19900722</mezo>
      <mezo nev="JOGVISZONYKOD">1101</mezo>
      <mezo nev="FEOR">3312</mezo>
      <mezo nev="HETI_ORA">40</mezo>
      <mezo nev="BRUTTO_BER">380000</mezo>
      <mezo nev="LEVONT_SZJA">57000</mezo>
      <mezo nev="LEVONT_TB">70300</mezo>
      <mezo nev="SZOCHO_OSSZEG">49400</mezo>
    </mezok>
  </nyomtatvany>
</nyomtatvanyok>`;

      const doc = parseFiling08Xml(anykXml);

      expect(doc.companyName).toBe('Ván Iroda Kft.');
      expect(doc.companyTaxNumber).toBe('11032773-2-03');
      expect(doc.year).toBe(2026);
      expect(doc.month).toBe(2);
      expect(doc.filingType).toBe('2608');
      expect(doc.employeeCount).toBe(1);

      const emp = doc.employees[0];
      expect(emp.lastName).toBe('Kiss');
      expect(emp.firstName).toBe('Béla');
      expect(emp.tajNumber).toBe('987654321');
      expect(emp.taxId).toBe('1234567890');
      expect(emp.birthDate).toBe('1990-07-22');
      expect(emp.grossSalary).toBe(380000);
      expect(emp.szjaAmount).toBe(57000);
      expect(emp.tbAmount).toBe(70300);
      expect(emp.szochoAmount).toBe(49400);
      expect(emp.netSalary).toBe(252700);
      expect(emp.valid).toBe(true);
    });

    it('infers year and month from 2608M when 08A főlap is omitted', () => {
      const onlyMxml = `<?xml version="1.0" encoding="UTF-8"?>
<nyomtatvanyok>
  <nyomtatvany>
    <nyomtatvanyinformacio>
      <nyomtatvanyazonosito>2608M</nyomtatvanyazonosito>
    </nyomtatvanyinformacio>
    <mezok>
      <mezo nev="VEZETEKNEV">Szabó</mezo>
      <mezo nev="KERESZTNEV">Péter</mezo>
      <mezo nev="TAJ">112233445</mezo>
      <mezo nev="ADOAZONOSITO">9988776655</mezo>
      <mezo nev="BIZT_KEZDET">2026-03-01</mezo>
      <mezo nev="BRUTTO_BER">600000</mezo>
    </mezok>
  </nyomtatvany>
</nyomtatvanyok>`;

      const doc = parseFiling08Xml(onlyMxml);

      expect(doc.filingType).toBe('2608');
      expect(doc.year).toBe(2026);
      expect(doc.month).toBe(3);
      expect(doc.employeeCount).toBe(1);
      expect(doc.employees[0].lastName).toBe('Szabó');
      expect(doc.employees[0].grossSalary).toBe(600000);
    });

    it('successfully parses ÁNYK XML with eazon attributes', () => {
      const eazonXml = `<?xml version="1.0" encoding="UTF-8"?>
<nyomtatvanyok>
  <nyomtatvany>
    <nyomtatvanyinformacio>
      <nyomtatvanyazonosito>2608A</nyomtatvanyazonosito>
    </nyomtatvanyinformacio>
    <mezok>
      <mezo eazon="0101B">VBV Vision Kft.</mezo>
      <mezo eazon="0101C">13739830-2-03</mezo>
      <mezo eazon="0101D">2026.01.01</mezo>
    </mezok>
  </nyomtatvany>
  <nyomtatvany>
    <nyomtatvanyinformacio>
      <nyomtatvanyazonosito>2608M</nyomtatvanyazonosito>
    </nyomtatvanyinformacio>
    <mezok>
      <mezo eazon="VEZETEKNEV">Kiss</mezo>
      <mezo eazon="KERESZTNEV">János</mezo>
      <mezo eazon="TAJ">123456789</mezo>
      <mezo eazon="ADOAZONOSITO">8765432109</mezo>
      <mezo eazon="BRUTTO_BER">400000</mezo>
    </mezok>
  </nyomtatvany>
</nyomtatvanyok>`;

      const doc = parseFiling08Xml(eazonXml);
      expect(doc.companyName).toBe('VBV Vision Kft.');
      expect(doc.companyTaxNumber).toBe('13739830-2-03');
      expect(doc.year).toBe(2026);
      expect(doc.month).toBe(1);
      expect(doc.employees).toHaveLength(1);
      expect(doc.employees[0].lastName).toBe('Kiss');
      expect(doc.employees[0].firstName).toBe('János');
      expect(doc.employees[0].grossSalary).toBe(400000);
    });

    it('handles invalid XML gracefully', () => {
      const doc = parseFiling08Xml('<not-valid-xml');
      expect(doc.parseErrors.length).toBeGreaterThan(0);
      expect(doc.employeeCount).toBe(0);
    });

    it('successfully parses real NAV ÁNYK 2608 XML with electronic eazon attributes (docs/TESTXML.xml)', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const xmlPath = path.resolve(process.cwd(), 'docs/TESTXML.xml');
      if (!fs.existsSync(xmlPath)) return;

      const xmlContent = fs.readFileSync(xmlPath, 'utf-8');
      const doc = parseFiling08Xml(xmlContent);

      // Cégadatok és Időszak
      expect(doc.companyName).toContain('VBV VISION');
      expect(doc.companyTaxNumber).toBe('13739830203');
      expect(doc.year).toBe(2026);
      expect(doc.month).toBe(1);
      expect(doc.filingType).toBe('2608');
      expect(doc.employeeCount).toBe(13);
      expect(doc.employees).toHaveLength(13);

      // Minden dolgozó érvényes, nincs benne szellem-dolgozó
      expect(doc.employees.every(e => e.valid)).toBe(true);
      expect(doc.employees.every(e => e.lastName && e.firstName)).toBe(true);
      expect(doc.employees.every(e => e.tajNumber && e.taxId)).toBe(true);

      // 1. Dolgozó: Bozóki Klaudia Kitti (25 év alatti kedvezmény)
      const bozoki = doc.employees.find(e => e.lastName === 'Bozóki');
      expect(bozoki).toBeDefined();
      expect(bozoki?.firstName).toBe('Klaudia Kitti');
      expect(bozoki?.taxId).toBe('8501501301');
      expect(bozoki?.tajNumber).toBe('121898298');
      expect(bozoki?.birthDate).toBe('2004-04-22');
      expect(bozoki?.birthPlace).toBe('Kiskunhalas');
      expect(bozoki?.mothersName).toBe('Batiz Otília Kitti');
      expect(bozoki?.startDate).toBe('2024-07-15'); // Valós belépési dátum 0F0001C005A-ból
      expect(bozoki?.feorCode).toBe('4112');
      expect(bozoki?.weeklyHours).toBe(40);
      expect(bozoki?.grossSalary).toBe(373200);
      expect(bozoki?.szjaAmount).toBe(0); // 25 év alatti kedvezmény miatt 0 Ft SZJA
      expect(bozoki?.tbAmount).toBe(69042);
      expect(bozoki?.netSalary).toBe(304158);

      // 2. Dolgozó: Kiss-Százi Emese (normál adózás)
      const emese = doc.employees.find(e => e.lastName === 'Kiss-Százi');
      expect(emese).toBeDefined();
      expect(emese?.firstName).toBe('Emese');
      expect(emese?.taxId).toBe('8420333069');
      expect(emese?.tajNumber).toBe('094481530');
      expect(emese?.birthDate).toBe('1982-01-31');
      expect(emese?.feorCode).toBe('4121');
      expect(emese?.weeklyHours).toBe(40);
      expect(emese?.grossSalary).toBe(1037594);
      expect(emese?.szjaAmount).toBe(155639);
      expect(emese?.tbAmount).toBe(191955);
      expect(emese?.netSalary).toBe(690000);

      // 3. Dolgozó: Kolozsváriné Darányi Dóra (összetett név és ékezetek)
      const dora = doc.employees.find(e => e.taxId === '8458660628');
      expect(dora).toBeDefined();
      expect(dora?.lastName).toBe('Kolozsváriné Darányi');
      expect(dora?.firstName).toBe('Dóra');
      expect(dora?.birthPlace).toBe('Kiskunhalas');
      expect(dora?.mothersName).toBe('Horváth Ilona');

      // 4. Dolgozó: Szvatek-Német Tünde (ü betű mojibake gyógyítás)
      const tunde = doc.employees.find(e => e.taxId === '8463220983');
      expect(tunde).toBeDefined();
      expect(tunde?.lastName).toBe('Szvatek-Német');
      expect(tunde?.firstName).toBe('Tünde');
      expect(tunde?.mothersName).toBe('Tóth Rozália');

      // Összesített bérköltség és rekonstrukciós terv
      const plan = buildReconstructionPlan(doc, [], [], []);
      expect(plan.newEmployeesCount).toBe(13);
      expect(plan.year).toBe(2026);
      expect(plan.month).toBe(1);
      expect(plan.totalGross).toBeGreaterThan(5000000);
    });
  });

  describe('payrollReconstructionEngine', () => {
    it('builds a reconstruction plan against existing database state', () => {
      const mockDoc: Parsed08Document = {
        companyName: 'Test Kft.',
        companyTaxNumber: '12345678-1-23',
        year: 2026,
        month: 1,
        filingType: '2608',
        totalGrossSalary: 500000,
        totalSzja: 75000,
        totalTb: 92500,
        totalSzocho: 65000,
        totalNetSalary: 332500,
        employeeCount: 1,
        parseErrors: [],
        employees: [
          {
            lastName: 'Teszt',
            firstName: 'Elek',
            tajNumber: '111222333',
            taxId: '8888888888',
            jobCode: '1101',
            employmentType: 'munkaviszony',
            startDate: '2026-01-01',
            weeklyHours: 40,
            grossSalary: 500000,
            taxBase: 500000,
            szjaAmount: 75000,
            tbBase: 500000,
            tbAmount: 92500,
            szochoBase: 500000,
            szochoAmount: 65000,
            netSalary: 332500,
            totalDeductions: 167500,
            valid: true,
            errors: [],
            warnings: [],
          },
        ],
      };

      const existingEmployees: PayrollEmployee[] = [];
      const existingEmployments: PayrollEmployment[] = [];
      const existingCycles: PayrollCycle[] = [];

      const plan = buildReconstructionPlan(
        mockDoc,
        existingEmployees,
        existingEmployments,
        existingCycles
      );

      expect(plan.newEmployeesCount).toBe(1);
      expect(plan.existingEmployeesCount).toBe(0);
      expect(plan.cycleWillBeOverwritten).toBe(false);
      expect(plan.totalGross).toBe(500000);
      expect(plan.totalNet).toBe(332500);
      expect(plan.totalEmployerCost).toBe(565000); // Gross 500k + Szocho 65k
    });

    it('prepares payroll calculation records correctly', () => {
      const emp = {
        lastName: 'Kovács',
        firstName: 'János',
        tajNumber: '123456789',
        taxId: '8765432109',
        jobCode: '1101',
        feorCode: '2411',
        employmentType: 'munkaviszony',
        startDate: '2026-01-01',
        weeklyHours: 40,
        grossSalary: 600000,
        taxBase: 600000,
        szjaAmount: 90000,
        tbBase: 600000,
        tbAmount: 111000,
        szochoBase: 600000,
        szochoAmount: 78000,
        netSalary: 399000,
        totalDeductions: 201000,
        familyCreditUsed: 20000,
        valid: true,
        errors: [],
        warnings: [],
      };

      const rec = preparePayrollCalculationRecord('cycle-123', 'empl-456', emp);

      expect(rec.cycle_id).toBe('cycle-123');
      expect(rec.employment_id).toBe('empl-456');
      expect(rec.gross_salary).toBe(600000);
      expect(rec.szja_amount).toBe(90000);
      expect(rec.tb_amount).toBe(111000);
      expect(rec.szocho_amount).toBe(78000);
      expect(rec.net_salary).toBe(399000);
      expect(rec.tax_credits.family_credit).toBe(20000);
      expect(rec.metadata.employee_name).toBe('Kovács János');
    });
  });
});
