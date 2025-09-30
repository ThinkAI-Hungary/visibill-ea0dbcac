// Handle CORS preflight requests
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Import SHA3-512 from Node.js crypto (available in Deno)
import { createHash } from "node:crypto";

function utcTimestampISO8601(d = new Date()) {
  // Return UTC timestamp in ISO 8601 format as required by NAV v3: yyyy-MM-ddTHH:mm:ssZ
  return d.toISOString();
}

function sha512UpperHex(s: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(s);
  return crypto.subtle.digest('SHA-512', data)
    .then(ab => Array.from(new Uint8Array(ab), b => b.toString(16).padStart(2, '0')).join('').toUpperCase());
}

// SHA3-512 implementation using Node.js crypto
function sha3_512UpperHex(s: string) {
  return createHash('sha3-512').update(s).digest('hex').toUpperCase();
}

async function buildHeader(user: any, password: string, signatureKey: string, operation: string, useTestUrl: boolean) {
  // Generate request ID and truncate to max 30 characters (NAV v3 requirement)
  const fullRequestId = crypto.randomUUID();
  const requestId = fullRequestId.replace(/-/g, '').substring(0, 30);
  const timestamp = utcTimestampISO8601();
  
  // Hash password using SHA-512
  const passwordHash = await sha512UpperHex(password);
  console.log('🔐 Password hash:', passwordHash);
  
  // Create request signature using SHA3-512
  const toHash = requestId + timestamp + signatureKey;
  const signature = sha3_512UpperHex(toHash);
  console.log('📝 Signature input:', toHash);
  console.log('✍️ Signature:', signature);

  return {
    requestId,
    timestamp,
    signature,
    passwordHash,
    xml: `
      <common:requestId>${requestId}</common:requestId>
      <common:timestamp>${timestamp}</common:timestamp>
      <common:requestVersion>3.0</common:requestVersion>
      <common:headerVersion>1.0</common:headerVersion>
    `
  };
}

function buildUserXml(taxNumber: string, login: string, passwordHash: string, signature: string) {
  return `
    <common:user>
      <common:login>${login}</common:login>
      <common:passwordHash cryptoType="SHA-512">${passwordHash}</common:passwordHash>
      <common:taxNumber>${taxNumber}</common:taxNumber>
      <common:requestSignature cryptoType="SHA3-512">${signature}</common:requestSignature>
    </common:user>
  `;
}

const softwareXml = `
  <software>
    <softwareId>HU1234567800000000</softwareId>
    <softwareName>Visibill NAV Integration</softwareName>
    <softwareOperation>ONLINE_SERVICE</softwareOperation>
    <softwareMainVersion>1.0</softwareMainVersion>
    <softwareDevName>Visibill</softwareDevName>
    <softwareDevContact>info@visibill.hu</softwareDevContact>
    <softwareDevCountryCode>HU</softwareDevCountryCode>
    <softwareDevTaxNumber>12345678</softwareDevTaxNumber>
  </software>
`;

function xmlEnvelope(bodyContent: string, requestType: string = 'QueryInvoiceDigestRequest') {
  return `<?xml version="1.0" encoding="UTF-8"?>
    <${requestType} xmlns="http://schemas.nav.gov.hu/OSA/3.0/api" 
                    xmlns:common="http://schemas.nav.gov.hu/NTCA/1.0/common">
      ${bodyContent}
    </${requestType}>`;
}

async function queryInvoiceDigestXml(params: any) {
  const { login, password, signatureKey, taxNumber, direction, page = 1, invoiceIssueDate, issueDateFrom, issueDateTo, insDate } = params;
  
  // Validate required fields
  if (!login || !password || !signatureKey || !taxNumber) {
    throw new Error('Missing required fields: login, password, signatureKey, taxNumber');
  }
  
  // Handle date parameters - accept either invoiceIssueDate OR issueDateFrom/issueDateTo OR insDate
  const hasIssueDate = invoiceIssueDate;
  const hasDateRange = issueDateFrom && issueDateTo;
  const hasInsDate = insDate;
  
  if (!hasIssueDate && !hasDateRange && !hasInsDate) {
    console.error('Validation error: Missing date field. Received params:', JSON.stringify(params, null, 2));
    throw new Error('Date field is required for invoice queries. Please provide either invoiceIssueDate, issueDateFrom/issueDateTo, or insDate.');
  }
  
  // Use the appropriate date values
  const dateFrom = invoiceIssueDate || issueDateFrom;
  const dateTo = invoiceIssueDate || issueDateTo;
  
  const header = await buildHeader({ login, taxNumber }, password, signatureKey, 'queryInvoiceDigest', false);
  const userXml = buildUserXml(taxNumber, login, header.passwordHash, header.signature);

  let mandatoryQueryParams = '';
  
  if (hasIssueDate || hasDateRange) {
    mandatoryQueryParams = `
      <mandatoryQueryParams>
        <invoiceIssueDate>
          <dateFrom>${dateFrom}</dateFrom>
          <dateTo>${dateTo}</dateTo>
        </invoiceIssueDate>
      </mandatoryQueryParams>
    `;
  }
  
  if (hasInsDate) {
    mandatoryQueryParams = `
      <mandatoryQueryParams>
        <insDate>
          <dateFrom>${insDate}</dateFrom>
          <dateTo>${insDate}</dateTo>
        </insDate>
      </mandatoryQueryParams>
    `;
  }

  const bodyContent = `
    <common:header>
      ${header.xml}
    </common:header>
    ${userXml}
    ${softwareXml}
    <page>${page}</page>
    <invoiceDirection>${direction}</invoiceDirection>
    <invoiceQueryParams>
      ${mandatoryQueryParams}
    </invoiceQueryParams>
  `;

  return { xml: xmlEnvelope(bodyContent, 'QueryInvoiceDigestRequest'), requestId: header.requestId };
}

