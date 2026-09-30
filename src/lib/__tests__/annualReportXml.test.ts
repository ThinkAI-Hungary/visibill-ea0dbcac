import { describe, it, expect } from 'vitest';
import { buildAnnualReportXml } from '../annualReportXml';

describe('Annual Report XML Generator (OBRH / e-Beszámoló)', () => {
  const baseData = {
    companyName: 'Teszt & Partner Kft.',
    companyAddress: '1054 Budapest, Szabadság tér 1.',
    companyTaxNumber: '12345678-2-41',
    fiscalYear: 2025,
    representativeName: 'Kovács "Ügyvezető" János',
    representativeRole: 'ügyvezető',
    reportDate: '2026-05-15',
    frozenBsData: [
      {
        row_code: 'A',
        name: 'Befektetett eszközök',
        prior_year_balance: 5000000,
        current_balance: 6000000,
        type: 'letter',
        section: 'assets',
      },
      {
        row_code: 'B',
        name: 'Forgóeszközök',
        prior_year_balance: 3000000,
        current_balance: 4000000,
        type: 'letter',
        section: 'assets',
      },
      {
        row_code: 'TOTAL_ASSETS',
        name: 'Eszközök összesen',
        prior_year_balance: 8000000,
        current_balance: 10000000,
        type: 'total',
        section: 'assets',
      },
      {
        row_code: 'D',
        name: 'Saját tőke',
        prior_year_balance: 4000000,
        current_balance: 5000000,
        type: 'letter',
        section: 'liabilities',
      },
      {
        row_code: 'F',
        name: 'Rövid lejáratú kötelezettségek',
        prior_year_balance: 2000000,
        current_balance: 2500000,
        type: 'letter',
        section: 'liabilities',
      },
    ],
    frozenPnlData: [
      {
        row_code: 'I',
        name: 'Értékesítés nettó árbevétele',
        balance: 15000000,
        multiplier: 1,
        type: 'item',
      },
      {
        row_code: 'VII',
        name: 'Adózott eredmény',
        balance: 1000000,
        multiplier: 1,
        type: 'item',
      },
    ],
    notesTemplates: [
      {
        section_key: 'general',
        section_title: '1. Általános adatok',
        default_text: '<p>A <strong>[Cégnév]</strong> ([Székhely], adószám: [Adószám]) [Tárgyév] évi beszámolója.</p>',
      },
      {
        section_key: 'financial',
        section_title: '2. Pénzügyi mutatók',
        default_text: 'Saját tőke: [Saját tőke] ([Saját tőke változás]). ROE: [ROE]. Likviditás: [Likviditás] ([Likviditás értékelés]).',
      },
    ],
    notesSections: [
      {
        section_key: 'custom_section_1',
        title: 'Különleges események',
        text: '<p>Jelentős mérlegfordulónap utáni esemény nem történt.</p>',
        is_custom: true,
      },
    ],
    netIncome: 1000000,
    dividendAmount: 600000,
    retainedEarnings: 400000,
    dividendResolutionDate: '2026-05-15',
  };

  it('generates well-formed XML with the official OBR schema namespace', () => {
    const xml = buildAnnualReportXml(baseData);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<beszamolo xmlns="http://www.e-beszamolo.hu/schema/obr"');
    expect(xml).toContain('</beszamolo>');
  });

  it('escapes XML special characters in company and representative metadata', () => {
    const xml = buildAnnualReportXml(baseData);

    // & should become &amp;
    expect(xml).toContain('<nev>Teszt &amp; Partner Kft.</nev>');
    // " should become &quot;
    expect(xml).toContain('<nev>Kovács &quot;Ügyvezető&quot; János</nev>');
  });

  it('correctly maps header dates and fiscal year', () => {
    const xml = buildAnnualReportXml(baseData);

    expect(xml).toContain('<ev>2025</ev>');
    expect(xml).toContain('<idoszak_kezdete>2025-01-01</idoszak_kezdete>');
    expect(xml).toContain('<idoszak_vege>2025-12-31</idoszak_vege>');
    expect(xml).toContain('<mertekegyseg>Ezer Ft</mertekegyseg>');
  });

  it('scales Balance Sheet values to Thousand HUF (Ezer Ft)', () => {
    const xml = buildAnnualReportXml(baseData);

    // 5,000,000 Ft -> 5000
    // 6,000,000 Ft -> 6000
    expect(xml).toContain('<kod>A</kod>');
    expect(xml).toContain('<elozo_ev>5000</elozo_ev>');
    expect(xml).toContain('<targyev>6000</targyev>');
    expect(xml).toContain('<reszleg>assets</reszleg>');
  });

  it('scales Profit & Loss items to Thousand HUF with multipliers', () => {
    const xml = buildAnnualReportXml(baseData);

    // 15,000,000 -> 15000
    expect(xml).toContain('<kod>I</kod>');
    expect(xml).toContain('<megnevezes>Értékesítés nettó árbevétele</megnevezes>');
    expect(xml).toContain('<targyev>15000</targyev>');
  });

  it('replaces dynamic variables and strips HTML in supplementary notes', () => {
    const xml = buildAnnualReportXml(baseData);

    // Should strip <p> and <strong>, replace [Cégnév]
    expect(xml).toContain('<tartalom>A Teszt &amp; Partner Kft. (1054 Budapest, Szabadság tér 1., adószám: 12345678-2-41) 2025 évi beszámolója.</tartalom>');
    
    // Financial ratios:
    // equity: 5,000,000 (prior: 4,000,000) -> növekedett
    // ROE: netIncome 1,000,000 / 5,000,000 = 20.0%
    // Liquidity: currentAssets (4,000,000) / shortTermLiab (2,500,000) = 1.60 -> 'biztonsággal fedezik'
    expect(xml).toMatch(/Saját tőke: 5\s*000 E Ft \(növekedett\)/);
    expect(xml).toContain('ROE: 20.0%');
    expect(xml).toContain('Likviditás: 1.60 (biztonsággal fedezik)');
  });

  it('includes custom notes sections', () => {
    const xml = buildAnnualReportXml(baseData);

    expect(xml).toContain('<kulcs>custom_section_1</kulcs>');
    expect(xml).toContain('<cim>Különleges események</cim>');
    expect(xml).toContain('<tartalom>Jelentős mérlegfordulónap utáni esemény nem történt.</tartalom>');
  });

  it('exports dividend resolution data', () => {
    const xml = buildAnnualReportXml(baseData);

    expect(xml).toContain('<osztalek_hatarozat>');
    expect(xml).toContain('<adozott_eredmeny>1000</adozott_eredmeny>');
    expect(xml).toContain('<jovahagyott_osztalek>600</jovahagyott_osztalek>');
    expect(xml).toContain('<eredmenytartalekba_helyezett>400</eredmenytartalekba_helyezett>');
    expect(xml).toContain('<hatarozat_kelte>2026-05-15</hatarozat_kelte>');
  });
});
