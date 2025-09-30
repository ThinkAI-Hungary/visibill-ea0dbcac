// Handle CORS preflight requests
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function utcTimestampYYYYMMDDHHMMSS(d = new Date()) {
  return d.toISOString().replace(/[-:T]/g, '').slice(0, 14);
}

function sha512UpperHex(s: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(s);
  return crypto.subtle.digest('SHA-512', data)
    .then(ab => Array.from(new Uint8Array(ab), b => b.toString(16).padStart(2, '0')).join('').toUpperCase());
}

async function buildHeader(user: any, password: string, signatureKey: string, operation: string, useTestUrl: boolean) {
  const requestId = crypto.randomUUID();
  const timestamp = utcTimestampYYYYMMDDHHMMSS();
  const toHash = requestId + timestamp + signatureKey;
  const signature = await sha512UpperHex(toHash);

  return {
    requestId,
    timestamp,
    signature,
    xml: `
      <common:requestId>${requestId}</common:requestId>
      <common:timestamp>${timestamp}</common:timestamp>
      <common:requestVersion>3.0</common:requestVersion>
      <common:headerVersion>1.0</common:headerVersion>
    `
  };
}

function buildUserXml(taxNumber: string, login: string, password: string, signature: string) {
  return `
    <common:user>
      <common:login>${login}</common:login>
      <common:passwordHash>${password}</common:passwordHash>
      <common:taxNumber>${taxNumber}</common:taxNumber>
      <common:requestSignature>${signature}</common:requestSignature>
    </common:user>
  `;
}

const softwareXml = `
  <common:software>
    <common:softwareId>123456789123456789</common:softwareId>
    <common:softwareName>Visibill NAV Integration</common:softwareName>
    <common:softwareOperation>ONLINE_SERVICE</common:softwareOperation>
    <common:softwareMainVersion>1.0</common:softwareMainVersion>
    <common:softwareDevName>Visibill</common:softwareDevName>
    <common:softwareDevContact>info@visibill.hu</common:softwareDevContact>
    <common:softwareDevCountryCode>HU</common:softwareDevCountryCode>
    <common:softwareDevTaxNumber>12345678</common:softwareDevTaxNumber>
  </common:software>
`;

function xmlEnvelope(bodyContent: string, requestType: string = 'QueryInvoiceDigestRequest') {
  return `<?xml version="1.0" encoding="UTF-8"?>
    <${requestType} xmlns="http://schemas.nav.gov.hu/OSA/3.0/api" 
                    xmlns:common="http://schemas.nav.gov.hu/NTCA/1.0/common">
      ${bodyContent}
    </${requestType}>`;
}

async function queryInvoiceDigestXml(params: any) {
  const { login, password, signatureKey, taxNumber, direction, page = 1, issueDateFrom, issueDateTo, insDateTimeFrom, insDateTimeTo } = params;
  
  const header = await buildHeader({ login, taxNumber }, password, signatureKey, 'queryInvoiceDigest', false);
  const userXml = buildUserXml(taxNumber, login, password, header.signature);

  let mandatoryQueryParams = '';
  
  if (issueDateFrom && issueDateTo) {
    mandatoryQueryParams += `<invoiceIssueDateFrom>${issueDateFrom}</invoiceIssueDateFrom>`;
    mandatoryQueryParams += `<invoiceIssueDateTo>${issueDateTo}</invoiceIssueDateTo>`;
  }
  
  if (insDateTimeFrom && insDateTimeTo) {
    mandatoryQueryParams += `<insDateTimeFrom>${insDateTimeFrom}</insDateTimeFrom>`;
    mandatoryQueryParams += `<insDateTimeTo>${insDateTimeTo}</insDateTimeTo>`;
  }

  const bodyContent = `
    <common:header>
      ${header.xml}
    </common:header>
    ${userXml}
    ${softwareXml}
    <invoiceDigestRequest>
      <common:page>${page}</common:page>
      <invoiceDirection>${direction}</invoiceDirection>
      ${mandatoryQueryParams}
    </invoiceDigestRequest>
  `;

  return { xml: xmlEnvelope(bodyContent, 'QueryInvoiceDigestRequest'), requestId: header.requestId };
}

