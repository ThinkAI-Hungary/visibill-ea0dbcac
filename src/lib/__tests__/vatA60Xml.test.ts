import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  buildVatA60Xml,
  formatA60PhoneNumber,
  getVatA60Filename,
  normalizeCountryCode,
  VatA60XmlExportData,
} from '../vatA60Xml';

describe('vatA60Xml generator', () => {
  it('formats phone numbers to 06... format expected by 26A60 ÁNYK template', () => {
    expect(formatA60PhoneNumber('+36704240024')).toBe('06704240024');
    expect(formatA60PhoneNumber('36704240024')).toBe('06704240024');
    expect(formatA60PhoneNumber('06704240024')).toBe('06704240024');
    expect(formatA60PhoneNumber('+36 70 424 0024')).toBe('06704240024');
    expect(formatA60PhoneNumber('704240024')).toBe('06704240024');
    expect(formatA60PhoneNumber('')).toBe('');
  });

  it('normalizes country codes: GR -> EL, uppercase', () => {
    expect(normalizeCountryCode('gr')).toBe('EL');
    expect(normalizeCountryCode('GR')).toBe('EL');
    expect(normalizeCountryCode('de')).toBe('DE');
    expect(normalizeCountryCode('  ie  ')).toBe('IE');
    expect(normalizeCountryCode(null)).toBe('');
  });

  it('generates standard NAV filename', () => {
    const filename = getVatA60Filename({
      periodYear: 2026,
      periodMonth: 7,
      companyName: 'TAXOLOGY Kft.',
    });
    expect(filename).toBe('NAV_26A60_2026_07_TAXOLOGY_Kft.xml');
  });

  it('blocks export when frequency is E (annual)', () => {
    const data: VatA60XmlExportData = {
      companyName: 'Test Kft.',
      companyTaxNumber: '12345678-2-42',
      periodYear: 2026,
      periodMonth: 6,
      frequency: 'E',
      lines: [],
    };
    expect(() => buildVatA60Xml(data)).toThrow(/nem nyújtható be/);
  });

  it('golden test: matches the Taxology sample XML field values exactly', () => {
    const sampleXmlPath = path.resolve(
      __dirname,
      '../../../docs/NAV_26A60_2026_07_Taxology_Kft.xml'
    );

    const data: VatA60XmlExportData = {
      companyName: 'TAXOLOGY Kft.',
      companyTaxNumber: '14160877-2-43',
      periodYear: 2026,
      periodMonth: 7,
      periodFrom: '20260701',
      periodTo: '20260731',
      frequency: 'H',
      representativeName: 'Jámbor Viktor',
      phone: '+36704240024',
      lines: [
        {
          category: 'goods_in',
          country_code: 'DE',
          partner_vat_number: '312237805',
          partner_name: 'Digital Charging Solutions GmbH',
          base_amount_rounded: 26,
        },
        {
          category: 'services_in',
          country_code: 'IE',
          partner_vat_number: '3668997OH',
          partner_name: 'Google Cloud EMEA Limited',
          base_amount_rounded: 31,
        },
      ],
    };

    const generated = buildVatA60Xml(data);

    if (fs.existsSync(sampleXmlPath)) {
      const sampleXml = fs.readFileSync(sampleXmlPath, 'utf8');

      // Extract all <mezo eazon="...">val</mezo> from both
      const extractFields = (xml: string) => {
        const regex = /<mezo eazon="([^"]+)">([^<]*)<\/mezo>/g;
        const fields: Record<string, string> = {};
        let match;
        while ((match = regex.exec(xml)) !== null) {
          fields[match[1]] = match[2];
        }
        return fields;
      };

      const sampleFields = extractFields(sampleXml);
      const generatedFields = extractFields(generated);

      expect(generatedFields).toEqual(sampleFields);
    } else {
      expect(generated).toContain('26A60');
      expect(generated).toContain('TAXOLOGY Kft.');
      expect(generated).toContain('14160877');
      expect(generated).toContain('DE');
      expect(generated).toContain('312237805');
      expect(generated).toContain('IE');
      expect(generated).toContain('3668997OH');
    }
  });

  it('includes 0 eFt rows per D-6 decision', () => {
    const data: VatA60XmlExportData = {
      companyName: 'Test Kft.',
      companyTaxNumber: '12345678-2-42',
      periodYear: 2026,
      periodMonth: 7,
      frequency: 'H',
      lines: [
        {
          category: 'services_in',
          country_code: 'DE',
          partner_vat_number: '123456789',
          partner_name: 'Zero Euro Vendor',
          base_amount_rounded: 0,
        },
      ],
    };

    const xml = buildVatA60Xml(data);
    expect(xml).toContain('<mezo eazon="0E0001C0001CA">0</mezo>');
    expect(xml).toContain('<mezo eazon="0E0001C0025CA">0</mezo>');
  });

  it('handles paging: 25 partners in one category creates page 1 (rows 1-24) and page 2 (row 1) with totals', () => {
    const lines = Array.from({ length: 25 }, (_, i) => ({
      category: 'goods_in' as const,
      country_code: 'DE',
      partner_vat_number: `10000000${String(i).padStart(2, '0')}`,
      partner_name: `Vendor ${i + 1}`,
      base_amount_rounded: 10,
    }));

    const data: VatA60XmlExportData = {
      companyName: 'Big Buyer Kft.',
      companyTaxNumber: '87654321-2-42',
      periodYear: 2026,
      periodMonth: 7,
      frequency: 'H',
      lines,
    };

    const xml = buildVatA60Xml(data);

    // Page 1 header and row 1
    expect(xml).toContain('<mezo eazon="0C0001B001A">1</mezo>');
    expect(xml).toContain('<mezo eazon="0C0001C0001AA">DE</mezo>');
    // Page 1 row 24
    expect(xml).toContain('<mezo eazon="0C0001C0024AA">DE</mezo>');
    // Page 1 total: 24 * 10 = 240
    expect(xml).toContain('<mezo eazon="0C0001C0025CA">240</mezo>');

    // Page 2 header and row 1
    expect(xml).toContain('<mezo eazon="0C0002B001A">2</mezo>');
    expect(xml).toContain('<mezo eazon="0C0002C0001AA">DE</mezo>');
    // Page 2 total: 1 * 10 = 10
    expect(xml).toContain('<mezo eazon="0C0002C0025CA">10</mezo>');
  });

  it('excludes non-member state country code EU (OSS)', () => {
    const data: VatA60XmlExportData = {
      companyName: 'Test Kft.',
      companyTaxNumber: '12345678-2-42',
      periodYear: 2026,
      periodMonth: 8,
      frequency: 'H',
      lines: [
        {
          category: 'services_in',
          country_code: 'EU',
          partner_vat_number: '528002224',
          partner_name: 'DigitalOcean LLC',
          base_amount_rounded: 74,
        },
        {
          category: 'services_in',
          country_code: 'IE',
          partner_vat_number: '4276970QH',
          partner_name: 'Anthropic, PBC',
          base_amount_rounded: 106,
        },
      ],
    };

    const xml = buildVatA60Xml(data);
    expect(xml).not.toContain('528002224');
    expect(xml).not.toContain('<mezo eazon="0E0001C0001AA">EU</mezo>');
    expect(xml).toContain('4276970QH');
    expect(xml).toContain('<mezo eazon="0E0001C0001AA">IE</mezo>');
    expect(xml).toContain('<mezo eazon="0E0001C0025CA">106</mezo>');
  });
});
