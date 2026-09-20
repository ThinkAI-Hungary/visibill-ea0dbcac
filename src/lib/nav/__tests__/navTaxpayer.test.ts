import { describe, it, expect } from 'vitest';

// Pure implementations matching _shared/nav for Vitest testing
function extractTag(xmlChunk: string, tag: string): string {
  const regex = new RegExp(`(?:<(?:\\w+:)?${tag}\\/>|<(?:\\w+:)?${tag}[^>]*>([^<]*)<\\/(?:\\w+:)?${tag}>)`);
  const m = xmlChunk.match(regex);
  return m && m[1] ? m[1].trim() : '';
}

function parseNavError(xmlResponse: string): string {
  const errorMatch = xmlResponse.match(/<(?:\w+:)?message>(.+?)<\/(?:\w+:)?message>/);
  const errorCodeMatch = xmlResponse.match(/<(?:\w+:)?errorCode>(.+?)<\/(?:\w+:)?errorCode>/);

  if (errorMatch && errorCodeMatch) {
    return `${errorCodeMatch[1]}: ${errorMatch[1]}`;
  } else if (errorMatch) {
    return errorMatch[1];
  } else if (errorCodeMatch) {
    return errorCodeMatch[1];
  }
  return 'Ismeretlen NAV API hiba';
}

function extractTaxpayerAddress(infoChunk: string) {
  const simpleMatch = infoChunk.match(/<(?:\w+:)?simpleAddress>([\s\S]*?)<\/(?:\w+:)?simpleAddress>/);
  if (simpleMatch) {
    const s = simpleMatch[1];
    const postalCode = extractTag(s, 'postalCode') || undefined;
    const city = extractTag(s, 'city') || undefined;
    const streetName = extractTag(s, 'additionalAddressDetail') || extractTag(s, 'streetName') || undefined;
    const countryCode = extractTag(s, 'countryCode') || 'HU';
    const parts = [postalCode, city, streetName].filter(Boolean);
    return {
      postalCode,
      city,
      streetName,
      countryCode,
      formattedAddress: parts.join(' ')
    };
  }

  // A NAV taxpayerAddress közvetlenül vagy detailedAddress burkolóban tartalmazza a részletes címet
  const detailedMatch = infoChunk.match(/<(?:\w+:)?(?:detailedAddress|taxpayerAddress)>([\s\S]*?)<\/(?:\w+:)?(?:detailedAddress|taxpayerAddress)>/);
  const d = detailedMatch ? detailedMatch[1] : infoChunk;

  const postalCode = extractTag(d, 'postalCode') || undefined;
  const city = extractTag(d, 'city') || undefined;
  const streetName = extractTag(d, 'streetName') || undefined;
  const publicPlaceCategory = extractTag(d, 'publicPlaceCategory') || undefined;
  const number = extractTag(d, 'number') || undefined;
  const building = extractTag(d, 'building') || undefined;
  const staircase = extractTag(d, 'staircase') || undefined;
  const floor = extractTag(d, 'floor') || undefined;
  const door = extractTag(d, 'door') || undefined;
  const countryCode = extractTag(d, 'countryCode') || 'HU';

  if (!postalCode && !city && !streetName) {
    return undefined;
  }

  const formatBuilding = (b?: string) => {
    if (!b) return '';
    const trimmed = b.trim();
    if (/ép/i.test(trimmed)) return trimmed;
    return trimmed.endsWith('.') ? `${trimmed} ép.` : `${trimmed}. ép.`;
  };

  const formatStaircase = (s?: string) => {
    if (!s) return '';
    const trimmed = s.trim();
    if (/lph/i.test(trimmed)) return trimmed;
    return trimmed.endsWith('.') ? `${trimmed} lph.` : `${trimmed}. lph.`;
  };

  const formatFloor = (f?: string) => {
    if (!f) return '';
    const trimmed = f.trim();
    if (/^fszt\.?$/i.test(trimmed)) return 'fszt.';
    if (/em/i.test(trimmed)) return trimmed;
    return `${trimmed}. em.`;
  };

  const formatDoor = (dr?: string) => {
    if (!dr) return '';
    const trimmed = dr.trim();
    if (/ajtó/i.test(trimmed)) return trimmed;
    return trimmed.endsWith('.') ? `${trimmed} ajtó` : `${trimmed}. ajtó`;
  };

  const parts = [
    postalCode,
    city,
    streetName,
    publicPlaceCategory,
    number,
    formatBuilding(building),
    formatStaircase(staircase),
    formatFloor(floor),
    formatDoor(door)
  ].filter(Boolean);

  return {
    postalCode,
    city,
    streetName,
    publicPlaceCategory,
    number,
    building,
    staircase,
    floor,
    door,
    countryCode,
    formattedAddress: parts.join(' ')
  };
}

