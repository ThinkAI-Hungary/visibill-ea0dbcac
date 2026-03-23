import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

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
      
      // Get token first
      const tokenResponse = await fetch(`${req.url.replace('/nav-sync', '/nav-token')}`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'request_token' })
      });

      const tokenData = await tokenResponse.json();
      if (!tokenData.success) {
        throw new Error('Failed to get NAV token');
      }

      // Fetch invoices from NAV API
      const invoices = await fetchInvoicesFromNAV(
        credentials,
        tokenData.token,
        syncParams
      );

      console.log(`[NAV-SYNC] Fetched ${invoices.length} invoices`);

      // Store invoices in database
      if (invoices.length > 0) {
        const { error: insertError } = await supabaseClient
          .from('nav_invoices')
          .upsert(
            invoices.map(invoice => ({
              ...invoice,
              user_id: user.id,
              fetched_at: new Date().toISOString()
            })),
            { onConflict: 'user_id,invoice_number' }
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

  const passwordHash = await hashPassword(credentials.nav_password, requestId);
  const signature = await createSignature(credentials, requestId, timestamp);

  return `<?xml version="1.0" encoding="UTF-8"?>
<QueryInvoiceDataRequest xmlns="http://schemas.nav.gov.hu/OSA/3.0/api">
  <header>
    <requestId>${requestId}</requestId>
    <timestamp>${timestamp}</timestamp>
    <requestVersion>3.0</requestVersion>
    <headerVersion>1.0</headerVersion>
  </header>
  <user>
    <login>${credentials.nav_username}</login>
    <passwordHash>${passwordHash}</passwordHash>
    <taxNumber>${credentials.nav_tax_number}</taxNumber>
    <requestSignature>${signature}</requestSignature>
  </user>
  <software>
    <softwareId>${credentials.software_id}</softwareId>
    <softwareName>VisiBill NAV Integration</softwareName>
    <softwareOperation>LOCAL_SOFTWARE</softwareOperation>
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

async function hashPassword(password: string, requestId: string): Promise<string> {
  // NAV requires SHA512 hash of password + requestId
  const encoder = new TextEncoder();
  const data = encoder.encode(requestId + password);
  const hash = await crypto.subtle.digest('SHA-512', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

async function createSignature(credentials: any, requestId: string, timestamp: string): Promise<string> {
  // Simplified signature creation - in production, this would use proper cryptographic signing
  const signatureBase = `${requestId}${timestamp}${credentials.nav_sign_key}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(signatureBase);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}
