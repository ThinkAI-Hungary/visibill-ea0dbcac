import { describe, it, expect } from 'vitest';
import {
  buildTfejlhXml,
  formatAnykPhoneNumber,
  formatAnykTaxNumber,
  type TfejlhXmlData,
} from '../tfejlhXml';

describe('NAV 26TFEJLH ÁNYK XML Export (Turizmusfejlesztési hozzájárulás)', () => {
  const benchmarkData: TfejlhXmlData = {
    companyName: 'GOLDEN DÖNER KFT.',
    companyTaxNumber: '25883046-2-42',
    year: 2026,
    month: 7,
    frequency: 'H',
    baseEtkezohely: 16017400,
    baseEtterem: 0,
    baseSzallas: 0,
    baseBusz: 0,
    agentName: 'Jámbor Viktor',
    agentPhone: '06-70-424-0024',
  };

  it('generates XML matching the official AbevJava 26TFEJLH v3.0 benchmark', () => {
    const xml = buildTfejlhXml(benchmarkData);

    // Envelope header checks
    expect(xml).toContain('<?xml version="1.0" encoding="utf-8"?>');
    expect(xml).toContain('<nyomtatvanyok xmlns="http://www.apeh.hu/abev/nyomtatvanyok/2005/01">');
    expect(xml).toContain('<nyomtatvanyazonosito>26TFEJLH</nyomtatvanyazonosito>');
    expect(xml).toContain('<nyomtatvanyverzio>3.0</nyomtatvanyverzio>');

    // Taxpayer information
    expect(xml).toContain('<nev>GOLDEN DÖNER KFT.</nev>');
    expect(xml).toContain('<adoszam>25883046242</adoszam>');
    expect(xml).toContain('<tol>20260701</tol>');
    expect(xml).toContain('<ig>20260731</ig>');
    expect(xml).toContain('<megjegyzes>GOLDEN DÖNER KFT. - 26TFEJLH</megjegyzes>');

    // AbevJava field codes matching tests/docs/eb0148/26TFEJLH.xml
    expect(xml).toContain('<mezo eazon="0A0001A001A">2</mezo>'); // Normál bevallás
    expect(xml).toContain('<mezo eazon="0A0001A003A">641000</mezo>'); // Fizetendő HUF (641 ezer * 1000)
    expect(xml).toContain('<mezo eazon="0A0001C001A">25883046242</mezo>');
    expect(xml).toContain('<mezo eazon="0A0001C005A">GOLDEN DÖNER KFT.</mezo>');
    expect(xml).toContain('<mezo eazon="0A0001C006A">Jámbor Viktor</mezo>');
    expect(xml).toContain('<mezo eazon="0A0001C007A">36704240024</mezo>');
    expect(xml).toContain('<mezo eazon="0A0001D001A">20260701</mezo>');
    expect(xml).toContain('<mezo eazon="0A0001D002A">20260731</mezo>');
    expect(xml).toContain('<mezo eazon="0A0001D007A">H</mezo>');
    expect(xml).toContain('<mezo eazon="0A0001E0001AA">16017</mezo>'); // 16,017,400 Ft -> 16017 eFt
    expect(xml).toContain('<mezo eazon="0A0001E0002AA">0</mezo>');
    expect(xml).toContain('<mezo eazon="0A0001E0003AA">0</mezo>');
    expect(xml).toContain('<mezo eazon="0A0001E0004AA">16017</mezo>'); // Összes alap eFt
    expect(xml).toContain('<mezo eazon="0A0001E0004BA">641</mezo>'); // 4% adó eFt (round(16017 * 0.04))
    expect(xml).toContain('<mezo eazon="0A0001F50001A">0</mezo>');
  });

  it('aggregates multiple categories and rounds to thousand HUF accurately', () => {
    const multiCatData: TfejlhXmlData = {
      companyName: 'Gastrotour Kft.',
      companyTaxNumber: '11223344-1-42',
      year: 2026,
      month: 5,
      frequency: 'H',
      baseEtkezohely: 5432100, // 5432 eFt
      baseEtterem: 2100000,    // 2100 eFt -> 1. sor összesen: 7532 eFt
      baseSzallas: 12500600,   // 12501 eFt -> 2. sor
      baseBusz: 800000,        // 800 eFt   -> 3. sor
    };

    const xml = buildTfejlhXml(multiCatData);

    // Row 1: 5432 + 2100 = 7532
    expect(xml).toContain('<mezo eazon="0A0001E0001AA">7532</mezo>');
    // Row 2: 12501
    expect(xml).toContain('<mezo eazon="0A0001E0002AA">12501</mezo>');
    // Row 3: 800
    expect(xml).toContain('<mezo eazon="0A0001E0003AA">800</mezo>');

    // Row 4 total base: 7532 + 12501 + 800 = 20833 eFt
    expect(xml).toContain('<mezo eazon="0A0001E0004AA">20833</mezo>');

    // Row 4 tax (4%): round(20833 * 0.04) = round(833.32) = 833 eFt
    expect(xml).toContain('<mezo eazon="0A0001E0004BA">833</mezo>');

    // Főlap total tax in whole HUF: 833 * 1000 = 833,000 Ft
    expect(xml).toContain('<mezo eazon="0A0001A003A">833000</mezo>');
  });

  it('supports quarterly (N) and annual (E) filing periods', () => {
    // Quarterly Q1
    const q1Xml = buildTfejlhXml({
      ...benchmarkData,
      frequency: 'N',
      month: 1, // Q1
    });
    expect(q1Xml).toContain('<tol>20260101</tol>');
    expect(q1Xml).toContain('<ig>20260331</ig>');
    expect(q1Xml).toContain('<mezo eazon="0A0001D007A">N</mezo>');

    // Quarterly Q4
    const q4Xml = buildTfejlhXml({
      ...benchmarkData,
      frequency: 'N',
      month: 4, // Q4
    });
    expect(q4Xml).toContain('<tol>20261001</tol>');
    expect(q4Xml).toContain('<ig>20261231</ig>');

    // Annual
    const annualXml = buildTfejlhXml({
      ...benchmarkData,
      frequency: 'E',
    });
    expect(annualXml).toContain('<tol>20260101</tol>');
    expect(annualXml).toContain('<ig>20261231</ig>');
    expect(annualXml).toContain('<mezo eazon="0A0001D007A">E</mezo>');
  });

  it('handles self-revision (önellenőrzés) flag and tax differences correctly', () => {
    const revisionData: TfejlhXmlData = {
      ...benchmarkData,
      isSelfRevision: true,
      selfRevisionTaxDiff: 45000, // 45 eFt
    };

    const xml = buildTfejlhXml(revisionData);

    // 0A0001A001A: 3 = Önellenőrzés
    expect(xml).toContain('<mezo eazon="0A0001A001A">3</mezo>');
    // 0A0001F50001A: 45 eFt
    expect(xml).toContain('<mezo eazon="0A0001F50001A">45</mezo>');
  });

  it('sanitizes XML special characters in company name and notes', () => {
    const dangerousData: TfejlhXmlData = {
      ...benchmarkData,
      companyName: 'Bár & Grill "Csillag" <2026> Kft.',
      agentName: 'Teszt & Fia Kft.',
    };

    const xml = buildTfejlhXml(dangerousData);

    expect(xml).toContain('Bár &amp; Grill &quot;Csillag&quot; &lt;2026&gt; Kft.');
    expect(xml).toContain('Teszt &amp; Fia Kft.');
    expect(xml).not.toContain('& Grill');
  });

  it('formats phone numbers to standardized ÁNYK Hungarian format', () => {
    expect(formatAnykPhoneNumber('06 70 424 0024')).toBe('36704240024');
    expect(formatAnykPhoneNumber('+36 (20) 123-4567')).toBe('36201234567');
    expect(formatAnykPhoneNumber('36704240024')).toBe('36704240024');
    expect(formatAnykPhoneNumber('704240024')).toBe('36704240024');
    expect(formatAnykPhoneNumber('')).toBe('');
  });

  it('formats tax numbers by stripping non-digit characters', () => {
    expect(formatAnykTaxNumber('25883046-2-42')).toBe('25883046242');
    expect(formatAnykTaxNumber('12345678-1-11')).toBe('12345678111');
    expect(formatAnykTaxNumber('')).toBe('');
  });
});