function parseTaxpayerXml(xmlResponse: string) {
  if (xmlResponse.includes('<funcCode>ERROR</funcCode>') || xmlResponse.includes(':funcCode>ERROR<')) {
    const errorMsg = parseNavError(xmlResponse);
    throw new Error(`NAV Adózó lekérdezési hiba: ${errorMsg}`);
  }

  const taxpayerValidity = extractTag(xmlResponse, 'taxpayerValidity') === 'true';

  const dataMatch = xmlResponse.match(/<(?:\w+:)?taxpayerData>([\s\S]*?)<\/(?:\w+:)?taxpayerData>/);
  const dataChunk = dataMatch ? dataMatch[1] : xmlResponse;

  const taxpayerName = extractTag(dataChunk, 'taxpayerName') || undefined;
  const taxpayerShortName = extractTag(dataChunk, 'taxpayerShortName') || undefined;

  const taxDetailMatch = dataChunk.match(/<(?:\w+:)?taxNumberDetail>([\s\S]*?)<\/(?:\w+:)?taxNumberDetail>/);
  const taxDetailChunk = taxDetailMatch ? taxDetailMatch[1] : dataChunk;

  const taxpayerId = extractTag(taxDetailChunk, 'taxpayerId') || extractTag(xmlResponse, 'taxNumber') || '';
  const vatCode = extractTag(taxDetailChunk, 'vatCode') || undefined;
  const countyCode = extractTag(taxDetailChunk, 'countyCode') || undefined;

  const fullTaxNumber = (taxpayerId && vatCode && countyCode)
    ? `${taxpayerId}-${vatCode}-${countyCode}`
    : taxpayerId;

  const rawIncorporation = extractTag(dataChunk, 'incorporation');
  let incorporation: 'ORGANIZATION' | 'SELF_EMPLOYED' | 'TAXABLE_PERSON' | undefined;
  if (rawIncorporation === 'ORGANIZATION' || rawIncorporation === 'SELF_EMPLOYED' || rawIncorporation === 'TAXABLE_PERSON') {
    incorporation = rawIncorporation;
  }

  let address: any;
  const addressItems = dataChunk.match(/<(?:\w+:)?taxpayerAddressItem>([\s\S]*?)<\/(?:\w+:)?taxpayerAddressItem>/g);
  if (addressItems && addressItems.length > 0) {
    const hqItem = addressItems.find(item => extractTag(item, 'taxpayerAddressType') === 'HQ');
    const selectedItem = hqItem || addressItems[0];
    address = extractTaxpayerAddress(selectedItem);
  } else {
    address = extractTaxpayerAddress(dataChunk);
  }

  let vatGroupMembership: any;
  const groupMatch = dataChunk.match(/<(?:\w+:)?vatGroupMembership>([\s\S]*?)<\/(?:\w+:)?vatGroupMembership>/);
  if (groupMatch) {
    const groupChunk = groupMatch[1];
    const groupTaxNumber = extractTag(groupChunk, 'groupTaxNumber');
    if (groupTaxNumber) {
      vatGroupMembership = {
        groupTaxNumber,
        groupMemberTaxNumber: extractTag(groupChunk, 'groupMemberTaxNumber') || undefined
      };
    }
  }

  return {
    taxpayerValidity,
    taxNumber: fullTaxNumber,
    taxpayerId,
    vatCode,
    countyCode,
    taxpayerName,
    taxpayerShortName,
    incorporation,
    address,
    vatGroupMembership
  };
}

