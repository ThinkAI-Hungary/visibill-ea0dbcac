import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'
import { sha3_512 } from 'https://esm.sh/@noble/hashes@1.3.0/sha3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncParams {
  direction: 'OUTBOUND' | 'INBOUND';
  dateFrom: string;
  dateTo: string;
  page?: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get the JWT token from the Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Get user from token
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Invalid user token');
    }

    console.log('[NAV-SYNC] Processing sync request for user:', user.id);

    const syncParams: SyncParams = await req.json();
    
    // Start sync log
    const { data: syncLog, error: logError } = await supabaseClient
      .from('nav_sync_logs')
      .insert({
        user_id: user.id,
        sync_type: 'manual',
        invoice_direction: syncParams.direction,
        date_from: syncParams.dateFrom,
        date_to: syncParams.dateTo,
        status: 'running'
      })
      .select()
      .single();

    if (logError) {
      throw new Error('Failed to create sync log');
    }

    const startTime = Date.now();
    let totalFetched = 0;

    try {
      // Get credentials
      const { data: credsResult, error: credsError } = await supabaseClient
        .rpc('get_nav_credentials', { p_user_id: user.id });

      if (credsError || !credsResult || credsResult.error) {
        throw new Error('Could not retrieve credentials');
      }

      const credentials = credsResult;
      
      // Get exchange token first
      const baseUrl = 'https://api.onlineszamla.nav.gov.hu/invoiceService/v3';
      const token = await getNavToken(credentials, baseUrl);
      console.log('[NAV-SYNC] Got exchange token');

      // Fetch invoices from NAV API
      const invoices = await fetchInvoicesFromNAV(
        credentials,
        token,
        syncParams
      );

      console.log(`[NAV-SYNC] Fetched ${invoices.length} invoices`);

      // Store invoices in database
      if (invoices.length > 0) {
        // Deduplicate by invoice_number to prevent
        // "ON CONFLICT DO UPDATE command cannot affect row a second time" error
        const invoicesRaw = invoices.map(invoice => ({
              ...invoice,
              user_id: user.id,
              fetched_at: new Date().toISOString()
            }));
        const seen = new Map<string, (typeof invoicesRaw)[0]>();
        for (const inv of invoicesRaw) {
          seen.set(inv.invoice_number, inv);
        }
        const dedupedInvoices = Array.from(seen.values());

        const { error: insertError } = await supabaseClient
          .from('nav_invoices')
          .upsert(dedupedInvoices,
            { onConflict: 'company_id,invoice_number' }
          );

        if (insertError) {
          console.error('[NAV-SYNC] Insert error:', insertError);
          throw new Error('Failed to store invoices');
        }
      }

      totalFetched = invoices.length;

      // Update sync log - success
      await supabaseClient
        .from('nav_sync_logs')
        .update({
          status: 'completed',
          invoices_fetched: totalFetched,
          duration_ms: Date.now() - startTime,
          completed_at: new Date().toISOString()
        })
        .eq('id', syncLog.id);

      // Auto-promote NAV credentials validation_status to 'valid' on successful NAV API communication
      try {
        await supabaseClient
          .from('user_nav_credentials')
          .update({
            validation_status: 'valid',
            last_validated_at: new Date().toISOString(),
            validation_error: null
          })
          .eq('user_id', user.id);
      } catch (credErr) {
        console.warn('[NAV-SYNC] Failed to auto-promote validation_status:', credErr);
      }

      return new Response(
        JSON.stringify({
          success: true,
          invoices_fetched: totalFetched,
          sync_log_id: syncLog.id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error) {
      // Update sync log - error
      await supabaseClient
        .from('nav_sync_logs')
        .update({
          status: 'failed',
          error_message: error.message,
          duration_ms: Date.now() - startTime,
          completed_at: new Date().toISOString()
        })
        .eq('id', syncLog.id);

      throw error;
    }

  } catch (error) {
    console.error('[NAV-SYNC] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function fetchInvoicesFromNAV(
  credentials: any,
  token: string,
  params: SyncParams
): Promise<any[]> {
  const baseUrl = credentials.is_test_environment 
    ? 'https://api-test.onlineszamla.nav.gov.hu/invoiceService/v3'
    : 'https://api.onlineszamla.nav.gov.hu/invoiceService/v3';

  const queryXML = await createQueryInvoiceDataRequest(credentials, token, params);

  console.log('[NAV-SYNC] Querying NAV API with:', queryXML);

  const response = await fetch(`${baseUrl}/queryInvoiceData`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/xml; charset=UTF-8',
      'Accept': 'application/xml'
    },
    body: queryXML
  });

  const xmlResponse = await response.text();
  console.log('[NAV-SYNC] NAV API response:', xmlResponse);

  if (!response.ok) {
    throw new Error(`NAV API request failed: ${response.status}`);
  }

  // Parse XML response and extract invoice data
  return parseInvoiceDataResponse(xmlResponse);
}

async function createQueryInvoiceDataRequest(
  credentials: any,
  token: string,
  params: SyncParams
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const requestId = crypto.randomUUID();

  const passwordHash = await hashPassword(credentials.nav_password);
  const signature = await createSignature(credentials, requestId, timestamp);

  return `<?xml version="1.0" encoding="UTF-8"?>
<QueryInvoiceDataRequest xmlns="http://schemas.nav.gov.hu/OSA/3.0/api"
                        xmlns:common="http://schemas.nav.gov.hu/NTCA/1.0/common">
  <common:header>
    <common:requestId>${requestId}</common:requestId>
    <common:timestamp>${timestamp}</common:timestamp>
    <common:requestVersion>3.0</common:requestVersion>
    <common:headerVersion>1.0</common:headerVersion>
  </common:header>
  <common:user>
    <common:login>${credentials.nav_username}</common:login>
    <common:passwordHash cryptoType="SHA-512">${passwordHash}</common:passwordHash>
    <common:taxNumber>${credentials.nav_tax_number}</common:taxNumber>
    <common:requestSignature cryptoType="SHA3-512">${signature}</common:requestSignature>
  </common:user>
  <software>
    <softwareId>${credentials.software_id}</softwareId>
    <softwareName>VisiBill NAV Integration</softwareName>
    <softwareOperation>ONLINE_SERVICE</softwareOperation>
    <softwareMainVersion>1.0</softwareMainVersion>
    <softwareDevName>${credentials.software_dev_name || 'VisiBill'}</softwareDevName>
    <softwareDevContact>${credentials.software_dev_contact || 'support@visibill.hu'}</softwareDevContact>
  </software>
  <exchangeToken>${token}</exchangeToken>
  <invoiceQueryParams>
    <mandatoryQueryParams>
      <invoiceDirection>${params.direction}</invoiceDirection>
      <queryDateType>ISSUE</queryDateType>
      <queryDateFrom>${params.dateFrom}</queryDateFrom>
      <queryDateTo>${params.dateTo}</queryDateTo>
    </mandatoryQueryParams>
  </invoiceQueryParams>
</QueryInvoiceDataRequest>`;
}

function parseInvoiceDataResponse(xmlResponse: string): any[] {
  // Simple XML parsing for demo - in production, use a proper XML parser
  const invoices: any[] = [];
  
  // Check if response contains invoices
  if (xmlResponse.includes('<invoiceDigest>')) {
    // Extract invoice digests using regex (simplified)
    const invoiceMatches = xmlResponse.matchAll(/<invoiceDigest>(.*?)<\/invoiceDigest>/gs);
    
    for (const match of invoiceMatches) {
      const invoiceXML = match[1];
      
      const invoice = {
        invoice_number: extractXMLValue(invoiceXML, 'invoiceNumber') || 'UNKNOWN',
        invoice_direction: extractXMLValue(invoiceXML, 'invoiceDirection'),
        invoice_operation: extractXMLValue(invoiceXML, 'invoiceOperation'),
        supplier_tax_number: extractXMLValue(invoiceXML, 'supplierTaxNumber'),
        customer_tax_number: extractXMLValue(invoiceXML, 'customerTaxNumber'),
        invoice_issue_date: extractXMLValue(invoiceXML, 'invoiceIssueDate'),
        invoice_delivery_date: extractXMLValue(invoiceXML, 'invoiceDeliveryDate'),
        invoice_net_amount: parseFloat(extractXMLValue(invoiceXML, 'invoiceNetAmount') || '0'),
        invoice_vat_amount: parseFloat(extractXMLValue(invoiceXML, 'invoiceVatAmount') || '0'),
        invoice_gross_amount: parseFloat(extractXMLValue(invoiceXML, 'invoiceGrossAmount') || '0'),
        payment_method: extractXMLValue(invoiceXML, 'paymentMethod'),
        currency: extractXMLValue(invoiceXML, 'currency') || 'HUF'
      };
      
      invoices.push(invoice);
    }
  }
  
  console.log(`[NAV-SYNC] Parsed ${invoices.length} invoices from XML`);
  return invoices;
}

function extractXMLValue(xml: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}>(.*?)<\/${tagName}>`, 's');
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

async function hashPassword(password: string): Promise<string> {
  // NAV v3: hash password only (not requestId+password)
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-512', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

async function createSignature(credentials: any, requestId: string, timestamp: string): Promise<string> {
  // NAV v3: SHA3-512 hash of requestId + compactTimestamp + signKey
  const date = new Date(timestamp);
  const compactTimestamp = date.getUTCFullYear().toString() +
    (date.getUTCMonth() + 1).toString().padStart(2, '0') +
    date.getUTCDate().toString().padStart(2, '0') +
    date.getUTCHours().toString().padStart(2, '0') +
    date.getUTCMinutes().toString().padStart(2, '0') +
    date.getUTCSeconds().toString().padStart(2, '0');
  const signatureBase = `${requestId}${compactTimestamp}${credentials.nav_sign_key}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(signatureBase);
  const hash = sha3_512(data);
  return Array.from(hash)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

// Get NAV exchange token
async function getNavToken(credentials: any, navApiUrl: string): Promise<string> {
  const requestId = crypto.randomUUID().replace(/-/g, '').substring(0, 30);
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const passwordHash = await hashPassword(credentials.nav_password);
  const signature = await createSignature(credentials, requestId, timestamp);

  const tokenXml = `<?xml version="1.0" encoding="UTF-8"?>
<TokenExchangeRequest xmlns="http://schemas.nav.gov.hu/OSA/3.0/api" xmlns:common="http://schemas.nav.gov.hu/NTCA/1.0/common">
  <common:header>
    <common:requestId>${requestId}</common:requestId>
    <common:timestamp>${timestamp}</common:timestamp>
    <common:requestVersion>3.0</common:requestVersion>
    <common:headerVersion>1.0</common:headerVersion>
  </common:header>
  <common:user>
    <common:login>${credentials.nav_username}</common:login>
    <common:passwordHash cryptoType="SHA-512">${passwordHash}</common:passwordHash>
    <common:taxNumber>${credentials.nav_tax_number}</common:taxNumber>
    <common:requestSignature cryptoType="SHA3-512">${signature}</common:requestSignature>
  </common:user>
  <software>
    <softwareId>${credentials.software_id}</softwareId>
    <softwareName>VisiBill NAV Integration</softwareName>
    <softwareOperation>ONLINE_SERVICE</softwareOperation>
    <softwareMainVersion>1.0</softwareMainVersion>
    <softwareDevName>${credentials.software_dev_name || 'VisiBill'}</softwareDevName>
    <softwareDevContact>${credentials.software_dev_contact || 'support@visibill.hu'}</softwareDevContact>
  </software>
</TokenExchangeRequest>`;

  const response = await fetch(`${navApiUrl}/tokenExchange`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/xml; charset=UTF-8',
      'Accept': 'application/xml'
    },
    body: tokenXml
  });

  const responseText = await response.text();
  
  if (!response.ok) {
    throw new Error(`NAV token request failed: ${response.status}`);
  }

  const tokenMatch = responseText.match(/<(?:\w+:)?encodedExchangeToken>([^<]+)<\/(?:\w+:)?encodedExchangeToken>/);
  if (!tokenMatch) {
    throw new Error('Failed to extract token from NAV response');
  }

  return tokenMatch[1];
}