async function queryInvoiceDataXml(params: any) {
  const { login, password, signatureKey, taxNumber, direction, invoiceNumber, supplierTaxNumber } = params;
  
  // Validate required fields
  if (!login || !password || !signatureKey || !taxNumber || !invoiceNumber) {
    throw new Error('Missing required fields: login, password, signatureKey, taxNumber, invoiceNumber');
  }
  
  const header = await buildHeader({ login, taxNumber }, password, signatureKey, 'queryInvoiceData', false);
  const userXml = buildUserXml(taxNumber, login, header.passwordHash, header.signature);

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
    
    // Enhanced logging for debugging
    console.log(`NAV API Response [${response.status}]:`, responseText.substring(0, 500));
    
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
    const requestText = await req.text();
    const request = requestText ? JSON.parse(requestText) : {};
    // Support query params and body fallbacks
    const action = url.searchParams.get('action') || request.action || 'list';
    const testParam = url.searchParams.get('test');
    const useTest = testParam ? testParam !== 'false' : (request.test !== false);
    const shouldStore = url.searchParams.get('store_data') === 'true' || request.store_data === true;
    
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
      let navResponse;
      
      try {
        console.log('🔍 Authentication details:', {
          login: request.login?.substring(0, 5) + '***',
          taxNumber: request.taxNumber,
          hasPassword: !!request.password,
          hasSignatureKey: !!request.signatureKey,
          testMode: useTest
        });
        
        const { xml } = await queryInvoiceDigestXml(request);
        console.log('XML root element:', xml.match(/<([A-Za-z0-9:]+)\b/)?.[1]);
        console.log('Sending XML to NAV (truncated):', xml.substring(0, 1000) + (xml.length > 1000 ? '...' : ''));
        
        navResponse = await callNav(xml, "queryInvoiceDigest", useTest);
        
        if (!navResponse.ok) {
          console.error('NAV API Error Response (truncated):', navResponse.body.substring(0, 1000) + (navResponse.body.length > 1000 ? '...' : ''));
          
          // Check for specific authentication errors and provide helpful messages
          let errorMessage = `NAV API error: ${navResponse.status} - ${navResponse.body}`;
          if (navResponse.body.includes('INVALID_SECURITY_USER')) {
            errorMessage += '\n\nTroubleshooting tips:\n1. Ensure you are using TEST environment credentials for test mode\n2. Verify your login, password, and signature key are correct\n3. Check that your technical user is properly registered in the test environment';
          }
          
          return new Response(JSON.stringify({
            success: false,
            error: errorMessage,
            errorCode: 'NAV_API_ERROR'
          }), {
            headers: cors,
            status: 200
          });
        }
      } catch (validationError) {
        console.error('Validation error:', validationError);
        return new Response(JSON.stringify({
          success: false,
          error: `Validation error: ${validationError.message}`,
          errorCode: 'VALIDATION_ERROR'
        }), {
          headers: cors,
          status: 200
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
      let navResponse;
      
      try {
        const { xml } = await queryInvoiceDataXml(request);
        console.log('Sending XML to NAV for data query (truncated):', xml.substring(0, 1000) + (xml.length > 1000 ? '...' : ''));
        
        navResponse = await callNav(xml, "queryInvoiceData", useTest);
        
        if (!navResponse.ok) {
          console.error('NAV API Error Response (truncated):', navResponse.body.substring(0, 1000) + (navResponse.body.length > 1000 ? '...' : ''));
          return new Response(JSON.stringify({
            success: false,
            error: `NAV API error: ${navResponse.status} - ${navResponse.body}`,
            errorCode: 'NAV_API_ERROR'
          }), {
            headers: cors,
            status: 200
          });
        }
      } catch (validationError) {
        console.error('Validation error:', validationError);
        return new Response(JSON.stringify({
          success: false,
          error: `Validation error: ${validationError.message}`,
          errorCode: 'VALIDATION_ERROR'
        }), {
          headers: cors,
          status: 200
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
        error: "Unknown action",
        errorCode: 'INVALID_ACTION'
      }), { 
        status: 200, 
        headers: cors 
      });
  } catch (e) {
    console.error('Edge function error:', e);
    
    // Return structured error with 200 status for better frontend handling
    return new Response(JSON.stringify({ 
      success: false, 
      error: String(e),
      errorCode: 'PROCESSING_ERROR'
    }), { 
      status: 200, 
      headers: cors 
    });
  }
});