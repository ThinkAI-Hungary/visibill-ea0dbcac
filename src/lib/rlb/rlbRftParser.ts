/**
 * RLB-60 FOKTORZS (.RFT / .DBF) Számlatükör Parser Motor
 * ========================================================
 * Az RLB-60 könyvelőrendszer a számlatükröt bináris dBASE III / Visual FoxPro
 * táblaként (.RFT / .DBF kiterjesztéssel) exportálja és tárolja.
 * 
 * Főbb mezők:
 * - FOKSZAM: Főkönyvi szám (pl. '111', '311', '4541', '511')
 * - FOKNEV: Számla hivatalos megnevezése (DOS CP852 / Win1250 magyar ékezetekkel)
 * - JELLEG: Numerikus számlajelleg (1 = Eszköz, 2 = Forrás, 3 = Ráfordítás, 4 = Bevétel, 0 = Nyilvántartási)
 * - NYIT: Logikai zászló (T/F - nyitható-e az adott mérlegszámla)
 * - ZAROFSZ: Kapcsolódó zárószámla (pl. '492')
 * - BSZLASZ: Hozzárendelt fizikai bankszámlaszám
 * - ADONEMKOD: Hozzárendelt adónemkód
 */

export interface RlbRftAccount {
  glNumber: string;
  name: string;
  jelleg?: string;
  nyit?: boolean;
  zaroFsz?: string;
  bankAccount?: string;
  adonemKod?: string;
}

export interface RlbRftParseResult {
  format: 'rlb_rft_chart_of_accounts';
  fileName?: string;
  recordCount: number;
  activeAccountsCount: number;
  accounts: {
    gl_number: string;
    short_name: string;
    description: string | null;
  }[];
  rawAccounts: RlbRftAccount[];
}

/**
 * Hungarian character decoding for DOS CP852 / Windows-1250 accounting tables.
 * Accurately decodes special Hungarian characters (ű, Ű, ő, Ő, á, é, í, ó, ö, ü).
 */
export function decodeHungarianBytes(bytes: Uint8Array): string {
  let result = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b < 128) {
      result += String.fromCharCode(b);
    } else {
      switch (b) {
        // Hungarian ű, Ű, ő, Ő
        case 0xfb: result += 'ű'; break;
        case 0xdb: result += 'Ű'; break;
        case 0xf5: result += 'ő'; break;
        case 0xd5: result += 'Ő'; break;
        
        // Hungarian á, Á, é, É
        case 0xe1:
        case 0xa0: result += 'á'; break;
        case 0xc1:
        case 0xb5: result += 'Á'; break;
        case 0xe9:
        case 0x82: result += 'é'; break;
        case 0xc9:
        case 0x90: result += 'É'; break;
        
        // Hungarian í, Í
        case 0xed:
        case 0xa1:
        case 0x8d: result += 'í'; break;
        case 0xcd: result += 'Í'; break;
        
        // Hungarian ó, Ó
        case 0xf3:
        case 0xa2: result += 'ó'; break;
        case 0xd3: result += 'Ó'; break;
        
        // Hungarian ö, Ö
        case 0xf6:
        case 0x96: result += 'ö'; break;
        case 0xd6:
        case 0x99: result += 'Ö'; break;
        
        // Hungarian ú, Ú
        case 0xfa:
        case 0xa3: result += 'ú'; break;
        case 0xda: result += 'Ú'; break;
        
        // Hungarian ü, Ü
        case 0xfc:
        case 0x81:
        case 0xb9: result += 'ü'; break;
        case 0xdc:
        case 0x9a: result += 'Ü'; break;
        
        default:
          result += String.fromCharCode(b);
          break;
      }
    }
  }
  return result;
}

interface DbfFieldDescriptor {
  name: string;
  type: string;
  length: number;
  decimal: number;
  offsetInRecord: number;
}

/**
 * Checks whether the given buffer matches a dBASE / FoxPro DBF structure containing
 * FOKSZAM and FOKNEV chart of accounts fields.
 */
