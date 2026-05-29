import { describe, it, expect } from 'vitest';
import { generatePayslipHtml, type PayslipData } from '../payslipGenerator';

describe('generatePayslipHtml', () => {
  const basePayslip: PayslipData = {
    companyName: 'Teszt Kft.',
    companyTaxNumber: '12345678-1-42',
    companyAddress: 'Budapest, Fő u. 1.',
    employeeName: 'Kiss János',
    tajNumber: '123-456-789',
    taxId: '8012345678',
    bankAccount: '11773016-12345678-00000000',
    jobTitle: 'Fejlesztő',
    jobCode: '1101',
    year: 2026,
    month: 6,
    workDays: 22,
    workedDays: 22,
    overtimeHours: 0,
    sickDays: 0,
    leaveDays: 0,
    baseSalary: 500000,
    supplements: 0,
    bonuses: 0,
    otherIncome: 0,
    grossTotal: 500000,
    szjaBase: 500000,
    szjaAmount: 75000,
    tbAmount: 92500,
    szochoAmount: 65000,
    familyCredit: 0,
    under25Credit: 0,
    newMotherCredit: 0,
    firstMarriageCredit: 0,
    personalDisabilityCredit: 0,
    garnishments: 0,
    advances: 0,
    otherDeductions: 0,
    netSalary: 332500,
  };

  it('should generate valid HTML', () => {
    const html = generatePayslipHtml(basePayslip);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
  });

  it('should contain company name and address', () => {
    const html = generatePayslipHtml(basePayslip);
    expect(html).toContain('Teszt Kft.');
    expect(html).toContain('Budapest');
  });

  it('should contain employee name and IDs', () => {
    const html = generatePayslipHtml(basePayslip);
    expect(html).toContain('Kiss János');
    expect(html).toContain('123-456-789');
    expect(html).toContain('8012345678');
  });

  it('should contain period', () => {
    const html = generatePayslipHtml(basePayslip);
    expect(html).toContain('2026');
    expect(html).toContain('Június');
  });

  it('should contain NETTÓ amount', () => {
    const html = generatePayslipHtml(basePayslip);
    expect(html).toContain('NETTÓ');
    expect(html).toContain('332'); // part of 332,500
  });

  it('should contain tax deductions', () => {
    const html = generatePayslipHtml(basePayslip);
    expect(html).toContain('SZJA');
    expect(html).toContain('TB');
    expect(html).toContain('SZOCHO');
  });

  it('should show garnishments when present', () => {
    const withGarnishments = { ...basePayslip, garnishments: 50000 };
    const html = generatePayslipHtml(withGarnishments);
    expect(html).toContain('Letiltás');
  });

  it('should show family credit when present', () => {
    const withCredit = { ...basePayslip, familyCredit: 33340 };
    const html = generatePayslipHtml(withCredit);
    expect(html).toContain('Családi kedvezmény');
  });

  it('should include bank account', () => {
    const html = generatePayslipHtml(basePayslip);
    expect(html).toContain('11773016');
  });

  it('should include job title', () => {
    const html = generatePayslipHtml(basePayslip);
    expect(html).toContain('Fejlesztő');
  });
});
