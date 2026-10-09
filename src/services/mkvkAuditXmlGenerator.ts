import JSZip from 'jszip';

export interface MkvkCompanyData {
  nev: string;
  adoszam: string;
  kezdo_datum: string;
  vegso_datum: string;
  penznem: string;
  penz_egyseg: string;
  cim_nyers?: string | null;
  orszag?: string | null;
  kapcsolat_tarto?: string | null;
  telefonszam?: string | null;
}

export interface MkvkJournal {
  kod: number;
  nev: string;
  kod_str?: string;
}

export interface MkvkPeriod {
  kod: number;
  nev: string;
}

export interface MkvkAccount {
  kod: number;
  tkod: string;
  nev: string;
  itkod?: string;
  inev?: string;
}

export interface MkvkPartner {
  kod: number;
  tkod: string;
  nev: string;
  adoszam?: string | null;
  eu_adoszam?: string | null;
  kapcsolt_partner?: string | null;
  kapcs_tart_email?: string | null;
}

export interface MkvkRecorder {
  kod: number;
  tkod: string;
  nev: string;
}

export interface MkvkVoucher {
  biz_id: number;
  naplo: number;
  biz_szam: string;
  datum: string;
  idoszak: number;
  megr_szam?: string;
}

export interface MkvkItem {
  biz_id: number;
  tet_id: number;
  orig_azon: string;
  szoveg: string;
  tartozik: number;
  kovetel: number;
  osszeg: number;
  dev_osszeg?: number | null;
  dev_nem?: string | null;
  dev_arfolyam?: number | null;
  afa_alap?: number | null;
  afa_kulcs?: string | null;
  szt_datum: string;
  partner?: number | null;
  pu_azo?: string | null;
  telj_datum?: string | null;
  szt?: string | null;
  szt_tet_id?: number | null;
  rogzito: number;
  rogzitve: string;
  afa_ev?: number | null;
  afa_honap?: number | null;
  egyeb1?: string | null;
}

export interface MkvkAuditXmlRawData {
  cegadatok: MkvkCompanyData;
  naplok: MkvkJournal[];
  idoszakok: MkvkPeriod[];
  szamlaszamok: MkvkAccount[];
  partnerek: MkvkPartner[];
  rogzitok: MkvkRecorder[];
  bizonylatok: MkvkVoucher[];
  tetelek: MkvkItem[];
}

export interface ParsedHungarianAddress {
  orszag: string;
  telepules: string;
  irszam: string;
  kozterNev: string;
  kozterJell: string;
  hazszam: string;
  epulet: string;
  lepcsohaz: string;
  szint: string;
  ajto: string;
}

/**
 * Escapes characters for XML compliance
 */
export function escapeXml(str: string | number | null | undefined): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Renders an XML tag with content or self-closing if empty
 */
export function renderXmlTag(tag: string, content: string | number | null | undefined): string {
  if (content === null || content === undefined || content === '') {
    return `<${tag}/>`;
  }
  return `<${tag}>${escapeXml(content)}</${tag}>`;
}

/**
 * Robust Hungarian address string parser
 */
export function parseHungarianAddress(rawAddress?: string | null, defaultCountry: string = 'HU'): ParsedHungarianAddress {
  const result: ParsedHungarianAddress = {
    orszag: defaultCountry || 'HU',
    telepules: 'Budapest',
    irszam: '1000',
    kozterNev: 'Székhely',
    kozterJell: 'utca',
    hazszam: '1',
    epulet: '',
    lepcsohaz: '',
    szint: '',
    ajto: '',
  };

  if (!rawAddress || !rawAddress.trim()) {
    return result;
  }

  let text = rawAddress.trim();

  // 1. Check for 4-digit postal code
  const zipMatch = text.match(/\b([1-9]\d{3})\b/);
  if (zipMatch) {
    result.irszam = zipMatch[1];
    text = text.replace(zipMatch[0], '').trim();
  }

  // 2. Split by commas if available
  const commaParts = text.split(',').map((p) => p.trim()).filter(Boolean);

  if (commaParts.length >= 2) {
    // Usually part 0 is City (or City + Postcode), part 1 is Street + Num
    const possibleCity = commaParts[0].replace(/[0-9]/g, '').trim();
    if (possibleCity.length > 1) {
      result.telepules = possibleCity;
    }

    const streetPart = commaParts.slice(1).join(' ').trim();
    parseStreetPart(streetPart, result);
  } else {
    // Single string without commas, e.g. "Kecskemét Petőfi u. 12"
    const words = text.split(/\s+/);
    if (words.length > 0 && !result.telepules) {
      result.telepules = words[0];
      const streetPart = words.slice(1).join(' ').trim();
      parseStreetPart(streetPart, result);
    } else {
      parseStreetPart(text, result);
    }
  }

  return result;
}