export function isRlbRftFile(data: ArrayBuffer | Uint8Array, fileName?: string): boolean {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (bytes.length < 64) return false;

  const nameLower = fileName?.toLowerCase() || '';
  const hasExpectedExt = nameLower.endsWith('.rft') || nameLower.endsWith('.dbf');

  // DBF Header signature byte: 0x02, 0x03, 0x30, 0x31, 0x83, 0x8B, 0xF5
  const validSignatures = [0x02, 0x03, 0x30, 0x31, 0x83, 0x8b, 0xf5];
  const isValidSignature = validSignatures.includes(bytes[0]);

  if (!isValidSignature && !hasExpectedExt) return false;

  // Check header length
  const headerLength = bytes[8] | (bytes[9] << 8);
  if (headerLength < 32 || headerLength > bytes.length) return false;

  // Check if FOKSZAM field exists in field descriptors
  let offset = 32;
  let hasFokszam = false;
  let hasFoknev = false;

  while (offset + 32 <= headerLength && bytes[offset] !== 0x0d) {
    let fieldName = '';
    for (let i = 0; i < 11; i++) {
      const b = bytes[offset + i];
      if (b === 0) break;
      fieldName += String.fromCharCode(b);
    }
    fieldName = fieldName.trim().toUpperCase();

    if (fieldName === 'FOKSZAM') hasFokszam = true;
    if (fieldName.startsWith('FOKNEV')) hasFoknev = true;

    offset += 32;
  }

  return (hasFokszam && hasFoknev) || (hasExpectedExt && hasFokszam);
}

/**
 * Parses an RLB FOKTORZS (.RFT / .DBF) chart of accounts file.
 */
