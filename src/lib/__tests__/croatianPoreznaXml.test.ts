import { describe, it, expect } from 'vitest';
import {
  generatePdvSXmlString,
  generateZpXmlString,
  parseCroatianAddress,
  cleanOib,
  formatPoreznaAmount,
  type CroatianEuStatementsData,
} from '../croatianPoreznaXml';

describe('croatianPoreznaXml', () => {
  const sampleData: CroatianEuStatementsData = {
    company: {
      name: 'D-INVOICE d. o. o.',
      oib: 'HR95114485977',
      address: 'SV. IVANA KRSTITELJA 15, DARDA',
      city: 'DARDA',
      street: 'SV. IVANA KRSTITELJA',
      houseNumber: '15',
    },
    periodYear: 2026,
    periodMonth: 8,
    frequency: 'H',
    dateFrom: '2026-08-01',
    dateTo: '2026-08-31',
    preparer: {
      firstName: 'Laura',
      lastName: 'Gergelj',
      phone: '+385957266641',
      email: 'mobilnost385@gmail.com',
      ispostava: '3301',
    },
    pdv_s: {
      items: [
        {
          row_number: 1,
          country_code: 'HU',
          pdv_id: '32478620',
          partner_name: 'Think AI Kft.',
          i1: 45000.0,
          i2: 0.0,
        },
      ],
      totals: {
        i1: 45000.0,
        i2: 0.0,
        total: 45000.0,
      },
    },
    zp: {
      items: [
        {
          row_number: 1,
          country_code: 'CZ',
          pdv_id: '25265474',
          partner_name: 'FASTO S.R.O.',
          i1: 0.0,
          i2: 0.0,
          i3: 0.0,
          i4: 100.0,
        },
        {
          row_number: 2,
          country_code: 'PL',
          pdv_id: '8971945925',
          partner_name: 'EMI-BER POLSKA',
          i1: 0.0,
          i2: 0.0,
          i3: 0.0,
          i4: 11666.08,
        },
      ],
      totals: {
        i1: 0.0,
        i2: 0.0,
        i3: 0.0,
        i4: 11766.08,
        total: 11766.08,
      },
    },
  };

  it('correctly cleans OIB and formats amounts', () => {
    expect(cleanOib('HR95114485977')).toBe('95114485977');
    expect(cleanOib('95114485977')).toBe('95114485977');
    expect(cleanOib('HR 951 144 859 77')).toBe('95114485977');

    expect(formatPoreznaAmount(45000)).toBe('45000.00');
    expect(formatPoreznaAmount(0)).toBe('0.00');
    expect(formatPoreznaAmount(11666.08)).toBe('11666.08');
  });

  it('correctly parses Croatian addresses', () => {
    const addr1 = parseCroatianAddress('Ribarska 10, 31000 osijek');
    expect(addr1.street).toBe('Ribarska');
    expect(addr1.houseNumber).toBe('10');
    expect(addr1.city.toLowerCase()).toBe('osijek');

    const addr2 = parseCroatianAddress('SV. IVANA KRSTITELJA 15');
    expect(addr2.street).toBe('SV. IVANA KRSTITELJA');
    expect(addr2.houseNumber).toBe('15');
  });

  it('generates valid Obrazac PDV-S XML matching the schema', () => {
    const xml = generatePdvSXmlString(sampleData);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<ObrazacPDVS verzijaSheme="1.0" xmlns="http://e-porezna.porezna-uprava.hr/sheme/zahtjevi/ObrazacPDVS/v1-0">');
    expect(xml).toContain('<Metapodaci xmlns="http://e-porezna.porezna-uprava.hr/sheme/Metapodaci/v2-0">');
    expect(xml).toContain('<Naslov dc="http://purl.org/dc/elements/1.1/title">Prijava za stjecanje dobara i primljene usluge iz drugih država članica Europske unije</Naslov>');
    expect(xml).toContain('<Autor dc="http://purl.org/dc/elements/1.1/creator">D-INVOICE d. o. o.</Autor>');
    expect(xml).toContain('<Format dc="http://purl.org/dc/elements/1.1/format">text/xml</Format>');
    expect(xml).toContain('<Jezik dc="http://purl.org/dc/elements/1.1/language">hr-HR</Jezik>');
    expect(xml).toContain('<Uskladjenost dc="http://purl.org/dc/terms/conformsTo">ObrazacPDVS-v1-0</Uskladjenost>');
    expect(xml).toContain('<Tip dc="http://purl.org/dc/elements/1.1/type">Elektronički obrazac</Tip>');
    expect(xml).toContain('<Adresant>Ministarstvo Financija, Porezna uprava, Zagreb</Adresant>');

    // Zaglavlje
    expect(xml).toContain('<Razdoblje><DatumOd>2026-08-01</DatumOd><DatumDo>2026-08-31</DatumDo></Razdoblje>');
    expect(xml).toContain('<Naziv>D-INVOICE d. o. o.</Naziv>');
    expect(xml).toContain('<OIB>95114485977</OIB>');
    expect(xml).toContain('<Mjesto>DARDA</Mjesto>');
    expect(xml).toContain('<Ulica>SV. IVANA KRSTITELJA</Ulica>');
    expect(xml).toContain('<Broj>15</Broj>');
    expect(xml).toContain('<Ime>Laura</Ime>');
    expect(xml).toContain('<Prezime>Gergelj</Prezime>');
    expect(xml).toContain('<Telefon>+385957266641</Telefon>');
    expect(xml).toContain('<Email>mobilnost385@gmail.com</Email>');
    expect(xml).toContain('<Ispostava>3301</Ispostava>');

    // Tijelo
    expect(xml).toContain('<Isporuka><RedBr>1</RedBr><KodDrzave>HU</KodDrzave><PDVID>32478620</PDVID><I1>45000.00</I1><I2>0.00</I2></Isporuka>');
    expect(xml).toContain('<IsporukeUkupno><I1>45000.00</I1><I2>0.00</I2></IsporukeUkupno>');
  });

  it('generates valid Obrazac ZP XML matching the schema', () => {
    const xml = generateZpXmlString(sampleData);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<ObrazacZP verzijaSheme="1.0" xmlns="http://e-porezna.porezna-uprava.hr/sheme/zahtjevi/ObrazacZP/v1-0">');
    expect(xml).toContain('<Metapodaci xmlns="http://e-porezna.porezna-uprava.hr/sheme/Metapodaci/v2-0">');
    expect(xml).toContain('<Naslov dc="http://purl.org/dc/elements/1.1/title">Zbirna prijavu za isporuke dobara i usluga u druge države članice Europske unije</Naslov>');
    expect(xml).toContain('<Uskladjenost dc="http://purl.org/dc/terms/conformsTo">ObrazacZP-v1-0</Uskladjenost>');

    // Tijelo
    expect(xml).toContain('<Isporuka><RedBr>1</RedBr><KodDrzave>CZ</KodDrzave><PDVID>25265474</PDVID><I1>0.00</I1><I2>0.00</I2><I3>0.00</I3><I4>100.00</I4></Isporuka>');
    expect(xml).toContain('<Isporuka><RedBr>2</RedBr><KodDrzave>PL</KodDrzave><PDVID>8971945925</PDVID><I1>0.00</I1><I2>0.00</I2><I3>0.00</I3><I4>11666.08</I4></Isporuka>');
    expect(xml).toContain('<IsporukeUkupno><I1>0.00</I1><I2>0.00</I2><I3>0.00</I3><I4>11766.08</I4></IsporukeUkupno>');
  });
});
