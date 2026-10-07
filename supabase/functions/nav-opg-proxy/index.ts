// =============================================================================
// NAV Online Pénztárgép (OPG) Naplóállomány M2M Integráció
// SOAP 1.2 / MTOM Proxy & AEE Napló Feldolgozó Edge Function
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { sha3_512 } from 'https://esm.sh/@noble/hashes@1.3.0/sha3';
import * as fflate from 'https://esm.sh/fflate@0.8.2';
import { corsHeaders, checkAutomationShield } from '../_shared/client-guard.ts';

const PROD_BASE_URL = 'https://api-onlinepenztargep.nav.gov.hu';
const TEST_BASE_URL = 'https://api-test-onlinepenztargep.nav.gov.hu';

// Segédfüggvények kriptográfiához
function formatCompactTimestamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds())
  );
}

async function sha512Hex(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-512', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function sha3512Hex(str: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hash = sha3_512(data);
  return Array.from(hash)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

interface NavCreds {
  nav_username: string;
  nav_password: string;
  nav_tax_number: string;
  nav_sign_key: string;
  is_test_environment?: boolean;
}

// SOAP Kérés Fejléc és Hitelesítés előállítása
async function buildSoapAuth(creds: NavCreds) {
  const now = new Date();
  const timestampIso = now.toISOString();
  const timestampCompact = formatCompactTimestamp(now);
  const requestId = 'RID' + crypto.randomUUID().replace(/-/g, '').slice(0, 13).toUpperCase();

  const passwordHash = await sha512Hex(creds.nav_password);
  const signatureBase = requestId + timestampCompact + creds.nav_sign_key;
  const signature = sha3512Hex(signatureBase);
  const taxNumber8 = creds.nav_tax_number.replace(/[^0-9]/g, '').slice(0, 8);

  const headerAndUserXml = `
      <com:header>
        <com:requestId>${requestId}</com:requestId>
        <com:timestamp>${timestampIso}</com:timestamp>
        <com:requestVersion>1.0</com:requestVersion>
        <com:headerVersion>1.0</com:headerVersion>
      </com:header>
      <com:user>
        <com:login>${creds.nav_username}</com:login>
        <com:passwordHash cryptoType="SHA-512">${passwordHash}</com:passwordHash>
        <com:taxNumber>${taxNumber8}</com:taxNumber>
        <com:requestSignature cryptoType="SHA3-512">${signature}</com:requestSignature>
      </com:user>
      <api:software>
        <api:softwareId>123456789123456789</api:softwareId>
        <api:softwareName>Visibill NAV OPG</api:softwareName>
        <api:softwareOperation>ONLINE_SERVICE</api:softwareOperation>
        <api:softwareMainVersion>1.0</api:softwareMainVersion>
        <api:softwareDevName>Visibill</api:softwareDevName>
        <api:softwareDevContact>info@visibill.hu</api:softwareDevContact>
        <api:softwareDevCountryCode>HU</api:softwareDevCountryCode>
        <api:softwareDevTaxNumber>12345678-2-01</api:softwareDevTaxNumber>
      </api:software>`;

  return { requestId, timestampIso, headerAndUserXml };
}

export interface DiscoveredRegister {
  apNumber: string;
  lastCommunicationDate: string | null;
  lastFileDate: string | null;
  minAvailableFileNumber: number;
  maxAvailableFileNumber: number;
}

// NAV Pénztárgép Státusz / Lista lekérdezése (queryCashRegisterStatus)
// Ha apNumber meg van adva, egy gépre szűr. Ha üres, a cég ÖSSZES pénztárgépét lekérdezi!
async function queryNavCashRegisterStatus(creds: NavCreds, apNumber?: string) {
  const baseUrl = creds.is_test_environment ? TEST_BASE_URL : PROD_BASE_URL;
  const endpoint = `${baseUrl}/queryCashRegisterFile/v1/queryCashRegisterStatus`;

  const { headerAndUserXml } = await buildSoapAuth(creds);

  const queryTag = apNumber
    ? `<api:cashRegisterStatusQuery>
        <api:APNumberList>
          <api:APNumber>${apNumber}</api:APNumber>
        </api:APNumberList>
      </api:cashRegisterStatusQuery>`
    : `<api:cashRegisterStatusQuery/>`;

  const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:api="http://schemas.nav.gov.hu/OPF/1.0/api" xmlns:com="http://schemas.nav.gov.hu/NTCA/1.0/common">
  <soap:Header/>
  <soap:Body>
    <api:QueryCashRegisterStatusRequest>
      ${headerAndUserXml}
      ${queryTag}
    </api:QueryCashRegisterStatusRequest>
  </soap:Body>
</soap:Envelope>`;

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/soap+xml; charset=utf-8',
    },
    body: soapEnvelope,
  });

  const rawText = await resp.text();

  if (!resp.ok) {
    if (resp.status === 403 || rawText.includes('INVALID_SECURITY_USER')) {
      throw new Error(
        "A NAV visszautasította a kérést (INVALID_SECURITY_USER). Kérjük ellenőrizze az onlineszamla.nav.gov.hu felületen, hogy a technikai felhasználó jogosultságai között be van-e pipálva az 'OPG-napló-lekérdezés' opció!"
      );
    }
    throw new Error(`NAV hiba (HTTP ${resp.status}): ${rawText.slice(0, 300)}`);
  }

  // Válasz feldolgozása
  if (rawText.includes('<faultstring>')) {
    const match = rawText.match(/<faultstring>(.*?)<\/faultstring>/);
    throw new Error(`NAV SOAP Hiba: ${match ? match[1] : 'Ismeretlen hiba'}`);
  }

  // funcCode ellenőrzése
  const funcCodeMatch = rawText.match(/<[^:]*:funcCode>([^<]+)<\/[^:]*:funcCode>/);
  const funcCode = funcCodeMatch ? funcCodeMatch[1] : '';

  if (funcCode !== 'OK') {
    const msgMatch = rawText.match(/<[^:]*:message>([^<]+)<\/[^:]*:message>/);
    throw new Error(`NAV Státusz Hiba (${funcCode}): ${msgMatch ? msgMatch[1] : rawText.slice(0, 300)}`);
  }

  // Összes cashRegisterStatus kinyerése a válaszból
  const statusMatches = [...rawText.matchAll(/<[^:]*:cashRegisterStatus>([\s\S]*?)<\/[^:]*:cashRegisterStatus>/g)];
  const registers: DiscoveredRegister[] = [];

  for (const m of statusMatches) {
    const statusXml = m[1];
    const apMatch = statusXml.match(/<[^:]*:APNumber>([^<]+)<\/[^:]*:APNumber>/);
    const lastCommMatch = statusXml.match(/<[^:]*:lastCommunicationDate>([^<]+)<\/[^:]*:lastCommunicationDate>/);
    const lastFileMatch = statusXml.match(/<[^:]*:lastFileDate>([^<]+)<\/[^:]*:lastFileDate>/);
    const minFileMatch = statusXml.match(/<[^:]*:minAvailableFileNumber>([^<]+)<\/[^:]*:minAvailableFileNumber>/);
    const maxFileMatch = statusXml.match(/<[^:]*:maxAvailableFileNumber>([^<]+)<\/[^:]*:maxAvailableFileNumber>/);

    if (apMatch) {
      registers.push({
        apNumber: apMatch[1].trim(),
        lastCommunicationDate: lastCommMatch ? lastCommMatch[1] : null,
        lastFileDate: lastFileMatch ? lastFileMatch[1] : null,
        minAvailableFileNumber: minFileMatch ? parseInt(minFileMatch[1], 10) : 1,
        maxAvailableFileNumber: maxFileMatch ? parseInt(maxFileMatch[1], 10) : 0,
      });
    }
  }

  if (apNumber) {
    const foundReg = registers.find((r) => r.apNumber.toUpperCase() === apNumber.toUpperCase());
    if (!foundReg) {
      return {
        found: false,
        apNumber,
        message: `A megadott AP kód (${apNumber}) nem található a vállalkozás regisztrált online pénztárgépei között.`,
        registers: [],
      };
    }
    return {
      found: true,
      ...foundReg,
      registers,
    };
  }

  return {
    found: registers.length > 0,
    registers,
  };
}

// NAV Naplófájlok letöltése (queryCashRegisterFile)
async function downloadNavCashRegisterFiles(
  creds: NavCreds,
  apNumber: string,
  fileNumberStart: number,
  fileNumberEnd: number
): Promise<Uint8Array> {
  const baseUrl = creds.is_test_environment ? TEST_BASE_URL : PROD_BASE_URL;
  const endpoint = `${baseUrl}/queryCashRegisterFile/v1/queryCashRegisterFile`;

  const { headerAndUserXml } = await buildSoapAuth(creds);

  const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:api="http://schemas.nav.gov.hu/OPF/1.0/api" xmlns:com="http://schemas.nav.gov.hu/NTCA/1.0/common">
  <soap:Header/>
  <soap:Body>
    <api:QueryCashRegisterFileDataRequest>
      ${headerAndUserXml}
      <api:cashRegisterFileDataQuery>
        <api:APNumber>${apNumber}</api:APNumber>
        <api:fileNumberStart>${fileNumberStart}</api:fileNumberStart>
        <api:fileNumberEnd>${fileNumberEnd}</api:fileNumberEnd>
      </api:cashRegisterFileDataQuery>
    </api:QueryCashRegisterFileDataRequest>
  </soap:Body>
</soap:Envelope>`;

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/soap+xml; charset=utf-8',
      'SOAPAction': 'queryCashRegisterFile',
      'Accept': 'multipart/related, application/soap+xml, application/octet-stream',
    },
    body: soapEnvelope,
  });

  if (!resp.ok) {
    const errorText = await resp.text();
    if (resp.status === 403 || errorText.includes('INVALID_SECURITY_USER')) {
      throw new Error(
        "A NAV visszautasította a letöltési kérést (INVALID_SECURITY_USER). Kérjük ellenőrizze az onlineszamla.nav.gov.hu felületen az 'OPG-napló-lekérdezés' jogosultságot!"
      );
    }
    throw new Error(`NAV naplófájl letöltési hiba (HTTP ${resp.status}): ${errorText.slice(0, 300)}`);
  }

  const arrayBuffer = await resp.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

