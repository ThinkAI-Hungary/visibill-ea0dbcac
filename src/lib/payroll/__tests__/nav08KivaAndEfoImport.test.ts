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
  });
});