async function queryInvoiceDataXml(params: any) {
  const { login, password, signatureKey, taxNumber, direction, invoiceNumber, supplierTaxNumber } = params;
  
  const header = await buildHeader({ login, taxNumber }, password, signatureKey, 'queryInvoiceData', false);
  const userXml = buildUserXml(taxNumber, login, password, header.signature);

  const bodyContent = `
    <common:header>
      ${header.xml}
    </common:header>
    ${userXml}
    ${softwareXml}
    <invoiceDataRequest>
      <invoiceNumberQuery>
        <invoiceDirection>${direction}</invoiceDirection>
        <invoiceNumber>${invoiceNumber}</invoiceNumber>
        <supplierTaxNumber>${supplierTaxNumber}</supplierTaxNumber>
      </invoiceNumberQuery>
    </invoiceDataRequest>
  `;

  return { xml: xmlEnvelope(bodyContent, 'QueryInvoiceDataRequest'), requestId: header.requestId };
}

async function callNav(xmlPayload: string, operation: string, useTest = true) {
  const baseUrl = useTest ? 'https://api-test.onlineszamla.nav.gov.hu' : 'https://api.onlineszamla.nav.gov.hu';
  const url = `${baseUrl}/invoiceService/v3/${operation}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml; charset=UTF-8',
        'Accept': 'application/xml',
      },
      body: xmlPayload,
    });

    const responseText = await response.text();
    
    return {
      ok: response.ok,
      status: response.status,
      body: responseText,
    };
  } catch (error) {
    return {
      ok: false,
      status: 500,
      body: `Network error: ${error}`,
    };
  }
}

function pickDigests(xmlResponse: string) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlResponse, 'text/xml');
    
    const currentPageEl = doc.getElementsByTagName('currentPage')[0];
    const availablePageEl = doc.getElementsByTagName('availablePage')[0];
    
    const currentPage = currentPageEl ? parseInt(currentPageEl.textContent || '1') : 1;
    const availablePage = availablePageEl ? parseInt(availablePageEl.textContent || '1') : 1;
    
    const digestElements = doc.getElementsByTagName('invoiceDigest');
    const invoices = [];
    
    for (let i = 0; i < digestElements.length; i++) {
      const digest = digestElements[i];
      const invoiceNumber = digest.getElementsByTagName('invoiceNumber')[0]?.textContent || '';
      const invoiceDirection = digest.getElementsByTagName('invoiceDirection')[0]?.textContent || '';
      const invoiceStatus = digest.getElementsByTagName('invoiceStatus')[0]?.textContent || '';
      const supplierTaxNumber = digest.getElementsByTagName('supplierTaxNumber')[0]?.textContent || '';
      const customerTaxNumber = digest.getElementsByTagName('customerTaxNumber')[0]?.textContent || '';
      const invoiceOperation = digest.getElementsByTagName('invoiceOperation')[0]?.textContent || '';
      const insDate = digest.getElementsByTagName('insDate')[0]?.textContent || '';
      
      invoices.push({
        invoiceNumber,
        invoiceDirection,
        invoiceStatus,
        supplierTaxNumber,
        customerTaxNumber,
        invoiceOperation,
        insDate,
      });
    }
    
    return {
      success: true,
      data: {
        invoices,
        currentPage,
        availablePage,
        invoiceDigestResult: xmlResponse
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to parse XML response: ${error}`
    };
  }
}

function base64ToUtf8(b64: string) {
  try { 
    return new TextDecoder().decode(Uint8Array.from(atob(b64), c => c.charCodeAt(0))); 
  } catch { 
    return null; 
  }
}