export function parseRlbRftChartOfAccounts(
  data: ArrayBuffer | Uint8Array,
  fileName?: string
): RlbRftParseResult {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);

  if (bytes.length < 32) {
    throw new Error('A megadott fájl túl rövid, nem érvényes RLB RFT/DBF fájl.');
  }

  const recordCount = (
    bytes[4] |
    (bytes[5] << 8) |
    (bytes[6] << 16) |
    (bytes[7] << 24)
  ) >>> 0;

  const headerLength = bytes[8] | (bytes[9] << 8);
  const recordLength = bytes[10] | (bytes[11] << 8);

  if (headerLength < 32 || headerLength > bytes.length) {
    throw new Error('Érvénytelen DBF fejléc hossz az RLB RFT fájlban.');
  }

  if (recordLength <= 1) {
    throw new Error('Érvénytelen DBF rekordhossz az RLB RFT fájlban.');
  }

  // Parse field descriptors
  const fields: DbfFieldDescriptor[] = [];
  let fieldOffset = 32;
  let runningRecordOffset = 1; // 1st byte is deletion flag

  while (fieldOffset + 32 <= headerLength && bytes[fieldOffset] !== 0x0d) {
    let name = '';
    for (let i = 0; i < 11; i++) {
      const b = bytes[fieldOffset + i];
      if (b === 0) break;
      name += String.fromCharCode(b);
    }
    name = name.trim().toUpperCase();

    const type = String.fromCharCode(bytes[fieldOffset + 11]);
    const length = bytes[fieldOffset + 16];
    const decimal = bytes[fieldOffset + 17];

    fields.push({
      name,
      type,
      length,
      decimal,
      offsetInRecord: runningRecordOffset,
    });

    runningRecordOffset += length;
    fieldOffset += 32;
  }

  const fokszamField = fields.find((f) => f.name === 'FOKSZAM');
  const foknevField = fields.find((f) => f.name === 'FOKNEV');
  const jellegField = fields.find((f) => f.name === 'JELLEG');
  const nyitField = fields.find((f) => f.name === 'NYIT');
  const zaroFszField = fields.find((f) => f.name === 'ZAROFSZ');
  const bszlaszField = fields.find((f) => f.name === 'BSZLASZ');
  const adonemkodField = fields.find((f) => f.name === 'ADONEMKOD');

  if (!fokszamField) {
    throw new Error('A fájl nem tartalmaz FOKSZAM mezőt (nem RLB számlatükör fájl).');
  }

  const rawAccounts: RlbRftAccount[] = [];
  const accounts: { gl_number: string; short_name: string; description: string | null }[] = [];
  const seenGlNumbers = new Set<string>();

  let recOffset = headerLength;

  for (let r = 0; r < recordCount; r++) {
    if (recOffset + recordLength > bytes.length) break;

    const isDeleted = bytes[recOffset] === 0x2a; // '*' is deleted
    if (!isDeleted) {
      // Read FOKSZAM
      const rawFszBytes = bytes.subarray(
        recOffset + fokszamField.offsetInRecord,
        recOffset + fokszamField.offsetInRecord + fokszamField.length
      );
      let glNumber = '';
      for (let i = 0; i < rawFszBytes.length; i++) {
        const c = rawFszBytes[i];
        if (c > 32 && c < 127) {
          glNumber += String.fromCharCode(c);
        }
      }
      glNumber = glNumber.trim();

      // Read FOKNEV
      let name = '';
      if (foknevField) {
        const rawNameBytes = bytes.subarray(
          recOffset + foknevField.offsetInRecord,
          recOffset + foknevField.offsetInRecord + foknevField.length
        );
        name = decodeHungarianBytes(rawNameBytes).trim();
      }

      // Read optional fields
      let jelleg: string | undefined;
      if (jellegField) {
        const rawJelleg = bytes.subarray(
          recOffset + jellegField.offsetInRecord,
          recOffset + jellegField.offsetInRecord + jellegField.length
        );
        jelleg = String.fromCharCode(...rawJelleg).trim();
      }

      let nyit: boolean | undefined;
      if (nyitField) {
        const rawNyit = bytes[recOffset + nyitField.offsetInRecord];
        nyit = rawNyit === 0x54 || rawNyit === 0x74 || rawNyit === 0x49 || rawNyit === 0x69; // 'T', 't', 'I', 'i' (True/Igen)
      }

      let zaroFsz: string | undefined;
      if (zaroFszField) {
        const rawZaro = bytes.subarray(
          recOffset + zaroFszField.offsetInRecord,
          recOffset + zaroFszField.offsetInRecord + zaroFszField.length
        );
        zaroFsz = String.fromCharCode(...rawZaro).trim();
      }

      let bankAccount: string | undefined;
      if (bszlaszField) {
        const rawBsz = bytes.subarray(
          recOffset + bszlaszField.offsetInRecord,
          recOffset + bszlaszField.offsetInRecord + bszlaszField.length
        );
        bankAccount = String.fromCharCode(...rawBsz).trim();
      }

      let adonemKod: string | undefined;
      if (adonemkodField) {
        const rawAdo = bytes.subarray(
          recOffset + adonemkodField.offsetInRecord,
          recOffset + adonemkodField.offsetInRecord + adonemkodField.length
        );
        adonemKod = String.fromCharCode(...rawAdo).trim();
      }

      if (glNumber && name) {
        const cleanKey = glNumber.toUpperCase().replace(/\s+/g, '').replace(/\.$/, '');
        if (!seenGlNumbers.has(cleanKey)) {
          seenGlNumbers.add(cleanKey);

          rawAccounts.push({
            glNumber,
            name,
            jelleg,
            nyit,
            zaroFsz,
            bankAccount,
            adonemKod,
          });

          // Build description from metadata if helpful
          const descParts: string[] = [];
          if (jelleg) descParts.push(`Jelleg: ${jelleg}`);
          if (bankAccount) descParts.push(`Bankszámla: ${bankAccount}`);
          if (adonemKod) descParts.push(`Adónem: ${adonemKod}`);
          const description = descParts.length > 0 ? descParts.join(' | ') : null;

          accounts.push({
            gl_number: glNumber,
            short_name: name,
            description,
          });
        }
      }
    }

    recOffset += recordLength;
  }

  // Ensure mandatory opening (491) and closing (492) balance sheet accounts exist
  const has491 = accounts.some((a) => a.gl_number.replace(/\./g, '').trim() === '491');
  if (!has491) {
    accounts.push({
      gl_number: '491',
      short_name: 'Nyitó mérleg számla',
      description: 'Kötelező technikai számla',
    });
  }

  const has492 = accounts.some((a) => a.gl_number.replace(/\./g, '').trim() === '492');
  if (!has492) {
    accounts.push({
      gl_number: '492',
      short_name: 'Záró mérleg számla',
      description: 'Kötelező technikai számla',
    });
  }

  return {
    format: 'rlb_rft_chart_of_accounts',
    fileName,
    recordCount,
    activeAccountsCount: accounts.length,
    accounts,
    rawAccounts,
  };
}
