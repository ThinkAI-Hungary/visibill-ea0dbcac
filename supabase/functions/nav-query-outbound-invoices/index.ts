import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { sha512 } from 'https://denopkg.com/chiefbiiko/sha512@v1.0.2/mod.ts';
import { sha3_512 } from 'https://deno.land/x/sha3@v1.0.1/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NavCredentials {
  nav_username: string;
  nav_password: string;
  nav_tax_number: string;
  nav_sign_key: string;
  nav_exchange_key: string;
  software_id: string;
  software_dev_name: string;
  software_dev_contact: string;
  is_test_environment: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[NAV-QUERY-OUTBOUND] Function started');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const navApiUrl = Deno.env.get('NAV_API_URL')!;

    // Create Supabase client with auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[NAV-QUERY-OUTBOUND] No authorization header');
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Authenticate user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error('[NAV-QUERY-OUTBOUND] Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[NAV-QUERY-OUTBOUND] User authenticated:', user.id);

    // Parse request body
    const { dateFrom, dateTo, additionalFilters } = await req.json();
    
    if (!dateFrom || !dateTo) {
      return new Response(
        JSON.stringify({ error: 'dateFrom and dateTo are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate date range (max 35 days)
    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);
    const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff > 35) {
      return new Response(
        JSON.stringify({ error: 'Date range cannot exceed 35 days' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[NAV-QUERY-OUTBOUND] Date range:', { dateFrom, dateTo, daysDiff });

    // Get credentials
    const { data: credsData, error: credsError } = await supabaseClient.rpc('get_nav_credentials', {
      p_user_id: user.id
    });

    if (credsError || !credsData || credsData.error) {
      console.error('[NAV-QUERY-OUTBOUND] Failed to get credentials:', credsError || credsData?.error);
      return new Response(
        JSON.stringify({ error: 'Failed to retrieve NAV credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const credentials: NavCredentials = credsData;
    console.log('[NAV-QUERY-OUTBOUND] Credentials retrieved');

    // Determine endpoint
    const endpoint = credentials.is_test_environment
      ? 'https://api-test.onlineszamla.nav.gov.hu/invoiceService/v3/queryInvoiceDigest'
      : 'https://api.onlineszamla.nav.gov.hu/invoiceService/v3/queryInvoiceDigest';

    console.log('[NAV-QUERY-OUTBOUND] Using endpoint:', endpoint);

    // Fetch up to 3 pages
    const allInvoices: any[] = [];
    let currentPage = 1;
    let availablePage = 1;
    const maxPages = 3;

    while (currentPage <= maxPages && currentPage <= availablePage) {
      console.log(`[NAV-QUERY-OUTBOUND] Fetching page ${currentPage}/${availablePage}`);

      const requestId = generateRequestId();
      const timestamp = new Date().toISOString();
      const timestampFormatted = timestamp.replace(/[-:]/g, '').split('.')[0] + 'Z';

      // Build password hash (SHA-512)
      const passwordHashInput = requestId + credentials.nav_password;
      const passwordHash = Array.from(sha512(passwordHashInput, 'utf8'))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();

      // Build request signature (SHA3-512)
      const signatureInput = requestId + timestampFormatted.substring(0, 14) + credentials.nav_sign_key;
      const requestSignature = sha3_512(signatureInput).toString().toUpperCase();

      // Build XML request
      const xmlBody = buildQueryXML({
        requestId,
        timestamp,
        credentials,
        passwordHash,
        requestSignature,
        page: currentPage,
        dateFrom,
        dateTo,
        additionalFilters
      });

      console.log('[NAV-QUERY-OUTBOUND] Sending request to NAV API');

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml; charset=UTF-8',
          'Accept': 'application/xml'
        },
        body: xmlBody
      });

      const responseText = await response.text();
      console.log('[NAV-QUERY-OUTBOUND] NAV API response status:', response.status);

      if (!response.ok) {
        console.error('[NAV-QUERY-OUTBOUND] NAV API error:', responseText);
        const errorMsg = parseNAVError(responseText);
        return new Response(
          JSON.stringify({ 
            error: 'NAV API request failed',
            details: errorMsg,
            page: currentPage
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Parse response
      const pageData = parseQueryResponse(responseText);
      
      if (pageData.funcCode !== 'OK') {
        console.error('[NAV-QUERY-OUTBOUND] NAV returned error:', pageData.errorMessage);
        return new Response(
          JSON.stringify({ 
            error: 'NAV query failed',
            details: pageData.errorMessage,
            page: currentPage
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update available pages
      availablePage = pageData.availablePage || 1;
      
      // Add invoices from this page
      if (pageData.invoices && pageData.invoices.length > 0) {
        allInvoices.push(...pageData.invoices);
        console.log(`[NAV-QUERY-OUTBOUND] Page ${currentPage}: ${pageData.invoices.length} invoices`);
      }

      currentPage++;
    }

    console.log(`[NAV-QUERY-OUTBOUND] Query complete. Total invoices: ${allInvoices.length}, Pages fetched: ${currentPage - 1}`);

    return new Response(
      JSON.stringify({
        success: true,
        invoices: allInvoices,
        totalInvoices: allInvoices.length,
        pagesFetched: currentPage - 1,
        totalPagesAvailable: availablePage
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[NAV-QUERY-OUTBOUND] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateRequestId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'RID';
  for (let i = 0; i < 27; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function buildQueryXML(params: {
  requestId: string;
  timestamp: string;
  credentials: NavCredentials;
  passwordHash: string;
  requestSignature: string;
  page: number;
  dateFrom: string;
  dateTo: string;
  additionalFilters?: any;
}): string {
  const { requestId, timestamp, credentials, passwordHash, requestSignature, page, dateFrom, dateTo, additionalFilters } = params;

  let additionalParamsXML = '';
  if (additionalFilters) {
    additionalParamsXML = '<additionalQueryParams>';
    if (additionalFilters.currency) {
      additionalParamsXML += `<currency>${additionalFilters.currency}</currency>`;
    }
    if (additionalFilters.taxNumber) {
      additionalParamsXML += `<taxNumber>${additionalFilters.taxNumber}</taxNumber>`;
    }
    additionalParamsXML += '</additionalQueryParams>';
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<QueryInvoiceDigestRequest xmlns="http://schemas.nav.gov.hu/OSA/3.0/api" xmlns:common="http://schemas.nav.gov.hu/NTCA/1.0/common">
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
    <common:requestSignature cryptoType="SHA3-512">${requestSignature}</common:requestSignature>
  </common:user>
  <software>
    <softwareId>${credentials.software_id}</softwareId>
    <softwareName>Visibill</softwareName>
    <softwareOperation>ONLINE_SERVICE</softwareOperation>
    <softwareMainVersion>1.0</softwareMainVersion>
    <softwareDevName>${credentials.software_dev_name || 'Visibill'}</softwareDevName>
    <softwareDevContact>${credentials.software_dev_contact || 'support@visibill.hu'}</softwareDevContact>
  </software>
  <page>${page}</page>
  <invoiceDirection>OUTBOUND</invoiceDirection>
  <invoiceQueryParams>
    <mandatoryQueryParams>
      <invoiceIssueDate>
        <dateFrom>${dateFrom}</dateFrom>
        <dateTo>${dateTo}</dateTo>
      </invoiceIssueDate>
    </mandatoryQueryParams>
    ${additionalParamsXML}
  </invoiceQueryParams>
</QueryInvoiceDigestRequest>`;
}

function parseQueryResponse(xml: string): any {
  const funcCodeMatch = xml.match(/<funcCode>([^<]+)<\/funcCode>/);
  const funcCode = funcCodeMatch ? funcCodeMatch[1] : null;

  if (funcCode !== 'OK') {
    const errorMessage = parseNAVError(xml);
    return { funcCode, errorMessage };
  }

  const currentPageMatch = xml.match(/<currentPage>(\d+)<\/currentPage>/);
  const availablePageMatch = xml.match(/<availablePage>(\d+)<\/availablePage>/);

  const currentPage = currentPageMatch ? parseInt(currentPageMatch[1]) : 1;
  const availablePage = availablePageMatch ? parseInt(availablePageMatch[1]) : 1;

  const invoices: any[] = [];
  const invoiceDigestRegex = /<invoiceDigest>([\s\S]*?)<\/invoiceDigest>/g;
  let match;

  while ((match = invoiceDigestRegex.exec(xml)) !== null) {
    const digestXML = match[1];
    
    const invoice: any = {};
    
    const extractField = (fieldName: string) => {
      const regex = new RegExp(`<${fieldName}>([^<]*)<\/${fieldName}>`);
      const match = digestXML.match(regex);
      return match ? match[1] : null;
    };

    invoice.invoiceNumber = extractField('invoiceNumber');
    invoice.invoiceOperation = extractField('invoiceOperation');
    invoice.invoiceCategory = extractField('invoiceCategory');
    invoice.invoiceIssueDate = extractField('invoiceIssueDate');
    invoice.supplierTaxNumber = extractField('supplierTaxNumber');
    invoice.customerTaxNumber = extractField('customerTaxNumber');
    invoice.customerName = extractField('customerName');
    invoice.paymentMethod = extractField('paymentMethod');
    invoice.invoiceAppearance = extractField('invoiceAppearance');
    invoice.currency = extractField('currency');
    invoice.invoiceNetAmount = extractField('invoiceNetAmount');
    invoice.invoiceNetAmountHUF = extractField('invoiceNetAmountHUF');
    invoice.invoiceVatAmount = extractField('invoiceVatAmount');
    invoice.invoiceVatAmountHUF = extractField('invoiceVatAmountHUF');
    invoice.transactionId = extractField('transactionId');
    invoice.index = extractField('index');
    invoice.insDate = extractField('insDate');

    invoices.push(invoice);
  }

  return {
    funcCode,
    currentPage,
    availablePage,
    invoices
  };
}

function parseNAVError(xml: string): string {
  const errorCodeMatch = xml.match(/<errorCode>([^<]+)<\/errorCode>/);
  const messageMatch = xml.match(/<message>([^<]+)<\/message>/);
  
  if (errorCodeMatch || messageMatch) {
    const errorCode = errorCodeMatch ? errorCodeMatch[1] : 'UNKNOWN';
    const message = messageMatch ? messageMatch[1] : 'No error message';
    return `${errorCode}: ${message}`;
  }
  
  return 'Unknown NAV API error';
}