// MTOM / MIME Multipart válaszból a beágyazott ZIP és XML naplók kibontása
function extractAeeXmlFromMtomPayload(rawPayload: Uint8Array): Array<{ filename: string; xmlContent: string }> {
  const results: Array<{ filename: string; xmlContent: string }> = [];

  let searchIdx = 0;
  while (searchIdx < rawPayload.length - 4) {
    if (
      rawPayload[searchIdx] === 0x50 &&
      rawPayload[searchIdx + 1] === 0x4B &&
      rawPayload[searchIdx + 2] === 0x03 &&
      rawPayload[searchIdx + 3] === 0x04
    ) {
      let eocdIdx = -1;
      for (let j = searchIdx + 4; j < rawPayload.length - 22; j++) {
        if (
          rawPayload[j] === 0x50 &&
          rawPayload[j + 1] === 0x4B &&
          rawPayload[j + 2] === 0x05 &&
          rawPayload[j + 3] === 0x06
        ) {
          eocdIdx = j;
          break;
        }
      }

      if (eocdIdx !== -1) {
        const commentLen = rawPayload[eocdIdx + 20] | (rawPayload[eocdIdx + 21] << 8);
        const zipEnd = eocdIdx + 22 + commentLen;
        const zipSlice = rawPayload.slice(searchIdx, zipEnd);

        try {
          const unzipped = fflate.unzipSync(zipSlice);
          for (const [entryName, entryBytes] of Object.entries(unzipped)) {
            const textDecoder = new TextDecoder('utf-8');
            const fullDecoded = textDecoder.decode(entryBytes);

            const xmlStart = fullDecoded.indexOf('<?xml');
            const xmlEnd = fullDecoded.lastIndexOf('</ROWS>');

            if (xmlStart !== -1 && xmlEnd !== -1) {
              const xmlContent = fullDecoded.slice(xmlStart, xmlEnd + 7);
              results.push({ filename: entryName, xmlContent });
            }
          }
        } catch (e: any) {
          console.warn('[OPG Unzip Warning]:', e.message);
        }

        searchIdx = zipEnd;
        continue;
      }
    }
    searchIdx++;
  }

  if (results.length === 0) {
    const rawText = new TextDecoder('utf-8').decode(rawPayload);
    const xmlStart = rawText.indexOf('<?xml');
    const xmlEnd = rawText.lastIndexOf('</ROWS>');
    if (xmlStart !== -1 && xmlEnd !== -1) {
      results.push({ filename: 'direct_payload.xml', xmlContent: rawText.slice(xmlStart, xmlEnd + 7) });
    }
  }

  return results;
}

