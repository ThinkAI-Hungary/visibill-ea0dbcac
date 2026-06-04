import { describe, it, expect } from 'vitest';
import { generateFiling08Xml, generateM30Xml, type Filing08Data, type Filing08EmployeeLine } from '../filingGenerator';

const baseEmployee: Filing08EmployeeLine = {
  tajNumber: '123456789',
  taxId: '8012345678',
  lastName: 'Kiss',
  firstName: 'János',
  birthDate: '1990-05-15',
  mothersName: 'Nagy Éva',
  jobCode: '1101',
  insuranceStart: '2020-01-01',
  weeklyHours: 40,
  grossSalary: 500000,
  taxBase: 500000,
  szjaAmount: 75000,
  tbBase: 500000,
  tbAmount: 92500,
  szochoBase: 500000,
  szochoAmount: 65000,
  familyCreditUsed: 0,
  under25CreditUsed: 0,
  newMotherCreditUsed: 0,
  szochoCreditUsed: 0,
  netSalary: 332500,
};

const baseData: Filing08Data = {
  companyName: 'Teszt Kft.',
  companyTaxNumber: '12345678-1-42',
  companyAddress: 'Budapest, Fő u. 1.',
  year: 2026,
  month: 6,
  totalGrossSalary: 500000,
  totalSzja: 75000,
  totalTb: 92500,
  totalSzocho: 65000,
  totalEho: 0,
  employees: [baseEmployee],
  filingType: 'normal',
  submittedBy: 'Könyvelő',
  submittedAt: '2026-07-12T10:00:00Z',
};

describe('generateFiling08Xml', () => {
  it('should generate valid XML with prolog', () => {
    const xml = generateFiling08Xml(baseData);
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('NAV08Bevallas');
  });

  it('should include period in YYYYMM format', () => {
    const xml = generateFiling08Xml(baseData);
    expect(xml).toContain('202606');
  });

  it('should include company tax number parts', () => {
    const xml = generateFiling08Xml(baseData);
    expect(xml).toContain('12345678'); // base
    expect(xml).toContain('<AfaKod>1</AfaKod>');
    expect(xml).toContain('<MegyeKod>42</MegyeKod>');
  });

  it('should include employee TAJ formatted', () => {
    const xml = generateFiling08Xml(baseData);
    expect(xml).toContain('123-456-789');
  });

  it('should include SZJA, TB, SZOCHO amounts', () => {
    const xml = generateFiling08Xml(baseData);
    expect(xml).toContain('<SZJAOsszeg>75000</SZJAOsszeg>');
    expect(xml).toContain('<TBJarulekOsszeg>92500</TBJarulekOsszeg>');
    expect(xml).toContain('<SZOCHOOsszeg>65000</SZOCHOOsszeg>');
  });

  it('should include summary totals', () => {
    const xml = generateFiling08Xml(baseData);
    expect(xml).toContain('<OsszBruttoJovedelem>500000</OsszBruttoJovedelem>');
    expect(xml).toContain('<FoglalkoztatottakSzama>1</FoglalkoztatottakSzama>');
  });

  it('should mark correction type', () => {
    const correction = { ...baseData, filingType: 'correction' as const };
    const xml = generateFiling08Xml(correction);
    expect(xml).toContain('<BevallasTipus>H</BevallasTipus>');
  });

  it('should escape XML special characters', () => {
    const special = { ...baseData, companyName: 'A & B < C > D' };
    const xml = generateFiling08Xml(special);
    expect(xml).toContain('A &amp; B &lt; C &gt; D');
  });

  it('should handle multiple employees', () => {
    const multi = {
      ...baseData,
      employees: [baseEmployee, { ...baseEmployee, tajNumber: '987654321', lastName: 'Nagy' }],
    };
    const xml = generateFiling08Xml(multi);
    expect(xml).toContain('sorszam="001"');
    expect(xml).toContain('sorszam="002"');
    expect(xml).toContain('987-654-321');
  });
});

describe('generateM30Xml', () => {
  it('should generate M30 annual report XML', () => {
    const xml = generateM30Xml({
      year: 2026,
      companyName: 'Teszt Kft.',
      companyTaxNumber: '12345678-1-42',
      employees: [{
        tajNumber: '123456789',
        taxId: '8012345678',
        lastName: 'Kiss',
        firstName: 'János',
        birthDate: '1990-05-15',
        mothersName: 'Nagy Éva',
        totalGross: 6000000,
        totalSzja: 900000,
        totalTb: 1110000,
        totalNet: 3990000,
        monthsWorked: 12,
      }],
    });
    expect(xml).toContain('M30Igazolas');
    expect(xml).toContain('<Ev>2026</Ev>');
    expect(xml).toContain('<EvesBruttoJovedelem>6000000</EvesBruttoJovedelem>');
    expect(xml).toContain('<MunkaviszonyHonapok>12</MunkaviszonyHonapok>');
  });
});