function parseStreetPart(streetText: string, target: ParsedHungarianAddress) {
  if (!streetText) return;

  const streetTypes = [
    'utca', 'út', 'tér', 'sor', 'sétány', 'körút', 'fasor', 'park',
    'köz', 'rakpart', 'dűlő', 'telep', 'major', 'krt', 'u'
  ];
  const typeRegex = new RegExp(`(?:^|\\s+)(${streetTypes.join('|')})(?:\\.|\\s|$)`, 'i');
  const match = streetText.match(typeRegex);

  if (match && match.index !== undefined) {
    const rawName = streetText.substring(0, match.index).trim();
    if (rawName) {
      target.kozterNev = rawName;
    }
    const matchedType = match[1].toLowerCase().replace(/\.$/, '');
    target.kozterJell = matchedType === 'u' ? 'utca' : (matchedType === 'krt' ? 'körút' : matchedType);

    const remainder = streetText.substring(match.index + match[0].length).replace(/^[.\s]+/, '').trim();
    if (remainder) {
      const numMatch = remainder.match(/^([0-9A-Za-z\-/.\s]+)/);
      if (numMatch) {
        target.hazszam = numMatch[1].trim().replace(/\.$/, '') || '1';
      }
    }
  } else {
    // No recognized suffix, try to split name and number
    const numMatch = streetText.match(/(\d+.*)$/);
    if (numMatch && numMatch.index !== undefined) {
      target.kozterNev = streetText.substring(0, numMatch.index).trim() || 'Székhely';
      target.hazszam = numMatch[1].trim().replace(/\.$/, '') || '1';
    } else if (streetText.trim()) {
      target.kozterNev = streetText.trim();
    }
  }
}

/**
 * Generates the official MKVK AuditXML v1.0.23.0 document
 */
