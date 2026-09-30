import { describe, it, expect } from 'vitest';
import { parseFiling08Xml } from '../nav08XmlParser';
import { buildReconstructionPlan, preparePayrollCalculationRecord } from '../payrollReconstructionEngine';

describe('NAV 08 XML Import - KIVA és EFO támogatás', () => {
  const sampleAnykXml = `<?xml version="1.0" encoding="UTF-8"?>
<nyomtatvanyok xmlns="http://schemas.nav.gov.hu/NTCA/1.0/common">
  <nyomtatvany>
    <nyomtatvanyinformacio>
      <nyomtatvanyazonosito>2608A</nyomtatvanyazonosito>
      <adozo>
        <nev>VBV Vision Kft.</nev>
        <adoszam>13739830-2-03</adoszam>
      </adozo>
      <idoszak>
        <tol>2026-03-01</tol>
        <ig>2026-03-31</ig>
      </idoszak>
    </nyomtatvanyinformacio>
  </nyomtatvany>
  <nyomtatvany>
    <nyomtatvanyinformacio>
      <nyomtatvanyazonosito>2608M</nyomtatvanyazonosito>
      <munkavallalo>
        <nev>Teszt Elek</nev>
        <adoazonosito>8400000001</adoazonosito>
      </munkavallalo>
    </nyomtatvanyinformacio>
    <mezo nev="0A0001C017A">Teszt</mezo>
    <mezo nev="0A0001C018A">Elek</mezo>
    <mezo nev="0A0001D001A">123456782</mezo>
    <mezo nev="0A0001C007A">8400000001</mezo>
    <mezo nev="0F0001C004A">20</mezo>
    <mezo nev="0B0001D0270DA">500000</mezo>
    <mezo nev="0C0001D0330BA">75000</mezo>
    <mezo nev="0I0001D0629CA">92500</mezo>
  </nyomtatvany>
</nyomtatvanyok>`;

  const sampleEfoXml = `<?xml version="1.0" encoding="UTF-8"?>
<nyomtatvanyok xmlns="http://schemas.nav.gov.hu/NTCA/1.0/common">
  <nyomtatvany>
    <nyomtatvanyinformacio>
      <nyomtatvanyazonosito>2608A</nyomtatvanyazonosito>
      <adozo>
        <nev>VBV Vision Kft.</nev>
        <adoszam>13739830-2-03</adoszam>
      </adozo>
      <idoszak>
        <tol>2026-03-01</tol>
        <ig>2026-03-31</ig>
      </idoszak>
    </nyomtatvanyinformacio>
  </nyomtatvany>
  <nyomtatvany>
    <nyomtatvanyinformacio>
      <nyomtatvanyazonosito>2608M</nyomtatvanyazonosito>
      <munkavallalo>
        <nev>Földi-Kónya Ildikó</nev>
        <adoazonosito>8409070138</adoazonosito>
      </munkavallalo>
    </nyomtatvanyinformacio>
    <mezo nev="0A0001C017A">Földi-Kónya</mezo>
    <mezo nev="0A0001C018A">Ildikó</mezo>
    <mezo nev="0A0001D001A">084945558</mezo>
    <mezo nev="0A0001C007A">8409070138</mezo>
    <mezo nev="0F0001C004A">81</mezo>
  </nyomtatvany>
</nyomtatvanyok>`;

  describe('KIVA SZOCHO mentesség', () => {
    it('KIVA cég esetén (options.isKiva = true) a SZOCHO szigorúan 0 Ft marad', () => {
      const parsed = parseFiling08Xml(sampleAnykXml, { isKiva: true });
      expect(parsed.employees).toHaveLength(1);
      const emp = parsed.employees[0];
      expect(emp.grossSalary).toBe(500000);
      expect(emp.szochoAmount).toBe(0);
      expect(parsed.totalSzocho).toBe(0);
    });

    it('Normál (nem KIVA) cég esetén az üres SZOCHO mezőre a 13% fallback érvényesül', () => {
      const parsed = parseFiling08Xml(sampleAnykXml, { isKiva: false });
      expect(parsed.employees).toHaveLength(1);
      const emp = parsed.employees[0];
      expect(emp.grossSalary).toBe(500000);
      expect(emp.szochoAmount).toBe(65000); // 500000 * 0.13
      expect(parsed.totalSzocho).toBe(65000);
    });

    it('preparePayrollCalculationRecord KIVA esetén 0 Ft szocho_amount-ot állít be', () => {
      const parsed = parseFiling08Xml(sampleAnykXml, { isKiva: true });
      const record = preparePayrollCalculationRecord('cycle-1', 'employment-1', parsed.employees[0], { isKiva: true });
      expect(record.szocho_amount).toBe(0);
    });

    it('buildReconstructionPlan KIVA cég esetén 0 Ft totalSzocho-t számol', () => {
      const parsed = parseFiling08Xml(sampleAnykXml, { isKiva: true });
      const plan = buildReconstructionPlan(parsed, [], [], [], { isKiva: true });
      expect(plan.totalSzocho).toBe(0);
      expect(plan.totalEmployerCost).toBe(plan.totalGross);
    });
  });

  describe('EFO (Egyszerűsített foglalkoztatás) felismerés', () => {
    it('81-es ÁNYK kódnál az employmentType efo_alkalmi lesz', () => {
      const parsed = parseFiling08Xml(sampleEfoXml);
      expect(parsed.employees).toHaveLength(1);
      const emp = parsed.employees[0];
      expect(emp.jobCode).toBe('81');
      expect(emp.employmentType).toBe('efo_alkalmi');
    });

    it('EFO kódok (81, 82, 83, 1181, 1138, 1139, EFO) automatikusan efo_alkalmi típusra képződnek le', () => {
      const efoCodes = ['81', '82', '83', '1181', '1138', '1139', 'EFO', 'efo'];
      for (const code of efoCodes) {
        const xml = sampleEfoXml.replace('81', code);
        const parsed = parseFiling08Xml(xml);
        expect(parsed.employees[0].employmentType).toBe('efo_alkalmi');
      }
    });

    it('Normál 20-as kód esetén az employmentType munkaviszony marad (és 1101-re normalizálódik)', () => {
      const parsed = parseFiling08Xml(sampleAnykXml);
      expect(parsed.employees[0].jobCode).toBe('1101');
      expect(parsed.employees[0].employmentType).toBe('munkaviszony');
    });

    it('Valós ÁNYK 08M 0L lap esetén sikeresen kinyeri az EFO napokat, bért, közterhet és időszakot', () => {
      const anyk0LXml = `<?xml version="1.0" encoding="UTF-8"?>
<nyomtatvanyok xmlns="http://schemas.nav.gov.hu/NTCA/1.0/common">
  <nyomtatvany>
    <nyomtatvanyinformacio>
      <nyomtatvanyazonosito>2608A</nyomtatvanyazonosito>
      <adozo>
        <nev>VBV Vision Kft.</nev>
        <adoszam>13739830-2-03</adoszam>
      </adozo>
      <idoszak>
        <tol>2026-01-01</tol>
        <ig>2026-01-31</ig>
      </idoszak>
    </nyomtatvanyinformacio>
  </nyomtatvany>
  <nyomtatvany>
    <nyomtatvanyinformacio>
      <nyomtatvanyazonosito>2608M</nyomtatvanyazonosito>
      <munkavallalo>
        <nev>Kádár Laura</nev>
        <adoazonosito>8499460011</adoazonosito>
      </munkavallalo>
    </nyomtatvanyinformacio>
    <mezo nev="0A0001C017A">Kádár</mezo>
    <mezo nev="0A0001C018A">Laura</mezo>
    <mezo nev="0A0001D001A">121262154</mezo>
    <mezo nev="0A0001C007A">8499460011</mezo>
    <mezo nev="0L0001D0700AA">06</mezo>
    <mezo nev="0L0001D0700BA">0126</mezo>
    <mezo nev="0L0001D0700CA">0130</mezo>
    <mezo nev="0L0001D0700DA">5</mezo>
    <mezo nev="0L0001D0700EA">67176</mezo>
    <mezo nev="0L0001D0700FA">24000</mezo>
    <mezo nev="0L0001D0700GA">N</mezo>
    <mezo nev="0L0001D0716EA">67176</mezo>
    <mezo nev="0L0001D0716FA">24000</mezo>
  </nyomtatvany>
</nyomtatvanyok>`;

      const parsed = parseFiling08Xml(anyk0LXml);
      expect(parsed.employees).toHaveLength(1);
      const emp = parsed.employees[0];

      expect(emp.lastName).toBe('Kádár');
      expect(emp.firstName).toBe('Laura');
      expect(emp.taxId).toBe('8499460011');
      expect(emp.tajNumber).toBe('121262154');
      expect(emp.isEfo).toBe(true);
      expect(emp.employmentType).toBe('efo_alkalmi');
      expect(emp.jobCode).toBe('1138');
      expect(emp.startDate).toBe('2026-01-26');
      expect(emp.endDate).toBe('2026-01-30');
      expect(emp.grossSalary).toBe(67176);
      expect(emp.netSalary).toBe(67176);
      expect(emp.szjaAmount).toBe(0);
      expect(emp.tbAmount).toBe(0);
      expect(emp.szochoAmount).toBe(0);
      expect(emp.efoDays).toBe(5);
      expect(emp.efoWage).toBe(67176);
      expect(emp.efoTax).toBe(24000);
      expect(emp.efoType).toBe('alkalmi');

      expect(parsed.totalGrossSalary).toBe(67176);
      expect(parsed.totalNetSalary).toBe(67176);
      expect(parsed.totalEfoTax).toBe(24000);
      expect(parsed.totalEfoDays).toBe(5);

      // Rekonstrukciós számfejtési rekord ellenőrzése
      const record = preparePayrollCalculationRecord('cycle-2026-01', 'empl-kadar', emp);
      expect(record.gross_salary).toBe(67176);
      expect(record.net_salary).toBe(67176);
      expect(record.szja_amount).toBe(0);
      expect(record.tb_amount).toBe(0);
      expect(record.szocho_amount).toBe(0);
      expect(record.min_base_diff).toBe(0);
      expect(record.min_base_employer_contribution).toBe(0);
      expect(record.insured_days).toBe(0);
      expect(record.metadata.is_efo).toBe(true);
      expect(record.metadata.efo_days).toBe(5);
      expect(record.metadata.efo_wage).toBe(67176);
      expect(record.metadata.efo_tax).toBe(24000);
      expect(record.metadata.efo_type).toBe('alkalmi');
    });

    it('Többsoros 0L lap esetén aggregálja a napokat, bért, közterhet és a kezdő/záró dátumokat', () => {
      const multiRow0LXml = `<?xml version="1.0" encoding="UTF-8"?>
<nyomtatvanyok xmlns="http://schemas.nav.gov.hu/NTCA/1.0/common">
  <nyomtatvany>
    <nyomtatvanyinformacio>
      <nyomtatvanyazonosito>2608A</nyomtatvanyazonosito>
      <adozo><nev>VBV Vision Kft.</nev><adoszam>13739830-2-03</adoszam></adozo>
      <idoszak><tol>2026-01-01</tol><ig>2026-01-31</ig></idoszak>
    </nyomtatvanyinformacio>
  </nyomtatvany>
  <nyomtatvany>
    <nyomtatvanyinformacio>
      <nyomtatvanyazonosito>2608M</nyomtatvanyazonosito>
      <munkavallalo><nev>Kovács Péter</nev><adoazonosito>8411223344</adoazonosito></munkavallalo>
    </nyomtatvanyinformacio>
    <mezo nev="0A0001C017A">Kovács</mezo>
    <mezo nev="0A0001C018A">Péter</mezo>
    <mezo nev="0A0001D001A">123456789</mezo>
    <mezo nev="0A0001C007A">8411223344</mezo>
    <!-- 1. időszak: Jan 5 - Jan 8 (4 nap) -->
    <mezo nev="0L0001D0700AA">06</mezo>
    <mezo nev="0L0001D0700BA">0105</mezo>
    <mezo nev="0L0001D0700CA">0108</mezo>
    <mezo nev="0L0001D0700DA">4</mezo>
    <mezo nev="0L0001D0700EA">50000</mezo>
    <mezo nev="0L0001D0700FA">19200</mezo>
    <!-- 2. időszak: Jan 15 - Jan 18 (4 nap) -->
    <mezo nev="0L0001D0701AA">06</mezo>
    <mezo nev="0L0001D0701BA">0115</mezo>
    <mezo nev="0L0001D0701CA">0118</mezo>
    <mezo nev="0L0001D0701DA">4</mezo>
    <mezo nev="0L0001D0701EA">55000</mezo>
    <mezo nev="0L0001D0701FA">19200</mezo>
    <!-- Összesítő sor -->
    <mezo nev="0L0001D0716EA">105000</mezo>
    <mezo nev="0L0001D0716FA">38400</mezo>
  </nyomtatvany>
</nyomtatvanyok>`;

      const parsed = parseFiling08Xml(multiRow0LXml);
      expect(parsed.employees).toHaveLength(1);
      const emp = parsed.employees[0];

      expect(emp.isEfo).toBe(true);
      expect(emp.efoDays).toBe(8);
      expect(emp.grossSalary).toBe(105000);
      expect(emp.netSalary).toBe(105000);
      expect(emp.efoTax).toBe(38400);
      expect(emp.startDate).toBe('2026-01-05');
      expect(emp.endDate).toBe('2026-01-18');
    });

    it('Különböző EFO szektor kódokat (05 mezőgazdaság, 08 turisztika, 07 filmipar) helyesen osztályoz', () => {
      const testCases = [
        { code: '05', expectedType: 'mezogazdasag', expectedJobCode: '81' },
        { code: '08', expectedType: 'turisztika', expectedJobCode: '82' },
        { code: '07', expectedType: 'filmipar', expectedJobCode: '1139' },
      ];

      for (const tc of testCases) {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<nyomtatvanyok xmlns="http://schemas.nav.gov.hu/NTCA/1.0/common">
  <nyomtatvany>
    <nyomtatvanyinformacio><nyomtatvanyazonosito>2608A</nyomtatvanyazonosito></nyomtatvanyinformacio>
  </nyomtatvany>
  <nyomtatvany>
    <nyomtatvanyinformacio><nyomtatvanyazonosito>2608M</nyomtatvanyazonosito></nyomtatvanyinformacio>
    <mezo nev="0A0001C017A">Teszt</mezo>
    <mezo nev="0A0001C018A">Dolgozó</mezo>
    <mezo nev="0A0001C007A">8412345678</mezo>
    <mezo nev="0L0001D0700AA">${tc.code}</mezo>
    <mezo nev="0L0001D0700DA">3</mezo>
    <mezo nev="0L0001D0700EA">40000</mezo>
    <mezo nev="0L0001D0700FA">7200</mezo>
  </nyomtatvany>
</nyomtatvanyok>`;

        const parsed = parseFiling08Xml(xml);
        expect(parsed.employees[0].efoType).toBe(tc.expectedType);
        expect(parsed.employees[0].jobCode).toBe(tc.expectedJobCode);
      }
    });

    it('Csak 0716-os összesítő sor megléte esetén is kinyeri a bért és a közterhet', () => {
      const totalOnlyXml = `<?xml version="1.0" encoding="UTF-8"?>
<nyomtatvanyok xmlns="http://schemas.nav.gov.hu/NTCA/1.0/common">
  <nyomtatvany>
    <nyomtatvanyinformacio><nyomtatvanyazonosito>2608A</nyomtatvanyazonosito></nyomtatvanyinformacio>
  </nyomtatvany>
  <nyomtatvany>
    <nyomtatvanyinformacio><nyomtatvanyazonosito>2608M</nyomtatvanyazonosito></nyomtatvanyinformacio>
    <mezo nev="0A0001C017A">Szabó</mezo>
    <mezo nev="0A0001C018A">József</mezo>
    <mezo nev="0A0001C007A">8488888888</mezo>
    <mezo nev="0L0001D0716EA">75000</mezo>
    <mezo nev="0L0001D0716FA">28800</mezo>
  </nyomtatvany>
</nyomtatvanyok>`;

      const parsed = parseFiling08Xml(totalOnlyXml);
      expect(parsed.employees).toHaveLength(1);
      const emp = parsed.employees[0];
      expect(emp.isEfo).toBe(true);
      expect(emp.grossSalary).toBe(75000);
      expect(emp.netSalary).toBe(75000);
      expect(emp.efoWage).toBe(75000);
      expect(emp.efoTax).toBe(28800);
    });

    it('Vegyes állomány (1 normál munkavállaló + 1 EFO munkavállaló) rekonstrukciója pontos közteher- és bértömeg-szétválasztással', () => {
      const mixedXml = `<?xml version="1.0" encoding="UTF-8"?>
<nyomtatvanyok xmlns="http://schemas.nav.gov.hu/NTCA/1.0/common">
  <nyomtatvany>
    <nyomtatvanyinformacio>
      <nyomtatvanyazonosito>2608A</nyomtatvanyazonosito>
      <adozo><nev>VBV Vision Kft.</nev><adoszam>13739830-2-03</adoszam></adozo>
      <idoszak><tol>2026-01-01</tol><ig>2026-01-31</ig></idoszak>
    </nyomtatvanyinformacio>
  </nyomtatvany>
  <!-- 1. Dolgozó: Normál alkalmazott (400 000 Ft bruttó) -->
  <nyomtatvany>
    <nyomtatvanyinformacio>
      <nyomtatvanyazonosito>2608M</nyomtatvanyazonosito>
      <munkavallalo><nev>Normál Munkás</nev><adoazonosito>8400000001</adoazonosito></munkavallalo>
    </nyomtatvanyinformacio>
    <mezo nev="0A0001C017A">Normál</mezo>
    <mezo nev="0A0001C018A">Munkás</mezo>
    <mezo nev="0A0001D001A">111222333</mezo>
    <mezo nev="0A0001C007A">8400000001</mezo>
    <mezo nev="0F0001C004A">20</mezo>
    <mezo nev="0B0001D0270DA">400000</mezo>
    <mezo nev="0C0001D0330BA">60000</mezo>
    <mezo nev="0I0001D0629CA">74000</mezo>
    <mezo nev="0I0001D0634CA">400000</mezo>
  </nyomtatvany>
  <!-- 2. Dolgozó: EFO alkalmi munkavállaló (0L lap, 67 176 Ft) -->
  <nyomtatvany>
    <nyomtatvanyinformacio>
      <nyomtatvanyazonosito>2608M</nyomtatvanyazonosito>
      <munkavallalo><nev>Kádár Laura</nev><adoazonosito>8499460011</adoazonosito></munkavallalo>
    </nyomtatvanyinformacio>
    <mezo nev="0A0001C017A">Kádár</mezo>
    <mezo nev="0A0001C018A">Laura</mezo>
    <mezo nev="0A0001D001A">121262154</mezo>
    <mezo nev="0A0001C007A">8499460011</mezo>
    <mezo nev="0L0001D0700AA">06</mezo>
    <mezo nev="0L0001D0700DA">5</mezo>
    <mezo nev="0L0001D0700EA">67176</mezo>
    <mezo nev="0L0001D0700FA">24000</mezo>
    <mezo nev="0L0001D0716EA">67176</mezo>
    <mezo nev="0L0001D0716FA">24000</mezo>
  </nyomtatvany>
</nyomtatvanyok>`;

      const parsed = parseFiling08Xml(mixedXml);
      expect(parsed.employees).toHaveLength(2);

      const [normalEmp, efoEmp] = parsed.employees;

      // Normál dolgozó
      expect(normalEmp.isEfo).toBeFalsy();
      expect(normalEmp.grossSalary).toBe(400000);
      expect(normalEmp.netSalary).toBe(266000);
      expect(normalEmp.szjaAmount).toBe(60000);
      expect(normalEmp.tbAmount).toBe(74000);
      expect(normalEmp.szochoAmount).toBe(52000); // 400 000 * 0.13

      // EFO dolgozó
      expect(efoEmp.isEfo).toBe(true);
      expect(efoEmp.grossSalary).toBe(67176);
      expect(efoEmp.netSalary).toBe(67176);
      expect(efoEmp.szjaAmount).toBe(0);
      expect(efoEmp.tbAmount).toBe(0);
      expect(efoEmp.szochoAmount).toBe(0);
      expect(efoEmp.efoDays).toBe(5);
      expect(efoEmp.efoTax).toBe(24000);

      // Főlapi összesítők
      expect(parsed.totalGrossSalary).toBe(467176);
      expect(parsed.totalNetSalary).toBe(333176);
      expect(parsed.totalSzja).toBe(60000);
      expect(parsed.totalTb).toBe(74000);
      expect(parsed.totalSzocho).toBe(52000); // SZOCHO CSAK a normál dolgozó után számolódik!
      expect(parsed.totalEfoTax).toBe(24000);
      expect(parsed.totalEfoDays).toBe(5);

      // Rekonstrukciós terv
      const plan = buildReconstructionPlan(parsed, [], [], []);
      expect(plan.totalGross).toBe(467176);
      expect(plan.totalSzocho).toBe(52000);
      expect(plan.totalEmployerCost).toBe(467176 + 52000);

      // Rekonstrukciós számfejtési rekordok összehasonlítása
      const normalRec = preparePayrollCalculationRecord('c1', 'j1', normalEmp);
      expect(normalRec.min_base_diff).toBeUndefined();
      expect(normalRec.szocho_amount).toBe(52000);
      expect(normalRec.metadata.is_efo).toBe(false);

      const efoRec = preparePayrollCalculationRecord('c1', 'j2', efoEmp);
      expect(efoRec.min_base_diff).toBe(0);
      expect(efoRec.min_base_employer_contribution).toBe(0);
      expect(efoRec.insured_days).toBe(0);
      expect(efoRec.szocho_amount).toBe(0);
      expect(efoRec.net_salary).toBe(67176);
      expect(efoRec.metadata.is_efo).toBe(true);
    });
  });
});