describe('NAV Online Számla v3 – queryTaxpayer XML Builder & Parser', () => {
  it('correctly builds QueryTaxpayerRequest XML with sanitized 8-digit tax number', () => {
    function buildQueryTaxpayerXmlLocal(taxNumber: string) {
      const clean = taxNumber.replace(/[^0-9]/g, '').slice(0, 8);
      return `<?xml version="1.0" encoding="UTF-8"?>
<QueryTaxpayerRequest xmlns="http://schemas.nav.gov.hu/OSA/3.0/api">
  <taxNumber>${clean}</taxNumber>
</QueryTaxpayerRequest>`;
    }

    const xml = buildQueryTaxpayerXmlLocal('32478620-2-43');
    expect(xml).toContain('<taxNumber>32478620</taxNumber>');
    expect(xml).not.toContain('-2-43');
  });

  it('correctly parses valid organization QueryTaxpayerResponse with full names and HQ address', () => {
    const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<QueryTaxpayerResponse xmlns="http://schemas.nav.gov.hu/OSA/3.0/api" xmlns:common="http://schemas.nav.gov.hu/NTCA/1.0/common">
  <common:header>
    <common:requestId>RID1234567890123</common:requestId>
    <common:timestamp>2026-09-20T12:00:00Z</common:timestamp>
    <common:requestVersion>3.0</common:requestVersion>
  </common:header>
  <common:result>
    <common:funcCode>OK</common:funcCode>
  </common:result>
  <taxpayerValidity>true</taxpayerValidity>
  <taxpayerData>
    <taxpayerName>Think Ai Kereskedelmi és Szolgáltató Korlátolt Felelősségű Társaság</taxpayerName>
    <taxpayerShortName>Think Ai Kft.</taxpayerShortName>
    <taxNumberDetail>
      <taxpayerId>32478620</taxpayerId>
      <vatCode>2</vatCode>
      <countyCode>43</countyCode>
    </taxNumberDetail>
    <incorporation>ORGANIZATION</incorporation>
    <taxpayerAddressList>
      <taxpayerAddressItem>
        <taxpayerAddressType>HQ</taxpayerAddressType>
        <taxpayerAddress>
          <detailedAddress>
            <countryCode>HU</countryCode>
            <postalCode>1037</postalCode>
            <city>Budapest</city>
            <streetName>Montevideo</streetName>
            <publicPlaceCategory>utca</publicPlaceCategory>
            <number>10</number>
            <building>B</building>
          </detailedAddress>
        </taxpayerAddress>
      </taxpayerAddressItem>
    </taxpayerAddressList>
  </taxpayerData>
</QueryTaxpayerResponse>`;

    const parsed = parseTaxpayerXml(mockXml);
    expect(parsed.taxpayerValidity).toBe(true);
    expect(parsed.taxNumber).toBe('32478620-2-43');
    expect(parsed.taxpayerId).toBe('32478620');
    expect(parsed.vatCode).toBe('2');
    expect(parsed.countyCode).toBe('43');
    expect(parsed.taxpayerName).toBe('Think Ai Kereskedelmi és Szolgáltató Korlátolt Felelősségű Társaság');
    expect(parsed.taxpayerShortName).toBe('Think Ai Kft.');
    expect(parsed.incorporation).toBe('ORGANIZATION');
    expect(parsed.address).toBeDefined();
    expect(parsed.address?.postalCode).toBe('1037');
    expect(parsed.address?.city).toBe('Budapest');
    expect(parsed.address?.streetName).toBe('Montevideo');
    expect(parsed.address?.publicPlaceCategory).toBe('utca');
    expect(parsed.address?.number).toBe('10');
    expect(parsed.address?.formattedAddress).toBe('1037 Budapest Montevideo utca 10 B. ép.');
  });

  it('correctly parses live NAV 3.0 response where address fields are directly inside taxpayerAddress', () => {
    const liveXml = `<?xml version="1.0" encoding="UTF-8"?>
<ns2:QueryTaxpayerResponse xmlns:ns2="http://schemas.nav.gov.hu/OSA/3.0/api" xmlns:ns3="http://schemas.nav.gov.hu/OSA/3.0/base">
  <ns2:taxpayerValidity>true</ns2:taxpayerValidity>
  <ns2:taxpayerData>
    <ns2:taxpayerName>THINK AI KORLÁTOLT FELELŐSSÉGŰ TÁRSASÁG</ns2:taxpayerName>
    <ns2:taxpayerShortName>THINK AI KFT.</ns2:taxpayerShortName>
    <ns2:taxNumberDetail>
      <ns2:taxpayerId>32478620</ns2:taxpayerId>
      <ns2:vatCode>2</ns2:vatCode>
      <ns2:countyCode>43</ns2:countyCode>
    </ns2:taxNumberDetail>
    <ns2:incorporation>ORGANIZATION</ns2:incorporation>
    <ns2:taxpayerAddressList>
      <ns2:taxpayerAddressItem>
        <ns2:taxpayerAddressType>HQ</ns2:taxpayerAddressType>
        <ns2:taxpayerAddress>
          <ns3:countryCode>HU</ns3:countryCode>
          <ns3:postalCode>1111</ns3:postalCode>
          <ns3:city>BUDAPEST</ns3:city>
          <ns3:streetName>LÁGYMÁNYOSI</ns3:streetName>
          <ns3:publicPlaceCategory>UTCA</ns3:publicPlaceCategory>
          <ns3:number>12.</ns3:number>
          <ns3:floor>FSZT</ns3:floor>
          <ns3:door>2.</ns3:door>
        </ns2:taxpayerAddress>
      </ns2:taxpayerAddressItem>
    </ns2:taxpayerAddressList>
  </ns2:taxpayerData>
</ns2:QueryTaxpayerResponse>`;

    const parsed = parseTaxpayerXml(liveXml);
    expect(parsed.taxpayerValidity).toBe(true);
    expect(parsed.taxNumber).toBe('32478620-2-43');
    expect(parsed.taxpayerName).toBe('THINK AI KORLÁTOLT FELELŐSSÉGŰ TÁRSASÁG');
    expect(parsed.address).toBeDefined();
    expect(parsed.address?.postalCode).toBe('1111');
    expect(parsed.address?.city).toBe('BUDAPEST');
    expect(parsed.address?.streetName).toBe('LÁGYMÁNYOSI');
    expect(parsed.address?.publicPlaceCategory).toBe('UTCA');
    expect(parsed.address?.number).toBe('12.');
    expect(parsed.address?.floor).toBe('FSZT');
    expect(parsed.address?.door).toBe('2.');
    expect(parsed.address?.formattedAddress).toBe('1111 BUDAPEST LÁGYMÁNYOSI UTCA 12. fszt. 2. ajtó');
  });

  it('correctly parses self-employed taxpayer and groups', () => {
    const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<ns2:QueryTaxpayerResponse xmlns:ns2="http://schemas.nav.gov.hu/OSA/3.0/api">
  <ns2:taxpayerValidity>true</ns2:taxpayerValidity>
  <ns2:taxpayerData>
    <ns2:taxpayerName>Kovács János Egyéni Vállalkozó</ns2:taxpayerName>
    <ns2:taxNumberDetail>
      <ns2:taxpayerId>65432109</ns2:taxpayerId>
      <ns2:vatCode>1</ns2:vatCode>
      <ns2:countyCode>02</ns2:countyCode>
    </ns2:taxNumberDetail>
    <ns2:incorporation>SELF_EMPLOYED</ns2:incorporation>
    <ns2:vatGroupMembership>
      <ns2:groupTaxNumber>17799999</ns2:groupTaxNumber>
      <ns2:groupMemberTaxNumber>65432109</ns2:groupMemberTaxNumber>
    </ns2:vatGroupMembership>
    <ns2:taxpayerAddressList>
      <ns2:taxpayerAddressItem>
        <ns2:taxpayerAddressType>HQ</ns2:taxpayerAddressType>
        <ns2:taxpayerAddress>
          <ns2:simpleAddress>
            <ns2:countryCode>HU</ns2:countryCode>
            <ns2:postalCode>7621</ns2:postalCode>
            <ns2:city>Pécs</ns2:city>
            <ns2:additionalAddressDetail>Király utca 15.</ns2:additionalAddressDetail>
          </ns2:simpleAddress>
        </ns2:taxpayerAddress>
      </ns2:taxpayerAddressItem>
    </ns2:taxpayerAddressList>
  </ns2:taxpayerData>
</ns2:QueryTaxpayerResponse>`;

    const parsed = parseTaxpayerXml(mockXml);
    expect(parsed.taxpayerValidity).toBe(true);
    expect(parsed.taxNumber).toBe('65432109-1-02');
    expect(parsed.vatCode).toBe('1');
    expect(parsed.incorporation).toBe('SELF_EMPLOYED');
    expect(parsed.vatGroupMembership?.groupTaxNumber).toBe('17799999');
    expect(parsed.address?.formattedAddress).toBe('7621 Pécs Király utca 15.');
  });

  it('handles invalid taxpayer (taxpayerValidity = false)', () => {
    const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<QueryTaxpayerResponse xmlns="http://schemas.nav.gov.hu/OSA/3.0/api">
  <taxpayerValidity>false</taxpayerValidity>
</QueryTaxpayerResponse>`;

    const parsed = parseTaxpayerXml(mockXml);
    expect(parsed.taxpayerValidity).toBe(false);
    expect(parsed.taxpayerName).toBeUndefined();
    expect(parsed.address).toBeUndefined();
  });

  it('throws descriptive error on NAV error response', () => {
    const errorXml = `<?xml version="1.0" encoding="UTF-8"?>
<QueryTaxpayerResponse xmlns="http://schemas.nav.gov.hu/OSA/3.0/api" xmlns:common="http://schemas.nav.gov.hu/NTCA/1.0/common">
  <common:result>
    <common:funcCode>ERROR</common:funcCode>
    <common:errorCode>INVALID_SECURITY_USER</common:errorCode>
    <common:message>A megadott technikai felhasználó érvénytelen</common:message>
  </common:result>
</QueryTaxpayerResponse>`;

    expect(() => parseTaxpayerXml(errorXml)).toThrow('INVALID_SECURITY_USER: A megadott technikai felhasználó érvénytelen');
  });

  it('rejects tax number with fewer than 8 digits before calling backend', async () => {
    const { queryTaxpayerFromNav } = await import('../navTaxpayerService');
    const result = await queryTaxpayerFromNav('12345');
    expect(result.success).toBe(false);
    expect(result.error).toContain('legalább egy 8-jegyű');
  });
});