interface ParsedOpgTransaction {
  external_transaction_id: string;
  receipt_number: string;
  transaction_date: string;
  transaction_time: string;
  transaction_type: 'receipt' | 'simplified_invoice' | 'daily_z_summary' | 'cash_movement';
  total_gross_amount: number;
  cash_amount: number;
  card_amount: number;
  szep_card_amount: number;
  voucher_amount: number;
  other_payment_amount: number;
  payment_method_breakdown: Record<string, number>;
  vat_breakdown: Record<string, { base: number; vat: number; gross: number }>;
  source_payload: Record<string, unknown>;
}

// AEE Napló XML elemzése bizonylatokra és Z-zárásokra
function parseAeeNaploXml(xml: string, apCode: string, logFileNum: number): ParsedOpgTransaction[] {
  const transactions: ParsedOpgTransaction[] = [];

  const lonMatch = xml.match(/<LON>[\s\S]*?<LFN>(\d+)<\/LFN>[\s\S]*?<\/LON>/);
  const fileNum = lonMatch ? parseInt(lonMatch[1], 10) : logFileNum;

  // 1. Nyugták (<NYN>) és Egyszerűsített számlák (<ESN>)
  const receiptRegex = /<(NYN|ESN)>([\s\S]*?)<\/\1>/g;
  let rMatch: RegExpExecArray | null;

  while ((rMatch = receiptRegex.exec(xml)) !== null) {
    const tag = rMatch[1];
    const content = rMatch[2];

    const receiptNoMatch = content.match(/<NSZ>([^<]+)<\/NSZ>/);
    const receiptNo = receiptNoMatch ? receiptNoMatch[1].trim() : `REC-${fileNum}-${transactions.length + 1}`;

    const dtsMatch = content.match(/<DTS>([^<]+)<\/DTS>/);
    const dts = dtsMatch ? new Date(dtsMatch[1]) : new Date();
    const dateStr = dts.toISOString().split('T')[0];
    const timeStr = dts.toTimeString().split(' ')[0];

    // Összeg keresése: <SUM> vagy <VED>
    const sumMatch = content.match(/<SUM>([^<]+)<\/SUM>/);
    const vedMatch = content.match(/<VED>([^<]+)<\/VED>/);
    let totalGross = 0;
    if (sumMatch) {
      totalGross = Math.round(parseFloat(sumMatch[1].replace(',', '.')));
    } else if (vedMatch) {
      totalGross = Math.round(parseFloat(vedMatch[1].replace(',', '.')));
    }

    // Fizetési módok bontása a <DRC> blokkból:
    // FE1: Készpénz, FE2: Bankkártya, FE3: Utalvány, SZ: Szép kártya, FE4: Egyéb
    let cash = 0;
    let card = 0;
    let szep = 0;
    let voucher = 0;
    let other = 0;

    const drcBlock = content.match(/<DRC>([\s\S]*?)<\/DRC>/);
    if (drcBlock) {
      const fe1 = drcBlock[1].match(/<FE1>([^<]+)<\/FE1>/) || drcBlock[1].match(/<KP>([^<]+)<\/KP>/);
      if (fe1) cash = Math.round(parseFloat(fe1[1].replace(',', '.')));

      const fe2 = drcBlock[1].match(/<FE2>([^<]+)<\/FE2>/) || drcBlock[1].match(/<BK>([^<]+)<\/BK>/);
      if (fe2) card = Math.round(parseFloat(fe2[1].replace(',', '.')));

      const fe3 = drcBlock[1].match(/<FE3>([^<]+)<\/FE3>/) || drcBlock[1].match(/<UT>([^<]+)<\/UT>/);
      if (fe3) voucher = Math.round(parseFloat(fe3[1].replace(',', '.')));

      const sz = drcBlock[1].match(/<SZ>([^<]+)<\/SZ>/);
      if (sz) szep = Math.round(parseFloat(sz[1].replace(',', '.')));

      const fe4 = drcBlock[1].match(/<FE4>([^<]+)<\/FE4>/) || drcBlock[1].match(/<EY>([^<]+)<\/EY>/);
      if (fe4) other = Math.round(parseFloat(fe4[1].replace(',', '.')));
    } else {
      cash = totalGross;
    }

    // Ha a fizetési módok összege 0 volt, de a totalGross pozitív
    if (cash === 0 && card === 0 && szep === 0 && voucher === 0 && other === 0 && totalGross > 0) {
      cash = totalGross;
    }

    // ÁFA bontás
    const vatBreakdown: Record<string, { base: number; vat: number; gross: number }> = {};
    const sumMatches = content.matchAll(/<V(\d+)>([\s\S]*?)<\/V\1>/g);
    for (const sm of sumMatches) {
      const vatCode = sm[1];
      const sumXml = sm[2];
      const baseMatch = sumXml.match(/<B>([^<]+)<\/B>/);
      const vatMatch = sumXml.match(/<A>([^<]+)<\/A>/);
      const grossMatch = sumXml.match(/<G>([^<]+)<\/G>/);

      vatBreakdown[`V${vatCode}`] = {
        base: baseMatch ? parseFloat(baseMatch[1].replace(',', '.')) : 0,
        vat: vatMatch ? parseFloat(vatMatch[1].replace(',', '.')) : 0,
        gross: grossMatch ? parseFloat(grossMatch[1].replace(',', '.')) : 0,
      };
    }

    transactions.push({
      external_transaction_id: `${apCode}_${fileNum}_${receiptNo}`,
      receipt_number: receiptNo,
      transaction_date: dateStr,
      transaction_time: timeStr,
      transaction_type: tag === 'ESN' ? 'simplified_invoice' : 'receipt',
      total_gross_amount: totalGross,
      cash_amount: cash,
      card_amount: card,
      szep_card_amount: szep,
      voucher_amount: voucher,
      other_payment_amount: other,
      payment_method_breakdown: { cash, card, szep, voucher, other },
      vat_breakdown: vatBreakdown,
      source_payload: { raw_tag: tag, ap_code: apCode, file_number: fileNum },
    });
  }

  // 2. Napi forgalmi jelentések (<NFN> - Z-zárások)
  const zRegex = /<NFN>([\s\S]*?)<\/NFN>/g;
  let zMatch: RegExpExecArray | null;

  while ((zMatch = zRegex.exec(xml)) !== null) {
    const content = zMatch[1];
    const zszMatch = content.match(/<ZSZ>([^<]+)<\/ZSZ>/);
    const zsz = zszMatch ? zszMatch[1].trim() : `Z-${fileNum}-${transactions.length + 1}`;

    const dtsMatch = content.match(/<DTS>([^<]+)<\/DTS>/);
    const dts = dtsMatch ? new Date(dtsMatch[1]) : new Date();
    const dateStr = dts.toISOString().split('T')[0];
    const timeStr = dts.toTimeString().split(' ')[0];

    const nsfMatch = content.match(/<NSF>([^<]+)<\/NSF>/);
    const totalGross = nsfMatch ? Math.round(parseFloat(nsfMatch[1].replace(',', '.'))) : 0;

    const nshMatch = content.match(/<NSH>([^<]+)<\/NSH>/);
    const cash = nshMatch ? Math.round(parseFloat(nshMatch[1].replace(',', '.'))) : 0;

    const nssMatch = content.match(/<NSS>([^<]+)<\/NSS>/);
    const card = nssMatch ? Math.round(parseFloat(nssMatch[1].replace(',', '.'))) : 0;

    transactions.push({
      external_transaction_id: `${apCode}_${fileNum}_${zsz}`,
      receipt_number: zsz,
      transaction_date: dateStr,
      transaction_time: timeStr,
      transaction_type: 'z_report',
      total_gross_amount: totalGross,
      cash_amount: cash,
      card_amount: card,
      szep_card_amount: 0,
      voucher_amount: 0,
      other_payment_amount: Math.max(0, totalGross - cash - card),
      payment_method_breakdown: { cash, card },
      vat_breakdown: {},
      source_payload: { raw_tag: 'NFN', ap_code: apCode, file_number: fileNum },
    });
  }

  // 3. Pénzmozgás bizonylatok (<PMN>)
  const pmnRegex = /<PMN>([\s\S]*?)<\/PMN>/g;
  let pmnMatch: RegExpExecArray | null;

  while ((pmnMatch = pmnRegex.exec(xml)) !== null) {
    const content = pmnMatch[1];
    const pmsMatch = content.match(/<PMS>([^<]+)<\/PMS>/);
    const pms = pmsMatch ? pmsMatch[1].trim() : `PM-${fileNum}-${transactions.length + 1}`;

    const dtsMatch = content.match(/<DTS>([^<]+)<\/DTS>/);
    const dts = dtsMatch ? new Date(dtsMatch[1]) : new Date();
    const dateStr = dts.toISOString().split('T')[0];
    const timeStr = dts.toTimeString().split(' ')[0];

    let amount = 0;
    const kpMatch = content.match(/<KP>([^<]+)<\/KP>/) || content.match(/<FE1>([^<]+)<\/FE1>/);
    if (kpMatch) amount = Math.round(parseFloat(kpMatch[1].replace(',', '.')));

    transactions.push({
      external_transaction_id: `${apCode}_${fileNum}_${pms}`,
      receipt_number: pms,
      transaction_date: dateStr,
      transaction_time: timeStr,
      transaction_type: 'cash_movement',
      total_gross_amount: amount,
      cash_amount: amount,
      card_amount: 0,
      szep_card_amount: 0,
      voucher_amount: 0,
      other_payment_amount: 0,
      payment_method_breakdown: { cash: amount },
      vat_breakdown: {},
      source_payload: { raw_tag: 'PMN', ap_code: apCode, file_number: fileNum },
    });
  }

  return transactions;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const shieldBlock = checkAutomationShield(req);
  if (shieldBlock) return shieldBlock;

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  // Hitelesítés
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Authorization fejléc szükséges', code: 'UNAUTHORIZED' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const tokenStr = authHeader.replace('Bearer ', '');
  let callerUserId: string | null = null;
  let isServiceRole = false;

  if (tokenStr === supabaseServiceKey) {
    isServiceRole = true;
  } else {
    const { data: { user }, error: authErr } = await adminClient.auth.getUser(tokenStr);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Érvénytelen munkamenet', code: 'UNAUTHORIZED' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    callerUserId = user.id;
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { action, company_id, register_id, ap_code, file_start, file_end } = body;

    if (!company_id) {
      return new Response(JSON.stringify({ error: 'company_id megadása kötelező', code: 'MISSING_PARAM' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // NAV hitelesítő adatok feloldása
    const { data: credsResult, error: credsError } = await adminClient.rpc('get_nav_credentials', {
      p_user_id: callerUserId,
      p_company_id: company_id,
    });

    if (credsError || !credsResult || credsResult.error || !credsResult.nav_username || !credsResult.nav_sign_key) {
      return new Response(
        JSON.stringify({
          error: 'A céghez nem található érvényes NAV Online Számla technikai felhasználó (szükséges az OPG lekérdezéshez).',
          code: 'NO_NAV_CREDENTIALS',
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const creds: NavCreds = {
      nav_username: credsResult.nav_username,
      nav_password: credsResult.nav_password,
      nav_tax_number: credsResult.nav_tax_number,
      nav_sign_key: credsResult.nav_sign_key,
      is_test_environment: credsResult.is_test_environment ?? false,
    };

    // ═══════════════════════════════════════════════════════════════
    // ACTION: discover_registers (Automatikus AP kód és gépfelderítés)
    // ═══════════════════════════════════════════════════════════════
    if (action === 'discover_registers') {
      const discovery = await queryNavCashRegisterStatus(creds, '');
      const discovered = discovery.registers || [];

      // Automatikus beszúrás vagy frissítés az opg_cash_registers táblába
      const savedRegisters = [];
      for (const reg of discovered) {
        const { data: existing } = await adminClient
          .from('opg_cash_registers')
          .select('id')
          .eq('company_id', company_id)
          .eq('ap_code', reg.apNumber)
          .maybeSingle();

        if (existing) {
          const { data: updated } = await adminClient
            .from('opg_cash_registers')
            .update({
              status: 'active',
              last_successful_sync_at: new Date().toISOString(),
              metadata: {
                ...reg,
                updated_at: new Date().toISOString(),
              },
            })
            .eq('id', existing.id)
            .select()
            .single();
          savedRegisters.push(updated);
        } else {
          const { data: inserted } = await adminClient
            .from('opg_cash_registers')
            .insert({
              company_id: company_id,
              ap_code: reg.apNumber,
              name: `Pénztárgép (${reg.apNumber})`,
              status: 'active',
              cash_booking_mode: 'daily_z_summary',
              last_successful_sync_at: new Date().toISOString(),
              metadata: {
                ...reg,
                discovered_at: new Date().toISOString(),
              },
            })
            .select()
            .single();
          savedRegisters.push(inserted);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            discoveredCount: discovered.length,
            registers: savedRegisters,
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // ACTION: query_status
    // ═══════════════════════════════════════════════════════════════
    if (action === 'query_status') {
      const targetAp = (ap_code || '').trim().toUpperCase();
      const statusResult = await queryNavCashRegisterStatus(creds, targetAp || undefined);

      if (register_id && targetAp) {
        await adminClient
          .from('opg_cash_registers')
          .update({
            status: statusResult.found ? 'active' : 'error',
            last_successful_sync_at: statusResult.found ? new Date().toISOString() : null,
            last_failed_sync_at: statusResult.found ? null : new Date().toISOString(),
            last_error_message: statusResult.found ? null : statusResult.message,
            metadata: {
              ...statusResult,
              updated_at: new Date().toISOString(),
            },
          })
          .eq('id', register_id);
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: statusResult,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // ACTION: sync_transactions
    // ═══════════════════════════════════════════════════════════════
    if (action === 'sync_transactions') {
      // 1. Pénztárgépek felolvasása
      let registersQuery = adminClient.from('opg_cash_registers').select('*').eq('company_id', company_id);
      if (register_id && register_id !== 'all') {
        registersQuery = registersQuery.eq('id', register_id);
      }
      let { data: registers, error: regErr } = await registersQuery;
      if (regErr) throw regErr;

      // Ha nincs pénztárgép rögzítve, futtassunk egy automatikus felderítést (discovery)!
      if (!registers || registers.length === 0) {
        try {
          const discovery = await queryNavCashRegisterStatus(creds, '');
          const discovered = discovery.registers || [];

          for (const reg of discovered) {
            await adminClient.from('opg_cash_registers').insert({
              company_id: company_id,
              ap_code: reg.apNumber,
              name: `Pénztárgép (${reg.apNumber})`,
              status: 'active',
              cash_booking_mode: 'daily_z_summary',
              last_successful_sync_at: new Date().toISOString(),
              metadata: {
                ...reg,
                auto_discovered: true,
              },
            });
          }

          // Újralekérdezzük a regisztrált gépeket
          const reQuery = await adminClient.from('opg_cash_registers').select('*').eq('company_id', company_id);
          registers = reQuery.data || [];
        } catch (discErr) {
          console.warn('[OPG Auto Discovery Warning]:', discErr);
        }
      }

      if (!registers || registers.length === 0) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Nincs regisztrált vagy felderíthető online pénztárgép ehhez a céghez.',
            data: { fetched: 0, newRecords: 0, duplicates: 0, errors: 0 },
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let grandFetched = 0;
      let grandNew = 0;
      let grandDup = 0;
      let grandErrors = 0;

      for (const reg of registers) {
        const apNumber = reg.ap_code.trim().toUpperCase();

        let statusResult;
        try {
          statusResult = await queryNavCashRegisterStatus(creds, apNumber);
        } catch (statusErr: any) {
          grandErrors++;
          await adminClient
            .from('opg_cash_registers')
            .update({
              status: 'error',
              last_failed_sync_at: new Date().toISOString(),
              last_error_message: statusErr.message,
            })
            .eq('id', reg.id);
          continue;
        }

        if (!statusResult.found || statusResult.maxAvailableFileNumber === 0) {
          continue;
        }

        const lastDownloaded = reg.metadata?.last_downloaded_file_number || (statusResult.minAvailableFileNumber - 1);
        let startFile = file_start ? parseInt(file_start, 10) : Math.max(statusResult.minAvailableFileNumber, lastDownloaded + 1);
        let endFile = file_end ? parseInt(file_end, 10) : statusResult.maxAvailableFileNumber;

        if (startFile > endFile) {
          await adminClient
            .from('opg_cash_registers')
            .update({
              last_successful_sync_at: new Date().toISOString(),
              status: 'active',
              last_error_message: null,
            })
            .eq('id', reg.id);
          continue;
        }

        // Korlát: egyszerre maximum 15 fájl
        if (endFile - startFile > 15) {
          endFile = startFile + 15;
        }

        const rawMtom = await downloadNavCashRegisterFiles(creds, apNumber, startFile, endFile);
        const extracted = extractAeeXmlFromMtomPayload(rawMtom);

        const allTransactions: ParsedOpgTransaction[] = [];
        for (const file of extracted) {
          const fileTxs = parseAeeNaploXml(file.xmlContent, apNumber, startFile);
          allTransactions.push(...fileTxs);
        }

        grandFetched += allTransactions.length;

        for (const tx of allTransactions) {
          const { error: insErr } = await adminClient.from('opg_transactions').insert({
            company_id: company_id,
            opg_id: reg.id,
            external_transaction_id: tx.external_transaction_id,
            receipt_number: tx.receipt_number,
            transaction_date: tx.transaction_date,
            transaction_time: tx.transaction_time,
            transaction_type: tx.transaction_type,
            total_gross_amount: tx.total_gross_amount,
            cash_amount: tx.cash_amount,
            card_amount: tx.card_amount,
            szep_card_amount: tx.szep_card_amount,
            voucher_amount: tx.voucher_amount,
            other_payment_amount: tx.other_payment_amount,
            payment_method_breakdown: tx.payment_method_breakdown,
            vat_breakdown: tx.vat_breakdown,
            processing_status: 'new',
            source_payload: tx.source_payload,
          });

          if (insErr) {
            if (insErr.code === '23505' || insErr.message?.includes('duplicate key')) {
              grandDup++;
            } else {
              grandErrors++;
              console.warn('[OPG Insert Error]:', insErr);
            }
          } else {
            grandNew++;
          }
        }

        await adminClient
          .from('opg_cash_registers')
          .update({
            last_successful_sync_at: new Date().toISOString(),
            status: 'active',
            last_error_message: null,
            metadata: {
              ...(reg.metadata || {}),
              last_downloaded_file_number: endFile,
              last_status: statusResult,
              updated_at: new Date().toISOString(),
            },
          })
          .eq('id', reg.id);
      }

      if (grandNew > 0) {
        try {
          await adminClient.rpc('process_pending_opg_transactions', {
            p_company_id: company_id,
            p_opg_id: register_id && register_id !== 'all' ? register_id : null,
          });
        } catch (rpcErr) {
          console.warn('[OPG Auto Booking RPC Warning]:', rpcErr);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            fetched: grandFetched,
            newRecords: grandNew,
            duplicates: grandDup,
            errors: grandErrors,
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ error: `Ismeretlen akció: ${action}`, code: 'UNKNOWN_ACTION' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[nav-opg-proxy Exception]:', err);
    return new Response(
      JSON.stringify({
        error: err.message || 'Belső szerverhiba történt az OPG feldolgozás során',
        code: 'INTERNAL_ERROR',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
