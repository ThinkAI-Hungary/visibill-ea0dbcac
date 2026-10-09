import { describe, it, expect } from 'vitest';
import {
  parseHungarianAddress,
  generateMkvkAuditXml,
  getMkvkAuditXmlFileName,
  escapeXml,
  renderXmlTag,
  MkvkAuditXmlRawData,
} from '@/services/mkvkAuditXmlGenerator';

describe('MKVK AuditXML Generator Service', () => {
  describe('Address Parser', () => {
    it('correctly parses standard Hungarian address with postal code, city, street, type and number', () => {
      const addr = parseHungarianAddress('6000 Kecskemét, Széchenyi sétány 2.');
      expect(addr.irszam).toBe('6000');
      expect(addr.telepules).toBe('Kecskemét');
      expect(addr.kozterNev).toBe('Széchenyi');
      expect(addr.kozterJell).toBe('sétány');
      expect(addr.hazszam).toBe('2');
      expect(addr.orszag).toBe('HU');
    });

    it('correctly parses Budapest address with multiple words in street name and hyphenated number', () => {
      const addr = parseHungarianAddress('1055 Budapest, Kossuth Lajos tér 1-3.');
      expect(addr.irszam).toBe('1055');
      expect(addr.telepules).toBe('Budapest');
      expect(addr.kozterNev).toBe('Kossuth Lajos');
      expect(addr.kozterJell).toBe('tér');
      expect(addr.hazszam).toBe('1-3');
    });

    it('handles abbreviated street types (u., krt.)', () => {
      const addr = parseHungarianAddress('6720 Szeged, Tisza Lajos krt. 12/B');
      expect(addr.irszam).toBe('6720');
      expect(addr.telepules).toBe('Szeged');
      expect(addr.kozterNev).toBe('Tisza Lajos');
      expect(addr.kozterJell).toBe('körút');
      expect(addr.hazszam).toBe('12/B');
    });

    it('provides safe fallback for null or empty address strings without crashing', () => {
      const addr = parseHungarianAddress(null);
      expect(addr.orszag).toBe('HU');
      expect(addr.telepules).toBe('Budapest');
      expect(addr.irszam).toBe('1000');
      expect(addr.kozterNev).toBe('Székhely');
      expect(addr.kozterJell).toBe('utca');
      expect(addr.hazszam).toBe('1');
    });
  });

  describe('XML Tag & Escaping', () => {
    it('escapes XML special characters properly', () => {
      expect(escapeXml('AT&T <Trade> "Co." \'Test\'')).toBe('AT&amp;T &lt;Trade&gt; &quot;Co.&quot; &apos;Test&apos;');
    });

    it('renders empty values as self-closing tags', () => {
      expect(renderXmlTag('Epulet', '')).toBe('<Epulet/>');
      expect(renderXmlTag('Szint', null)).toBe('<Szint/>');
      expect(renderXmlTag('Ajto', undefined)).toBe('<Ajto/>');
      expect(renderXmlTag('Nev', 'Kovács & Társa Kft.')).toBe('<Nev>Kovács &amp; Társa Kft.</Nev>');
    });
  });

  describe('File Naming Standard', () => {
    it('generates standard MKVK AuditXML filename removing accents and formatting dates', () => {
      const fn = getMkvkAuditXmlFileName('Dr. Ván Lajos', '2026-01-01', '2026-12-31', 'zip');
      expect(fn).toBe('AuditXML_FK_DrVanLajos_202601-202612.zip');

      const fnXml = getMkvkAuditXmlFileName('Cég & Partner Zrt.', '2026-05-01', '2026-05-31', 'xml');
      expect(fnXml).toBe('AuditXML_FK_CegPartnerZrt_202605-202605.xml');
    });
  });

  describe('XML Generation & Schema Conformance', () => {
    const mockData: MkvkAuditXmlRawData = {
      cegadatok: {
        nev: 'Teszt Vállalkozás Kft.',
        adoszam: '12345678-2-42',
        kezdo_datum: '2026-01-01',
        vegso_datum: '2026-12-31',
        penznem: 'HUF',
        penz_egyseg: 'MNB alapegység',
        cim_nyers: '1117 Budapest, Október huszonharmadika utca 8-10.',
        orszag: 'HU',
        kapcsolat_tarto: 'Nagy Anna',
        telefonszam: '+36301234567',
      },
      naplok: [
        { kod: 1, nev: 'Banki napló', kod_str: 'BANK' },
        { kod: 2, nev: 'Pénztár napló', kod_str: 'PENZTAR' },
      ],
      idoszakok: [
        { kod: 1, nev: '2026/01' },
        { kod: 2, nev: '2026/02' },
      ],
      szamlaszamok: [
        { kod: 1, tkod: '381', nev: 'Pénztár' },
        { kod: 2, tkod: '911', nev: 'Belföldi értékesítés árbevétele' },
      ],
      partnerek: [
        { kod: 1, tkod: 'P001', nev: 'Minta Vevő Kft.', adoszam: '87654321-2-41', eu_adoszam: null, kapcsolt_partner: 'N', kapcs_tart_email: 'vevo@minta.hu' },
      ],
      rogzitok: [
        { kod: 1, tkod: '1', nev: 'Kovács János' },
      ],
      bizonylatok: [
        { biz_id: 1, naplo: 2, biz_szam: 'PT-2026/001', datum: '2026-01-15', idoszak: 1 },
      ],
      tetelek: [
        {
          biz_id: 1,
          tet_id: 1,
          orig_azon: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          szoveg: 'Készpénzes értékesítés',
          tartozik: 1,
          kovetel: 2,
          osszeg: 50000,
          szt_datum: '2026-01-15',
          rogzito: 1,
          rogzitve: '2026-01-15 10:00:00',
        },
      ],
    };

    it('generates valid MKVK AuditXML structure with strict 11 sub-element order', () => {
      const xml = generateMkvkAuditXml(mockData);

      // XML declaration
      expect(xml).toContain('<?xml version="1.0" encoding="utf-8"?>');
      expect(xml).toContain('<Adatok xmlns="http://www.mkvk.hu/AuditXML_FkTet/1.0.23.0"');

      // Verify strictly ordered sequence of the 11 main sections
      const sections = [
        '<XMLAdatok>',
        '<Cegadatok>',
        '<Parameterek>',
        '<Ellenorzes>',
        '<Naplok>',
        '<Idoszakok>',
        '<Szamlaszamok>',
        '<Partnerek>',
        '<Rogzitok>',
        '<FkBizonylatok>',
        '<FkTetelek>',
      ];

      let lastIndex = 0;
      for (const section of sections) {
        const idx = xml.indexOf(section);
        expect(idx).toBeGreaterThan(-1);
        expect(idx).toBeGreaterThan(lastIndex);
        lastIndex = idx;
      }

      // Verify Ellenorzes counts and total amount
      expect(xml).toContain('<NaplokDarab>2</NaplokDarab>');
      expect(xml).toContain('<IdoszakokDarab>2</IdoszakokDarab>');
      expect(xml).toContain('<SzamlaszamokDarab>2</SzamlaszamokDarab>');
      expect(xml).toContain('<PartnerekDarab>1</PartnerekDarab>');
      expect(xml).toContain('<RogzitokDarab>1</RogzitokDarab>');
      expect(xml).toContain('<FkBizonylatokDarab>1</FkBizonylatokDarab>');
      expect(xml).toContain('<FkTetelekDarab>1</FkTetelekDarab>');
      expect(xml).toContain('<FkTetelekOsszeg>50000</FkTetelekOsszeg>');

      // Verify tag preservation on empty tags
      expect(xml).toContain('<Epulet/>');
      expect(xml).toContain('<Lepcsohaz/>');
      expect(xml).toContain('<Szint/>');
      expect(xml).toContain('<Ajto/>');
      expect(xml).toContain('<MegrSzam/>');
      expect(xml).toContain('<DevNem/>');
      expect(xml).toContain('<Mennyiseg/>');
    });

    it('successfully processes real database RPC output without errors', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('fs');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const path = require('path');
      const livePath = path.join(__dirname, '../../scratch/live_rpc_result.json');
      if (fs.existsSync(livePath)) {
        const liveData = JSON.parse(fs.readFileSync(livePath, 'utf8'));
        const xml = generateMkvkAuditXml(liveData);

        expect(xml).toContain('<Nev>Dr. Ván Lajos</Nev>');
        expect(xml).toContain('<Adoszam>71221539-1-23</Adoszam>');
        expect(xml).toContain('<Telepules>Kiskunhalas</Telepules>');
        expect(xml).toContain('<Irszam>6400</Irszam>');
        expect(xml).toContain('<KozterNev>Kőrösi</KozterNev>');
        expect(xml).toContain('<KozterJell>út</KozterJell>');
        expect(xml).toContain('<Hazszam>8</Hazszam>');
        expect(xml).toContain('<FkBizonylatokDarab>17</FkBizonylatokDarab>');
        expect(xml).toContain('<FkTetelekDarab>17</FkTetelekDarab>');
        expect(xml).toContain('<NaplokDarab>9</NaplokDarab>');
        expect(xml).toContain('</Adatok>');
      }
    });
  });
});
