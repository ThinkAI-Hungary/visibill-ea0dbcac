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

  it('should show service charge row when present', () => {
    const withServiceCharge = { ...basePayslip, serviceCharge: 45000 };
    const html = generatePayslipHtml(withServiceCharge);
    expect(html).toContain('Felszolgálási díj (SZJA- és SZOCHO-mentes)');
    expect(html).toContain('45');
  });

  it('should show worked hours in attendance when present', () => {
    const withWorkedHours = { ...basePayslip, workedHours: 160 };
    const html = generatePayslipHtml(withWorkedHours);
    expect(html).toContain('Ledolgozott munkaórák');
    expect(html).toContain('160 óra');
  });

  it('should show commute reimbursement row when present', () => {
    const withCommute = { ...basePayslip, commuteReimbursement: 12000 };
    const html = generatePayslipHtml(withCommute);
    expect(html).toContain('Munkába járás költségtérítés (Adómentes)');
    expect(html).toContain('12');
  });

  it('should display IBAN and weekly hours when provided', () => {
    const withIban = { ...basePayslip, iban: 'HU42117730161234567800000000', weeklyHours: 40 };
    const html = generatePayslipHtml(withIban);
    expect(html).toContain('HU42117730161234567800000000');
    expect(html).toContain('40 óra');
  });

  it('should display leave balance when provided', () => {
    const withLeave = {
      ...basePayslip,
      leaveBalance: { annualTotal: 25, takenCurrent: 2, takenPrevious: 5, remaining: 18 },
      sickLeaveBalance: { annualTotal: 15, takenCurrent: 1, takenPrevious: 2, remaining: 12 },
    };
    const html = generatePayslipHtml(withLeave);
    expect(html).toContain('Éves szabadságkeret');
    expect(html).toContain('25 nap');
    expect(html).toContain('18 nap');
    expect(html).toContain('Betegszabadság (Mt. 15 nap)');
    expect(html).toContain('12 nap');
  });

  it('should display KIVA calculation when taxRegime is KIVA', () => {
    const withKiva = {
      ...basePayslip,
      taxRegime: 'KIVA' as const,
      employerTaxName: 'KIVA (10%)',
      employerTaxAmount: 50000,
    };
    const html = generatePayslipHtml(withKiva);
    expect(html).toContain('KIVA kötelezettség (10%)');
    expect(html).toContain('kisvállalati adó (KIVA) alanya');
  });

  it('should display YTD cumulative figures when provided', () => {
    const withYtd = {
      ...basePayslip,
      ytd: { gross: 3000000, szja: 450000, tb: 555000, net: 1995000 },
    };
    const html = generatePayslipHtml(withYtd);
    expect(html).toContain('Éves göngyölt adatok (YTD tárgyév)');
    expect(html).toContain('YTD Bruttó bér');
    expect(html).toContain('YTD Levont SZJA');
  });

  it('should display pension fund deduction when provided', () => {
    const withPension = {
      ...basePayslip,
      pensionFund: 25000,
      garnishmentCaseNumber: '0123.V.456/2026',
      garnishments: 35000,
    };
    const html = generatePayslipHtml(withPension);
    expect(html).toContain('Önkéntes nyugdíjpénztári tagdíj');
    expect(html).toContain('0123.V.456/2026');
  });
});