// Store invoice digests in Supabase
async function storeInvoiceDigests(digests: any[], userId: string, environment: string) {
  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    for (const digest of digests) {
      try {
        const { error } = await supabase
          .from('nav_outbound_invoices')
          .upsert({
            user_id: userId,
            invoice_number: digest.invoiceNumber,
            supplier_tax_number: digest.supplierTaxNumber,
            customer_tax_number: digest.customerTaxNumber,
            invoice_operation: digest.invoiceOperation,
            ins_date: digest.insDate,
            currency: 'HUF',
            raw_nav_response: digest,
            nav_environment: environment,
            last_updated: new Date().toISOString(),
          }, {
            onConflict: 'user_id,invoice_number,nav_environment'
          });
        
        if (error) {
          console.error('Error storing invoice digest:', error);
        }
      } catch (error) {
        console.error('Error processing digest:', error);
      }
    }
  } catch (error) {
    console.error('Error in storeInvoiceDigests:', error);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const useTest = url.searchParams.get('test') !== 'false';
    const shouldStore = url.searchParams.get('store_data') === 'true';
    
    const requestText = await req.text();
    const request = JSON.parse(requestText);
    
    console.log('📥 Request received:', { action, test: useTest, direction: request.direction, shouldStore });

    // Get user from JWT token
    const authorization = req.headers.get('authorization');
    let userId = null;
    if (authorization) {
      try {
        const token = authorization.replace('Bearer ', '');
        const payload = JSON.parse(atob(token.split('.')[1]));
        userId = payload.sub;
      } catch (e) {
        console.log('Could not parse user from token');
      }
    }

    if (action === 'list') {
      const { xml } = await queryInvoiceDigestXml(request);
      const navResponse = await callNav(xml, "queryInvoiceDigest", useTest);
      
      if (!navResponse.ok) {
        return new Response(JSON.stringify({
          success: false,
          error: `NAV API error: ${navResponse.status} - ${navResponse.body}`
        }), {
          headers: cors,
          status: navResponse.status
        });
      }

      const result = pickDigests(navResponse.body);
      
      if (result.success && result.data?.invoices) {
        // Store data in Supabase if requested and user is authenticated
        if (shouldStore && userId && request.direction === 'OUTBOUND') {
          await storeInvoiceDigests(result.data.invoices, userId, useTest ? 'test' : 'production');
        }
        
        return new Response(JSON.stringify(result), {
          headers: cors,
          status: 200
        });
      } else {
        return new Response(JSON.stringify({
          success: false,
          error: result.error || "Failed to process NAV response"
        }), {
          headers: cors,
          status: 500
        });
      }
    }

    if (action === 'data') {
      const { xml } = await queryInvoiceDataXml(request);
      const navResponse = await callNav(xml, "queryInvoiceData", useTest);
      
      if (!navResponse.ok) {
        return new Response(JSON.stringify({
          ok: false,
          error: `NAV API error: ${navResponse.status} - ${navResponse.body}`
        }), {
          headers: cors,
          status: navResponse.status
        });
      }

      // Pull <invoiceData> (BASE64) if present
      const doc = new DOMParser().parseFromString(navResponse.body, "text/xml");
      const b64 = doc.getElementsByTagName("invoiceData")[0]?.textContent ?? null;
      const decodedXml = b64 ? base64ToUtf8(b64) : null;
      
      return new Response(JSON.stringify({ 
        ok: true, 
        rawXml: navResponse.body, 
        invoiceXml: decodedXml 
      }), { 
        headers: cors 
      });
    }

    return new Response(JSON.stringify({ 
      success: false, 
      error: "Unknown action" 
    }), { 
      status: 400, 
      headers: cors 
    });
  } catch (e) {
    console.error('Edge function error:', e);
    return new Response(JSON.stringify({ 
      success: false, 
      error: String(e) 
    }), { 
      status: 500, 
      headers: cors 
    });
  }
});