export function generateMkvkAuditXml(data: MkvkAuditXmlRawData): string {
  const now = new Date();
  const createdStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  const addr = parseHungarianAddress(data.cegadatok.cim_nyers, data.cegadatok.orszag || 'HU');

  // Sum of all items osszeg
  let totalAmount = 0;
  let devizaItemsCount = 0;

  for (const item of data.tetelek) {
    totalAmount += Number(item.osszeg) || 0;
    if (item.dev_nem) {
      devizaItemsCount++;
    }
  }

  // Exact 2 decimal places or integer formatting for total sum
  const formattedTotalAmount = Math.round(totalAmount).toString();

  const xmlParts: string[] = [];

  // XML declaration
  xmlParts.push('<?xml version="1.0" encoding="utf-8"?>');
  xmlParts.push('<Adatok xmlns="http://www.mkvk.hu/AuditXML_FkTet/1.0.23.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">');

  // 1. XMLAdatok
  xmlParts.push('  <XMLAdatok>');
  xmlParts.push('    <Verzio>1.0.23.0</Verzio>');
  xmlParts.push(`    <Keszult>${createdStr}</Keszult>`);
  xmlParts.push('    <ProgramNev>Visibill</ProgramNev>');
  xmlParts.push('    <ProgramVerzio>1.0</ProgramVerzio>');
  xmlParts.push('  </XMLAdatok>');

  // 2. Cegadatok
  xmlParts.push('  <Cegadatok>');
  xmlParts.push(`    ${renderXmlTag('Nev', data.cegadatok.nev)}`);
  xmlParts.push(`    ${renderXmlTag('Adoszam', data.cegadatok.adoszam)}`);
  xmlParts.push(`    ${renderXmlTag('KezdoDatum', data.cegadatok.kezdo_datum)}`);
  xmlParts.push(`    ${renderXmlTag('VegsoDatum', data.cegadatok.vegso_datum)}`);
  xmlParts.push(`    ${renderXmlTag('Penznem', data.cegadatok.penznem || 'HUF')}`);
  xmlParts.push(`    ${renderXmlTag('PenzEgyseg', data.cegadatok.penz_egyseg || 'MNB alapegység')}`);
  xmlParts.push('    <Cim>');
  xmlParts.push(`      ${renderXmlTag('Orszag', addr.orszag)}`);
  xmlParts.push(`      ${renderXmlTag('Telepules', addr.telepules)}`);
  xmlParts.push(`      ${renderXmlTag('Irszam', addr.irszam)}`);
  xmlParts.push(`      ${renderXmlTag('KozterNev', addr.kozterNev)}`);
  xmlParts.push(`      ${renderXmlTag('KozterJell', addr.kozterJell)}`);
  xmlParts.push(`      ${renderXmlTag('Hazszam', addr.hazszam)}`);
  xmlParts.push(`      ${renderXmlTag('Epulet', addr.epulet)}`);
  xmlParts.push(`      ${renderXmlTag('Lepcsohaz', addr.lepcsohaz)}`);
  xmlParts.push(`      ${renderXmlTag('Szint', addr.szint)}`);
  xmlParts.push(`      ${renderXmlTag('Ajto', addr.ajto)}`);
  xmlParts.push('    </Cim>');
  xmlParts.push(`    ${renderXmlTag('KapcsolatTarto', data.cegadatok.kapcsolat_tarto || 'n.a.')}`);
  xmlParts.push(`    ${renderXmlTag('Telefonszam', data.cegadatok.telefonszam || 'n.a.')}`);
  xmlParts.push('  </Cegadatok>');

  // 3. Parameterek
  xmlParts.push('  <Parameterek>');
  xmlParts.push('    <RogzitesreKerult>');
  xmlParts.push('      <PartnerKod>I</PartnerKod>');
  xmlParts.push('      <PartnerNev>I</PartnerNev>');
  xmlParts.push('      <PartnerCim>N</PartnerCim>');
  xmlParts.push('      <PartnerAdoszam>I</PartnerAdoszam>');
  xmlParts.push('      <PartnerBankszamlaszam>N</PartnerBankszamlaszam>');
  xmlParts.push('      <PartnerCsoport>N</PartnerCsoport>');
  xmlParts.push('      <Koltseghely>N</Koltseghely>');
  xmlParts.push('      <Projekt>I</Projekt>');
  xmlParts.push('      <Munkaszam>N</Munkaszam>');
  xmlParts.push('      <PenzforgalmiAzonosito>I</PenzforgalmiAzonosito>');
  xmlParts.push('      <Fizetesimod>N</Fizetesimod>');
  xmlParts.push('      <Esedekesseg>N</Esedekesseg>');
  xmlParts.push('      <Teljesites>I</Teljesites>');
  xmlParts.push('      <AfaDatum>N</AfaDatum>');
  xmlParts.push('      <AfaEvHonap>I</AfaEvHonap>');
  xmlParts.push('      <AfaBevallasiIdoszak>N</AfaBevallasiIdoszak>');
  xmlParts.push('      <AfaSor>N</AfaSor>');
  xmlParts.push('      <DevizaAdatok>I</DevizaAdatok>');
  xmlParts.push('      <MennyisegAdatok>N</MennyisegAdatok>');
  xmlParts.push('    </RogzitesreKerult>');
  xmlParts.push('    <Tipusok>');
  xmlParts.push('      <KoltseghelySzint/>');
  xmlParts.push('      <KoltseghelyJelleg/>');
  xmlParts.push('      <ProjektSzint/>');
  xmlParts.push('      <ProjektJelleg/>');
  xmlParts.push('      <MunkaszamSzint/>');
  xmlParts.push('      <MunkaszamJelleg/>');
  xmlParts.push('      <PartnerCsoport1Nev/>');
  xmlParts.push('      <PartnerCsoport2Nev/>');
  xmlParts.push('      <PartnerCsoport3Nev/>');
  xmlParts.push('      <PartnerCsoport4Nev/>');
  xmlParts.push('      <Egyeb1Nev>Projekt</Egyeb1Nev>');
  xmlParts.push('      <Egyeb2Nev/>');
  xmlParts.push('      <Egyeb3Nev/>');
  xmlParts.push('    </Tipusok>');
  xmlParts.push('  </Parameterek>');

  // 4. Ellenorzes
  xmlParts.push('  <Ellenorzes>');
  xmlParts.push(`    <NaplokDarab>${data.naplok.length}</NaplokDarab>`);
  xmlParts.push(`    <IdoszakokDarab>${data.idoszakok.length}</IdoszakokDarab>`);
  xmlParts.push(`    <SzamlaszamokDarab>${data.szamlaszamok.length}</SzamlaszamokDarab>`);
  xmlParts.push(`    <PartnerekDarab>${data.partnerek.length}</PartnerekDarab>`);
  xmlParts.push(`    <RogzitokDarab>${data.rogzitok.length}</RogzitokDarab>`);
  xmlParts.push('    <KoltseghelyekDarab>0</KoltseghelyekDarab>');
  xmlParts.push('    <ProjektekDarab>0</ProjektekDarab>');
  xmlParts.push('    <MunkaszamokDarab>0</MunkaszamokDarab>');
  xmlParts.push('    <PartnerCsoportokDarab>0</PartnerCsoportokDarab>');
  xmlParts.push(`    <FkBizonylatokDarab>${data.bizonylatok.length}</FkBizonylatokDarab>`);
  xmlParts.push(`    <FkTetelekDarab>${data.tetelek.length}</FkTetelekDarab>`);
  xmlParts.push(`    <DevizaTetelekDarab>${devizaItemsCount}</DevizaTetelekDarab>`);
  xmlParts.push('    <MennyisegiTetelekDarab>0</MennyisegiTetelekDarab>');
  xmlParts.push(`    <FkTetelekOsszeg>${formattedTotalAmount}</FkTetelekOsszeg>`);
  xmlParts.push('  </Ellenorzes>');

  // 5. Naplok
  xmlParts.push('  <Naplok>');
  for (const n of data.naplok) {
    xmlParts.push('    <Naplo>');
    xmlParts.push(`      <Kod>${n.kod}</Kod>`);
    xmlParts.push(`      ${renderXmlTag('Nev', n.nev.substring(0, 20))}`);
    xmlParts.push('    </Naplo>');
  }
  xmlParts.push('  </Naplok>');

  // 6. Idoszakok
  xmlParts.push('  <Idoszakok>');
  for (const i of data.idoszakok) {
    xmlParts.push('    <Idoszak>');
    xmlParts.push(`      <Kod>${i.kod}</Kod>`);
    xmlParts.push(`      ${renderXmlTag('Nev', i.nev)}`);
    xmlParts.push('    </Idoszak>');
  }
  xmlParts.push('  </Idoszakok>');

  // 7. Szamlaszamok
  xmlParts.push('  <Szamlaszamok>');
  for (const sz of data.szamlaszamok) {
    xmlParts.push('    <Szamlaszam>');
    xmlParts.push(`      <Kod>${sz.kod}</Kod>`);
    xmlParts.push(`      ${renderXmlTag('TKod', sz.tkod)}`);
    xmlParts.push(`      ${renderXmlTag('Nev', sz.nev.substring(0, 100))}`);
    xmlParts.push('      <ITKod/>');
    xmlParts.push('      <INev/>');
    xmlParts.push('    </Szamlaszam>');
  }
  xmlParts.push('  </Szamlaszamok>');

  // 8. Partnerek
  xmlParts.push('  <Partnerek>');
  for (const p of data.partnerek) {
    xmlParts.push('    <Partner>');
    xmlParts.push(`      <Kod>${p.kod}</Kod>`);
    xmlParts.push(`      ${renderXmlTag('TKod', p.tkod)}`);
    xmlParts.push(`      ${renderXmlTag('Nev', p.nev.substring(0, 255))}`);
    xmlParts.push(`      ${renderXmlTag('Adoszam', p.adoszam)}`);
    xmlParts.push(`      ${renderXmlTag('EUAdoszam', p.eu_adoszam)}`);
    xmlParts.push('      <Cim>');
    xmlParts.push('        <Orszag/>');
    xmlParts.push('        <Telepules/>');
    xmlParts.push('        <Irszam/>');
    xmlParts.push('        <KozterNev/>');
    xmlParts.push('        <KozterJell/>');
    xmlParts.push('        <Hazszam/>');
    xmlParts.push('        <Epulet/>');
    xmlParts.push('        <Lepcsohaz/>');
    xmlParts.push('        <Szint/>');
    xmlParts.push('        <Ajto/>');
    xmlParts.push('      </Cim>');
    xmlParts.push('      <Bankszamlaszam/>');
    xmlParts.push(`      ${renderXmlTag('KapcsoltPartner', p.kapcsolt_partner || 'N')}`);
    xmlParts.push('      <KapcsTartNev/>');
    xmlParts.push('      <KapcsTartTel/>');
    xmlParts.push(`      ${renderXmlTag('KapcsTartEmail', p.kapcs_tart_email)}`);
    xmlParts.push('    </Partner>');
  }
  xmlParts.push('  </Partnerek>');

  // 9. Rogzitok
  xmlParts.push('  <Rogzitok>');
  for (const r of data.rogzitok) {
    xmlParts.push('    <Rogzito>');
    xmlParts.push(`      <Kod>${r.kod}</Kod>`);
    xmlParts.push(`      ${renderXmlTag('TKod', r.tkod)}`);
    xmlParts.push(`      ${renderXmlTag('Nev', r.nev.substring(0, 50))}`);
    xmlParts.push('    </Rogzito>');
  }
  xmlParts.push('  </Rogzitok>');

  // 10. FkBizonylatok
  xmlParts.push('  <FkBizonylatok>');
  for (const b of data.bizonylatok) {
    xmlParts.push('    <FkBizonylat>');
    xmlParts.push(`      <BizId>${b.biz_id}</BizId>`);
    xmlParts.push(`      <Naplo>${b.naplo}</Naplo>`);
    xmlParts.push(`      ${renderXmlTag('BizSzam', b.biz_szam.substring(0, 50))}`);
    xmlParts.push(`      <Datum>${b.datum}</Datum>`);
    xmlParts.push(`      <Idoszak>${b.idoszak}</Idoszak>`);
    xmlParts.push('      <MegrSzam/>');
    xmlParts.push('    </FkBizonylat>');
  }
  xmlParts.push('  </FkBizonylatok>');

  // 11. FkTetelek
  xmlParts.push('  <FkTetelek>');
  for (const t of data.tetelek) {
    xmlParts.push('    <FkTetel>');
    xmlParts.push(`      <BizId>${t.biz_id}</BizId>`);
    xmlParts.push(`      <TetId>${t.tet_id}</TetId>`);
    xmlParts.push(`      ${renderXmlTag('OrigAzon', t.orig_azon)}`);
    xmlParts.push(`      ${renderXmlTag('Szoveg', t.szoveg.substring(0, 50))}`);
    xmlParts.push(`      <Tartozik>${t.tartozik}</Tartozik>`);
    xmlParts.push(`      <Kovetel>${t.kovetel}</Kovetel>`);
    xmlParts.push(`      <Osszeg>${Math.round(t.osszeg)}</Osszeg>`);
    xmlParts.push(`      ${renderXmlTag('DevNem', t.dev_nem)}`);
    xmlParts.push(`      ${renderXmlTag('DevOsszeg', t.dev_osszeg !== null && t.dev_osszeg !== undefined ? t.dev_osszeg : '')}`);
    xmlParts.push(`      ${renderXmlTag('DevArfolyam', t.dev_arfolyam !== null && t.dev_arfolyam !== undefined ? t.dev_arfolyam : '')}`);
    xmlParts.push(`      ${renderXmlTag('AfaAlap', t.afa_alap !== null && t.afa_alap !== undefined ? Math.round(t.afa_alap) : '')}`);
    xmlParts.push(`      ${renderXmlTag('AfaKulcs', t.afa_kulcs)}`);
    xmlParts.push(`      <SztDatum>${t.szt_datum}</SztDatum>`);
    xmlParts.push(`      ${renderXmlTag('Partner', t.partner)}`);
    xmlParts.push(`      ${renderXmlTag('PUAzo', t.pu_azo)}`);
    xmlParts.push('      <FizMod/>');
    xmlParts.push('      <Esedekesseg/>');
    xmlParts.push(`      ${renderXmlTag('TeljDatum', t.telj_datum)}`);
    xmlParts.push('      <AfaDatum/>');
    xmlParts.push(`      ${renderXmlTag('Szt', t.szt)}`);
    xmlParts.push(`      ${renderXmlTag('SztTetId', t.szt_tet_id)}`);
    xmlParts.push(`      <Rogzito>${t.rogzito}</Rogzito>`);
    xmlParts.push(`      <Rogzitve>${t.rogzitve}</Rogzitve>`);
    xmlParts.push(`      ${renderXmlTag('AfaEv', t.afa_ev)}`);
    xmlParts.push(`      ${renderXmlTag('AfaHonap', t.afa_honap)}`);
    xmlParts.push('      <AfaBevallasiIdoszak/>');
    xmlParts.push('      <AfaSor/>');
    xmlParts.push('      <Koltseghely/>');
    xmlParts.push('      <Projekt/>');
    xmlParts.push('      <Munkaszam/>');
    xmlParts.push(`      ${renderXmlTag('Egyeb1', t.egyeb1)}`);
    xmlParts.push('      <Egyeb2/>');
    xmlParts.push('      <Egyeb3/>');
    xmlParts.push('      <Mennyiseg/>');
    xmlParts.push('      <MennyisegiEgyseg/>');
    xmlParts.push('    </FkTetel>');
  }
  xmlParts.push('  </FkTetelek>');

  xmlParts.push('</Adatok>');

  return xmlParts.join('\r\n');
}

/**
 * Standard MKVK AuditXML filename helper
 */
export function getMkvkAuditXmlFileName(
  companyName: string,
  dateFrom: string,
  dateTo: string,
  extension: 'xml' | 'zip' = 'zip'
): string {
  // Strip accents and non-alphanumeric chars
  const normalizedCompany = (companyName || 'Ceg')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '');

  const fromPart = (dateFrom || '').substring(0, 7).replace('-', '');
  const toPart = (dateTo || '').substring(0, 7).replace('-', '');

  return `AuditXML_FK_${normalizedCompany}_${fromPart}-${toPart}.${extension}`;
}

/**
 * Generates and triggers browser download of the XML or compressed ZIP file
 */
export async function downloadMkvkAuditXml({
  xmlContent,
  fileName,
  asZip = true,
}: {
  xmlContent: string;
  fileName: string;
  asZip?: boolean;
}): Promise<void> {
  let blob: Blob;
  let finalFileName = fileName;

  if (asZip) {
    const zip = new JSZip();
    // Inner XML file name
    const innerXmlName = fileName.replace(/\.zip$/i, '.xml');
    zip.file(innerXmlName, xmlContent);

    const zipContent = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
    });

    blob = zipContent;
    if (!finalFileName.toLowerCase().endsWith('.zip')) {
      finalFileName = `${finalFileName.replace(/\.xml$/i, '')}.zip`;
    }
  } else {
    blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' });
    if (!finalFileName.toLowerCase().endsWith('.xml')) {
      finalFileName = `${finalFileName.replace(/\.zip$/i, '')}.xml`;
    }
  }

  // Trigger browser download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = finalFileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
